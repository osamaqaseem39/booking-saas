import type { FormEvent } from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { onboardBusiness } from '../../api/saasClient';
import { normalizePhoneForStorage } from '../../utils/phone';

const PLAN_OPTIONS = [
  { value: 'basic', label: 'Basic' },
  { value: 'standard', label: 'Standard' },
  { value: 'premium', label: 'Premium' },
  { value: 'enterprise', label: 'Enterprise' },
];

const BILLING_CYCLE_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

export default function BusinessCreatePage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [legalName, setLegalName] = useState('');
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
    tenantId?: string;
    businessName?: string;
    legalName?: string;
    ownerName?: string;
    ownerEmail?: string;
    ownerPhone?: string;
    ownerPassword?: string;
    timezone?: string;
    currency?: string;
  }>({});

  const emailRe = /^\S+@\S+\.\S+$/;
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function validate(): boolean {
    const next: typeof fieldErrors = {};
    if (tenantId.trim() && !uuidRe.test(tenantId.trim())) {
      next.tenantId = 'Tenant ID must be a valid UUID';
    }
    if (!businessName.trim()) next.businessName = 'Business name is required';
    if (legalName.trim() && legalName.trim().length < 2) {
      next.legalName = 'Legal name must be at least 2 characters';
    }
    if (!ownerName.trim()) next.ownerName = 'Owner name is required';
    if (!ownerEmail.trim()) next.ownerEmail = 'Owner email is required';
    else if (!emailRe.test(ownerEmail.trim())) next.ownerEmail = 'Invalid owner email';
    const normalizedOwnerPhone = normalizePhoneForStorage(ownerPhone);
    const digitsCount = normalizedOwnerPhone.replace(/\D/g, '').length;
    if (ownerPhone.trim() && digitsCount < 7) {
      next.ownerPhone = 'Phone must include at least 7 digits';
    }
    if (ownerPassword.trim() && ownerPassword.trim().length < 8) {
      next.ownerPassword = 'Password must be at least 8 characters';
    }
    if (!timezone.trim()) next.timezone = 'Timezone is required';
    if (!currency.trim()) next.currency = 'Currency is required';
    else if (!/^[A-Za-z]{3}$/.test(currency.trim())) {
      next.currency = 'Currency must be a 3-letter code (e.g. PKR)';
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
      const normalizedOwnerPhone = normalizePhoneForStorage(ownerPhone);
      await onboardBusiness({
        tenantId: tenantId.trim() || undefined,
        businessName: businessName.trim(),
        legalName: legalName.trim() || undefined,
        owner: {
          name: ownerName.trim(),
          email: ownerEmail.trim(),
          phone: normalizedOwnerPhone || undefined,
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
        <Link to="/app/businesses" className="btn-ghost btn-compact">
          Back to list
        </Link>
      </div>
      <p className="muted">
        Create business profile, owner, subscription, and settings.
      </p>

      {err && <div className="err-banner">{err}</div>}

      <form
        onSubmit={onSubmit}
        className="form-grid"
        style={{ maxWidth: '920px', margin: '1rem auto 0' }}
      >
        <div className="connection-panel" style={{ margin: 0 }}>
          <h2>Business Info</h2>
          <div className="form-row-2">
            <div>
              <label>Business Name *</label>
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                aria-invalid={!!fieldErrors.businessName}
              />
              {fieldErrors.businessName && <div className="muted" style={{ color: 'var(--danger)' }}>{fieldErrors.businessName}</div>}
            </div>
            <div>
              <label>Tenant ID (optional)</label>
              <input value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="UUID" />
              {fieldErrors.tenantId && <div className="muted" style={{ color: 'var(--danger)' }}>{fieldErrors.tenantId}</div>}
            </div>
          </div>
          <div>
            <label>Legal Name (optional)</label>
            <input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
            {fieldErrors.legalName && <div className="muted" style={{ color: 'var(--danger)' }}>{fieldErrors.legalName}</div>}
          </div>
          <div>
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="connection-panel" style={{ margin: 0 }}>
          <h2>Owner</h2>
          <div className="form-row-2">
            <div>
              <label>Full Name *</label>
              <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} aria-invalid={!!fieldErrors.ownerName} />
              {fieldErrors.ownerName && <div className="muted" style={{ color: 'var(--danger)' }}>{fieldErrors.ownerName}</div>}
            </div>
            <div>
              <label>Email *</label>
              <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} aria-invalid={!!fieldErrors.ownerEmail} />
              {fieldErrors.ownerEmail && <div className="muted" style={{ color: 'var(--danger)' }}>{fieldErrors.ownerEmail}</div>}
            </div>
          </div>
          <div className="form-row-2">
            <div>
              <label>Phone (optional)</label>
              <input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} placeholder="+92..." />
              {fieldErrors.ownerPhone && <div className="muted" style={{ color: 'var(--danger)' }}>{fieldErrors.ownerPhone}</div>}
            </div>
            <div>
              <label>Password (optional)</label>
              <input type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} placeholder="Min 8 chars if provided" />
              {fieldErrors.ownerPassword && <div className="muted" style={{ color: 'var(--danger)' }}>{fieldErrors.ownerPassword}</div>}
            </div>
          </div>
        </div>

        <div className="connection-panel" style={{ margin: 0 }}>
          <h2>Subscription & Settings</h2>
          <div className="form-row-2">
            <div>
              <label>Plan</label>
              <select value={subscriptionPlan} onChange={(e) => setSubscriptionPlan(e.target.value)}>
                {PLAN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Subscription Status</label>
              <select value={subscriptionStatus} onChange={(e) => setSubscriptionStatus(e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="form-row-2">
            <div>
              <label>Billing Cycle</label>
              <select value={billingCycle} onChange={(e) => setBillingCycle(e.target.value)}>
                {BILLING_CYCLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Timezone *</label>
              <input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
              {fieldErrors.timezone && <div className="muted" style={{ color: 'var(--danger)' }}>{fieldErrors.timezone}</div>}
            </div>
          </div>
          <div className="form-row-2">
            <div>
              <label>Currency *</label>
              <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
              {fieldErrors.currency && <div className="muted" style={{ color: 'var(--danger)' }}>{fieldErrors.currency}</div>}
            </div>
            <label className="ui-switch">
              <input type="checkbox" checked={allowOnlinePayments} onChange={(e) => setAllowOnlinePayments(e.target.checked)} />
              <span className="ui-switch-track" />
              <span className="ui-switch-text">Allow online payments</span>
            </label>
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Creating…' : 'Create business'}
        </button>
      </form>
    </div>
  );
}

