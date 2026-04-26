import type { BookingItemRow, BookingRecord, CourtKind } from '../types/booking';
import { formatTimeRange12h } from './timeDisplay';

export type FacilityLiveType =
  | 'futsalCourt'
  | 'cricketCourt'
  | 'padel'
  /** One pitch stored on `futsal_courts` with `supportsCricket` — same calendar for both sports. */
  | 'sharedTurfCourt';

export function facilityTypeToCourtKind(t: FacilityLiveType): CourtKind {
  if (t === 'futsalCourt' || t === 'cricketCourt' || t === 'sharedTurfCourt') {
    return 'turf_court';
  }
  return 'padel_court';
}

export type FacilityCardVisualState = 'inactive' | 'live' | 'soon' | 'idle';

export interface FacilityLiveSnapshot {
  visualState: FacilityCardVisualState;
  /** Currently in progress on this court */
  ongoing: { booking: BookingRecord; item: BookingItemRow; label: string } | null;
  /** Next future slot on this court */
  next: { booking: BookingRecord; item: BookingItemRow; label: string } | null;
  /** Sum of booked hours for items on this court today (local calendar day) */
  hoursBookedToday: number;
  /** Sum over the last 7 local calendar days including today */
  hoursBookedWeek: number;
}

interface ItemWindow {
  booking: BookingRecord;
  item: BookingItemRow;
  start: Date;
  end: Date;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatLocalDateOnly(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseLocalDateTime(dateStr: string, timeStr: string): Date {
  const t = (timeStr ?? '').trim();
  if (t.includes('T')) {
    const parsed = Date.parse(t);
    if (!Number.isNaN(parsed)) return new Date(parsed);
  }
  const [y, mo, d] = dateStr.split('-').map((x) => parseInt(x, 10));
  const [h, m, rest] = t.split(':');
  const hNum = parseInt(h ?? '0', 10);
  const mNum = parseInt(m ?? '0', 10);
  const secPart = (rest ?? '').split('.')[0];
  const sNum = parseInt(secPart || '0', 10) || 0;
  return new Date(y, mo - 1, d, hNum, mNum, Number.isFinite(sNum) ? sNum : 0);
}

function itemWindow(bookingDate: string, startTime: string, endTime: string): {
  start: Date;
  end: Date;
} {
  const start = parseLocalDateTime(bookingDate, startTime);
  let end = parseLocalDateTime(bookingDate, endTime);
  if (end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return { start, end };
}

function hoursBetween(a: Date, b: Date): number {
  return Math.max(0, (b.getTime() - a.getTime()) / (1000 * 60 * 60));
}

function collectWindows(
  bookings: BookingRecord[],
  courtKinds: CourtKind[],
  courtIds: string[],
): ItemWindow[] {
  const out: ItemWindow[] = [];
  const kindSet = new Set(courtKinds);
  const idSet = new Set(courtIds);

  for (const b of bookings) {
    if (b.bookingStatus === 'cancelled') continue;
    for (const item of b.items) {
      if (!kindSet.has(item.courtKind) || !idSet.has(item.courtId)) continue;
      if (item.status === 'cancelled') continue;
      const { start, end } = itemWindow(b.bookingDate, item.startTime, item.endTime);
      out.push({ booking: b, item, start, end });
    }
  }
  return out;
}

function nextLabel(booking: BookingRecord, item: BookingItemRow, todayStr: string): string {
  const range = formatTimeRange12h(item.startTime, item.endTime);
  const day =
    booking.bookingDate === todayStr ? 'Today' : (booking.bookingDate ?? '');
  return `${day} · ${range}`;
}

/** Human-readable day for the next-slot panel (e.g. Today, Tue, 28 Apr). */
export function formatNextDayLabel(bookingDate: string, todayStr: string): string {
  if (bookingDate === todayStr) return 'Today';
  const parts = bookingDate.split('-').map((x) => parseInt(x, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return bookingDate;
  const [y, mo, d] = parts;
  const dt = new Date(y, mo - 1, d);
  if (Number.isNaN(dt.getTime())) return bookingDate;
  return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export interface NextSlotWhenDisplay {
  dayLabel: string;
  timeRange: string;
  isToday: boolean;
}

export function nextSlotWhenDisplay(
  booking: BookingRecord,
  item: BookingItemRow,
  todayStr: string,
): NextSlotWhenDisplay {
  return {
    dayLabel: formatNextDayLabel(booking.bookingDate, todayStr),
    timeRange: formatTimeRange12h(item.startTime, item.endTime),
    isToday: booking.bookingDate === todayStr,
  };
}

/** Short line for front desk: payment + optional flow status. */
export function nextBookingMetaLine(booking: BookingRecord): { payment: string | null; flow: string | null } {
  const ps = booking.payment?.paymentStatus;
  let payment: string | null = null;
  if (ps === 'paid') payment = 'Paid';
  else if (ps === 'partially_paid') payment = 'Partially paid';
  else if (ps === 'pending') payment = 'Unpaid';
  else if (ps === 'failed') payment = 'Payment failed';
  else if (ps === 'refunded') payment = 'Refunded';

  let flow: string | null = null;
  if (booking.bookingStatus === 'pending') flow = 'Awaiting confirmation';
  else if (booking.bookingStatus === 'no_show') flow = 'No-show';

  return { payment, flow };
}

/** Name / phone for display on live cards; favours `user` on the booking. */
export function contactFromBooking(
  b: BookingRecord | null | undefined,
): { name: string; phone: string } {
  if (!b) return { name: '', phone: '' };
  const name = (b.user?.fullName ?? '').trim();
  const phone = (b.user?.phone ?? '').trim();
  return { name, phone };
}

/** Title-style name for card display. */
export function formatBookingDisplayName(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Group digits for readability (e.g. PK local). */
export function formatPhoneForDisplay(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (!d) return raw.trim();
  if (d.length === 10) {
    return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  }
  if (d.length === 11 && d.startsWith('0')) {
    return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  }
  if (d.length === 12 && d.startsWith('92')) {
    return `+92 ${d.slice(2, 5)} ${d.slice(5, 9)} ${d.slice(9)}`;
  }
  if (d.length === 13 && d.startsWith('92')) {
    return `+92 ${d.slice(2, 5)} ${d.slice(5, 9)} ${d.slice(9)}`;
  }
  return raw.trim();
}

/**
 * Live snapshot for one court/facility card.
 */
export function computeFacilityLiveSnapshot(
  bookings: BookingRecord[],
  courtKind: CourtKind,
  courtId: string,
  opts: {
    now?: Date;
    facilityActive: boolean;
    facilityStatus?: string;
    /** Same pitch may appear as both `futsal_court` and `cricket_court` items (dual-sport turf). */
    linkedCourtKinds?: CourtKind[];
    /** For dual-sport turfs that have TWO separate entity IDs for the same physical space. */
    linkedCourtIds?: string[];
  },
): FacilityLiveSnapshot {
  const now = opts.now ?? new Date();
  const todayStr = formatLocalDateOnly(now);
  const status = (opts.facilityStatus ?? '').toLowerCase();
  const inactive =
    !opts.facilityActive ||
    status === 'maintenance' ||
    status === 'inactive';

  if (inactive) {
    return {
      visualState: 'inactive',
      ongoing: null,
      next: null,
      hoursBookedToday: 0,
      hoursBookedWeek: 0,
    };
  }

  const kinds: CourtKind[] = [
    courtKind,
    ...(opts.linkedCourtKinds?.filter((k) => k !== courtKind) ?? []),
  ];
  if (courtKind === 'turf_court') {
    if (!kinds.includes('futsal_court')) kinds.push('futsal_court' as any);
    if (!kinds.includes('cricket_court')) kinds.push('cricket_court' as any);
  }

  const ids: string[] = [courtId, ...(opts.linkedCourtIds ?? [])];

  const windows = collectWindows(bookings, kinds, ids).sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );

  let hoursBookedToday = 0;
  const weekStarts: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    weekStarts.push(formatLocalDateOnly(d));
  }
  const weekSet = new Set(weekStarts);
  let hoursBookedWeek = 0;

  for (const w of windows) {
    const h = hoursBetween(w.start, w.end);
    if (w.booking.bookingDate === todayStr) {
      hoursBookedToday += h;
    }
    if (weekSet.has(w.booking.bookingDate)) {
      hoursBookedWeek += h;
    }
  }

  const ongoingWin = windows.find((w) => w.start <= now && now < w.end) ?? null;
  const ongoing = ongoingWin
    ? {
        booking: ongoingWin.booking,
        item: ongoingWin.item,
        label: formatTimeRange12h(ongoingWin.item.startTime, ongoingWin.item.endTime),
      }
    : null;

  const future = windows
    .filter((w) => w.start > now)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const nextWin = future[0] ?? null;
  const next = nextWin
    ? {
        booking: nextWin.booking,
        item: nextWin.item,
        label: nextLabel(nextWin.booking, nextWin.item, todayStr),
      }
    : null;

  let visualState: FacilityCardVisualState = 'idle';
  if (ongoing) {
    visualState = 'live';
  } else if (nextWin) {
    const msUntil = nextWin.start.getTime() - now.getTime();
    if (msUntil >= 0 && msUntil <= 60 * 60 * 1000) {
      visualState = 'soon';
    }
  }

  return {
    visualState,
    ongoing,
    next,
    hoursBookedToday: Math.round(hoursBookedToday * 10) / 10,
    hoursBookedWeek: Math.round(hoursBookedWeek * 10) / 10,
  };
}
