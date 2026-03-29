import { useEffect, useState } from 'react';
import { listBusinesses } from '../api/saasClient';
import type { BusinessRow } from '../types/domain';

export default function BusinessesPage() {
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        setRows(await listBusinesses());
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <h1 className="page-title">Businesses & tenants</h1>
      <p className="muted">
        Each business has a <strong>tenantId</strong> used as{' '}
        <code>X-Tenant-Id</code>. Platform owners see all businesses;
        business admins only see businesses they belong to.
      </p>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
