import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createBooking,
  createIamUser,
  getCourtBookedSlots,
  listCourtOptions,
  listIamUsers,
} from '../api/saasClient';
import { useSession } from '../context/SessionContext';
import type { BookingSportType, CourtKind } from '../types/booking';
import type { IamUserRow } from '../types/domain';

type CustomerMode = 'existing' | 'walk-in';

function digitsOnly(v: string): string {
  return v.replace(/\D/g, '');
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function nextHalfHourTime(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  const mins = d.getMinutes();
  const rounded = mins <= 30 ? 30 : 60;
  if (rounded === 60) {
    d.setHours(d.getHours() + 1, 0, 0, 0);
  } else {
    d.setMinutes(30, 0, 0);
  }
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map((x) => Number(x || 0));
  return h * 60 + m;
}

function minutesToTime(v: number): string {
  const hh = Math.floor(v / 60) % 24;
  const mm = v % 60;
  return `${pad2(hh)}:${pad2(mm)}`;
}

function makePassword(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `Walkin!${rand}9`;
}

export default function BookingCreatePage() {
  const navigate = useNavigate();
  const { tenantId } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<IamUserRow[]>([]);
  const [sport, setSport] = useState<BookingSportType>('futsal');
  const [bookingDate, setBookingDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [phone, setPhone] = useState('');
  const [customerMode, setCustomerMode] = useState<CustomerMode>('existing');
  const [customerId, setCustomerId] = useState('');
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [facilityKey, setFacilityKey] = useState('');
  const [facilityKind, setFacilityKind] = useState<CourtKind>('turf_court');
  const [facilityId, setFacilityId] = useState('');
  const [startMinutes, setStartMinutes] = useState(() => timeToMinutes(nextHalfHourTime()));
  const [durationMins, setDurationMins] = useState(60);
  const [courtOpts, setCourtOpts] = useState<
    Awaited<ReturnType<typeof listCourtOptions>>
  >([]);
  const [courtSlotsLoading, setCourtSlotsLoading] = useState(false);
  const [courtSlots, setCourtSlots] = useState<
    Awaited<ReturnType<typeof getCourtBookedSlots>> | null
  >(null);
  const [notes, setNotes] = useState('');
  const [subTotal, setSubTotal] = useState('5000');
  const [discount, setDiscount] = useState('0');
  const [tax, setTax] = useState('0');

  useEffect(() => {
    void (async () => {
      try {
        const rows: IamUserRow[] = await listIamUsers();
        setUsers(rows);
      } catch {
        setUsers([]);
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      setCourtOpts(await listCourtOptions(sport));
      setFacilityKey('');
      setFacilityId('');
    })();
  }, [sport]);

  useEffect(() => {
    if (!facilityId || !facilityKind || !bookingDate) {
      setCourtSlots(null);
      return;
    }
    void (async () => {
      setCourtSlotsLoading(true);
      try {
        const result = await getCourtBookedSlots({
          courtKind: facilityKind,
          courtId: facilityId,
          date: bookingDate,
        });
        setCourtSlots(result);
      } catch {
        setCourtSlots(null);
      } finally {
        setCourtSlotsLoading(false);
      }
    })();
  }, [facilityId, facilityKind, bookingDate]);

  const totalPreview = useMemo(
    () => Number(subTotal || 0) - Number(discount || 0) + Number(tax || 0),
    [subTotal, discount, tax],
  );

  const existingByPhone = useMemo(() => {
    const wanted = digitsOnly(phone);
    if (!wanted) return null;
    return (
      users.find((u) => {
        const p = digitsOnly(u.phone ?? '');
        return p && (p === wanted || p.endsWith(wanted) || wanted.endsWith(p));
      }) ?? null
    );
  }, [users, phone]);

  useEffect(() => {
    if (existingByPhone) {
      setCustomerMode('existing');
      setCustomerId(existingByPhone.id);
      setWalkInPhone(existingByPhone.phone ?? phone);
      return;
    }
    setCustomerId('');
    if (digitsOnly(phone)) {
      setCustomerMode('walk-in');
      setWalkInPhone(phone);
    }
  }, [existingByPhone, phone]);

  const startTime = useMemo(() => minutesToTime(startMinutes), [startMinutes]);
  const endTime = useMemo(
    () => minutesToTime(Math.min(startMinutes + durationMins, 23 * 60 + 30)),
    [startMinutes, durationMins],
  );

  const availableStartSlots = useMemo(() => {
    if (!facilityId) return [] as string[];
    const all: string[] = [];
    for (let m = 0; m <= 23 * 60 + 30; m += 30) {
      all.push(minutesToTime(m));
    }
    const booked = new Set<string>();
    for (const slot of courtSlots?.slots ?? []) {
      const s = timeToMinutes(slot.startTime);
      const e = timeToMinutes(slot.endTime);
      for (let t = s; t < e; t += 30) {
        booked.add(minutesToTime(t));
      }
    }
    const today = new Date().toISOString().slice(0, 10);
    const minNow = bookingDate === today ? timeToMinutes(nextHalfHourTime()) : 0;
    return all.filter((t) => timeToMinutes(t) >= minNow && !booked.has(t));
  }, [facilityId, courtSlots, bookingDate]);

  function applyFacility(key: string) {
    setFacilityKey(key);
    if (!key) {
      setFacilityId('');
      return;
    }
    const opt = courtOpts.find((o) => `${o.kind}:${o.id}` === key);
    if (!opt) return;
    setFacilityKind(opt.kind);
    setFacilityId(opt.id);
  }

  async function submitCreate() {
    if (!tenantId.trim()) {
      setError('Pick an active tenant in the top bar.');
      return;
    }
    setError(null);
    const st = Number(subTotal);
    const disc = Number(discount);
    const tx = Number(tax);
    const total = st - disc + tx;
    if (!digitsOnly(phone)) {
      setError('Customer phone is required.');
      return;
    }
    if (!facilityId.trim()) {
      setError('Facility is required.');
      return;
    }
    if (!startTime || !endTime) {
      setError('Start and end time are required.');
      return;
    }
    let resolvedCustomerId = customerId.trim();
    if (customerMode === 'walk-in') {
      if (!walkInName.trim() || !digitsOnly(walkInPhone)) {
        setError('Walk-in requires name and phone.');
        return;
      }
      const normalizedPhone = digitsOnly(walkInPhone);
      const generatedEmail = `walkin-${normalizedPhone}-${Date.now()}@bukit.local`;
      const created = await createIamUser({
        fullName: walkInName.trim(),
        email: generatedEmail,
        phone: walkInPhone.trim(),
        password: makePassword(),
      });
      resolvedCustomerId = created.id;
    }
    if (!resolvedCustomerId) {
      setError('Unable to resolve customer for booking.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await createBooking({
        userId: resolvedCustomerId,
        sportType: sport,
        bookingDate,
        items: [
          {
            courtKind: facilityKind,
            courtId: facilityId.trim(),
            startTime,
            endTime,
            price: st,
            currency: 'PKR',
            status: 'reserved',
          },
        ],
        pricing: {
          subTotal: st,
          discount: disc,
          tax: tx,
          totalAmount: Math.max(0, total),
        },
        payment: {
          paymentStatus: 'pending',
          paymentMethod: 'cash',
        },
        bookingStatus: 'pending',
        notes: notes.trim() || undefined,
      });
      navigate('/app/bookings', {
        replace: true,
        state: { createdBookingId: created.bookingId },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <p className="page-toolbar">
        <Link to="/app/bookings" className="btn-ghost btn-compact">
          ← Back to bookings
        </Link>
      </p>
      <h1 className="page-title">Add booking</h1>
      {!tenantId.trim() && (
        <div className="err-banner">Pick an active tenant in the top bar.</div>
      )}
      {error && <div className="err-banner">{error}</div>}

      <section className="detail-card" style={{ maxWidth: '980px' }}>
        <div className="form-grid">
          <h3 style={{ marginBottom: '0.2rem' }}>Customer</h3>
          <div>
            <label>Customer phone (required)</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+92..."
            />
          </div>
          {existingByPhone ? (
            <div className="detail-row">
              <span>Matched existing customer</span>
              <span>
                {existingByPhone.fullName} ({existingByPhone.email})
              </span>
            </div>
          ) : (
            <div className="detail-row">
              <span>Existing customer</span>
              <span className="muted">Not found by this number</span>
            </div>
          )}
          {!existingByPhone && digitsOnly(phone) && (
            <>
              <div>
                <label>Customer mode</label>
                <select
                  value={customerMode}
                  onChange={(e) => setCustomerMode(e.target.value as CustomerMode)}
                >
                  <option value="walk-in">walk-in</option>
                  <option value="existing">existing (enter user ID)</option>
                </select>
              </div>
              {customerMode === 'walk-in' ? (
                <div className="form-row-2">
                  <div>
                    <label>Walk-in name (required)</label>
                    <input
                      value={walkInName}
                      onChange={(e) => setWalkInName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label>Walk-in phone (required)</label>
                    <input
                      value={walkInPhone}
                      onChange={(e) => setWalkInPhone(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label>Existing customer user ID (required)</label>
                  <input
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    placeholder="User UUID"
                  />
                </div>
              )}
            </>
          )}

          <h3 style={{ margin: '0.9rem 0 0.2rem' }}>Facility and Date/Time</h3>
          <div className="form-row-2">
            <div>
              <label>Sport</label>
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value as BookingSportType)}
              >
                <option value="futsal">futsal</option>
                <option value="cricket">cricket</option>
                <option value="padel">padel</option>
              </select>
            </div>
            <div>
              <label>Date</label>
              <input
                type="date"
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label>Facility</label>
            <select value={facilityKey} onChange={(e) => applyFacility(e.target.value)}>
              <option value="">Select…</option>
              {courtOpts.map((o) => (
                <option key={`${o.kind}:${o.id}`} value={`${o.kind}:${o.id}`}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row-2">
            <div>
              <label>
                Start time ({startTime}) - 30 min interval
              </label>
              <input
                type="range"
                min={0}
                max={47}
                step={1}
                value={Math.floor(startMinutes / 30)}
                onChange={(e) => setStartMinutes(Number(e.target.value) * 30)}
              />
            </div>
            <div>
              <label>Duration</label>
              <select
                value={durationMins}
                onChange={(e) => setDurationMins(Number(e.target.value))}
              >
                <option value={30}>30 min</option>
                <option value={60}>60 min</option>
                <option value={90}>90 min</option>
                <option value={120}>120 min</option>
              </select>
              <div className="muted" style={{ marginTop: '0.35rem' }}>
                End time: {endTime}
              </div>
            </div>
          </div>
          {facilityId && (
            <div className="detail-section" style={{ marginTop: 0 }}>
              <h4 style={{ marginBottom: '0.5rem' }}>
                Current date slots left {courtSlotsLoading ? '...' : ''}
              </h4>
              {availableStartSlots.length === 0 ? (
                <div className="empty-state">No free half-hour slots for this date.</div>
              ) : (
                <div className="muted">
                  {availableStartSlots.slice(0, 20).join(', ')}
                  {availableStartSlots.length > 20 ? ' ...' : ''}
                </div>
              )}
            </div>
          )}

          <div>
            <label>Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <h3 style={{ margin: '0.9rem 0 0.2rem' }}>Pricing</h3>
          <div className="form-row-2">
            <div>
              <label>Subtotal</label>
              <input value={subTotal} onChange={(e) => setSubTotal(e.target.value)} />
            </div>
            <div>
              <label>Total preview</label>
              <input readOnly value={String(Math.max(0, totalPreview))} />
            </div>
          </div>
          <div className="form-row-2">
            <div>
              <label>Discount</label>
              <input value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <div>
              <label>Tax</label>
              <input value={tax} onChange={(e) => setTax(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="page-actions-row">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => navigate('/app/bookings')}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void submitCreate()}
            disabled={submitting || !tenantId.trim()}
          >
            {submitting ? 'Creating…' : 'Create booking'}
          </button>
        </div>
      </section>
    </div>
  );
}
