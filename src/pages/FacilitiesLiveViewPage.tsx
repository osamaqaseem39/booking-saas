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

type FacilityCounts = {
  turf: number;
  padel: number;
  futsal: number;
  cricket: number;
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
  const [courtsByLocation, setCourtsByLocation] = useState<Map<string, FacilityCounts>>(new Map());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildCountMap = useCallback(
    (
      turfRows: NamedCourt[],
      padelRows: NamedCourt[],
      futsalRows: NamedCourt[],
      cricketRows: NamedCourt[],
    ) => {
      const map = new Map<string, FacilityCounts>();
      const ensure = (locationId: string | null | undefined): FacilityCounts | null => {
        if (!locationId) return null;
        const current = map.get(locationId) ?? {
          turf: 0,
          padel: 0,
          futsal: 0,
          cricket: 0,
        };
        map.set(locationId, current);
        return current;
      };
      for (const row of turfRows) {
        const next = ensure(row.businessLocationId);
        if (next) next.turf += 1;
      }
      for (const row of padelRows) {
        const next = ensure(row.businessLocationId);
        if (next) next.padel += 1;
      }
      for (const row of futsalRows) {
        const next = ensure(row.businessLocationId);
        if (next) next.futsal += 1;
      }
      for (const row of cricketRows) {
        const next = ensure(row.businessLocationId);
        if (next) next.cricket += 1;
      }
      return map;
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
        setCourtsByLocation(buildCountMap(turfRows, padelRows, futsalRows, cricketRows));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load facilities live view');
      } finally {
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
    },
    [buildCountMap],
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
    if (!q) return locations;
    return locations.filter((loc) => {
      const biz = businessById.get(loc.businessId);
      return (
        loc.name.toLowerCase().includes(q) ||
        (loc.city ?? '').toLowerCase().includes(q) ||
        (loc.locationType ?? '').toLowerCase().includes(q) ||
        (biz?.businessName ?? '').toLowerCase().includes(q)
      );
    });
  }, [businessById, locations, query]);

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
          {filteredLocations.map((loc) => {
            const counts = courtsByLocation.get(loc.id) ?? {
              turf: 0,
              padel: 0,
              futsal: 0,
              cricket: 0,
            };
            const totalCourts = counts.turf + counts.padel + counts.futsal + counts.cricket;
            const business = businessById.get(loc.businessId);
            return (
              <article key={loc.id} className="owner-live-facility-card">
                <div className="owner-live-facility-head">
                  <strong>{loc.name}</strong>
                  <span className={statusClass(loc.status ?? undefined, loc.isActive)}>
                    {loc.status ?? (loc.isActive ? 'active' : 'inactive')}
                  </span>
                </div>
                <p className="muted owner-live-facility-address">
                  {business?.businessName ?? 'Unknown business'}
                </p>
                <p className="muted owner-live-facility-address">
                  {[loc.area, loc.city, loc.country].filter(Boolean).join(', ') || 'No address'}
                </p>
                <div className="owner-live-business-kpis">
                  <span>{loc.locationType ?? 'location'}</span>
                  <span>{totalCourts} courts</span>
                  <span>{business?.bookingCount ?? 0} bookings</span>
                  <span>{business?.pendingBookingCount ?? 0} pending</span>
                </div>
                <div className="facility-chip-list">
                  <span className="facility-chip">turf: {counts.turf}</span>
                  <span className="facility-chip">padel: {counts.padel}</span>
                  <span className="facility-chip">futsal: {counts.futsal}</span>
                  <span className="facility-chip">cricket: {counts.cricket}</span>
                </div>
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
