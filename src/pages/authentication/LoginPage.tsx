import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../../context/SessionContext';

const OWNER_SIGNUP_HIDDEN_KEY = 'velay_owner_signup_hidden';

export default function LoginPage() {
  const navigate = useNavigate();
  const { userId, session, signIn, loading, error, apiBase } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showOwnerSignupLink] = useState(
    () => localStorage.getItem(OWNER_SIGNUP_HIDDEN_KEY) !== '1',
  );
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const emailRe = /^\S+@\S+\.\S+$/;

  function validate(): boolean {
    const next: typeof fieldErrors = {};

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

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    try {
      await signIn(apiBase, email.trim(), password);
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
        <h1>Velay SaaS console</h1>
        <p className="muted">
          Sign in with <code>email + password</code>.
        </p>
        <form onSubmit={onSubmit}>
          <div className="form-grid" style={{ marginTop: '1.25rem' }}>
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
          {showOwnerSignupLink && (
            <div style={{ marginTop: '0.75rem' }}>
              <Link to="/owner-signup" className="muted">
                First time setup? Create owner account
              </Link>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

