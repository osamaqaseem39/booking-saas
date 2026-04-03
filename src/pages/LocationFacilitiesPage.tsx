import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  deleteFacilityByCode,
  updateFacilityName,
  type FacilityRowCode,
} from '../api/facilityMutations';
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
} from '../constants/locationFacilityTypes';
import type { BusinessLocationRow, NamedCourt } from '../types/domain';

function setupPath(locationId: string, facilityCode: string) {
  return `/app/locations/${locationId}/facilities/setup/${facilityCode}`;
}

function FacilitiesTableBlock({
  title,
  rows,
  facilityCode,
  onReload,
  setPageErr,
}: {
  title: string;
  rows: NamedCourt[];
  facilityCode: FacilityRowCode;
  onReload: () => void;
  setPageErr: (msg: string | null) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function startEdit(r: NamedCourt) {
    setPageErr(null);
    setEditingId(r.id);
    setEditName(r.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
  }

  async function saveEdit() {
    if (!editingId) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      setPageErr('Name is required.');
      return;
    }
    setSaving(true);
    setPageErr(null);
    try {
      await updateFacilityName(facilityCode, editingId, trimmed);
      cancelEdit();
      onReload();
    } catch (e) {
      setPageErr(e instanceof Error ? e.message : 'Failed to update facility');
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(r: NamedCourt) {
    const yes = window.confirm(
      `Delete facility “${r.name}”? This cannot be undone.`,
    );
    if (!yes) return;
    setDeletingId(r.id);
    setPageErr(null);
    try {
      await deleteFacilityByCode(facilityCode, r.id);
      if (editingId === r.id) cancelEdit();
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
      {editingId ? (
        <div
          className="connection-panel"
          style={{ marginBottom: '0.75rem', padding: '0.75rem 1rem' }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem',
              alignItems: 'flex-end',
            }}
          >
            <div style={{ flex: '1 1 200px' }}>
              <label htmlFor={`edit-${facilityCode}-${editingId}`}>Name</label>
              <input
                id={`edit-${facilityCode}-${editingId}`}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn-primary btn-compact"
              disabled={saving}
              onClick={() => void saveEdit()}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className="btn-ghost btn-compact"
              disabled={saving}
              onClick={cancelEdit}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
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
                      <button
                        type="button"
                        className="btn-ghost btn-compact"
                        disabled={deletingId === r.id || saving}
                        onClick={() => startEdit(r)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-danger btn-compact"
                        disabled={deletingId === r.id || saving}
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
  const [turf, setTurf] = useState<NamedCourt[]>([]);
  const [padel, setPadel] = useState<NamedCourt[]>([]);
  const [futsal, setFutsal] = useState<NamedCourt[]>([]);
  const [cricket, setCricket] = useState<NamedCourt[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
        const [locs, tu, pa, fu, cr] = await Promise.all([
          listBusinessLocations(),
          listTurfCourts(undefined, locationId),
          listPadelCourts(locationId),
          listFutsalFields(locationId),
          listCricketIndoor(locationId),
        ]);
        setLocations(locs);
        setTurf(tu);
        setPadel(pa);
        setFutsal(fu);
        setCricket(cr);
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
            courts/fields here; each facility type uses the matching API setup
            shape (minimal forms below — extend via API as needed).
          </p>
          {err && <div className="err-banner">{err}</div>}

          <h3 style={{ fontSize: '1rem', marginTop: '1.25rem' }}>
            Add facility (setup form)
          </h3>
          <div className="facility-setup-grid">
            {courtSetupOptions().map((o) => {
              const allowed = isCourtSetupAllowedForLocation(location, o.code);
              return allowed ? (
                <Link
                  key={o.code}
                  to={setupPath(locationId, o.code)}
                  className="btn-primary"
                >
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
              );
            })}
          </div>

          <h3 style={{ fontSize: '1rem', marginTop: '1.5rem' }}>
            At this location
          </h3>
          <FacilitiesTableBlock
            title="Turf courts"
            rows={turf}
            facilityCode="turf-court"
            onReload={load}
            setPageErr={setErr}
          />
          <FacilitiesTableBlock
            title="Padel courts"
            rows={padel}
            facilityCode="padel-court"
            onReload={load}
            setPageErr={setErr}
          />
          <FacilitiesTableBlock
            title="Futsal fields"
            rows={futsal}
            facilityCode="futsal-field"
            onReload={load}
            setPageErr={setErr}
          />
          <FacilitiesTableBlock
            title="Cricket indoor"
            rows={cricket}
            facilityCode="cricket-indoor"
            onReload={load}
            setPageErr={setErr}
          />
        </>
      )}
    </div>
  );
}
