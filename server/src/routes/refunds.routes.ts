import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ok } from '../lib/http.js';
import * as refunds from '../services/refunds.service.js';

const router = Router();
router.use(requireAuth);

// Refund list + summary cards — members see only their own.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const isAdmin = req.user!.role === 'admin';
    ok(
      res,
      await refunds.listRefunds({
        status: req.query.status as string | undefined,
        memberId: isAdmin ? (req.query.memberId as string | undefined) : req.user!.sub,
      }),
    );
  }),
);

// Live refund preview as the admin picks a cancellation date.
router.get(
  '/preview',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { ticketId, cancellationDate } = z
      .object({ ticketId: z.string().uuid(), cancellationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
      .parse(req.query);
    ok(res, await refunds.previewRefund(ticketId, cancellationDate));
  }),
);

// Cancel a ticket (auto-calculates refund) — admin only.
router.post(
  '/cancel',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    ok(res, await refunds.cancelTicket(req.user!.sub, req.body, req.ip), 201);
  }),
);

// Mark a refund as processing (manual status update) — admin only.
router.post(
  '/:id/processing',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    ok(res, await refunds.markRefundProcessing(req.user!.sub, req.params.id, req.ip));
  }),
);

// Mark a pending/processing refund as received — admin only.
router.post(
  '/:id/complete',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { receivedDate } = z
      .object({ receivedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
      .parse(req.body);
    ok(res, await refunds.markRefundCompleted(req.user!.sub, req.params.id, receivedDate, req.ip));
  }),
);

export default router;
