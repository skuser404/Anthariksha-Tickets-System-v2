import { supabase } from './supabase.js';
import { env } from '../config/env.js';
import { driveAuthMode } from '../services/drive.service.js';

export interface HealthReport {
  ok: boolean;
  service: 'antariksha-api';
  ts: number;
  uptimeSeconds: number;
  checks: {
    database: { ok: boolean; detail: string };
    googleDrive: { ok: boolean; detail: string };
    environment: { ok: boolean; detail: string };
  };
}

/**
 * Variables the API cannot serve a real request without. Only their presence is
 * ever reported — never a value, a prefix or a length, since this endpoint is
 * unauthenticated so an uptime monitor can poll it.
 */
const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const;

async function checkDatabase() {
  const started = Date.now();
  const { error } = await supabase.from('users').select('id').limit(1);
  if (error) return { ok: false, detail: error.message.slice(0, 120) };
  return { ok: true, detail: `reachable in ${Date.now() - started}ms` };
}

function checkDrive() {
  switch (driveAuthMode()) {
    case 'oauth':
      return { ok: true, detail: 'configured (oauth)' };
    case 'service_account':
      // Connected but unable to write to a personal folder — reported as
      // degraded rather than healthy, because uploads will fail.
      return { ok: false, detail: 'service account: uploads fail unless the folder is a Shared Drive' };
    default:
      return { ok: false, detail: 'not configured' };
  }
}

function checkEnvironment() {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) return { ok: false, detail: `missing: ${missing.join(', ')}` };
  const devSecrets = env.jwt.accessSecret.startsWith('dev-') || env.jwt.refreshSecret.startsWith('dev-');
  if (devSecrets) return { ok: false, detail: 'development JWT secrets in use' };
  return { ok: true, detail: `${REQUIRED.length} required variables present` };
}

export async function buildHealthReport(): Promise<HealthReport> {
  const [database, googleDrive, environment] = [await checkDatabase(), checkDrive(), checkEnvironment()];
  return {
    // Drive being degraded must not take the service "down" — the API still
    // serves every non-upload route, and a red health check would make a
    // platform restart or pull the deployment.
    ok: database.ok && environment.ok,
    service: 'antariksha-api',
    ts: Date.now(),
    uptimeSeconds: Math.round(process.uptime()),
    checks: { database, googleDrive, environment },
  };
}
