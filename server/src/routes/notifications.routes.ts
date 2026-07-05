import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError, ok } from '../lib/http.js';
import { supabase } from '../lib/supabase.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user!.sub)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw new ApiError(500, error.message);
    const unread = (data ?? []).filter((n) => !n.is_read).length;
    ok(res, { items: data ?? [], unread });
  }),
);

router.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', req.params.id)
      .eq('user_id', req.user!.sub);
    if (error) throw new ApiError(500, error.message);
    ok(res, { ok: true });
  }),
);

router.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.user!.sub)
      .eq('is_read', false);
    if (error) throw new ApiError(500, error.message);
    ok(res, { ok: true });
  }),
);

export default router;
