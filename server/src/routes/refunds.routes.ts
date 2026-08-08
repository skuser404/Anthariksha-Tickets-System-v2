import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ApiError, ok } from '../lib/http.js';
import { supabase } from '../lib/supabase.js';
import * as refunds from '../services/refunds.service.js';

const router = Router();
router.use(requireAuth);

/**
 * Cancellation/refund has been retired operationally: the live workflow is
 * pending_verification -> approved | rejected.
 *
 * Reads stay open so historical refunds remain visible and auditable, but every
 * write is refused. Nothing is dropped from the database — disabling the UI
 * alone would leave these endpoints reachable by a direct API call.
 */
const refundsRetired: import('express').RequestHandler = (_req, _res, next) => {
  void (async () => {
    try {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'refunds_enabled')
        .maybeSingle();
      if (data?.value === true) return next(); // re-enabled deliberately via settings
      next(
        new ApiError(
          410,
          'Cancellations and refunds have been retired. Tickets are now either approved or rejected.',
        ),
      );
    } catch (e) {
      next(e);
    }
  })();
};

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

// Retired — kept only so an old client gets a clear 410 instead of a silent 404.
router.post(
  '/cancel',
  requireRole('admin'),
  refundsRetired,
  asyncHandler(async (req, res) => {
    ok(res, await refunds.cancelTicket(req.user!.sub, req.body, req.ip), 201);
  }),
);

router.post(
  '/:id/processing',
  requireRole('admin'),
  refundsRetired,
  asyncHandler(async (req, res) => {
    ok(res, await refunds.markRefundProcessing(req.user!.sub, req.params.id, req.ip));
  }),
);

// Mark a pending/processing refund as received — admin only.
router.post(
  '/:id/complete',
  requireRole('admin'),
  refundsRetired,
  asyncHandler(async (req, res) => {
    const { receivedDate } = z
      .object({ receivedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
      .parse(req.body);
    ok(res, await refunds.markRefundCompleted(req.user!.sub, req.params.id, receivedDate, req.ip));
  }),
);

export default router;
