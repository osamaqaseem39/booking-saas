import { useEffect, useState } from 'react';
import { listBusinesses } from '../api/saasClient';
import { useSession } from '../context/SessionContext';
import { useNavigate } from 'react-router-dom';
import type { BusinessRow } from '../types/domain';

export default function BusinessesPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { session, setTenantId } = useSession();
  const canCreateBusiness = (session?.roles ?? []).includes('platform-owner');
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
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate('/app/businesses/new')}
          >
            Add business
          </button>
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
