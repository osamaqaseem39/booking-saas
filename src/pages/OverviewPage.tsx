import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  listBookingsForTenant,
  listBusinesses,
  listBusinessLocations,
  listInvoicesForTenant,
} from '../api/saasClient';
import OwnerLiveViewSection from '../components/OwnerLiveViewSection';
import { useSession } from '../context/SessionContext';
import type { BookingRecord, BookingStatus } from '../types/booking';
import type { BusinessLocationRow, BusinessRow, InvoiceRow } from '../types/domain';

export default function OverviewPage() {
  const { session, tenantId } = useSession();
  const location = useLocation();
  const roles = session?.roles ?? [];
  const isPlatformOwner = roles.includes('platform-owner');
  const isBusinessUser = roles.includes('business-admin') || roles.includes('business-staff');
  const showOwnerLive =
    roles.includes('platform-owner') || roles.includes('business-admin');

  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [locations, setLocations] = useState<BusinessLocationRow[]>([]);
  const [bookingsByTenant, setBookingsByTenant] = useState<Record<string, BookingRecord[]>>(
    {},
  );
  const [invoicesByTenant, setInvoicesByTenant] = useState<Record<string, InvoiceRow[]>>({});
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [tenantError, setTenantError] = useState<string | null>(null);
  const [tenantBusinessName, setTenantBusinessName] = useState('Your business');
  const [tenantSummary, setTenantSummary] = useState({
    businesses: 0,
    locations: 0,
    bookings: 0,
    invoices: 0,
  });
  const [dateRange, setDateRange] = useState<'7' | '30' | '90' | 'all'>('30');
  const [bookingStatus, setBookingStatus] = useState<'all' | BookingStatus>('all');
  const [invoiceStatus, setInvoiceStatus] = useState<'all' | string>('all');
  const [tenantQuery, setTenantQuery] = useState('');
  const [sortBy, setSortBy] = useState<'bookings' | 'invoices' | 'locations' | 'name'>(
    'bookings',
  );

  useEffect(() => {
    if (!isPlatformOwner) return;
    void (async () => {
      setOwnerLoading(true);
      setOwnerError(null);
      try {
        const biz = await listBusinesses();
        setBusinesses(biz);

        const loc = await listBusinessLocations();
        setLocations(loc);

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

  useEffect(() => {
    if (!isBusinessUser) return;
    if (!tenantId.trim()) {
      setTenantSummary({ businesses: 0, locations: 0, bookings: 0, invoices: 0 });
      setTenantBusinessName('Your business');
      return;
    }
    void (async () => {
      setTenantLoading(true);
      setTenantError(null);
      try {
        const [biz, loc, bookings, invoices] = await Promise.all([
          listBusinesses(),
          listBusinessLocations(),
          listBookingsForTenant(tenantId),
          listInvoicesForTenant(tenantId),
        ]);
        setTenantBusinessName(biz[0]?.businessName || 'Your business');
        setTenantSummary({
          businesses: biz.length,
          locations: loc.length,
          bookings: bookings.length,
          invoices: invoices.length,
        });
      } catch (e) {
        setTenantError(e instanceof Error ? e.message : 'Failed to load business overview');
      } finally {
        setTenantLoading(false);
      }
    })();
  }, [isBusinessUser, tenantId]);

  useEffect(() => {
    if (location.hash !== '#owner-live-dashboard') return;
    const el = document.getElementById('owner-live-dashboard');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash, showOwnerLive]);

  const invoiceStatusOptions = useMemo(() => {
    const statuses = new Set<string>();
    Object.values(invoicesByTenant).forEach((rows) => {
      rows.forEach((invoice) => statuses.add(invoice.status));
    });
    return Array.from(statuses).sort();
  }, [invoicesByTenant]);

  const tenantStats = useMemo(() => {
    const now = Date.now();
    const maxAgeMs =
      dateRange === 'all' ? Number.POSITIVE_INFINITY : Number(dateRange) * 24 * 60 * 60 * 1000;
    const query = tenantQuery.trim().toLowerCase();

    const rows = businesses
      .map((b) => {
        const tenantBookings = bookingsByTenant[b.tenantId] ?? [];
        const tenantInvoices = invoicesByTenant[b.tenantId] ?? [];
        const tenantLocations = locations.filter((l) => l.business?.tenantId === b.tenantId);

        const filteredBookings = tenantBookings.filter((booking) => {
          if (bookingStatus !== 'all' && booking.bookingStatus !== bookingStatus) return false;
          if (dateRange === 'all') return true;
          const dateValue = booking.bookingDate || booking.createdAt;
          const parsed = Date.parse(dateValue);
          if (Number.isNaN(parsed)) return false;
          return now - parsed <= maxAgeMs;
        });

        const filteredInvoices = tenantInvoices.filter((invoice) => {
          if (invoiceStatus === 'all') return true;
          return invoice.status === invoiceStatus;
        });

        return {
          id: b.id,
          businessName: b.businessName,
          tenantId: b.tenantId,
          locations: tenantLocations.length,
          bookings: filteredBookings.length,
          invoices: filteredInvoices.length,
        };
      })
      .filter((row) => {
        if (!query) return true;
        return (
          row.businessName.toLowerCase().includes(query) || row.tenantId.toLowerCase().includes(query)
        );
      });

    rows.sort((a, b) => {
      if (sortBy === 'name') return a.businessName.localeCompare(b.businessName);
      return b[sortBy] - a[sortBy];
    });

    return rows;
  }, [
    bookingStatus,
    bookingsByTenant,
    businesses,
    dateRange,
    invoiceStatus,
    invoicesByTenant,
    locations,
    sortBy,
    tenantQuery,
  ]);

  const ownerTotals = useMemo(
    () => ({
      tenants: tenantStats.length,
      locations: tenantStats.reduce((sum, row) => sum + row.locations, 0),
      bookings: tenantStats.reduce((sum, row) => sum + row.bookings, 0),
      invoices: tenantStats.reduce((sum, row) => sum + row.invoices, 0),
    }),
    [tenantStats],
  );

  return (
    <div className="overview-page">
      <h1 className="page-title">Overview</h1>
      {isBusinessUser && (
        <div className="overview-content">
          <h2 className="overview-subtitle">{tenantBusinessName}</h2>
          {tenantError && <div className="err-banner">{tenantError}</div>}
          {tenantLoading ? (
            <p className="muted">Loading your business activity…</p>
          ) : (
            <div className="overview-totals-grid">
              <div className="overview-metric-card">
                <span className="overview-metric-label">Businesses</span>
                <strong className="overview-metric-value">{tenantSummary.businesses}</strong>
              </div>
              <div className="overview-metric-card">
                <span className="overview-metric-label">Locations</span>
                <strong className="overview-metric-value">{tenantSummary.locations}</strong>
              </div>
              <div className="overview-metric-card">
                <span className="overview-metric-label">Bookings</span>
                <strong className="overview-metric-value">{tenantSummary.bookings}</strong>
              </div>
              <div className="overview-metric-card">
                <span className="overview-metric-label">Invoices</span>
                <strong className="overview-metric-value">{tenantSummary.invoices}</strong>
              </div>
            </div>
          )}
        </div>
      )}
      {isPlatformOwner && !isBusinessUser && (
        <div className="overview-content">
          <h2 className="overview-subtitle">All-tenant activity view</h2>
          {ownerError && <div className="err-banner">{ownerError}</div>}
          {ownerLoading ? (
            <p className="muted">Loading all tenants and activity…</p>
          ) : (
            <>
              <div className="connection-panel overview-panel">
                <div className="overview-filter-grid">
                  <label>
                    <span className="muted">Date range</span>
                    <select
                      className="input"
                      value={dateRange}
                      onChange={(e) => setDateRange(e.target.value as '7' | '30' | '90' | 'all')}
                    >
                      <option value="7">Last 7 days</option>
                      <option value="30">Last 30 days</option>
                      <option value="90">Last 90 days</option>
                      <option value="all">All time</option>
                    </select>
                  </label>
                  <label>
                    <span className="muted">Booking status</span>
                    <select
                      className="input"
                      value={bookingStatus}
                      onChange={(e) => setBookingStatus(e.target.value as 'all' | BookingStatus)}
                    >
                      <option value="all">All statuses</option>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="completed">Completed</option>
                      <option value="no_show">No show</option>
                    </select>
                  </label>
                  <label>
                    <span className="muted">Invoice status</span>
                    <select
                      className="input"
                      value={invoiceStatus}
                      onChange={(e) => setInvoiceStatus(e.target.value)}
                    >
                      <option value="all">All statuses</option>
                      {invoiceStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="muted">Sort by</span>
                    <select
                      className="input"
                      value={sortBy}
                      onChange={(e) =>
                        setSortBy(e.target.value as 'bookings' | 'invoices' | 'locations' | 'name')
                      }
                    >
                      <option value="bookings">Bookings</option>
                      <option value="invoices">Invoices</option>
                      <option value="locations">Locations</option>
                      <option value="name">Business name</option>
                    </select>
                  </label>
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
                        <span className="badge badge-neutral">{row.tenantId.slice(0, 8)}...</span>
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
                    <div className="muted">
                      No tenants match the selected filters.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {showOwnerLive && <OwnerLiveViewSection />}
      {!isPlatformOwner && !isBusinessUser && (
        <p className="muted" style={{ marginTop: '0.5rem' }}>
          Use the sidebar to view bookings, invoices, and tenant tools available for your role.
        </p>
      )}
    </div>
  );
}
