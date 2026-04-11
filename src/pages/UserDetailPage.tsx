import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  activateIamUser,
  deleteIamUser,
  listBookings,
  listBookingsForTenant,
  listBusinesses,
  listEndUsers,
  listIamUsers,
} from '../api/saasClient';
import { useSession } from '../context/SessionContext';
import type { BookingRecord } from '../types/booking';
import type { IamUserRow } from '../types/domain';

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

function prettyLabel(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function UserDetailPage() {
  const { userId = '' } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const isPlatformOwner = session?.roles?.includes('platform-owner') ?? false;
  const [rows, setRows] = useState<IamUserRow[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [activating, setActivating] = useState(false);

  const user = useMemo(() => rows.find((r) => r.id === userId) ?? null, [rows, userId]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [tenantUsers, endUsers, bookingRows] = await Promise.all([
          listIamUsers().catch(() => [] as IamUserRow[]),
          listEndUsers().catch(() => [] as IamUserRow[]),
          (async () => {
            if (isPlatformOwner) {
              const businesses = await listBusinesses();
              const chunks = await Promise.all(
                businesses.map((b) =>
                  listBookingsForTenant(b.tenantId).catch(() => [] as BookingRecord[]),
                ),
              );
              return chunks.flat();
            }
            return listBookings().catch(() => [] as BookingRecord[]);
          })(),
        ]);
        const mergedUsers = [...tenantUsers, ...endUsers].filter(
          (u, index, arr) => arr.findIndex((x) => x.id === u.id) === index,
        );
        setRows(mergedUsers);
        setBookings(bookingRows.filter((b) => b.userId === userId));
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load user');
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, isPlatformOwner]);

  const totalSpend = useMemo(
    () => bookings.reduce((sum, b) => sum + Number(b.pricing?.totalAmount ?? 0), 0),
    [bookings],
  );
  const paidSpend = useMemo(
    () =>
      bookings
        .filter((b) => b.payment?.paymentStatus === 'paid')
        .reduce((sum, b) => sum + Number(b.pricing?.totalAmount ?? 0), 0),
    [bookings],
  );
  const avgSpend = useMemo(() => (bookings.length > 0 ? totalSpend / bookings.length : 0), [
    bookings,
    totalSpend,
  ]);
  const statusChart = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of bookings) {
      const k = b.bookingStatus || 'unknown';
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return toChartRows(counts);
  }, [bookings]);
  const sportChart = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of bookings) {
      const k = b.sportType || 'unknown';
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return toChartRows(counts);
  }, [bookings]);

  async function onDeactivate() {
    if (!userId.trim()) return;
    const yes = window.confirm(
      'Deactivate this account? They cannot sign in until a platform owner reactivates them.',
    );
    if (!yes) return;
    setDeleting(true);
    setErr(null);
    try {
      await deleteIamUser(userId);
      navigate('/app/users', { replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Deactivate failed');
    } finally {
      setDeleting(false);
    }
  }

  async function onActivateAccount() {
    if (!userId.trim()) return;
    setActivating(true);
    setErr(null);
    try {
      const profile = await activateIamUser(userId);
      setRows((prev) =>
        prev.map((r) =>
          r.id === userId
            ? {
                ...r,
                fullName: profile.fullName,
                email: profile.email,
                phone: profile.phone,
                isActive: profile.isActive,
                roles: profile.roles,
              }
            : r,
        ),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Activate failed');
    } finally {
      setActivating(false);
    }
  }

  if (!userId.trim()) return <p className="muted">Missing user id.</p>;

  return (
    <div>
      <p className="page-toolbar">
        <Link to="/app/users" className="btn-ghost btn-compact">
          ← Users
        </Link>
      </p>
      <h1 className="page-title">User details</h1>
      {err && <div className="err-banner">{err}</div>}
      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : !user ? (
        <div className="empty-state">User not found.</div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.75rem',
              marginBottom: '0.85rem',
            }}
          >
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>Total bookings</h2>
              <strong style={{ fontSize: '1.2rem' }}>{bookings.length}</strong>
            </div>
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>Total spend</h2>
              <strong style={{ fontSize: '1.2rem' }}>{Math.round(totalSpend).toLocaleString()} PKR</strong>
            </div>
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>Paid amount</h2>
              <strong style={{ fontSize: '1.2rem' }}>{Math.round(paidSpend).toLocaleString()} PKR</strong>
            </div>
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>Avg / booking</h2>
              <strong style={{ fontSize: '1.2rem' }}>{Math.round(avgSpend).toLocaleString()} PKR</strong>
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '0.75rem',
              marginBottom: '0.85rem',
            }}
          >
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h3 style={{ margin: '0 0 0.65rem', fontSize: '0.95rem' }}>Booking status</h3>
              <div className="overview-source-bars">
                {statusChart.map((row) => (
                  <div key={row.key} className="overview-source-row">
                    <span className="overview-source-label">{prettyLabel(row.label)}</span>
                    <div className="overview-source-track">
                      <div
                        className="overview-source-fill overview-source-fill--walkin"
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
              <h3 style={{ margin: '0 0 0.65rem', fontSize: '0.95rem' }}>Sport profile</h3>
              <div className="overview-source-bars">
                {sportChart.map((row) => (
                  <div key={row.key} className="overview-source-row">
                    <span className="overview-source-label">{prettyLabel(row.label)}</span>
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
          </div>
          <div className="form-grid" style={{ maxWidth: '900px' }}>
            <div className="connection-panel" style={{ margin: 0 }}>
              <h2 style={{ marginTop: 0 }}>Profile</h2>
              <div className="form-grid">
                <div>
                  <label>Full name</label>
                  <div>{user.fullName}</div>
                </div>
                <div>
                  <label>Email</label>
                  <div>{user.email}</div>
                </div>
                <div>
                  <label>Phone</label>
                  <div>{user.phone || '—'}</div>
                </div>
                <div>
                  <label>Roles</label>
                  <div>
                    <code>{(user.roles ?? []).join(', ') || '—'}</code>
                  </div>
                </div>
                <div>
                  <label>User ID</label>
                  <div>
                    <code>{user.id}</code>
                  </div>
                </div>
                <div>
                  <label>Created</label>
                  <div>{user.createdAt ? new Date(user.createdAt).toLocaleString() : '—'}</div>
                </div>
                <div>
                  <label>Account</label>
                  <div>{user.isActive === false ? 'Inactive (cannot sign in)' : 'Active'}</div>
                </div>
              </div>
            </div>
            <div className="connection-panel" style={{ margin: 0 }}>
              <h2 style={{ marginTop: 0 }}>Booking history</h2>
              {bookings.length === 0 ? (
                <div className="empty-state">No bookings for this user yet.</div>
              ) : (
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Sport</th>
                        <th>Status</th>
                        <th>Payment</th>
                        <th>Total</th>
                        <th>Booking</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...bookings]
                        .sort(
                          (a, b) =>
                            (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0),
                        )
                        .map((b) => (
                          <tr key={b.bookingId}>
                            <td>{b.bookingDate}</td>
                            <td>{prettyLabel(b.sportType)}</td>
                            <td>{prettyLabel(b.bookingStatus)}</td>
                            <td>{prettyLabel(b.payment?.paymentStatus ?? 'unknown')}</td>
                            <td>{Math.round(b.pricing?.totalAmount ?? 0).toLocaleString()} PKR</td>
                            <td>
                              <Link to={`/app/bookings/${b.bookingId}/edit`} className="action-link">
                                View booking
                              </Link>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="page-actions-row" style={{ marginTop: 0 }}>
              <Link to={`/app/users/${user.id}/edit`} className="btn-primary">
                Edit user
              </Link>
              {user.isActive === false && isPlatformOwner ? (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={activating}
                  onClick={() => void onActivateAccount()}
                >
                  {activating ? 'Working…' : 'Activate account'}
                </button>
              ) : null}
              {user.isActive !== false ? (
                <button
                  type="button"
                  className="btn-danger"
                  disabled={deleting}
                  onClick={() => void onDeactivate()}
                >
                  {deleting ? 'Working…' : 'Deactivate account'}
                </button>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
