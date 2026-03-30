import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteIamUser, listIamUsers } from '../api/saasClient';
import type { IamUserRow } from '../types/domain';

export default function UserDetailPage() {
  const { userId = '' } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [rows, setRows] = useState<IamUserRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const user = useMemo(() => rows.find((r) => r.id === userId) ?? null, [rows, userId]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        setRows(await listIamUsers());
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load user');
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  async function onDelete() {
    if (!userId.trim()) return;
    const yes = window.confirm('Delete this user? This cannot be undone.');
    if (!yes) return;
    setDeleting(true);
    setErr(null);
    try {
      await deleteIamUser(userId);
      navigate('/app/users', { replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  if (!userId.trim()) return <p className="muted">Missing user id.</p>;

  return (
    <div>
      <p className="muted" style={{ marginBottom: '0.75rem' }}>
        <Link to="/app/users">← Users</Link>
      </p>
      <h1 className="page-title">User details</h1>
      {err && <div className="err-banner">{err}</div>}
      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : !user ? (
        <div className="empty-state">User not found.</div>
      ) : (
        <div className="form-grid" style={{ maxWidth: '620px' }}>
          <div>
            <label>Full name</label>
            <div>{user.fullName}</div>
          </div>
          <div>
            <label>Email</label>
            <div>{user.email}</div>
          </div>
          <div>
            <label>Phone</label>
            <div>{user.phone || '—'}</div>
          </div>
          <div>
            <label>Roles</label>
            <div>
              <code>{(user.roles ?? []).join(', ') || '—'}</code>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate(`/app/users/${user.id}/edit`)}
            >
              Edit user
            </button>
            <button type="button" className="btn-danger" disabled={deleting} onClick={() => void onDelete()}>
              {deleting ? 'Deleting…' : 'Delete user'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
