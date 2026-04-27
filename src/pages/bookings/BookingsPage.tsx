import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  getBookingAvailability,
  getCourtBookedSlots,
  getCourtSlotGrid,
  listAllBookings,
  listBookings,
  listBusinessLocations,
  listCourtOptions,
  listIamUsers,
  updateBooking,
  deleteBooking,
} from '../../api/saasClient';
import { useSession } from '../../context/SessionContext';
import type { DashboardOutletContext } from '../../layout/ConsoleLayout';
import type {
  BookingRecord,
  BookingSportType,
  BookingStatus,
  CourtKind,
  PaymentMethod,
  PaymentStatus,
  UpdateBookingPayload,
} from '../../types/booking';
import type { IamUserRow } from '../../types/domain';
import { formatTime12h, formatTimeRange12h } from '../../utils/timeDisplay';
import TablePagination from '../../components/TablePagination';

type UserSummary = {
  name: string;
  phone: string;
};

function badgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'pending') return 'badge badge-pending';
  if (s === 'confirmed') return 'badge badge-confirmed';
  if (s === 'cancelled' || s === 'failed') return 'badge badge-cancelled';
  if (s === 'paid') return 'badge badge-paid';
  if (s === 'partially_paid') return 'badge badge-partially-paid';
  if (s === 'completed') return 'badge badge-completed';
  if (s === 'no_show') return 'badge badge-neutral';
  return 'badge badge-neutral';
}

