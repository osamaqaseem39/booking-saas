import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  assignRole,
  deleteIamUser,
  listIamUsers,
  updateIamUser,
} from '../api/saasClient';
import { useSession } from '../context/SessionContext';
import { userMayAssignRoles } from '../rbac';
import type { IamUserRow } from '../types/domain';

const ROLES = [
  'platform-owner',
  'business-admin',
  'business-staff',
  'customer-end-user',
] as const;

export default function UserEditPage() {
  const { userId = '' } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const canAssign = userMayAssignRoles(session?.roles ?? []);
  const [rows, setRows] = useState<IamUserRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [assignRoleCode, setAssignRoleCode] = useState<string>('customer-end-user');

  const user = useMemo(() => rows.find((r) => r.id === userId) ?? null, [rows, userId]);

  useEffect(() => {
    void (async () => {
      try {
        const users = await listIamUsers();
        setRows(users);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load user');
      }
    })();
  }, [userId]);

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName);
    setEmail(user.email);
    setPhone(user.phone ?? '');
  }, [user]);

  async function onSave() {
    if (!userId.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await updateIamUser(userId, {
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password: password.trim() ? password : undefined,
      });
      navigate('/app/users', { replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

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

  async function onAssignRole() {
    if (!userId.trim()) return;
    setAssigning(true);
    setErr(null);
    try {
      await assignRole({ userId, role: assignRoleCode });
      const users = await listIamUsers();
      setRows(users);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Assign failed');
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
        <h1 className="page-title">Edit user</h1>
        <Link to="/app/users" className="btn-ghost btn-compact">
          Back to list
        </Link>
      </div>
      {err && <div className="err-banner">{err}</div>}
      {!user ? (
        <div className="empty-state">User not found.</div>
      ) : (
        <>
          <div className="form-grid" style={{ maxWidth: '520px' }}>
            <div>
              <label>Full name</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label>Phone (optional)</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label>New password (optional)</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="Leave blank to keep current"
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn-primary"
                disabled={busy || !fullName.trim() || !email.trim()}
                onClick={() => void onSave()}
              >
                {busy ? 'Saving…' : 'Save changes'}
              </button>
              <button type="button" className="btn-danger" disabled={deleting} onClick={() => void onDelete()}>
                {deleting ? 'Deleting…' : 'Delete user'}
              </button>
            </div>
          </div>

          {canAssign && (
            <div className="form-grid" style={{ maxWidth: '520px', marginTop: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Assign role</h3>
              <div>
                <label>Role</label>
                <select value={assignRoleCode} onChange={(e) => setAssignRoleCode(e.target.value)}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" className="btn-ghost" disabled={assigning} onClick={() => void onAssignRole()}>
                {assigning ? 'Assigning…' : 'Assign role'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
