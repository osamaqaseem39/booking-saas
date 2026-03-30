import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listIamUsers } from '../api/saasClient';
import type { IamUserRow } from '../types/domain';

export default function UsersPage() {
  const [rows, setRows] = useState<IamUserRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <div>
      <h1 className="page-title">Users & IAM</h1>
      {err && <div className="err-banner">{err}</div>}
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/app/users/new">Create user</Link>
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
                <th>Edit</th>
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
                    <Link to={`/app/users/${u.id}/edit`}>Edit</Link>
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
