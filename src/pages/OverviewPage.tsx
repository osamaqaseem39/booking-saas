import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  listBookingsForTenant,
  listBusinesses,
  listBusinessLocations,
  listInvoicesForTenant,
} from '../api/saasClient';
import type { DashboardOutletContext } from '../layout/ConsoleLayout';
import { useSession } from '../context/SessionContext';
import type { BookingRecord, BookingStatus, PaymentStatus } from '../types/booking';
import type { BusinessLocationRow, BusinessRow, InvoiceRow } from '../types/domain';

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

function titleCase(v: string): string {
  return v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtCurrency(amount: number, currency = 'PKR'): string {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function trendMeta(current: number, previous: number): {
  delta: number;
  pct: number;
  tone: 'up' | 'down' | 'flat';
  sign: string;
} {
  const delta = current - previous;
  const pct = previous === 0 ? (current === 0 ? 0 : 100) : (delta / previous) * 100;
  if (delta > 0) return { delta, pct, tone: 'up', sign: '+' };
  if (delta < 0) return { delta, pct, tone: 'down', sign: '-' };
  return { delta: 0, pct: 0, tone: 'flat', sign: '' };
}

function localDateYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function lastNDates(days: number): string[] {
  const out: string[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(localDateYmd(d));
  }
  return out;
}

type BookingSource = 'walkin' | 'app' | 'call';

function bookingSourceFromRecord(booking: BookingRecord): BookingSource {
  const notes = (booking.notes ?? '').toLowerCase();
  const tagged = notes.match(/source\s*:\s*(walkin|walk-in|app|call)\b/);
  if (tagged?.[1]) {
    return tagged[1] === 'walk-in' ? 'walkin' : (tagged[1] as BookingSource);
  }
  if (notes.includes('walk-in') || notes.includes('walkin')) return 'walkin';
  if (notes.includes('call')) return 'call';
  if (notes.includes('app')) return 'app';
  return 'walkin';
}

export default function OverviewPage() {
  const navigate = useNavigate();
  const { session, tenantId } = useSession();
  const { selectedLocationId, dashboardLocations } =
    useOutletContext<DashboardOutletContext>();

  const roles = session?.roles ?? [];
  const isPlatformOwner = roles.includes('platform-owner');
  const isBusinessUser = roles.includes('business-admin') || roles.includes('business-staff');

  // ── Platform-owner state ──────────────────────────────────────────────────
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [ownerLocations, setOwnerLocations] = useState<BusinessLocationRow[]>([]);
  const [bookingsByTenant, setBookingsByTenant] = useState<Record<string, BookingRecord[]>>({});
  const [invoicesByTenant, setInvoicesByTenant] = useState<Record<string, InvoiceRow[]>>({});
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'7' | '30' | '90' | 'all'>('30');
  const [ownerBookingStatus, setOwnerBookingStatus] = useState<'all' | BookingStatus>('all');
  const [invoiceStatus, setInvoiceStatus] = useState<'all' | string>('all');
  const [tenantQuery, setTenantQuery] = useState('');
  const [sortBy, setSortBy] = useState<'bookings' | 'invoices' | 'locations' | 'name'>('bookings');
  const [ownerSortDir, setOwnerSortDir] = useState<'asc' | 'desc'>('desc');

  // ── Business-user state ───────────────────────────────────────────────────
  const [tenantBusinessName, setTenantBusinessName] = useState('Your business');
  const [tenantBookings, setTenantBookings] = useState<BookingRecord[]>([]);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [tenantError, setTenantError] = useState<string | null>(null);
  const [bizBookingStatus, setBizBookingStatus] = useState<'all' | BookingStatus>('all');
  const [bizPayStatus, setBizPayStatus] = useState<'all' | PaymentStatus>('all');
  const [bizListSort, setBizListSort] = useState<
    'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'status'
  >('date_desc');

  // ── Platform-owner load ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlatformOwner) return;
    void (async () => {
      setOwnerLoading(true);
      setOwnerError(null);
      try {
        const [biz, loc] = await Promise.all([listBusinesses(), listBusinessLocations()]);
        setBusinesses(biz);
        setOwnerLocations(loc);
        const results = await Promise.all(
          biz.map(async (b) => {
            try {
              const [bookings, invoices] = await Promise.all([
                listBookingsForTenant(b.tenantId),
                listInvoicesForTenant(b.tenantId),
              ]);
              return { tenantId: b.tenantId, bookings, invoices };
            } catch {
              return { tenantId: b.tenantId, bookings: [], invoices: [] };
            }
          }),
        );
        const nextBookings: Record<string, BookingRecord[]> = {};
        const nextInvoices: Record<string, InvoiceRow[]> = {};
        for (const row of results) {
          nextBookings[row.tenantId] = row.bookings;
          nextInvoices[row.tenantId] = row.invoices;
        }
        setBookingsByTenant(nextBookings);
        setInvoicesByTenant(nextInvoices);
      } catch (e) {
        setOwnerError(e instanceof Error ? e.message : 'Failed to load tenant activity');
      } finally {
        setOwnerLoading(false);
      }
    })();
  }, [isPlatformOwner]);

  // ── Business-user load ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isBusinessUser || !tenantId.trim()) return;
    void (async () => {
      setTenantLoading(true);
      setTenantError(null);
      try {
        const [biz, bookings] = await Promise.all([
          listBusinesses(),
          listBookingsForTenant(tenantId),
        ]);
        setTenantBusinessName(biz[0]?.businessName || 'Your business');
        setTenantBookings(bookings);
      } catch (e) {
        setTenantError(e instanceof Error ? e.message : 'Failed to load business overview');
      } finally {
        setTenantLoading(false);
      }
    })();
  }, [isBusinessUser, tenantId]);

  // ── Platform-owner computed ───────────────────────────────────────────────
  const invoiceStatusOptions = useMemo(() => {
    const statuses = new Set<string>();
    Object.values(invoicesByTenant).forEach((rows) => rows.forEach((i) => statuses.add(i.status)));
    return Array.from(statuses).sort();
  }, [invoicesByTenant]);

  const tenantStats = useMemo(() => {
    const now = Date.now();
    const maxAgeMs =
      dateRange === 'all' ? Number.POSITIVE_INFINITY : Number(dateRange) * 86400000;
    const query = tenantQuery.trim().toLowerCase();
    const rows = businesses
      .map((b) => {
        const tBookings = bookingsByTenant[b.tenantId] ?? [];
        const tInvoices = invoicesByTenant[b.tenantId] ?? [];
        const tLocations = ownerLocations.filter((l) => l.business?.tenantId === b.tenantId);
        const filteredBookings = tBookings.filter((bk) => {
          if (ownerBookingStatus !== 'all' && bk.bookingStatus !== ownerBookingStatus) return false;
          if (dateRange === 'all') return true;
          const parsed = Date.parse(bk.bookingDate || bk.createdAt);
          return !Number.isNaN(parsed) && now - parsed <= maxAgeMs;
        });
        const filteredInvoices = tInvoices.filter((inv) =>
          invoiceStatus === 'all' ? true : inv.status === invoiceStatus,
        );
        return {
          id: b.id,
          businessName: b.businessName,
          tenantId: b.tenantId,
          locations: tLocations.length,
          bookings: filteredBookings.length,
          invoices: filteredInvoices.length,
        };
      })
      .filter((row) => {
        if (!query) return true;
        return (
          row.businessName.toLowerCase().includes(query) ||
          row.tenantId.toLowerCase().includes(query)
        );
      });
    rows.sort((a, b) => {
      const dir = ownerSortDir === 'asc' ? 1 : -1;
      if (sortBy === 'name') return a.businessName.localeCompare(b.businessName) * dir;
      return (a[sortBy] - b[sortBy]) * dir;
    });
    return rows;
  }, [
    ownerBookingStatus,
    bookingsByTenant,
    businesses,
    dateRange,
    invoiceStatus,
    invoicesByTenant,
    ownerLocations,
    ownerSortDir,
    sortBy,
    tenantQuery,
  ]);

  const ownerTotals = useMemo(
    () => ({
      tenants: tenantStats.length,
      locations: tenantStats.reduce((s, r) => s + r.locations, 0),
      bookings: tenantStats.reduce((s, r) => s + r.bookings, 0),
      invoices: tenantStats.reduce((s, r) => s + r.invoices, 0),
    }),
    [tenantStats],
  );

  // ── Business-user computed ────────────────────────────────────────────────
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const thisMonthStr = useMemo(() => todayStr.slice(0, 7), [todayStr]);
  const prevMonthStr = useMemo(() => {
    const d = new Date(`${todayStr}T00:00:00`);
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  }, [todayStr]);

  const locationFilteredBookings = useMemo(() => {
    if (selectedLocationId === 'all') return tenantBookings;
    return tenantBookings.filter((b) => b.arenaId === selectedLocationId);
  }, [tenantBookings, selectedLocationId]);

  const filteredBookings = useMemo(() => {
    return locationFilteredBookings.filter((b) => {
      if (bizBookingStatus !== 'all' && b.bookingStatus !== bizBookingStatus) return false;
      if (bizPayStatus !== 'all' && b.payment.paymentStatus !== bizPayStatus) return false;
      return true;
    });
  }, [locationFilteredBookings, bizBookingStatus, bizPayStatus]);

  const kpis = useMemo(() => {
    const locBase = locationFilteredBookings;
    const todayBookings = locBase.filter((b) => b.bookingDate?.slice(0, 10) === todayStr);
    const yesterdayBookings = locBase.filter((b) => b.bookingDate?.slice(0, 10) === yesterdayStr);
    const monthBookings = locBase.filter((b) => b.bookingDate?.slice(0, 7) === thisMonthStr);
    const prevMonthBookings = locBase.filter((b) => b.bookingDate?.slice(0, 7) === prevMonthStr);
    const currency =
      locBase.find((b) => b.items?.[0]?.currency)?.items?.[0]?.currency ?? 'PKR';
    const todayRevenue = todayBookings.reduce((s, b) => s + (b.pricing?.totalAmount ?? 0), 0);
    const yesterdayRevenue = yesterdayBookings.reduce((s, b) => s + (b.pricing?.totalAmount ?? 0), 0);
    const monthRevenue = monthBookings.reduce((s, b) => s + (b.pricing?.totalAmount ?? 0), 0);
    const prevMonthRevenue = prevMonthBookings.reduce((s, b) => s + (b.pricing?.totalAmount ?? 0), 0);
    return {
      todayCount: todayBookings.length,
      yesterdayCount: yesterdayBookings.length,
      monthCount: monthBookings.length,
      prevMonthCount: prevMonthBookings.length,
      todayRevenue,
      yesterdayRevenue,
      monthRevenue,
      prevMonthRevenue,
      currency,
    };
  }, [locationFilteredBookings, prevMonthStr, thisMonthStr, todayStr, yesterdayStr]);

  const sourceStats = useMemo(() => {
    const sourceOrder: BookingSource[] = ['walkin', 'app', 'call'];
    const sourceMap = new Map<string, { current: number; previous: number }>();
    for (const src of sourceOrder) {
      sourceMap.set(src, { current: 0, previous: 0 });
    }
    for (const b of locationFilteredBookings) {
      const source = bookingSourceFromRecord(b);
      if (!sourceMap.has(source)) sourceMap.set(source, { current: 0, previous: 0 });
      const stat = sourceMap.get(source)!;
      const monthTag = b.bookingDate?.slice(0, 7);
      if (monthTag === thisMonthStr) stat.current += 1;
      if (monthTag === prevMonthStr) stat.previous += 1;
    }
    return [...sourceMap.entries()].map(([source, counts]) => ({
      source,
      ...counts,
      trend: trendMeta(counts.current, counts.previous),
    }));
  }, [locationFilteredBookings, prevMonthStr, thisMonthStr]);

  const sourceChartStats = useMemo(() => {
    const sourceOrder: BookingSource[] = ['walkin', 'app', 'call'];
    const counts = new Map<string, number>();
    for (const key of sourceOrder) counts.set(key, 0);
    for (const b of filteredBookings) {
      const source = bookingSourceFromRecord(b);
      counts.set(source, (counts.get(source) ?? 0) + 1);
    }
    const rows = [...counts.entries()].map(([source, count]) => ({ source, count }));
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    const max = rows.reduce((m, row) => Math.max(m, row.count), 0);
    return rows.map((row) => ({
      ...row,
      pct: total > 0 ? Math.round((row.count / total) * 100) : 0,
      widthPct: max > 0 ? Math.max(8, Math.round((row.count / max) * 100)) : 0,
    }));
  }, [filteredBookings]);

  const bookingTrend = useMemo(() => {
    const days = lastNDates(7);
    const countsByDay = new Map<string, number>();
    const revenueByDay = new Map<string, number>();
    for (const day of days) {
      countsByDay.set(day, 0);
      revenueByDay.set(day, 0);
    }
    for (const b of filteredBookings) {
      const day = b.bookingDate?.slice(0, 10) ?? '';
      if (!countsByDay.has(day)) continue;
      countsByDay.set(day, (countsByDay.get(day) ?? 0) + 1);
      revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + (b.pricing?.totalAmount ?? 0));
    }
    const bookingSeries = days.map((day) => ({
      day,
      label: day.slice(5),
      value: countsByDay.get(day) ?? 0,
    }));
    const revenueSeries = days.map((day) => ({
      day,
      label: day.slice(5),
      value: Math.round(revenueByDay.get(day) ?? 0),
    }));
    const bookingMax = bookingSeries.reduce((m, x) => Math.max(m, x.value), 0);
    const revenueMax = revenueSeries.reduce((m, x) => Math.max(m, x.value), 0);
    return {
      bookingSeries: bookingSeries.map((r) => ({
        ...r,
        heightPct: bookingMax > 0 ? Math.max(8, Math.round((r.value / bookingMax) * 100)) : 0,
      })),
      revenueSeries: revenueSeries.map((r) => ({
        ...r,
        heightPct: revenueMax > 0 ? Math.max(8, Math.round((r.value / revenueMax) * 100)) : 0,
      })),
    };
  }, [filteredBookings]);

  const activeLocationName = useMemo(() => {
    if (selectedLocationId === 'all') return tenantBusinessName;
    return dashboardLocations.find((l) => l.id === selectedLocationId)?.name ?? tenantBusinessName;
  }, [selectedLocationId, dashboardLocations, tenantBusinessName]);

  const sortedFilteredBookings = useMemo(() => {
    const rows = [...filteredBookings];
    rows.sort((a, b) => {
      if (bizListSort === 'date_desc') return (Date.parse(b.bookingDate || b.createdAt) || 0) - (Date.parse(a.bookingDate || a.createdAt) || 0);
      if (bizListSort === 'date_asc') return (Date.parse(a.bookingDate || a.createdAt) || 0) - (Date.parse(b.bookingDate || b.createdAt) || 0);
      if (bizListSort === 'amount_desc') return (b.pricing?.totalAmount ?? 0) - (a.pricing?.totalAmount ?? 0);
      if (bizListSort === 'amount_asc') return (a.pricing?.totalAmount ?? 0) - (b.pricing?.totalAmount ?? 0);
      return a.bookingStatus.localeCompare(b.bookingStatus);
    });
    return rows;
  }, [filteredBookings, bizListSort]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="overview-page">
      <div className="page-head-row" style={{ marginBottom: '0.9rem' }}>
        <h1 className="page-title">Overview</h1>
        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate('/app/bookings#availability-explorer')}
        >
          Check availability
        </button>
      </div>

      {/* ── Business-user dashboard ── */}
      {isBusinessUser && (
        <div className="overview-content">
          <h2 className="overview-subtitle">{activeLocationName}</h2>

          {tenantError && <div className="err-banner">{tenantError}</div>}

          {tenantLoading ? (
            <p className="muted">Loading dashboard…</p>
          ) : (
            <>
              {/* KPI cards */}
              <div className="overview-totals-grid biz-kpi-grid">
                <div className="overview-metric-card biz-kpi-card">
                  <span className="overview-metric-label">Today's bookings</span>
                  <strong className="overview-metric-value biz-kpi-value">{kpis.todayCount}</strong>
                  {(() => {
                    const trend = trendMeta(kpis.todayCount, kpis.yesterdayCount);
                    return (
                      <span className={`biz-kpi-trend biz-kpi-trend--${trend.tone}`}>
                        {trend.sign}
                        {Math.abs(trend.delta)} ({Math.abs(trend.pct).toFixed(0)}%) vs yesterday
                      </span>
                    );
                  })()}
                </div>
                <div className="overview-metric-card biz-kpi-card">
                  <span className="overview-metric-label">Monthly bookings</span>
                  <strong className="overview-metric-value biz-kpi-value">{kpis.monthCount}</strong>
                  {(() => {
                    const trend = trendMeta(kpis.monthCount, kpis.prevMonthCount);
                    return (
                      <span className={`biz-kpi-trend biz-kpi-trend--${trend.tone}`}>
                        {trend.sign}
                        {Math.abs(trend.delta)} ({Math.abs(trend.pct).toFixed(0)}%) vs last month
                      </span>
                    );
                  })()}
                </div>
                <div className="overview-metric-card biz-kpi-card biz-kpi-card--revenue">
                  <span className="overview-metric-label">Today's revenue</span>
                  <strong className="overview-metric-value biz-kpi-value">
                    {fmtCurrency(kpis.todayRevenue, kpis.currency)}
                  </strong>
                  {(() => {
                    const trend = trendMeta(kpis.todayRevenue, kpis.yesterdayRevenue);
                    return (
                      <span className={`biz-kpi-trend biz-kpi-trend--${trend.tone}`}>
                        {trend.sign}
                        {fmtCurrency(Math.abs(trend.delta), kpis.currency)} ({Math.abs(trend.pct).toFixed(0)}%)
                        {' '}vs yesterday
                      </span>
                    );
                  })()}
                </div>
                <div className="overview-metric-card biz-kpi-card biz-kpi-card--revenue">
                  <span className="overview-metric-label">Monthly revenue</span>
                  <strong className="overview-metric-value biz-kpi-value">
                    {fmtCurrency(kpis.monthRevenue, kpis.currency)}
                  </strong>
                  {(() => {
                    const trend = trendMeta(kpis.monthRevenue, kpis.prevMonthRevenue);
                    return (
                      <span className={`biz-kpi-trend biz-kpi-trend--${trend.tone}`}>
                        {trend.sign}
                        {fmtCurrency(Math.abs(trend.delta), kpis.currency)} ({Math.abs(trend.pct).toFixed(0)}%)
                        {' '}vs last month
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* Filters */}
              <div className="connection-panel overview-panel biz-filter-panel">
                <div className="filter-chip-group">
                  <span className="muted">Booking status</span>
                  <div className="filter-chip-row">
                    {(['all', 'pending', 'confirmed', 'completed', 'cancelled', 'no_show'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={bizBookingStatus === s ? 'filter-chip filter-chip--active' : 'filter-chip'}
                        onClick={() => setBizBookingStatus(s)}
                      >
                        {s === 'all' ? 'All' : titleCase(s)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="filter-chip-group" style={{ marginTop: '0.45rem' }}>
                  <span className="muted">Payment status</span>
                  <div className="filter-chip-row">
                    {(['all', 'pending', 'paid', 'failed', 'refunded'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={bizPayStatus === s ? 'filter-chip filter-chip--active' : 'filter-chip'}
                        onClick={() => setBizPayStatus(s)}
                      >
                        {s === 'all' ? 'All' : titleCase(s)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="filter-chip-group" style={{ marginTop: '0.45rem' }}>
                <p className="muted" style={{ marginTop: '0.5rem', fontSize: '0.82rem' }}>
                  Showing {sortedFilteredBookings.length} of {locationFilteredBookings.length} bookings
                  {selectedLocationId !== 'all' && (
                    <span> · {dashboardLocations.find((l) => l.id === selectedLocationId)?.name}</span>
                  )}
                </p>
              </div>

              {/* Booking list */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.6rem',
                  marginTop: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <h3 className="overview-subtitle" style={{ margin: 0 }}>
                  Booking list
                </h3>
                <div className="filter-chip-row">
                  {[
                    ['date_desc', 'Date ↓'],
                    ['date_asc', 'Date ↑'],
                    ['amount_desc', 'Amount ↓'],
                    ['amount_asc', 'Amount ↑'],
                    ['status', 'Status'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={bizListSort === value ? 'filter-chip filter-chip--active' : 'filter-chip'}
                      onClick={() => setBizListSort(value as typeof bizListSort)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="table-wrap" style={{ marginTop: '1rem' }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Sport</th>
                      <th>Location</th>
                      <th>Amount</th>
                      <th>Booking</th>
                      <th>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFilteredBookings.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>
                          No bookings match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      sortedFilteredBookings.map((bk) => {
                        const loc = dashboardLocations.find((l) => l.id === bk.arenaId);
                        return (
                          <tr
                            key={bk.bookingId}
                            onClick={() => navigate(`/app/bookings/${bk.bookingId}/edit`)}
                          >
                            <td>{bk.bookingDate?.slice(0, 10) ?? '—'}</td>
                            <td>{titleCase(bk.sportType ?? '')}</td>
                            <td className="muted" style={{ fontSize: '0.82rem' }}>
                              {loc?.name ?? bk.arenaId?.slice(0, 8) ?? '—'}
                            </td>
                            <td>
                              <strong>
                                {fmtCurrency(
                                  bk.pricing?.totalAmount ?? 0,
                                  bk.items?.[0]?.currency,
                                )}
                              </strong>
                            </td>
                            <td>
                              <span className={badgeClass(bk.bookingStatus)}>
                                {titleCase(bk.bookingStatus)}
                              </span>
                            </td>
                            <td>
                              <span className={badgeClass(bk.payment?.paymentStatus ?? '')}>
                                {titleCase(bk.payment?.paymentStatus ?? 'unknown')}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="connection-panel overview-panel" style={{ marginTop: '1rem' }}>
                <h3 className="overview-subtitle" style={{ marginBottom: '0.4rem' }}>
                  Booking insights charts
                </h3>
                <p className="muted" style={{ marginTop: 0 }}>
                  Source distribution and last 7 days trends for current filters.
                </p>
                <div className="overview-chart-grid">
                  <article className="overview-chart-card">
                    <h4>Bookings by source</h4>
                    <div className="overview-source-bars">
                      {sourceChartStats.map((row) => (
                        <div key={row.source} className="overview-source-row">
                          <span className="overview-source-label">{titleCase(row.source)}</span>
                          <div className="overview-source-track">
                            <div
                              className={`overview-source-fill overview-source-fill--${row.source}`}
                              style={{ width: `${row.widthPct}%` }}
                            />
                          </div>
                          <span className="overview-source-value">
                            {row.count} ({row.pct}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="overview-chart-card">
                    <h4>Bookings trend (last 7 days)</h4>
                    <div className="overview-mini-columns">
                      {bookingTrend.bookingSeries.map((point) => (
                        <div key={point.day} className="overview-mini-col">
                          <div
                            className="overview-mini-col-bar overview-mini-col-bar--bookings"
                            style={{ height: `${point.heightPct}%` }}
                            title={`${point.day}: ${point.value} bookings`}
                          />
                          <span className="overview-mini-col-label">{point.label}</span>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="overview-chart-card">
                    <h4>Revenue trend (last 7 days)</h4>
                    <div className="overview-mini-columns">
                      {bookingTrend.revenueSeries.map((point) => (
                        <div key={point.day} className="overview-mini-col">
                          <div
                            className="overview-mini-col-bar overview-mini-col-bar--revenue"
                            style={{ height: `${point.heightPct}%` }}
                            title={`${point.day}: ${fmtCurrency(point.value, kpis.currency)}`}
                          />
                          <span className="overview-mini-col-label">{point.label}</span>
                        </div>
                      ))}
                    </div>
                  </article>
                </div>
              </div>

              <div className="connection-panel overview-panel biz-source-panel">
                <h3 className="overview-subtitle" style={{ marginBottom: '0.65rem' }}>
                  Bookings by source (this month vs last month)
                </h3>
                <div className="biz-source-grid">
                  {sourceStats.map((row) => (
                    <div key={row.source} className="biz-source-card">
                      <strong>{titleCase(row.source)}</strong>
                      <span className="muted">
                        {row.current} this month · {row.previous} last month
                      </span>
                      <span className={`biz-kpi-trend biz-kpi-trend--${row.trend.tone}`}>
                        {row.trend.sign}
                        {Math.abs(row.trend.delta)} ({Math.abs(row.trend.pct).toFixed(0)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Platform-owner dashboard ── */}
      {isPlatformOwner && !isBusinessUser && (
        <div className="overview-content">
          <h2 className="overview-subtitle">All-tenant activity view</h2>
          {ownerError && <div className="err-banner">{ownerError}</div>}
          {ownerLoading ? (
            <p className="muted">Loading all tenants and activity…</p>
          ) : (
            <>
              <div className="connection-panel overview-panel">
                <div className="filter-chip-group">
                  <span className="muted">Date range</span>
                  <div className="filter-chip-row">
                    {([
                      ['7', '7d'],
                      ['30', '30d'],
                      ['90', '90d'],
                      ['all', 'All'],
                    ] as const).map(([v, label]) => (
                      <button
                        key={v}
                        type="button"
                        className={dateRange === v ? 'filter-chip filter-chip--active' : 'filter-chip'}
                        onClick={() => setDateRange(v)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="filter-chip-group" style={{ marginTop: '0.45rem' }}>
                  <span className="muted">Booking status</span>
                  <div className="filter-chip-row">
                    {(['all', 'pending', 'confirmed', 'cancelled', 'completed', 'no_show'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        className={ownerBookingStatus === v ? 'filter-chip filter-chip--active' : 'filter-chip'}
                        onClick={() => setOwnerBookingStatus(v)}
                      >
                        {v === 'all' ? 'All' : titleCase(v)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="filter-chip-group" style={{ marginTop: '0.45rem' }}>
                  <span className="muted">Invoice status</span>
                  <div className="filter-chip-row">
                    <button
                      type="button"
                      className={invoiceStatus === 'all' ? 'filter-chip filter-chip--active' : 'filter-chip'}
                      onClick={() => setInvoiceStatus('all')}
                    >
                      All
                    </button>
                    {invoiceStatusOptions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={invoiceStatus === s ? 'filter-chip filter-chip--active' : 'filter-chip'}
                        onClick={() => setInvoiceStatus(s)}
                      >
                        {titleCase(s)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="filter-chip-group" style={{ marginTop: '0.45rem' }}>
                  <span className="muted">Sort tenants</span>
                  <div className="filter-chip-row">
                    {([
                      ['bookings', 'Bookings'],
                      ['invoices', 'Invoices'],
                      ['locations', 'Locations'],
                      ['name', 'Name'],
                    ] as const).map(([v, label]) => (
                      <button
                        key={v}
                        type="button"
                        className={sortBy === v ? 'filter-chip filter-chip--active' : 'filter-chip'}
                        onClick={() => setSortBy(v)}
                      >
                        {label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="filter-chip"
                      onClick={() => setOwnerSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                    >
                      {ownerSortDir === 'asc' ? 'Asc ↑' : 'Desc ↓'}
                    </button>
                  </div>
                </div>
                <label className="overview-search">
                  <span className="muted">Search tenant</span>
                  <input
                    className="input"
                    placeholder="Business name or tenant ID"
                    value={tenantQuery}
                    onChange={(e) => setTenantQuery(e.target.value)}
                  />
                </label>
              </div>

              <div className="overview-totals-grid">
                <div className="overview-metric-card">
                  <span className="overview-metric-label">Tenants in view</span>
                  <strong className="overview-metric-value">{ownerTotals.tenants}</strong>
                </div>
                <div className="overview-metric-card">
                  <span className="overview-metric-label">Locations in view</span>
                  <strong className="overview-metric-value">{ownerTotals.locations}</strong>
                </div>
                <div className="overview-metric-card">
                  <span className="overview-metric-label">Bookings in view</span>
                  <strong className="overview-metric-value">{ownerTotals.bookings}</strong>
                </div>
                <div className="overview-metric-card">
                  <span className="overview-metric-label">Invoices in view</span>
                  <strong className="overview-metric-value">{ownerTotals.invoices}</strong>
                </div>
              </div>

              <div className="connection-panel overview-panel">
                <div className="overview-tenant-grid">
                  {tenantStats.map((row) => (
                    <article key={row.id} className="overview-tenant-card">
                      <div className="overview-tenant-head">
                        <strong>{row.businessName}</strong>
                        <span className="badge badge-neutral">{row.tenantId.slice(0, 8)}…</span>
                      </div>
                      <p className="overview-tenant-subtitle">{row.tenantId}</p>
                      <div className="overview-tenant-stats">
                        <span>{row.locations} locations</span>
                        <span>{row.bookings} bookings</span>
                        <span>{row.invoices} invoices</span>
                      </div>
                    </article>
                  ))}
                  {tenantStats.length === 0 && (
                    <div className="muted">No tenants match the selected filters.</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {!isPlatformOwner && !isBusinessUser && (
        <p className="muted" style={{ marginTop: '0.5rem' }}>
          Use the sidebar to view bookings, invoices, and tenant tools available for your role.
        </p>
      )}
    </div>
  );
}
