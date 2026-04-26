import { useEffect, useMemo, useState } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import {
  listAllBookings,
  listAllInvoices,
  listBookingsForTenant,
  listBusinesses,
  listBusinessLocations,
  listEndUsers,
} from '../../api/saasClient';
import type { DashboardOutletContext } from '../../layout/ConsoleLayout';
import { useSession } from '../../context/SessionContext';
import type { BookingRecord, BookingStatus } from '../../types/booking';

import type {
  BusinessLocationRow,
  BusinessRow,
  InvoiceRow,
} from '../../types/domain';

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

/** Normalized sport bucket for charts (matches `BookingSportType` + other). */
function sportChartBucket(sport: string | undefined): 'futsal' | 'cricket' | 'padel' | 'other' {
  const s = (sport ?? '').toLowerCase().trim();
  if (s === 'futsal' || s === 'cricket' || s === 'padel') return s;
  return 'other';
}

function bookingFromLabel(source: BookingSource | string): string {
  if (source === 'walkin') return 'Walk-in';
  return titleCase(source);
}

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



const SPORT_COLORS: Record<string, string> = {
  futsal: '#10b981',
  cricket: '#3b82f6',
  padel: '#f59e0b',
  other: '#64748b',
};

const SOURCE_COLORS: Record<string, string> = {
  walkin: '#6366f1',
  app: '#8b5cf6',
  call: '#ec4899',
};

type OwnerTenantSortColumn =
  | 'businessName'
  | 'tenantId'
  | 'locations'
  | 'bookings'
  | 'invoices';

function ownerTenantDefaultSortDir(col: OwnerTenantSortColumn): 'asc' | 'desc' {
  return col === 'businessName' || col === 'tenantId' ? 'asc' : 'desc';
}

const OWNER_TENANT_TABLE_SORT_HEADERS: { col: OwnerTenantSortColumn; label: string }[] = [
  { col: 'businessName', label: 'Business' },
  { col: 'tenantId', label: 'Tenant ID' },
  { col: 'locations', label: 'Locations' },
  { col: 'bookings', label: 'Bookings' },
  { col: 'invoices', label: 'Invoices' },
];

