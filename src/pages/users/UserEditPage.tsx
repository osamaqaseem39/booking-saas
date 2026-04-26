import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  activateIamUser,
  assignRole,
  deleteIamUser,
  listIamUsers,
  updateIamUser,
  listBusinessLocationNameIds,
  unassignRole,
  type BusinessLocationNameId,
} from '../../api/saasClient';
import { useSession } from '../../context/SessionContext';
import { userMayAssignRoles } from '../../rbac';
import type { IamUserRow } from '../../types/domain';
import { normalizePhoneForStorage } from '../../utils/phone';

const SYSTEM_ROLES = [
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
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [locations, setLocations] = useState<BusinessLocationNameId[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');

  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const availableRoles = useMemo(() => {
    if (isPlatformOwner) return SYSTEM_ROLES;
    return SYSTEM_ROLES.filter((r) => r !== 'platform-owner');
  }, [isPlatformOwner]);

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
    setSelectedRoles(user.roles ?? []);
  }, [user]);

  function onToggleRole(role: string) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  }

  async function onSave() {
    if (!userId.trim()) return;
    if (selectedRoles.includes('location-admin') && !selectedLocationId) {
      setErr('Please select a location for the Location Admin role.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await updateIamUser(userId, {
        fullName: fullName.trim(),
        email: email.trim(),
        phone: normalizePhoneForStorage(phone) || undefined,
        password: password.trim() ? password : undefined,
      });

      if (canAssign) {
        const originalRoles = user?.roles ?? [];
        const toAdd = selectedRoles.filter((r) => !originalRoles.includes(r));
        const toRemove = originalRoles.filter((r) => !selectedRoles.includes(r));

        for (const role of toRemove) {
          await unassignRole(userId, role);
        }
        for (const role of toAdd) {
          const locId = role === 'location-admin' ? selectedLocationId : undefined;
          await assignRole(userId, role, locId);
        }
      }

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

            {canAssign && (
              <div className="connection-panel" style={{ margin: 0 }}>
                <h2>User roles</h2>
                <p className="muted" style={{ marginTop: 0 }}>
                  Select roles for this user.
                </p>
                <div className="checkbox-grid">
                  {availableRoles.map((r) => (
                    <label key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                      <input
                        type="checkbox"
                        disabled={busy}
                        checked={selectedRoles.includes(r)}
                        onChange={() => onToggleRole(r)}
                      />
                      <span style={{ textTransform: 'none', color: 'var(--text)' }}>
                        {r.replace(/-/g, ' ')}
                      </span>
                    </label>
                  ))}
                </div>

                {selectedRoles.includes('location-admin') && (
                  <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.35rem' }}>Location access (required for Location Admin) *</label>
                    <select
                      value={selectedLocationId}
                      onChange={(e) => setSelectedLocationId(e.target.value)}
                      disabled={busy}
                      style={{ width: '100%', maxWidth: '400px' }}
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
              </div>
            )}

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
        </>
      )}
    </div>
  );
}

