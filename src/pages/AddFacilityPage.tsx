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
  isCourtSetupAllowedForLocation,
  TURF_COURT_SETUP_CODE,
} from '../constants/locationFacilityTypes';
import type { BusinessLocationRow, NamedCourt } from '../types/domain';

function setupPath(locationId: string, facilityCode: string) {
  return `/app/locations/${locationId}/facilities/setup/${facilityCode}`;
}

type SetupOption = { code: string; label: string };

const SETUP_OPTIONS_BY_LOCATION_TYPE: Record<string, SetupOption[]> = {
  arena: [
    { code: TURF_COURT_SETUP_CODE, label: 'Turf court (Futsal + Cricket)' },
    { code: 'padel-court', label: 'Padel' },
  ],
  'gaming-zone': [
    { code: 'ps4', label: 'PS4' },
    { code: 'ps5', label: 'PS5' },
    { code: 'pc', label: 'PC' },
  ],
  snooker: [],
  'table-tennis': [],
};

function hasSetupForm(code: string): boolean {
  return code === TURF_COURT_SETUP_CODE || code === 'padel-court';
}

export default function AddFacilityPage() {
  const [locations, setLocations] = useState<BusinessLocationRow[]>([]);
  const [locationId, setLocationId] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'type' | 'name' | 'id'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
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
      const selected = locations.find((l) => l.id === locationId);
      const locationType = selected?.locationType ?? '';
      if (locationType && locationType !== 'arena') {
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
  }, [locationId, locations]);

  const showLocationPicker = locations.length > 1;
  const visibleSetupOptions = useMemo(() => {
    if (!location) return [];
    const options =
      SETUP_OPTIONS_BY_LOCATION_TYPE[location.locationType ?? ''] ?? [];
    if ((location.locationType ?? '') !== 'arena') return options;
    return options.filter((o) => isCourtSetupAllowedForLocation(location, o.code));
  }, [location]);
  const isArenaLocation = (location?.locationType ?? '') === 'arena';
  const allFacilities = useMemo(
    () => [
      ...turf.map((r) => ({ ...r, type: 'Turf court', code: 'turf-court' })),
      ...padel.map((r) => ({ ...r, type: 'Padel court', code: 'padel-court' })),
      ...futsal.map((r) => ({ ...r, type: 'Futsal field', code: 'futsal-field' })),
      ...cricket.map((r) => ({ ...r, type: 'Cricket indoor', code: 'cricket-indoor' })),
    ],
    [cricket, futsal, padel, turf],
  );
  const facilityTypeOptions = useMemo(
    () => Array.from(new Set(allFacilities.map((f) => f.type))).sort((a, b) => a.localeCompare(b)),
    [allFacilities],
  );
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
  return (
    <div>
      <h1 className="page-title">Facilities</h1>
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

      {isArenaLocation &&
      location &&
      !isCourtSetupAllowedForLocation(location, TURF_COURT_SETUP_CODE) ? (
        <p className="muted add-court-hint" style={{ marginTop: '0.75rem' }}>
          Turn on Futsal or Arena Cricket for this location to add turf courts.
        </p>
      ) : null}

      {isArenaLocation ? (
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
              </tr>
            </thead>
            <tbody>
              {filteredFacilities.map((row) => (
                <tr key={row.id}>
                  <td>{row.type}</td>
                  <td>{row.name}</td>
                  <td>
                    <code style={{ fontSize: '0.7rem' }}>{row.id}</code>
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
