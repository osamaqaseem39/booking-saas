import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listBusinessLocations,
  listCricketIndoor,
  listFutsalFields,
  listPadelCourts,
  listTurfCourts,
} from '../api/saasClient';
import {
  courtSetupOptions,
  isCourtSetupAllowedForLocation,
  TURF_COURT_SETUP_CODE,
} from '../constants/locationFacilityTypes';
import type { BusinessLocationRow, NamedCourt } from '../types/domain';

function setupPath(locationId: string, facilityCode: string) {
  return `/app/locations/${locationId}/facilities/setup/${facilityCode}`;
}

function TableBlock({
  title,
  rows,
}: {
  title: string;
  rows: NamedCourt[];
}) {
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
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>
                    <code style={{ fontSize: '0.7rem' }}>{r.id}</code>
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

export default function AddFacilityPage() {
  const [locations, setLocations] = useState<BusinessLocationRow[]>([]);
  const [locationId, setLocationId] = useState('');
  const [turf, setTurf] = useState<NamedCourt[]>([]);
  const [padel, setPadel] = useState<NamedCourt[]>([]);
  const [futsal, setFutsal] = useState<NamedCourt[]>([]);
  const [cricket, setCricket] = useState<NamedCourt[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const locs = await listBusinessLocations();
        setLocations(locs);
        setLocationId((id) => id || locs[0]?.id || '');
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load locations');
        setLocations([]);
      }
    })();
  }, []);

  const location = useMemo(
    () => locations.find((l) => l.id === locationId),
    [locations, locationId],
  );

  useEffect(() => {
    void (async () => {
      if (!locationId) {
        setLoading(false);
        setTurf([]);
        setPadel([]);
        setFutsal([]);
        setCricket([]);
        return;
      }
      setLoading(true);
      try {
        const [tu, pa, fu, cr] = await Promise.all([
          listTurfCourts(undefined, locationId),
          listPadelCourts(locationId),
          listFutsalFields(locationId),
          listCricketIndoor(locationId),
        ]);
        setTurf(tu);
        setPadel(pa);
        setFutsal(fu);
        setCricket(cr);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load facilities');
        setTurf([]);
        setPadel([]);
        setFutsal([]);
        setCricket([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [locationId]);

  const showLocationPicker = locations.length > 1;

  return (
    <div>
      <p className="page-toolbar">
        <Link to="/app/locations" className="btn-ghost btn-compact">
          ← Locations
        </Link>
      </p>
      <h1 className="page-title">Add facility</h1>
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

      {location ? (
        <div className="page-actions-row" style={{ marginBottom: '0.5rem' }}>
          <Link to={`/app/locations/${location.id}/facilities`} className="btn-ghost">
            Open location facilities page
          </Link>
        </div>
      ) : null}

      <h3 style={{ fontSize: '1rem', marginTop: '1.25rem' }}>Add facility</h3>
      <div className="facility-setup-grid">
        {courtSetupOptions().map((o) => {
          const allowed = isCourtSetupAllowedForLocation(location, o.code);
          return allowed && locationId ? (
            <Link key={o.code} to={setupPath(locationId, o.code)} className="btn-primary">
              {o.label}
            </Link>
          ) : (
            <button
              key={o.code}
              type="button"
              className="btn-primary"
              disabled
              title="Enable this facility type on the location first (Locations -> Edit -> facility types)."
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {location && !isCourtSetupAllowedForLocation(location, TURF_COURT_SETUP_CODE) ? (
        <p className="muted add-court-hint" style={{ marginTop: '0.75rem' }}>
          Turn on Futsal or Arena Cricket for this location to add turf courts.
        </p>
      ) : null}

      <div className="connection-grid" style={{ marginTop: '1rem' }}>
        <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
          <h2>Turf courts</h2>
          <strong style={{ fontSize: '1.25rem' }}>{turf.length}</strong>
        </div>
        <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
          <h2>Padel courts</h2>
          <strong style={{ fontSize: '1.25rem' }}>{padel.length}</strong>
        </div>
        <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
          <h2>Futsal fields</h2>
          <strong style={{ fontSize: '1.25rem' }}>{futsal.length}</strong>
        </div>
        <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
          <h2>Cricket indoor</h2>
          <strong style={{ fontSize: '1.25rem' }}>{cricket.length}</strong>
        </div>
      </div>

      <h3 style={{ fontSize: '1rem', marginTop: '1.5rem' }}>Facilities list</h3>
      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : (
        <>
          <TableBlock title="Turf courts" rows={turf} />
          <TableBlock title="Padel courts" rows={padel} />
          <TableBlock title="Futsal fields" rows={futsal} />
          <TableBlock title="Cricket indoor" rows={cricket} />
        </>
      )}
    </div>
  );
}
