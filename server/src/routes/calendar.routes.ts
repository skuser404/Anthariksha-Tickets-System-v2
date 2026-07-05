import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ok } from '../lib/http.js';
import { calendarEvents } from '../services/calendar.service.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { month } = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }).parse({
      month: (req.query.month as string) || new Date().toISOString().slice(0, 7),
    });
    ok(res, { month, events: await calendarEvents(month) });
  }),
);

export default router;
