import { createApp } from './app.js';
import { env } from './config/env.js';
import { supabase } from './lib/supabase.js';
import { driveAuthMode } from './services/drive.service.js';
import { startNotificationScheduler } from './jobs/notifications.job.js';

/** One-line summary of how Drive will authenticate, shown at boot. */
function describeDriveConfig(): string {
  switch (driveAuthMode()) {
    case 'oauth':
      return 'OAuth (uploads owned by your Google account)';
    case 'service_account':
      return 'service account (only works with a Shared Drive)';
    default:
      return 'NOT CONFIGURED — uploads will fail';
  }
}

/**
 * Probe the database once at boot.
 *
 * Without this the first sign of a bad SUPABASE_SERVICE_ROLE_KEY is a login
 * that reports "Invalid email or password" — the failure surfaces far from its
 * cause. Log it loudly at startup instead. Not fatal: the API still serves
 * /health so a platform health check can report the process as up.
 */
async function checkDatabase() {
  // A plain select on purpose: a `head: true` probe comes back with an error
  // object whose message is empty, which defeats the point of this check.
  const { error } = await supabase.from('users').select('id').limit(1);
  if (!error) {
    // eslint-disable-next-line no-console
    console.log(`✅ Database connection OK   |   Google Drive: ${describeDriveConfig()}`);
    // .env is read once at startup. `tsx watch` only watches src/, and dotfiles
    // are not watched anyway, so an edit here needs a manual restart — easy to
    // lose an hour to when a credential change appears to have no effect.
    // eslint-disable-next-line no-console
    console.log('   (.env is loaded at startup — restart this process after editing it)');
    return;
  }
  console.error(`\n❌ DATABASE UNREACHABLE: ${error.message}`);
  if (/invalid api key|jwt/i.test(error.message)) {
    console.error('   SUPABASE_SERVICE_ROLE_KEY looks wrong. Copy it from');
    console.error('   Supabase → Project Settings → API → service_role.');
  } else if (/does not exist/i.test(error.message)) {
    console.error('   The schema is missing — apply supabase/migrations in order (0001 → 0012).');
  }
  console.error('   Sign-in and every data screen will fail until this is fixed.\n');
}

const app = createApp();

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`🚀 Antariksha API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  void checkDatabase();
  // Background automation: surface stale approvals and other operational gaps.
  startNotificationScheduler();
});
