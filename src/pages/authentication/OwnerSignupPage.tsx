import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../../context/SessionContext';

const OWNER_SIGNUP_HIDDEN_KEY = 'velay_owner_signup_hidden';

export default function OwnerSignupPage() {
  const navigate = useNavigate();
  const { userId, session, loading, error } = useSession();
  const [api, setApi] = useState(
    () =>
      import.meta.env.VITE_API_URL ||
      localStorage.getItem('velay_saas_api_url') ||
      'http://localhost:3000',
  );
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bootstrapSecret, setBootstrapSecret] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [fieldErrors, setFieldErrors] = useState<{
    api?: string;
    fullName?: string;
    email?: string;
    password?: string;
    bootstrapSecret?: string;
  }>({});

  const emailRe = /^\S+@\S+\.\S+$/;

  function validate(): boolean {
    const next: typeof fieldErrors = {};
    const apiTrim = api.trim();
    const nameTrim = fullName.trim();
    const emailTrim = email.trim();
    const passTrim = password.trim();
    const secretTrim = bootstrapSecret.trim();

    if (!apiTrim) {
      next.api = 'API base URL is required';
    } else {
      try {
        new URL(apiTrim);
      } catch {
        next.api = 'Use a full URL (e.g. https://booking-saas-api... )';
      }
    }
    if (!nameTrim) next.fullName = 'Full name is required';
    else if (nameTrim.length < 2) next.fullName = 'Full name is too short';
    if (!emailTrim) next.email = 'Email is required';
    else if (!emailRe.test(emailTrim)) next.email = 'Invalid email';
    if (!passTrim) next.password = 'Password is required';
    else if (passTrim.length < 8) next.password = 'Password must be at least 8 characters';
    if (!secretTrim) next.bootstrapSecret = 'Bootstrap secret is required';
    else if (secretTrim.length < 8) next.bootstrapSecret = 'Bootstrap secret is too short';

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setLocalError(null);
    setSuccess(null);

    try {
      const base = api.trim().replace(/\/$/, '');
      const res = await fetch(`${base}/auth/bootstrap-first-owner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          bootstrapSecret: bootstrapSecret.trim(),
        }),
      });
      if (!res.ok) {
        let message = 'Owner sign up failed';
        try {
          const data = (await res.json()) as { message?: string | string[] };
          if (typeof data.message === 'string') message = data.message;
          else if (Array.isArray(data.message)) message = data.message.join(', ');
          else message = res.statusText || message;
        } catch {
          message = res.statusText || message;
        }
        throw new Error(message);
      }

      setSuccess('Owner account created successfully. You can now sign in.');
      localStorage.setItem(OWNER_SIGNUP_HIDDEN_KEY, '1');
      setPassword('');
      setBootstrapSecret('');
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Owner sign up failed');
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (userId.trim() && session?.roles?.length) {
      navigate('/app', { replace: true });
    }
  }, [userId, session, navigate]);

  return (
    <div className="login-page">
      <div className="login-card" style={{ width: 'min(520px, 100%)' }}>
        <h1>Owner sign up</h1>
        <p className="muted">
          Use this once to create the first <code>platform-owner</code> account in
          an empty database.
        </p>
        <form onSubmit={onSubmit}>
          <div className="form-grid" style={{ marginTop: '1.25rem' }}>
            <div>
              <label htmlFor="api">API base URL</label>
              <input
                id="api"
                value={api}
                onChange={(e) => setApi(e.target.value)}
                placeholder="https://booking-saas-api-lilac.vercel.app"
                aria-invalid={!!fieldErrors.api}
              />
              {fieldErrors.api && <div className="muted" style={{ color: 'var(--danger)' }}>{fieldErrors.api}</div>}
            </div>
            <div>
              <label htmlFor="fullName">Full name</label>
              <input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Owner Name"
                aria-invalid={!!fieldErrors.fullName}
              />
              {fieldErrors.fullName && <div className="muted" style={{ color: 'var(--danger)' }}>{fieldErrors.fullName}</div>}
            </div>
            <div>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@company.com"
                aria-invalid={!!fieldErrors.email}
              />
              {fieldErrors.email && <div className="muted" style={{ color: 'var(--danger)' }}>{fieldErrors.email}</div>}
            </div>
            <div>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                aria-invalid={!!fieldErrors.password}
              />
              {fieldErrors.password && <div className="muted" style={{ color: 'var(--danger)' }}>{fieldErrors.password}</div>}
            </div>
            <div>
              <label htmlFor="bootstrapSecret">Bootstrap secret</label>
              <input
                id="bootstrapSecret"
                type="password"
                value={bootstrapSecret}
                onChange={(e) => setBootstrapSecret(e.target.value)}
                placeholder="AUTH_BOOTSTRAP_SECRET value"
                aria-invalid={!!fieldErrors.bootstrapSecret}
              />
              {fieldErrors.bootstrapSecret && (
                <div className="muted" style={{ color: 'var(--danger)' }}>
                  {fieldErrors.bootstrapSecret}
                </div>
              )}
            </div>
          </div>

          {(localError || error) && (
            <div className="err-banner" style={{ marginTop: '1rem' }}>
              {localError || error}
            </div>
          )}
          {success && (
            <div
              style={{
                marginTop: '1rem',
                border: '1px solid rgba(74, 222, 128, 0.35)',
                background: 'rgba(74, 222, 128, 0.1)',
                color: 'var(--ok)',
                padding: '0.65rem 1rem',
                borderRadius: '10px',
              }}
            >
              {success}
            </div>
          )}

          <div
            style={{
              marginTop: '1.25rem',
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'center',
            }}
          >
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || submitting}
            >
              {submitting ? 'Creating owner…' : 'Create owner account'}
            </button>
            <Link to="/login" className="muted">
              Back to login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

