import { useState } from 'react';
import { onboardBusiness } from '../api/saasClient';

export default function OnboardPage() {
  const [businessName, setBusinessName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [vertical, setVertical] = useState('arena');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      <div className="form-grid" style={{ maxWidth: '480px', marginTop: '1rem' }}>
        <div>
          <label>Business name</label>
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
          />
        </div>
        <div>
          <label>Legal name (optional)</label>
          <input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
        </div>
        <div>
          <label>Vertical</label>
          <input value={vertical} onChange={(e) => setVertical(e.target.value)} />
        </div>
        <h4 className="muted" style={{ margin: '0.5rem 0 0' }}>
          Admin user
        </h4>
        <div>
          <label>Full name</label>
          <input value={adminName} onChange={(e) => setAdminName(e.target.value)} />
        </div>
        <div>
          <label>Email</label>
          <input
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
          />
        </div>
        <div>
          <label>Phone (optional)</label>
          <input value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} />
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={busy || !businessName.trim() || !adminName.trim() || !adminEmail.trim()}
          onClick={() => {
            void (async () => {
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
                  },
                });
                setMsg(`Created: ${JSON.stringify(res, null, 2)}`);
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'Onboard failed');
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          {busy ? 'Submitting…' : 'Onboard'}
        </button>
      </div>
    </div>
  );
}
