import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  createBooking,
  createBookingForTenant,
  createIamUser,
  getCourtSlotGrid,
  listBookings,
  listBookingsForTenant,
  listBusinesses,
  listBusinessLocations,
  listCourtOptions,
  listIamUsers,
} from '../../api/saasClient';
import { useSession } from '../../context/SessionContext';
import type { DashboardOutletContext } from '../../layout/ConsoleLayout';
import type {
  BookingRecord,
  BookingItemStatus,
  BookingSportType,
  PaymentStatus,
  PaymentMethod,
  CourtKind,
} from '../../types/booking';
import type { BusinessLocationRow, BusinessRow, IamUserRow } from '../../types/domain';
import { normalizePhoneForStorage } from '../../utils/phone';
import { formatTime12h } from '../../utils/timeDisplay';

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


function currentHourTime(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function timeToMinutes(t: string, isEnd = false): number {
  const [h, m] = t.split(':').map((x) => Number(x || 0));
  const total = h * 60 + m;
  if (total === 0 && isEnd) return 24 * 60;
  return total;
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
  price: string;
  status: BookingItemStatus;
  slotPage: number;
  durationMinutes: number;
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
    startMinutes: timeToMinutes(currentHourTime()),
    price: '0',
    status: 'confirmed',
    slotPage: 0,
    durationMinutes: 60,
  };
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
  // Overnight informational ranges like 16:00 -> 04:00 are valid for display.
  return { closed, open, close };
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
  const [searchParams] = useSearchParams();
  const preselectedLocationId = searchParams.get('locationId')?.trim() ?? '';
  const { tenantId, session } = useSession();
  const isPlatformOwner = session?.roles?.includes('platform-owner') ?? false;
  /** Platform owners do not use global tenant scope; pick per booking here. */
  const [ownerBookingTenantId, setOwnerBookingTenantId] = useState('');
  const bookingTenant = (isPlatformOwner ? ownerBookingTenantId : tenantId).trim();
  const { selectedLocationId } = useOutletContext<DashboardOutletContext>();
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<IamUserRow[]>([]);
  const [locations, setLocations] = useState<BusinessLocationRow[]>([]);
  /** Empty = all locations (facility list follows Sport). When set, facility list shows every court/field at that location (sport still used for booking validation). */
  const [facilityLocationId, setFacilityLocationId] = useState('');
  const topbarLocationLocked = selectedLocationId !== 'all';
  const effectiveLocationId = topbarLocationLocked ? selectedLocationId : facilityLocationId;

  const [bookingDate, setBookingDate] = useState(() => {
    const d = searchParams.get('date');
    return d ? d.slice(0, 10) : localDateYmd();
  });
  const [phone, setPhone] = useState('+92');
  const [customerMode, setCustomerMode] = useState<CustomerMode>('existing');
  const [customerId, setCustomerId] = useState('');
  const [bookingSource, setBookingSource] = useState<BookingSource>('walkin');
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('+92');

  const [sport, setSport] = useState<BookingSportType>(() => {
    const s = searchParams.get('sport') as BookingSportType;
    return ['futsal', 'cricket', 'padel'].includes(s) ? s : 'futsal';
  });

  const [lines, setLines] = useState<BookingLine[]>(() => {
    const courtId = searchParams.get('courtId');
    const startTime = searchParams.get('startTime');
    const price = searchParams.get('price');
    const kind = searchParams.get('kind') as CourtKind;

    if (courtId && startTime) {
      return [
        {
          facilityKey: `${kind}:${courtId}`,
          courtKind: kind || 'futsal_court',
          courtId,
          startMinutes: timeToMinutes(startTime),
          price: price || '0',
          status: 'confirmed',
          slotPage: 0,
          durationMinutes: 60,
        },
      ];
    }
    return [defaultLine()];
  });
  const [courtOpts, setCourtOpts] = useState<
    Awaited<ReturnType<typeof listCourtOptions>>
  >([]);
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState('0');
  const [tax, setTax] = useState('0');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paidAmount, setPaidAmount] = useState('0');
  const [allBookings, setAllBookings] = useState<BookingRecord[]>([]);
  const [savedCustomersByPhone, setSavedCustomersByPhone] = useState<Record<string, SavedCustomer>>({});
  /** Per line: server slot grid (free-only, hides booked) vs local fallback. */
  const [lineSlotSource, setLineSlotSource] = useState<
    Record<number, { starts: string[]; source: 'api' | 'local' }>
  >({});
  const bookingDateDayKey = localDateYmd();
  const bookingDateChoices = useMemo(() => nextSevenDays(), [bookingDateDayKey]);

  const slotGridFetchKey = useMemo(
    () =>
      `${bookingTenant}|${bookingDate}|${lines
        .map((l) => `${l.courtKind}:${l.courtId}`)
        .join(';')}`,
    [bookingTenant, bookingDate, lines],
  );

  useEffect(() => {
    if (!bookingTenant) {
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
            useWorkingHours: false,
            availableOnly: true,
            tenantId: isPlatformOwner ? bookingTenant : undefined,
          });
          if (cancelled) return;
          const starts = grid.segments
            .filter((s) => s.state === 'free')
            .map((s) => s.startTime);
          console.info(BOOKING_TIMING_LOG, 'slot-grid-loaded', {
            lineIndex: idx,
            courtKind: ln.courtKind,
            courtId: ln.courtId.trim(),
            bookingDate,
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
  }, [slotGridFetchKey, isPlatformOwner]);

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
    void (async () => {
      try {
        if (isPlatformOwner && !bookingTenant) {
          setUsers([]);
          return;
        }
        const rows: IamUserRow[] = await listIamUsers(
          undefined,
          isPlatformOwner ? bookingTenant : undefined,
        );
        setUsers(rows);
      } catch {
        setUsers([]);
      }
    })();
  }, [bookingTenant, isPlatformOwner]);

  useEffect(() => {
    void (async () => {
      try {
        const rows = await listBusinessLocations();
        if (isPlatformOwner && !bookingTenant) {
          setLocations([]);
          return;
        }
        if (!bookingTenant) {
          setLocations([]);
          return;
        }
        const filtered = rows.filter(
          (r) => (r.business?.tenantId ?? '').trim() === bookingTenant,
        );
        setLocations(filtered);
        // Auto-select if only one location exists and none selected
        if (filtered.length === 1 && !facilityLocationId && !topbarLocationLocked) {
          setFacilityLocationId(filtered[0].id);
        }
      } catch {
        setLocations([]);
      }
    })();
  }, [bookingTenant, isPlatformOwner, topbarLocationLocked]);

  useEffect(() => {
    if (topbarLocationLocked) {
      setFacilityLocationId(selectedLocationId);
    }
  }, [selectedLocationId, topbarLocationLocked]);

  useEffect(() => {
    if (topbarLocationLocked) return;
    if (!preselectedLocationId) return;
    const exists = locations.some((loc) => loc.id === preselectedLocationId);
    if (!exists) return;
    setFacilityLocationId(preselectedLocationId);
  }, [locations, preselectedLocationId, topbarLocationLocked]);

  useEffect(() => {
    if (topbarLocationLocked) return;
    setFacilityLocationId('');
  }, [bookingTenant, topbarLocationLocked]);

  const sportForCourtList = effectiveLocationId.trim() ? undefined : sport;

  useEffect(() => {
    void (async () => {
      const loc = effectiveLocationId.trim();
      const tenantOpt = isPlatformOwner ? bookingTenant : undefined;
      if (isPlatformOwner && !bookingTenant) {
        setCourtOpts([]);
        setLines([defaultLine()]);
        return;
      }
      setCourtOpts(
        loc
          ? await listCourtOptions(undefined, loc, tenantOpt)
          : await listCourtOptions(sportForCourtList, undefined, tenantOpt),
      );
      setLines([defaultLine()]);
    })();
  }, [sportForCourtList, effectiveLocationId, isPlatformOwner, bookingTenant]);

  useEffect(() => {
    if (!effectiveLocationId.trim()) return;
    setLines((cur) =>
      cur.map((ln) => {
        if (!ln.facilityKey.startsWith('shared-turf:')) return ln;
        return {
          ...ln,
          courtKind: sport === 'cricket' ? 'cricket_court' : 'futsal_court',
        };
      }),
    );
  }, [sport, effectiveLocationId]);

  function courtOptionValue(o: (typeof courtOpts)[number]): string {
    return o.facilityKey ?? `${o.kind}:${o.id}`;
  }

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
        if (!bookingTenant) {
          setAllBookings([]);
          return;
        }
        if (isPlatformOwner) {
          setAllBookings(await listBookingsForTenant(bookingTenant));
        } else {
          setAllBookings(await listBookings());
        }
      } catch {
        setAllBookings([]);
      }
    })();
  }, [bookingTenant, isPlatformOwner]);

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

  const paymentPreview = useMemo(() => {
    const total = Math.max(0, totalPreview);
    const paid = Math.max(0, Number(paidAmount) || 0);
    const remaining = Math.max(0, total - paid);
    return {
      total,
      paid,
      remaining,
      pct: total > 0 ? Math.round((paid / total) * 100) : 0,
    };
  }, [totalPreview, paidAmount]);

  function applyFacility(lineIndex: number, key: string) {
    const line = lines[lineIndex];
    if (!line) return;
    const next = [...lines];
    if (!key) {
      next[lineIndex] = { ...line, facilityKey: '', courtId: '' };
      setLines(next);
      return;
    }
    const opt = courtOpts.find((o) => courtOptionValue(o) === key);
    if (!opt) return;
    const shared = opt.facilityKey?.startsWith('shared-turf:') === true;
    const courtKind: CourtKind =
      shared && sport === 'cricket'
        ? 'cricket_court'
        : shared
          ? 'futsal_court'
          : opt.kind;

    let price = '0';
    if (opt.pricePerSlot != null) {
      price = String(opt.pricePerSlot);
    } else if (opt.pricing) {
      // Pick price based on sport if it's a multi-sport turf
      const s = sport.toLowerCase();
      const p = opt.pricing[s]?.basePrice ?? opt.pricing[s === 'cricket' ? 'cricket' : 'futsal']?.basePrice;
      if (p != null) price = String(p);
    }

    next[lineIndex] = {
      ...line,
      facilityKey: key,
      courtKind,
      courtId: opt.id,
      price,
    };
    setLines(next);
  }

  async function submitCreate() {
      if (!bookingTenant) {
        setError(
          isPlatformOwner
            ? 'Select a business before creating a booking.'
            : 'No active tenant found.',
        );
        return;
      }
    setError(null);
    if (!digitsOnly(phone)) {
      setError('Customer phone is required.');
      return;
    }
    if (lines.length === 0) {
      setError('At least one facility line is required.');
      return;
    }

    const st = Number(subTotal);
    const disc = Number(discount);
    const tx = Number(tax);
    const total = st - disc + tx;
    const todayYmd = localDateYmd();
    if (bookingDate < todayYmd) {
      setError('Booking date cannot be in the past.');
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
      const endTime = minutesToTime(Math.min(ln.startMinutes + ln.durationMinutes, 24 * 60));
      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime, true);
      const duration = endMinutes - startMinutes;
      console.info(BOOKING_TIMING_LOG, 'line-time-check', {
        lineIndex: idx,
        bookingDate,
        startTime,
        endTime,
        duration,
      });
      if (duration < 60 || startMinutes % 30 !== 0) {
        console.warn(BOOKING_TIMING_LOG, 'line-time-invalid-interval', {
          lineIndex: idx,
          startTime,
          endTime,
          duration,
        });
        setError('Each booking line must use an hourly slot (for example 4:00 PM - 5:00 PM).');
        return;
      }
      const endAt = toLocalDateTime(bookingDate, endTime);
      if (endAt.getTime() < Date.now()) {
        console.warn(BOOKING_TIMING_LOG, 'line-time-passed', {
          lineIndex: idx,
          bookingDate,
          endTime,
        });
        setError('Cannot book a slot that has already passed.');
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
      const generatedEmail = `walkin-${normalizedPhone}-${Date.now()}@velay.local`;
      const created = await createIamUser(
        {
          fullName: walkInName.trim(),
          email: generatedEmail,
          phone: normalizePhoneForStorage(walkInPhone),
          password: makePassword(),
          roles: ['customer-end-user'],
        },
        isPlatformOwner ? bookingTenant : undefined,
      );
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
      const payload = {
        userId: resolvedCustomerId,
        sportType: sport,
        bookingDate,
        items: lines.map((ln) => ({
          courtKind: ln.courtKind,
          courtId: ln.courtId.trim(),
          startTime: minutesToTime(ln.startMinutes),
          endTime: minutesToTime(Math.min(ln.startMinutes + ln.durationMinutes, 24 * 60)),
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
          paymentStatus,
          paymentMethod,
          paidAmount: Number(paidAmount || 0),
        },
        bookingStatus: 'confirmed' as const,
        notes:
          [`source:${bookingSource}`, notes.trim()]
            .filter(Boolean)
            .join(' | ') || undefined,
      };
      const created = isPlatformOwner
        ? await createBookingForTenant(bookingTenant, payload)
        : await createBooking(payload);
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
      {!bookingTenant && (
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
                  value={ownerBookingTenantId}
                  onChange={(e) => setOwnerBookingTenantId(e.target.value)}
                  disabled={businesses.length === 0}
                >
                  <option value="">Select business…</option>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.tenantId}>
                      {b.businessName}
                      {b.tenantId ? ` · ${b.tenantId.slice(0, 8)}…` : ''}
                    </option>
                  ))}
                </select>
                <p className="muted" style={{ marginTop: '0.35rem', marginBottom: 0 }}>
                  Only this booking is scoped to the selected business.
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
                <label>Booking from</label>
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
                  { value: 'futsal', label: 'Turf' },
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
              const endTime = minutesToTime(Math.min(ln.startMinutes + 60, 24 * 60));
              const selectedCourt =
                courtOpts.find((o) => courtOptionValue(o) === ln.facilityKey) ?? null;
              const location = selectedCourt?.businessLocationId
                ? locations.find((l) => l.id === selectedCourt.businessLocationId) ?? null
                : null;
              const dayWindow = getWorkingDayWindow(
                (location?.workingHours as Record<string, unknown> | null) ?? null,
                bookingDate,
              );
              const src = lineSlotSource[idx];
              const serverStarts =
                src?.source === 'api'
                  ? [...src.starts].sort(
                      (a, b) => timeToMinutes(a) - timeToMinutes(b),
                    )
                  : [];
              /**
               * API slot-grid already applies facility template filtering.
               * Keep front-end filtering disabled so newly assigned templates
               * immediately surface slot buttons.
               */
              const startSlots = serverStarts;
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
                            value: courtOptionValue(o),
                            label: courtOnlyLabel(o.label),
                          })),
                        ]}
                        emptyText="No facilities available for current filters."
                      />
                      {location && (
                        <div className="muted" style={{ marginTop: '0.3rem' }}>
                          Working hours (info only):{' '}
                          {dayWindow.closed
                            ? 'Closed'
                            : `${formatTime12h(dayWindow.open)} - ${formatTime12h(dayWindow.close)}`}
                        </div>
                      )}
                    </div>
                    <div className="form-row-2">
                      <div>
                        <label>Select slots ({formatTime12h(startTime)} - {formatTime12h(endTime)})</label>
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
                                  const clickedMins = timeToMinutes(slot);
                                  const currentStart = ln.startMinutes;
                                  const currentEnd = currentStart + (ln.durationMinutes || 60);

                                  let newStart = clickedMins;
                                  let newDuration = 60;

                                  if (clickedMins === currentEnd) {
                                    newStart = currentStart;
                                    newDuration = (ln.durationMinutes || 60) + 60;
                                  } else if (clickedMins === currentStart - 60) {
                                    newStart = clickedMins;
                                    newDuration = (ln.durationMinutes || 60) + 60;
                                  }

                                  const selCourt = courtOpts.find((o) => courtOptionValue(o) === ln.facilityKey);
                                  const base = (selCourt?.pricePerSlot != null) 
                                     ? Number(selCourt.pricePerSlot) 
                                     : (selCourt?.pricing?.[sport.toLowerCase()]?.basePrice ?? 0);
                                  const priceStr = base > 0 ? String(base * (newDuration / 60)) : ln.price;

                                  next[idx] = { 
                                     ...ln, 
                                     startMinutes: newStart, 
                                     durationMinutes: newDuration,
                                     price: priceStr
                                  };
                                  setLines(next);
                                }}
                              >
                                {formatTime12h(slot)}
                              </button>
                            );
                          })}
                          {startSlots.length === 0 && (
                            <span className="muted" style={{ fontSize: '0.78rem' }}>
                              {selectedCourt?.timeSlotTemplateId
                                ? 'No template slots available for this day.'
                                : 'No time slot template assigned to this facility.'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <label>Slot duration</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ padding: '0.45rem 0.8rem', fontSize: '0.92rem' }}
                            disabled
                          >
                            {ln.durationMinutes} min
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

          <h3 style={{ margin: '0.9rem 0 0.2rem' }}>Payment</h3>
          <div className="form-row-2">
            <div>
              <label>Payment status</label>
              <ButtonOptionGroup
                value={paymentStatus}
                onChange={(next) => setPaymentStatus(next as PaymentStatus)}
                options={[
                  { value: 'pending', label: 'Pending' },
                  { value: 'partially_paid', label: 'Advance' },
                  { value: 'paid', label: 'Paid' },
                ]}
              />
            </div>
            <div>
              <label>Payment method</label>
              <ButtonOptionGroup
                value={paymentMethod}
                onChange={(next) => setPaymentMethod(next as PaymentMethod)}
                options={[
                  { value: 'cash', label: 'Cash' },
                  { value: 'card', label: 'Card' },
                  { value: 'jazzcash', label: 'JazzCash' },
                  { value: 'easypaisa', label: 'EasyPaisa' },
                ]}
              />
            </div>
          </div>
          <div>
            <label>Amount Paid (PKR)</label>
            <input
              type="number"
              min={0}
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              placeholder="0"
            />
            <div
              className="item-editor"
              style={{ marginTop: '0.5rem', padding: '0.65rem 0.75rem' }}
            >
              <div className="detail-row" style={{ margin: 0 }}>
                <span>Order total</span>
                <span>{paymentPreview.total.toLocaleString()} PKR</span>
              </div>
              <div className="detail-row" style={{ margin: 0 }}>
                <span>Amount paid</span>
                <span className="text-success">{paymentPreview.paid.toLocaleString()} PKR</span>
              </div>
              <div className="detail-row" style={{ margin: 0 }}>
                <span>Remaining</span>
                <span
                  className={paymentPreview.remaining > 0 ? 'text-danger' : 'text-success'}
                >
                  {paymentPreview.remaining.toLocaleString()} PKR
                </span>
              </div>
              {paymentPreview.total > 0 && (
                <div className="detail-row" style={{ margin: 0 }}>
                  <span>Collected</span>
                  <span className="muted">{paymentPreview.pct}% of total</span>
                </div>
              )}
              {paymentPreview.paid > paymentPreview.total && paymentPreview.total > 0 && (
                <p className="muted" style={{ margin: '0.45rem 0 0', fontSize: '0.82rem' }}>
                  Overpayment: {(paymentPreview.paid - paymentPreview.total).toLocaleString()} PKR
                </p>
              )}
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
            disabled={submitting || !bookingTenant}
          >
            {submitting ? 'Creating…' : 'Create booking'}
          </button>
        </div>
      </section>
    </div>
  );
}

