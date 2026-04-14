import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  deleteBusinessLocation,
  listBusinessLocations,
} from '../../api/saasClient';
import { useSession } from '../../context/SessionContext';
import { formatFacilityTypeLabel } from '../../constants/locationFacilityTypes';
import { LOCATION_TYPE_OPTIONS } from '../../constants/locationTypes';
import type { BusinessLocationRow } from '../../types/domain';

export default function LocationsPage() {
  const { session } = useSession();
  const [searchParams] = useSearchParams();
  const isOwner = session?.roles?.includes('platform-owner');
  const initialTypeFilter = searchParams.get('type')?.trim() || 'all';
  const businessIdFilter = searchParams.get('businessId')?.trim() || '';
  const [rows, setRows] = useState<BusinessLocationRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState(initialTypeFilter);

  useEffect(() => {
    const nextTypeFilter = searchParams.get('type')?.trim() || 'all';
    setTypeFilter(nextTypeFilter);
  }, [searchParams]);

  const load = () => {
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const locs = await listBusinessLocations({
          ignoreActiveTenant: !!isOwner,
        });
        setRows(locs);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  };

  useEffect(() => {
    load();
  }, [isOwner]);

  async function onDelete(locationId: string) {
    const yes = window.confirm('Delete this location? This cannot be undone.');
    if (!yes) return;
    setDeletingId(locationId);
    setErr(null);
    try {
      await deleteBusinessLocation(locationId);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (businessIdFilter && r.businessId !== businessIdFilter) return false;
      if (typeFilter !== 'all' && (r.locationType ?? 'unknown') !== typeFilter) return false;
      if (!q) return true;
      return (
        (r.name ?? '').toLowerCase().includes(q) ||
        (r.city ?? '').toLowerCase().includes(q) ||
        (r.business?.businessName ?? '').toLowerCase().includes(q) ||
        (r.business?.tenantId ?? '').toLowerCase().includes(q)
      );
    });
  }, [businessIdFilter, query, rows, typeFilter]);

  const stats = useMemo(() => {
    const active = filteredRows.filter((r) => (r.status ?? '').toLowerCase() === 'active').length;
    const withFacilities = filteredRows.filter((r) => (r.facilityTypes?.length ?? 0) > 0).length;
    return {
      total: filteredRows.length,
      active,
      inactive: filteredRows.length - active,
      withFacilities,
    };
  }, [filteredRows]);

  return (
    <div>
      <div className="page-head-row">
        <h1 className="page-title">Locations</h1>
        {isOwner ? (
          <Link to="/app/locations/new" className="btn-primary">
            Add location
          </Link>
        ) : null}
      </div>
      <p className="muted">
        {isOwner
          ? 'As platform owner you see every venue/branch linked to any business.'
          : 'You see locations only for businesses you belong to.'}{' '}
        Each row has a <strong>venue type</strong> set when the location is
        created (platform). That type controls which facility setup forms appear
        under <strong>Facilities</strong>. Facility tags (courts / gaming
        stations) are stored on the location.
      </p>
      {businessIdFilter ? (
        <p className="muted" style={{ marginTop: '-0.35rem' }}>
          Showing locations for the selected business.
        </p>
      ) : null}
      {err && <div className="err-banner">{err}</div>}

      <div className="connection-panel location-list-toolbar">
        <div className="form-row-2" style={{ maxWidth: '760px' }}>
          <div>
            <label>Search</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Location, city, business, tenant"
            />
          </div>
          <div>
            <label>Location type</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All types</option>
              {LOCATION_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
              <option value="unknown">Unknown</option>
            </select>
          </div>
        </div>
        <div className="location-stats">
          <div className="location-stat-card">
            <div className="muted">In view</div>
            <strong>{stats.total}</strong>
          </div>
          <div className="location-stat-card">
            <div className="muted">Active</div>
            <strong>{stats.active}</strong>
          </div>
          <div className="location-stat-card">
            <div className="muted">Inactive</div>
            <strong>{stats.inactive}</strong>
          </div>
          <div className="location-stat-card">
            <div className="muted">Configured facilities</div>
            <strong>{stats.withFacilities}</strong>
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: '1rem', marginTop: '1.75rem' }}>All locations</h3>
      <div className="table-wrap">
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : filteredRows.length === 0 ? (
          <div className="empty-state">
            No locations match the current filters.
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Business</th>
                <th>Tenant</th>
                <th>Type</th>
                <th>Facility types</th>
                <th>Location</th>
                <th>City</th>
                <th>Phone</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.id}>
                  <td>{r.business?.businessName ?? r.businessId}</td>
                  <td>
                    <code style={{ fontSize: '0.7rem' }}>
                      {r.business?.tenantId?.slice(0, 8) ?? '—'}…
                    </code>
                  </td>
                  <td>
                    <code className="location-type-chip">
                      {r.locationType ?? '—'}
                    </code>
                  </td>
                  <td>
                    {r.facilityTypes?.length ? (
                      <div className="facility-chip-list">
                        {r.facilityTypes.map((code) => (
                          <span key={code} className="facility-chip">
                            {formatFacilityTypeLabel(code)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{r.name}</td>
                  <td>{r.city ?? '—'}</td>
                  <td>
                    <div>{r.phone ?? '—'}</div>
                    <span
                      className={`badge ${(r.status ?? '').toLowerCase() === 'active' ? 'badge-confirmed' : 'badge-neutral'}`}
                      style={{ marginTop: '0.3rem' }}
                    >
                      {(r.status ?? 'unknown').toUpperCase()}
                    </span>
                  </td>
                  <td style={{ minWidth: '220px' }}>
                    <div className="location-actions">
                      <Link
                        className="action-link"
                        to={`/app/bookings/new?locationId=${encodeURIComponent(r.id)}`}
                      >
                        Add booking
                      </Link>
                      <Link
                        className="action-link"
                        to={`/app/Facilites?locationId=${encodeURIComponent(r.id)}`}
                      >
                        View facilities
                      </Link>
                      <Link className="action-link" to={`/app/locations/${r.id}/facilities`}>
                        Manage facilities
                      </Link>
                      <Link className="action-link" to={`/app/locations/${r.id}`}>View</Link>
                      <Link className="action-link" to={`/app/locations/${r.id}/edit`}>Edit</Link>
                      <button
                        type="button"
                        className="btn-danger"
                        style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                        disabled={deletingId === r.id}
                        onClick={() => void onDelete(r.id)}
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

