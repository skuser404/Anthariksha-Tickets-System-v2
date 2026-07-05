import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ApiError, ok } from '../lib/http.js';
import { supabase } from '../lib/supabase.js';
import { audit } from '../lib/audit.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabase
      .from('trek_pricing')
      .select('*')
      .order('name');
    if (error) throw new ApiError(500, error.message);
    ok(res, data);
  }),
);

const upsertSchema = z.object({
  name: z.string().min(2),
  permitPrice: z.number().nonnegative(),
  isActive: z.boolean().optional(),
});

router.post(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = upsertSchema.parse(req.body);
    const { data, error } = await supabase
      .from('trek_pricing')
      .insert({ name: body.name, permit_price: body.permitPrice, is_active: body.isActive ?? true })
      .select('*')
      .single();
    if (error) throw new ApiError(error.code === '23505' ? 409 : 500, error.message);
    await audit({ actorId: req.user!.sub, action: 'trek.create', entity: 'trek_pricing', entityId: data.id, ip: req.ip });
    ok(res, data, 201);
  }),
);

// Updating a price does NOT touch existing tickets (they snapshot permit_price).
router.patch(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = upsertSchema.partial().parse(req.body);
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.permitPrice !== undefined) patch.permit_price = body.permitPrice;
    if (body.isActive !== undefined) patch.is_active = body.isActive;
    const { data, error } = await supabase
      .from('trek_pricing')
      .update(patch)
      .eq('id', req.params.id)
      .select('*')
      .single();
    if (error) throw new ApiError(500, error.message);
    await audit({ actorId: req.user!.sub, action: 'trek.update', entity: 'trek_pricing', entityId: req.params.id, metadata: patch, ip: req.ip });
    ok(res, data);
  }),
);

export default router;
