import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createBooking,
  createIamUser,
  listCourtOptions,
  listIamUsers,
} from '../api/saasClient';
import { useSession } from '../context/SessionContext';
import type {
  BookingItemStatus,
  BookingSportType,
  CourtKind,
} from '../types/booking';
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

function courtOnlyLabel(label: string): string {
  const parts = label.split('—');
  if (parts.length < 2) return label.trim();
  return parts.slice(1).join('—').trim();
}

type BookingLine = {
  facilityKey: string;
  courtKind: CourtKind;
  courtId: string;
  startMinutes: number;
  durationMins: number;
  price: string;
  status: BookingItemStatus;
};

function defaultLine(): BookingLine {
  return {
    facilityKey: '',
    courtKind: 'turf_court',
    courtId: '',
    startMinutes: timeToMinutes(nextHalfHourTime()),
    durationMins: 60,
    price: '5000',
    status: 'reserved',
  };
}

function remainingDaySlots(date: string): string[] {
  const today = new Date().toISOString().slice(0, 10);
  const minMinutes = date === today ? timeToMinutes(nextHalfHourTime()) : 0;
  const out: string[] = [];
  for (let m = minMinutes; m <= 23 * 60 + 30; m += 30) {
    out.push(minutesToTime(m));
  }
  return out;
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
  const [lines, setLines] = useState<BookingLine[]>([defaultLine()]);
  const [courtOpts, setCourtOpts] = useState<
    Awaited<ReturnType<typeof listCourtOptions>>
  >([]);
  const [notes, setNotes] = useState('');
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
      setLines([defaultLine()]);
    })();
  }, [sport]);

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

  const subTotal = useMemo(
    () =>
      lines.reduce((sum, ln) => {
        const n = Number(ln.price || 0);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0),
    [lines],
  );
  const totalPreview = useMemo(
    () => subTotal - Number(discount || 0) + Number(tax || 0),
    [subTotal, discount, tax],
  );

  function applyFacility(lineIndex: number, key: string) {
    const line = lines[lineIndex];
    if (!line) return;
    const next = [...lines];
    if (!key) {
      next[lineIndex] = { ...line, facilityKey: '', courtId: '' };
      setLines(next);
      return;
    }
    const opt = courtOpts.find((o) => `${o.kind}:${o.id}` === key);
    if (!opt) return;
    next[lineIndex] = {
      ...line,
      facilityKey: key,
      courtKind: opt.kind,
      courtId: opt.id,
    };
    setLines(next);
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
    if (lines.length === 0) {
      setError('At least one facility line is required.');
      return;
    }
    for (const ln of lines) {
      if (!ln.courtId.trim()) {
        setError('Each line requires a facility.');
        return;
      }
      if (!ln.price || Number(ln.price) < 0) {
        setError('Each line requires a valid price.');
        return;
      }
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
        items: lines.map((ln) => ({
          courtKind: ln.courtKind,
          courtId: ln.courtId.trim(),
          startTime: minutesToTime(ln.startMinutes),
          endTime: minutesToTime(Math.min(ln.startMinutes + ln.durationMins, 23 * 60 + 30)),
          price: Number(ln.price),
          currency: 'PKR',
          status: ln.status,
        })),
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
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="muted" style={{ fontSize: '0.85rem' }}>
                Multiple lines supported
              </span>
              <button
                type="button"
                className="btn-ghost"
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
                onClick={() => setLines((cur) => [...cur, defaultLine()])}
              >
                + Add line
              </button>
            </div>
            {lines.map((ln, idx) => {
              const startTime = minutesToTime(ln.startMinutes);
              const endTime = minutesToTime(
                Math.min(ln.startMinutes + ln.durationMins, 23 * 60 + 30),
              );
              const startSlots = remainingDaySlots(bookingDate);
              return (
                <div key={idx} className="item-editor">
                  <div className="item-editor-head">
                    <span>Line {idx + 1}</span>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => setLines((cur) => cur.filter((_, i) => i !== idx))}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="form-grid">
                    <div>
                      <label>Facility</label>
                      <select
                        value={ln.facilityKey}
                        onChange={(e) => applyFacility(idx, e.target.value)}
                      >
                        <option value="">Select…</option>
                        {courtOpts.map((o) => (
                          <option key={`${o.kind}:${o.id}`} value={`${o.kind}:${o.id}`}>
                            {courtOnlyLabel(o.label)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-row-2">
                      <div>
                        <label>Start time ({startTime})</label>
                        <div
                          style={{
                            display: 'flex',
                            gap: '0.4rem',
                            flexWrap: 'wrap',
                            marginTop: '0.35rem',
                          }}
                        >
                          {startSlots.slice(0, 20).map((slot) => {
                            const active = slot === startTime;
                            return (
                              <button
                                key={slot}
                                type="button"
                                className={active ? 'btn-primary' : 'btn-ghost'}
                                style={{
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '999px',
                                  fontSize: '0.78rem',
                                }}
                                onClick={() => {
                                  const next = [...lines];
                                  next[idx] = { ...ln, startMinutes: timeToMinutes(slot) };
                                  setLines(next);
                                }}
                              >
                                {slot}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <label>Duration</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ padding: '0.25rem 0.55rem', fontSize: '0.8rem' }}
                            onClick={() => {
                              const next = [...lines];
                              next[idx] = { ...ln, durationMins: Math.max(60, ln.durationMins) };
                              setLines(next);
                            }}
                          >
                            {Math.max(60, ln.durationMins)} min
                          </button>
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ padding: '0.18rem 0.5rem', fontSize: '0.78rem' }}
                            onClick={() => {
                              const next = [...lines];
                              next[idx] = { ...ln, durationMins: ln.durationMins + 30 };
                              setLines(next);
                            }}
                          >
                            +30
                          </button>
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ padding: '0.18rem 0.5rem', fontSize: '0.78rem' }}
                            onClick={() => {
                              const next = [...lines];
                              next[idx] = {
                                ...ln,
                                durationMins: Math.max(60, ln.durationMins - 30),
                              };
                              setLines(next);
                            }}
                          >
                            -30
                          </button>
                        </div>
                        <div className="muted" style={{ marginTop: '0.35rem' }}>
                          End time: {endTime}
                        </div>
                      </div>
                    </div>
                    <div className="form-row-2">
                      <div>
                        <label>Price</label>
                        <input
                          value={ln.price}
                          onChange={(e) => {
                            const next = [...lines];
                            next[idx] = { ...ln, price: e.target.value };
                            setLines(next);
                          }}
                        />
                      </div>
                      <div>
                        <label>Status</label>
                        <select
                          value={ln.status}
                          onChange={(e) => {
                            const next = [...lines];
                            next[idx] = {
                              ...ln,
                              status: e.target.value as BookingItemStatus,
                            };
                            setLines(next);
                          }}
                        >
                          <option value="reserved">reserved</option>
                          <option value="confirmed">confirmed</option>
                          <option value="cancelled">cancelled</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

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
              <input readOnly value={String(subTotal)} />
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
