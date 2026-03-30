import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { listBusinesses, onboardBusiness } from '../api/saasClient';
import { useNavigate } from 'react-router-dom';

const VERTICAL_OPTIONS = [
  { value: 'arena', label: 'Arena' },
  { value: 'gaming-zone', label: 'Gaming Zone' },
  { value: 'snooker', label: 'Snooker' },
  { value: 'table-tennis', label: 'Table Tennis' },
];

export default function OnboardPage() {
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [vertical, setVertical] = useState('arena');
  const [businessType, setBusinessType] = useState('multi_branch');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [subscriptionPlan, setSubscriptionPlan] = useState('premium');
  const [subscriptionStatus, setSubscriptionStatus] = useState('active');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [timezone, setTimezone] = useState('Asia/Karachi');
  const [currency, setCurrency] = useState('PKR');
  const [allowOnlinePayments, setAllowOnlinePayments] = useState(true);
  const [status, setStatus] = useState('active');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkingCompleted, setCheckingCompleted] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<{
    businessName?: string;
    legalName?: string;
    vertical?: string;
    ownerName?: string;
    ownerEmail?: string;
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
    if (!ownerName.trim()) next.ownerName = 'Owner full name is required';
    if (!ownerEmail.trim()) next.ownerEmail = 'Email is required';
    else if (!emailRe.test(ownerEmail.trim())) next.ownerEmail = 'Invalid email';

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
        vertical: vertical.trim() || undefined,
        businessType: businessType.trim() || undefined,
        owner: {
          name: ownerName.trim(),
          email: ownerEmail.trim(),
          phone: ownerPhone.trim() || undefined,
          password: ownerPassword.trim() || undefined,
        },
        subscription: {
          plan: subscriptionPlan.trim() || undefined,
          status: subscriptionStatus.trim() || undefined,
          billingCycle: billingCycle.trim() || undefined,
        },
        settings: {
          timezone: timezone.trim() || undefined,
          currency: currency.trim().toUpperCase() || undefined,
          allowOnlinePayments,
        },
        status: status.trim() || undefined,
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
        style={{ maxWidth: '920px', marginTop: '1rem' }}
      >
        <div className="connection-panel" style={{ margin: 0 }}>
          <h2>Business Info</h2>
          <div className="form-row-2">
            <div>
              <label>Business name</label>
              <input
                name="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                aria-invalid={!!fieldErrors.businessName}
              />
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
          </div>
          <div className="form-row-2">
            <div>
              <label>Vertical</label>
              <select name="vertical" value={vertical} onChange={(e) => setVertical(e.target.value)}>
                {VERTICAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Business type</label>
              <select value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
                <option value="single_branch">Single Branch</option>
                <option value="multi_branch">Multi Branch</option>
                <option value="franchise">Franchise</option>
              </select>
            </div>
          </div>
        </div>
        <div className="connection-panel" style={{ margin: 0 }}>
          <h2>Owner</h2>
          <div className="form-row-2">
            <div>
              <label>Full name</label>
              <input name="ownerName" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
            </div>
            <div>
              <label>Email</label>
              <input name="ownerEmail" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
            </div>
          </div>
          <div className="form-row-2">
            <div>
              <label>Phone (optional)</label>
              <input name="ownerPhone" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} />
            </div>
            <div>
              <label>Password (optional)</label>
              <input name="ownerPassword" type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="connection-panel" style={{ margin: 0 }}>
          <h2>Subscription & Settings</h2>
          <div className="form-row-2">
            <div>
              <label>Subscription plan</label>
              <select value={subscriptionPlan} onChange={(e) => setSubscriptionPlan(e.target.value)}>
                <option value="basic">Basic</option>
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div>
              <label>Subscription status</label>
              <select value={subscriptionStatus} onChange={(e) => setSubscriptionStatus(e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="form-row-2">
            <div>
              <label>Billing cycle</label>
              <select value={billingCycle} onChange={(e) => setBillingCycle(e.target.value)}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label>Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="form-row-2">
            <div>
              <label>Timezone</label>
              <input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
            </div>
            <div>
              <label>Currency</label>
              <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <input type="checkbox" checked={allowOnlinePayments} onChange={(e) => setAllowOnlinePayments(e.target.checked)} />
            Allow online payments
          </label>
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
