import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  deleteBusinessLocation,
  listBusinessLocations,
  listBusinesses,
} from '../api/saasClient';
import { useSession } from '../context/SessionContext';
import type { BusinessLocationRow, BusinessRow } from '../types/domain';

export default function LocationsPage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const isOwner = session?.roles?.includes('platform-owner');
  const [rows, setRows] = useState<BusinessLocationRow[]>([]);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = () => {
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [locs, biz] = await Promise.all([
          listBusinessLocations(),
          listBusinesses(),
        ]);
        setRows(locs);
        setBusinesses(biz);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  };

  useEffect(() => {
    load();
  }, []);

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

  return (
    <div>
      <h1 className="page-title">Locations</h1>
      <p className="muted">
        {isOwner
          ? 'As platform owner you see every venue/branch linked to any business.'
          : 'You see locations only for businesses you belong to.'}{' '}
        Each row has a <strong>location type</strong> (arena, branch, etc.)
        and <strong>facility types</strong> (which court kinds the site offers).
        Facility types are stored on the location, not in a separate catalog.
      </p>
      {err && <div className="err-banner">{err}</div>}

      <div style={{ marginTop: '1rem' }}>
        <button type="button" className="btn-primary" onClick={() => navigate('/app/locations/new')}>
          Add location
        </button>
      </div>

      <h3 style={{ fontSize: '1rem', marginTop: '1.75rem' }}>All locations</h3>
      <div className="table-wrap">
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            No locations yet. Add one above (run DB migration if the table is
            missing).
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
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.business?.businessName ?? r.businessId}</td>
                  <td>
                    <code style={{ fontSize: '0.7rem' }}>
                      {r.business?.tenantId?.slice(0, 8) ?? '—'}…
                    </code>
                  </td>
                  <td>
                    <code style={{ fontSize: '0.75rem' }}>
                      {r.locationType ?? '—'}
                    </code>
                  </td>
                  <td>
                    {r.facilityTypes?.length ? (
                      <code style={{ fontSize: '0.7rem' }}>
                        {r.facilityTypes.join(', ')}
                      </code>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{r.name}</td>
                  <td>{r.city ?? '—'}</td>
                  <td>{r.phone ?? '—'}</td>
                  <td style={{ minWidth: '220px' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <Link to={`/app/locations/${r.id}/facilities`}>Manage</Link>
                      <Link to={`/app/locations/${r.id}`}>View</Link>
                      <Link to={`/app/locations/${r.id}/edit`}>Edit</Link>
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
