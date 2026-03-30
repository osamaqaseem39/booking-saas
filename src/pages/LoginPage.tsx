import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [uid, setUid] = useState(userId);
  const [tenant, setTenant] = useState(tenantId);
  const [fieldErrors, setFieldErrors] = useState<{
    api?: string;
    uid?: string;
    tenantId?: string;
  }>({});

  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

    const uidTrim = uid.trim();
    if (!uidTrim) {
      next.uid = 'User UUID is required';
    } else if (!uuidRe.test(uidTrim)) {
      next.uid = 'Invalid UUID format';
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
      await signIn(api.replace(/\/$/, ''), uid.trim());
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
          Sign in with your user UUID. The API uses{' '}
          <code>X-User-Id</code> and <code>X-Tenant-Id</code> headers (no JWT
          in this stack).
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
              <label htmlFor="uid">User ID (UUID)</label>
              <input
                id="uid"
                name="uid"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                placeholder="From database users.id"
                aria-invalid={!!fieldErrors.uid}
                autoFocus
                inputMode="text"
              />
              {fieldErrors.uid && (
                <div style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  {fieldErrors.uid}
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
            <button type="submit" className="btn-primary" disabled={loading || !uid.trim()}>
              {loading ? 'Signing in…' : 'Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
