import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import {
  listBookingsForTenant,
  listBusinesses,
  listBusinessLocations,
  listEndUsers,
  listIamUsers,
  listInvoicesForTenant,
} from '../api/saasClient';
import type { DashboardOutletContext } from '../layout/ConsoleLayout';
import { useSession } from '../context/SessionContext';
import type { BookingRecord, BookingStatus, PaymentStatus } from '../types/booking';
import { LOCATION_TYPE_OPTIONS } from '../constants/locationTypes';
import type {
  BusinessLocationRow,
  BusinessRow,
  IamUserRow,
  InvoiceRow,
} from '../types/domain';

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

function formatLocationTypeLabel(typeKey: string): string {
  if (typeKey === 'unknown') return 'Unknown';
  const opt = LOCATION_TYPE_OPTIONS.find((o) => o.value === typeKey);
  if (opt) return opt.label;
  return titleCase(typeKey.replace(/-/g, ' '));
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

function sortArrow(active: boolean, asc: boolean): string {
  if (!active) return '';
  return asc ? ' ↑' : ' ↓';
}

export default function OverviewPage() {
  const navigate = useNavigate();
  const { session, tenantId, setTenantId } = useSession();
  const { selectedLocationId, dashboardLocations } =
    useOutletContext<DashboardOutletContext>();

  const roles = session?.roles ?? [];
  const isPlatformOwner = roles.includes('platform-owner');
  const isBusinessUser = roles.includes('business-admin') || roles.includes('business-staff');
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
  const [dateRange, setDateRange] = useState<'7' | '30' | '90' | 'all'>('30');
  const [ownerBookingStatus, setOwnerBookingStatus] = useState<'all' | BookingStatus>('all');
  const [invoiceStatus, setInvoiceStatus] = useState<'all' | string>('all');
  const [tenantQuery, setTenantQuery] = useState('');
  const [sortBy, setSortBy] = useState<'bookings' | 'invoices' | 'locations' | 'name'>('bookings');
  const [ownerSortDir, setOwnerSortDir] = useState<'asc' | 'desc'>('desc');

  // ── Tenant-scoped dashboard (business staff / admin only) ───────────────
  const [tenantBusinessName, setTenantBusinessName] = useState('Your business');
  const [tenantBookings, setTenantBookings] = useState<BookingRecord[]>([]);
  const [tenantInvoices, setTenantInvoices] = useState<InvoiceRow[]>([]);
  const [tenantIamUsers, setTenantIamUsers] = useState<IamUserRow[]>([]);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [tenantError, setTenantError] = useState<string | null>(null);
  const [bizBookingStatus, setBizBookingStatus] = useState<'all' | BookingStatus>('all');
  const [bizPayStatus, setBizPayStatus] = useState<'all' | PaymentStatus>('all');
  const [bizListSort, setBizListSort] = useState<
    'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'status'
  >('date_desc');

  useEffect(() => {
    if (!showTenantDashboard || !tenantId.trim()) return;
    void (async () => {
      setTenantLoading(true);
      setTenantError(null);
      try {
        const [biz, bookings, invoices, iamUsers] = await Promise.all([
          listBusinesses(),
          listBookingsForTenant(tenantId),
          listInvoicesForTenant(tenantId).catch(() => [] as InvoiceRow[]),
          listIamUsers().catch(() => [] as IamUserRow[]),
        ]);
        const match = biz.find((b) => b.tenantId === tenantId);
        setTenantBusinessName(
          match?.businessName ?? biz[0]?.businessName ?? 'Your business',
        );
        setTenantBookings(bookings);
        setTenantInvoices(invoices);
        setTenantIamUsers(iamUsers);
      } catch (e) {
        setTenantError(e instanceof Error ? e.message : 'Failed to load business overview');
        setTenantInvoices([]);
        setTenantIamUsers([]);
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
        const [biz, loc, endUsers] = await Promise.all([
          listBusinesses(),
          listBusinessLocations(),
          listEndUsers().catch(() => [] as Awaited<ReturnType<typeof listEndUsers>>),
        ]);
        setBusinesses(biz);
        setOwnerLocations(loc);
        setOwnerCustomerCount(
          endUsers.filter((u) => (u.roles ?? []).some((r) => r === 'customer-end-user')).length,
        );
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

  const bizRollup = useMemo(() => {
    const currency =
      locationFilteredBookings.find((b) => b.items?.[0]?.currency)?.items?.[0]?.currency ?? 'PKR';
    const totalBookingValue = locationFilteredBookings.reduce(
      (s, b) => s + Number(b.pricing?.totalAmount ?? 0),
      0,
    );
    const totalInvoiced = tenantInvoices.reduce((s, i) => s + Number(i.amount ?? 0), 0);
    const customerAccounts = tenantIamUsers.filter((u) =>
      (u.roles ?? []).includes('customer-end-user'),
    ).length;
    return { totalBookingValue, totalInvoiced, customerAccounts, currency };
  }, [locationFilteredBookings, tenantInvoices, tenantIamUsers]);

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

  const sportChartStats = useMemo(() => {
    const order = ['futsal', 'cricket', 'padel', 'other'] as const;
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
    }));
  }, [filteredBookings]);

  const sportStackByDay = useMemo(() => {
    const days = lastNDates(7);
    const dayIndex = new Map(days.map((d, i) => [d, i]));
    const buckets = days.map(() => ({
      futsal: 0,
      cricket: 0,
      padel: 0,
      other: 0,
    }));
    for (const b of filteredBookings) {
      const day = b.bookingDate?.slice(0, 10) ?? '';
      const idx = dayIndex.get(day);
      if (idx === undefined) continue;
      const k = sportChartBucket(b.sportType);
      buckets[idx][k] += 1;
    }
    const totals = buckets.map((b) => b.futsal + b.cricket + b.padel + b.other);
    const maxDay = Math.max(1, ...totals);
    return days.map((day, i) => {
      const b = buckets[i];
      const total = totals[i];
      return {
        day,
        label: day.slice(5),
        ...b,
        total,
        trackFillPct: maxDay > 0 ? Math.max(10, Math.round((total / maxDay) * 100)) : 0,
      };
    });
  }, [filteredBookings]);

  const locationTypeBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of filteredBookings) {
      const loc = dashboardLocations.find((l) => l.id === b.arenaId);
      const key = (loc?.locationType ?? '').trim() || 'unknown';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [, c]) => s + c, 0);
    const max = entries.reduce((m, [, c]) => Math.max(m, c), 0);
    const order = entries.map(([k]) => k);
    const chartStats = entries.map(([typeKey, count], i) => ({
      typeKey,
      label: formatLocationTypeLabel(typeKey),
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
      widthPct: max > 0 ? Math.max(8, Math.round((count / max) * 100)) : 0,
      colorIndex: i % 8,
    }));
    return { chartStats, order };
  }, [filteredBookings, dashboardLocations]);

  const locationTypeStackByDay = useMemo(() => {
    const days = lastNDates(7);
    const dayIndex = new Map(days.map((d, i) => [d, i]));
    const order = locationTypeBreakdown.order;
    const keyToColor = new Map<string, number>();
    for (const r of locationTypeBreakdown.chartStats) {
      keyToColor.set(r.typeKey, r.colorIndex % 8);
    }
    if (order.length === 0) {
      return days.map((day) => ({
        day,
        label: day.slice(5),
        total: 0,
        trackFillPct: 0,
        segments: [] as { typeKey: string; n: number; colorIndex: number }[],
      }));
    }
    const dayBuckets = days.map(() => {
      const m = new Map<string, number>();
      for (const k of order) m.set(k, 0);
      return m;
    });
    for (const b of filteredBookings) {
      const day = b.bookingDate?.slice(0, 10) ?? '';
      const idx = dayIndex.get(day);
      if (idx === undefined) continue;
      const loc = dashboardLocations.find((l) => l.id === b.arenaId);
      const key = (loc?.locationType ?? '').trim() || 'unknown';
      const m = dayBuckets[idx];
      if (!m.has(key)) m.set(key, 0);
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    const totals = dayBuckets.map((m) => [...m.values()].reduce((a, b) => a + b, 0));
    const maxDay = Math.max(1, ...totals);
    return days.map((day, i) => {
      const m = dayBuckets[i];
      const total = totals[i];
      const segments = order
        .filter((k) => (m.get(k) ?? 0) > 0)
        .map((typeKey) => ({
          typeKey,
          n: m.get(typeKey) ?? 0,
          colorIndex: keyToColor.get(typeKey) ?? 0,
        }));
      return {
        day,
        label: day.slice(5),
        total,
        trackFillPct: maxDay > 0 ? Math.max(10, Math.round((total / maxDay) * 100)) : 0,
        segments,
      };
    });
  }, [filteredBookings, dashboardLocations, locationTypeBreakdown]);

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

      {isPlatformOwner && (
        <p className="muted" style={{ marginTop: '-0.35rem', marginBottom: '1rem', maxWidth: '52rem' }}>
          <strong>Overview</strong> below is <strong>platform-wide</strong> (all businesses). Use the
          top bar <strong>Active business</strong> and <strong>location</strong> only when you work
          through <Link to="/app/Facilites">Facilities</Link> or{' '}
          <Link to="/app/bookings/new">Add booking</Link>. <Link to="/app/bookings">Bookings</Link> lists
          all tenants. Open <Link to="/app/businesses">Businesses</Link> to switch tenant context or{' '}
          <strong>Scope to overview</strong> from that list.
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
                    Controls which bookings and invoices count toward each tenant card.
                  </p>
                </div>
                <div className="overview-filter-form overview-filter-form--row">
                  <div className="overview-filter-field overview-filter-field--inline">
                    <label htmlFor="ov-owner-date-range">Date window</label>
                    <select
                      id="ov-owner-date-range"
                      className="overview-select"
                      value={dateRange}
                      onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
                    >
                      <option value="7">Last 7 days</option>
                      <option value="30">Last 30 days</option>
                      <option value="90">Last 90 days</option>
                      <option value="all">All time</option>
                    </select>
                  </div>
                  <div className="overview-filter-field overview-filter-field--inline">
                    <label htmlFor="ov-owner-booking-status">Booking status</label>
                    <select
                      id="ov-owner-booking-status"
                      className="overview-select"
                      value={ownerBookingStatus}
                      onChange={(e) =>
                        setOwnerBookingStatus(e.target.value as typeof ownerBookingStatus)
                      }
                    >
                      <option value="all">All statuses</option>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="completed">Completed</option>
                      <option value="no_show">No show</option>
                    </select>
                  </div>
                  <div className="overview-filter-field overview-filter-field--inline">
                    <label htmlFor="ov-owner-invoice-status">Invoice status</label>
                    <select
                      id="ov-owner-invoice-status"
                      className="overview-select"
                      value={invoiceStatus}
                      onChange={(e) => setInvoiceStatus(e.target.value)}
                    >
                      <option value="all">All invoice statuses</option>
                      {invoiceStatusOptions.map((s) => (
                        <option key={s} value={s}>
                          {titleCase(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="overview-filter-field overview-filter-field--inline overview-filter-field--sort">
                    <span className="overview-filter-field-label" id="ov-owner-sort-label">
                      Sort
                    </span>
                    <div className="overview-sort-inline">
                      <select
                        id="ov-owner-sort-by"
                        className="overview-select"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                        aria-labelledby="ov-owner-sort-label"
                      >
                        <option value="bookings">By bookings</option>
                        <option value="invoices">By invoices</option>
                        <option value="locations">By locations</option>
                        <option value="name">By business name</option>
                      </select>
                      <button
                        type="button"
                        className="overview-sort-dir-btn"
                        title={ownerSortDir === 'desc' ? 'Descending (high → low)' : 'Ascending (low → high)'}
                        aria-label={
                          ownerSortDir === 'desc' ? 'Switch to ascending order' : 'Switch to descending order'
                        }
                        onClick={() => setOwnerSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                      >
                        {ownerSortDir === 'desc' ? '↓' : '↑'}
                      </button>
                    </div>
                  </div>
                  <div className="overview-filter-field overview-filter-field--inline overview-filter-field--search">
                    <label htmlFor="ov-owner-tenant-search">Search</label>
                    <input
                      id="ov-owner-tenant-search"
                      placeholder="Name or tenant ID…"
                      value={tenantQuery}
                      onChange={(e) => setTenantQuery(e.target.value)}
                    />
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

              <div className="connection-panel overview-panel overview-tenant-list-panel">
                <h3 className="overview-subtitle" style={{ marginBottom: '0.65rem' }}>
                  Businesses
                </h3>
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Business</th>
                        <th>Tenant ID</th>
                        <th>Locations</th>
                        <th>Bookings</th>
                        <th>Invoices</th>
                        <th style={{ width: '100px' }}> </th>
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
                              setTenantId(row.tenantId);
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
              </div>

              <div className="overview-totals-grid biz-kpi-grid overview-rollup-grid">
                <div className="overview-metric-card biz-kpi-card">
                  <span className="overview-metric-label">Customer accounts</span>
                  <strong className="overview-metric-value biz-kpi-value">
                    {bizRollup.customerAccounts}
                  </strong>
                  <span className="biz-kpi-trend biz-kpi-trend--flat">
                    IAM users with customer role (tenant)
                  </span>
                </div>
                <div className="overview-metric-card biz-kpi-card biz-kpi-card--revenue">
                  <span className="overview-metric-label">Total booking value</span>
                  <strong className="overview-metric-value biz-kpi-value">
                    {fmtCurrency(bizRollup.totalBookingValue, bizRollup.currency)}
                  </strong>
                  <span className="biz-kpi-trend biz-kpi-trend--flat">
                    Sum of booking totals · current location scope
                  </span>
                </div>
                <div className="overview-metric-card biz-kpi-card biz-kpi-card--revenue">
                  <span className="overview-metric-label">Total invoiced</span>
                  <strong className="overview-metric-value biz-kpi-value">
                    {fmtCurrency(bizRollup.totalInvoiced, bizRollup.currency)}
                  </strong>
                  <span className="biz-kpi-trend biz-kpi-trend--flat">
                    All invoices for this tenant
                  </span>
                </div>
              </div>

              <div className="overview-filter-card connection-panel biz-filter-panel">
                <div className="overview-filter-card-head">
                  <h3 className="overview-filter-card-title">Booking list filters</h3>
                  <p className="overview-filter-card-desc muted">
                    Narrow the table below. Location scope uses the pills in the top bar.
                  </p>
                </div>
                <div className="overview-filter-toolbar overview-filter-toolbar--row">
                  <div className="overview-filter-field overview-filter-field--inline">
                    <label htmlFor="ov-biz-booking-status">Booking status</label>
                    <select
                      id="ov-biz-booking-status"
                      className="overview-select"
                      value={bizBookingStatus}
                      onChange={(e) =>
                        setBizBookingStatus(e.target.value as typeof bizBookingStatus)
                      }
                    >
                      <option value="all">All statuses</option>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="no_show">No show</option>
                    </select>
                  </div>
                  <div className="overview-filter-field overview-filter-field--inline">
                    <label htmlFor="ov-biz-pay-status">Payment status</label>
                    <select
                      id="ov-biz-pay-status"
                      className="overview-select"
                      value={bizPayStatus}
                      onChange={(e) => setBizPayStatus(e.target.value as typeof bizPayStatus)}
                    >
                      <option value="all">All payments</option>
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="failed">Failed</option>
                      <option value="refunded">Refunded</option>
                    </select>
                  </div>
                  <div className="overview-filter-toolbar-meta">
                    <span className="overview-result-pill">
                      {sortedFilteredBookings.length} / {locationFilteredBookings.length} bookings
                    </span>
                    {selectedLocationId !== 'all' && (
                      <span className="overview-scope-pill">
                        {dashboardLocations.find((l) => l.id === selectedLocationId)?.name ?? 'Location'}
                      </span>
                    )}
                  </div>
                </div>
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
                <span className="muted" style={{ fontSize: '0.8rem' }}>
                  Click Date / Amount / Booking headings to sort
                </span>
              </div>
              <div className="table-wrap" style={{ marginTop: '1rem' }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th
                        style={{ cursor: 'pointer' }}
                        onClick={() =>
                          setBizListSort((cur) =>
                            cur === 'date_desc' ? 'date_asc' : 'date_desc',
                          )
                        }
                      >
                        Date
                        {sortArrow(
                          bizListSort === 'date_asc' || bizListSort === 'date_desc',
                          bizListSort === 'date_asc',
                        )}
                      </th>
                      <th>Sport</th>
                      <th>Location</th>
                      <th
                        style={{ cursor: 'pointer' }}
                        onClick={() =>
                          setBizListSort((cur) =>
                            cur === 'amount_desc' ? 'amount_asc' : 'amount_desc',
                          )
                        }
                      >
                        Amount
                        {sortArrow(
                          bizListSort === 'amount_asc' || bizListSort === 'amount_desc',
                          bizListSort === 'amount_asc',
                        )}
                      </th>
                      <th
                        style={{ cursor: 'pointer' }}
                        onClick={() =>
                          setBizListSort((cur) =>
                            cur === 'status' ? 'date_desc' : 'status',
                          )
                        }
                      >
                        Booking
                        {sortArrow(bizListSort === 'status', true)}
                      </th>
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
                  Sport, location type, and booking-from (walk-in / app / call), plus last 7 days trends —
                  all respect the booking list filters above.
                </p>
                <div className="overview-chart-grid">
                  <article className="overview-chart-card">
                    <h4>Bookings by sport</h4>
                    <div className="overview-source-bars">
                      {sportChartStats.map((row) => (
                        <div key={row.sport} className="overview-source-row">
                          <span className="overview-source-label">{titleCase(row.sport)}</span>
                          <div className="overview-source-track">
                            <div
                              className={`overview-sport-bar-fill overview-sport-bar-fill--${row.sport}`}
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

                  <article className="overview-chart-card overview-chart-card--wide">
                    <h4>Sport mix by day (last 7 days)</h4>
                    <p className="muted" style={{ margin: '0 0 0.5rem', fontSize: '0.76rem' }}>
                      Each column is one day; stack height is total bookings that day; colors are sport
                      share.
                    </p>
                    <div className="overview-sport-stack-wrap">
                      {sportStackByDay.map((d) => (
                        <div key={d.day} className="overview-sport-stack-col">
                          <div
                            className="overview-sport-stack-track"
                            style={{ height: '120px' }}
                            title={`${d.day}: ${d.total} bookings`}
                          >
                            <div
                              className="overview-sport-stack-inner"
                              style={{ height: `${d.trackFillPct}%` }}
                            >
                              {d.total === 0 ? (
                                <div className="overview-sport-stack-empty" />
                              ) : (
                                (
                                  [
                                    ['futsal', d.futsal],
                                    ['cricket', d.cricket],
                                    ['padel', d.padel],
                                    ['other', d.other],
                                  ] as const
                                )
                                  .filter(([, n]) => n > 0)
                                  .map(([sport, n]) => (
                                    <div
                                      key={sport}
                                      className={`overview-sport-seg overview-sport-seg--${sport}`}
                                      style={{ flex: n }}
                                      title={`${titleCase(sport)}: ${n}`}
                                    />
                                  ))
                              )}
                            </div>
                          </div>
                          <span className="overview-sport-stack-day-label">{d.label}</span>
                        </div>
                      ))}
                    </div>
                    <div className="overview-sport-legend" aria-hidden="true">
                      <span>
                        <span className="overview-sport-legend-swatch overview-sport-legend-swatch--futsal" />{' '}
                        Futsal
                      </span>
                      <span>
                        <span className="overview-sport-legend-swatch overview-sport-legend-swatch--cricket" />{' '}
                        Cricket
                      </span>
                      <span>
                        <span className="overview-sport-legend-swatch overview-sport-legend-swatch--padel" />{' '}
                        Padel
                      </span>
                      <span>
                        <span className="overview-sport-legend-swatch overview-sport-legend-swatch--other" />{' '}
                        Other
                      </span>
                    </div>
                  </article>

                  <article className="overview-chart-card">
                    <h4>Bookings by location type</h4>
                    <p className="muted" style={{ margin: '0 0 0.5rem', fontSize: '0.76rem' }}>
                      Uses each location&apos;s type (arena, gaming zone, …). Bookings without a matching
                      location count as Unknown.
                    </p>
                    <div className="overview-source-bars">
                      {locationTypeBreakdown.chartStats.length === 0 ? (
                        <p className="muted" style={{ margin: 0, fontSize: '0.82rem' }}>
                          No bookings in the current filter.
                        </p>
                      ) : (
                        locationTypeBreakdown.chartStats.map((row) => (
                          <div
                            key={row.typeKey}
                            className="overview-source-row overview-source-row--location-type"
                          >
                            <span className="overview-source-label" title={row.typeKey}>
                              {row.label}
                            </span>
                            <div className="overview-source-track">
                              <div
                                className={`overview-loc-type-fill overview-loc-type-fill--${row.colorIndex % 8}`}
                                style={{ width: `${row.widthPct}%` }}
                              />
                            </div>
                            <span className="overview-source-value">
                              {row.count} ({row.pct}%)
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </article>

                  <article className="overview-chart-card overview-chart-card--wide">
                    <h4>Location type mix by day (last 7 days)</h4>
                    <p className="muted" style={{ margin: '0 0 0.5rem', fontSize: '0.76rem' }}>
                      Each column is one day; stack height is total bookings; colors are location types.
                    </p>
                    <div className="overview-sport-stack-wrap">
                      {locationTypeStackByDay.map((d) => (
                        <div key={d.day} className="overview-sport-stack-col">
                          <div
                            className="overview-sport-stack-track"
                            style={{ height: '120px' }}
                            title={`${d.day}: ${d.total} bookings`}
                          >
                            <div
                              className="overview-sport-stack-inner"
                              style={{ height: `${d.trackFillPct}%` }}
                            >
                              {d.total === 0 ? (
                                <div className="overview-sport-stack-empty" />
                              ) : (
                                d.segments.map((seg) => (
                                  <div
                                    key={seg.typeKey}
                                    className={`overview-loc-type-seg overview-loc-type-seg--${seg.colorIndex % 8}`}
                                    style={{ flex: seg.n }}
                                    title={`${formatLocationTypeLabel(seg.typeKey)}: ${seg.n}`}
                                  />
                                ))
                              )}
                            </div>
                          </div>
                          <span className="overview-sport-stack-day-label">{d.label}</span>
                        </div>
                      ))}
                    </div>
                    {locationTypeBreakdown.chartStats.length > 0 ? (
                      <div className="overview-sport-legend" aria-hidden="true">
                        {locationTypeBreakdown.chartStats.map((row) => (
                          <span key={row.typeKey}>
                            <span
                              className={`overview-loc-type-legend-swatch overview-loc-type-legend-swatch--${row.colorIndex % 8}`}
                            />{' '}
                            {row.label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </article>

                  <article className="overview-chart-card">
                    <h4>Booking from</h4>
                    <p className="muted" style={{ margin: '0 0 0.5rem', fontSize: '0.76rem' }}>
                      Walk-in, app, or call — parsed from booking notes when the booking was created.
                    </p>
                    <div className="overview-source-bars">
                      {sourceChartStats.map((row) => (
                        <div key={row.source} className="overview-source-row">
                          <span className="overview-source-label">{bookingFromLabel(row.source)}</span>
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
                  Booking from — this month vs last month
                </h3>
                <div className="biz-source-grid">
                  {sourceStats.map((row) => (
                    <div key={row.source} className="biz-source-card">
                      <strong>{bookingFromLabel(row.source)}</strong>
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

      {!showTenantDashboard && !isPlatformOwner && (
        <p className="muted" style={{ marginTop: '0.5rem' }}>
          Use the sidebar to view bookings, invoices, and tenant tools available for your role.
        </p>
      )}
    </div>
  );
}
