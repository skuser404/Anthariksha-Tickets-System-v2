import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ApiError, ok } from '../lib/http.js';
import { supabase } from '../lib/supabase.js';
import { postLedger } from '../lib/ledger.js';
import { audit } from '../lib/audit.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

// Paginated, filterable ledger view + per-type totals.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize ?? 50)));
    const fromIdx = (page - 1) * pageSize;

    let q = supabase
      .from('ledger_entries')
      .select('*, member:member_id(full_name), creator:created_by(full_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(fromIdx, fromIdx + pageSize - 1);
    if (req.query.type) q = q.eq('type', req.query.type as string);
    if (req.query.memberId) q = q.eq('member_id', req.query.memberId as string);
    if (req.query.from) q = q.gte('created_at', `${req.query.from as string}T00:00:00Z`);
    if (req.query.to) q = q.lte('created_at', `${req.query.to as string}T23:59:59Z`);

    const { data, count, error } = await q;
    if (error) throw new ApiError(500, error.message);

    // Totals by type across the whole ledger (not just this page).
    const { data: all } = await supabase.from('ledger_entries').select('type, flow, amount');
    const totals: Record<string, number> = {};
    let inflow = 0;
    let outflow = 0;
    for (const r of all ?? []) {
      totals[r.type] = (totals[r.type] ?? 0) + Number(r.amount);
      if (r.flow === 'in') inflow += Number(r.amount);
      if (r.flow === 'out') outflow += Number(r.amount);
    }

    ok(res, { items: data ?? [], total: count ?? 0, page, pageSize, totals, inflow, outflow, net: inflow - outflow });
  }),
);

// Manual adjustment — append-only.
const adjustSchema = z.object({
  amount: z.number().refine((n) => n !== 0, 'Amount cannot be zero'),
  flow: z.enum(['in', 'out']).default('out'),
  memberId: z.string().uuid().optional(),
  referenceNumber: z.string().optional(),
  notes: z.string().min(1),
});
router.post(
  '/adjustment',
  asyncHandler(async (req, res) => {
    const b = adjustSchema.parse(req.body);
    await postLedger({
      type: 'manual_adjustment',
      flow: b.flow,
      amount: b.amount,
      memberId: b.memberId ?? null,
      referenceNumber: b.referenceNumber ?? null,
      notes: b.notes,
      createdBy: req.user!.sub,
    });
    await audit({ actorId: req.user!.sub, action: 'ledger.adjustment', entity: 'ledger', metadata: { ...b }, ip: req.ip });
    ok(res, { ok: true }, 201);
  }),
);

export default router;