function titleCaseWords(v: string): string {
  return v
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function sportBadgeClass(sport: string | null | undefined): string {
  const normalized = (sport ?? '').toLowerCase();
  if (normalized === 'futsal') return 'badge sport-badge sport-badge--futsal';
  if (normalized === 'cricket') return 'badge sport-badge sport-badge--cricket';
  if (normalized === 'padel') return 'badge sport-badge sport-badge--padel';
  return 'badge badge-neutral';
}

function toMinutes(time: string, isEnd = false): number {
  const [hRaw, mRaw] = time.split(':');
  const h = Number(hRaw || 0);
  const m = Number(mRaw || 0);
  const total = h * 60 + m;
  if (total === 0 && isEnd) return 24 * 60;
  return total;
}

function minutesToTimeString(totalMins: number): string {
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function normalizeToHour(value: string, mode: 'start' | 'end'): string {
  if (!value) return '';
  const [hRaw] = value.split(':');
  const h = Number(hRaw || 0);
  if (!Number.isFinite(h) || h < 0) return '';
  const bounded = Math.min(23, Math.max(0, h));
  if (mode === 'end' && bounded === 0) return '24:00';
  return `${String(bounded).padStart(2, '0')}:00`;
}

function toHourlyRange(start: string, end: string): { start: string; end: string } {
  const startM = toMinutes(normalizeToHour(start, 'start'));
  const rawEnd = normalizeToHour(end, 'end');
  const endM = Math.max(startM + 60, toMinutes(rawEnd || '00:00', true));
  return {
    start: minutesToTimeString(startM),
    end: minutesToTimeString(Math.min(endM, 24 * 60)),
  };
}

function hourlyStartsInRange(startTime: string, endTime: string): string[] {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime, true);
  if (end <= start) return [];
  const out: string[] = [];
  for (let m = start; m < end; m += 60) {
    out.push(minutesToTimeString(m));
  }
  return out;
}

export default function BookingsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const businessIdFilter = searchParams.get('businessId')?.trim() ?? '';
  const { tenantId, session } = useSession();
  const isPlatformOwner = session?.roles?.includes('platform-owner') ?? false;
  const { selectedLocationId } = useOutletContext<DashboardOutletContext>();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [usersMap, setUsersMap] = useState<Record<string, UserSummary>>({});
  const [courtsMap, setCourtsMap] = useState<Record<string, string>>({});
  const [locationsMap, setLocationsMap] = useState<
    Record<string, { name: string; phone: string; businessId: string }>
  >({});
  const [availabilitySport, setAvailabilitySport] =
    useState<BookingSportType | ''>('');
  const [availabilityDate, setAvailabilityDate] = useState('');
  const [availabilityStartTime, setAvailabilityStartTime] = useState('');
  const [availabilityEndTime, setAvailabilityEndTime] = useState('');
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityModalOpen, setAvailabilityModalOpen] = useState(false);
  const [availability, setAvailability] = useState<
    Awaited<ReturnType<typeof getBookingAvailability>> | null
  >(null);
  const [courtSlotsLoading, setCourtSlotsLoading] = useState(false);
  const [courtSlots, setCourtSlots] = useState<
    Awaited<ReturnType<typeof getCourtBookedSlots>> | null
  >(null);
  const [dayFilter, setDayFilter] = useState<'all' | 'today' | 'tomorrow'>('all');
  const [gameFilter, setGameFilter] = useState<
    'all' | 'upcoming' | 'completed' | 'canceled'
  >('all');
  const [bookingStatusFilter] = useState<'all' | BookingStatus>('all');
  const [paymentStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [amountPaidInput, setAmountPaidInput] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const selected = useMemo(
    () => bookings.find((b) => b.bookingId === selectedId) ?? null,
    [bookings, selectedId],
  );

  useEffect(() => {
    if (!selected) {
      setAmountPaidInput('');
      return;
    }
    setAmountPaidInput(String(selected.payment.paidAmount));
  }, [selectedId, selected?.payment.paidAmount]);

  const detailPayment = useMemo(() => {
    if (!selected) return null;
    const total = selected.pricing.totalAmount;
    const raw = amountPaidInput.trim();
    const parsed = raw === '' ? Number.NaN : Number(raw);
    const paid = Number.isFinite(parsed)
      ? Math.max(0, parsed)
      : selected.payment.paidAmount;
    const remaining = Math.max(0, total - paid);
    return { total, paid, remaining };
  }, [selected, amountPaidInput]);

  const filteredBookings = useMemo(() => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const today = todayDate.toISOString().slice(0, 10);
    const tomorrowDate = new Date(todayDate);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = tomorrowDate.toISOString().slice(0, 10);

    return bookings.filter((b) => {
      if (selectedLocationId !== 'all' && b.arenaId !== selectedLocationId) return false;
      if (businessIdFilter && locationsMap[b.arenaId]?.businessId !== businessIdFilter) {
        return false;
      }
      if (dayFilter === 'today' && b.bookingDate !== today) return false;
      if (dayFilter === 'tomorrow' && b.bookingDate !== tomorrow) return false;
      if (gameFilter === 'completed' && b.bookingStatus !== 'completed') return false;
      if (gameFilter === 'canceled' && b.bookingStatus !== 'cancelled') return false;
      if (bookingStatusFilter !== 'all' && b.bookingStatus !== bookingStatusFilter)
        return false;
      if (
        paymentStatusFilter !== 'all' &&
        b.payment.paymentStatus !== paymentStatusFilter
      )
        return false;
      if (gameFilter === 'upcoming') {
        const isUpcomingDate = b.bookingDate >= today;
        const isOpenStatus = b.bookingStatus === 'pending' || b.bookingStatus === 'confirmed';
        if (!isUpcomingDate || !isOpenStatus) return false;
      }
      return true;
    });
  }, [
    bookings,
    dayFilter,
    gameFilter,
    businessIdFilter,
    locationsMap,
    selectedLocationId,
    bookingStatusFilter,
    paymentStatusFilter,
  ]);
  const sortedBookings = useMemo(() => {
    const sortableItems = [...filteredBookings];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any;
        let bValue: any;
        switch (sortConfig.key) {
          case 'date':
            aValue = a.bookingDate + ' ' + (a.items[0]?.startTime ?? '');
            bValue = b.bookingDate + ' ' + (b.items[0]?.startTime ?? '');
            break;
          case 'sport':
            aValue = a.sportType ?? '';
            bValue = b.sportType ?? '';
            break;
          case 'status':
            aValue = a.bookingStatus;
            bValue = b.bookingStatus;
            break;
          case 'payment':
            aValue = a.payment.paymentStatus;
            bValue = b.payment.paymentStatus;
            break;
          case 'total':
            aValue = a.pricing.totalAmount;
            bValue = b.pricing.totalAmount;
            break;
          case 'userName':
            aValue = usersMap[a.userId]?.name ?? '';
            bValue = usersMap[b.userId]?.name ?? '';
            break;
          case 'userPhone':
            aValue = usersMap[a.userId]?.phone ?? '';
            bValue = usersMap[b.userId]?.phone ?? '';
            break;
          case 'locationName':
            aValue = a.arenaName ?? locationsMap[a.arenaId]?.name ?? '';
            bValue = b.arenaName ?? locationsMap[b.arenaId]?.name ?? '';
            break;

          default:
            aValue = '';
            bValue = '';
        }
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredBookings, sortConfig, usersMap, locationsMap]);

  const pagedBookings = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedBookings.slice(start, start + pageSize);
  }, [page, pageSize, sortedBookings]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(sortedBookings.length / pageSize));
    if (page > totalPages) setPage(totalPages);
  }, [page, pageSize, sortedBookings.length]);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return (
      <span className="data-sort-btn__arrow">
        {sortConfig.direction === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  const bookingStats = useMemo(() => {
    const total = filteredBookings.length;
    const pending = filteredBookings.filter((b) => b.bookingStatus === 'pending').length;
    const confirmed = filteredBookings.filter((b) => b.bookingStatus === 'confirmed').length;
    const cancelled = filteredBookings.filter((b) => b.bookingStatus === 'cancelled').length;
    const paid = filteredBookings.filter((b) => b.payment.paymentStatus === 'paid').length;
    const revenue = filteredBookings.reduce((sum, b) => sum + (b.pricing.totalAmount || 0), 0);
    return { total, pending, confirmed, cancelled, paid, revenue };
  }, [filteredBookings]);

  const sportStats = useMemo(() => {
    const stats = { futsal: 0, cricket: 0, padel: 0 };
    for (const b of filteredBookings) {
      const sport = (b.sportType ?? '').toLowerCase();
      if (sport === 'futsal') stats.futsal += 1;
      else if (sport === 'cricket') stats.cricket += 1;
      else if (sport === 'padel') stats.padel += 1;
    }
    return stats;
  }, [filteredBookings]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isPlatformOwner) {
        const merged = await listAllBookings();
        merged.sort(
          (a, b) =>
            (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0),
        );
        setBookings(merged);
        setSelectedId((cur) =>
          cur && !merged.some((b) => b.bookingId === cur) ? null : cur,
        );
      } else {
        if (!tenantId.trim()) {
          setBookings([]);
          setSelectedId(null);
          return;
        }
        const data = await listBookings();
        setBookings(data);
        setSelectedId((cur) =>
          cur && !data.some((b) => b.bookingId === cur) ? null : cur,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load bookings');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId, isPlatformOwner]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 15000);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    void (async () => {
      try {
        const users: IamUserRow[] = await listIamUsers(undefined, undefined, isPlatformOwner);
        const map: Record<string, UserSummary> = {};
        for (const u of users) {
          map[u.id] = {
            name: u.fullName || u.email || u.id,
            phone: u.phone?.trim() || '-',
          };
        }
        setUsersMap(map);
      } catch {
        setUsersMap({});
      }
    })();
    void (async () => {
      try {
        const rows = await listCourtOptions(
          undefined,
          selectedLocationId === 'all' ? undefined : selectedLocationId,
        );
        const map: Record<string, string> = {};
        for (const row of rows) {
          map[row.id] = (row.label ?? '').split('—').slice(1).join('—').trim() || row.label || row.id;
        }
        setCourtsMap(map);
      } catch {
        setCourtsMap({});
      }
    })();
    void (async () => {
      try {
        const rows = await listBusinessLocations({ ignoreActiveTenant: isPlatformOwner });
        const map: Record<string, { name: string; phone: string; businessId: string }> = {};
        for (const row of rows) {
          map[row.id] = {
            name: row.name,
            phone: row.phone?.trim() || '-',
            businessId: row.businessId,
          };
        }
        setLocationsMap(map);
      } catch {
        setLocationsMap({});
      }
    })();
  }, [selectedLocationId]);

  async function patchBooking(patch: UpdateBookingPayload) {
    if (!selectedId) return;
    setError(null);
    try {
      const updated = await updateBooking(selectedId, patch as any);
      setBookings((prev) =>
        prev.map((b) => (b.bookingId === updated.bookingId ? updated : b)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  }

  async function removeBooking() {
    if (!selectedId) return;
    if (!window.confirm('Are you sure you want to delete this booking? This will also unblock the time slots.')) {
      return;
    }
    setError(null);
    try {
      await deleteBooking(selectedId);
      setBookings((prev) => prev.filter((b) => b.bookingId !== selectedId));
      setSelectedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  async function patchBookingStatus(bookingId: string, nextStatus: BookingStatus) {
    setError(null);
    try {
      const updated = await updateBooking(bookingId, {
        bookingStatus: nextStatus,
      });
      setBookings((prev) =>
        prev.map((b) => (b.bookingId === updated.bookingId ? updated : b)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  }

  async function patchPaymentStatus(bookingId: string, nextStatus: PaymentStatus) {
    setError(null);
    try {
      const updated = await updateBooking(bookingId, {
        payment: { paymentStatus: nextStatus },
      } as any);
      setBookings((prev) =>
        prev.map((b) => (b.bookingId === updated.bookingId ? updated : b)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  }

  async function patchPaymentMethod(bookingId: string, nextMethod: PaymentMethod) {
    setError(null);
    try {
      const updated = await updateBooking(bookingId, {
        payment: { paymentMethod: nextMethod },
      } as any);
      setBookings((prev) =>
        prev.map((b) => (b.bookingId === updated.bookingId ? updated : b)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  }

  async function patchPaidAmount(bookingId: string, nextPaidAmount: number) {
    setError(null);
    try {
      const updated = await updateBooking(bookingId, {
        payment: { paidAmount: nextPaidAmount },
      } as any);
      setBookings((prev) =>
        prev.map((b) => (b.bookingId === updated.bookingId ? updated : b)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  }

  async function checkAvailability() {
    if (!availabilitySport || !availabilityDate || !availabilityStartTime || !availabilityEndTime) {
      setError('Select sport, date, start time, and end time to check availability.');
      return;
    }
    const hourly = toHourlyRange(availabilityStartTime, availabilityEndTime);
    const requestedStarts = hourlyStartsInRange(hourly.start, hourly.end);
    if (requestedStarts.length === 0) {
      setError('End time must be after start time.');
      return;
    }
    setError(null);
    setAvailabilityLoading(true);
    setCourtSlots(null);
    try {
      const result = await getBookingAvailability({
        date: availabilityDate,
        startTime: hourly.start,
        endTime: hourly.end,
        sportType: availabilitySport,
      });
      const slotChecks = await Promise.all(
        result.availableCourts.map(async (court) => {
          try {
            const grid = await getCourtSlotGrid({
              courtKind: court.kind,
              courtId: court.id,
              date: availabilityDate,
              availableOnly: false, // get all states so we can detect booked/blocked
              useWorkingHours: false,
              startTime: hourly.start,
              endTime: hourly.end,
            });
            // Only reject if the slot is explicitly booked or blocked.
            // If the grid is empty (e.g. no facility slots generated), trust the availability API.
            if (grid.segments.length === 0) return true;
            const bookedOrBlocked = new Set(
              grid.segments
                .filter((s) => s.state === 'booked' || s.state === 'blocked')
                .map((s) => s.startTime),
            );
            return requestedStarts.every((t) => !bookedOrBlocked.has(t));
          } catch {
            // On error, trust the availability API
            return true;
          }
        }),
      );
      const availableCourts = result.availableCourts.filter((_, idx) => slotChecks[idx]);
      setAvailability({ ...result, availableCourts });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to check availability');
      setAvailability(null);
    } finally {
      setAvailabilityLoading(false);
    }
  }

  async function viewCourtSlots(courtKind: CourtKind, courtId: string, date = availabilityDate) {
    setError(null);
    setCourtSlotsLoading(true);
    try {
      const result = await getCourtBookedSlots({
        courtKind,
        courtId,
        date,
      });
      setCourtSlots(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load court slots');
      setCourtSlots(null);
    } finally {
      setCourtSlotsLoading(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">Bookings</h1>
      {isPlatformOwner && (
        <p className="muted" style={{ marginTop: '-0.35rem', marginBottom: '0.65rem' }}>
          Showing merged bookings for <strong>all businesses</strong>. Use the top bar location
          filter to narrow to one site.
        </p>
      )}
      {selectedLocationId !== 'all' && (
        <p className="muted" style={{ marginTop: '-0.25rem', marginBottom: '0.75rem' }}>
          Top bar location filter is active. Showing bookings for the selected location only.
        </p>
      )}
      {businessIdFilter && (
        <p className="muted" style={{ marginTop: '-0.25rem', marginBottom: '0.75rem' }}>
          Business filter is active. Showing bookings for the selected business only.
        </p>
      )}
      {!tenantId.trim() && !isPlatformOwner && (
        <div className="err-banner">No active tenant found. Please ensure you are logged in correctly.</div>
      )}
      <div className="toolbar">
        <span className="muted">
          {loading ? 'Loading…' : `${sortedBookings.length} booking(s)`}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="btn-ghost" onClick={() => void refresh()} disabled={loading}>
            Refresh
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setAvailabilityModalOpen(true)}
          >
            Check availability
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate('/app/bookings/new')}
            disabled={!isPlatformOwner && !tenantId.trim()}
          >
            Add booking
          </button>
        </div>
      </div>
      {error && <div className="err-banner">{error}</div>}
      <section className="detail-card" style={{ marginBottom: '0.75rem' }}>
        <h3 style={{ marginBottom: '0.6rem' }}>Quick filters</h3>
        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={dayFilter === 'today' ? 'btn-primary' : 'btn-ghost'}
            onClick={() => setDayFilter((cur) => (cur === 'today' ? 'all' : 'today'))}
          >
            Today
          </button>
          <button
            type="button"
            className={dayFilter === 'tomorrow' ? 'btn-primary' : 'btn-ghost'}
            onClick={() => setDayFilter((cur) => (cur === 'tomorrow' ? 'all' : 'tomorrow'))}
          >
            Tomorrow
          </button>
          <button
            type="button"
            className={gameFilter === 'upcoming' ? 'btn-primary' : 'btn-ghost'}
            onClick={() =>
              setGameFilter((cur) => (cur === 'upcoming' ? 'all' : 'upcoming'))
            }
          >
            Upcoming
          </button>
          <button
            type="button"
            className={gameFilter === 'completed' ? 'btn-primary' : 'btn-ghost'}
            onClick={() =>
              setGameFilter((cur) => (cur === 'completed' ? 'all' : 'completed'))
            }
          >
            Completed
          </button>
          <button
            type="button"
            className={gameFilter === 'canceled' ? 'btn-primary' : 'btn-ghost'}
            onClick={() =>
              setGameFilter((cur) => (cur === 'canceled' ? 'all' : 'canceled'))
            }
          >
            Canceled
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setDayFilter('all');
              setGameFilter('all');
            }}
          >
            Reset
          </button>
        </div>
      </section>
      {!isPlatformOwner ? (
      <section className="detail-card" style={{ marginBottom: '0.75rem' }}>
        <h3 style={{ marginBottom: '0.6rem' }}>Booking stats</h3>
        <div className="overview-totals-grid bookings-stats-row">
          <article className="overview-metric-card">
            <span className="overview-metric-label">Total bookings</span>
            <strong className="overview-metric-value">{bookingStats.total}</strong>
          </article>
          <article className="overview-metric-card">
            <span className="overview-metric-label">Confirmed</span>
            <strong className="overview-metric-value">{bookingStats.confirmed}</strong>
          </article>
          <article className="overview-metric-card">
            <span className="overview-metric-label">Pending</span>
            <strong className="overview-metric-value">{bookingStats.pending}</strong>
          </article>
          <article className="overview-metric-card">
            <span className="overview-metric-label">Cancelled</span>
            <strong className="overview-metric-value">{bookingStats.cancelled}</strong>
          </article>
          <article className="overview-metric-card">
            <span className="overview-metric-label">Paid bookings</span>
            <strong className="overview-metric-value">{bookingStats.paid}</strong>
          </article>
          <article className="overview-metric-card">
            <span className="overview-metric-label">Total revenue</span>
            <strong className="overview-metric-value">
              {bookingStats.revenue.toLocaleString()} PKR
            </strong>
          </article>
          <article className="overview-metric-card sport-stat-card sport-stat-card--futsal">
            <span className="overview-metric-label">Futsal bookings</span>
            <strong className="overview-metric-value">{sportStats.futsal}</strong>
          </article>
          <article className="overview-metric-card sport-stat-card sport-stat-card--cricket">
            <span className="overview-metric-label">Cricket bookings</span>
            <strong className="overview-metric-value">{sportStats.cricket}</strong>
          </article>
          <article className="overview-metric-card sport-stat-card sport-stat-card--padel">
            <span className="overview-metric-label">Padel bookings</span>
            <strong className="overview-metric-value">{sportStats.padel}</strong>
          </article>
        </div>
      </section>
      ) : null}
      {availabilityModalOpen ? (
        <div
          className="modal-backdrop"
          onClick={() => setAvailabilityModalOpen(false)}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Court availability explorer"
            onClick={(e) => e.stopPropagation()}
          >
          <h3 style={{ marginBottom: '0.8rem' }}>Court availability explorer</h3>
          <div className="form-grid">
            <div className="form-row-2">
              <div>
                <label>Sport</label>
                <select
                  value={availabilitySport}
                  onChange={(e) =>
                    setAvailabilitySport(e.target.value as BookingSportType | '')
                  }
                >
                  <option value="">Select sport</option>
                  <option value="futsal">futsal</option>
                  <option value="cricket">cricket</option>
                  <option value="padel">padel</option>
                </select>
              </div>
              <div>
                <label>Date</label>
                <input
                  type="date"
                  value={availabilityDate}
                  onChange={(e) => setAvailabilityDate(e.target.value)}
                />
              </div>
            </div>
            <div className="form-row-2">
              <div>
                <label>
                  Start time{' '}
                  <span className="muted" style={{ fontWeight: 'normal', fontSize: '0.85rem' }}>
                    ({formatTime12h(availabilityStartTime)})
                  </span>
                </label>
                <input
                  type="time"
                  step={3600}
                  value={availabilityStartTime}
                  onChange={(e) => setAvailabilityStartTime(normalizeToHour(e.target.value, 'start'))}
                />
              </div>
              <div>
                <label>
                  End time{' '}
                  <span className="muted" style={{ fontWeight: 'normal', fontSize: '0.85rem' }}>
                    ({formatTime12h(availabilityEndTime)})
                  </span>
                </label>
                <input
                  type="time"
                  step={3600}
                  value={availabilityEndTime}
                  onChange={(e) => setAvailabilityEndTime(normalizeToHour(e.target.value, 'end'))}
                />
              </div>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: '0.82rem' }}>
              Hourly slots only. Pickers use 24-hour values for API and labels show 12-hour time.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void checkAvailability()}
                disabled={availabilityLoading}
              >
                {availabilityLoading ? 'Checking…' : 'Check availability'}
              </button>
              {availability && (
                <span className="muted">
                  {availability.availableCourts.length} available court(s)
                </span>
              )}
            </div>
            {availability && (
              <div className="detail-section">
                <h4>Available fields / turf</h4>
                {availability.availableCourts.length === 0 ? (
                  <div className="empty-state">No courts available for this slot.</div>
                ) : (
                  <ul className="items-list">
                    {availability.availableCourts.map((court) => (
                      <li key={`${court.kind}:${court.id}`}>
                        <div>
                          <strong>{court.name}</strong>
                        </div>
                        <div className="muted">{court.kind}</div>
                        {court.pricePerSlot != null ? (
                          <div className="muted">
                            {(court.slotDurationMinutes && court.slotDurationMinutes > 0
                              ? (court.pricePerSlot * (60 / court.slotDurationMinutes))
                              : court.pricePerSlot
                            ).toFixed(2)} per hour
                          </div>
                        ) : null}
                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem' }}>
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() => void viewCourtSlots(court.kind, court.id)}
                          >
                            View booked slots
                          </button>
                          <button
                            type="button"
                            className="btn-primary"
                            style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem' }}
                            onClick={() => {
                              const q = new URLSearchParams();
                              q.set('date', availabilityDate);
                              q.set('startTime', availabilityStartTime);
                              q.set('sport', availabilitySport);
                              q.set('courtId', court.id);
                              q.set('kind', court.kind);
                              if (court.pricePerSlot != null) {
                                q.set('price', String(court.pricePerSlot));
                              }
                              navigate(`/app/bookings/new?${q.toString()}`);
                            }}
                          >
                            Book now
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {courtSlots && (
              <div className="detail-section">
                <h4>
                  Booked slots ({courtSlots.kind}) {courtSlotsLoading ? '…' : ''}
                </h4>
                {courtSlots.slots.length === 0 ? (
                  <div className="empty-state">No booked slots on selected date.</div>
                ) : (
                  <ul className="items-list">
                    {courtSlots.slots
                      .filter((s): s is Extract<typeof s, { availability: 'booked' }> => s.availability === 'booked')
                      .map((slot) => (
                      <li key={slot.itemId}>
                        <div>
                          <strong>
                            {formatTimeRange12h(
                              normalizeToHour(slot.startTime, 'start'),
                              normalizeToHour(slot.endTime, 'end'),
                            )}
                          </strong>
                        </div>
                        <div className="muted">
                          {slot.status} · booking {slot.bookingId?.slice(0, 8) ?? '??'}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="modal-footer">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setAvailabilityModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
          </section>
        </div>
      ) : null}

      {detailModalOpen && selected && (
        <div
          className="modal-backdrop"
          onClick={() => setDetailModalOpen(false)}
        >
          <section
            className="modal booking-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Booking Detail"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '1rem' }}>Booking Detail</h3>
            <div className="booking-detail-layout">
              <div>
                <div className="detail-section">
                  <h4>Summary</h4>
                  <div className="detail-row">
                    <span>Booking</span>
                    <span style={{ wordBreak: 'break-word' }}>
                      #{selected.bookingId?.slice(0, 8) ?? '??'}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span>User</span>
                    <span style={{ wordBreak: 'break-word' }}>
                      {selected.user?.fullName || usersMap[selected.userId]?.name || `User ${selected.userId?.slice(0, 8) ?? '??'}`}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span>Phone</span>
                    <span style={{ wordBreak: 'break-word' }}>
                      {selected.user?.phone || usersMap[selected.userId]?.phone || '-'}
                    </span>
                  </div>
                  <div className="detail-row" style={{ marginTop: '0.4rem', borderTop: '1px solid var(--border)', paddingTop: '0.4rem' }}>
                    <span>Total Amount</span>
                    <strong>{detailPayment ? detailPayment.total.toLocaleString() : selected.pricing.totalAmount.toLocaleString()} PKR</strong>
                  </div>
                  {detailPayment && (
                    <>
                      <div className="detail-row">
                        <span>Paid Amount</span>
                        <span className="text-success">{detailPayment.paid.toLocaleString()} PKR</span>
                      </div>
                      <div className="detail-row">
                        <span>Remaining</span>
                        <span className={detailPayment.remaining > 0 ? 'text-danger' : 'text-success'}>
                          {detailPayment.remaining.toLocaleString()} PKR
                        </span>
                      </div>
                      {detailPayment.total > 0 && (
                        <div className="detail-row">
                          <span>Collected</span>
                          <span className="muted">
                            {Math.round((detailPayment.paid / detailPayment.total) * 100)}% of total
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="detail-section">
                  <h4>Items</h4>
                  <ul className="items-list">
                    {selected.items.map((it) => (
                      <li key={it.id}>
                        <div>
                          <strong>{courtsMap[it.courtId] ?? titleCaseWords(it.courtKind)}</strong>
                        </div>
                        <div className="muted">
                          {formatTimeRange12h(it.startTime, it.endTime)} · {it.price} PKR{' '}
                          <span className={badgeClass(it.status)}>{titleCaseWords(it.status)}</span>
                        </div>
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ marginTop: '0.35rem' }}
                          onClick={() => {
                            setAvailabilityDate(selected.bookingDate);
                            void viewCourtSlots(it.courtKind, it.courtId, selected.bookingDate);
                          }}
                        >
                          View court booked slots
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="detail-section">
                <h4>Actions</h4>
                <div className="form-grid">
                <div>
                  <label>Booking status</label>
                  <select
                    value={selected.bookingStatus}
                    onChange={(e) =>
                      void patchBookingStatus(
                        selected.bookingId,
                        e.target.value as BookingStatus,
                      )
                    }
                  >
                    {(
                      [
                        'pending',
                        'confirmed',
                        'cancelled',
                        'completed',
                        'no_show',
                      ] as const
                    ).map((s) => (
                      <option key={s} value={s}>
                        {titleCaseWords(s)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Payment status</label>
                  <select
                    value={selected.payment.paymentStatus}
                    onChange={(e) =>
                      void patchBooking({
                        payment: {
                          paymentStatus: e.target.value as PaymentStatus,
                        },
                      })
                    }
                  >
                    {(
                      ['pending', 'partially_paid', 'paid', 'failed', 'refunded'] as const
                    ).map((s) => (
                      <option key={s} value={s}>
                        {titleCaseWords(s)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Amount Paid (PKR)</label>
                  <input
                    type="number"
                    min={0}
                    value={amountPaidInput}
                    onChange={(e) => setAmountPaidInput(e.target.value)}
                    onBlur={() => {
                      if (!selected) return;
                      const v = Number(amountPaidInput);
                      const next = Number.isFinite(v) ? Math.max(0, v) : selected.payment.paidAmount;
                      setAmountPaidInput(String(next));
                      if (next !== selected.payment.paidAmount) {
                        void patchBooking({
                          payment: { paidAmount: next },
                        });
                      }
                    }}
                  />
                  {detailPayment && selected.pricing.totalAmount > 0 && (
                    <p className="muted" style={{ marginTop: '0.35rem', fontSize: '0.82rem' }}>
                      Total {detailPayment.total.toLocaleString()} PKR · Remaining{' '}
                      {detailPayment.remaining.toLocaleString()} PKR
                      {detailPayment.paid > detailPayment.total && (
                        <span> · Over by {(detailPayment.paid - detailPayment.total).toLocaleString()} PKR</span>
                      )}
                    </p>
                  )}
                </div>
                <div>
                  <label>Payment method</label>
                  <select
                    value={selected.payment.paymentMethod}
                    onChange={(e) =>
                      void patchBooking({
                        payment: {
                          paymentMethod: e.target.value as PaymentMethod,
                        },
                      })
                    }
                  >
                    {(['cash', 'card', 'jazzcash', 'easypaisa'] as const).map(
                      (s) => (
                        <option key={s} value={s}>
                          {titleCaseWords(s)}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div>
                  <label>Cancellation reason</label>
                  <input
                    placeholder="Optional"
                    defaultValue={selected.cancellationReason ?? ''}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (selected.cancellationReason ?? '')) {
                        void patchBooking({ cancellationReason: v || undefined });
                      }
                    }}
                  />
                </div>
                <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ color: 'var(--danger-soft)' }}
                    onClick={() => {
                        void removeBooking();
                        setDetailModalOpen(false);
                    }}
                  >
                    Delete booking
                  </button>
                </div>
              </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setDetailModalOpen(false)}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}

      <div className="main-area" style={{ padding: 0, marginTop: '0.5rem', display: 'block' }}>
        <div>
          <div className="table-wrap">
            {sortedBookings.length === 0 && !loading ? (
              <div className="empty-state">No bookings.</div>
            ) : (
              <>
                <table className="data">
                  <thead>
                    <tr>
                    <th className="data-th-sortable">
                      <button
                        type="button"
                        className={`data-sort-btn ${sortConfig?.key === 'date' ? 'data-sort-btn--active' : ''}`}
                        onClick={() => requestSort('date')}
                      >
                        Date {getSortIndicator('date')}
                      </button>
                    </th>
                    <th className="data-th-sortable">
                      <button
                        type="button"
                        className={`data-sort-btn ${sortConfig?.key === 'userName' ? 'data-sort-btn--active' : ''}`}
                        onClick={() => requestSort('userName')}
                      >
                        Person name {getSortIndicator('userName')}
                      </button>
                    </th>
                    <th className="data-th-sortable">
                      <button
                        type="button"
                        className={`data-sort-btn ${sortConfig?.key === 'userPhone' ? 'data-sort-btn--active' : ''}`}
                        onClick={() => requestSort('userPhone')}
                      >
                        Person phone {getSortIndicator('userPhone')}
                      </button>
                    </th>
                    <th className="data-th-sortable">
                      <button
                        type="button"
                        className={`data-sort-btn ${sortConfig?.key === 'locationName' ? 'data-sort-btn--active' : ''}`}
                        onClick={() => requestSort('locationName')}
                      >
                        Location {getSortIndicator('locationName')}
                      </button>
                    </th>

                    <th className="data-th-sortable">
                      <button
                        type="button"
                        className={`data-sort-btn ${sortConfig?.key === 'sport' ? 'data-sort-btn--active' : ''}`}
                        onClick={() => requestSort('sport')}
                      >
                        Sport {getSortIndicator('sport')}
                      </button>
                    </th>
                    <th className="data-th-sortable">
                      <button
                        type="button"
                        className={`data-sort-btn ${sortConfig?.key === 'status' ? 'data-sort-btn--active' : ''}`}
                        onClick={() => requestSort('status')}
                      >
                        Status {getSortIndicator('status')}
                      </button>
                    </th>
                    <th className="data-th-sortable">
                      <button
                        type="button"
                        className={`data-sort-btn ${sortConfig?.key === 'payment' ? 'data-sort-btn--active' : ''}`}
                        onClick={() => requestSort('payment')}
                      >
                        Payment Status {getSortIndicator('payment')}
                      </button>
                    </th>
                    <th>
                      <span className="data-th-static">Method</span>
                    </th>
                    <th className="data-th-sortable">
                      <button
                        type="button"
                        className={`data-sort-btn ${sortConfig?.key === 'total' ? 'data-sort-btn--active' : ''}`}
                        onClick={() => requestSort('total')}
                      >
                        Total {getSortIndicator('total')}
                      </button>
                    </th>
                    <th>
                      <span className="data-th-static">Amount Paid</span>
                    </th>
                    <th>
                      <span className="data-th-static">Actions</span>
                    </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedBookings.map((b) => {
                      const userName = b.user?.fullName || usersMap[b.userId]?.name || `User ${b.userId?.slice(0, 8) ?? '??'}`;
                      const userPhone = b.user?.phone || usersMap[b.userId]?.phone || '-';
                      return (
                    <tr
                      key={b.bookingId}
                      className={b.bookingId === selectedId ? 'active' : ''}
                      onClick={() => {
                        setSelectedId(b.bookingId);
                        setDetailModalOpen(true);
                      }}
                    >
                      <td>
                        <div style={{ fontWeight: 600 }}>{b.bookingDate}</div>
                        <div className="muted" style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>
                          {formatTimeRange12h(b.items[0]?.startTime, b.items[b.items.length - 1]?.endTime)}
                        </div>
                      </td>
                      <td>{userName}</td>
                      <td>{userPhone}</td>
                      <td>{b.arenaName ?? locationsMap[b.arenaId]?.name ?? b.arenaId?.slice(0, 8) ?? '-'}</td>

                      <td>
                        <span className={sportBadgeClass(b.sportType)}>
                          {titleCaseWords(b.sportType ?? 'unknown')}
                        </span>
                      </td>
                      <td>
                        <select
                          className={badgeClass(b.bookingStatus)}
                          value={b.bookingStatus}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            void patchBookingStatus(b.bookingId, e.target.value as BookingStatus)
                          }
                          style={{
                            border: 'none',
                            padding: '0.15rem 1.25rem 0.15rem 0.45rem',
                            cursor: 'pointer',
                            width: 'auto',
                            minWidth: '100px',
                            backgroundPosition: 'right 0.35rem center',
                            backgroundSize: '8px',
                            appearance: 'none',
                            WebkitAppearance: 'none',
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                            backgroundRepeat: 'no-repeat',
                          }}
                        >
                          {(
                            [
                              'pending',
                              'confirmed',
                              'cancelled',
                              'completed',
                              'no_show',
                            ] as const
                          ).map((s) => (
                            <option key={s} value={s} style={{ background: 'var(--surface2)', color: 'var(--text)' }}>
                              {titleCaseWords(s)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          className={badgeClass(b.payment.paymentStatus)}
                          value={b.payment.paymentStatus}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            void patchPaymentStatus(b.bookingId, e.target.value as PaymentStatus)
                          }
                          style={{
                            border: 'none',
                            padding: '0.15rem 1.25rem 0.15rem 0.45rem',
                            cursor: 'pointer',
                            width: 'auto',
                            minWidth: '94px',
                            backgroundPosition: 'right 0.35rem center',
                            backgroundSize: '8px',
                            appearance: 'none',
                            WebkitAppearance: 'none',
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                            backgroundRepeat: 'no-repeat',
                          }}
                        >
                          {(['pending', 'partially_paid', 'paid', 'failed', 'refunded'] as const).map((s) => (
                            <option key={s} value={s} style={{ background: 'var(--surface2)', color: 'var(--text)' }}>
                              {titleCaseWords(s)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          className="badge badge-neutral"
                          value={b.payment.paymentMethod}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            void patchPaymentMethod(b.bookingId, e.target.value as PaymentMethod)
                          }
                          style={{
                            border: 'none',
                            padding: '0.15rem 1.25rem 0.15rem 0.45rem',
                            cursor: 'pointer',
                            width: 'auto',
                            minWidth: '90px',
                            backgroundPosition: 'right 0.35rem center',
                            backgroundSize: '8px',
                            appearance: 'none',
                            WebkitAppearance: 'none',
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                            backgroundRepeat: 'no-repeat',
                          }}
                        >
                          {(['cash', 'card', 'jazzcash', 'easypaisa'] as const).map((s) => (
                            <option key={s} value={s} style={{ background: 'var(--surface2)', color: 'var(--text)' }}>
                              {titleCaseWords(s)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>{b.pricing.totalAmount.toLocaleString()} PKR</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="number"
                          min={0}
                          defaultValue={String(b.payment.paidAmount ?? 0)}
                          style={{ width: '110px' }}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            const next = Number.isFinite(v) ? Math.max(0, v) : b.payment.paidAmount;
                            e.currentTarget.value = String(next);
                            if (next !== b.payment.paidAmount) {
                              void patchPaidAmount(b.bookingId, next);
                            }
                          }}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(b.bookingId);
                              setDetailModalOpen(true);
                            }}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/app/bookings/${b.bookingId}/edit`);
                            }}
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                      );
                    })}
                  </tbody>
                </table>
                <TablePagination
                  totalItems={sortedBookings.length}
                  page={page}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={(nextSize) => {
                    setPageSize(nextSize);
                    setPage(1);
                  }}
                />
              </>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

