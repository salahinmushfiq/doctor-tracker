'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiData, setCsrfToken, setUnauthorizedHandler } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import type { Session, User } from '@/types/api';

type Status = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

interface AuthContextValue {
  status: Status;
  user: User | null;
  isAdmin: boolean;
  /** true after the server rejected an authenticated request (expired / revoked session) */
  sessionLost: boolean;
  error: unknown;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  retry: () => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [sessionLost, setSessionLost] = React.useState(false);

  // The session lives in an HTTP-only cookie; JS only learns "who am I" (+ the CSRF token) from /auth/me.
  const me = useQuery<Session | null>({
    queryKey: qk.auth,
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      try {
        const session = await apiData<Session>('/auth/me', { signal, skipUnauthorizedHandler: true });
        setCsrfToken(session.csrfToken);
        return session;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setCsrfToken(null);
          return null;
        }
        throw err;
      }
    },
  });

  // Any 401 on a normal API call means the session is gone: drop private data from memory and let the guard redirect.
  React.useEffect(() => {
    setUnauthorizedHandler(() => {
      setCsrfToken(null);
      setSessionLost(true);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' });
      qc.setQueryData(qk.auth, null);
    });
    return () => setUnauthorizedHandler(null);
  }, [qc]);

  const login = React.useCallback(
    async (email: string, password: string) => {
      const session = await apiData<Session>('/auth/login', { method: 'POST', body: { email, password }, skipUnauthorizedHandler: true });
      setCsrfToken(session.csrfToken);
      setSessionLost(false);
      qc.setQueryData(qk.auth, session);
      return session.user;
    },
    [qc],
  );

  const logout = React.useCallback(async () => {
    try {
      await apiData('/auth/logout', { method: 'POST', skipUnauthorizedHandler: true });
    } catch {
      // Even if the call fails we still drop the local session; the cookie expires on its own.
    }
    setCsrfToken(null);
    setSessionLost(false);
    qc.clear();
    qc.setQueryData(qk.auth, null);
    router.replace('/login?reason=signedout');
  }, [qc, router]);

  const value = React.useMemo<AuthContextValue>(() => {
    const status: Status = me.isPending ? 'loading' : me.isError ? 'error' : me.data ? 'authenticated' : 'unauthenticated';
    const user = me.data?.user ?? null;
    return { status, user, isAdmin: user?.role === 'admin', sessionLost, error: me.error, login, logout, retry: () => void me.refetch() };
  }, [me, sessionLost, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
