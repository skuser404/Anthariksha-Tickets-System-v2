import { createApp } from './app.js';
import { env } from './config/env.js';
import { supabase } from './lib/supabase.js';
import { startNotificationScheduler } from './jobs/notifications.job.js';

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
    console.log('✅ Database connection OK');
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
