import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ok } from '../lib/http.js';
import * as payments from '../services/payments.service.js';

const router = Router();
router.use(requireAuth);

// Record a payment — admin only.
router.post(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    ok(res, await payments.recordPayment(req.user!.sub, req.body, req.ip), 201);
  }),
);

// List payments — members scoped to themselves; admins can pass memberId.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const isAdmin = req.user!.role === 'admin';
    ok(
      res,
      await payments.listPayments({
        memberId: isAdmin ? (req.query.memberId as string | undefined) : req.user!.sub,
        page: req.query.page ? Number(req.query.page) : undefined,
        pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
      }),
    );
  }),
);

// Org-wide member balances — admin only.
router.get(
  '/financials',
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    ok(res, await payments.memberFinancials());
  }),
);

// A member's own ledger (admins may pass ?memberId=).
router.get(
  '/ledger',
  asyncHandler(async (req, res) => {
    const isAdmin = req.user!.role === 'admin';
    const memberId = isAdmin && req.query.memberId ? (req.query.memberId as string) : req.user!.sub;
    ok(res, await payments.memberLedger(memberId));
  }),
);

export default router;
