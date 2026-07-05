import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ok } from '../lib/http.js';
import { supabase } from '../lib/supabase.js';
import { adminDashboard, memberExtras } from '../services/dashboard.service.js';
import { adminInsights, memberInsights } from '../services/insights.service.js';

const router = Router();
router.use(requireAuth);

// Admin dashboard — today's KPIs, pending queues, charts.
router.get(
  '/admin',
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    ok(res, await adminDashboard());
  }),
);

// Smart insights (rule-based) for the dashboard hero.
router.get(
  '/insights',
  asyncHandler(async (req, res) => {
    const insights = req.user!.role === 'admin' ? await adminInsights() : await memberInsights(req.user!.sub);
    ok(res, insights);
  }),
);

const STATUSES = [
  'pending_verification',
  'approved',
  'not_confirmed',
  'cancelled',
  'refund_pending',
  'refund_completed',
  'replacement_completed',
] as const;

/** Member dashboard summary cards. */
router.get(
  '/member',
  asyncHandler(async (req, res) => {
    const memberId = req.user!.sub;

    const { data: rows } = await supabase
      .from('tickets')
      .select('status, persons, commission_amount, trek_date')
      .eq('member_id', memberId);

    const tickets = rows ?? [];
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<string, number>;
    let totalPersons = 0;
    let approvedCommission = 0;
    const workingDays = new Set<string>();

    for (const t of tickets) {
      byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
      totalPersons += t.persons;
      if (t.status === 'approved') approvedCommission += Number(t.commission_amount);
      workingDays.add(t.trek_date);
    }

    const [{ data: fin }, extras] = await Promise.all([
      supabase
        .from('member_financials')
        .select('total_earned, total_paid, balance')
        .eq('member_id', memberId)
        .maybeSingle(),
      memberExtras(memberId),
    ]);

    ok(res, {
      totalTickets: tickets.length,
      totalPersons,
      totalCommissionEarned: Number(fin?.total_earned ?? approvedCommission),
      totalPaid: Number(fin?.total_paid ?? 0),
      currentBalance: Number(fin?.balance ?? 0),
      workingDays: workingDays.size,
      approvedTickets: byStatus.approved,
      pendingVerification: byStatus.pending_verification,
      notConfirmed: byStatus.not_confirmed,
      cancelled: byStatus.cancelled,
      refundPending: byStatus.refund_pending,
      refundCompleted: byStatus.refund_completed,
      avgTicketsPerDay: extras.avgTicketsPerDay,
      monthlyEarnings: extras.monthlyEarnings,
    });
  }),
);

export default router;
