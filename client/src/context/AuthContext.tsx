import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, tokenStore } from '@/lib/api';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
  isSuper?: boolean;
}

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  /** `persist` = "remember me": keep the session across browser restarts. */
  setSession: (u: SessionUser, access: string, refresh: string, persist?: boolean) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = tokenStore.user;
    if (stored && tokenStore.access) {
      try {
        // Corrupt/partial storage must not take the whole app down on boot.
        setUser(JSON.parse(stored) as SessionUser);
        // Validate the token in the background.
        api.get('/auth/me').catch(() => {
          tokenStore.clear();
          setUser(null);
        });
      } catch {
        tokenStore.clear();
      }
    }
    setLoading(false);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      setSession: (u, access, refresh, persist = true) => {
        tokenStore.set(access, refresh, persist);
        tokenStore.setUser(JSON.stringify(u), persist);
        setUser(u);
      },
      logout: () => {
        tokenStore.clear();
        setUser(null);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
