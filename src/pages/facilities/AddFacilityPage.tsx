import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useOutletContext, useSearchParams } from 'react-router-dom';
import {
  deleteFacilityByCode,
  type FacilityRowCode,
} from '../../api/facilityMutations';
import {
  createCricketCourt,
  createFutsalCourt,
  createPadelCourt,
  getCricketCourt,
  getFutsalCourt,
  getPadelCourt,
  listBusinessLocations,
  listTurfCourts,
  listPadelCourts,
  listTableTennisCourts,
  updateFutsalCourt,
} from '../../api/saasClient';
import {
  formatGamingSetupLabel,
  GAMING_SETUP_OPTIONS,
  isGamingSetupCode,
} from '../../constants/gamingFacilityTypes';
import {
  CRICKET_COURT_SETUP_CODE,
  FUTSAL_COURT_SETUP_CODE,
  TABLE_TENNIS_COURT_SETUP_CODE,
  isCourtSetupAllowedForLocation,
} from '../../constants/locationFacilityTypes';
import {
  duplicateGamingStation,
  listGamingStationsForLocation,
} from '../../utils/gamingStationLocalStore';
import type { BusinessLocationRow, NamedCourt } from '../../types/domain';
import { useSession } from '../../context/SessionContext';
import {
  cricketDetailToCreateBody,
  cricketSharedBodyFromFutsalDetail,
  futsalDetailToCreateBody,
  futsalSharedBodyFromCricketDetail,
  padelDetailToCreateBody,
} from '../../utils/facilityDuplicate';
import type { DashboardOutletContext } from '../../layout/ConsoleLayout';

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
    { code: FUTSAL_COURT_SETUP_CODE, label: 'Turf field' },
    { code: 'padel-court', label: 'Padel' },
    { code: TABLE_TENNIS_COURT_SETUP_CODE, label: 'Table tennis' },
  ],
  'gaming-zone': GAMING_SETUP_OPTIONS.map((o) => ({
    code: o.value,
    label: o.label,
  })),
  snooker: [],
  'table-tennis': [
    { code: TABLE_TENNIS_COURT_SETUP_CODE, label: 'Table tennis table' },
  ],
};

function hasSetupForm(code: string): boolean {
  return (
    code === FUTSAL_COURT_SETUP_CODE ||
    code === CRICKET_COURT_SETUP_CODE ||
    code === 'padel-court' ||
    code === TABLE_TENNIS_COURT_SETUP_CODE ||
    isGamingSetupCode(code)
  );
}

