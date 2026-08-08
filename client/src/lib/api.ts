import axios, { AxiosError } from 'axios';

const TOKEN_KEY = 'antariksha.access';
const REFRESH_KEY = 'antariksha.refresh';
export const USER_KEY = 'antariksha.user';

/**
 * "Remember me" picks where the session lives: localStorage survives a browser
 * restart, sessionStorage is dropped when the tab closes. Reads check both so
 * either choice works; writes go to exactly one and clear the other.
 */
const read = (k: string) => localStorage.getItem(k) ?? sessionStorage.getItem(k);
const remove = (k: string) => {
  localStorage.removeItem(k);
  sessionStorage.removeItem(k);
};

export const tokenStore = {
  get access() {
    return read(TOKEN_KEY);
  },
  get refresh() {
    return read(REFRESH_KEY);
  },
  /** `persist` defaults to wherever the session already lives (token refresh). */
  set(access: string, refresh?: string, persist?: boolean) {
    const keep = persist ?? localStorage.getItem(REFRESH_KEY) !== null;
    const store = keep ? localStorage : sessionStorage;
    remove(TOKEN_KEY);
    store.setItem(TOKEN_KEY, access);
    if (refresh) {
      remove(REFRESH_KEY);
      store.setItem(REFRESH_KEY, refresh);
    }
  },
  setUser(json: string, persist: boolean) {
    remove(USER_KEY);
    (persist ? localStorage : sessionStorage).setItem(USER_KEY, json);
  },
  get user() {
    return read(USER_KEY);
  },
  clear() {
    remove(TOKEN_KEY);
    remove(REFRESH_KEY);
    remove(USER_KEY);
  },
};

/**
 * Hard sign-out used when the refresh token is rejected. The cached user must go
 * too — otherwise the app keeps rendering the authenticated shell with no valid
 * session and every request 401s.
 */
function forceSignOut() {
  tokenStore.clear();
  if (window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

// In dev, Vite proxies /api -> http://localhost:4000.
// In prod, set VITE_API_URL to the deployed API origin (e.g. https://api.example.com).
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api';

export const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const t = tokenStore.access;
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

// Transparent access-token refresh on 401.
let refreshing: Promise<string | null> | null = null;
api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as typeof error.config & { _retry?: boolean };
    if (error.response?.status === 401 && !original?._retry && tokenStore.refresh) {
      original._retry = true;
      refreshing ??= api
        .post('/auth/refresh', { refreshToken: tokenStore.refresh })
        .then((res) => {
          const { accessToken, refreshToken } = res.data.data;
          tokenStore.set(accessToken, refreshToken);
          return accessToken as string;
        })
        .catch(() => {
          forceSignOut();
          return null;
        })
        .finally(() => {
          refreshing = null;
        });
      const newToken = await refreshing;
      if (newToken) {
        original.headers!.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

export function apiError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    return (e.response?.data as any)?.error?.message ?? e.message;
  }
  return e instanceof Error ? e.message : 'Unexpected error';
}
