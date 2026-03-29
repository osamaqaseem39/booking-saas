import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { userId, session, signIn, loading, error } = useSession();
  const [api, setApi] = useState(
    () =>
      localStorage.getItem('bukit_saas_api_url') ||
      import.meta.env.VITE_API_URL ||
      'http://localhost:3000',
  );
  const [uid, setUid] = useState(userId);

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
        <div className="form-grid" style={{ marginTop: '1.25rem' }}>
          <div>
            <label htmlFor="api">API base URL</label>
            <input
              id="api"
              value={api}
              onChange={(e) => setApi(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="uid">User ID (UUID)</label>
            <input
              id="uid"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              placeholder="From database users.id"
            />
          </div>
        </div>
        {error && (
          <div className="err-banner" style={{ marginTop: '1rem' }}>
            {error}
          </div>
        )}
        <div style={{ marginTop: '1.25rem' }}>
          <button
            type="button"
            className="btn-primary"
            disabled={loading || !uid.trim()}
            onClick={() => {
              void (async () => {
                try {
                  await signIn(api.replace(/\/$/, ''), uid.trim());
                  navigate('/app', { replace: true });
                } catch {
                  /* error shown */
                }
              })();
            }}
          >
            {loading ? 'Signing in…' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
