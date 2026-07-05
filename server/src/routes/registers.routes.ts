import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ApiError, ok } from '../lib/http.js';
import { supabase } from '../lib/supabase.js';
import { audit, notify } from '../lib/audit.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/* ===================== Original ticket register ===================== */

const originalSchema = z.object({
  ticketCode: z.string().min(2),
  bookingEmail: z.string().email(),
  bookingDate: dateStr,
  trekDate: dateStr,
  persons: z.number().int().positive(),
  permitPrice: z.number().nonnegative(),
  status: z.string().optional(),
  remarks: z.string().max(1000).optional(),
});

router.get(
  '/originals',
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabase.from('original_tickets').select('*').order('created_at', { ascending: false });
    if (error) throw new ApiError(500, error.message);
    ok(res, data ?? []);
  }),
);

router.post(
  '/originals',
  asyncHandler(async (req, res) => {
    const b = originalSchema.parse(req.body);
    const { data, error } = await supabase
      .from('original_tickets')
      .insert({
        ticket_code: b.ticketCode,
        booking_email: b.bookingEmail,
        booking_date: b.bookingDate,
        trek_date: b.trekDate,
        persons: b.persons,
        permit_price: b.permitPrice,
        status: b.status ?? 'approved',
        remarks: b.remarks ?? null,
      })
      .select('*')
      .single();
    if (error) throw new ApiError(500, error.message);
    await audit({ actorId: req.user!.sub, action: 'original.create', entity: 'original_ticket', entityId: data.id, ip: req.ip });
    ok(res, data, 201);
  }),
);

/* ===================== Replacement tickets ===================== */

const replacementSchema = z.object({
  oldTicketId: z.string().uuid().optional(),
  oldTicketCode: z.string().min(2),
  newTicketCode: z.string().min(2),
  bookingEmail: z.string().email(),
  replacementDate: dateStr,
  persons: z.number().int().positive(),
  permitCost: z.number().nonnegative(),
  remarks: z.string().max(1000).optional(),
});

router.get(
  '/replacements',
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabase
      .from('replacement_tickets')
      .select('*, old_ticket:old_ticket_id(member_id, trek_name, member:member_id(full_name))')
      .order('created_at', { ascending: false });
    if (error) throw new ApiError(500, error.message);
    ok(res, data ?? []);
  }),
);

router.post(
  '/replacements',
  asyncHandler(async (req, res) => {
    const b = replacementSchema.parse(req.body);

    // If an old ticket was linked, mark it replaced and notify its owner.
    let memberId: string | null = null;
    if (b.oldTicketId) {
      const { data: old } = await supabase.from('tickets').select('member_id').eq('id', b.oldTicketId).maybeSingle();
      memberId = old?.member_id ?? null;
      await supabase.from('tickets').update({ status: 'replacement_completed' }).eq('id', b.oldTicketId);
    }

    const { data, error } = await supabase
      .from('replacement_tickets')
      .insert({
        old_ticket_id: b.oldTicketId ?? null,
        old_ticket_code: b.oldTicketCode,
        new_ticket_code: b.newTicketCode,
        booking_email: b.bookingEmail,
        replacement_date: b.replacementDate,
        persons: b.persons,
        permit_cost: b.permitCost,
        remarks: b.remarks ?? null,
        created_by: req.user!.sub,
      })
      .select('*')
      .single();
    if (error) throw new ApiError(500, error.message);

    await audit({ actorId: req.user!.sub, action: 'replacement.create', entity: 'replacement_ticket', entityId: data.id, ip: req.ip });
    if (memberId) {
      await notify({
        userId: memberId,
        title: 'Ticket replaced 🔁',
        body: `Ticket ${b.oldTicketCode} was replaced with ${b.newTicketCode}.`,
        link: '/tickets',
      });
    }
    ok(res, data, 201);
  }),
);

export default router;
