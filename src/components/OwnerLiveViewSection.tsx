import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBusinessDashboardView, listBusinessLocations } from '../api/saasClient';
import type { BusinessDashboardView, BusinessLocationRow } from '../types/domain';

function formatMoney(value: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function statusBadgeClass(status: string | undefined): string {
  const s = (status ?? '').toLowerCase();
  if (s === 'confirmed' || s === 'active' || s === 'paid') return 'badge badge-confirmed';
  if (s === 'pending') return 'badge badge-pending';
  if (s === 'cancelled' || s === 'inactive') return 'badge badge-cancelled';
  return 'badge badge-neutral';
}

function facilitySportClass(code: string): string {
  const normalized = code.trim().toLowerCase();
  if (normalized.includes('futsal') || normalized.includes('turf-court-futsal')) {
    return 'facility-chip--sport-futsal';
  }
  if (normalized.includes('cricket') || normalized.includes('turf-court-cricket')) {
    return 'facility-chip--sport-cricket';
  }
  if (normalized.includes('padel')) {
    return 'facility-chip--sport-padel';
  }
  return '';
}

/** Owner / admin live dashboard (30s refresh); embedded on Overview. */
export default function OwnerLiveViewSection() {
  const [dashboard, setDashboard] = useState<BusinessDashboardView | null>(null);
  const [locations, setLocations] = useState<BusinessLocationRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [dash, locs] = await Promise.all([
        getBusinessDashboardView(),
        listBusinessLocations(),
      ]);
      setDashboard(dash);
      setLocations(locs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load live owner view');
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
    const id = window.setInterval(() => {
      void load(true);
    }, 30000);
    return () => window.clearInterval(id);
  }, [load]);

  const locationsByBusiness = useMemo(() => {
    const map = new Map<string, BusinessLocationRow[]>();
    for (const loc of locations) {
      const list = map.get(loc.businessId) ?? [];
      list.push(loc);
      map.set(loc.businessId, list);
    }
    return map;
  }, [locations]);

  const filteredBusinesses = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = dashboard?.businesses ?? [];
    if (!q) return rows;
    return rows.filter(
      (row) =>
        row.businessName.toLowerCase().includes(q) ||
        row.tenantId?.toLowerCase().includes(q),
    );
  }, [dashboard, search]);

  return (
    <section
      id="owner-live-dashboard"
      className="owner-live-view owner-live-view--embedded"
      aria-labelledby="owner-live-dashboard-heading"
    >
      <div className="owner-live-head">
        <div>
          <h2 id="owner-live-dashboard-heading" className="overview-subtitle" style={{ marginBottom: '0.35rem' }}>
            Live dashboard
          </h2>
          <p className="muted" style={{ margin: 0 }}>
            Auto-refresh every 30 seconds with facility cards and booking insights.
          </p>
        </div>
        <div className="owner-live-actions">
          <button
            type="button"
            className="btn-ghost btn-compact"
            onClick={() => void load(true)}
            disabled={loading || refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh now'}
          </button>
          <Link to="/app/locations" className="btn-primary btn-compact">
            Manage locations
          </Link>
        </div>
      </div>

      {error && <div className="err-banner">{error}</div>}
      {loading && <div className="empty-state">Loading live dashboard…</div>}

      {!loading && dashboard && (
        <>
          <div className="overview-totals-grid owner-live-top-grid">
            <article className="overview-metric-card">
              <span className="overview-metric-label">Businesses</span>
              <strong className="overview-metric-value">{dashboard.scope.businessCount}</strong>
            </article>
            <article className="overview-metric-card">
              <span className="overview-metric-label">Locations</span>
              <strong className="overview-metric-value">{dashboard.scope.locationCount}</strong>
            </article>
            <article className="overview-metric-card">
              <span className="overview-metric-label">Total bookings</span>
              <strong className="overview-metric-value">{dashboard.totals.bookingCount}</strong>
            </article>
            <article className="overview-metric-card">
              <span className="overview-metric-label">Paid revenue</span>
              <strong className="overview-metric-value">
                {formatMoney(dashboard.totals.revenuePaid)}
              </strong>
            </article>
          </div>

          <div className="connection-panel owner-live-filter-panel">
            <label>
              <span className="muted">Search business</span>
              <input
                className="input"
                placeholder="Business name or tenant ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <p className="muted owner-live-timestamp">
              Last updated: {new Date(dashboard.generatedAt).toLocaleString()}
            </p>
          </div>

          <div className="owner-live-business-grid">
            {filteredBusinesses.map((business) => {
              const businessLocations = locationsByBusiness.get(business.businessId) ?? [];
              return (
                <article key={business.businessId} className="owner-live-business-card">
                  <div className="owner-live-business-head">
                    <div>
                      <h2>{business.businessName}</h2>
                      <p className="muted">{business.tenantId ?? 'No tenant'}</p>
                    </div>
                    <span className={statusBadgeClass(business.status ?? undefined)}>
                      {business.status ?? 'unknown'}
                    </span>
                  </div>

                  <div className="owner-live-business-kpis">
                    <span>{business.locationCount} locations</span>
                    <span>{business.courtCount} courts</span>
                    <span>{business.bookingCount} bookings</span>
                    <span>{formatMoney(business.revenuePaid)} paid</span>
                  </div>

                  <div className="owner-live-booking-strip">
                    <span className="badge badge-confirmed">
                      Confirmed: {business.confirmedBookingCount}
                    </span>
                    <span className="badge badge-pending">
                      Pending: {business.pendingBookingCount}
                    </span>
                    <span className="badge badge-cancelled">
                      Cancelled: {business.cancelledBookingCount}
                    </span>
                  </div>

                  <div className="owner-live-facilities">
                    {businessLocations.map((loc) => (
                      <div key={loc.id} className="owner-live-facility-card">
                        <div className="owner-live-facility-head">
                          <strong>{loc.name}</strong>
                          <span className={statusBadgeClass(loc.status ?? undefined)}>
                            {loc.status ?? (loc.isActive ? 'active' : 'inactive')}
                          </span>
                        </div>
                        <p className="muted owner-live-facility-address">
                          {[loc.area, loc.city, loc.country].filter(Boolean).join(', ') || 'No address'}
                        </p>
                        <div className="facility-chip-list">
                          {(loc.facilityTypes?.length ? loc.facilityTypes : ['general']).map((f) => (
                            <span
                              key={f}
                              className={`facility-chip ${facilitySportClass(f)}`.trim()}
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {businessLocations.length === 0 && (
                      <p className="muted">No facility locations found for this business.</p>
                    )}
                  </div>
                </article>
              );
            })}
            {filteredBusinesses.length === 0 && (
              <div className="empty-state">No businesses match your search.</div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
