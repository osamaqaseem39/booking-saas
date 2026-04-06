import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import {
  createBooking,
  createIamUser,
  getCourtSlotGrid,
  listBookings,
  listBookingsForTenant,
  listBusinesses,
  listBusinessLocations,
  listCourtOptions,
  listIamUsers,
} from '../api/saasClient';
import { useSession } from '../context/SessionContext';
import type { DashboardOutletContext } from '../layout/ConsoleLayout';
import type {
  BookingRecord,
  BookingItemStatus,
  BookingSportType,
  CourtKind,
} from '../types/booking';
import type { BusinessLocationRow, BusinessRow, IamUserRow } from '../types/domain';
import { normalizePhoneForStorage } from '../utils/phone';
import { formatTime12h } from '../utils/timeDisplay';

type CustomerMode = 'existing' | 'walk-in';
type BookingSource = 'walkin' | 'app' | 'call';
type SavedCustomer = { name: string; phone: string; updatedAt: string };

const SAVED_CUSTOMERS_KEY = 'bookings-dashboard.saved-customers';

function digitsOnly(v: string): string {
  return v.replace(/\D/g, '');
}

function localDateYmd(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function withPakistanPrefix(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '+92';
  const asDigits = digitsOnly(trimmed);
  if (!asDigits) return '+92';
  if (trimmed.startsWith('+')) return trimmed;
  if (asDigits.startsWith('92')) return `+${asDigits}`;
  if (asDigits.startsWith('0')) return `+92${asDigits.slice(1)}`;
  return `+92${asDigits}`;
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

function toLocalDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
}

const BOOKING_TIMING_LOG = '[BookingTiming][Full]';

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

type ButtonOption = {
  value: string;
  label: string;
};

function defaultLine(): BookingLine {
  return {
    facilityKey: '',
    courtKind: 'futsal_court',
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
  const today = localDateYmd();
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

function weekdayKeyFromYmd(bookingDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(bookingDate.trim());
  if (!m) return 'monday';
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dayIndex = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0)).getUTCDay();
  return DAY_BY_INDEX[dayIndex] ?? 'monday';
}

function getWorkingDayWindow(
  workingHours: Record<string, unknown> | null | undefined,
  bookingDate: string,
): { closed: boolean; open: string; close: string } {
  const dayKey = weekdayKeyFromYmd(bookingDate);
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

function applyMinLeadTimeToStarts(slots: string[], bookingDate: string): string[] {
  const today = localDateYmd();
  if (bookingDate !== today) return slots;
  const minM = timeToMinutes(nextHalfHourTime());
  return slots.filter((t) => timeToMinutes(t) >= minM);
}

function remainingDaySlotsInWindow(
  date: string,
  openTime: string,
  closeTime: string,
): string[] {
  const today = localDateYmd();
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
  if (start.getHours() >= 22) {
    start.setDate(start.getDate() + 1);
  }
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const value = localDateYmd(d);
    out.push({
      value,
      day: days[d.getDay()] ?? '',
      dateNum: String(d.getDate()),
    });
  }
  return out;
}

function ButtonOptionGroup({
  value,
  options,
  onChange,
  emptyText = 'No options available',
}: {
  value: string;
  options: ButtonOption[];
  onChange: (value: string) => void;
  emptyText?: string;
}) {
  if (options.length === 0) {
    return <span className="muted">{emptyText}</span>;
  }
  return (
    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            className={active ? 'btn-primary' : 'btn-ghost'}
            style={{ padding: '0.35rem 0.7rem', borderRadius: '999px', fontSize: '0.86rem' }}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function BookingCreatePage() {
  const INTERVALS_PER_SLIDE = 5;
  const navigate = useNavigate();
  const { tenantId, setTenantId, session } = useSession();
  const isPlatformOwner = session?.roles?.includes('platform-owner') ?? false;
  const { selectedLocationId } = useOutletContext<DashboardOutletContext>();
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<IamUserRow[]>([]);
  const [locations, setLocations] = useState<BusinessLocationRow[]>([]);
  const [sport, setSport] = useState<BookingSportType>('futsal');
  /** Empty = all locations (facility list follows Sport). When set, facility list shows every court/field at that location (sport still used for booking validation). */
  const [facilityLocationId, setFacilityLocationId] = useState('');
  const topbarLocationLocked = selectedLocationId !== 'all';
  const effectiveLocationId = topbarLocationLocked ? selectedLocationId : facilityLocationId;

  const [bookingDate, setBookingDate] = useState(() =>
    localDateYmd(),
  );
  const [phone, setPhone] = useState('+92');
  const [customerMode, setCustomerMode] = useState<CustomerMode>('existing');
  const [customerId, setCustomerId] = useState('');
  const [bookingSource, setBookingSource] = useState<BookingSource>('walkin');
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('+92');
  const [lines, setLines] = useState<BookingLine[]>([defaultLine()]);
  const [courtOpts, setCourtOpts] = useState<
    Awaited<ReturnType<typeof listCourtOptions>>
  >([]);
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState('0');
  const [tax, setTax] = useState('0');
  const [allBookings, setAllBookings] = useState<BookingRecord[]>([]);
  const [savedCustomersByPhone, setSavedCustomersByPhone] = useState<Record<string, SavedCustomer>>({});
  /** Per line: server slot grid (free-only, working hours + hides booked) vs local fallback. */
  const [lineSlotSource, setLineSlotSource] = useState<
    Record<number, { starts: string[]; source: 'api' | 'local' }>
  >({});
  const bookingDateChoices = useMemo(() => nextSevenDays(), []);

  const slotGridFetchKey = useMemo(
    () =>
      `${tenantId.trim()}|${bookingDate}|${lines
        .map((l) => `${l.courtKind}:${l.courtId}`)
        .join(';')}`,
    [tenantId, bookingDate, lines],
  );

  useEffect(() => {
    if (!tenantId.trim()) {
      setLineSlotSource({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const next: Record<number, { starts: string[]; source: 'api' | 'local' }> = {};
      for (let idx = 0; idx < lines.length; idx += 1) {
        const ln = lines[idx];
        if (!ln.courtId.trim()) {
          continue;
        }
        try {
          const grid = await getCourtSlotGrid({
            courtKind: ln.courtKind,
            courtId: ln.courtId.trim(),
            date: bookingDate,
            useWorkingHours: true,
            availableOnly: true,
          });
          if (cancelled) return;
          if (grid.locationClosed) {
            next[idx] = { starts: [], source: 'api' };
            continue;
          }
          const starts = grid.segments
            .filter((s) => s.state === 'free')
            .map((s) => s.startTime);
          console.info(BOOKING_TIMING_LOG, 'slot-grid-loaded', {
            lineIndex: idx,
            courtKind: ln.courtKind,
            courtId: ln.courtId.trim(),
            bookingDate,
            locationClosed: grid.locationClosed,
            freeSlots: starts.length,
          });
          next[idx] = { starts, source: 'api' };
        } catch {
          console.warn(BOOKING_TIMING_LOG, 'slot-grid-fallback-local', {
            lineIndex: idx,
            courtKind: ln.courtKind,
            courtId: ln.courtId.trim(),
            bookingDate,
          });
          next[idx] = { starts: [], source: 'local' };
        }
      }
      if (!cancelled) setLineSlotSource(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [slotGridFetchKey]);

  useEffect(() => {
    if (bookingDateChoices.length === 0) return;
    const exists = bookingDateChoices.some((d) => d.value === bookingDate);
    if (!exists) {
      setBookingDate(bookingDateChoices[0].value);
    }
  }, [bookingDateChoices, bookingDate]);

  useEffect(() => {
    if (!isPlatformOwner) return;
    void (async () => {
      try {
        setBusinesses(await listBusinesses());
      } catch {
        setBusinesses([]);
      }
    })();
  }, [isPlatformOwner]);

  useEffect(() => {
    if (!isPlatformOwner || businesses.length === 0) return;
    const valid = businesses.some((b) => b.tenantId === tenantId);
    if (!tenantId.trim() || !valid) {
      setTenantId(businesses[0].tenantId);
    }
  }, [isPlatformOwner, businesses, tenantId, setTenantId]);

  useEffect(() => {
    void (async () => {
      try {
        const rows: IamUserRow[] = await listIamUsers();
        setUsers(rows);
      } catch {
        setUsers([]);
      }
    })();
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId.trim()) {
      setLocations([]);
      return;
    }
    void (async () => {
      try {
        const rows = await listBusinessLocations();
        setLocations(rows);
      } catch {
        setLocations([]);
      }
    })();
  }, [tenantId]);

  useEffect(() => {
    if (topbarLocationLocked) {
      setFacilityLocationId(selectedLocationId);
    }
  }, [selectedLocationId, topbarLocationLocked]);

  useEffect(() => {
    if (topbarLocationLocked) return;
    setFacilityLocationId('');
  }, [tenantId, topbarLocationLocked]);

  useEffect(() => {
    void (async () => {
      const loc = effectiveLocationId.trim();
      setCourtOpts(
        loc
          ? await listCourtOptions(undefined, loc)
          : await listCourtOptions(sport),
      );
      setLines([defaultLine()]);
    })();
  }, [sport, effectiveLocationId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_CUSTOMERS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, SavedCustomer>;
      if (parsed && typeof parsed === 'object') {
        setSavedCustomersByPhone(parsed);
      }
    } catch {
      setSavedCustomersByPhone({});
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const rows = tenantId.trim()
          ? await listBookingsForTenant(tenantId.trim())
          : await listBookings();
        setAllBookings(rows);
      } catch {
        setAllBookings([]);
      }
    })();
  }, [tenantId]);

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

  const savedByPhone = useMemo(() => {
    const wanted = digitsOnly(phone);
    if (!wanted) return null;
    return (
      Object.values(savedCustomersByPhone).find((entry) => {
        const p = digitsOnly(entry.phone);
        return p && (p === wanted || p.endsWith(wanted) || wanted.endsWith(p));
      }) ?? null
    );
  }, [savedCustomersByPhone, phone]);

  const selectedUserId = useMemo(() => {
    if (existingByPhone?.id) return existingByPhone.id;
    if (customerMode === 'existing' && customerId.trim()) return customerId.trim();
    return '';
  }, [existingByPhone, customerId, customerMode]);

  const customerBookings = useMemo(() => {
    if (!selectedUserId) return [];
    return allBookings
      .filter((b) => b.userId === selectedUserId)
      .sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime());
  }, [allBookings, selectedUserId]);

  useEffect(() => {
    if (existingByPhone) {
      setCustomerMode('existing');
      setCustomerId(existingByPhone.id);
      setWalkInPhone(existingByPhone.phone ?? phone);
      return;
    }
    if (savedByPhone) {
      setCustomerMode('walk-in');
      setWalkInName((prev) => (prev.trim() ? prev : savedByPhone.name));
      setWalkInPhone(savedByPhone.phone || phone);
      return;
    }
    setCustomerId('');
    if (digitsOnly(phone)) {
      setCustomerMode('walk-in');
      setWalkInPhone(phone);
    }
  }, [existingByPhone, phone, savedByPhone]);

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
      setError(
        isPlatformOwner
          ? 'Select a business before creating a booking.'
          : 'Pick an active tenant in the top bar.',
      );
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
    for (const [idx, ln] of lines.entries()) {
      if (!ln.courtId.trim()) {
        setError('Each line requires a facility.');
        return;
      }
      if (!ln.price || Number(ln.price) < 0) {
        setError('Each line requires a valid price.');
        return;
      }
      const startTime = minutesToTime(ln.startMinutes);
      const endTime = minutesToTime(
        Math.min(ln.startMinutes + ln.durationMins, 23 * 60 + 30),
      );
      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);
      const duration = endMinutes - startMinutes;
      console.info(BOOKING_TIMING_LOG, 'line-time-check', {
        lineIndex: idx,
        bookingDate,
        startTime,
        endTime,
        duration,
      });
      if (duration < 30 || startMinutes % 30 !== 0 || endMinutes % 30 !== 0) {
        console.warn(BOOKING_TIMING_LOG, 'line-time-invalid-interval', {
          lineIndex: idx,
          startTime,
          endTime,
          duration,
        });
        setError('Each booking line must use 30-minute intervals (minimum 30 mins).');
        return;
      }
      const startAt = toLocalDateTime(bookingDate, startTime);
      const minStart = new Date(Date.now() + 30 * 60 * 1000);
      if (startAt.getTime() < minStart.getTime()) {
        console.warn(BOOKING_TIMING_LOG, 'line-time-too-soon', {
          lineIndex: idx,
          bookingDate,
          startTime,
          minStartIso: minStart.toISOString(),
        });
        setError('Bookings must be at least 30 minutes in the future.');
        return;
      }
      const slotSource = lineSlotSource[idx];
      if (slotSource?.source === 'api' && !slotSource.starts.includes(startTime)) {
        console.warn(BOOKING_TIMING_LOG, 'line-start-not-in-free-slots', {
          lineIndex: idx,
          startTime,
          freeSlotsSample: slotSource.starts.slice(0, 8),
        });
        setError('Selected start time is no longer available. Please pick another slot.');
        return;
      }
    }
    let resolvedCustomerId = customerId.trim();
    let customerNameToSave = walkInName.trim();
    let customerPhoneToSave = normalizePhoneForStorage(walkInPhone || phone);
    if (existingByPhone) {
      customerNameToSave = existingByPhone.fullName;
      customerPhoneToSave = normalizePhoneForStorage(existingByPhone.phone ?? phone);
    } else if (customerMode !== 'walk-in') {
      const selected = users.find((u) => u.id === resolvedCustomerId);
      if (selected) {
        customerNameToSave = selected.fullName;
        customerPhoneToSave = normalizePhoneForStorage(selected.phone ?? phone);
      }
    }
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
      customerNameToSave = created.fullName;
      customerPhoneToSave = normalizePhoneForStorage(created.phone ?? walkInPhone);
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
        notes:
          [`source:${bookingSource}`, notes.trim()]
            .filter(Boolean)
            .join(' | ') || undefined,
      });
      const normalizedSavePhone = digitsOnly(customerPhoneToSave);
      if (normalizedSavePhone && customerNameToSave.trim()) {
        setSavedCustomersByPhone((cur) => {
          const next: Record<string, SavedCustomer> = {
            ...cur,
            [normalizedSavePhone]: {
              name: customerNameToSave.trim(),
              phone: withPakistanPrefix(customerPhoneToSave),
              updatedAt: new Date().toISOString(),
            },
          };
          try {
            localStorage.setItem(SAVED_CUSTOMERS_KEY, JSON.stringify(next));
          } catch {
            // Ignore local storage write errors.
          }
          return next;
        });
      }
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
        <div className="err-banner">
          {isPlatformOwner
            ? 'Select a business below to load locations and facilities.'
            : 'Pick an active tenant in the top bar.'}
        </div>
      )}
      {error && <div className="err-banner">{error}</div>}

      <section className="detail-card" style={{ maxWidth: '980px' }}>
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '2fr 1fr' }}>
          <div>
        <div className="form-grid">
          {isPlatformOwner && (
            <>
              <h3 style={{ marginBottom: '0.2rem' }}>Business</h3>
              <div>
                <label htmlFor="booking-business-tenant">Business</label>
                <select
                  id="booking-business-tenant"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  disabled={businesses.length === 0}
                >
                  {businesses.map((b) => (
                    <option key={b.id} value={b.tenantId}>
                      {b.businessName}
                      {b.tenantId ? ` · ${b.tenantId.slice(0, 8)}…` : ''}
                    </option>
                  ))}
                </select>
                <p className="muted" style={{ marginTop: '0.35rem', marginBottom: 0 }}>
                  The booking is created for this tenant. Change business to pick a different
                  location and facilities.
                </p>
              </div>
            </>
          )}
          <h3 style={{ marginBottom: '0.2rem' }}>Customer</h3>
          <div>
            <label>Customer phone (required)</label>
            <input
              value={phone}
              onChange={(e) => setPhone(withPakistanPrefix(e.target.value))}
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
          {!existingByPhone && savedByPhone && (
            <div className="detail-row">
              <span>Saved customer</span>
              <span>{savedByPhone.name} ({savedByPhone.phone})</span>
            </div>
          )}
          {!existingByPhone && digitsOnly(phone) && (
            <>
              <div>
                <label>Booking source</label>
                <ButtonOptionGroup
                  value={bookingSource}
                  onChange={(next) => setBookingSource(next as BookingSource)}
                  options={[
                    { value: 'walkin', label: 'Walk-in' },
                    { value: 'app', label: 'App' },
                    { value: 'call', label: 'Call' },
                  ]}
                />
              </div>
              <div>
                <label>Customer mode</label>
                <ButtonOptionGroup
                  value={customerMode}
                  onChange={(next) => setCustomerMode(next as CustomerMode)}
                  options={[
                    { value: 'walk-in', label: 'Walk-in' },
                    { value: 'existing', label: 'Existing (Enter User ID)' },
                  ]}
                />
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
              <label>Location</label>
              <ButtonOptionGroup
                value={effectiveLocationId}
                onChange={setFacilityLocationId}
                options={
                  topbarLocationLocked
                    ? locations
                        .filter((loc) => loc.id === selectedLocationId)
                        .map((loc) => ({
                          value: loc.id,
                          label: `${loc.name}${loc.city ? ` · ${loc.city}` : ''}`,
                        }))
                    : [
                        { value: '', label: 'All locations' },
                        ...locations.map((loc) => ({
                          value: loc.id,
                          label: `${loc.name}${loc.city ? ` · ${loc.city}` : ''}`,
                        })),
                      ]
                }
              />
              <p id="facility-location-hint" className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.82rem' }}>
                {topbarLocationLocked
                  ? 'Location is locked by top bar filter. Quick booking shows facilities for this location only.'
                  : facilityLocationId.trim()
                  ? 'All facility types at this location are listed below. Lines must still match the selected sport for booking validation.'
                  : 'Facilities are filtered by sport. Pick a location to list every court and field there.'}
              </p>
            </div>
            <div>
              <label>Sport</label>
              <ButtonOptionGroup
                value={sport}
                onChange={(next) => setSport(next as BookingSportType)}
                options={[
                  { value: 'futsal', label: 'Futsal' },
                  { value: 'cricket', label: 'Cricket' },
                  { value: 'padel', label: 'Padel' },
                ]}
              />
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
              const fallbackSlots = dayWindow.closed
                ? []
                : remainingDaySlotsInWindow(
                    bookingDate,
                    dayWindow.open,
                    dayWindow.close,
                  );
              const src = lineSlotSource[idx];
              const baseStarts =
                src?.source === 'api' ? src.starts : fallbackSlots;
              const startSlots = applyMinLeadTimeToStarts(baseStarts, bookingDate);
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
                      <ButtonOptionGroup
                        value={ln.facilityKey}
                        onChange={(next) => applyFacility(idx, next)}
                        options={[
                          { value: '', label: 'Select…' },
                          ...courtOpts.map((o) => ({
                            value: `${o.kind}:${o.id}`,
                            label: courtOnlyLabel(o.label),
                          })),
                        ]}
                        emptyText="No facilities available for current filters."
                      />
                      {location && (
                        <div className="muted" style={{ marginTop: '0.3rem' }}>
                          Working hours:{' '}
                          {dayWindow.closed
                            ? 'Closed'
                            : `${formatTime12h(dayWindow.open)} - ${formatTime12h(dayWindow.close)}`}
                        </div>
                      )}
                    </div>
                    <div className="form-row-2">
                      <div>
                        <label>Start time ({formatTime12h(startTime)})</label>
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
                                {formatTime12h(slot)}
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
                          End time: {formatTime12h(endTime)}
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
                        <ButtonOptionGroup
                          value={ln.status}
                          onChange={(nextStatus) => {
                            const next = [...lines];
                            next[idx] = {
                              ...ln,
                              status: nextStatus as BookingItemStatus,
                            };
                            setLines(next);
                          }}
                          options={[
                            { value: 'reserved', label: 'Reserved' },
                            { value: 'confirmed', label: 'Confirmed' },
                            { value: 'cancelled', label: 'Cancelled' },
                          ]}
                        />
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
          </div>
          <aside className="detail-card" style={{ margin: 0 }}>
            <h3 style={{ marginTop: 0 }}>Customer details</h3>
            <div className="detail-row">
              <span>Name</span>
              <span>{existingByPhone?.fullName || savedByPhone?.name || walkInName || '-'}</span>
            </div>
            <div className="detail-row">
              <span>Phone</span>
              <span>{withPakistanPrefix(phone)}</span>
            </div>
            <div className="detail-row">
              <span>Status</span>
              <span>{existingByPhone ? 'Existing user' : savedByPhone ? 'Saved contact' : 'New customer'}</span>
            </div>
            <h4 style={{ margin: '0.8rem 0 0.45rem' }}>Previous bookings</h4>
            {customerBookings.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>No previous bookings found.</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.45rem' }}>
                {customerBookings.slice(0, 6).map((bk) => (
                  <div key={bk.bookingId} className="item-editor" style={{ margin: 0 }}>
                    <div className="detail-row">
                      <span>Date</span>
                      <span>{bk.bookingDate}</span>
                    </div>
                    <div className="detail-row">
                      <span>Sport</span>
                      <span>{bk.sportType}</span>
                    </div>
                    <div className="detail-row">
                      <span>Status</span>
                      <span>{bk.bookingStatus}</span>
                    </div>
                    <div className="detail-row">
                      <span>Amount</span>
                      <span>PKR {bk.pricing.totalAmount}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
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
