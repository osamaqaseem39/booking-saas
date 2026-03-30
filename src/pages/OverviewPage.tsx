import { useEffect, useMemo, useState } from 'react';
import {
  listBookingsForTenant,
  listBusinesses,
  listBusinessLocations,
  listInvoicesForTenant,
} from '../api/saasClient';
import { useSession } from '../context/SessionContext';
import type { BookingRecord, BookingStatus } from '../types/booking';
import type { BusinessLocationRow, BusinessRow, InvoiceRow } from '../types/domain';

export default function OverviewPage() {
  const { session } = useSession();
  const isPlatformOwner = (session?.roles ?? []).includes('platform-owner');

  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [locations, setLocations] = useState<BusinessLocationRow[]>([]);
  const [bookingsByTenant, setBookingsByTenant] = useState<Record<string, BookingRecord[]>>(
    {},
  );
  const [invoicesByTenant, setInvoicesByTenant] = useState<Record<string, InvoiceRow[]>>({});
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [ownerError, setOwnerError] = useState<string | null>(null);
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
    <div>
      <h1 className="page-title">Overview</h1>
      {isPlatformOwner && (
        <div style={{ marginTop: '1rem' }}>
          <h2 style={{ marginBottom: '0.5rem' }}>All-tenant activity view</h2>
          {ownerError && <div className="err-banner">{ownerError}</div>}
          {ownerLoading ? (
            <p className="muted">Loading all tenants and activity…</p>
          ) : (
            <>
              <div className="connection-panel" style={{ marginTop: '0.5rem' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '0.75rem',
                  }}
                >
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
                <label style={{ display: 'block', marginTop: '0.75rem' }}>
                  <span className="muted">Search tenant</span>
                  <input
                    className="input"
                    placeholder="Business name or tenant ID"
                    value={tenantQuery}
                    onChange={(e) => setTenantQuery(e.target.value)}
                  />
                </label>
              </div>

              <div className="connection-panel" style={{ marginTop: '0.5rem' }}>
                <div className="detail-row">
                  <span>Tenants in view</span>
                  <span>{ownerTotals.tenants}</span>
                </div>
                <div className="detail-row">
                  <span>Locations in view</span>
                  <span>{ownerTotals.locations}</span>
                </div>
                <div className="detail-row">
                  <span>Bookings in view</span>
                  <span>{ownerTotals.bookings}</span>
                </div>
                <div className="detail-row">
                  <span>Invoices in view</span>
                  <span>{ownerTotals.invoices}</span>
                </div>
              </div>

              <div className="connection-panel" style={{ marginTop: '0.75rem' }}>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {tenantStats.map((row) => (
                    <div key={row.id} className="detail-row">
                      <span>
                        {row.businessName} ({row.tenantId.slice(0, 8)}…)
                      </span>
                      <span>
                        {row.locations} locations, {row.bookings} bookings, {row.invoices} invoices
                      </span>
                    </div>
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
      {!isPlatformOwner && (
        <p className="muted" style={{ marginTop: '0.5rem' }}>
          Use the sidebar to view bookings, invoices, and tenant tools available for your role.
        </p>
      )}
    </div>
  );
}
