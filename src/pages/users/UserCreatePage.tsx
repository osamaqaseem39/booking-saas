import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { assignRole, createIamUser, listBusinessLocationNameIds, type BusinessLocationNameId } from '../../api/saasClient';
import { useSession } from '../../context/SessionContext';
import { useEffect } from 'react';
import { userMayAssignRoles } from '../../rbac';
import type { SystemRole } from '../../types/domain';
import { normalizePhoneForStorage } from '../../utils/phone';

const ROLES: SystemRole[] = [
  'platform-owner',
  'business-admin',
  'location-admin',
  'business-staff',
  'customer-end-user',
];

export default function UserCreatePage() {
  const navigate = useNavigate();
  const { session } = useSession();
  const canAssign = userMayAssignRoles(session?.roles ?? []);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<SystemRole[]>([]);
  const [locations, setLocations] = useState<BusinessLocationNameId[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!canAssign) return;
    void (async () => {
      try {
        const res = await listBusinessLocationNameIds();
        setLocations(res.locations || []);
      } catch (e) {
        console.error('Failed to load locations', e);
      }
    })();
  }, [canAssign]);

  const availableRoles = useMemo(() => {
    const r = session?.roles ?? [];
    if (r.includes('platform-owner')) return ROLES;
    // Business admins can't create platform owners
    return ROLES.filter((role) => role !== 'platform-owner');
  }, [session?.roles]);

  function toggleRole(role: SystemRole) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  }

  async function onCreate() {
    setBusy(true);
    setErr(null);
    try {
      const createdUser = await createIamUser({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: normalizePhoneForStorage(phone) || undefined,
        password,
      });
      if (canAssign) {
        const uniqueRoles = Array.from(new Set(selectedRoles));
        for (const role of uniqueRoles) {
          const locId = role === 'location-admin' ? selectedLocationId : undefined;
          await assignRole(createdUser.id, role, locId);
        }
      }
      navigate('/app/users', { replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
        <h1 className="page-title">Add user</h1>
        <Link to="/app/users" className="btn-ghost btn-compact">
          Back to list
        </Link>
      </div>
      <p className="muted">
        Create a business user account for console access.
        {!canAssign && (
          <>
            {' '}
            New users are added as staff for your active tenant.
          </>
        )}
      </p>
      {err && <div className="err-banner">{err}</div>}
      <form
        className="form-grid"
        style={{ maxWidth: '760px', margin: '1rem auto 0' }}
        onSubmit={(e) => {
          e.preventDefault();
          void onCreate();
        }}
      >
        <div className="connection-panel" style={{ margin: 0 }}>
          <h2>User details</h2>
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
              <label>Password *</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="Min 8 characters"
              />
            </div>
          </div>
        </div>
        {canAssign && (
          <div className="connection-panel" style={{ margin: 0 }}>
            <h2>Role assignment</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              Select one or more roles to assign after user creation.
            </p>
            <div className="checkbox-grid">
              {availableRoles.map((role: SystemRole) => (
                <label key={role} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role)}
                    onChange={() => toggleRole(role)}
                  />
                  <span style={{ textTransform: 'none', color: 'var(--text)' }}>
                    {role.replace(/-/g, ' ')}
                  </span>
                </label>
              ))}
            </div>

            {selectedRoles.includes('location-admin') && (
              <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.35rem' }}>Primary location for admin access *</label>
                <select
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(e.target.value)}
                  style={{ width: '100%', maxWidth: '400px' }}
                >
                  <option value="">— Select a location —</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
                <p className="muted" style={{ marginTop: '0.35rem', fontSize: '0.85rem' }}>
                  This user will be restricted to viewing and managing only this specific location.
                </p>
              </div>
            )}
          </div>
        )}
        <button
          type="submit"
          className="btn-primary"
          disabled={
            busy ||
            !fullName.trim() ||
            !email.trim() ||
            password.length < 8 ||
            (canAssign && selectedRoles.length === 0) ||
            (canAssign && selectedRoles.includes('location-admin') && !selectedLocationId)
          }
        >
          {busy ? 'Creating…' : 'Create user'}
        </button>
      </form>
    </div>
  );
}

