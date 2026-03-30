import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { deleteBusiness, listBusinesses, updateBusiness } from '../api/saasClient';
import type { BusinessRow } from '../types/domain';

export default function BusinessEditPage() {
  const { businessId = '' } = useParams<{ businessId: string }>();
  const navigate = useNavigate();
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [vertical, setVertical] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [subscriptionPlan, setSubscriptionPlan] = useState('');
  const [subscriptionStatus, setSubscriptionStatus] = useState('active');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [timezone, setTimezone] = useState('');
  const [currency, setCurrency] = useState('');
  const [allowOnlinePayments, setAllowOnlinePayments] = useState(false);
  const [status, setStatus] = useState('active');

  const business = useMemo(
    () => rows.find((r) => r.id === businessId) ?? null,
    [rows, businessId],
  );

  useEffect(() => {
    if (!businessId.trim()) return;
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        setRows(await listBusinesses());
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load business');
      } finally {
        setLoading(false);
      }
    })();
  }, [businessId]);

  useEffect(() => {
    if (!business) return;
    setBusinessName(business.businessName);
    setLegalName(business.legalName ?? '');
    setVertical(business.vertical ?? '');
    setBusinessType(business.businessType ?? '');
    setOwnerName(business.owner?.name ?? '');
    setOwnerEmail(business.owner?.email ?? '');
    setOwnerPhone(business.owner?.phone ?? '');
    setSubscriptionPlan(business.subscription?.plan ?? '');
    setSubscriptionStatus(business.subscription?.status ?? 'active');
    setBillingCycle(business.subscription?.billingCycle ?? 'monthly');
    setTimezone(business.settings?.timezone ?? '');
    setCurrency(business.settings?.currency ?? '');
    setAllowOnlinePayments(Boolean(business.settings?.allowOnlinePayments));
    setStatus(business.status ?? 'active');
  }, [business]);

  async function onSave() {
    if (!businessId.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      await updateBusiness(businessId, {
        businessName: businessName.trim(),
        legalName: legalName.trim() || undefined,
        vertical: vertical.trim() || undefined,
        businessType: businessType.trim() || undefined,
        owner: {
          name: ownerName.trim() || undefined,
          email: ownerEmail.trim() || undefined,
          phone: ownerPhone.trim() || undefined,
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
      setErr(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!businessId.trim()) return;
    const yes = window.confirm(
      'Delete this business? This cannot be undone and removes tenant access in dashboard lists.',
    );
    if (!yes) return;

    setDeleting(true);
    setErr(null);
    try {
      await deleteBusiness(businessId);
      navigate('/app/businesses', { replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  if (!businessId.trim()) return <p className="muted">Missing business id.</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
        <h1 className="page-title">Edit business</h1>
        <button type="button" className="btn-ghost" onClick={() => navigate('/app/businesses')}>
          Back to list
        </button>
      </div>
      {err && <div className="err-banner">{err}</div>}
      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : !business ? (
        <div className="empty-state">Business not found.</div>
      ) : (
        <div className="form-grid" style={{ maxWidth: '920px' }}>
          <div className="connection-panel" style={{ margin: 0 }}>
            <h2>Business Info</h2>
            <div className="form-row-2">
              <div>
                <label>Business name</label>
                <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
              </div>
              <div>
                <label>Legal name (optional)</label>
                <input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
              </div>
            </div>
            <div className="form-row-2">
              <div>
                <label>Vertical</label>
                <select value={vertical} onChange={(e) => setVertical(e.target.value)}>
                  <option value="arena">Arena</option>
                  <option value="gaming-zone">Gaming Zone</option>
                  <option value="snooker">Snooker</option>
                  <option value="table-tennis">Table Tennis</option>
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
                <label>Owner name</label>
                <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
              </div>
              <div>
                <label>Owner email</label>
                <input value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
              </div>
            </div>
            <div>
              <label>Owner phone</label>
              <input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} />
            </div>
          </div>
          <div className="connection-panel" style={{ margin: 0 }}>
            <h2>Subscription & Settings</h2>
            <div className="form-row-2">
              <div>
                <label>Plan</label>
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
                <label>Business status</label>
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
              <input
                type="checkbox"
                checked={allowOnlinePayments}
                onChange={(e) => setAllowOnlinePayments(e.target.checked)}
              />
              Allow online payments
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn-primary"
              disabled={saving || !businessName.trim() || !vertical.trim()}
              onClick={() => void onSave()}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" className="btn-danger" disabled={deleting} onClick={() => void onDelete()}>
              {deleting ? 'Deleting…' : 'Delete business'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
