import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listEndUsers } from '../api/saasClient';
import type { IamUserRow } from '../types/domain';

export default function EndUsersPage() {
  const [rows, setRows] = useState<IamUserRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'email' | 'phone'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const all = await listEndUsers();
        setRows(
          all.filter((u) =>
            (u.roles ?? []).some((role) => role === 'customer-end-user'),
          ),
        );
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const thisMonthCount = useMemo(() => {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    return rows.filter((u) => {
      const createdAt = (u as IamUserRow & { createdAt?: string }).createdAt;
      if (!createdAt) return false;
      const parsed = new Date(createdAt);
      if (Number.isNaN(parsed.getTime())) return false;
      return parsed.getMonth() === m && parsed.getFullYear() === y;
    }).length;
  }, [rows]);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = rows.filter((u) => {
      if (!q) return true;
      const haystack = [u.fullName, u.email, u.phone ?? '', ...(u.roles ?? [])]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });

    const sorted = [...filtered].sort((a, b) => {
      const av = (sortBy === 'name' ? a.fullName : sortBy === 'email' ? a.email : a.phone ?? '')
        .toLowerCase()
        .trim();
      const bv = (sortBy === 'name' ? b.fullName : sortBy === 'email' ? b.email : b.phone ?? '')
        .toLowerCase()
        .trim();
      const cmp = av.localeCompare(bv);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [query, rows, sortBy, sortDir]);

  return (
    <div>
      <h1 className="page-title">Customers</h1>
      <p className="muted">
        Only users who have the <code>customer-end-user</code> role are shown
        here. Platform owner only.
      </p>
      {err && <div className="err-banner">{err}</div>}
      <div className="connection-grid" style={{ marginTop: '1rem' }}>
        <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
          <h2>Total customers</h2>
          <strong style={{ fontSize: '1.25rem' }}>{rows.length}</strong>
        </div>
        <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
          <h2>New this month</h2>
          <strong style={{ fontSize: '1.25rem' }}>{thisMonthCount}</strong>
        </div>
        <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
          <h2>Showing</h2>
          <strong style={{ fontSize: '1.25rem' }}>{visibleRows.length}</strong>
        </div>
      </div>
      <div style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
        <Link to="/app/users/new" className="btn-primary">
          Add user
        </Link>
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
              className="input"
              placeholder="Name, email, phone, or role"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            <span className="muted">Sort by</span>
            <select
              className="input"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'email' | 'phone')}
            >
              <option value="name">Name</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
            </select>
          </label>
          <label>
            <span className="muted">Order</span>
            <select
              className="input"
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}
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
        ) : visibleRows.length === 0 ? (
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
              {visibleRows.map((u) => (
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
