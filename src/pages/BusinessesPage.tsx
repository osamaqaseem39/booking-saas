import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { listBusinesses, onboardBusiness } from '../api/saasClient';
import { useSession } from '../context/SessionContext';
import { useNavigate } from 'react-router-dom';
import type { BusinessRow } from '../types/domain';

export default function BusinessesPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [createMsg, setCreateMsg] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [vertical, setVertical] = useState('arena');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    businessName?: string;
    vertical?: string;
    adminName?: string;
    adminEmail?: string;
    adminPassword?: string;
  }>({});
  const { session, setTenantId } = useSession();
  const canCreateBusiness = (session?.roles ?? []).includes('platform-owner');

  const emailRe = /^\S+@\S+\.\S+$/;
  const totalMemberships = rows.reduce((sum, row) => sum + (row.memberships?.length ?? 0), 0);
  const uniqueVerticals = new Set(rows.map((row) => row.vertical.trim().toLowerCase()).filter(Boolean)).size;

  async function reloadBusinesses() {
    setLoading(true);
    setErr(null);
    try {
      setRows(await listBusinesses());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reloadBusinesses();
  }, []);

  function validateCreateForm(): boolean {
    const next: typeof fieldErrors = {};
    if (!businessName.trim()) next.businessName = 'Business name is required';
    if (!vertical.trim()) next.vertical = 'Vertical is required';
    if (!adminName.trim()) next.adminName = 'Admin full name is required';
    if (!adminEmail.trim()) next.adminEmail = 'Admin email is required';
    else if (!emailRe.test(adminEmail.trim())) next.adminEmail = 'Invalid admin email';
    if (!adminPassword.trim()) next.adminPassword = 'Admin password is required';
    else if (adminPassword.trim().length < 8) {
      next.adminPassword = 'Password must be at least 8 characters';
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onCreateBusiness(e: FormEvent) {
    e.preventDefault();
    if (!validateCreateForm()) return;

    setCreateBusy(true);
    setCreateErr(null);
    setCreateMsg(null);
    try {
      await onboardBusiness({
        businessName: businessName.trim(),
        legalName: legalName.trim() || undefined,
        vertical: vertical.trim(),
        admin: {
          fullName: adminName.trim(),
          email: adminEmail.trim(),
          phone: adminPhone.trim() || undefined,
          password: adminPassword,
        },
      });
      setCreateMsg('Business created successfully.');
      setBusinessName('');
      setLegalName('');
      setVertical('arena');
      setAdminName('');
      setAdminEmail('');
      setAdminPhone('');
      setAdminPassword('');
      setFieldErrors({});
      setShowCreateForm(false);
      await reloadBusinesses();
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : 'Failed to create business');
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">Businesses & tenants</h1>
      <p className="muted">
        Each business has a <strong>tenantId</strong> used as{' '}
        <code>X-Tenant-Id</code>. Platform owners see all businesses;
        business admins only see businesses they belong to.
      </p>
      {!loading && rows.length > 0 && (
        <div className="connection-grid" style={{ marginTop: '1rem' }}>
          <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
            <h2>Total businesses</h2>
            <strong style={{ fontSize: '1.25rem' }}>{rows.length}</strong>
          </div>
          <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
            <h2>Total members</h2>
            <strong style={{ fontSize: '1.25rem' }}>{totalMemberships}</strong>
          </div>
          <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
            <h2>Verticals</h2>
            <strong style={{ fontSize: '1.25rem' }}>{uniqueVerticals}</strong>
          </div>
        </div>
      )}
      {canCreateBusiness && (
        <>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setShowCreateForm((v) => !v);
                setCreateErr(null);
                setCreateMsg(null);
              }}
            >
              {showCreateForm ? 'Close form' : 'Add business'}
            </button>
          </div>
          {showCreateForm && (
            <>
              <h3 style={{ marginTop: '1rem' }}>Create business</h3>
              <p className="muted" style={{ marginTop: '0.25rem' }}>
                Creates a business, tenant, admin user, and owner membership.
              </p>
              {createErr && <div className="err-banner">{createErr}</div>}
              {createMsg && (
                <div
                  className="err-banner"
                  style={{
                    borderColor: 'rgba(74, 222, 128, 0.4)',
                    color: 'var(--ok)',
                    background: 'rgba(74, 222, 128, 0.08)',
                  }}
                >
                  {createMsg}
                </div>
              )}
              <form
                onSubmit={onCreateBusiness}
                className="form-grid"
                style={{ maxWidth: '520px', marginTop: '0.75rem' }}
              >
                <div>
                  <label>Business name</label>
                  <input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    aria-invalid={!!fieldErrors.businessName}
                  />
                  {fieldErrors.businessName && (
                    <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                      {fieldErrors.businessName}
                    </div>
                  )}
                </div>
                <div>
                  <label>Legal name (optional)</label>
                  <input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
                </div>
                <div>
                  <label>Vertical</label>
                  <input
                    value={vertical}
                    onChange={(e) => setVertical(e.target.value)}
                    aria-invalid={!!fieldErrors.vertical}
                  />
                  {fieldErrors.vertical && (
                    <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                      {fieldErrors.vertical}
                    </div>
                  )}
                </div>
                <h4 className="muted" style={{ margin: '0.5rem 0 0' }}>
                  Admin user
                </h4>
                <div>
                  <label>Full name</label>
                  <input
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    aria-invalid={!!fieldErrors.adminName}
                  />
                  {fieldErrors.adminName && (
                    <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                      {fieldErrors.adminName}
                    </div>
                  )}
                </div>
                <div>
                  <label>Email</label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    aria-invalid={!!fieldErrors.adminEmail}
                  />
                  {fieldErrors.adminEmail && (
                    <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                      {fieldErrors.adminEmail}
                    </div>
                  )}
                </div>
                <div>
                  <label>Phone (optional)</label>
                  <input value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} />
                </div>
                <div>
                  <label>Admin password</label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    aria-invalid={!!fieldErrors.adminPassword}
                  />
                  {fieldErrors.adminPassword && (
                    <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                      {fieldErrors.adminPassword}
                    </div>
                  )}
                </div>
                <button type="submit" className="btn-primary" disabled={createBusy}>
                  {createBusy ? 'Creating…' : 'Create business'}
                </button>
              </form>
            </>
          )}
        </>
      )}
      {err && <div className="err-banner">{err}</div>}
      <div className="table-wrap" style={{ marginTop: '1rem' }}>
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">No businesses.</div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Tenant ID</th>
                <th>Vertical</th>
                <th>Members</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td>{b.businessName}</td>
                  <td>
                    <code style={{ fontSize: '0.75rem' }}>{b.tenantId}</code>
                  </td>
                  <td>{b.vertical}</td>
                  <td>{b.memberships?.length ?? 0}</td>
                  <td style={{ width: '140px' }}>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        setTenantId(b.tenantId);
                        navigate(`/app/businesses/${b.id}`);
                      }}
                    >
                      Tenant stats
                    </button>
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
