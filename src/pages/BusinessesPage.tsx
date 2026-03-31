import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteBusiness, listBusinesses } from '../api/saasClient';
import { useSession } from '../context/SessionContext';
import type { BusinessRow } from '../types/domain';

export default function BusinessesPage() {
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { session, setTenantId } = useSession();
  const canCreateBusiness = (session?.roles ?? []).includes('platform-owner');
  const totalMemberships = rows.reduce((sum, row) => sum + (row.memberships?.length ?? 0), 0);

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

  async function onDelete(businessId: string) {
    const yes = window.confirm('Delete this business? This cannot be undone.');
    if (!yes) return;
    setDeletingId(businessId);
    setErr(null);
    try {
      await deleteBusiness(businessId);
      await reloadBusinesses();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  function toProperCase(value?: string | null): string {
    if (!value) return '—';
    return value
      .replace(/[_-]+/g, ' ')
      .trim()
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
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
            <h2>Avg members / business</h2>
            <strong style={{ fontSize: '1.25rem' }}>
              {rows.length > 0 ? (totalMemberships / rows.length).toFixed(1) : '0.0'}
            </strong>
          </div>
        </div>
      )}
      {canCreateBusiness && (
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
          <Link to="/app/businesses/new" className="btn-primary">
            Add business
          </Link>
        </div>
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
                <th>Type</th>
                <th>Status</th>
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
                  <td>{toProperCase(b.businessType)}</td>
                  <td>{toProperCase(b.status ?? 'active')}</td>
                  <td>{b.memberships?.length ?? 0}</td>
                  <td style={{ width: '260px' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <Link
                        to={`/app/businesses/${b.id}`}
                        className="action-link"
                        onClick={() => setTenantId(b.tenantId)}
                      >
                        Tenant Stats
                      </Link>
                      <Link
                        to={`/app/businesses/${b.id}/edit`}
                        className="action-link"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        className="btn-danger"
                        style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                        disabled={deletingId === b.id}
                        onClick={() => void onDelete(b.id)}
                      >
                        {deletingId === b.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
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
