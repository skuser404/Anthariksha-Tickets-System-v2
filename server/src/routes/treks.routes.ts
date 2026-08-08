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

// ---------------------------------------------------------------- trek dates
// Members may only book dates an admin has opened here.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Bookable dates. Members get only future, open dates; admins see everything so
 * they can manage past and closed departures.
 */
router.get(
  '/dates',
  asyncHandler(async (req, res) => {
    const isAdmin = req.user!.role === 'admin';
    let q = supabase
      .from('trek_dates')
      .select('*, trek:trek_id(id, name, permit_price, is_active)')
      .order('trek_date');

    if (req.query.trekId) q = q.eq('trek_id', req.query.trekId as string);
    if (!isAdmin) {
      q = q.eq('status', 'available').gte('trek_date', new Date().toISOString().slice(0, 10));
    }
    const { data, error } = await q;
    if (error) throw new ApiError(500, error.message);

    // Never offer a date belonging to a deactivated trek.
    const rows = (data ?? []).filter((d: any) => (isAdmin ? true : d.trek?.is_active !== false));
    ok(res, rows);
  }),
);

const dateSchema = z.object({
  trekId: z.string().uuid(),
  trekDate: z.string().regex(ISO_DATE),
  status: z.enum(['available', 'full', 'closed']).optional(),
  maxPersons: z.number().int().positive().nullable().optional(),
  notes: z.string().max(500).optional(),
});

router.post(
  '/dates',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const b = dateSchema.parse(req.body);
    const { data, error } = await supabase
      .from('trek_dates')
      .insert({
        trek_id: b.trekId,
        trek_date: b.trekDate,
        status: b.status ?? 'available',
        max_persons: b.maxPersons ?? null,
        notes: b.notes ?? null,
        created_by: req.user!.sub,
      })
      .select('*')
      .single();
    if (error) {
      throw new ApiError(
        error.code === '23505' ? 409 : 500,
        error.code === '23505' ? 'That date is already configured for this trek.' : error.message,
      );
    }
    await audit({ actorId: req.user!.sub, action: 'trek_date.create', entity: 'trek_date', entityId: data.id, metadata: { trekDate: b.trekDate }, ip: req.ip });
    ok(res, data, 201);
  }),
);

router.patch(
  '/dates/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const b = dateSchema.partial().parse(req.body);
    const patch: Record<string, unknown> = {};
    if (b.trekDate !== undefined) patch.trek_date = b.trekDate;
    if (b.status !== undefined) patch.status = b.status;
    if (b.maxPersons !== undefined) patch.max_persons = b.maxPersons;
    if (b.notes !== undefined) patch.notes = b.notes;
    const { data, error } = await supabase.from('trek_dates').update(patch).eq('id', req.params.id).select('*').single();
    if (error) throw new ApiError(500, error.message);
    await audit({ actorId: req.user!.sub, action: 'trek_date.update', entity: 'trek_date', entityId: req.params.id, metadata: patch, ip: req.ip });
    ok(res, data);
  }),
);

/**
 * Removing a date stops future bookings. Tickets already submitted for it are
 * left alone — they are a record of something that really happened.
 */
router.delete(
  '/dates/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { error } = await supabase.from('trek_dates').delete().eq('id', req.params.id);
    if (error) throw new ApiError(500, error.message);
    await audit({ actorId: req.user!.sub, action: 'trek_date.delete', entity: 'trek_date', entityId: req.params.id, ip: req.ip });
    ok(res, { ok: true });
  }),
);

// -------------------------------------------------------------------- treks

const upsertSchema = z.object({
  name: z.string().min(2),
  permitPrice: z.number().nonnegative(),
  isActive: z.boolean().optional(),
  district: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  bookingInstructions: z.string().max(2000).optional(),
});

router.post(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = upsertSchema.parse(req.body);
    const { data, error } = await supabase
      .from('trek_pricing')
      .insert({
        name: body.name,
        permit_price: body.permitPrice,
        is_active: body.isActive ?? true,
        district: body.district ?? null,
        description: body.description ?? null,
        booking_instructions: body.bookingInstructions ?? null,
      })
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
    if (body.district !== undefined) patch.district = body.district;
    if (body.description !== undefined) patch.description = body.description;
    if (body.bookingInstructions !== undefined) patch.booking_instructions = body.bookingInstructions;
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
