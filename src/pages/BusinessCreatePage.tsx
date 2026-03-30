import type { FormEvent } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onboardBusiness } from '../api/saasClient';

export default function BusinessCreatePage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
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

  const emailRe = /^\S+@\S+\.\S+$/;

  function validate(): boolean {
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setBusy(true);
    setErr(null);
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
      navigate('/app/businesses', { replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create business');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
        <h1 className="page-title">Add business</h1>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => navigate('/app/businesses')}
        >
          Back to list
        </button>
      </div>
      <p className="muted">
        Creates a new business tenant with an admin user and owner membership.
      </p>

      {err && <div className="err-banner">{err}</div>}

      <form
        onSubmit={onSubmit}
        className="form-grid"
        style={{ maxWidth: '560px', marginTop: '1rem' }}
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
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Creating…' : 'Create business'}
        </button>
      </form>
    </div>
  );
}
