import { z } from 'zod';
import { ApiError } from '../lib/http.js';
import { supabase } from '../lib/supabase.js';
import { audit, notify } from '../lib/audit.js';
import { postLedger } from '../lib/ledger.js';
import { computeTicketFlags } from '../lib/verification.js';

const COMMISSION_PER_PERSON = 50;

export const createTicketSchema = z.object({
  ticketCode: z.string().min(2).max(64),
  trekId: z.string().uuid().optional(),
  trekName: z.string().min(2),
  bookingEmail: z.string().email(),
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  trekDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  persons: z.number().int().positive().max(100),
  permitPrice: z.number().nonnegative().optional(), // resolved from trek if omitted
  remarks: z.string().max(1000).optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

async function resolvePermitPrice(input: CreateTicketInput): Promise<{ price: number; trekId: string | null }> {
  if (input.trekId) {
    const { data } = await supabase.from('trek_pricing').select('id, permit_price').eq('id', input.trekId).maybeSingle();
    if (data) return { price: Number(data.permit_price), trekId: data.id };
  }
  const { data } = await supabase
    .from('trek_pricing')
    .select('id, permit_price')
    .eq('name', input.trekName)
    .maybeSingle();
  if (data) return { price: Number(data.permit_price), trekId: data.id };
  if (input.permitPrice !== undefined) return { price: input.permitPrice, trekId: null };
  throw new ApiError(422, `Unknown trek "${input.trekName}" and no permit price supplied`);
}

/**
 * Create a ticket. `memberId` is who the ticket belongs to. When an admin submits
 * on a member's behalf, pass `actorId` (the admin) — the member is then notified
 * that a ticket was added to their account, instead of admins being notified.
 */
export async function createTicket(memberId: string, raw: unknown, ip?: string | null, actorId?: string) {
  const input = createTicketSchema.parse(raw);
  const onBehalf = !!actorId && actorId !== memberId;

  // Duplicate ticket-code guard (DB also enforces a unique constraint).
  const { data: dup } = await supabase
    .from('tickets')
    .select('id')
    .eq('ticket_code', input.ticketCode)
    .maybeSingle();
  if (dup) throw new ApiError(409, `Ticket "${input.ticketCode}" has already been submitted`);

  const { price, trekId } = await resolvePermitPrice(input);

  // Smart-verification flags + auto tags.
  const flags = await computeTicketFlags({
    memberId,
    bookingEmail: input.bookingEmail,
    trekName: input.trekName,
    trekDate: input.trekDate,
    persons: input.persons,
    permitPrice: price,
    commissionPerPerson: COMMISSION_PER_PERSON,
  });
  const tags = ['pending', ...(flags.some((f) => f.severity === 'danger') ? ['duplicate'] : [])];

  const { data, error } = await supabase
    .from('tickets')
    .insert({
      ticket_code: input.ticketCode,
      member_id: memberId,
      trek_id: trekId,
      trek_name: input.trekName,
      booking_email: input.bookingEmail,
      booking_date: input.bookingDate,
      trek_date: input.trekDate,
      persons: input.persons,
      permit_price: price,
      commission_per_person: COMMISSION_PER_PERSON,
      status: 'pending_verification',
      remarks: input.remarks ?? null,
      flags,
      tags,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') throw new ApiError(409, 'Duplicate ticket code');
    throw new ApiError(500, error.message);
  }

  await audit({ actorId: actorId ?? memberId, action: onBehalf ? 'ticket.create_for_member' : 'ticket.create', entity: 'ticket', entityId: data.id, metadata: onBehalf ? { memberId } : undefined, ip });

  if (onBehalf) {
    // Admin added it to a member's account — let that member know.
    await notify({
      userId: memberId,
      title: 'A ticket was added to your account',
      body: `Ticket ${input.ticketCode} (${input.persons} pax, ${input.trekName}) was submitted for you and is pending verification.`,
      link: '/tickets',
    });
  } else {
    // Member submitted — notify all admins.
    const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin');
    await Promise.all(
      (admins ?? []).map((a) =>
        notify({
          userId: a.id,
          title: 'New ticket submitted',
          body: `Ticket ${input.ticketCode} (${input.persons} pax, ${input.trekName}) awaits verification.`,
          link: '/admin/tickets',
        }),
      ),
    );
  }

  return data;
}

/** Upcoming booked dates for a trek (pax + ticket counts) — used to show availability. */
export async function trekAvailability(trekName: string) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('tickets')
    .select('trek_date, persons, status')
    .eq('trek_name', trekName)
    .gte('trek_date', today)
    .in('status', ['pending_verification', 'approved', 'replacement_completed']);
  if (error) throw new ApiError(500, error.message);

  const map = new Map<string, { date: string; persons: number; count: number }>();
  for (const t of data ?? []) {
    const row = map.get(t.trek_date) ?? { date: t.trek_date, persons: 0, count: 0 };
    row.persons += t.persons;
    row.count += 1;
    map.set(t.trek_date, row);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export interface ListFilters {
  memberId?: string;
  status?: string;
  trek?: string;
  search?: string;
  tag?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

/** Verification priority: duplicate-flagged first, then oldest pending. */
export function ticketPriority(t: { flags?: { severity: string }[]; created_at: string }): number {
  const hasDanger = (t.flags ?? []).some((f) => f.severity === 'danger');
  return hasDanger ? 0 : 1;
}

export async function listTickets(filters: ListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const fromIdx = (page - 1) * pageSize;

  let q = supabase
    .from('tickets')
    .select('*, member:member_id(full_name,email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(fromIdx, fromIdx + pageSize - 1);

  if (filters.memberId) q = q.eq('member_id', filters.memberId);
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.trek) q = q.eq('trek_name', filters.trek);
  if (filters.tag) q = q.contains('tags', [filters.tag]);
  if (filters.from) q = q.gte('trek_date', filters.from);
  if (filters.to) q = q.lte('trek_date', filters.to);
  if (filters.search) {
    q = q.or(
      `ticket_code.ilike.%${filters.search}%,booking_email.ilike.%${filters.search}%,trek_name.ilike.%${filters.search}%`,
    );
  }

  const { data, count, error } = await q;
  if (error) throw new ApiError(500, error.message);
  return { items: data ?? [], total: count ?? 0, page, pageSize };
}

export async function verifyTicket(
  adminId: string,
  ticketId: string,
  decision: 'approved' | 'not_confirmed',
  remarks: string | undefined,
  ip?: string | null,
) {
  const { data: ticket } = await supabase.from('tickets').select('*').eq('id', ticketId).maybeSingle();
  if (!ticket) throw new ApiError(404, 'Ticket not found');
  if (ticket.status !== 'pending_verification') {
    throw new ApiError(409, `Ticket already ${ticket.status}`);
  }

  const { data, error } = await supabase
    .from('tickets')
    .update({
      status: decision,
      verified_by: adminId,
      verified_at: new Date().toISOString(),
      remarks: remarks ?? ticket.remarks,
    })
    .eq('id', ticketId)
    .select('*')
    .single();
  if (error) throw new ApiError(500, error.message);

  // On approval, post immutable ledger entries: permit cost (in) + commission accrual (liability).
  if (decision === 'approved') {
    await postLedger({
      type: 'permit_cost',
      amount: Number(ticket.permit_price) * ticket.persons,
      ticketId: ticket.id,
      memberId: ticket.member_id,
      referenceNumber: ticket.ticket_code,
      createdBy: adminId,
      notes: `Permit cost for ${ticket.trek_name} (${ticket.persons} pax)`,
    });
    await postLedger({
      type: 'commission_earned',
      amount: Number(ticket.commission_amount),
      ticketId: ticket.id,
      memberId: ticket.member_id,
      referenceNumber: ticket.ticket_code,
      createdBy: adminId,
      notes: `Commission accrued on approval`,
    });
  }

  await audit({ actorId: adminId, action: `ticket.${decision}`, entity: 'ticket', entityId: ticketId, ip });
  await notify({
    userId: ticket.member_id,
    title: decision === 'approved' ? 'Ticket approved ✅' : 'Ticket not confirmed',
    body:
      decision === 'approved'
        ? `Ticket ${ticket.ticket_code} approved. ₹${Number(ticket.commission_amount).toFixed(0)} commission added.`
        : `Ticket ${ticket.ticket_code} could not be confirmed.${remarks ? ' ' + remarks : ''}`,
    link: '/tickets',
  });

  return data;
}

/** Bulk approve/reject — verifies each pending ticket; skips non-pending ones. */
export async function bulkVerify(
  adminId: string,
  ids: string[],
  decision: 'approved' | 'not_confirmed',
  remarks: string | undefined,
  ip?: string | null,
) {
  const results = { succeeded: 0, skipped: 0, ids: [] as string[] };
  for (const id of ids) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await verifyTicket(adminId, id, decision, remarks, ip);
      results.succeeded += 1;
      results.ids.push(id);
    } catch {
      results.skipped += 1;
    }
  }
  await audit({ actorId: adminId, action: `ticket.bulk_${decision}`, entity: 'ticket', metadata: { count: results.succeeded }, ip });
  return results;
}

/** Add the given tags to many tickets at once (union, no duplicates). */
export async function bulkAssignTags(adminId: string, ids: string[], tags: string[], ip?: string | null) {
  const clean = tags.map((t) => t.toLowerCase().trim()).filter(Boolean);
  let updated = 0;
  for (const id of ids) {
    // eslint-disable-next-line no-await-in-loop
    const { data: row } = await supabase.from('tickets').select('tags').eq('id', id).maybeSingle();
    if (!row) continue;
    const merged = [...new Set([...(row.tags ?? []), ...clean])].slice(0, 12);
    // eslint-disable-next-line no-await-in-loop
    await supabase.from('tickets').update({ tags: merged }).eq('id', id);
    updated += 1;
  }
  await audit({ actorId: adminId, action: 'ticket.bulk_tags', entity: 'ticket', metadata: { count: updated, tags: clean }, ip });
  return { updated };
}

export async function setTicketTags(adminId: string, ticketId: string, tags: string[], ip?: string | null) {
  const clean = [...new Set(tags.map((t) => t.toLowerCase().trim()).filter(Boolean))].slice(0, 12);
  const { data, error } = await supabase.from('tickets').update({ tags: clean }).eq('id', ticketId).select('id, tags').single();
  if (error) throw new ApiError(500, error.message);
  await audit({ actorId: adminId, action: 'ticket.tags', entity: 'ticket', entityId: ticketId, metadata: { tags: clean }, ip });
  return data;
}

export async function addTicketNote(adminId: string, ticketId: string, body: string) {
  const { data, error } = await supabase
    .from('ticket_notes')
    .insert({ ticket_id: ticketId, author_id: adminId, body })
    .select('*, author:author_id(full_name)')
    .single();
  if (error) throw new ApiError(500, error.message);
  return data;
}

export async function listTicketNotes(ticketId: string) {
  const { data, error } = await supabase
    .from('ticket_notes')
    .select('*, author:author_id(full_name)')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: false });
  if (error) throw new ApiError(500, error.message);
  return data ?? [];
}

/** Reconstruct a ticket's lifecycle timeline from its row + audit log. */
export async function ticketTimeline(ticketId: string) {
  const { data: ticket } = await supabase.from('tickets').select('*').eq('id', ticketId).maybeSingle();
  if (!ticket) throw new ApiError(404, 'Ticket not found');

  const { data: logs } = await supabase
    .from('audit_logs')
    .select('action, created_at, actor:actor_id(full_name)')
    .eq('entity', 'ticket')
    .eq('entity_id', ticketId)
    .order('created_at', { ascending: true });

  const { data: refund } = await supabase
    .from('refunds')
    .select('cancellation_date, status, refund_amount, received_date, created_at')
    .eq('ticket_id', ticketId)
    .maybeSingle();

  const steps: { label: string; at: string | null; done: boolean }[] = [
    { label: 'Submitted', at: ticket.created_at, done: true },
    { label: 'Pending Verification', at: ticket.created_at, done: true },
  ];

  if (ticket.status === 'approved' || ticket.verified_at) {
    steps.push({ label: 'Approved', at: ticket.verified_at, done: ticket.status === 'approved' });
    steps.push({ label: 'Commission Added', at: ticket.verified_at, done: ticket.status === 'approved' });
  }
  if (ticket.status === 'not_confirmed') {
    steps.push({ label: 'Not Confirmed', at: ticket.verified_at, done: true });
  }
  if (refund) {
    steps.push({ label: 'Cancelled', at: refund.cancellation_date, done: true });
    steps.push({ label: 'Refund Pending', at: refund.created_at, done: true });
    steps.push({ label: 'Refund Completed', at: refund.received_date, done: refund.status === 'completed' });
  }

  return { ticket, steps, logs: logs ?? [] };
}
