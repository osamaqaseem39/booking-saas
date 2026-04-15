import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  deleteFacilityByCode,
  type FacilityRowCode,
} from '../../api/facilityMutations';
import {
  listBusinessLocations,
  listCricketCourts,
  listFutsalCourts,
  listPadelCourts,
} from '../../api/saasClient';
import {
  isCourtSetupAllowedForLocation,
} from '../../constants/locationFacilityTypes';
import {
  GAMING_SETUP_OPTIONS,
  isGamingSetupAllowedForLocation,
} from '../../constants/gamingFacilityTypes';
import {
  listGamingStationsForLocation,
  type GamingStationRecord,
} from '../../utils/gamingStationLocalStore';
import type { BusinessLocationRow, NamedCourt } from '../../types/domain';
import { useSession } from '../../context/SessionContext';

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

function FacilitiesTableBlock({
  title,
  rows,
  facilityCode,
  locationId,
  onReload,
  setPageErr,
  tenantIdOverride,
}: {
  title: string;
  rows: NamedCourt[];
  facilityCode: FacilityRowCode;
  locationId: string;
  onReload: () => void;
  setPageErr: (msg: string | null) => void;
  tenantIdOverride?: string;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function removeRow(r: NamedCourt) {
    const yes = window.confirm(
      `Delete facility “${r.name}”? This cannot be undone.`,
    );
    if (!yes) return;
    setDeletingId(r.id);
    setPageErr(null);
    try {
      await deleteFacilityByCode(facilityCode, r.id, locationId, tenantIdOverride);
      onReload();
    } catch (e) {
      setPageErr(e instanceof Error ? e.message : 'Failed to delete facility');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <h3 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>{title}</h3>
      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="empty-state">None yet</div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>ID</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>
                    <code style={{ fontSize: '0.7rem' }}>{r.id}</code>
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
                        to={editFacilityPath(locationId, facilityCode, r.id)}
                        className="btn-ghost btn-compact"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        className="btn-danger btn-compact"
                        disabled={deletingId === r.id}
                        onClick={() => void removeRow(r)}
                      >
                        {deletingId === r.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function LocationFacilitiesPage() {
  const { session } = useSession();
  const isOwner = session?.roles?.includes('platform-owner') ?? false;
  const { locationId = '' } = useParams<{ locationId: string }>();
  const [locations, setLocations] = useState<BusinessLocationRow[]>([]);
  const [futsalCourts, setFutsalCourts] = useState<NamedCourt[]>([]);
  const [cricketCourts, setCricketCourts] = useState<NamedCourt[]>([]);
  const [padel, setPadel] = useState<NamedCourt[]>([]);
  const [gamingStations, setGamingStations] = useState<GamingStationRecord[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const location = useMemo(
    () => locations.find((l) => l.id === locationId),
    [locations, locationId],
  );
  const tenantIdOverride = isOwner ? location?.business?.tenantId ?? '' : '';
  const dualTurfRows = useMemo(
    () => futsalCourts.filter((r) => r.supportsCricket === true),
    [futsalCourts],
  );
  const dualTurfIds = useMemo(
    () => new Set(dualTurfRows.map((r) => r.id)),
    [dualTurfRows],
  );
  const futsalOnlyCourts = useMemo(
    () => futsalCourts.filter((r) => r.supportsCricket !== true),
    [futsalCourts],
  );
  const cricketOnlyCourts = useMemo(
    () => cricketCourts.filter((r) => !dualTurfIds.has(r.id)),
    [cricketCourts, dualTurfIds],
  );

  const arenaPrimarySetupCode = useMemo(() => {
    if (!location || location.locationType === 'gaming-zone') return '';
    if (isCourtSetupAllowedForLocation(location, 'futsal-court')) {
      return 'futsal-court';
    }
    if (isCourtSetupAllowedForLocation(location, 'cricket-court')) {
      return 'cricket-court';
    }
    if (isCourtSetupAllowedForLocation(location, 'padel-court')) {
      return 'padel-court';
    }
    return '';
  }, [location]);

  const load = () => {
    void (async () => {
      if (!locationId) return;
      setLoading(true);
      setErr(null);
      try {
        const locs = await listBusinessLocations({ ignoreActiveTenant: isOwner });
        const currentLocation = locs.find((l) => l.id === locationId);
        const currentTenantId = isOwner
          ? currentLocation?.business?.tenantId ?? ''
          : '';
        const [fc, cc, pa] = await Promise.all([
          listFutsalCourts(locationId, currentTenantId),
          listCricketCourts(locationId, currentTenantId),
          listPadelCourts(locationId, currentTenantId),
        ]);
        setLocations(locs);
        setFutsalCourts(fc);
        setCricketCourts(cc);
        setPadel(pa);
        setGamingStations(await listGamingStationsForLocation(locationId));
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  };

  useEffect(() => {
    load();
  }, [isOwner, locationId]);

  if (!locationId) {
    return <p className="muted">Missing location id.</p>;
  }

  return (
    <div>
      <div className="page-toolbar-row">
        <Link to="/app/locations" className="btn-ghost btn-compact">
          ← Locations
        </Link>
        <Link to="/app/add-facility" className="btn-ghost btn-compact">
          ← Main facility page
        </Link>
      </div>
      <h1 className="page-title">Location facilities</h1>
      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : !location ? (
        <div className="err-banner">
          Location not found or not visible for your user.
        </div>
      ) : (
        <>
          <p className="muted">
            <strong>{location.name}</strong>
            {location.city ? ` · ${location.city}` : ''}. Configure concrete
            courts here; each facility type uses the matching API setup
            shape (minimal forms below — extend via API as needed).
          </p>
          {err && <div className="err-banner">{err}</div>}

          <h3 style={{ fontSize: '1rem', marginTop: '1.25rem' }}>
            {location.locationType === 'gaming-zone'
              ? 'Add facility (setup form)'
              : 'Add field (setup form)'}
          </h3>
          <div className="facility-setup-grid">
            {(location.locationType === 'gaming-zone'
              ? GAMING_SETUP_OPTIONS.map((o) => ({
                  code: o.value,
                  label: `Add ${o.label}`,
                  allowed: isGamingSetupAllowedForLocation(location, o.value),
                }))
              : [
                  {
                    code: arenaPrimarySetupCode || 'futsal-court',
                    label: 'Add turf/padel (setup form)',
                    allowed: Boolean(arenaPrimarySetupCode),
                  },
                ]
            ).map((o) =>
              o.allowed ? (
                <Link key={o.code} to={setupPath(locationId, o.code)} className="btn-primary">
                  {o.label}
                </Link>
              ) : (
                <button
                  key={o.code}
                  type="button"
                  className="btn-primary"
                  disabled
                  title="Enable this facility type on the location first (Locations → Edit → facility types)."
                >
                  {o.label}
                </button>
              ),
            )}
          </div>

          <h3 style={{ fontSize: '1rem', marginTop: '1.5rem' }}>
            At this location
          </h3>
          {location.locationType === 'gaming-zone' ? (
            GAMING_SETUP_OPTIONS.map((o) => (
              <FacilitiesTableBlock
                key={o.value}
                title={o.label}
                rows={gamingStations.filter((s) =>
                  s.setupCode === o.value,
                ).map((s) => ({
                  id: s.id,
                  name: s.name,
                  businessLocationId: s.businessLocationId,
                }))}
                facilityCode={o.value}
                locationId={locationId}
                onReload={load}
                setPageErr={setErr}
                tenantIdOverride={tenantIdOverride}
              />
            ))
          ) : (
            <>
              {dualTurfRows.length > 0 ? (
                <FacilitiesTableBlock
                  title="Turf fields (futsal + cricket)"
                  rows={dualTurfRows}
                  facilityCode="futsal-court"
                  locationId={locationId}
                  onReload={load}
                  setPageErr={setErr}
                  tenantIdOverride={tenantIdOverride}
                />
              ) : null}
              <FacilitiesTableBlock
                title="Turf fields (futsal)"
                rows={futsalOnlyCourts}
                facilityCode="futsal-court"
                locationId={locationId}
                onReload={load}
                setPageErr={setErr}
                tenantIdOverride={tenantIdOverride}
              />
              <FacilitiesTableBlock
                title="Turf fields (cricket)"
                rows={cricketOnlyCourts}
                facilityCode="cricket-court"
                locationId={locationId}
                onReload={load}
                setPageErr={setErr}
                tenantIdOverride={tenantIdOverride}
              />
              <FacilitiesTableBlock
                title="Padel courts"
                rows={padel}
                facilityCode="padel-court"
                locationId={locationId}
                onReload={load}
                setPageErr={setErr}
                tenantIdOverride={tenantIdOverride}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

