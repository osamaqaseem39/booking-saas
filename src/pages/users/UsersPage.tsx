import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  activateIamUser,
  deleteIamUser,
  listAllBookings,
  listBookings,
  listEndUsers,
  listIamUsers,
} from '../../api/saasClient';
import { useSession } from '../../context/SessionContext';
import type { IamUserRow } from '../../types/domain';
import type { BookingRecord } from '../../types/booking';

type PeopleKind = 'staff' | 'customers';

function isCustomerOnly(u: IamUserRow): boolean {
  const roles = u.roles ?? [];
  return roles.length === 1 && roles[0] === 'customer-end-user';
}

function iamUserIsActive(u: IamUserRow): boolean {
  return u.isActive !== false;
}

function toChartRows(input: Record<string, number>) {
  const rows = Object.entries(input)
    .map(([key, value]) => ({
      key,
      label: key,
      value: Number(value ?? 0),
    }))
    .sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return rows.map((row) => ({
    ...row,
    widthPct: row.value > 0 ? Math.max(10, Math.round((row.value / max) * 100)) : 0,
    pct: total > 0 ? Math.round((row.value / total) * 100) : 0,
  }));
}

function classifyUserSource(roles: string[] | undefined): string {
  const r = new Set(roles ?? []);
  if (r.has('platform-owner')) return 'Platform';
  if (r.has('business-admin')) return 'Business admin';
  if (r.has('business-staff')) return 'Business staff';
  if (r.has('customer-end-user')) return 'Customer app';
  return 'Unknown';
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
  const [customerBookings, setCustomerBookings] = useState<BookingRecord[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);

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
      const raw = await listIamUsers({ search, sortBy, sortOrder }, undefined, isPlatformOwner);
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
        const [all, bookingsForStats] = await Promise.all([
          listEndUsers(),
          (async () => {
            if (isPlatformOwner) {
              return listAllBookings();
            }
            return listBookings().catch(() => [] as BookingRecord[]);
          })(),
        ]);
        setCustomerRows(
          all.filter((u) => (u.roles ?? []).some((role) => role === 'customer-end-user')),
        );
        setCustomerBookings(bookingsForStats);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load customers');
        setCustomerRows([]);
        setCustomerBookings([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [kind, isPlatformOwner]);

  async function onDeactivate(userId: string) {
    const yes = window.confirm(
      'Deactivate this account? They cannot sign in until a platform owner reactivates them.',
    );
    if (!yes) return;
    setDeletingId(userId);
    setErr(null);
    try {
      await deleteIamUser(userId);
      if (kind === 'staff') void reloadStaff();
      else {
        setCustomerRows((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, isActive: false } : u)),
        );
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Deactivate failed');
    } finally {
      setDeletingId(null);
    }
  }

  async function onActivate(userId: string) {
    setActivatingId(userId);
    setErr(null);
    try {
      const updated = await activateIamUser(userId);
      if (kind === 'staff') void reloadStaff();
      else {
        setCustomerRows((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, ...updated, isActive: true } : u)),
        );
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Activate failed');
    } finally {
      setActivatingId(null);
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

  const customerSpendById = useMemo(() => {
    const out: Record<string, { amount: number; bookings: number }> = {};
    for (const b of customerBookings) {
      const id = b.userId;
      if (!out[id]) out[id] = { amount: 0, bookings: 0 };
      out[id].amount += Number(b.pricing?.totalAmount ?? 0);
      out[id].bookings += 1;
    }
    return out;
  }, [customerBookings]);

  const customerSourceChart = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of visibleCustomers) {
      const source = classifyUserSource(u.roles);
      counts[source] = (counts[source] ?? 0) + 1;
    }
    return toChartRows(counts);
  }, [visibleCustomers]);

  const customerSpendingBandChart = useMemo(() => {
    const bands: Record<string, number> = {
      'No spend': 0,
      '1 - 4,999': 0,
      '5,000 - 19,999': 0,
      '20,000+': 0,
    };
    for (const u of visibleCustomers) {
      const spend = customerSpendById[u.id]?.amount ?? 0;
      if (spend <= 0) bands['No spend'] += 1;
      else if (spend < 5000) bands['1 - 4,999'] += 1;
      else if (spend < 20000) bands['5,000 - 19,999'] += 1;
      else bands['20,000+'] += 1;
    }
    return toChartRows(bands);
  }, [customerSpendById, visibleCustomers]);

  const customerSpendTotals = useMemo(() => {
    let totalSpend = 0;
    let customersWithSpend = 0;
    let topSpender: { name: string; amount: number } | null = null;
    for (const u of visibleCustomers) {
      const spend = customerSpendById[u.id]?.amount ?? 0;
      totalSpend += spend;
      if (spend > 0) customersWithSpend += 1;
      if (!topSpender || spend > topSpender.amount) {
        topSpender = { name: u.fullName || u.email, amount: spend };
      }
    }
    return {
      totalSpend,
      customersWithSpend,
      avgSpend: visibleCustomers.length > 0 ? totalSpend / visibleCustomers.length : 0,
      topSpender,
    };
  }, [customerSpendById, visibleCustomers]);

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
                    <th>Status</th>
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
                        {iamUserIsActive(u) ? (
                          <span className="muted">Active</span>
                        ) : (
                          <span className="muted">Inactive</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <Link to={`/app/users/${u.id}`} className="action-link">
                            View
                          </Link>
                          <Link to={`/app/users/${u.id}/edit`} className="action-link">
                            Edit
                          </Link>
                          {iamUserIsActive(u) ? (
                            <button
                              type="button"
                              className="btn-danger"
                              style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                              disabled={deletingId === u.id}
                              onClick={() => void onDeactivate(u.id)}
                            >
                              {deletingId === u.id ? 'Working…' : 'Deactivate'}
                            </button>
                          ) : isPlatformOwner ? (
                            <button
                              type="button"
                              className="btn-primary"
                              style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                              disabled={activatingId === u.id}
                              onClick={() => void onActivate(u.id)}
                            >
                              {activatingId === u.id ? 'Working…' : 'Activate'}
                            </button>
                          ) : (
                            <span className="muted" style={{ fontSize: '0.75rem' }}>
                              Inactive
                            </span>
                          )}
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
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>Total spend</h2>
              <strong style={{ fontSize: '1.25rem' }}>
                {customerSpendTotals.totalSpend.toLocaleString()} PKR
              </strong>
            </div>
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>Avg spend / user</h2>
              <strong style={{ fontSize: '1.25rem' }}>
                {Math.round(customerSpendTotals.avgSpend).toLocaleString()} PKR
              </strong>
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '0.75rem',
              margin: '0.75rem 0',
            }}
          >
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h3 style={{ margin: '0 0 0.65rem', fontSize: '0.95rem' }}>Users source</h3>
              <div className="overview-source-bars">
                {customerSourceChart.map((row) => (
                  <div key={row.key} className="overview-source-row">
                    <span className="overview-source-label">{row.label}</span>
                    <div className="overview-source-track">
                      <div
                        className="overview-source-fill overview-source-fill--app"
                        style={{ width: `${row.widthPct}%` }}
                      />
                    </div>
                    <span className="overview-source-value">
                      {row.value} ({row.pct}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h3 style={{ margin: '0 0 0.65rem', fontSize: '0.95rem' }}>Spending bands</h3>
              <div className="overview-source-bars">
                {customerSpendingBandChart.map((row) => (
                  <div key={row.key} className="overview-source-row">
                    <span className="overview-source-label">{row.label}</span>
                    <div className="overview-source-track">
                      <div
                        className="overview-source-fill overview-source-fill--call"
                        style={{ width: `${row.widthPct}%` }}
                      />
                    </div>
                    <span className="overview-source-value">
                      {row.value} ({row.pct}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {customerSpendTotals.topSpender ? (
            <p className="muted" style={{ marginTop: '-0.1rem' }}>
              Top customer by spending: <strong>{customerSpendTotals.topSpender.name}</strong> (
              {Math.round(customerSpendTotals.topSpender.amount).toLocaleString()} PKR).
              Customers with spend: {customerSpendTotals.customersWithSpend}.
            </p>
          ) : null}
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
                    <th>Status</th>
                    <th>Bookings</th>
                    <th>Spending</th>
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
                        {iamUserIsActive(u) ? (
                          <span className="muted">Active</span>
                        ) : (
                          <span className="muted">Inactive</span>
                        )}
                      </td>
                      <td>{customerSpendById[u.id]?.bookings ?? 0}</td>
                      <td>{Math.round(customerSpendById[u.id]?.amount ?? 0).toLocaleString()} PKR</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <Link to={`/app/users/${u.id}`} className="action-link">
                            View
                          </Link>
                          <Link to={`/app/users/${u.id}/edit`} className="action-link">
                            Edit
                          </Link>
                          {iamUserIsActive(u) ? (
                            <button
                              type="button"
                              className="btn-danger"
                              style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                              disabled={deletingId === u.id}
                              onClick={() => void onDeactivate(u.id)}
                            >
                              {deletingId === u.id ? 'Working…' : 'Deactivate'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-primary"
                              style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                              disabled={activatingId === u.id}
                              onClick={() => void onActivate(u.id)}
                            >
                              {activatingId === u.id ? 'Working…' : 'Activate'}
                            </button>
                          )}
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

