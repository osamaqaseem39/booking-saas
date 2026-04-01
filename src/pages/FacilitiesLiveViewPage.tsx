import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getBusinessDashboardView,
  listBusinessLocations,
  listCricketIndoor,
  listFutsalFields,
  listPadelCourts,
  listTurfCourts,
} from '../api/saasClient';
import type { BusinessDashboardView, BusinessLocationRow, NamedCourt } from '../types/domain';

type FacilityCard = {
  id: string;
  name: string;
  type: 'turf' | 'padel' | 'futsal' | 'cricket';
  locationId?: string | null;
};

function statusClass(status: string | undefined, isActive: boolean): string {
  const s = (status ?? '').toLowerCase();
  if (s === 'active' || isActive) return 'badge badge-confirmed';
  if (s === 'inactive') return 'badge badge-cancelled';
  return 'badge badge-neutral';
}

export default function FacilitiesLiveViewPage() {
  const [dashboard, setDashboard] = useState<BusinessDashboardView | null>(null);
  const [locations, setLocations] = useState<BusinessLocationRow[]>([]);
  const [facilities, setFacilities] = useState<FacilityCard[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildFacilityCards = useCallback(
    (
      turfRows: NamedCourt[],
      padelRows: NamedCourt[],
      futsalRows: NamedCourt[],
      cricketRows: NamedCourt[],
    ): FacilityCard[] => {
      return [
        ...turfRows.map((r) => ({
          id: r.id,
          name: r.name,
          type: 'turf' as const,
          locationId: r.businessLocationId,
        })),
        ...padelRows.map((r) => ({
          id: r.id,
          name: r.name,
          type: 'padel' as const,
          locationId: r.businessLocationId,
        })),
        ...futsalRows.map((r) => ({
          id: r.id,
          name: r.name,
          type: 'futsal' as const,
          locationId: r.businessLocationId,
        })),
        ...cricketRows.map((r) => ({
          id: r.id,
          name: r.name,
          type: 'cricket' as const,
          locationId: r.businessLocationId,
        })),
      ];
    },
    [],
  );

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [dash, locs, turfRows, padelRows, futsalRows, cricketRows] = await Promise.all([
          getBusinessDashboardView(),
          listBusinessLocations(),
          listTurfCourts(),
          listPadelCourts(),
          listFutsalFields(),
          listCricketIndoor(),
        ]);
        setDashboard(dash);
        setLocations(locs);
        setFacilities(buildFacilityCards(turfRows, padelRows, futsalRows, cricketRows));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load facilities live view');
      } finally {
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
    },
    [buildFacilityCards],
  );

  useEffect(() => {
    void load(false);
    const id = window.setInterval(() => {
      void load(true);
    }, 30000);
    return () => window.clearInterval(id);
  }, [load]);

  const businessById = useMemo(() => {
    const map = new Map<string, BusinessDashboardView['businesses'][number]>();
    for (const b of dashboard?.businesses ?? []) map.set(b.businessId, b);
    return map;
  }, [dashboard]);

  const filteredLocations = useMemo(() => {
    const q = query.trim().toLowerCase();
    const locationById = new Map(locations.map((loc) => [loc.id, loc]));
    if (!q) return facilities;
    return facilities.filter((facility) => {
      const loc = facility.locationId ? locationById.get(facility.locationId) : undefined;
      const biz = loc ? businessById.get(loc.businessId) : undefined;
      return (
        facility.name.toLowerCase().includes(q) ||
        facility.type.toLowerCase().includes(q) ||
        (loc?.name ?? '').toLowerCase().includes(q) ||
        (loc?.city ?? '').toLowerCase().includes(q) ||
        (loc?.locationType ?? '').toLowerCase().includes(q) ||
        (biz?.businessName ?? '').toLowerCase().includes(q)
      );
    });
  }, [businessById, facilities, locations, query]);

  return (
    <div className="owner-live-view">
      <div className="owner-live-head">
        <div>
          <h1 className="page-title" style={{ marginBottom: '0.35rem' }}>
            Facilities Live View
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            Real-time facility cards with booking context for business owners.
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
          <Link to="/app/Facilites" className="btn-primary btn-compact">
            Manage facilities
          </Link>
        </div>
      </div>

      {error && <div className="err-banner">{error}</div>}
      <div className="connection-panel owner-live-filter-panel">
        <label>
          <span className="muted">Search facility/location</span>
          <input
            className="input"
            placeholder="Location, city, business, or type"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {dashboard && (
          <p className="muted owner-live-timestamp" style={{ marginTop: '0.2rem' }}>
            Last updated: {new Date(dashboard.generatedAt).toLocaleString()}
          </p>
        )}
      </div>

      {loading ? (
        <div className="empty-state">Loading facilities...</div>
      ) : (
        <div className="owner-live-business-grid">
          {filteredLocations.map((facility) => {
            const location = facility.locationId
              ? locations.find((loc) => loc.id === facility.locationId)
              : undefined;
            const business = location ? businessById.get(location.businessId) : undefined;
            return (
              <article key={`${facility.type}-${facility.id}`} className="owner-live-facility-card">
                <div className="owner-live-facility-head">
                  <strong>{facility.name}</strong>
                  <span
                    className={statusClass(
                      location?.status ?? undefined,
                      location?.isActive ?? false,
                    )}
                  >
                    {location?.status ?? (location?.isActive ? 'active' : 'unknown')}
                  </span>
                </div>
                <p className="muted owner-live-facility-address">
                  {business?.businessName ?? 'Unknown business'}
                </p>
                <p className="muted owner-live-facility-address">
                  {[
                    location?.name,
                    location?.area,
                    location?.city,
                    location?.country,
                  ]
                    .filter(Boolean)
                    .join(', ') || 'No location'}
                </p>
                <div className="owner-live-business-kpis">
                  <span>{facility.type}</span>
                  <span>{location?.locationType ?? 'location'}</span>
                  <span>{business?.bookingCount ?? 0} bookings</span>
                  <span>{business?.pendingBookingCount ?? 0} pending</span>
                </div>
                <p className="muted owner-live-facility-address" style={{ marginTop: 0 }}>
                  Facility ID: {facility.id}
                </p>
              </article>
            );
          })}
          {filteredLocations.length === 0 && (
            <div className="empty-state">No facilities match your search.</div>
          )}
        </div>
      )}
    </div>
  );
}
