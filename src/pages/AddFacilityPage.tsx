import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  deleteFacilityByCode,
  type FacilityRowCode,
} from '../api/facilityMutations';
import {
  createCricketCourt,
  createFutsalCourt,
  createPadelCourt,
  listBusinessLocations,
  listCricketCourts,
  listFutsalCourts,
  listPadelCourts,
} from '../api/saasClient';
import {
  CRICKET_COURT_SETUP_CODE,
  FUTSAL_COURT_SETUP_CODE,
} from '../constants/locationFacilityTypes';
import type { BusinessLocationRow, NamedCourt } from '../types/domain';

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
  'gaming-zone': [
    { code: 'ps4', label: 'PS4' },
    { code: 'ps5', label: 'PS5' },
    { code: 'pc', label: 'PC' },
  ],
  snooker: [],
  'table-tennis': [],
};

function hasSetupForm(code: string): boolean {
  return (
    code === FUTSAL_COURT_SETUP_CODE ||
    code === CRICKET_COURT_SETUP_CODE ||
    code === 'padel-court'
  );
}

export default function AddFacilityPage() {
  const [locations, setLocations] = useState<BusinessLocationRow[]>([]);
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
      await reloadFacilitiesFor(locationId, locations);
    })();
  }, [locationId, locations]);

  const showLocationPicker = locations.length > 1;
  const visibleSetupOptions = useMemo(() => {
    if (!location) return [];
    const options =
      SETUP_OPTIONS_BY_LOCATION_TYPE[location.locationType ?? ''] ?? [];
    // Arena: always show futsal, cricket, and padel so owners see all three choices.
    if ((location.locationType ?? '') === 'arena') {
      return SETUP_OPTIONS_BY_LOCATION_TYPE.arena;
    }
    return options;
  }, [location]);
  const isArenaLocation = (location?.locationType ?? '') === 'arena';
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
    ],
    [cricketCourts, futsalCourts, padel],
  );
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
      await deleteFacilityByCode(row.code as FacilityRowCode, row.id);
      await reloadFacilitiesFor(locationId, locations);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to delete facility');
    } finally {
      setDeletingId(null);
    }
  }

  async function duplicateFacility(row: {
    id: string;
    name: string;
    code: string;
    businessLocationId?: string | null;
  }) {
    const businessLocationId = row.businessLocationId?.trim();
    if (!businessLocationId) {
      setErr('Cannot duplicate: facility has no linked location.');
      return;
    }
    setDuplicatingId(row.id);
    setErr(null);
    try {
      const copyName = `${row.name} (Copy)`;
      if (row.code === 'futsal-court') {
        await createFutsalCourt({
          businessLocationId,
          name: copyName,
        });
      } else if (row.code === 'cricket-court') {
        await createCricketCourt({
          businessLocationId,
          name: copyName,
        });
      } else if (row.code === 'padel-court') {
        await createPadelCourt({
          businessLocationId,
          name: copyName,
        });
      }
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
                          onClick={() => void duplicateFacility(row)}
                        >
                          {duplicatingId === row.id
                            ? 'Duplicating…'
                            : 'Duplicate'}
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
    </div>
  );
}
