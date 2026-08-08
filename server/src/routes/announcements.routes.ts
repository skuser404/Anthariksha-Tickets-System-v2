import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ApiError, ok } from '../lib/http.js';
import { supabase } from '../lib/supabase.js';
import { audit } from '../lib/audit.js';

const router = Router();
router.use(requireAuth);

/**
 * Announcements currently live for the signed-in member.
 *
 * "Live" means active, started, and not yet expired. The window is evaluated
 * here rather than in SQL so a null start/end reads as "no bound".
 */
router.get(
  '/active',
  asyncHandler(async (_req, res) => {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, message, priority, starts_at, ends_at, created_at')
      .eq('is_active', true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) throw new ApiError(500, error.message);
    ok(res, data ?? []);
  }),
);

// ---- Admin management ----

router.get(
  '/',
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*, author:created_by(full_name)')
      .order('created_at', { ascending: false });
    if (error) throw new ApiError(500, error.message);
    ok(res, data ?? []);
  }),
);

const schema = z.object({
  title: z.string().min(2).max(160),
  message: z.string().min(2).max(4000),
  priority: z.enum(['normal', 'important']).optional(),
  isActive: z.boolean().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

const toRow = (b: z.infer<typeof schema> | Partial<z.infer<typeof schema>>) => {
  const row: Record<string, unknown> = {};
  if (b.title !== undefined) row.title = b.title;
  if (b.message !== undefined) row.message = b.message;
  if (b.priority !== undefined) row.priority = b.priority;
  if (b.isActive !== undefined) row.is_active = b.isActive;
  if (b.startsAt !== undefined) row.starts_at = b.startsAt;
  if (b.endsAt !== undefined) row.ends_at = b.endsAt;
  return row;
};

router.post(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const b = schema.parse(req.body);
    const { data, error } = await supabase
      .from('announcements')
      .insert({ ...toRow(b), created_by: req.user!.sub })
      .select('*')
      .single();
    if (error) throw new ApiError(500, error.message);
    await audit({ actorId: req.user!.sub, action: 'announcement.create', entity: 'announcement', entityId: data.id, metadata: { title: b.title }, ip: req.ip });
    ok(res, data, 201);
  }),
);

router.patch(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const b = schema.partial().parse(req.body);
    const { data, error } = await supabase
      .from('announcements')
      .update(toRow(b))
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (error) throw new ApiError(500, error.message);
    await audit({ actorId: req.user!.sub, action: 'announcement.update', entity: 'announcement', entityId: req.params.id, ip: req.ip });
    ok(res, data);
  }),
);

router.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { error } = await supabase.from('announcements').delete().eq('id', req.params.id);
    if (error) throw new ApiError(500, error.message);
    await audit({ actorId: req.user!.sub, action: 'announcement.delete', entity: 'announcement', entityId: req.params.id, ip: req.ip });
    ok(res, { ok: true });
  }),
);

export default router;
