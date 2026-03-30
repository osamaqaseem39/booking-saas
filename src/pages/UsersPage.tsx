import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deleteIamUser, listIamUsers } from '../api/saasClient';
import type { IamUserRow } from '../types/domain';

export default function UsersPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<IamUserRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const reload = () => {
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        setRows(await listIamUsers());
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load users');
      } finally {
        setLoading(false);
      }
    })();
  };

  useEffect(() => {
    reload();
  }, []);

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

  return (
    <div>
      <h1 className="page-title">Users & IAM</h1>
      {err && <div className="err-banner">{err}</div>}
      <div style={{ marginBottom: '1rem' }}>
        <button type="button" className="btn-primary" onClick={() => navigate('/app/users/new')}>
          Add user
        </button>
      </div>

      <div className="table-wrap">
        {loading ? (
          <div className="empty-state">Loading…</div>
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
                      <Link to={`/app/users/${u.id}`}>View</Link>
                      <Link to={`/app/users/${u.id}/edit`}>Edit</Link>
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
