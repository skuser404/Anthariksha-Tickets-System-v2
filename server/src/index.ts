import { createApp } from './app.js';
import { env } from './config/env.js';
import { startNotificationScheduler } from './jobs/notifications.job.js';

const app = createApp();

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`🚀 Antariksha API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  // Background automation: surface stale approvals, due/overdue refunds, etc.
  startNotificationScheduler();
});
