import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listBusinessLocations } from '../api/saasClient';
import {
  isCourtSetupAllowedForLocation,
  TURF_COURT_SETUP_CODE,
} from '../constants/locationFacilityTypes';
import type { BusinessLocationRow } from '../types/domain';

function setupPath(locationId: string, facilityCode: string) {
  return `/app/locations/${locationId}/facilities/setup/${facilityCode}`;
}

export default function AddCourtPage() {
  const [locations, setLocations] = useState<BusinessLocationRow[]>([]);
  const [locationId, setLocationId] = useState('');
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

  const turfAllowed =
    !!location && isCourtSetupAllowedForLocation(location, TURF_COURT_SETUP_CODE);
  const turfHref =
    locationId && turfAllowed ? setupPath(locationId, TURF_COURT_SETUP_CODE) : '';
  const showLocationPicker = locations.length > 1;

  return (
    <div className="add-court-page">
      <nav className="add-court-nav" aria-label="Breadcrumb">
        <Link to="/app/locations">← Locations</Link>
        <span className="add-court-nav-sep" aria-hidden>
          ·
        </span>
        <Link to="/app/arena">Arena courts</Link>
      </nav>
      <h1 className="page-title">Add court</h1>
      {err && <div className="err-banner">{err}</div>}

      {showLocationPicker && (
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
      )}

      <div className="add-court-cta">
        {turfHref ? (
          <Link to={turfHref} className="btn-primary btn-primary-lg">
            Add turf
          </Link>
        ) : (
          <button type="button" className="btn-primary btn-primary-lg" disabled>
            Add turf
          </button>
        )}
        {locations.length === 0 && !err && (
          <p className="muted add-court-hint">Create a location first to add a turf court.</p>
        )}
        {location && !turfAllowed && (
          <p className="muted add-court-hint">
            Turn on Futsal or Arena Cricket for this location, then you can add turf.
          </p>
        )}
      </div>
    </div>
  );
}
