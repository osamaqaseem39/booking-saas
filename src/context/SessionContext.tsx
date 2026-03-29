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
  fetchSessionUser,
  getApiBase,
  getTenantId,
  getUserId,
  persistConnection,
  setTenantIdStorage,
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
  signIn: (api: string, uid: string) => Promise<void>;
  signOut: () => void;
};

const SessionCtx = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [apiBase, setApiBaseState] = useState(getApiBase);
  const [userId, setUserIdState] = useState(getUserId);
  const [tenantId, setTenantIdState] = useState(getTenantId);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    persistConnection({ apiBase, tenantId, userId });
  }, [apiBase, tenantId, userId]);

  const refreshSession = useCallback(async () => {
    if (!userId.trim()) {
      setSession(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const me = await fetchSessionUser();
      setSession(me);
      if (!me.roles?.length) {
        setError('This user has no roles assigned yet.');
      }
    } catch (e) {
      setSession(null);
      setError(e instanceof Error ? e.message : 'Session failed');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refreshSession();
  }, [userId, apiBase, refreshSession]);

  const setApiBase = useCallback((v: string) => {
    setApiBaseState(v);
  }, []);

  const setUserId = useCallback((v: string) => {
    setUserIdState(v);
  }, []);

  const setTenantId = useCallback((v: string) => {
    setTenantIdState(v);
    setTenantIdStorage(v);
  }, []);

  const signIn = useCallback(async (api: string, uid: string) => {
    setApiBaseState(api);
    setUserIdState(uid);
    persistConnection({
      apiBase: api,
      tenantId: getTenantId(),
      userId: uid,
    });
    setLoading(true);
    setError(null);
    try {
      const me = await fetchSessionUser();
      setSession(me);
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
    localStorage.removeItem('bukit_saas_user_id');
    setUserIdState('');
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
