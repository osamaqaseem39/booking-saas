import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  activateIamUser,
  assignRole,
  deleteIamUser,
  listIamUsers,
  updateIamUser,
  listBusinessLocationNameIds,
  type BusinessLocationNameId,
} from '../../api/saasClient';
import { useSession } from '../../context/SessionContext';
import { userMayAssignRoles } from '../../rbac';
import type { IamUserRow } from '../../types/domain';
import { normalizePhoneForStorage } from '../../utils/phone';

const ROLES = [
  'platform-owner',
  'business-admin',
  'location-admin',
  'business-staff',
  'customer-end-user',
] as const;

export default function UserEditPage() {
  const { userId = '' } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const roles = session?.roles ?? [];
  const canAssign = userMayAssignRoles(roles);
  const isPlatformOwner = roles.includes('platform-owner');
  const [rows, setRows] = useState<IamUserRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activating, setActivating] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [assignRoleCode, setAssignRoleCode] = useState<string>('customer-end-user');
  const [locations, setLocations] = useState<BusinessLocationNameId[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');

  const user = useMemo(() => rows.find((r) => r.id === userId) ?? null, [rows, userId]);

  useEffect(() => {
    void (async () => {
      try {
        const users = await listIamUsers();
        setRows(users);
        if (canAssign) {
          const locRes = await listBusinessLocationNameIds();
          setLocations(locRes.locations || []);
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load user');
      }
    })();
  }, [userId, canAssign]);

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
        phone: normalizePhoneForStorage(phone) || undefined,
        password: password.trim() ? password : undefined,
      });
      navigate('/app/users', { replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function onDeactivate() {
    if (!userId.trim()) return;
    const yes = window.confirm(
      'Deactivate this account? They cannot sign in until a platform owner reactivates them.',
    );
    if (!yes) return;
    setDeleting(true);
    setErr(null);
    try {
      await deleteIamUser(userId);
      navigate('/app/users', { replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Deactivate failed');
    } finally {
      setDeleting(false);
    }
  }

  async function onActivateAccount() {
    if (!userId.trim()) return;
    setActivating(true);
    setErr(null);
    try {
      const profile = await activateIamUser(userId);
      setRows((prev) =>
        prev.map((r) =>
          r.id === userId
            ? {
                ...r,
                fullName: profile.fullName,
                email: profile.email,
                phone: profile.phone,
                isActive: profile.isActive,
                roles: profile.roles,
              }
            : r,
        ),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Activate failed');
    } finally {
      setActivating(false);
    }
  }

  async function onAssignRole() {
    if (!userId.trim()) return;
    setAssigning(true);
    setErr(null);
    try {
      const locId = assignRoleCode === 'location-admin' ? selectedLocationId : undefined;
      await assignRole(userId, assignRoleCode, locId);
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
          <form
            className="form-grid"
            style={{ maxWidth: '760px' }}
            onSubmit={(e) => {
              e.preventDefault();
              void onSave();
            }}
          >
            <div className="connection-panel" style={{ margin: 0 }}>
              <h2>Profile</h2>
              <div className="form-row-2">
                <div>
                  <label>Full name *</label>
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div>
                  <label>Email *</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div className="form-row-2">
                <div>
                  <label>Phone (optional)</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div>
                  <label>User ID</label>
                  <input value={user.id} disabled />
                </div>
              </div>
              <div>
                <label>Current roles</label>
                <div>
                  <code>{(user.roles ?? []).join(', ') || '—'}</code>
                </div>
              </div>
              <div>
                <label>Created</label>
                <div>{user.createdAt ? new Date(user.createdAt).toLocaleString() : '—'}</div>
              </div>
              <div>
                <label>Account</label>
                <div>{user.isActive === false ? 'Inactive (cannot sign in)' : 'Active'}</div>
              </div>
            </div>
            <div className="connection-panel" style={{ margin: 0 }}>
              <h2>Security</h2>
              <div>
                <label>New password (optional)</label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="Leave blank to keep current password"
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={busy || !fullName.trim() || !email.trim()}
              >
                {busy ? 'Saving…' : 'Save changes'}
              </button>
              <Link to={`/app/users/${user.id}`} className="btn-ghost">
                View user
              </Link>
              {user.isActive === false && isPlatformOwner ? (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={activating}
                  onClick={() => void onActivateAccount()}
                >
                  {activating ? 'Working…' : 'Activate account'}
                </button>
              ) : null}
              {user.isActive !== false ? (
                <button
                  type="button"
                  className="btn-danger"
                  disabled={deleting}
                  onClick={() => void onDeactivate()}
                >
                  {deleting ? 'Working…' : 'Deactivate account'}
                </button>
              ) : null}
            </div>
          </form>

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

              {assignRoleCode === 'location-admin' && (
                <div style={{ marginTop: '0.75rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.35rem' }}>Location access *</label>
                  <select
                    value={selectedLocationId}
                    onChange={(e) => setSelectedLocationId(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">— Select a location —</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                className="btn-ghost"
                disabled={assigning || (assignRoleCode === 'location-admin' && !selectedLocationId)}
                onClick={() => void onAssignRole()}
              >
                {assigning ? 'Assigning…' : 'Assign role'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