export default function AddFacilityPage() {
  const { session } = useSession();
  const isOwner = session?.roles?.includes('platform-owner') ?? false;
  const routeLocation = useLocation();
  const [searchParams] = useSearchParams();
  const preselectedLocationId = searchParams.get('locationId')?.trim() ?? '';
  const { selectedLocationId } = useOutletContext<DashboardOutletContext>();
  const [locations, setLocations] = useState<BusinessLocationRow[]>([]);
  const topbarLocationLocked = selectedLocationId !== 'all';
  const [locationId, setLocationId] = useState('');
  const [turfCourts, setTurfCourts] = useState<NamedCourt[]>([]);
  const [padel, setPadel] = useState<NamedCourt[]>([]);
  const [tableTennis, setTableTennis] = useState<NamedCourt[]>([]);
  const [gamingStations, setGamingStations] = useState<
    Array<{
      id: string;
      name: string;
      businessLocationId: string;
      setupCode: string;
    }>
  >([]);
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
      setTurfCourts([]);
      setPadel([]);
      setTableTennis([]);
      setGamingStations([]);
      return;
    }
    const selected = locs.find((l) => l.id === locationIdArg);
    const locationType = selected?.locationType ?? '';
    if (locationType === 'gaming-zone') {
      setLoading(true);
      try {
        const rows = await listGamingStationsForLocation(locationIdArg);
        setGamingStations(
          rows.map((r) => ({
            id: r.id,
            name: r.name,
            businessLocationId: r.businessLocationId,
            setupCode: r.setupCode,
          })),
        );
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load facilities');
        setGamingStations([]);
      } finally {
        setLoading(false);
      }
      setTurfCourts([]);
      setPadel([]);
      setTableTennis([]);
      return;
    }
    if (locationType === 'table-tennis') {
      setLoading(true);
      try {
        const tt = await listTableTennisCourts(locationIdArg);
        setTableTennis(tt);
        setTurfCourts([]);
        setPadel([]);
        setGamingStations([]);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load facilities');
        setTableTennis([]);
      } finally {
        setLoading(false);
      }
      return;
    }
    if (locationType && locationType !== 'arena') {
      setGamingStations([]);
      setLoading(false);
      setTurfCourts([]);
      setPadel([]);
      setTableTennis([]);
      return;
    }
    setLoading(true);
    try {
      const [tc, pa, ttb] = await Promise.all([
        listTurfCourts(locationIdArg),
        listPadelCourts(locationIdArg),
        listTableTennisCourts(locationIdArg),
      ]);
      setTurfCourts(tc);
      setPadel(pa);
      setTableTennis(ttb);
      setGamingStations([]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load facilities');
      setTurfCourts([]);
      setPadel([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const locs = await listBusinessLocations({
          ignoreActiveTenant: isOwner,
        });
        setLocations(locs);
        setLocationId((id) =>
          topbarLocationLocked ? selectedLocationId : id || locs[0]?.id || '',
        );
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load locations');
        setLocations([]);
      }
    })();
  }, [isOwner, selectedLocationId, topbarLocationLocked]);

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
    // Arena: always show turf and padel so owners see arena sub-facilities.
    if ((location.locationType ?? '') === 'arena') {
      return SETUP_OPTIONS_BY_LOCATION_TYPE.arena;
    }
    return options;
  }, [location]);
  const isArenaLocation = (location?.locationType ?? '') === 'arena';
  const isGamingLocation = (location?.locationType ?? '') === 'gaming-zone';
  const arenaAddButtons = useMemo(() => {
    if (!isArenaLocation || !location) {
      return { sharedArenaCode: '', hasPadel: false, hasTableTennis: false };
    }
    const hasFutsal = isCourtSetupAllowedForLocation(location, FUTSAL_COURT_SETUP_CODE);
    const hasCricket = isCourtSetupAllowedForLocation(location, CRICKET_COURT_SETUP_CODE);
    const hasPadel = isCourtSetupAllowedForLocation(location, 'padel-court');
    const hasTableTennis = isCourtSetupAllowedForLocation(
      location,
      TABLE_TENNIS_COURT_SETUP_CODE,
    );
    return {
      sharedArenaCode: hasFutsal
        ? FUTSAL_COURT_SETUP_CODE
        : hasCricket
          ? CRICKET_COURT_SETUP_CODE
          : '',
      hasPadel,
      hasTableTennis,
    };
  }, [isArenaLocation, location]);

  const gamingRows = useMemo(() => {
    if (!isGamingLocation || !locationId) return [];
    return gamingStations.map((r) => ({
      id: r.id,
      name: r.name,
      businessLocationId: r.businessLocationId,
      type: formatGamingSetupLabel(r.setupCode),
      code: r.setupCode as FacilityRowCode,
    }));
  }, [gamingStations, isGamingLocation, locationId, routeLocation.pathname]);

  const allFacilities = useMemo(() => {
    const list = [
      ...turfCourts.map((r) => ({
        ...r,
        type: 'Turf field',
        code: 'turf-court' as const,
      })),
      ...padel.map((r) => ({ ...r, type: 'Padel court', code: 'padel-court' })),
      ...tableTennis.map((r) => ({
        ...r,
        type: 'Table tennis',
        code: 'table-tennis-court' as const,
      })),
      ...gamingRows,
    ];
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [turfCourts, padel, tableTennis, gamingRows]);



  async function deleteFacilityRow(row: {
    id: string;
    code: string;
    name: string;
    businessLocationId?: string | null;
  }) {
    const yes = window.confirm(
      `Delete facility “${row.name}”? This cannot be undone.`,
    );
    if (!yes) return;
    setDeletingId(row.id);
    setErr(null);
    try {
      const rowLocId = row.businessLocationId?.trim() || locationId || '';
      const locationForTenant = locations.find((l) => l.id === rowLocId);
      const tenantIdOverride = isOwner
        ? locationForTenant?.business?.tenantId ?? ''
        : '';
      await deleteFacilityByCode(
        row.code as FacilityRowCode,
        row.id,
        rowLocId || undefined,
        tenantIdOverride,
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
      } else if (row.code === 'futsal-court' || row.code === 'turf-court') {
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
        await duplicateGamingStation(businessLocationId, row.id);
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
      <div className="facility-setup-grid" style={{ marginBottom: '1.25rem' }}>
        {isArenaLocation ? (
          <>
            {arenaAddButtons.sharedArenaCode ? (
              locationId ? (
                <Link
                  to={setupPath(locationId, arenaAddButtons.sharedArenaCode)}
                  className="btn-primary"
                >
                  Add turf
                </Link>
              ) : (
                <button type="button" className="btn-primary" disabled>
                  Add turf
                </button>
              )
            ) : null}
            {arenaAddButtons.hasPadel ? (
              locationId ? (
                <Link to={setupPath(locationId, 'padel-court')} className="btn-primary">
                  Add padel
                </Link>
              ) : (
                <button type="button" className="btn-primary" disabled>
                  Add padel
                </button>
              )
            ) : null}
            {arenaAddButtons.hasTableTennis ? (
              locationId ? (
                <Link
                  to={setupPath(locationId, TABLE_TENNIS_COURT_SETUP_CODE)}
                  className="btn-primary"
                >
                  Add table tennis
                </Link>
              ) : (
                <button type="button" className="btn-primary" disabled>
                  Add table tennis
                </button>
              )
            ) : null}
            {!arenaAddButtons.sharedArenaCode && !arenaAddButtons.hasPadel && !arenaAddButtons.hasTableTennis ? (
              <button type="button" className="btn-primary" disabled>
                No configured arena facility types
              </button>
            ) : null}
          </>
        ) : (
          visibleSetupOptions.map((o) => {
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
          })
        )}
      </div>



      <div className="table-wrap">
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : allFacilities.length === 0 ? (
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
              {allFacilities.map((row) => {
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
                  Also create a linked turf setup for the same physical turf so
                  bookings stay on one shared calendar.
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

