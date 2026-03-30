import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createIamUser } from '../api/saasClient';

export default function UserCreatePage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onCreate() {
    setBusy(true);
    setErr(null);
    try {
      await createIamUser({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
      });
      navigate('/app/users', { replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
        <h1 className="page-title">Create user</h1>
        <button type="button" className="btn-ghost" onClick={() => navigate('/app/users')}>
          Back to list
        </button>
      </div>
      {err && <div className="err-banner">{err}</div>}
      <div className="form-grid" style={{ maxWidth: '520px' }}>
        <div>
          <label>Full name</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label>Phone (optional)</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label>Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Min 8 characters"
          />
        </div>
        <button
          type="button"
          className="btn-primary"
          disabled={busy || !fullName.trim() || !email.trim() || password.length < 8}
          onClick={() => void onCreate()}
        >
          {busy ? 'Creating…' : 'Create user'}
        </button>
      </div>
    </div>
  );
}
