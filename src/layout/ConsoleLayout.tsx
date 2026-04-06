import { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { listBusinesses, listBusinessLocations } from '../api/saasClient';
import { useSession } from '../context/SessionContext';
import { navSectionsForRoles } from '../rbac';
import type { BusinessLocationRow, BusinessRow } from '../types/domain';

export interface DashboardOutletContext {
  selectedLocationId: string;
  setSelectedLocationId: (id: string) => void;
  dashboardLocations: BusinessLocationRow[];
}

export default function ConsoleLayout() {
  const {
    userId,
    session,
    loading,
    error,
    tenantId,
    setTenantId,
    signOut,
  } = useSession();

  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [dashboardLocations, setDashboardLocations] = useState<BusinessLocationRow[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);

  const roles = session?.roles ?? [];
  const isPlatformOwner = roles.includes('platform-owner');
  const isBusinessUser = roles.includes('business-admin') || roles.includes('business-staff');
  const { main: navMain, footer: navFooter } = navSectionsForRoles(roles);
  const canListBiz = roles.some((r) => r === 'platform-owner' || r === 'business-admin');

  useEffect(() => {
    if (!canListBiz || !userId.trim()) {
      setBusinesses([]);
      return;
    }
    void (async () => {
      try {
        const rows = await listBusinesses();
        setBusinesses(rows);
      } catch {
        setBusinesses([]);
      }
    })();
  }, [canListBiz, userId, session?.id]);

  useEffect(() => {
    if (!businesses.length) return;
    const nextTenant = businesses[0]?.tenantId;
    if (!nextTenant) return;
    const valid = businesses.some((b) => b.tenantId === tenantId);
    const tenantIdSafe = (tenantId ?? '').toString().trim();
    if (!tenantIdSafe || !valid) {
      setTenantId(nextTenant);
    }
  }, [businesses, tenantId, setTenantId]);

  // Load locations for business-user topbar filter
  useEffect(() => {
    if (!isBusinessUser || !tenantId.trim()) {
      setDashboardLocations([]);
      setSelectedLocationId('all');
      return;
    }
    void (async () => {
      try {
        const locs = await listBusinessLocations();
        setDashboardLocations(locs);
      } catch {
        setDashboardLocations([]);
      }
    })();
  }, [isBusinessUser, tenantId]);

  // Reset selection when tenant changes
  useEffect(() => {
    setSelectedLocationId('all');
  }, [tenantId]);

  if (loading && !session) {
    return (
      <div className="login-page">
        <p className="muted">Loading session…</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!session.roles?.length) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>Access pending</h1>
          <p className="muted">
            Your user exists but has no IAM roles. Ask a platform owner to assign
            one via <code>/iam/roles/assign</code>.
          </p>
          {error && (
            <div className="err-banner" style={{ marginTop: '1rem' }}>
              {error}
            </div>
          )}
          <button
            type="button"
            className="btn-ghost"
            style={{ marginTop: '1rem' }}
            onClick={() => signOut()}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const outletContext: DashboardOutletContext = {
    selectedLocationId,
    setSelectedLocationId,
    dashboardLocations,
  };

  const navIconForPath = (to: string): string => {
    if (to === '/app') return '🏠';
    if (to === '/app/businesses') return '🏢';
    if (to === '/app/locations') return '📍';
    if (to === '/app/Facilites') return '⚽';
    if (to === '/app/end-users') return '👥';
    if (to === '/app/users') return '🧑‍💼';
    if (to === '/app/bookings') return '📅';
    if (to === '/app/bookings/new') return '➕';
    if (to === '/app/time-slots') return '🕒';
    if (to === '/app/facilities-live') return '📡';
    if (to === '/app/billing') return '💳';
    if (to === '/app/health') return '🛡️';
    return '•';
  };

  return (
    <div className={`console-root ${isNavCollapsed ? 'console-root--collapsed' : ''}`}>
      <nav className={`console-nav ${isNavCollapsed ? 'console-nav--collapsed' : ''}`}>
        <div className="console-nav-brand">
          <div className="console-nav-brand-text">
            <strong>{isNavCollapsed ? 'BS' : 'Bukit SaaS'}</strong>
            {!isNavCollapsed && (
              <span className="muted" style={{ fontSize: '0.75rem' }}>
                Console
              </span>
            )}
          </div>
          <button
            type="button"
            className="console-nav-collapse-btn"
            title={isNavCollapsed ? 'Expand menu' : 'Collapse menu'}
            aria-label={isNavCollapsed ? 'Expand side menu' : 'Collapse side menu'}
            onClick={() => setIsNavCollapsed((prev) => !prev)}
          >
            {isNavCollapsed ? '→' : '←'}
          </button>
        </div>
        <div className="console-nav-main">
          {navMain.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/app'}
              className={({ isActive }) => (isActive ? 'active' : '')}
              title={isNavCollapsed ? item.label : undefined}
            >
              <span className="console-nav-link-icon" aria-hidden="true">
                {navIconForPath(item.to)}
              </span>
              {!isNavCollapsed ? <span>{item.label}</span> : null}
            </NavLink>
          ))}
        </div>
        {navFooter.length > 0 ? (
          <>
            <div className="console-nav-divider" role="presentation" />
            <div className="console-nav-footer">
              {navFooter.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/app'}
                  className={({ isActive }) => (isActive ? 'active' : '')}
                  title={isNavCollapsed ? item.label : undefined}
                >
                  <span className="console-nav-link-icon" aria-hidden="true">
                    {navIconForPath(item.to)}
                  </span>
                  {!isNavCollapsed ? <span>{item.label}</span> : null}
                </NavLink>
              ))}
            </div>
          </>
        ) : null}
      </nav>

      <div className="console-main">
        <header className="console-topbar">
          <div className="console-topbar-left">
            {!isPlatformOwner && (
              <div className="tenant-select">
                <span className="muted" style={{ fontSize: '0.75rem' }}>
                  Active tenant
                </span>
                {businesses.length > 0 ? (
                  <select
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                  >
                    {businesses.map((b) => (
                      <option key={b.id} value={b.tenantId}>
                        {b.businessName} · {b.tenantId.slice(0, 8)}…
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    placeholder="Tenant UUID"
                    style={{ minWidth: '260px' }}
                  />
                )}
              </div>
            )}

            {/* Location filter — business users only */}
            {isBusinessUser && dashboardLocations.length > 0 && (
              <div className="topbar-loc-bar">
                <button
                  type="button"
                  className={selectedLocationId === 'all' ? 'topbar-loc-btn topbar-loc-btn--active' : 'topbar-loc-btn'}
                  onClick={() => setSelectedLocationId('all')}
                >
                  All
                </button>
                {dashboardLocations.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    className={selectedLocationId === loc.id ? 'topbar-loc-btn topbar-loc-btn--active' : 'topbar-loc-btn'}
                    onClick={() => setSelectedLocationId(loc.id)}
                  >
                    {loc.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
            <span className="muted" style={{ fontSize: '0.8rem' }}>
              {session.fullName}
            </span>
            <button type="button" className="btn-ghost" onClick={() => signOut()}>
              Sign out
            </button>
          </div>
        </header>

        {error && (
          <div className="err-banner" style={{ margin: '0.75rem 1.25rem 0' }}>
            {error}
          </div>
        )}
        <main className="console-body">
          <Outlet context={outletContext} />
        </main>
      </div>
    </div>
  );
}
