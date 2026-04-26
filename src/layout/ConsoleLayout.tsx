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
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.innerWidth <= 900);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('dashboard-theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  const roles = session?.roles ?? [];
  const isPlatformOwner = roles.includes('platform-owner');
  const isBusinessUser =
    roles.includes('business-admin') ||
    roles.includes('location-admin') ||
    roles.includes('business-staff');
  /** Location-only admins are scoped to a single location; no topbar location switcher. */
  const isLocationOnlyAdmin =
    roles.includes('location-admin') &&
    !roles.includes('business-admin') &&
    !roles.includes('platform-owner');
  /** Show business-scoped topbar controls only for business-side users. */
  const showBusinessContext = isBusinessUser;
  const { main: navMain, footer: navFooter } = navSectionsForRoles(roles);
  const canListBiz = roles.some(
    (r) =>
      r === 'platform-owner' ||
      r === 'business-admin' ||
      r === 'location-admin',
  );

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
    if (isPlatformOwner) return;
    if (!businesses.length) return;
    const nextTenant = businesses[0]?.tenantId;
    if (!nextTenant) return;
    const valid = businesses.some((b) => b.tenantId === tenantId);
    const tenantIdSafe = (tenantId ?? '').toString().trim();
    if (!tenantIdSafe || !valid) {
      setTenantId(nextTenant);
    }
  }, [businesses, tenantId, setTenantId, isPlatformOwner]);

  // Locations for top bar: scoped to active business (tenant)
  useEffect(() => {
    if (!showBusinessContext) {
      setDashboardLocations([]);
      setSelectedLocationId('all');
      return;
    }
    void (async () => {
      try {
        const locs = await listBusinessLocations();
        const tid = tenantId.trim();
        if (!tid) {
          if (isPlatformOwner) {
            setDashboardLocations(locs);
          } else {
            setDashboardLocations([]);
            setSelectedLocationId('all');
          }
          return;
        }
        const filtered = locs.filter(
          (l) => (l.business?.tenantId ?? '').trim() === tid,
        );
        setDashboardLocations(filtered);
        if (isLocationOnlyAdmin) {
          if (filtered.length === 1) {
            setSelectedLocationId(filtered[0]!.id);
          } else {
            setSelectedLocationId('all');
          }
        } else {
          setSelectedLocationId('all');
        }
      } catch {
        setDashboardLocations([]);
      }
    })();
  }, [showBusinessContext, tenantId, isPlatformOwner, isLocationOnlyAdmin]);

  // Reset selection when tenant changes (location-only admin selection is set when locations load)
  useEffect(() => {
    if (isLocationOnlyAdmin) return;
    setSelectedLocationId('all');
  }, [tenantId, isLocationOnlyAdmin]);

  useEffect(() => {
    const onResize = () => {
      setIsMobileViewport(window.innerWidth <= 900);
      if (window.innerWidth > 900) {
        setIsMobileNavOpen(false);
      }
      setIsProfileMenuOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!isMobileNavOpen) return;
    setIsProfileMenuOpen(false);
  }, [isMobileNavOpen]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dashboard-theme', theme);
  }, [theme]);

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
    if (to === '/app/Facilities') return '⚽';
    if (to === '/app/users') return '👥';
    if (to === '/app/bookings') return '📅';
    if (to === '/app/bookings/new') return '➕';
    if (to === '/app/time-slots') return '🕒';
    if (to === '/app/facilities-live') return '📡';
    if (to === '/app/billing') return '💳';
    return '•';
  };

  const profileInitial = (session.fullName || '?').trim().charAt(0).toUpperCase() || '?';
  /** Pills / dropdown: hide for location-only admins with a single site. */
  const showTopbarLocationBar =
    showBusinessContext &&
    dashboardLocations.length > 0 &&
    !(isLocationOnlyAdmin && dashboardLocations.length === 1);

  return (
    <div
      className={`console-root ${isNavCollapsed ? 'console-root--collapsed' : ''} ${
        isMobileNavOpen ? 'console-root--mobile-nav-open' : ''
      }`}
    >
      <nav className={`console-nav ${isNavCollapsed ? 'console-nav--collapsed' : ''}`}>
        <div className="console-nav-brand">
          <div className="console-nav-brand-text">
            <strong>{isNavCollapsed ? 'VS' : 'Velay SaaS'}</strong>
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
            onClick={() => {
              if (window.innerWidth <= 900) {
                setIsMobileNavOpen(false);
                return;
              }
              setIsNavCollapsed((prev) => !prev);
            }}
          >
            {isMobileNavOpen ? '✕' : isNavCollapsed ? '→' : '←'}
          </button>
        </div>
        <div className="console-nav-main">
          {navMain.map((item) => {
            return (
              <div key={item.to} className="console-nav-group">
                <NavLink
                  to={item.to}
                  end={item.to === '/app'}
                  className={({ isActive }) =>
                    isActive ? 'active' : ''
                  }
                  title={isNavCollapsed ? item.label : undefined}
                  onClick={() => setIsMobileNavOpen(false)}
                >
                  <span className="console-nav-link-icon" aria-hidden="true">
                    {navIconForPath(item.to)}
                  </span>
                  {!isNavCollapsed ? <span>{item.label}</span> : null}
                </NavLink>
              </div>
            );
          })}
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
                  onClick={() => setIsMobileNavOpen(false)}
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
          <button
            type="button"
            className="console-mobile-menu-btn"
            aria-label={isMobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMobileNavOpen}
            onClick={() => setIsMobileNavOpen((prev) => !prev)}
          >
            {isMobileNavOpen ? '✕' : '☰'}
          </button>
          <div className="console-topbar-left">
            {isMobileViewport ? (
              <>
                {/* Mobile: compact dropdown */}
                {showTopbarLocationBar ? (
                  <select
                    className="topbar-location-select"
                    value={selectedLocationId}
                    onChange={(e) => {
                      const nextLocationId = e.target.value;
                      setSelectedLocationId(nextLocationId);
                      if (isPlatformOwner && nextLocationId !== 'all') {
                        const selectedLocation = dashboardLocations.find((loc) => loc.id === nextLocationId);
                        const tid = (selectedLocation?.business?.tenantId ?? '').trim();
                        if (tid && tid !== tenantId) setTenantId(tid);
                      }
                    }}
                  >
                    <option value="all">All locations</option>
                    {dashboardLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                ) : !showBusinessContext ? (
                  <span className="muted console-topbar-location-empty">No locations</span>
                ) : isLocationOnlyAdmin && dashboardLocations.length === 1 ? null : (
                  <span className="muted console-topbar-location-empty">No locations</span>
                )}
              </>
            ) : (
              <>
                {/* Desktop: pill row */}
                {showTopbarLocationBar && (
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
                        onClick={() => {
                          setSelectedLocationId(loc.id);
                          if (isPlatformOwner) {
                            const tid = (loc.business?.tenantId ?? '').trim();
                            if (tid && tid !== tenantId) {
                              setTenantId(tid);
                            }
                          }
                        }}
                      >
                        {loc.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="console-topbar-right">
            <label className="ui-switch console-theme-switch">
              <span className="console-theme-switch__bulb" aria-hidden="true">
                {theme === 'dark' ? '💡' : '🔆'}
              </span>
              <input
                type="checkbox"
                checked={theme === 'dark'}
                onChange={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
                aria-label="Toggle dark mode"
              />
              <span className="ui-switch-track" />
            </label>
            <button
              type="button"
              className="btn-ghost console-profile-toggle"
              aria-expanded={isProfileMenuOpen}
              aria-label="Toggle profile menu"
              onClick={() => setIsProfileMenuOpen((prev) => !prev)}
            >
              <span className="console-profile-toggle__avatar" aria-hidden="true">
                {profileInitial}
              </span>
              {!isMobileViewport ? (
                <span className="console-profile-toggle__name">{session.fullName}</span>
              ) : null}
              <span className="console-profile-toggle__chevron" aria-hidden="true">
                {isProfileMenuOpen ? '▴' : '▾'}
              </span>
            </button>
            {isProfileMenuOpen ? (
              <div className="console-profile-menu">
                <div className="console-profile-menu__name">{session.fullName}</div>
                <div className="console-profile-menu__roles muted">
                  {(session.roles ?? []).join(', ') || 'No roles'}
                </div>
                <button
                  type="button"
                  className="btn-ghost console-profile-menu__signout"
                  onClick={() => signOut()}
                >
                  <span aria-hidden="true">↪</span> Logout
                </button>
              </div>
            ) : null}
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
      <button
        type="button"
        className={`console-mobile-backdrop ${isMobileNavOpen ? 'console-mobile-backdrop--visible' : ''}`}
        aria-label="Close navigation"
        onClick={() => setIsMobileNavOpen(false)}
      />
    </div>
  );
}
