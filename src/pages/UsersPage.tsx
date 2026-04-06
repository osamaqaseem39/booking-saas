import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { deleteIamUser, listEndUsers, listIamUsers } from '../api/saasClient';
import { useSession } from '../context/SessionContext';
import type { IamUserRow } from '../types/domain';

type PeopleKind = 'staff' | 'customers';

function isCustomerOnly(u: IamUserRow): boolean {
  const roles = u.roles ?? [];
  return roles.length === 1 && roles[0] === 'customer-end-user';
}

export default function UsersPage() {
  const { session } = useSession();
  const isPlatformOwner = session?.roles?.includes('platform-owner') ?? false;
  const [searchParams, setSearchParams] = useSearchParams();

  const kind: PeopleKind =
    isPlatformOwner && searchParams.get('kind') === 'customers' ? 'customers' : 'staff';

  const setKind = (next: PeopleKind) => {
    if (next === 'customers') setSearchParams({ kind: 'customers' });
    else setSearchParams({});
  };

  const [staffRows, setStaffRows] = useState<IamUserRow[]>([]);
  const [customerRows, setCustomerRows] = useState<IamUserRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'fullName' | 'email'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  const [query, setQuery] = useState('');
  const [custSortBy, setCustSortBy] = useState<'name' | 'email' | 'phone'>('name');
  const [custSortDir, setCustSortDir] = useState<'asc' | 'desc'>('asc');

  const reloadStaff = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const raw = await listIamUsers({ search, sortBy, sortOrder });
      const filtered = isPlatformOwner ? raw.filter((u) => !isCustomerOnly(u)) : raw;
      setStaffRows(filtered);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load users');
      setStaffRows([]);
    } finally {
      setLoading(false);
    }
  }, [search, sortBy, sortOrder, isPlatformOwner]);

  useEffect(() => {
    if (kind !== 'staff') return;
    void reloadStaff();
  }, [kind, reloadStaff]);

  useEffect(() => {
    if (kind !== 'customers') return;
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const all = await listEndUsers();
        setCustomerRows(
          all.filter((u) => (u.roles ?? []).some((role) => role === 'customer-end-user')),
        );
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load customers');
        setCustomerRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [kind]);

  async function onDelete(userId: string) {
    const yes = window.confirm('Delete this user? This cannot be undone.');
    if (!yes) return;
    setDeletingId(userId);
    setErr(null);
    try {
      await deleteIamUser(userId);
      if (kind === 'staff') void reloadStaff();
      else {
        setCustomerRows((prev) => prev.filter((u) => u.id !== userId));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  const businessAdminCount = useMemo(
    () =>
      staffRows.filter((u) => (u.roles ?? []).includes('business-admin')).length,
    [staffRows],
  );

  const thisMonthCustomerCount = useMemo(() => {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    return customerRows.filter((u) => {
      const createdAt = u.createdAt;
      if (!createdAt) return false;
      const parsed = new Date(createdAt);
      if (Number.isNaN(parsed.getTime())) return false;
      return parsed.getMonth() === m && parsed.getFullYear() === y;
    }).length;
  }, [customerRows]);

  const visibleCustomers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = customerRows.filter((u) => {
      if (!q) return true;
      const haystack = [u.fullName, u.email, u.phone ?? '', ...(u.roles ?? [])]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
    return [...filtered].sort((a, b) => {
      const av = (
        custSortBy === 'name' ? a.fullName : custSortBy === 'email' ? a.email : a.phone ?? ''
      )
        .toLowerCase()
        .trim();
      const bv = (
        custSortBy === 'name' ? b.fullName : custSortBy === 'email' ? b.email : b.phone ?? ''
      )
        .toLowerCase()
        .trim();
      const cmp = av.localeCompare(bv);
      return custSortDir === 'asc' ? cmp : -cmp;
    });
  }, [query, customerRows, custSortBy, custSortDir]);

  const pageSubtitle =
    kind === 'customers'
      ? 'End users with the customer-end-user role (platform-wide).'
      : isPlatformOwner
        ? 'Business admins, staff, and other non–customer-only accounts for the active tenant.'
        : 'Manage business staff accounts and role access.';

  return (
    <div>
      <div className="page-head-row">
        <h1 className="page-title">Users</h1>
        <Link to="/app/users/new" className="btn-primary">
          Add user
        </Link>
      </div>
      <p className="muted">{pageSubtitle}</p>

      {isPlatformOwner && (
        <div style={{ marginTop: '0.75rem' }}>
          <span className="muted" style={{ display: 'block', marginBottom: '0.35rem' }}>
            Show
          </span>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={kind === 'staff' ? 'btn-primary' : 'btn-ghost'}
              style={{ padding: '0.35rem 0.75rem', borderRadius: '999px', fontSize: '0.86rem' }}
              onClick={() => setKind('staff')}
            >
              Admins & staff
            </button>
            <button
              type="button"
              className={kind === 'customers' ? 'btn-primary' : 'btn-ghost'}
              style={{ padding: '0.35rem 0.75rem', borderRadius: '999px', fontSize: '0.86rem' }}
              onClick={() => setKind('customers')}
            >
              Customers
            </button>
          </div>
        </div>
      )}

      {err && <div className="err-banner">{err}</div>}

      {kind === 'staff' ? (
        <>
          <div className="connection-grid" style={{ marginTop: '1rem' }}>
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>Total</h2>
              <strong style={{ fontSize: '1.25rem' }}>{staffRows.length}</strong>
            </div>
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>Business admins</h2>
              <strong style={{ fontSize: '1.25rem' }}>{businessAdminCount}</strong>
            </div>
          </div>
          <div className="connection-panel" style={{ margin: 0, marginBottom: '1rem' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(220px, 1fr) 180px 140px',
                gap: '0.75rem',
                alignItems: 'end',
              }}
            >
              <label>
                <span className="muted">Search</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name, email, or phone"
                />
              </label>
              <label>
                <span className="muted">Sort by</span>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
                  <option value="createdAt">Newest</option>
                  <option value="fullName">Name</option>
                  <option value="email">Email</option>
                </select>
              </label>
              <label>
                <span className="muted">Order</span>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
                >
                  <option value="DESC">Descending</option>
                  <option value="ASC">Ascending</option>
                </select>
              </label>
            </div>
          </div>
          <div className="table-wrap" style={{ marginTop: '1rem' }}>
            {loading ? (
              <div className="empty-state">Loading…</div>
            ) : staffRows.length === 0 ? (
              <div className="empty-state">No users match this filter.</div>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Roles</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staffRows.map((u) => (
                    <tr key={u.id}>
                      <td>{u.fullName}</td>
                      <td>{u.email}</td>
                      <td>{u.phone ?? '—'}</td>
                      <td>
                        <code style={{ fontSize: '0.75rem' }}>
                          {(u.roles ?? []).join(', ') || '—'}
                        </code>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <Link to={`/app/users/${u.id}`} className="action-link">
                            View
                          </Link>
                          <Link to={`/app/users/${u.id}/edit`} className="action-link">
                            Edit
                          </Link>
                          <button
                            type="button"
                            className="btn-danger"
                            style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                            disabled={deletingId === u.id}
                            onClick={() => void onDelete(u.id)}
                          >
                            {deletingId === u.id ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="connection-grid" style={{ marginTop: '1rem' }}>
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>Total customers</h2>
              <strong style={{ fontSize: '1.25rem' }}>{customerRows.length}</strong>
            </div>
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>New this month</h2>
              <strong style={{ fontSize: '1.25rem' }}>{thisMonthCustomerCount}</strong>
            </div>
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>Showing</h2>
              <strong style={{ fontSize: '1.25rem' }}>{visibleCustomers.length}</strong>
            </div>
          </div>
          <div className="connection-panel" style={{ margin: 0 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(220px, 1fr) 180px 140px',
                gap: '0.75rem',
                alignItems: 'end',
              }}
            >
              <label>
                <span className="muted">Search</span>
                <input
                  placeholder="Name, email, phone, or role"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <label>
                <span className="muted">Sort by</span>
                <select
                  value={custSortBy}
                  onChange={(e) => setCustSortBy(e.target.value as typeof custSortBy)}
                >
                  <option value="name">Name</option>
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                </select>
              </label>
              <label>
                <span className="muted">Order</span>
                <select
                  value={custSortDir}
                  onChange={(e) => setCustSortDir(e.target.value as typeof custSortDir)}
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </label>
            </div>
          </div>
          <div className="table-wrap" style={{ marginTop: '1rem' }}>
            {loading ? (
              <div className="empty-state">Loading…</div>
            ) : visibleCustomers.length === 0 ? (
              <div className="empty-state">No customers yet.</div>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Roles</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCustomers.map((u) => (
                    <tr key={u.id}>
                      <td>{u.fullName}</td>
                      <td>{u.email}</td>
                      <td>{u.phone ?? '—'}</td>
                      <td>
                        <code style={{ fontSize: '0.75rem' }}>
                          {(u.roles ?? []).join(', ')}
                        </code>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <Link to={`/app/users/${u.id}`} className="action-link">
                            View
                          </Link>
                          <Link to={`/app/users/${u.id}/edit`} className="action-link">
                            Edit
                          </Link>
                          <button
                            type="button"
                            className="btn-danger"
                            style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                            disabled={deletingId === u.id}
                            onClick={() => void onDelete(u.id)}
                          >
                            {deletingId === u.id ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
