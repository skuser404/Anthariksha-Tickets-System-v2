import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ok } from '../lib/http.js';
import { buildReport, reportToCsv, type ReportType } from '../services/reports.service.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

const REPORT_TYPES = ['daily', 'weekly', 'monthly', 'yearly', 'member', 'trek', 'refund', 'payment', 'commission'] as const;

const querySchema = z.object({
  type: z.enum(REPORT_TYPES),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  memberId: z.string().uuid().optional(),
  trek: z.string().optional(),
});

// JSON report (for on-screen tables + client-side Excel/PDF export).
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = querySchema.parse(req.query);
    ok(res, await buildReport(q.type as ReportType, q));
  }),
);

// Server-rendered CSV download.
router.get(
  '/csv',
  asyncHandler(async (req, res) => {
    const q = querySchema.parse(req.query);
    const report = await buildReport(q.type as ReportType, q);
    const csv = reportToCsv(report);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${q.type}-report.csv"`);
    res.send(csv);
  }),
);

export default router;
