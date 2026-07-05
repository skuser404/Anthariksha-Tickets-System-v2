import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ok } from '../lib/http.js';
import { ask, SUGGESTIONS } from '../services/assistant.service.js';
import { activityFeed, leaderboard, topTreks } from '../services/reporting.service.js';
import { runSmartNotifications } from '../jobs/notifications.job.js';
import { supabase } from '../lib/supabase.js';
import { audit } from '../lib/audit.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

// AI operations assistant (natural-language Q&A).
router.get('/assistant/suggestions', asyncHandler(async (_req, res) => ok(res, SUGGESTIONS)));
router.post(
  '/assistant/ask',
  asyncHandler(async (req, res) => {
    const { question } = z.object({ question: z.string().min(1).max(500) }).parse(req.body);
    const result = await ask(question);
    await audit({ actorId: req.user!.sub, action: 'assistant.ask', entity: 'assistant', metadata: { question, matched: result.matched }, ip: req.ip });
    ok(res, result);
  }),
);

// Live activity feed (from the audit log).
router.get('/activity', asyncHandler(async (_req, res) => ok(res, await activityFeed(80))));

// Leaderboard + per-member performance.
router.get('/leaderboard', asyncHandler(async (_req, res) => ok(res, await leaderboard())));
router.get('/top-treks', asyncHandler(async (_req, res) => ok(res, await topTreks())));

// Run the smart-notification checks on demand.
router.post(
  '/run-checks',
  asyncHandler(async (req, res) => {
    const result = await runSmartNotifications();
    await audit({ actorId: req.user!.sub, action: 'automation.run_checks', entity: 'system', metadata: result.checks, ip: req.ip });
    ok(res, result);
  }),
);

// Export a JSON snapshot of the core tables (manual backup / data export).
router.get(
  '/export',
  asyncHandler(async (_req, res) => {
    const tables = ['users', 'trek_pricing', 'tickets', 'original_tickets', 'replacement_tickets', 'payments', 'refunds', 'ledger_entries', 'settings'];
    const dump: Record<string, unknown> = { exportedAt: new Date().toISOString() };
    for (const table of tables) {
      // users export omits secrets
      const cols = table === 'users' ? 'id, full_name, email, phone, role, is_active, created_at' : '*';
      // eslint-disable-next-line no-await-in-loop
      const { data } = await supabase.from(table).select(cols);
      dump[table] = data ?? [];
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="antariksha-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.send(JSON.stringify(dump, null, 2));
  }),
);

export default router;
