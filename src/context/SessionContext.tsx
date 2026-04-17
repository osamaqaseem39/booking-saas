import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  clearAuthLocalStorage,
  fetchSessionUser,
  getApiBase,
  getTenantId,
  getToken,
  persistConnection,
  setTenantIdStorage,
  subscribeTokensUpdated,
} from '../api/saasClient';
import type { SessionUser } from '../types/domain';

type Ctx = {
  apiBase: string;
  userId: string;
  tenantId: string;
  session: SessionUser | null;
  loading: boolean;
  error: string | null;
  setApiBase: (v: string) => void;
  setUserId: (v: string) => void;
  setTenantId: (v: string) => void;
  refreshSession: () => Promise<void>;
  signIn: (api: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
};

const SessionCtx = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [apiBase, setApiBaseState] = useState(getApiBase);
  const [userId, setUserIdState] = useState('');
  const [tenantId, setTenantIdState] = useState(getTenantId);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(() => Boolean(getToken().trim()));
  const [error, setError] = useState<string | null>(null);
  const [token, setTokenState] = useState(getToken);

  useEffect(() => {
    persistConnection({ apiBase, tenantId, token });
  }, [apiBase, tenantId, token]);

  useEffect(() => {
    const sync = () => setTokenState(getToken());
    return subscribeTokensUpdated(sync);
  }, []);

  const refreshSession = useCallback(async () => {
    if (!token.trim()) {
      setSession(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const me = await fetchSessionUser();
      setSession(me);
      setUserIdState(me.id);
      if (!me.roles?.length) {
        setError('This user has no roles assigned yet.');
      }
    } catch (e) {
      setSession(null);
      setError(e instanceof Error ? e.message : 'Session failed');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refreshSession();
  }, [token, apiBase, refreshSession]);

  const setApiBase = useCallback((v: string) => {
    setApiBaseState(v);
  }, []);

  const setUserId = useCallback((v: string) => {
    setUserIdState(v);
  }, []);

  const setTenantId = useCallback((v: string) => {
    // Defensive: `v` can be `undefined` at runtime if API data is missing.
    const next = (v ?? '').toString();
    setTenantIdState(next);
    setTenantIdStorage(next);
  }, []);

  const signIn = useCallback(async (api: string, email: string, password: string) => {
    setApiBaseState(api);
    setLoading(true);
    setError(null);
    try {
      const base = api.replace(/\/$/, '');
      const res = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        let message = 'Login failed';
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
      const data = (await res.json()) as {
        token: string;
        refreshToken?: string;
      };
      setTokenState(data.token);
      setTenantIdState('');
      persistConnection({
        apiBase: api,
        tenantId: '',
        token: data.token,
        ...(data.refreshToken ? { refreshToken: data.refreshToken } : {}),
      });

      const me = await fetchSessionUser();
      setSession(me);
      setUserIdState(me.id);
      if (!me.roles?.length) {
        setError('This user has no roles assigned yet.');
      }
    } catch (e) {
      setSession(null);
      setError(e instanceof Error ? e.message : 'Sign-in failed');
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(() => {
    clearAuthLocalStorage();
    setUserIdState('');
    setTokenState('');
    setTenantIdState('');
    setSession(null);
    setError(null);
  }, []);

  const value = useMemo(
    () => ({
      apiBase,
      userId,
      tenantId,
      session,
      loading,
      error,
      setApiBase,
      setUserId,
      setTenantId,
      refreshSession,
      signIn,
      signOut,
    }),
    [
      apiBase,
      userId,
      tenantId,
      session,
      loading,
      error,
      setApiBase,
      setUserId,
      setTenantId,
      refreshSession,
      signIn,
      signOut,
    ],
  );

  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export function useSession(): Ctx {
  const c = useContext(SessionCtx);
  if (!c) throw new Error('useSession outside SessionProvider');
  return c;
}
