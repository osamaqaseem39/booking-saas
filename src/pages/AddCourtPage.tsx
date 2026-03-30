import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listBusinessLocations } from '../api/saasClient';
import {
  courtSetupOptions,
  isCourtSetupAllowedForLocation,
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

  const options = courtSetupOptions();

  return (
    <div>
      <p className="muted" style={{ marginBottom: '0.75rem' }}>
        <Link to="/app/locations">← Locations</Link>
        {' · '}
        <Link to="/app/arena">Arena courts</Link>
      </p>
      <h1 className="page-title">Add court</h1>
      <p className="muted" style={{ maxWidth: '42rem' }}>
        Pick a location, then open the setup form for the court type you want.
        Turf uses the full Futsal + Cricket form; other types use shorter forms.
      </p>
      {err && <div className="err-banner">{err}</div>}

      <div className="form-grid" style={{ maxWidth: '480px', marginTop: '1.25rem' }}>
        <div>
          <label>Location</label>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            disabled={locations.length === 0}
          >
            {locations.length === 0 ? (
              <option value="">No locations</option>
            ) : (
              [...locations]
                .sort((a, b) =>
                  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
                )
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                    {l.city ? ` · ${l.city}` : ''}
                  </option>
                ))
            )}
          </select>
        </div>
      </div>

      {locationId && location && (
        <>
          <h2
            style={{
              fontSize: '0.95rem',
              marginTop: '1.5rem',
              marginBottom: '0.5rem',
            }}
          >
            Setup forms
          </h2>
          <ul className="items-list" style={{ maxWidth: '36rem' }}>
            {options.map((o) => {
              const allowed = isCourtSetupAllowedForLocation(location, o.code);
              return (
                <li key={o.code}>
                  {allowed ? (
                    <Link to={setupPath(locationId, o.code)}>{o.label}</Link>
                  ) : (
                    <span style={{ opacity: 0.55 }}>
                      {o.label}
                      <span
                        className="muted"
                        style={{ fontSize: '0.82rem', marginLeft: '0.35rem' }}
                      >
                        (enable under location facility types first)
                      </span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
