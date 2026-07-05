import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { applyAccent, type AccentKey } from '@/lib/accents';

type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeState {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  accent: AccentKey;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
  setAccent: (a: AccentKey) => void;
}

const ThemeContext = createContext<ThemeState | undefined>(undefined);

const prefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => (localStorage.getItem('antariksha.theme') as ThemeMode) || 'dark');
  const [accent, setAccentState] = useState<AccentKey>(() => (localStorage.getItem('antariksha.accent') as AccentKey) || 'blue');
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => (mode === 'auto' ? (prefersDark() ? 'dark' : 'light') : mode));

  // Apply theme mode (+ react to OS changes when in auto).
  useEffect(() => {
    const apply = () => {
      const r = mode === 'auto' ? (prefersDark() ? 'dark' : 'light') : mode;
      setResolved(r);
      document.documentElement.classList.toggle('dark', r === 'dark');
    };
    apply();
    localStorage.setItem('antariksha.theme', mode);
    if (mode === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [mode]);

  // Apply accent palette.
  useEffect(() => {
    applyAccent(accent);
    localStorage.setItem('antariksha.accent', accent);
  }, [accent]);

  return (
    <ThemeContext.Provider
      value={{
        mode,
        resolved,
        accent,
        setMode,
        setAccent: setAccentState,
        toggle: () => setMode(resolved === 'dark' ? 'light' : 'dark'),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
