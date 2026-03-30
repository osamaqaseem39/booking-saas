import { useEffect, useMemo, useState } from 'react';
import {
  listBookingsForTenant,
  listBusinesses,
  listBusinessLocations,
  listInvoicesForTenant,
} from '../api/saasClient';
import { useSession } from '../context/SessionContext';
import type { BookingRecord } from '../types/booking';
import type { BusinessLocationRow, BusinessRow, InvoiceRow } from '../types/domain';

export default function OverviewPage() {
  const { session, tenantId } = useSession();
  const isPlatformOwner = (session?.roles ?? []).includes('platform-owner');

  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [locations, setLocations] = useState<BusinessLocationRow[]>([]);
  const [bookingsByTenant, setBookingsByTenant] = useState<Record<string, BookingRecord[]>>(
    {},
  );
  const [invoicesByTenant, setInvoicesByTenant] = useState<Record<string, InvoiceRow[]>>({});
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [ownerError, setOwnerError] = useState<string | null>(null);

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

  const ownerTotals = useMemo(() => {
    const bookings = Object.values(bookingsByTenant).reduce(
      (sum, rows) => sum + rows.length,
      0,
    );
    const invoices = Object.values(invoicesByTenant).reduce(
      (sum, rows) => sum + rows.length,
      0,
    );
    return {
      tenants: businesses.length,
      locations: locations.length,
      bookings,
      invoices,
    };
  }, [businesses.length, bookingsByTenant, invoicesByTenant, locations.length]);

  return (
    <div>
      <h1 className="page-title">Overview</h1>
      <div className="connection-panel" style={{ margin: 0 }}>
        <div className="detail-row">
          <span>Signed in as</span>
          <span>
            {session?.fullName} ({session?.email})
          </span>
        </div>
        <div className="detail-row">
          <span>User ID</span>
          <span>{session?.id}</span>
        </div>
        <div className="detail-row">
          <span>Roles</span>
          <span>{session?.roles?.join(', ') || '—'}</span>
        </div>
        <div className="detail-row">
          <span>Active tenant</span>
          <span>{tenantId || '—'}</span>
        </div>
      </div>
      <p className="muted" style={{ marginTop: '1rem' }}>
        Platform owners also get <strong>Locations</strong> (all businesses,
        each with a <strong>location type</strong>) and{' '}
        <strong>End users</strong> (accounts with the customer role). Other
        menu items depend on your roles.
      </p>
      {isPlatformOwner && (
        <div style={{ marginTop: '1rem' }}>
          <h2 style={{ marginBottom: '0.5rem' }}>All-tenant activity view</h2>
          {ownerError && <div className="err-banner">{ownerError}</div>}
          {ownerLoading ? (
            <p className="muted">Loading all tenants and activity…</p>
          ) : (
            <>
              <div className="connection-panel" style={{ marginTop: '0.5rem' }}>
                <div className="detail-row">
                  <span>Total tenants</span>
                  <span>{ownerTotals.tenants}</span>
                </div>
                <div className="detail-row">
                  <span>Total locations</span>
                  <span>{ownerTotals.locations}</span>
                </div>
                <div className="detail-row">
                  <span>Total bookings</span>
                  <span>{ownerTotals.bookings}</span>
                </div>
                <div className="detail-row">
                  <span>Total invoices</span>
                  <span>{ownerTotals.invoices}</span>
                </div>
              </div>

              <div className="connection-panel" style={{ marginTop: '0.75rem' }}>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {businesses.map((b) => {
                    const tenantBookings = bookingsByTenant[b.tenantId] ?? [];
                    const tenantInvoices = invoicesByTenant[b.tenantId] ?? [];
                    const tenantLocations = locations.filter(
                      (l) => l.business?.tenantId === b.tenantId,
                    );
                    return (
                      <div key={b.id} className="detail-row">
                        <span>
                          {b.businessName} ({b.tenantId.slice(0, 8)}…)
                        </span>
                        <span>
                          {tenantLocations.length} locations, {tenantBookings.length} bookings,{' '}
                          {tenantInvoices.length} invoices
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
