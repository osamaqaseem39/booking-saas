import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  getBookingAvailability,
  getCourtBookedSlots,
  listBookings,
  listBookingsForTenant,
  listBusinesses,
  listCourtOptions,
  listIamUsers,
  updateBooking,
} from '../api/saasClient';
import { useSession } from '../context/SessionContext';
import type { DashboardOutletContext } from '../layout/ConsoleLayout';
import type {
  BookingRecord,
  BookingSportType,
  BookingStatus,
  CourtKind,
  PaymentMethod,
  PaymentStatus,
} from '../types/booking';
import type { IamUserRow } from '../types/domain';
import { formatTime12h, formatTimeRange12h } from '../utils/timeDisplay';

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

export default function BookingsPage() {
  const navigate = useNavigate();
  const { tenantId, session } = useSession();
  const isPlatformOwner = session?.roles?.includes('platform-owner') ?? false;
  const { selectedLocationId } = useOutletContext<DashboardOutletContext>();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [usersMap, setUsersMap] = useState<Record<string, UserSummary>>({});
  const [courtsMap, setCourtsMap] = useState<Record<string, string>>({});
  const [availabilitySport, setAvailabilitySport] =
    useState<BookingSportType | ''>('');
  const [availabilityDate, setAvailabilityDate] = useState('');
  const [availabilityStartTime, setAvailabilityStartTime] = useState('');
  const [availabilityEndTime, setAvailabilityEndTime] = useState('');
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
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
  const [bookingStatusFilter, setBookingStatusFilter] = useState<
    'all' | BookingStatus
  >('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<
    'all' | PaymentStatus
  >('all');

  const selected = useMemo(
    () => bookings.find((b) => b.bookingId === selectedId) ?? null,
    [bookings, selectedId],
  );
  const filteredBookings = useMemo(() => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const today = todayDate.toISOString().slice(0, 10);
    const tomorrowDate = new Date(todayDate);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = tomorrowDate.toISOString().slice(0, 10);

    return bookings.filter((b) => {
      if (selectedLocationId !== 'all' && b.arenaId !== selectedLocationId) return false;
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
    selectedLocationId,
    bookingStatusFilter,
    paymentStatusFilter,
  ]);
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
        const biz = await listBusinesses();
        const chunks = await Promise.all(
          biz.map((b) =>
            listBookingsForTenant(b.tenantId).catch(() => [] as BookingRecord[]),
          ),
        );
        const merged = chunks.flat();
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
  }, [refresh]);

  useEffect(() => {
    if (window.location.hash !== '#availability-explorer') return;
    window.setTimeout(() => {
      document.getElementById('availability-explorer')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 30);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const users: IamUserRow[] = await listIamUsers();
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
          map[row.id] = row.label.split('—').slice(1).join('—').trim() || row.label;
        }
        setCourtsMap(map);
      } catch {
        setCourtsMap({});
      }
    })();
  }, [selectedLocationId]);


  async function patchBooking(patch: Parameters<typeof updateBooking>[1]) {
    if (!selectedId) return;
    setError(null);
    try {
      const updated = await updateBooking(selectedId, patch);
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
    setError(null);
    setAvailabilityLoading(true);
    setCourtSlots(null);
    try {
      const result = await getBookingAvailability({
        date: availabilityDate,
        startTime: availabilityStartTime,
        endTime: availabilityEndTime,
        sportType: availabilitySport,
      });
      setAvailability(result);
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

  function scrollToAvailability() {
    document.getElementById('availability-explorer')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
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
      {!tenantId.trim() && !isPlatformOwner && (
        <div className="err-banner">Pick an active tenant in the top bar.</div>
      )}
      <div className="toolbar">
        <span className="muted">
          {loading ? 'Loading…' : `${filteredBookings.length} booking(s)`}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="btn-ghost" onClick={() => void refresh()} disabled={loading}>
            Refresh
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={scrollToAvailability}
          >
            Check availability
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate('/app/bookings/new')}
            disabled={!tenantId.trim()}
          >
            Add booking
          </button>
        </div>
      </div>
      <section className="detail-card" style={{ marginBottom: '0.75rem' }}>
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'end',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: '180px' }}>
            <label>Booking status</label>
            <select
              value={bookingStatusFilter}
              onChange={(e) =>
                setBookingStatusFilter(e.target.value as 'all' | BookingStatus)
              }
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No Show</option>
            </select>
          </div>
          <div style={{ minWidth: '180px' }}>
            <label>Payment status</label>
            <select
              value={paymentStatusFilter}
              onChange={(e) =>
                setPaymentStatusFilter(e.target.value as 'all' | PaymentStatus)
              }
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>
          <span className="muted" style={{ marginLeft: 'auto', paddingBottom: '0.2rem' }}>
            Showing {filteredBookings.length} of {bookings.length} bookings
          </span>
        </div>
      </section>
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
      <section className="detail-card" style={{ marginBottom: '0.75rem' }}>
        <h3 style={{ marginBottom: '0.6rem' }}>Booking stats</h3>
        <div className="overview-totals-grid">
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
        </div>
        <div className="overview-totals-grid" style={{ marginTop: '0.55rem' }}>
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
      <div id="availability-explorer" className="main-area" style={{ marginBottom: '0.75rem' }}>
        <section className="detail-card" style={{ gridColumn: '1 / -1' }}>
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
                  value={availabilityStartTime}
                  onChange={(e) => setAvailabilityStartTime(e.target.value)}
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
                  value={availabilityEndTime}
                  onChange={(e) => setAvailabilityEndTime(e.target.value)}
                />
              </div>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: '0.82rem' }}>
              Pickers use 24-hour values for the API; labels show 12-hour time.
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
                            {court.pricePerSlot.toFixed(2)} per slot
                            {court.slotDurationMinutes != null
                              ? ` · ${court.slotDurationMinutes} min slot`
                              : ''}
                          </div>
                        ) : null}
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ marginTop: '0.35rem' }}
                          onClick={() => void viewCourtSlots(court.kind, court.id)}
                        >
                          View booked slots
                        </button>
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
                    {courtSlots.slots.map((slot) => (
                      <li key={slot.itemId}>
                        <div>
                          <strong>
                            {formatTimeRange12h(slot.startTime, slot.endTime)}
                          </strong>
                        </div>
                        <div className="muted">
                          {slot.status} · booking {slot.bookingId.slice(0, 8)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="main-area" style={{ padding: 0, marginTop: '0.5rem' }}>
        <div>
          <div className="table-wrap">
            {filteredBookings.length === 0 && !loading ? (
              <div className="empty-state">No bookings.</div>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Sport</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Total</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((b) => (
                    (() => {
                      const user = usersMap[b.userId];
                      return (
                    <tr
                      key={b.bookingId}
                      className={b.bookingId === selectedId ? 'active' : ''}
                      onClick={() => setSelectedId(b.bookingId)}
                    >
                      <td>{b.bookingDate}</td>
                      <td>{user?.name ?? `User ${b.userId.slice(0, 8)}`}</td>
                      <td>{user?.phone ?? '-'}</td>
                      <td>
                        <span className={sportBadgeClass(b.sportType)}>
                          {titleCaseWords(b.sportType ?? 'unknown')}
                        </span>
                      </td>
                      <td>
                        <span className={badgeClass(b.bookingStatus)}>
                          {b.bookingStatus}
                        </span>
                      </td>
                      <td>
                        <span className={badgeClass(b.payment.paymentStatus)}>
                          {b.payment.paymentStatus}
                        </span>
                      </td>
                      <td>{b.pricing.totalAmount.toLocaleString()} PKR</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(b.bookingId);
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
                    })()
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <aside className="detail-card">
          {!selected ? (
            <div className="empty-state">Select a booking.</div>
          ) : (
            <>
              <h3>Detail</h3>
              <div className="detail-section">
                <h4>Summary</h4>
                <div className="detail-row">
                  <span>Booking</span>
                  <span style={{ wordBreak: 'break-word' }}>
                    #{selected.bookingId.slice(0, 8)}
                  </span>
                </div>
                <div className="detail-row">
                  <span>User</span>
                  <span style={{ wordBreak: 'break-word' }}>
                    {usersMap[selected.userId]?.name ?? `User ${selected.userId.slice(0, 8)}`}
                  </span>
                </div>
                <div className="detail-row">
                  <span>Phone</span>
                  <span style={{ wordBreak: 'break-word' }}>
                    {usersMap[selected.userId]?.phone ?? '-'}
                  </span>
                </div>
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
              <div className="detail-section">
                <h4>Actions</h4>
                <div className="form-grid">
                  <div>
                    <label>Booking status</label>
                    <select
                      value={selected.bookingStatus}
                      onChange={(e) =>
                        void patchBooking({
                          bookingStatus: e.target.value as BookingStatus,
                        })
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
                        ['pending', 'paid', 'failed', 'refunded'] as const
                      ).map((s) => (
                        <option key={s} value={s}>
                          {titleCaseWords(s)}
                        </option>
                      ))}
                    </select>
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
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

    </div>
  );
}
