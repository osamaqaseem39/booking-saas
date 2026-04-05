import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getBusinessDashboardView,
  listBookingsForTenant,
  listBusinessLocations,
  listCricketCourts,
  listFutsalCourts,
  listPadelCourts,
} from '../api/saasClient';
import type { BookingRecord } from '../types/booking';
import type { BusinessDashboardView, BusinessLocationRow, NamedCourt } from '../types/domain';
import {
  computeFacilityLiveSnapshot,
  facilityTypeToCourtKind,
  type FacilityLiveType,
} from '../utils/facilityLiveStats';

type FacilityCardRow = {
  id: string;
  name: string;
  type: FacilityLiveType;
  locationId?: string | null;
  facilityStatus?: string;
  facilityIsActive?: boolean;
};

function tenantForLocation(
  loc: BusinessLocationRow | undefined,
  dashboard: BusinessDashboardView | null,
): string | null {
  if (!loc) return null;
  const fromLoc = loc.business?.tenantId?.trim();
  if (fromLoc) return fromLoc;
  const row = dashboard?.businesses.find((b) => b.businessId === loc.businessId);
  const tid = row?.tenantId?.trim();
  return tid || null;
}

export default function FacilitiesLiveViewPage() {
  const [dashboard, setDashboard] = useState<BusinessDashboardView | null>(null);
  const [locations, setLocations] = useState<BusinessLocationRow[]>([]);
  const [facilities, setFacilities] = useState<FacilityCardRow[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Recompute on-screen “now” without waiting for the next API poll */
  const [clock, setClock] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setClock((c) => c + 1), 15000);
    return () => window.clearInterval(id);
  }, []);

  const buildFacilityCards = useCallback(
    (
      futsalCourtRows: NamedCourt[],
      cricketCourtRows: NamedCourt[],
      padelRows: NamedCourt[],
    ): FacilityCardRow[] => {
      return [
        ...futsalCourtRows.map((r) => ({
          id: r.id,
          name: r.name,
          type: 'futsalCourt' as const,
          locationId: r.businessLocationId,
          facilityStatus: r.courtStatus,
          facilityIsActive: r.isActive,
        })),
        ...cricketCourtRows.map((r) => ({
          id: r.id,
          name: r.name,
          type: 'cricketCourt' as const,
          locationId: r.businessLocationId,
          facilityStatus: r.courtStatus,
          facilityIsActive: r.isActive,
        })),
        ...padelRows.map((r) => ({
          id: r.id,
          name: r.name,
          type: 'padel' as const,
          locationId: r.businessLocationId,
          facilityStatus: r.courtStatus,
          facilityIsActive: r.isActive,
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
        const [dash, locs, fcRows, ccRows, padelRows] = await Promise.all([
          getBusinessDashboardView(),
          listBusinessLocations(),
          listFutsalCourts(),
          listCricketCourts(),
          listPadelCourts(),
        ]);
        setDashboard(dash);
        setLocations(locs);
        const facilityRows = buildFacilityCards(fcRows, ccRows, padelRows);
        setFacilities(facilityRows);

        const tenantSet = new Set<string>();
        const locById = new Map(locs.map((l) => [l.id, l]));
        for (const f of facilityRows) {
          const loc = f.locationId ? locById.get(f.locationId) : undefined;
          const tid = tenantForLocation(loc, dash);
          if (tid) tenantSet.add(tid);
        }
        const tenantList = [...tenantSet];
        const bookingLists = await Promise.all(
          tenantList.map((tid) =>
            listBookingsForTenant(tid).catch(() => [] as BookingRecord[]),
          ),
        );
        setBookings(bookingLists.flat());
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

  const filteredFacilities = useMemo(() => {
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

  const facilitySnapshots = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeFacilityLiveSnapshot>>();
    const now = new Date();
    for (const facility of filteredFacilities) {
      const kind = facilityTypeToCourtKind(facility.type);
      const cardId = `${facility.type}-${facility.id}`;
      const isActive = facility.facilityIsActive !== false;
      map.set(
        cardId,
        computeFacilityLiveSnapshot(bookings, kind, facility.id, {
          now,
          facilityActive: isActive,
          facilityStatus: facility.facilityStatus,
        }),
      );
    }
    return map;
  }, [bookings, clock, filteredFacilities]);

  const typeLabel = (t: FacilityCardRow['type']) =>
    t === 'futsalCourt' ? 'Futsal' : t === 'cricketCourt' ? 'Cricket' : 'Padel';

  return (
    <div className="owner-live-view">
      <div className="owner-live-head">
        <div>
          <h1 className="page-title" style={{ marginBottom: '0.35rem' }}>
            Facilities live
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            Box view per facility: current session, next slot, and booked hours. Refreshes every
            30s.
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
          <span className="muted">Search facility / location</span>
          <input
            className="input"
            placeholder="Name, city, business, or type"
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
        <div className="empty-state">Loading facilities…</div>
      ) : (
        <div className="facilities-live-grid">
          {filteredFacilities.map((facility) => {
            const location = facility.locationId
              ? locations.find((loc) => loc.id === facility.locationId)
              : undefined;
            const business = location ? businessById.get(location.businessId) : undefined;
            const cardId = `${facility.type}-${facility.id}`;
            const snap = facilitySnapshots.get(cardId);
            const v = snap?.visualState ?? 'idle';
            const boxClass =
              v === 'live'
                ? 'facilities-live-box facilities-live-box--live'
                : v === 'soon'
                  ? 'facilities-live-box facilities-live-box--soon'
                  : v === 'inactive'
                    ? 'facilities-live-box facilities-live-box--inactive'
                    : 'facilities-live-box facilities-live-box--idle';

            return (
              <article key={cardId} className={boxClass}>
                <div className="facilities-live-box__top">
                  <div>
                    <h2 className="facilities-live-box__title">{facility.name}</h2>
                    <p className="facilities-live-box__subtitle">
                      {typeLabel(facility.type)}
                      {location?.name ? ` · ${location.name}` : ''}
                    </p>
                  </div>
                  {v === 'live' && (
                    <span className="facilities-live-box__pill facilities-live-box__pill--live">
                      Live
                    </span>
                  )}
                  {v === 'soon' && !snap?.ongoing && (
                    <span className="facilities-live-box__pill facilities-live-box__pill--soon">
                      Next soon
                    </span>
                  )}
                </div>

                <p className="facilities-live-box__biz muted">
                  {business?.businessName ?? '—'}
                  {location?.city ? ` · ${location.city}` : ''}
                </p>

                <div className="facilities-live-box__stats">
                  <div className="facilities-live-box__stat">
                    <span className="facilities-live-box__stat-label">Now</span>
                    <span className="facilities-live-box__stat-value">
                      {snap?.ongoing ? (
                        <>
                          <span className="facilities-live-box__emph">{snap.ongoing.label}</span>
                          <span className="muted facilities-live-box__stat-meta">
                            {' '}
                            · {snap.ongoing.booking.bookingStatus}
                          </span>
                        </>
                      ) : v === 'inactive' ? (
                        <span className="muted">Unavailable</span>
                      ) : (
                        <span className="muted">Available</span>
                      )}
                    </span>
                  </div>
                  <div className="facilities-live-box__stat">
                    <span className="facilities-live-box__stat-label">Next</span>
                    <span className="facilities-live-box__stat-value">
                      {snap?.next ? (
                        <span>{snap.next.label}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </span>
                  </div>
                  <div className="facilities-live-box__stat">
                    <span className="facilities-live-box__stat-label">Booked today</span>
                    <span className="facilities-live-box__stat-value">
                      {snap ? `${snap.hoursBookedToday} h` : '—'}
                    </span>
                  </div>
                  <div className="facilities-live-box__stat">
                    <span className="facilities-live-box__stat-label">Last 7 days</span>
                    <span className="facilities-live-box__stat-value">
                      {snap ? `${snap.hoursBookedWeek} h` : '—'}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
          {filteredFacilities.length === 0 && (
            <div className="empty-state">No facilities match your search.</div>
          )}
        </div>
      )}
    </div>
  );
}
