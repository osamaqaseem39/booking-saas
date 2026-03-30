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
  }, [business]);

  async function onSave() {
    if (!businessId.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      await updateBusiness(businessId, {
        businessName: businessName.trim(),
        legalName: legalName.trim() || undefined,
        vertical: vertical.trim(),
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
        <div className="form-grid" style={{ maxWidth: '560px' }}>
          <div>
            <label>Business name</label>
            <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          </div>
          <div>
            <label>Legal name (optional)</label>
            <input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
          </div>
          <div>
            <label>Vertical</label>
            <input value={vertical} onChange={(e) => setVertical(e.target.value)} />
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
