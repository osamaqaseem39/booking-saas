import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  deleteFacilityByCode,
  type FacilityRowCode,
} from '../api/facilityMutations';
import {
  createCricketCourt,
  createFutsalCourt,
  createPadelCourt,
  getCricketCourt,
  getFutsalCourt,
  getPadelCourt,
  listBusinessLocations,
  listCricketCourts,
  listFutsalCourts,
  listPadelCourts,
  updateFutsalCourt,
} from '../api/saasClient';
import {
  formatGamingSetupLabel,
  GAMING_SETUP_OPTIONS,
  isGamingSetupCode,
} from '../constants/gamingFacilityTypes';
import {
  CRICKET_COURT_SETUP_CODE,
  FUTSAL_COURT_SETUP_CODE,
  isCourtSetupAllowedForLocation,
} from '../constants/locationFacilityTypes';
import {
  duplicateGamingStation,
  listGamingStationsForLocation,
} from '../utils/gamingStationLocalStore';
import type { BusinessLocationRow, NamedCourt } from '../types/domain';
import {
  cricketDetailToCreateBody,
  cricketSharedBodyFromFutsalDetail,
  futsalDetailToCreateBody,
  futsalSharedBodyFromCricketDetail,
  padelDetailToCreateBody,
} from '../utils/facilityDuplicate';
import type { DashboardOutletContext } from '../layout/ConsoleLayout';

function setupPath(locationId: string, facilityCode: string) {
  return `/app/locations/${locationId}/facilities/setup/${facilityCode}`;
}

function editFacilityPath(
  locId: string,
  facilityCode: string,
  courtId: string,
) {
  return `/app/locations/${locId}/facilities/edit/${facilityCode}/${courtId}`;
}

type SetupOption = { code: string; label: string };

const SETUP_OPTIONS_BY_LOCATION_TYPE: Record<string, SetupOption[]> = {
  arena: [
    { code: FUTSAL_COURT_SETUP_CODE, label: 'Futsal pitch' },
    { code: CRICKET_COURT_SETUP_CODE, label: 'Cricket pitch' },
    { code: 'padel-court', label: 'Padel' },
  ],
  'gaming-zone': GAMING_SETUP_OPTIONS.map((o) => ({
    code: o.value,
    label: o.label,
  })),
  snooker: [],
  'table-tennis': [],
};

function hasSetupForm(code: string): boolean {
  return (
    code === FUTSAL_COURT_SETUP_CODE ||
    code === CRICKET_COURT_SETUP_CODE ||
    code === 'padel-court' ||
    isGamingSetupCode(code)
  );
}

