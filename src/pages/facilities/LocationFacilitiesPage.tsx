import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  deleteFacilityByCode,
  type FacilityRowCode,
} from '../../api/facilityMutations';
import {
  createTurfTwinLink,
  listBusinessLocations,
  listCricketCourts,
  listFutsalCourts,
  listPadelCourts,
  removeTurfTwinLink,
} from '../../api/saasClient';
import {
  courtSetupOptions,
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
}: {
  title: string;
  rows: NamedCourt[];
  facilityCode: FacilityRowCode;
  locationId: string;
  onReload: () => void;
  setPageErr: (msg: string | null) => void;
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
      await deleteFacilityByCode(facilityCode, r.id, locationId);
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
  const { locationId = '' } = useParams<{ locationId: string }>();
  const [locations, setLocations] = useState<BusinessLocationRow[]>([]);
  const [futsalCourts, setFutsalCourts] = useState<NamedCourt[]>([]);
  const [cricketCourts, setCricketCourts] = useState<NamedCourt[]>([]);
  const [padel, setPadel] = useState<NamedCourt[]>([]);
  const [gamingStations, setGamingStations] = useState<GamingStationRecord[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [selectedFutsalId, setSelectedFutsalId] = useState('');
  const [selectedCricketId, setSelectedCricketId] = useState('');
  const [unlinkTarget, setUnlinkTarget] = useState('');

  const location = useMemo(
    () => locations.find((l) => l.id === locationId),
    [locations, locationId],
  );

  const load = () => {
    void (async () => {
      if (!locationId) return;
      setLoading(true);
      setErr(null);
      try {
        const [locs, fc, cc, pa] = await Promise.all([
          listBusinessLocations(),
          listFutsalCourts(locationId),
          listCricketCourts(locationId),
          listPadelCourts(locationId),
        ]);
        setLocations(locs);
        setFutsalCourts(fc);
        setCricketCourts(cc);
        setPadel(pa);
        setGamingStations(await listGamingStationsForLocation(locationId));
        setSelectedFutsalId((prev) => (prev ? prev : fc[0]?.id ?? ''));
        setSelectedCricketId((prev) => (prev ? prev : cc[0]?.id ?? ''));
        setUnlinkTarget((prev) =>
          prev ? prev : fc[0]?.id ? `futsal_court:${fc[0].id}` : cc[0]?.id ? `cricket_court:${cc[0].id}` : '',
        );
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  };

  useEffect(() => {
    load();
  }, [locationId]);

  useEffect(() => {
    if (!futsalCourts.some((c) => c.id === selectedFutsalId)) {
      setSelectedFutsalId(futsalCourts[0]?.id ?? '');
    }
  }, [futsalCourts, selectedFutsalId]);

  useEffect(() => {
    if (!cricketCourts.some((c) => c.id === selectedCricketId)) {
      setSelectedCricketId(cricketCourts[0]?.id ?? '');
    }
  }, [cricketCourts, selectedCricketId]);

  useEffect(() => {
    const [kind, id] = unlinkTarget.split(':');
    const isValid =
      (kind === 'futsal_court' && futsalCourts.some((c) => c.id === id)) ||
      (kind === 'cricket_court' && cricketCourts.some((c) => c.id === id));
    if (!isValid) {
      if (futsalCourts[0]?.id) setUnlinkTarget(`futsal_court:${futsalCourts[0].id}`);
      else if (cricketCourts[0]?.id) setUnlinkTarget(`cricket_court:${cricketCourts[0].id}`);
      else setUnlinkTarget('');
    }
  }, [futsalCourts, cricketCourts, unlinkTarget]);

  async function linkSharedTurf() {
    if (!selectedFutsalId || !selectedCricketId) return;
    setErr(null);
    setLinking(true);
    try {
      await createTurfTwinLink({
        futsalCourtId: selectedFutsalId,
        cricketCourtId: selectedCricketId,
      });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to link shared turf');
    } finally {
      setLinking(false);
    }
  }

  async function unlinkSharedTurf() {
    const [courtKind, courtId] = unlinkTarget.split(':');
    if (!courtKind || !courtId) return;
    if (courtKind !== 'futsal_court' && courtKind !== 'cricket_court') return;
    setErr(null);
    setUnlinking(true);
    try {
      await removeTurfTwinLink({ courtKind, courtId });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to unlink shared turf');
    } finally {
      setUnlinking(false);
    }
  }

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
            Add facility (setup form)
          </h3>
          <div className="facility-setup-grid">
            {(location.locationType === 'gaming-zone'
              ? GAMING_SETUP_OPTIONS.map((o) => ({
                  code: o.value,
                  label: `Add ${o.label}`,
                  allowed: isGamingSetupAllowedForLocation(location, o.value),
                }))
              : courtSetupOptions().map((o) => ({
                  code: o.code,
                  label: `Add ${o.label}`,
                  allowed: isCourtSetupAllowedForLocation(location, o.code),
                }))
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
              />
            ))
          ) : (
            <>
              <div className="table-wrap" style={{ marginBottom: '1rem' }}>
                <div style={{ padding: '0.9rem' }}>
                  <h3 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>
                    Shared turf linking (futsal + cricket)
                  </h3>
                  <p className="muted" style={{ margin: '0 0 0.75rem' }}>
                    Keep sport forms separate on frontend, but link two courts as one physical field so bookings conflict across both.
                  </p>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '0.5rem',
                      alignItems: 'end',
                    }}
                  >
                    <div>
                      <label>Futsal court</label>
                      <select
                        value={selectedFutsalId}
                        onChange={(e) => setSelectedFutsalId(e.target.value)}
                        disabled={futsalCourts.length === 0 || linking}
                      >
                        {futsalCourts.length === 0 ? (
                          <option value="">No futsal courts</option>
                        ) : (
                          futsalCourts.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                    <div>
                      <label>Cricket court</label>
                      <select
                        value={selectedCricketId}
                        onChange={(e) => setSelectedCricketId(e.target.value)}
                        disabled={cricketCourts.length === 0 || linking}
                      >
                        {cricketCourts.length === 0 ? (
                          <option value="">No cricket courts</option>
                        ) : (
                          cricketCourts.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                    <div>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => void linkSharedTurf()}
                        disabled={!selectedFutsalId || !selectedCricketId || linking}
                      >
                        {linking ? 'Linking…' : 'Link as one field'}
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: '0.75rem',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '0.5rem',
                      alignItems: 'end',
                    }}
                  >
                    <div>
                      <label>Unlink by court</label>
                      <select
                        value={unlinkTarget}
                        onChange={(e) => setUnlinkTarget(e.target.value)}
                        disabled={unlinking || (!futsalCourts.length && !cricketCourts.length)}
                      >
                        {futsalCourts.map((c) => (
                          <option key={`f:${c.id}`} value={`futsal_court:${c.id}`}>
                            Futsal — {c.name}
                          </option>
                        ))}
                        {cricketCourts.map((c) => (
                          <option key={`c:${c.id}`} value={`cricket_court:${c.id}`}>
                            Cricket — {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => void unlinkSharedTurf()}
                        disabled={!unlinkTarget || unlinking}
                      >
                        {unlinking ? 'Unlinking…' : 'Remove link'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <FacilitiesTableBlock
                title="Futsal pitches"
                rows={futsalCourts}
                facilityCode="futsal-court"
                locationId={locationId}
                onReload={load}
                setPageErr={setErr}
              />
              <FacilitiesTableBlock
                title="Cricket pitches"
                rows={cricketCourts}
                facilityCode="cricket-court"
                locationId={locationId}
                onReload={load}
                setPageErr={setErr}
              />
              <FacilitiesTableBlock
                title="Padel courts"
                rows={padel}
                facilityCode="padel-court"
                locationId={locationId}
                onReload={load}
                setPageErr={setErr}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

