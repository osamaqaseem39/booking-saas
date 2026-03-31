import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listEndUsers } from '../api/saasClient';
import type { IamUserRow } from '../types/domain';

export default function EndUsersPage() {
  const [rows, setRows] = useState<IamUserRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const all = await listEndUsers();
        setRows(
          all.filter((u) =>
            (u.roles ?? []).some((role) => role === 'customer-end-user'),
          ),
        );
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <h1 className="page-title">Customers</h1>
      <p className="muted">
        Only users who have the <code>customer-end-user</code> role are shown
        here. Platform owner only.
      </p>
      {err && <div className="err-banner">{err}</div>}
      <div style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
        <Link to="/app/users/new" className="btn-primary">
          Add user
        </Link>
      </div>
      <div className="table-wrap" style={{ marginTop: '1rem' }}>
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">No customers yet.</div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Roles</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>{u.fullName}</td>
                  <td>{u.email}</td>
                  <td>{u.phone ?? '—'}</td>
                  <td>
                    <code style={{ fontSize: '0.75rem' }}>
                      {(u.roles ?? []).join(', ')}
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
