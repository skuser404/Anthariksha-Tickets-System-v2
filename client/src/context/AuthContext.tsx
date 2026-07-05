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
  setSession: (u: SessionUser, access: string, refresh: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('antariksha.user');
    if (stored && tokenStore.access) {
      setUser(JSON.parse(stored));
      // Validate the token in the background.
      api.get('/auth/me').catch(() => {
        tokenStore.clear();
        localStorage.removeItem('antariksha.user');
        setUser(null);
      });
    }
    setLoading(false);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      setSession: (u, access, refresh) => {
        tokenStore.set(access, refresh);
        localStorage.setItem('antariksha.user', JSON.stringify(u));
        setUser(u);
      },
      logout: () => {
        tokenStore.clear();
        localStorage.removeItem('antariksha.user');
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
