import { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { listBusinesses } from '../api/saasClient';
import { useSession } from '../context/SessionContext';
import { navVisibleForRoles } from '../rbac';
import type { BusinessRow } from '../types/domain';

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

  const roles = session?.roles ?? [];
  const isPlatformOwner = roles.includes('platform-owner');
  const nav = navVisibleForRoles(roles).filter(
    (item, index, arr) => arr.findIndex((x) => x.to === item.to) === index,
  );
  const canListBiz = roles.some(
    (r) => r === 'platform-owner' || r === 'business-admin',
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
    if (!businesses.length) return;
    const nextTenant = businesses[0]?.tenantId;
    if (!nextTenant) return;

    const valid = businesses.some((b) => b.tenantId === tenantId);
    const tenantIdSafe = (tenantId ?? '').toString().trim();
    if (!tenantIdSafe || !valid) {
      setTenantId(nextTenant);
    }
  }, [businesses, tenantId, setTenantId]);

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

  return (
    <div className="console-root">
      <nav className="console-nav">
        <div className="console-nav-brand">
          <strong>Bukit SaaS</strong>
          <span className="muted" style={{ fontSize: '0.75rem' }}>
            Console
          </span>
        </div>
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/app'}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="console-main">
        <header className="console-topbar">
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
          <Outlet />
        </main>
      </div>
    </div>
  );
}
