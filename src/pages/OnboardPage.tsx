import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { listBusinesses, onboardBusiness } from '../api/saasClient';
import { useNavigate } from 'react-router-dom';

export default function OnboardPage() {
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [vertical, setVertical] = useState('arena');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkingCompleted, setCheckingCompleted] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<{
    businessName?: string;
    legalName?: string;
    vertical?: string;
    adminName?: string;
    adminEmail?: string;
    adminPhone?: string;
    adminPassword?: string;
  }>({});

  const emailRe = /^\S+@\S+\.\S+$/;

  useEffect(() => {
    void (async () => {
      try {
        const rows = await listBusinesses();
        if (rows.length > 0) {
          navigate('/app', { replace: true });
        }
      } catch {
        // If the check fails, keep the page visible; the actual submit will still fail if unauthorized.
      } finally {
        setCheckingCompleted(false);
      }
    })();
  }, [navigate]);

  function validate(): boolean {
    const next: typeof fieldErrors = {};

    if (!businessName.trim()) next.businessName = 'Business name is required';
    if (!vertical.trim()) next.vertical = 'Vertical is required';
    if (!adminName.trim()) next.adminName = 'Admin full name is required';
    if (!adminEmail.trim()) next.adminEmail = 'Email is required';
    else if (!emailRe.test(adminEmail.trim())) next.adminEmail = 'Invalid email';
    if (!adminPassword.trim()) next.adminPassword = 'Admin password is required';
    else if (adminPassword.trim().length < 8) next.adminPassword = 'Password must be at least 8 characters';

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await onboardBusiness({
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
      setMsg(`Created: ${JSON.stringify(res, null, 2)}`);
      navigate('/app', { replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Onboard failed');
    } finally {
      setBusy(false);
    }
  }

  if (checkingCompleted) {
    return (
      <div>
        <h1 className="page-title">Onboard business</h1>
        <p className="muted">Checking whether onboarding is already completed…</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Onboard business</h1>
      <p className="muted">
        Creates a business with a new tenant UUID, admin user, business-admin
        role, and owner membership. Platform owner only.
      </p>
      {err && <div className="err-banner">{err}</div>}
      {msg && (
        <div
          className="err-banner"
          style={{
            borderColor: 'rgba(74, 222, 128, 0.4)',
            color: 'var(--ok)',
            background: 'rgba(74, 222, 128, 0.08)',
          }}
        >
          {msg}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="form-grid"
        style={{ maxWidth: '480px', marginTop: '1rem' }}
      >
        <div>
          <label>Business name</label>
          <input
            name="businessName"
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
          <input
            name="legalName"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            aria-invalid={!!fieldErrors.legalName}
          />
        </div>
        <div>
          <label>Vertical</label>
          <input
            name="vertical"
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
            name="adminName"
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
            name="adminEmail"
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
          <input
            name="adminPhone"
            value={adminPhone}
            onChange={(e) => setAdminPhone(e.target.value)}
            aria-invalid={!!fieldErrors.adminPhone}
          />
        </div>

        <div>
          <label>Admin password</label>
          <input
            name="adminPassword"
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

        <button
          type="submit"
          className="btn-primary"
          disabled={busy}
        >
          {busy ? 'Submitting…' : 'Onboard'}
        </button>
      </form>
    </div>
  );
}
