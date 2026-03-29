import { useEffect, useState } from 'react';
import {
  assignRole,
  createIamUser,
  listIamUsers,
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

export default function UsersPage() {
  const { session } = useSession();
  const canAssign = userMayAssignRoles(session?.roles ?? []);
  const [rows, setRows] = useState<IamUserRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [assignUserId, setAssignUserId] = useState('');
  const [assignRoleCode, setAssignRoleCode] = useState<string>(
    'customer-end-user',
  );

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

      <div className="form-grid" style={{ maxWidth: '520px', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>Create user</h3>
        <div className="form-row-2">
          <div>
            <label>Full name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label>Phone (optional)</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            void (async () => {
              try {
                await createIamUser({
                  fullName: fullName.trim(),
                  email: email.trim(),
                  phone: phone.trim() || undefined,
                });
                setFullName('');
                setEmail('');
                setPhone('');
                reload();
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'Create failed');
              }
            })();
          }}
        >
          Create user
        </button>
      </div>

      {canAssign && (
        <div className="form-grid" style={{ maxWidth: '520px', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Assign role</h3>
          <p className="muted" style={{ margin: 0 }}>
            Platform owner only (API enforced).
          </p>
          <div>
            <label>User ID</label>
            <input
              value={assignUserId}
              onChange={(e) => setAssignUserId(e.target.value)}
              placeholder="UUID"
            />
          </div>
          <div>
            <label>Role</label>
            <select
              value={assignRoleCode}
              onChange={(e) => setAssignRoleCode(e.target.value)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              void (async () => {
                try {
                  await assignRole({
                    userId: assignUserId.trim(),
                    role: assignRoleCode,
                  });
                  setAssignUserId('');
                  reload();
                } catch (e) {
                  setErr(e instanceof Error ? e.message : 'Assign failed');
                }
              })();
            }}
          >
            Assign role
          </button>
        </div>
      )}

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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
