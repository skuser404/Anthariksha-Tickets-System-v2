import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ApiError, ok } from '../lib/http.js';
import { supabase } from '../lib/supabase.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

// Append-only audit log (admin). Supports ?entity= and ?action= filters + pagination.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 50)));
    const fromIdx = (page - 1) * pageSize;

    let q = supabase
      .from('audit_logs')
      .select('*, actor:actor_id(full_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(fromIdx, fromIdx + pageSize - 1);
    if (req.query.entity) q = q.eq('entity', req.query.entity as string);
    if (req.query.action) q = q.ilike('action', `%${req.query.action as string}%`);

    const { data, count, error } = await q;
    if (error) throw new ApiError(500, error.message);
    ok(res, { items: data ?? [], total: count ?? 0, page, pageSize });
  }),
);

export default router;
