import type { FormEvent } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onboardBusiness } from '../api/saasClient';

export default function BusinessCreatePage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [vertical, setVertical] = useState('arena');
  const [businessType, setBusinessType] = useState('multi_branch');
  const [sportsOfferedText, setSportsOfferedText] = useState('futsal, cricket, padel');
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
  const [fieldErrors, setFieldErrors] = useState<{
    businessName?: string;
    ownerName?: string;
    ownerEmail?: string;
  }>({});

  const emailRe = /^\S+@\S+\.\S+$/;

  function validate(): boolean {
    const next: typeof fieldErrors = {};
    if (!businessName.trim()) next.businessName = 'Business name is required';
    if (!ownerName.trim()) next.ownerName = 'Owner name is required';
    if (!ownerEmail.trim()) next.ownerEmail = 'Owner email is required';
    else if (!emailRe.test(ownerEmail.trim())) next.ownerEmail = 'Invalid owner email';
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
        tenantId: tenantId.trim() || undefined,
        businessName: businessName.trim(),
        legalName: legalName.trim() || undefined,
        vertical: vertical.trim() || undefined,
        businessType: businessType.trim() || undefined,
        sportsOffered: sportsOfferedText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
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
          currency: currency.trim() || undefined,
          allowOnlinePayments,
        },
        status: status.trim() || undefined,
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
          <label>Tenant ID (optional)</label>
          <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
        </div>
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
          <select value={vertical} onChange={(e) => setVertical(e.target.value)}>
            <option value="arena">arena</option>
            <option value="gaming-zone">gaming-zone</option>
            <option value="snooker">snooker</option>
            <option value="table-tennis">table-tennis</option>
          </select>
        </div>
        <h4 className="muted" style={{ margin: '0.5rem 0 0' }}>
          Business profile
        </h4>
        <div>
          <label>Business type</label>
          <input value={businessType} onChange={(e) => setBusinessType(e.target.value)} />
        </div>
        <div>
          <label>Sports offered (comma separated)</label>
          <input value={sportsOfferedText} onChange={(e) => setSportsOfferedText(e.target.value)} />
        </div>
        <div>
          <label>Subscription plan</label>
          <input value={subscriptionPlan} onChange={(e) => setSubscriptionPlan(e.target.value)} />
        </div>
        <div className="form-row-2">
          <div>
            <label>Subscription status</label>
            <select value={subscriptionStatus} onChange={(e) => setSubscriptionStatus(e.target.value)}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </div>
          <div>
            <label>Billing cycle</label>
            <select value={billingCycle} onChange={(e) => setBillingCycle(e.target.value)}>
              <option value="monthly">monthly</option>
              <option value="yearly">yearly</option>
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
            <input value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </div>
        </div>
        <div className="form-row-2">
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <input
              type="checkbox"
              checked={allowOnlinePayments}
              onChange={(e) => setAllowOnlinePayments(e.target.checked)}
            />
            Allow online payments
          </label>
          <div>
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </div>
        </div>
        <h4 className="muted" style={{ margin: '0.5rem 0 0' }}>
          Owner
        </h4>
        <div>
          <label>Full name</label>
          <input
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            aria-invalid={!!fieldErrors.ownerName}
          />
          {fieldErrors.ownerName && (
            <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
              {fieldErrors.ownerName}
            </div>
          )}
        </div>
        <div>
          <label>Email</label>
          <input
            type="email"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            aria-invalid={!!fieldErrors.ownerEmail}
          />
          {fieldErrors.ownerEmail && (
            <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
              {fieldErrors.ownerEmail}
            </div>
          )}
        </div>
        <div>
          <label>Phone (optional)</label>
          <input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} />
        </div>
        <div>
          <label>Password (optional)</label>
          <input
            type="password"
            value={ownerPassword}
            onChange={(e) => setOwnerPassword(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Creating…' : 'Create business'}
        </button>
      </form>
    </div>
  );
}
