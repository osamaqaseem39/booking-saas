import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  listBusinessLocations,
  listBusinesses,
  listBookingsForTenant,
  listInvoicesForTenant,
} from '../api/saasClient';
import type { BusinessRow } from '../types/domain';

type Counts = {
  locations: number;
  users: number;
  bookings: number;
  invoices: number;
};

export default function BusinessTenantStatsPage() {
  const { businessId = '' } = useParams();
  const [business, setBusiness] = useState<BusinessRow | null>(null);
  const [counts, setCounts] = useState<Counts>({
    locations: 0,
    users: 0,
    bookings: 0,
    invoices: 0,
  });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const membershipCount = useMemo(
    () => business?.memberships?.length ?? 0,
    [business],
  );

  useEffect(() => {
    if (!businessId.trim()) return;
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const businesses = await listBusinesses();
        const selected = businesses.find((b) => b.id === businessId) ?? null;
        setBusiness(selected);
        if (!selected) {
          setCounts({ locations: 0, users: 0, bookings: 0, invoices: 0 });
          return;
        }

        const [locations, bookings, invoices] = await Promise.all([
          listBusinessLocations(),
          listBookingsForTenant(selected.tenantId),
          listInvoicesForTenant(selected.tenantId),
        ]);
        setCounts({
          locations: locations.filter((row) => row.businessId === selected.id).length,
          users: selected.memberships?.length ?? 0,
          bookings: bookings.length,
          invoices: invoices.length,
        });
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load tenant stats');
      } finally {
        setLoading(false);
      }
    })();
  }, [businessId]);

  return (
    <div>
      <Link to="/app/businesses" className="btn-ghost btn-compact">
        Back to businesses
      </Link>

      <h1 className="page-title" style={{ marginTop: '1rem' }}>
        Tenant Stats
      </h1>

      {err && <div className="err-banner">{err}</div>}

      {loading ? (
        <div className="empty-state">Loading tenant stats…</div>
      ) : (
        <>
          <div className="connection-panel" style={{ margin: 0 }}>
            <div className="detail-row">
              <span>Business</span>
              <span>{business?.businessName ?? 'Unknown business'}</span>
            </div>
          </div>

          <div className="connection-grid" style={{ marginTop: '1rem' }}>
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>Members</h2>
              <strong style={{ fontSize: '1.25rem' }}>{membershipCount}</strong>
            </div>
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>Locations</h2>
              <strong style={{ fontSize: '1.25rem' }}>{counts.locations}</strong>
            </div>
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>Users</h2>
              <strong style={{ fontSize: '1.25rem' }}>{counts.users}</strong>
            </div>
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>Bookings</h2>
              <strong style={{ fontSize: '1.25rem' }}>{counts.bookings}</strong>
            </div>
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>Invoices</h2>
              <strong style={{ fontSize: '1.25rem' }}>{counts.invoices}</strong>
            </div>
          </div>
          {business && (
            <div className="page-actions-row">
              <Link
                to={`/app/businesses/${business.id}/edit`}
                className="btn-primary"
              >
                Edit business
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
