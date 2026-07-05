import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ok } from '../lib/http.js';
import * as analytics from '../services/analytics.service.js';

const router = Router();
router.use(requireAuth);

// Money-flow / financial dashboard — admin only.
router.get(
  '/money-flow',
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    ok(res, await analytics.moneyFlow());
  }),
);

// Operational KPIs — admin only.
router.get(
  '/operations',
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    ok(res, await analytics.operationalMetrics());
  }),
);

// Filterable analytics — admin only.
router.get(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    ok(
      res,
      await analytics.analytics({
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        trek: req.query.trek as string | undefined,
        status: req.query.status as string | undefined,
        memberId: req.query.memberId as string | undefined,
      }),
    );
  }),
);

export default router;
