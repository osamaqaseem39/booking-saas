import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deleteBusiness, listBusinesses, listBusinessLocations, listBookingsForTenant } from '../api/saasClient';
import { useSession } from '../context/SessionContext';
import type { BusinessLocationRow, BusinessRow } from '../types/domain';

type LocationTypeCard = 'arena' | 'gaming-zone';

type TypeDrilldown = {
  facilityTypeCounts: {
    futsal: number;
    cricket: number;
    padel: number;
  };
  topFacilities: Array<{
    key: string;
    facilityName: string;
    locationName: string;
    businessName: string;
    bookings: number;
  }>;
};

export default function BusinessesPage() {
  const [rows, setRows] = useState<BusinessRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'tenantId' | 'members'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [allLocations, setAllLocations] = useState<BusinessLocationRow[]>([]);
  const [activeTypeCard, setActiveTypeCard] = useState<LocationTypeCard | null>(null);
  const [typeDrilldown, setTypeDrilldown] = useState<TypeDrilldown | null>(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownErr, setDrilldownErr] = useState<string | null>(null);
  const { session, setTenantId } = useSession();
  const navigate = useNavigate();
  const roles = session?.roles ?? [];
  const canCreateBusiness = roles.includes('platform-owner');
  const canScopeConsoleToTenant = roles.includes('platform-owner');

  function openBusinessContext(business: BusinessRow) {
    setTenantId(business.tenantId ?? '');
    navigate(`/app/businesses/${business.id}`);
  }

  function openBusinessLocations(business: BusinessRow) {
    setTenantId(business.tenantId ?? '');
    navigate(`/app/locations?businessId=${encodeURIComponent(business.id)}`);
  }

  async function reloadBusinesses() {
    setLoading(true);
    setErr(null);
    try {
      const [businessRows, locationRows] = await Promise.all([
        listBusinesses(),
        listBusinessLocations(),
      ]);
      setRows(businessRows);
      setAllLocations(locationRows);
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

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      const normalizedStatus = (r.status ?? 'active').toLowerCase();
      if (statusFilter !== 'all' && normalizedStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        (r.businessName ?? '').toLowerCase().includes(q) ||
        (r.tenantId ?? '').toLowerCase().includes(q)
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
  }, [query, rows, sortBy, sortDir, statusFilter]);

  const totalMemberships = useMemo(
    () => filteredRows.reduce((sum, row) => sum + (row.memberships?.length ?? 0), 0),
    [filteredRows],
  );
  const filteredBusinessIds = useMemo(
    () => new Set(filteredRows.map((r) => r.id)),
    [filteredRows],
  );
  const filteredLocations = useMemo(
    () => allLocations.filter((loc) => filteredBusinessIds.has(loc.businessId)),
    [allLocations, filteredBusinessIds],
  );
  const arenaLocationCount = useMemo(
    () => filteredLocations.filter((loc) => (loc.locationType ?? '').trim() === 'arena').length,
    [filteredLocations],
  );
  const gamingLocationCount = useMemo(
    () =>
      filteredLocations.filter((loc) => (loc.locationType ?? '').trim() === 'gaming-zone').length,
    [filteredLocations],
  );

  async function openTypeDrilldown(type: LocationTypeCard) {
    setActiveTypeCard(type);
    setTypeDrilldown(null);
    setDrilldownErr(null);
    setDrilldownLoading(true);
    try {
      const selectedLocations = filteredLocations.filter(
        (loc) => (loc.locationType ?? '').trim() === type,
      );
      const selectedBusinessIds = new Set(selectedLocations.map((loc) => loc.businessId));
      const selectedBusinesses = filteredRows.filter((b) => selectedBusinessIds.has(b.id));
      const tenantIds = Array.from(
        new Set(selectedBusinesses.map((b) => (b.tenantId ?? '').trim()).filter(Boolean)),
      );
      const bookingsByTenant = await Promise.all(
        tenantIds.map(async (tid) => {
          try {
            return await listBookingsForTenant(tid);
          } catch {
            return [];
          }
        }),
      );
      const allBookings = bookingsByTenant.flat();
      const locationById = new Map(selectedLocations.map((loc) => [loc.id, loc]));
      const businessNameById = new Map(filteredRows.map((b) => [b.id, b.businessName]));
      const typeCounts = { futsal: 0, cricket: 0, padel: 0 };
      const facilityStats = new Map<
        string,
        { facilityName: string; locationName: string; businessName: string; bookings: number }
      >();

      for (const loc of selectedLocations) {
        for (const facility of loc.facilityCourts ?? []) {
          const facilityType = facility.facilityType;
          if (facilityType === 'futsal' || facilityType === 'cricket' || facilityType === 'padel') {
            typeCounts[facilityType] += 1;
          }
          const kind =
            facilityType === 'futsal'
              ? 'futsal_court'
              : facilityType === 'cricket'
              ? 'cricket_court'
              : 'padel_court';
          const key = `${kind}:${facility.id}`;
          if (!facilityStats.has(key)) {
            facilityStats.set(key, {
              facilityName: facility.name,
              locationName: loc.name,
              businessName: businessNameById.get(loc.businessId) ?? '—',
              bookings: 0,
            });
          }
        }
      }

      for (const booking of allBookings) {
        const loc = locationById.get(booking.arenaId);
        if (!loc) continue;
        for (const item of booking.items ?? []) {
          const key = `${item.courtKind}:${item.courtId}`;
          const existing = facilityStats.get(key);
          if (existing) {
            existing.bookings += 1;
            facilityStats.set(key, existing);
          } else {
            facilityStats.set(key, {
              facilityName: item.courtId.slice(0, 8),
              locationName: loc.name,
              businessName: businessNameById.get(loc.businessId) ?? '—',
              bookings: 1,
            });
          }
        }
      }

      const topFacilities = Array.from(facilityStats.entries())
        .map(([key, row]) => ({ key, ...row }))
        .sort((a, b) => b.bookings - a.bookings)
        .slice(0, 8);
      setTypeDrilldown({
        facilityTypeCounts: typeCounts,
        topFacilities,
      });
    } catch (e) {
      setDrilldownErr(
        e instanceof Error ? e.message : 'Failed to load facility stats for selected card.',
      );
    } finally {
      setDrilldownLoading(false);
    }
  }

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
        business admins only see businesses they belong to. Use{' '}
        <strong>Clear tenant scope</strong> resets the top bar to all businesses (platform
        owners). Detail pages do not change your global tenant selection.
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
          <button
            type="button"
            className="connection-panel"
            style={{ margin: 0, padding: '0.9rem 1rem', textAlign: 'left', cursor: 'pointer' }}
            onClick={() => void openTypeDrilldown('arena')}
          >
            <h2>Total arenas</h2>
            <strong style={{ fontSize: '1.25rem' }}>{arenaLocationCount}</strong>
          </button>
          <button
            type="button"
            className="connection-panel"
            style={{ margin: 0, padding: '0.9rem 1rem', textAlign: 'left', cursor: 'pointer' }}
            onClick={() => void openTypeDrilldown('gaming-zone')}
          >
            <h2>Total gaming zones</h2>
            <strong style={{ fontSize: '1.25rem' }}>{gamingLocationCount}</strong>
          </button>
        </div>
      )}
      {activeTypeCard ? (
        <div className="connection-panel" style={{ marginTop: '1rem', padding: '0.9rem 1rem' }}>
          <h2 style={{ marginTop: 0 }}>
            {activeTypeCard === 'arena' ? 'Arena' : 'Gaming zone'} drilldown
          </h2>
          {drilldownLoading ? (
            <p className="muted" style={{ margin: 0 }}>Loading stats…</p>
          ) : drilldownErr ? (
            <div className="err-banner">{drilldownErr}</div>
          ) : typeDrilldown ? (
            <>
              <div className="connection-grid" style={{ marginTop: '0.5rem' }}>
                <div className="connection-panel" style={{ margin: 0, padding: '0.8rem 0.9rem' }}>
                  <h2>Futsal fields</h2>
                  <strong style={{ fontSize: '1.15rem' }}>
                    {typeDrilldown.facilityTypeCounts.futsal}
                  </strong>
                </div>
                <div className="connection-panel" style={{ margin: 0, padding: '0.8rem 0.9rem' }}>
                  <h2>Cricket fields</h2>
                  <strong style={{ fontSize: '1.15rem' }}>
                    {typeDrilldown.facilityTypeCounts.cricket}
                  </strong>
                </div>
                <div className="connection-panel" style={{ margin: 0, padding: '0.8rem 0.9rem' }}>
                  <h2>Padel courts</h2>
                  <strong style={{ fontSize: '1.15rem' }}>
                    {typeDrilldown.facilityTypeCounts.padel}
                  </strong>
                </div>
              </div>
              <h3 style={{ margin: '0.9rem 0 0.5rem', fontSize: '0.95rem' }}>
                Top facilities by bookings
              </h3>
              {typeDrilldown.topFacilities.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>
                  No booking activity found for this facility type.
                </p>
              ) : (
                <div className="table-wrap" style={{ marginTop: '0.45rem' }}>
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Facility</th>
                        <th>Location</th>
                        <th>Business</th>
                        <th>Bookings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {typeDrilldown.topFacilities.map((row) => (
                        <tr key={row.key}>
                          <td>{row.facilityName}</td>
                          <td>{row.locationName}</td>
                          <td>{row.businessName}</td>
                          <td>{row.bookings}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}
        </div>
      ) : null}
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
                <th>Status</th>
                <th>Members</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => {
                    if (canScopeConsoleToTenant) {
                      openBusinessContext(b);
                      return;
                    }
                    navigate(`/app/businesses/${b.id}`);
                  }}
                >
                  <td>{b.businessName}</td>
                  <td>
                    <code style={{ fontSize: '0.75rem' }}>{b.tenantId}</code>
                  </td>
                  <td>{toProperCase(b.status ?? 'active')}</td>
                  <td>{b.memberships?.length ?? 0}</td>
                  <td style={{ width: '260px' }}>
                    <div
                      style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link to={`/app/businesses/${b.id}`} className="action-link">
                        View
                      </Link>
                      <button
                        type="button"
                        className="action-link"
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          font: 'inherit',
                        }}
                        onClick={() => openBusinessLocations(b)}
                      >
                        Locations
                      </button>
                      {canScopeConsoleToTenant ? (
                        <button
                          type="button"
                          className="action-link"
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            font: 'inherit',
                          }}
                          onClick={() => openBusinessContext(b)}
                        >
                          Select business
                        </button>
                      ) : null}
                      {canScopeConsoleToTenant ? (
                        <button
                          type="button"
                          className="action-link"
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            font: 'inherit',
                          }}
                          onClick={() => {
                            setTenantId('');
                            navigate('/app');
                          }}
                        >
                          Clear tenant scope
                        </button>
                      ) : null}
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
