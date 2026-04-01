import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteIamUser, listIamUsers } from '../api/saasClient';
import type { IamUserRow } from '../types/domain';

export default function UsersPage() {
  const [rows, setRows] = useState<IamUserRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'fullName' | 'email'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  const reload = () => {
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        setRows(await listIamUsers({ search, sortBy, sortOrder }));
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load users');
      } finally {
        setLoading(false);
      }
    })();
  };

  useEffect(() => {
    reload();
  }, [search, sortBy, sortOrder]);

  async function onDelete(userId: string) {
    const yes = window.confirm('Delete this user? This cannot be undone.');
    if (!yes) return;
    setDeletingId(userId);
    setErr(null);
    try {
      await deleteIamUser(userId);
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  const businessAdminCount = useMemo(
    () => rows.filter((u) => (u.roles ?? []).includes('business-admin')).length,
    [rows],
  );

  return (
    <div>
      <div className="page-head-row">
        <h1 className="page-title">Business users</h1>
        <Link to="/app/users/new" className="btn-primary">
          Add user
        </Link>
      </div>
      <p className="muted">Manage business staff accounts and role access.</p>
      {err && <div className="err-banner">{err}</div>}
      <div className="connection-grid" style={{ marginTop: '1rem' }}>
        <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
          <h2>Total users</h2>
          <strong style={{ fontSize: '1.25rem' }}>{rows.length}</strong>
        </div>
        <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
          <h2>Business admins</h2>
          <strong style={{ fontSize: '1.25rem' }}>{businessAdminCount}</strong>
        </div>
        <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
          <h2>Showing</h2>
          <strong style={{ fontSize: '1.25rem' }}>{rows.length}</strong>
        </div>
      </div>
      <div className="connection-panel" style={{ margin: 0, marginBottom: '1rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 1fr) 180px 140px',
            gap: '0.75rem',
            alignItems: 'end',
          }}
        >
          <label>
            <span className="muted">Search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email, or phone"
            />
          </label>
          <label>
            <span className="muted">Sort by</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
              <option value="createdAt">Newest</option>
              <option value="fullName">Name</option>
              <option value="email">Email</option>
            </select>
          </label>
          <label>
            <span className="muted">Order</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
            >
              <option value="DESC">Descending</option>
              <option value="ASC">Ascending</option>
            </select>
          </label>
        </div>
      </div>

      <div className="table-wrap" style={{ marginTop: '1rem' }}>
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">No business users found.</div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>{u.fullName}</td>
                  <td>{u.email}</td>
                  <td>
                    <code style={{ fontSize: '0.75rem' }}>
                      {(u.roles ?? []).join(', ') || '—'}
                    </code>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <Link to={`/app/users/${u.id}`} className="action-link">
                        View
                      </Link>
                      <Link to={`/app/users/${u.id}/edit`} className="action-link">
                        Edit
                      </Link>
                      <button
                        type="button"
                        className="btn-danger"
                        style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                        disabled={deletingId === u.id}
                        onClick={() => void onDelete(u.id)}
                      >
                        {deletingId === u.id ? 'Deleting…' : 'Delete'}
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
