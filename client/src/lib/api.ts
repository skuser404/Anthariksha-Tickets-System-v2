import axios, { AxiosError } from 'axios';

const TOKEN_KEY = 'antariksha.access';
const REFRESH_KEY = 'antariksha.refresh';

export const tokenStore = {
  get access() {
    return localStorage.getItem(TOKEN_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh?: string) {
    localStorage.setItem(TOKEN_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

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
          tokenStore.clear();
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
