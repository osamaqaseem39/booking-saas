import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { userId, session, signIn, loading, error, tenantId, setTenantId } = useSession();
  const [api, setApi] = useState(
    () =>
      import.meta.env.VITE_API_URL ||
      localStorage.getItem('bukit_saas_api_url') ||
      'http://localhost:3000',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenant, setTenant] = useState(tenantId);
  const [fieldErrors, setFieldErrors] = useState<{
    api?: string;
    email?: string;
    password?: string;
    tenantId?: string;
  }>({});

  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const emailRe = /^\S+@\S+\.\S+$/;

  function validate(): boolean {
    const next: typeof fieldErrors = {};

    const apiTrim = api.trim();
    if (!apiTrim) {
      next.api = 'API base URL is required';
    } else {
      try {
        // Require a scheme so we can safely build request URLs.
        new URL(apiTrim);
      } catch {
        next.api = 'Use a full URL (e.g. http://localhost:3000)';
      }
    }

    const emailTrim = email.trim();
    if (!emailTrim) {
      next.email = 'Email is required';
    } else if (!emailRe.test(emailTrim)) {
      next.email = 'Invalid email';
    }

    const passTrim = password.trim();
    if (!passTrim) {
      next.password = 'Password is required';
    } else if (passTrim.length < 8) {
      next.password = 'Password must be at least 8 characters';
    }

    const tenantTrim = tenant.trim();
    if (
      tenantTrim &&
      tenantTrim !== 'public' &&
      !uuidRe.test(tenantTrim)
    ) {
      next.tenantId = 'Invalid tenant UUID format';
    }

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setTenantId(tenant.trim());
    try {
      await signIn(api.replace(/\/$/, ''), email.trim(), password);
      // Navigation happens via the effect once the session is loaded.
    } catch {
      // Error is surfaced by SessionContext.
    }
  }

  useEffect(() => {
    if (userId.trim() && session?.roles?.length) {
      navigate('/app', { replace: true });
    }
  }, [userId, session, navigate]);

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Bukit SaaS console</h1>
        <p className="muted">
          Sign in with <code>email + password</code>. Requests use a JWT
          token under <code>Authorization: Bearer ...</code>, plus{' '}
          <code>X-Tenant-Id</code> for tenant scoping.
        </p>
        <form onSubmit={onSubmit}>
          <div className="form-grid" style={{ marginTop: '1.25rem' }}>
            <div>
              <label htmlFor="api">API base URL</label>
              <input
                id="api"
                name="api"
                value={api}
                onChange={(e) => setApi(e.target.value)}
                placeholder="http://localhost:3000"
                aria-invalid={!!fieldErrors.api}
              />
              {fieldErrors.api && (
                <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  {fieldErrors.api}
                </div>
              )}
            </div>
            <div>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoFocus
                placeholder="you@company.com"
                aria-invalid={!!fieldErrors.email}
                inputMode="text"
              />
              {fieldErrors.email && (
                <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  {fieldErrors.email}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="Your password"
                aria-invalid={!!fieldErrors.password}
              />
              {fieldErrors.password && (
                <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  {fieldErrors.password}
                </div>
              )}
            </div>
            <div>
              <label htmlFor="tenant">Tenant ID (optional)</label>
              <input
                id="tenant"
                name="tenantId"
                value={tenant}
                onChange={(e) => setTenant(e.target.value)}
                placeholder="Tenant UUID (or leave blank)"
                aria-invalid={!!fieldErrors.tenantId}
              />
              {fieldErrors.tenantId && (
                <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  {fieldErrors.tenantId}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="err-banner" style={{ marginTop: '1rem' }}>
              {error}
            </div>
          )}

          <div style={{ marginTop: '1.25rem' }}>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !email.trim() || !password.trim()}
            >
              {loading ? 'Signing in…' : 'Continue'}
            </button>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <Link to="/owner-signup" className="muted">
              First time setup? Create owner account
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
