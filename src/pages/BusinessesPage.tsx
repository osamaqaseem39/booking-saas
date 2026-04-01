import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteBusiness, listBusinesses } from '../api/saasClient';
import { useSession } from '../context/SessionContext';
import type { BusinessRow } from '../types/domain';

export default function BusinessesPage() {
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'tenantId' | 'members'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const { session, setTenantId } = useSession();
  const canCreateBusiness = (session?.roles ?? []).includes('platform-owner');

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

  const typeOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.businessType).filter(Boolean) as string[])).sort(
        (a, b) => a.localeCompare(b),
      ),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      const normalizedStatus = (r.status ?? 'active').toLowerCase();
      if (statusFilter !== 'all' && normalizedStatus !== statusFilter) return false;
      if (typeFilter !== 'all' && (r.businessType ?? '') !== typeFilter) return false;
      if (!q) return true;
      return (
        (r.businessName ?? '').toLowerCase().includes(q) ||
        (r.tenantId ?? '').toLowerCase().includes(q) ||
        (r.businessType ?? '').toLowerCase().includes(q)
      );
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortBy === 'tenantId') return a.tenantId.localeCompare(b.tenantId) * dir;
      if (sortBy === 'members') {
        return ((a.memberships?.length ?? 0) - (b.memberships?.length ?? 0)) * dir;
      }
      return a.businessName.localeCompare(b.businessName) * dir;
    });
  }, [query, rows, sortBy, sortDir, statusFilter, typeFilter]);

  const totalMemberships = useMemo(
    () => filteredRows.reduce((sum, row) => sum + (row.memberships?.length ?? 0), 0),
    [filteredRows],
  );

  return (
    <div>
      <div className="page-head-row">
        <h1 className="page-title">Businesses & tenants</h1>
        {canCreateBusiness && (
          <Link to="/app/businesses/new" className="btn-primary">
            Add business
          </Link>
        )}
      </div>
      <p className="muted">
        Each business has a <strong>tenantId</strong> used as{' '}
        <code>X-Tenant-Id</code>. Platform owners see all businesses;
        business admins only see businesses they belong to.
      </p>
      {!loading && rows.length > 0 && (
        <div className="connection-grid" style={{ marginTop: '1rem' }}>
          <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
            <h2>Businesses in view</h2>
            <strong style={{ fontSize: '1.25rem' }}>{filteredRows.length}</strong>
          </div>
          <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
            <h2>Members in view</h2>
            <strong style={{ fontSize: '1.25rem' }}>{totalMemberships}</strong>
          </div>
          <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
            <h2>Avg members / business</h2>
            <strong style={{ fontSize: '1.25rem' }}>
              {filteredRows.length > 0
                ? (totalMemberships / filteredRows.length).toFixed(1)
                : '0.0'}
            </strong>
          </div>
        </div>
      )}
      {err && <div className="err-banner">{err}</div>}
      <div className="connection-panel" style={{ marginTop: '1rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.75rem',
            maxWidth: '980px',
          }}
        >
          <div>
            <label>Search</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, tenant ID, type"
            />
          </div>
          <div>
            <label>Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label>Type</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All types</option>
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {toProperCase(t)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Sort by</label>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as 'name' | 'tenantId' | 'members')
              }
            >
              <option value="name">Name</option>
              <option value="tenantId">Tenant ID</option>
              <option value="members">Members</option>
            </select>
          </div>
          <div>
            <label>Order</label>
            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
        </div>
      </div>
      <div className="table-wrap" style={{ marginTop: '1rem' }}>
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : filteredRows.length === 0 ? (
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
              {filteredRows.map((b) => (
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
