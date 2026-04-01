import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createBooking,
  createIamUser,
  listBusinessLocations,
  listCourtOptions,
  listIamUsers,
} from '../api/saasClient';
import { useSession } from '../context/SessionContext';
import type {
  BookingItemStatus,
  BookingSportType,
  CourtKind,
} from '../types/booking';
import type { BusinessLocationRow, IamUserRow } from '../types/domain';
import { normalizePhoneForStorage } from '../utils/phone';

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
  slotPage: number;
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
    slotPage: 0,
  };
}

function normalizeMoney(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0';
  return String(Math.round(n));
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

type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

const DAY_BY_INDEX: Weekday[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

const DAY_ALIASES: Record<string, Weekday> = {
  mon: 'monday',
  monday: 'monday',
  tue: 'tuesday',
  tues: 'tuesday',
  tuesday: 'tuesday',
  wed: 'wednesday',
  wednesday: 'wednesday',
  thu: 'thursday',
  thur: 'thursday',
  thurs: 'thursday',
  thursday: 'thursday',
  fri: 'friday',
  friday: 'friday',
  sat: 'saturday',
  saturday: 'saturday',
  sun: 'sunday',
  sunday: 'sunday',
};

function normalizeTime(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const match = value.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? `${match[1]}:${match[2]}` : fallback;
}

function parseStringRange(value: string): { open: string; close: string } | null {
  const match = value
    .trim()
    .match(/^([01]\d|2[0-3]):([0-5]\d)\s*-\s*([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return { open: `${match[1]}:${match[2]}`, close: `${match[3]}:${match[4]}` };
}

function getWorkingDayWindow(
  workingHours: Record<string, unknown> | null | undefined,
  bookingDate: string,
): { closed: boolean; open: string; close: string } {
  const d = new Date(`${bookingDate}T00:00:00`);
  const dayKey = DAY_BY_INDEX[d.getDay()] ?? 'monday';
  const defaults = { closed: false, open: '00:00', close: '23:30' };
  if (!workingHours || typeof workingHours !== 'object') return defaults;
  const entries = Object.entries(workingHours);
  const match = entries.find(([k]) => DAY_ALIASES[k.toLowerCase()] === dayKey);
  if (!match) return defaults;
  const raw = match[1];
  if (typeof raw === 'string') {
    const range = parseStringRange(raw);
    return range ? { closed: false, ...range } : defaults;
  }
  if (!raw || typeof raw !== 'object') return defaults;
  const rec = raw as Record<string, unknown>;
  const closed =
    rec.closed === true || rec.isClosed === true || rec.open === false;
  const open = normalizeTime(rec.open, defaults.open);
  const close = normalizeTime(rec.close, defaults.close);
  if (open >= close) return { closed: true, open, close };
  return { closed, open, close };
}

function remainingDaySlotsInWindow(
  date: string,
  openTime: string,
  closeTime: string,
): string[] {
  const today = new Date().toISOString().slice(0, 10);
  const dayMin = date === today ? timeToMinutes(nextHalfHourTime()) : 0;
  const start = Math.max(timeToMinutes(openTime), dayMin);
  const endExclusive = timeToMinutes(closeTime);
  const out: string[] = [];
  for (let m = start; m < endExclusive; m += 30) {
    out.push(minutesToTime(m));
  }
  return out;
}

function nextSevenDays(): Array<{ value: string; day: string; dateNum: string }> {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const out: Array<{ value: string; day: string; dateNum: string }> = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const value = d.toISOString().slice(0, 10);
    out.push({
      value,
      day: days[d.getDay()] ?? '',
      dateNum: String(d.getDate()),
    });
  }
  return out;
}

export default function BookingCreatePage() {
  const INTERVALS_PER_SLIDE = 5;
  const navigate = useNavigate();
  const { tenantId } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<IamUserRow[]>([]);
  const [locations, setLocations] = useState<BusinessLocationRow[]>([]);
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
  const bookingDateChoices = useMemo(() => nextSevenDays(), []);

  useEffect(() => {
    void (async () => {
      try {
        const rows: IamUserRow[] = await listIamUsers();
        setUsers(rows);
      } catch {
        setUsers([]);
      }
    })();
    void (async () => {
      try {
        const rows = await listBusinessLocations();
        setLocations(rows);
      } catch {
        setLocations([]);
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

  function updateDurationWithPrice(line: BookingLine, nextDuration: number): BookingLine {
    const prevDuration = Math.max(30, line.durationMins);
    const safeNext = Math.max(60, nextDuration);
    const currentPrice = Number(line.price || 0);
    const ratePerMinute = currentPrice > 0 ? currentPrice / prevDuration : 0;
    const nextPrice = ratePerMinute > 0 ? ratePerMinute * safeNext : currentPrice;
    return {
      ...line,
      durationMins: safeNext,
      price: normalizeMoney(nextPrice),
    };
  }

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
        phone: normalizePhoneForStorage(walkInPhone),
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
                  <option value="walk-in">Walk-in</option>
                  <option value="existing">Existing (Enter User ID)</option>
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
                <option value="futsal">Futsal</option>
                <option value="cricket">Cricket</option>
                <option value="padel">Padel</option>
              </select>
            </div>
            <div>
              <label>Date</label>
              <div
                style={{
                  display: 'flex',
                  gap: '0.45rem',
                  flexWrap: 'wrap',
                  marginTop: '0.35rem',
                }}
              >
                {bookingDateChoices.map((d) => {
                  const active = d.value === bookingDate;
                  return (
                    <button
                      key={d.value}
                      type="button"
                      className={active ? 'btn-primary' : 'btn-ghost'}
                      style={{
                        minWidth: '58px',
                        padding: '0.45rem 0.6rem',
                        borderRadius: '12px',
                        fontSize: '0.84rem',
                        lineHeight: 1.1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.1rem',
                      }}
                      onClick={() => setBookingDate(d.value)}
                    >
                      <span>{d.day}</span>
                      <strong>{d.dateNum}</strong>
                    </button>
                  );
                })}
              </div>
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
              const selectedCourt =
                courtOpts.find((o) => `${o.kind}:${o.id}` === ln.facilityKey) ?? null;
              const location = selectedCourt?.businessLocationId
                ? locations.find((l) => l.id === selectedCourt.businessLocationId) ?? null
                : null;
              const dayWindow = getWorkingDayWindow(
                (location?.workingHours as Record<string, unknown> | null) ?? null,
                bookingDate,
              );
              const startSlots = dayWindow.closed
                ? []
                : remainingDaySlotsInWindow(
                    bookingDate,
                    dayWindow.open,
                    dayWindow.close,
                  );
              const totalSlides = Math.max(
                1,
                Math.ceil(startSlots.length / INTERVALS_PER_SLIDE),
              );
              const currentSlide = Math.min(
                Math.max(ln.slotPage, 0),
                totalSlides - 1,
              );
              const slideStart = currentSlide * INTERVALS_PER_SLIDE;
              const visibleSlots = startSlots.slice(
                slideStart,
                slideStart + INTERVALS_PER_SLIDE,
              );
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
                      {location && (
                        <div className="muted" style={{ marginTop: '0.3rem' }}>
                          Working hours: {dayWindow.closed ? 'Closed' : `${dayWindow.open} - ${dayWindow.close}`}
                        </div>
                      )}
                    </div>
                    <div className="form-row-2">
                      <div>
                        <label>Start time ({startTime})</label>
                        {startSlots.length > 0 && (
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginTop: '0.35rem',
                            }}
                          >
                            <button
                              type="button"
                              className="btn-ghost"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                              disabled={currentSlide === 0}
                              onClick={() => {
                                const next = [...lines];
                                next[idx] = {
                                  ...ln,
                                  slotPage: Math.max(0, currentSlide - 1),
                                };
                                setLines(next);
                              }}
                            >
                              Prev
                            </button>
                            <span className="muted" style={{ fontSize: '0.78rem' }}>
                              Slide {currentSlide + 1} / {totalSlides}
                            </span>
                            <button
                              type="button"
                              className="btn-ghost"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                              disabled={currentSlide >= totalSlides - 1}
                              onClick={() => {
                                const next = [...lines];
                                next[idx] = {
                                  ...ln,
                                  slotPage: Math.min(totalSlides - 1, currentSlide + 1),
                                };
                                setLines(next);
                              }}
                            >
                              Next
                            </button>
                          </div>
                        )}
                        <div
                          style={{
                            display: 'flex',
                            gap: '0.4rem',
                            flexWrap: 'nowrap',
                            overflowX: 'hidden',
                            paddingBottom: '0.25rem',
                            marginTop: '0.35rem',
                          }}
                        >
                          {visibleSlots.map((slot) => {
                            const active = slot === startTime;
                            return (
                              <button
                                key={slot}
                                type="button"
                                className={active ? 'btn-primary' : 'btn-ghost'}
                                style={{
                                  padding: '0.35rem 0.7rem',
                                  borderRadius: '999px',
                                  fontSize: '0.88rem',
                                  flex: '0 0 auto',
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
                          {startSlots.length === 0 && (
                            <span className="muted" style={{ fontSize: '0.78rem' }}>
                              No slots available in working hours for this day.
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <label>Duration</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ padding: '0.45rem 0.8rem', fontSize: '0.92rem' }}
                            onClick={() => {
                              const next = [...lines];
                              next[idx] = updateDurationWithPrice(ln, ln.durationMins);
                              setLines(next);
                            }}
                          >
                            {Math.max(60, ln.durationMins)} min
                          </button>
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.88rem' }}
                            onClick={() => {
                              const next = [...lines];
                              next[idx] = updateDurationWithPrice(ln, ln.durationMins + 30);
                              setLines(next);
                            }}
                          >
                            +30
                          </button>
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.88rem' }}
                            onClick={() => {
                              const next = [...lines];
                              next[idx] = updateDurationWithPrice(ln, ln.durationMins - 30);
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
                          <option value="reserved">Reserved</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="cancelled">Cancelled</option>
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