export default function OverviewPage() {
  const navigate = useNavigate();
  const { session, tenantId } = useSession();
  const { selectedLocationId, dashboardLocations } =
    useOutletContext<DashboardOutletContext>();

  const roles = session?.roles ?? [];
  const isPlatformOwner = roles.includes('platform-owner');
  const isBusinessUser =
    roles.includes('business-admin') ||
    roles.includes('location-admin') ||
    roles.includes('business-staff');
  /** Single-tenant KPI dashboard (not platform owners — they see platform-wide overview below). */
  const showTenantDashboard = isBusinessUser && !isPlatformOwner;

  // ── Platform-wide overview (platform owners only) ────────────────────────
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [ownerLocations, setOwnerLocations] = useState<BusinessLocationRow[]>([]);
  const [bookingsByTenant, setBookingsByTenant] = useState<Record<string, BookingRecord[]>>({});
  const [invoicesByTenant, setInvoicesByTenant] = useState<Record<string, InvoiceRow[]>>({});
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [ownerCustomerCount, setOwnerCustomerCount] = useState<number | null>(null);

  const [ownerAllBookings, setOwnerAllBookings] = useState<BookingRecord[]>([]);
  const [dateRange, setDateRange] = useState<'7' | '30' | '90' | 'all'>('30');
  const [ownerBookingStatus, setOwnerBookingStatus] = useState<'all' | BookingStatus>('all');
  const [invoiceStatus, setInvoiceStatus] = useState<'all' | string>('all');
  const [tenantQuery, setTenantQuery] = useState('');
  const [ownerTenantSortColumn, setOwnerTenantSortColumn] =
    useState<OwnerTenantSortColumn>('bookings');
  const [ownerTenantSortDir, setOwnerTenantSortDir] = useState<'asc' | 'desc'>('desc');

  // ── Tenant-scoped dashboard (business staff / admin only) ───────────────
  const [tenantBusinessName, setTenantBusinessName] = useState('Your business');
  const [tenantBookings, setTenantBookings] = useState<BookingRecord[]>([]);

  const [tenantLoading, setTenantLoading] = useState(false);
  const [tenantError, setTenantError] = useState<string | null>(null);
  const [tenantDateRange, setTenantDateRange] = useState<'7' | '30' | '90'>('7');



  useEffect(() => {
    if (!showTenantDashboard || !tenantId.trim()) return;
    void (async () => {
      setTenantLoading(true);
      setTenantError(null);
      try {
        const [biz, bookings] = await Promise.all([
          listBusinesses(),
          listBookingsForTenant(tenantId),
        ]);
        const match = biz.find((b) => b.tenantId === tenantId);
        setTenantBusinessName(
          match?.businessName ?? biz[0]?.businessName ?? 'Your business',
        );
        setTenantBookings(bookings);
      } catch (e) {
        setTenantError(e instanceof Error ? e.message : 'Failed to load business overview');
      } finally {
        setTenantLoading(false);
      }
    })();
  }, [showTenantDashboard, tenantId]);

  useEffect(() => {
    if (!isPlatformOwner) return;
    void (async () => {
      setOwnerLoading(true);
      setOwnerError(null);
      try {
        const [biz, loc, endUsers, allBookings, allInvoices] = await Promise.all([
          listBusinesses(),
          listBusinessLocations({ ignoreActiveTenant: true }),
          listEndUsers().catch(() => [] as Awaited<ReturnType<typeof listEndUsers>>),
          listAllBookings().catch(() => [] as BookingRecord[]),
          listAllInvoices().catch(() => [] as InvoiceRow[]),
        ]);
        setBusinesses(biz);
        setOwnerLocations(loc);
        setOwnerAllBookings(allBookings);


        setOwnerCustomerCount(
          endUsers.filter((u) => (u.roles ?? []).some((r) => r === 'customer-end-user')).length,
        );

        const nextBookings: Record<string, BookingRecord[]> = {};
        const nextInvoices: Record<string, InvoiceRow[]> = {};
        
        for (const b of biz) {
          nextBookings[b.tenantId] = allBookings.filter((bk) => bk.tenantId === b.tenantId);
          nextInvoices[b.tenantId] = allInvoices.filter((inv) => inv.tenantId === b.tenantId);
        }
        
        setBookingsByTenant(nextBookings);
        setInvoicesByTenant(nextInvoices);
      } catch (e) {
        setOwnerError(e instanceof Error ? e.message : 'Failed to load tenant activity');
        setOwnerCustomerCount(null);
      } finally {
        setOwnerLoading(false);
      }
    })();
  }, [isPlatformOwner]);

  const invoiceStatusOptions = useMemo(() => {
    const statuses = new Set<string>();
    Object.values(invoicesByTenant).forEach((rows) =>
      rows.forEach((i) => statuses.add(i.status)),
    );
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
      const dir = ownerTenantSortDir === 'asc' ? 1 : -1;
      const col = ownerTenantSortColumn;
      if (col === 'businessName') return a.businessName.localeCompare(b.businessName) * dir;
      if (col === 'tenantId') return a.tenantId.localeCompare(b.tenantId) * dir;
      return (a[col] - b[col]) * dir;
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
    ownerTenantSortColumn,
    ownerTenantSortDir,
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

  const ownerMoneyTotals = useMemo(() => {
    const now = Date.now();
    const maxAgeMs =
      dateRange === 'all' ? Number.POSITIVE_INFINITY : Number(dateRange) * 86400000;
    let bookingRevenue = 0;
    let invoiceRevenue = 0;
    for (const b of businesses) {
      const tBookings = bookingsByTenant[b.tenantId] ?? [];
      const tInvoices = invoicesByTenant[b.tenantId] ?? [];
      for (const bk of tBookings) {
        if (ownerBookingStatus !== 'all' && bk.bookingStatus !== ownerBookingStatus) continue;
        if (dateRange !== 'all') {
          const parsed = Date.parse(bk.bookingDate || bk.createdAt);
          if (Number.isNaN(parsed) || now - parsed > maxAgeMs) continue;
        }
        bookingRevenue += Number(bk.pricing?.totalAmount ?? 0);
      }
      for (const inv of tInvoices) {
        if (invoiceStatus !== 'all' && inv.status !== invoiceStatus) continue;
        invoiceRevenue += Number(inv.amount ?? 0);
      }
    }
    return { bookingRevenue, invoiceRevenue };
  }, [
    businesses,
    bookingsByTenant,
    invoicesByTenant,
    dateRange,
    ownerBookingStatus,
    invoiceStatus,
  ]);

  const ownerRevenueTrend = useMemo(() => {
    const days = lastNDates(7);
    const revenueByDay = new Map<string, number>();
    for (const day of days) revenueByDay.set(day, 0);
    for (const b of ownerAllBookings) {
      const day = b.bookingDate?.slice(0, 10) ?? '';
      if (!revenueByDay.has(day)) continue;
      revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + (b.pricing?.totalAmount ?? 0));
    }
    return days.map((day) => ({
      day,
      label: day.slice(5),
      value: Math.round(revenueByDay.get(day) ?? 0),
    }));
  }, [ownerAllBookings]);

  // ── Computed (tenant-scoped charts) ───────────────────────────────────────
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


  const filteredBookings = locationFilteredBookings;

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

  const sportChartStats = useMemo(() => {
    const order = ['futsal', 'cricket', 'padel', 'other'] as const;
    type SportRow = { sport: typeof order[number]; count: number; pct: number; widthPct: number };
    const counts = new Map<string, number>();
    for (const key of order) counts.set(key, 0);
    for (const b of filteredBookings) {
      const k = sportChartBucket(b.sportType);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const rows = order.map((sport) => ({ sport, count: counts.get(sport) ?? 0 }));
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    const max = rows.reduce((m, row) => Math.max(m, row.count), 0);
    return rows.map((row) => ({
      ...row,
      pct: total > 0 ? Math.round((row.count / total) * 100) : 0,
      widthPct: max > 0 ? Math.max(8, Math.round((row.count / max) * 100)) : 0,
    } as SportRow));
  }, [filteredBookings]);

  const revenueTrend = useMemo(() => {
    const days = lastNDates(Number(tenantDateRange));
    const revenueByDay = new Map<string, number>();
    for (const day of days) revenueByDay.set(day, 0);
    for (const b of filteredBookings) {
      const day = b.bookingDate?.slice(0, 10) ?? '';
      if (!revenueByDay.has(day)) continue;
      revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + (b.pricing?.totalAmount ?? 0));
    }
    const series = days.map((day) => ({
      day,
      label: day.slice(5),
      value: Math.round(revenueByDay.get(day) ?? 0),
    }));
    const max = series.reduce((m, x) => Math.max(m, x.value), 0);
    return series.map((r) => ({
      ...r,
      heightPct: max > 0 ? Math.max(5, Math.round((r.value / max) * 100)) : 0,
    }));
  }, [filteredBookings, tenantDateRange]);


  const activeLocationName = useMemo(() => {
    if (selectedLocationId === 'all') return tenantBusinessName;
    return dashboardLocations.find((l) => l.id === selectedLocationId)?.name ?? tenantBusinessName;
  }, [selectedLocationId, dashboardLocations, tenantBusinessName]);

  function handleOwnerTenantColumnSort(col: OwnerTenantSortColumn) {
    if (ownerTenantSortColumn === col) {
      setOwnerTenantSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setOwnerTenantSortColumn(col);
      setOwnerTenantSortDir(ownerTenantDefaultSortDir(col));
    }
  }



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

      {isPlatformOwner && (
        <p className="muted" style={{ marginTop: '-0.35rem', marginBottom: '1rem', maxWidth: '52rem' }}>
          <strong>Overview</strong> below is <strong>platform-wide</strong> (all businesses). Use the location
          filter in the top bar to narrow to one site.{' '}
          <Link to="/app/bookings/new">Add booking</Link> picks the business on the form.{' '}
          <Link to="/app/bookings">Bookings</Link> lists all businesses. Open{' '}
          <Link to="/app/businesses">Businesses</Link> for detail pages.
        </p>
      )}

      {/* ── Platform-wide dashboard (platform owners) ── */}
      {isPlatformOwner && (
        <div className="overview-content">
          <h2 className="overview-subtitle">All-tenant activity</h2>
          {ownerError && <div className="err-banner">{ownerError}</div>}
          {ownerLoading ? (
            <p className="muted">Loading all tenants and activity…</p>
          ) : (
            <>
              <div className="overview-filter-card connection-panel overview-panel">
                <div className="overview-filter-card-head">
                  <h3 className="overview-filter-card-title">Tenant table filters</h3>
                  <p className="overview-filter-card-desc muted">
                    Controls which bookings and invoices count toward each tenant row. Sort the
                    Businesses table by clicking a column header.
                  </p>
                </div>
                <div className="overview-filter-form overview-filter-form--tenant-bar">
                  <div className="overview-filter-field">
                    <label>Date window</label>
                    <div className="filter-chip-row">
                      {[
                        { value: '7', label: 'Last 7 days' },
                        { value: '30', label: 'Last 30 days' },
                        { value: '90', label: 'Last 90 days' },
                        { value: 'all', label: 'All time' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`filter-chip ${dateRange === opt.value ? 'filter-chip--active' : ''}`}
                          onClick={() => setDateRange(opt.value as typeof dateRange)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="overview-filter-field">
                    <label>Booking status</label>
                    <div className="filter-chip-row">
                      {(
                        [
                          ['all', 'All statuses'],
                          ['pending', 'Pending'],
                          ['confirmed', 'Confirmed'],
                          ['cancelled', 'Cancelled'],
                          ['completed', 'Completed'],
                          ['no_show', 'No show'],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          className={`filter-chip ${ownerBookingStatus === value ? 'filter-chip--active' : ''}`}
                          onClick={() => setOwnerBookingStatus(value as typeof ownerBookingStatus)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="overview-filter-field">
                    <label>Invoice status</label>
                    <div className="filter-chip-row">
                      <button
                        type="button"
                        className={`filter-chip ${invoiceStatus === 'all' ? 'filter-chip--active' : ''}`}
                        onClick={() => setInvoiceStatus('all')}
                      >
                        All invoice statuses
                      </button>
                      {invoiceStatusOptions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={`filter-chip ${invoiceStatus === s ? 'filter-chip--active' : ''}`}
                          onClick={() => setInvoiceStatus(s)}
                        >
                          {titleCase(s)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="overview-filter-field overview-filter-field--tenant-search">
                    <label>Search</label>
                    <div className="filter-chip-row">
                      <button
                        type="button"
                        className={`filter-chip ${tenantQuery.trim() === '' ? 'filter-chip--active' : ''}`}
                        onClick={() => setTenantQuery('')}
                      >
                        All tenants
                      </button>
                      <button
                        type="button"
                        className="filter-chip"
                        onClick={() => {
                          setDateRange('30');
                          setOwnerBookingStatus('all');
                          setInvoiceStatus('all');
                          setTenantQuery('');
                        }}
                      >
                        Reset filters
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="overview-totals-grid overview-platform-rollup">
                <div className="overview-metric-card">
                  <span className="overview-metric-label">Total customers</span>
                  <strong className="overview-metric-value">
                    {ownerCustomerCount === null ? '—' : ownerCustomerCount}
                  </strong>
                  <span className="overview-metric-hint muted">Platform-wide · customer role</span>
                </div>
                <div className="overview-metric-card">
                  <span className="overview-metric-label">Booking revenue</span>
                  <strong className="overview-metric-value">
                    {fmtCurrency(ownerMoneyTotals.bookingRevenue, 'PKR')}
                  </strong>
                  <span className="overview-metric-hint muted">Sum of booking totals · matches filters</span>
                </div>
                <div className="overview-metric-card">
                  <span className="overview-metric-label">Invoiced amount</span>
                  <strong className="overview-metric-value">
                    {fmtCurrency(ownerMoneyTotals.invoiceRevenue, 'PKR')}
                  </strong>
                  <span className="overview-metric-hint muted">Sum of invoices · matches status filter</span>
                </div>
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

              <div className="connection-panel overview-panel" style={{ marginBottom: '1.5rem' }}>
                <h3 className="overview-subtitle" style={{ marginBottom: '1rem' }}>Platform Revenue Trend (Last 7 Days)</h3>
                <div style={{ height: '300px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={ownerRevenueTrend}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorOwnerRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis 
                        dataKey="label" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        tickFormatter={(val) => `PKR ${val > 1000 ? (val / 1000).toFixed(1) + 'k' : val}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: 'none',
                          borderRadius: '8px',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                          padding: '12px',
                        }}
                        itemStyle={{ color: '#fff' }}
                        labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                        formatter={(value: any) => [fmtCurrency(Number(value || 0), 'PKR'), 'Revenue']}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#10b981"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorOwnerRevenue)"
                        animationDuration={2000}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="connection-panel overview-panel overview-tenant-list-panel">
                <h3 className="overview-subtitle" style={{ marginBottom: '0.65rem' }}>
                  Businesses
                </h3>
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        {OWNER_TENANT_TABLE_SORT_HEADERS.map(({ col, label }) => {
                          const active = ownerTenantSortColumn === col;
                          return (
                            <th
                              key={col}
                              scope="col"
                              className="data-th-sortable"
                              aria-sort={
                                active
                                  ? ownerTenantSortDir === 'asc'
                                    ? 'ascending'
                                    : 'descending'
                                  : 'none'
                              }
                            >
                              <button
                                type="button"
                                className={`data-sort-btn${active ? ' data-sort-btn--active' : ''}`}
                                onClick={() => handleOwnerTenantColumnSort(col)}
                              >
                                {label}
                                {active ? (
                                  <span className="data-sort-btn__arrow" aria-hidden>
                                    {ownerTenantSortDir === 'asc' ? '↑' : '↓'}
                                  </span>
                                ) : null}
                              </button>
                            </th>
                          );
                        })}
                        <th scope="col" style={{ width: '100px' }}>
                          <span className="data-th-static"> </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tenantStats.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="muted" style={{ textAlign: 'center', padding: '1.5rem' }}>
                            No tenants match the selected filters.
                          </td>
                        </tr>
                      ) : (
                        tenantStats.map((row) => (
                          <tr
                            key={row.id}
                            onClick={() => {
                              navigate(`/app/businesses/${row.id}`);
                            }}
                          >
                            <td>
                              <strong>{row.businessName}</strong>
                            </td>
                            <td>
                              <code style={{ fontSize: '0.75rem' }}>{row.tenantId}</code>
                            </td>
                            <td>{row.locations}</td>
                            <td>{row.bookings}</td>
                            <td>{row.invoices}</td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <Link to={`/app/businesses/${row.id}`} className="action-link">
                                View
                              </Link>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="connection-panel overview-panel" style={{ marginTop: '1.5rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.6rem',
                    marginBottom: '0.65rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <h3 className="overview-subtitle" style={{ margin: 0 }}>
                    Recent Platform Bookings
                  </h3>
                  <Link
                    to="/app/bookings"
                    className="action-link"
                    style={{ fontSize: '0.85rem' }}
                  >
                    View all bookings
                  </Link>
                </div>
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>User / Customer</th>
                        <th>Business</th>
                        <th>Sport</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ownerAllBookings.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="muted"
                            style={{ textAlign: 'center', padding: '1.5rem' }}
                          >
                            No recent bookings.
                          </td>
                        </tr>
                      ) : (
                        ownerAllBookings.slice(0, 10).map((bk) => {
                          const bizMatch = businesses.find((b) => b.tenantId === bk.tenantId);
                          const userName = bk.user?.fullName || 'Unknown User';
                          const userEmail = bk.user?.email || bk.userId?.slice(0, 8) || '??';
                          return (
                            <tr
                              key={bk.bookingId}
                              onClick={() => navigate(`/app/bookings/${bk.bookingId}/edit`)}
                            >
                              <td>{bk.bookingDate}</td>
                              <td>
                                <div>
                                  <strong>{userName}</strong>
                                </div>
                                <div className="muted" style={{ fontSize: '0.75rem' }}>
                                  {userEmail}
                                </div>
                              </td>
                              <td>{bizMatch?.businessName || bk.tenantId?.slice(0, 8) || '??'}</td>
                              <td>
                                <span className={badgeClass(bk.sportType)}>
                                  {titleCase(bk.sportType)}
                                </span>
                              </td>
                              <td>
                                <strong>
                                  {fmtCurrency(
                                    bk.pricing?.totalAmount || 0,
                                    bk.items?.[0]?.currency,
                                  )}
                                </strong>
                              </td>
                              <td>
                                <span className={badgeClass(bk.bookingStatus)}>
                                  {titleCase(bk.bookingStatus)}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tenant-scoped dashboard (business admin / staff, not platform owner) ── */}
      {showTenantDashboard && (
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

                {/* Average Value */}
                <div className="overview-metric-card biz-kpi-card">
                  <span className="overview-metric-label">Average Value</span>
                  <strong className="overview-metric-value biz-kpi-value">
                    {fmtCurrency(Math.round(locationFilteredBookings.length > 0 ? kpis.monthRevenue / Math.max(1, kpis.monthCount) : 0), kpis.currency)}
                  </strong>
                  <span className="biz-kpi-trend muted">Per booking this month</span>
                </div>

                {/* Peak Day */}
                <div className="overview-metric-card biz-kpi-card">
                  <span className="overview-metric-label">Peak Activity</span>
                  <strong className="overview-metric-value biz-kpi-value">Today</strong>
                  <span className="biz-kpi-trend ok">{kpis.todayCount} bookings</span>
                </div>
              </div>




              <div className="overview-mosaic-grid">
                <div className="mosaic-pies-pair">
                  <article className="overview-mosaic-card mosaic-card--eq">
                    <header className="mosaic-header">
                      <h4>Bookings by sport</h4>
                      <span className="muted small">Activity distribution</span>
                    </header>
                    <div className="mosaic-content mosaic-content--chart" style={{ flex: 1 }}>
                      <div className="mosaic-recharts-wrap">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={sportChartStats}
                              cx="50%"
                              cy="50%"
                              innerRadius="55%"
                              outerRadius="75%"
                              paddingAngle={5}
                              dataKey="count"
                              animationDuration={1000}
                            >
                              {sportChartStats.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={SPORT_COLORS[entry.sport] || SPORT_COLORS.other} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                              itemStyle={{ color: '#fff' }}
                              formatter={(value: any) => [value, 'Bookings']}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="mosaic-donut-center">
                          <strong>{locationFilteredBookings.length}</strong>
                          <span>Total</span>
                        </div>
                      </div>
                      <div className="mosaic-legend-grid">
                        {sportChartStats.map((row: any) => (
                          <div key={row.sport} className="mosaic-legend-pill">
                            <span className="mosaic-legend-swatch" style={{ backgroundColor: SPORT_COLORS[row.sport] || SPORT_COLORS.other }} />
                            <span className="mosaic-legend-name">{titleCase(row.sport)}</span>
                            <span className="mosaic-legend-val">{row.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>

                  <div className="mosaic-divider mosaic-divider--pies-pair" aria-hidden />

                  <article className="overview-mosaic-card mosaic-card--eq">
                    <header className="mosaic-header">
                      <h4>Booking from</h4>
                      <span className="muted small">Source analytics</span>
                    </header>
                    <div className="mosaic-content mosaic-content--chart" style={{ flex: 1 }}>
                      <div className="mosaic-recharts-wrap">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={sourceChartStats}
                              cx="50%"
                              cy="50%"
                              innerRadius="55%"
                              outerRadius="75%"
                              paddingAngle={5}
                              dataKey="count"
                              animationDuration={1200}
                            >
                              {sourceChartStats.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={SOURCE_COLORS[entry.source] || '#64748b'} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                              itemStyle={{ color: '#fff' }}
                              formatter={(value: any) => [value, 'Bookings']}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="mosaic-donut-center">
                          <strong>{sourceChartStats.reduce((s, r) => s + r.count, 0)}</strong>
                          <span>Sources</span>
                        </div>
                      </div>
                      <div className="mosaic-legend-grid">
                        {sourceChartStats.map((row: any) => (
                          <div key={row.source} className="mosaic-legend-pill">
                            <span className="mosaic-legend-swatch" style={{ backgroundColor: SOURCE_COLORS[row.source] || '#64748b' }} />
                            <span className="mosaic-legend-name">{bookingFromLabel(row.source)}</span>
                            <span className="mosaic-legend-val">{row.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>
                </div>

                <article className="overview-mosaic-card mosaic-card--revenue-trend">
                  <header className="mosaic-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4>Revenue trend</h4>
                      <span className="muted small">Daily totals</span>
                    </div>
                    <div className="filter-chip-row" style={{ gap: '0.25rem' }}>
                      {[
                        { value: '7', label: '7D' },
                        { value: '30', label: '30D' },
                        { value: '90', label: '90D' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`filter-chip ${tenantDateRange === opt.value ? 'filter-chip--active' : ''}`}
                          style={{ padding: '0.15rem 0.45rem', fontSize: '0.65rem' }}
                          onClick={() => setTenantDateRange(opt.value as typeof tenantDateRange)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </header>
                  <div className="mosaic-content mosaic-content--revenue-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={revenueTrend}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis 
                          dataKey="label" 
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#94a3b8', fontSize: 11 }}
                          dy={10}
                          interval={tenantDateRange === '7' ? 0 : tenantDateRange === '30' ? 6 : 14}
                        />
                        <YAxis 
                          hide={true} 
                          domain={['auto', 'auto']}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1e293b',
                            border: 'none',
                            borderRadius: '8px',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                            padding: '8px 12px',
                          }}
                          itemStyle={{ color: '#fff', fontSize: '12px' }}
                          labelStyle={{ color: '#94a3b8', fontSize: '10px', marginBottom: '4px' }}
                          formatter={(value: any) => [fmtCurrency(Number(value || 0), kpis.currency), 'Revenue']}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#8b5cf6"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorRevenue)"
                          animationDuration={1500}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </article>

              </div>
            </>
          )}
        </div>
      )}

      {!showTenantDashboard && !isPlatformOwner && (
        <p className="muted" style={{ marginTop: '0.5rem' }}>
          Use the sidebar to view bookings, invoices, and tenant tools available for your role.
        </p>
      )}
    </div>
  );
}