export default function AddFacilityPage() {
  const routeLocation = useLocation();
  const [searchParams] = useSearchParams();
  const preselectedLocationId = searchParams.get('locationId')?.trim() ?? '';
  const { selectedLocationId } = useOutletContext<DashboardOutletContext>();
  const [locations, setLocations] = useState<BusinessLocationRow[]>([]);
  const topbarLocationLocked = selectedLocationId !== 'all';
  const [locationId, setLocationId] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'type' | 'name' | 'id'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [futsalCourts, setFutsalCourts] = useState<NamedCourt[]>([]);
  const [cricketCourts, setCricketCourts] = useState<NamedCourt[]>([]);
  const [padel, setPadel] = useState<NamedCourt[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dupModal, setDupModal] = useState<{
    row: {
      id: string;
      name: string;
      code: string;
      businessLocationId?: string | null;
    };
  } | null>(null);
  const [dupLinkedTwin, setDupLinkedTwin] = useState(false);

  async function reloadFacilitiesFor(locationIdArg: string, locs: BusinessLocationRow[]) {
    if (!locationIdArg) {
      setLoading(false);
      setFutsalCourts([]);
      setCricketCourts([]);
      setPadel([]);
      return;
    }
    const selected = locs.find((l) => l.id === locationIdArg);
    const locationType = selected?.locationType ?? '';
    if (locationType && locationType !== 'arena') {
      setLoading(false);
      setFutsalCourts([]);
      setCricketCourts([]);
      setPadel([]);
      return;
    }
    setLoading(true);
    try {
      const [fc, cc, pa] = await Promise.all([
        listFutsalCourts(locationIdArg),
        listCricketCourts(locationIdArg),
        listPadelCourts(locationIdArg),
      ]);
      setFutsalCourts(fc);
      setCricketCourts(cc);
      setPadel(pa);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load facilities');
      setFutsalCourts([]);
      setCricketCourts([]);
      setPadel([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const locs = await listBusinessLocations();
        setLocations(locs);
        setLocationId((id) =>
          topbarLocationLocked ? selectedLocationId : id || locs[0]?.id || '',
        );
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load locations');
        setLocations([]);
      }
    })();
  }, [selectedLocationId, topbarLocationLocked]);

  useEffect(() => {
    if (topbarLocationLocked) return;
    if (!preselectedLocationId) return;
    const exists = locations.some((loc) => loc.id === preselectedLocationId);
    if (!exists) return;
    setLocationId(preselectedLocationId);
  }, [locations, preselectedLocationId, topbarLocationLocked]);

  useEffect(() => {
    if (topbarLocationLocked) setLocationId(selectedLocationId);
  }, [selectedLocationId, topbarLocationLocked]);

  const location = useMemo(
    () => locations.find((l) => l.id === locationId),
    [locations, locationId],
  );

  useEffect(() => {
    void (async () => {
      await reloadFacilitiesFor(locationId, locations);
    })();
  }, [locationId, locations]);

  const showLocationPicker = locations.length > 1 && !topbarLocationLocked;
  const visibleSetupOptions = useMemo(() => {
    if (!location) return [];
    /** Buttons follow `location.locationType` from the API (set when the location was created). */
    const options =
      SETUP_OPTIONS_BY_LOCATION_TYPE[location.locationType ?? ''] ?? [];
    // Arena: always show futsal, cricket, and padel so owners see all three choices.
    if ((location.locationType ?? '') === 'arena') {
      return SETUP_OPTIONS_BY_LOCATION_TYPE.arena;
    }
    return options;
  }, [location]);
  const isArenaLocation = (location?.locationType ?? '') === 'arena';
  const isGamingLocation = (location?.locationType ?? '') === 'gaming-zone';

  const gamingRows = useMemo(() => {
    if (!isGamingLocation || !locationId) return [];
    return listGamingStationsForLocation(locationId).map((r) => ({
      id: r.id,
      name: r.name,
      businessLocationId: r.businessLocationId,
      type: formatGamingSetupLabel(r.setupCode),
      code: r.setupCode as FacilityRowCode,
    }));
  }, [isGamingLocation, locationId, routeLocation.pathname]);

  const allFacilities = useMemo(
    () => [
      ...futsalCourts.map((r) => ({
        ...r,
        type: 'Futsal pitch',
        code: 'futsal-court' as const,
      })),
      ...cricketCourts.map((r) => ({
        ...r,
        type: 'Cricket pitch',
        code: 'cricket-court' as const,
      })),
      ...padel.map((r) => ({ ...r, type: 'Padel court', code: 'padel-court' })),
      ...gamingRows,
    ],
    [cricketCourts, futsalCourts, padel, gamingRows],
  );

  const gamingFacilityCards = useMemo(() => {
    if (!isGamingLocation || !locationId) return [];
    const rows = listGamingStationsForLocation(locationId);
    return GAMING_SETUP_OPTIONS.map((o) => ({
      key: o.value,
      label: o.label,
      count: rows.filter((r) => r.setupCode === o.value).length,
    })).filter((c) => c.count > 0);
  }, [isGamingLocation, locationId, routeLocation.pathname]);
  const facilityTypeOptions = useMemo(
    () => Array.from(new Set(allFacilities.map((f) => f.type))).sort((a, b) => a.localeCompare(b)),
    [allFacilities],
  );

  useEffect(() => {
    if (typeFilter === 'all') return;
    if (!facilityTypeOptions.includes(typeFilter)) {
      setTypeFilter('all');
    }
  }, [facilityTypeOptions, locationId, typeFilter]);

  const filteredFacilities = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = allFacilities.filter((f) => {
      if (typeFilter !== 'all' && f.type !== typeFilter) return false;
      if (!q) return true;
      return (
        f.type.toLowerCase().includes(q) ||
        f.name.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q)
      );
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name) * dir;
      if (sortBy === 'type') return a.type.localeCompare(b.type) * dir;
      return a.id.localeCompare(b.id) * dir;
    });
  }, [allFacilities, query, sortBy, sortDir, typeFilter]);
  const availableFacilityCards = useMemo(
    () =>
      [
        { key: 'futsalCourts', label: 'Futsal pitches', count: futsalCourts.length },
        {
          key: 'cricketCourts',
          label: 'Cricket pitches',
          count: cricketCourts.length,
        },
        { key: 'padel', label: 'Padel courts', count: padel.length },
      ].filter((item) => item.count > 0),
    [cricketCourts.length, futsalCourts.length, padel.length],
  );

  async function deleteFacilityRow(row: {
    id: string;
    code: string;
    name: string;
  }) {
    const yes = window.confirm(
      `Delete facility “${row.name}”? This cannot be undone.`,
    );
    if (!yes) return;
    setDeletingId(row.id);
    setErr(null);
    try {
      await deleteFacilityByCode(
        row.code as FacilityRowCode,
        row.id,
        rowLocId || undefined,
      );
      await reloadFacilitiesFor(locationId, locations);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to delete facility');
    } finally {
      setDeletingId(null);
    }
  }

  function canOfferLinkedTwinFor(row: { code: string }) {
    if (!location || !isArenaLocation) return false;
    if (row.code === 'futsal-court') {
      return isCourtSetupAllowedForLocation(
        location,
        CRICKET_COURT_SETUP_CODE,
      );
    }
    if (row.code === 'cricket-court') {
      return isCourtSetupAllowedForLocation(
        location,
        FUTSAL_COURT_SETUP_CODE,
      );
    }
    return false;
  }

  async function confirmDuplicateFacility() {
    if (!dupModal) return;
    const row = dupModal.row;
    const businessLocationId =
      row.businessLocationId?.trim() || locationId || '';
    if (!businessLocationId) {
      setErr('Cannot duplicate: facility has no linked location.');
      return;
    }
    const withLinkedTwin = dupLinkedTwin && canOfferLinkedTwinFor(row);
    setDuplicatingId(row.id);
    setErr(null);
    try {
      if (row.code === 'padel-court') {
        const d = await getPadelCourt(row.id);
        await createPadelCourt(padelDetailToCreateBody(d, businessLocationId));
      } else if (row.code === 'futsal-court') {
        const d = await getFutsalCourt(row.id);
        const primary = await createFutsalCourt(
          futsalDetailToCreateBody(d, businessLocationId),
        );
        if (withLinkedTwin) {
          const twinCricket = await createCricketCourt(
            cricketSharedBodyFromFutsalDetail(d, businessLocationId),
          );
          await updateFutsalCourt(primary.id, {
            linkedTwinCourtKind: 'cricket_court',
            linkedTwinCourtId: twinCricket.id,
          });
        }
      } else if (row.code === 'cricket-court') {
        const d = await getCricketCourt(row.id);
        const primary = await createCricketCourt(
          cricketDetailToCreateBody(d, businessLocationId),
        );
        if (withLinkedTwin) {
          const twinFutsal = await createFutsalCourt(
            futsalSharedBodyFromCricketDetail(d, businessLocationId),
          );
          await updateFutsalCourt(twinFutsal.id, {
            linkedTwinCourtKind: 'cricket_court',
            linkedTwinCourtId: primary.id,
          });
        }
      } else if (isGamingSetupCode(row.code)) {
        duplicateGamingStation(businessLocationId, row.id);
      }
      setDupModal(null);
      await reloadFacilitiesFor(locationId, locations);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to duplicate facility');
    } finally {
      setDuplicatingId(null);
    }
  }

  return (
    <div>
      <h1 className="page-title">Facilities</h1>
      {topbarLocationLocked && location ? (
        <p className="muted" style={{ marginTop: '-0.35rem' }}>
          Top bar location filter is active: <strong>{location.name}</strong>
          {location.city ? ` · ${location.city}` : ''}.
        </p>
      ) : null}
      {err && <div className="err-banner">{err}</div>}

      {locations.length === 0 && !err ? (
        <div className="empty-state">
          Create a location first to add or manage facilities.
        </div>
      ) : null}

      {showLocationPicker ? (
        <div className="add-court-location">
          <label htmlFor="add-court-location">Location</label>
          <select
            id="add-court-location"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            {[...locations]
              .sort((a, b) =>
                a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
              )
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                  {l.city ? ` · ${l.city}` : ''}
                </option>
              ))}
          </select>
        </div>
      ) : null}

      {!showLocationPicker && location ? (
        <p className="muted" style={{ marginTop: '0.75rem' }}>
          <strong>{location.name}</strong>
          {location.city ? ` · ${location.city}` : ''}
        </p>
      ) : null}

      <h3 style={{ fontSize: '1rem', marginTop: '1.25rem' }}>Add facility</h3>
      <div className="facility-setup-grid">
        {visibleSetupOptions.map((o) => {
          const canOpenSetup = hasSetupForm(o.code);
          return locationId && canOpenSetup ? (
            <Link key={o.code} to={setupPath(locationId, o.code)} className="btn-primary">
              {o.label}
            </Link>
          ) : (
            <button
              key={o.code}
              type="button"
              className="btn-primary"
              disabled
              title="Setup form for this facility type is coming soon."
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {isArenaLocation ? (
        availableFacilityCards.length > 0 ? (
          <div className="connection-grid" style={{ marginTop: '1rem' }}>
            {availableFacilityCards.map((card) => (
              <div
                key={card.key}
                className="connection-panel"
                style={{ margin: 0, padding: '0.9rem 1rem' }}
              >
                <h2>{card.label}</h2>
                <strong style={{ fontSize: '1.25rem' }}>{card.count}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="connection-panel" style={{ marginTop: '1rem' }}>
            <h2>Available facility types</h2>
            <p className="muted" style={{ marginTop: '0.45rem' }}>
              No facilities added yet for this location.
            </p>
          </div>
        )
      ) : isGamingLocation ? (
        gamingFacilityCards.length > 0 ? (
          <div className="connection-grid" style={{ marginTop: '1rem' }}>
            {gamingFacilityCards.map((card) => (
              <div
                key={card.key}
                className="connection-panel"
                style={{ margin: 0, padding: '0.9rem 1rem' }}
              >
                <h2>{card.label}</h2>
                <strong style={{ fontSize: '1.25rem' }}>{card.count}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="connection-panel" style={{ marginTop: '1rem' }}>
            <h2>Gaming stations</h2>
            <p className="muted" style={{ marginTop: '0.45rem' }}>
              No stations saved yet. Use the buttons above (stored in this browser
              until the gaming API is connected).
            </p>
          </div>
        )
      ) : (
        <div className="connection-panel" style={{ marginTop: '1rem' }}>
          <h2>Facilities for {location?.locationType ?? 'this location type'}</h2>
          <p className="muted" style={{ marginTop: '0.45rem' }}>
            Showing location-type specific facility options. Setup forms for these
            types will be available in upcoming updates.
          </p>
        </div>
      )}

      <h3 style={{ fontSize: '1rem', marginTop: '1.5rem' }}>All facilities</h3>
      <div className="connection-panel" style={{ marginTop: '0.75rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
            maxWidth: '980px',
          }}
        >
          <div>
            <label>Search facilities</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type, name, or ID"
            />
          </div>
          <div>
            <label>Filter by type</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All types</option>
              {facilityTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'type' | 'name' | 'id')}
            >
              <option value="name">Name</option>
              <option value="type">Type</option>
              <option value="id">ID</option>
            </select>
          </div>
          <div>
            <label>Order</label>
            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
          <div>
            <label>In view</label>
            <input value={String(filteredFacilities.length)} readOnly />
          </div>
        </div>
      </div>

      <div className="table-wrap">
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : filteredFacilities.length === 0 ? (
          <div className="empty-state">None yet</div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>ID</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFacilities.map((row) => {
                const rowLocId =
                  row.businessLocationId?.trim() || locationId || '';
                const canEdit = Boolean(rowLocId);
                return (
                  <tr key={row.id}>
                    <td>{row.type}</td>
                    <td>{row.name}</td>
                    <td>
                      <code style={{ fontSize: '0.7rem' }}>{row.id}</code>
                    </td>
                    <td>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '0.35rem',
                          alignItems: 'center',
                        }}
                      >
                        <Link
                          to="/app/time-slots"
                          className="btn-ghost btn-compact"
                        >
                          Time slots
                        </Link>
                        {canEdit ? (
                          <Link
                            to={editFacilityPath(
                              rowLocId,
                              row.code,
                              row.id,
                            )}
                            className="btn-ghost btn-compact"
                          >
                            Edit
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className="btn-ghost btn-compact"
                            disabled
                            title="Facility has no linked location for editing."
                          >
                            Edit
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-danger btn-compact"
                          disabled={
                            duplicatingId === row.id || deletingId === row.id
                          }
                          onClick={() => void deleteFacilityRow(row)}
                        >
                          {deletingId === row.id ? 'Deleting…' : 'Delete'}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost btn-compact"
                          disabled={
                            duplicatingId === row.id || deletingId === row.id
                          }
                          onClick={() => {
                            setDupLinkedTwin(false);
                            setDupModal({ row });
                          }}
                        >
                          Duplicate
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {dupModal ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 18, 28, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 80,
            padding: '1rem',
          }}
          role="presentation"
          onClick={() => setDupModal(null)}
        >
          <div
            className="connection-panel"
            style={{ maxWidth: '420px', width: '100%' }}
            role="dialog"
            aria-labelledby="dup-facility-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="dup-facility-title" style={{ fontSize: '1.1rem' }}>
              Duplicate facility
            </h2>
            <p className="muted" style={{ marginTop: '0.5rem' }}>
              Copies every saved field from{' '}
              <strong>{dupModal.row.name}</strong> and creates a new row as{' '}
              <strong>draft</strong> (not bookable until you set status to
              active).
            </p>
            {canOfferLinkedTwinFor(dupModal.row) ? (
              <label
                className="turf-setup-inline"
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'flex-start',
                  marginTop: '0.85rem',
                }}
              >
                <input
                  type="checkbox"
                  checked={dupLinkedTwin}
                  onChange={(e) => setDupLinkedTwin(e.target.checked)}
                />
                <span>
                  {dupModal.row.code === 'futsal-court'
                    ? 'Also create a linked cricket pitch for the same physical turf. Bookings on either side share one calendar.'
                    : 'Also create a linked futsal pitch for the same physical turf. Bookings on either side share one calendar.'}
                </span>
              </label>
            ) : null}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.5rem',
                marginTop: '1rem',
              }}
            >
              <button
                type="button"
                className="btn-ghost btn-compact"
                onClick={() => setDupModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary btn-compact"
                disabled={duplicatingId === dupModal.row.id}
                onClick={() => void confirmDuplicateFacility()}
              >
                {duplicatingId === dupModal.row.id
                  ? 'Duplicating…'
                  : 'Create duplicate'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
