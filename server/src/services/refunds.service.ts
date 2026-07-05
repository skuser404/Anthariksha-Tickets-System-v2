import { z } from 'zod';
import { ApiError } from '../lib/http.js';
import { supabase } from '../lib/supabase.js';
import { audit, notify } from '../lib/audit.js';
import { inr } from '../lib/format.js';
import { computeRefund } from '../lib/calc.js';
import { postLedger } from '../lib/ledger.js';

export { computeRefund };

const cancelSchema = z.object({
  ticketId: z.string().uuid(),
  cancellationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  remarks: z.string().max(1000).optional(),
});

/** Preview refund without committing — used by the UI as the admin types the date. */
export async function previewRefund(ticketId: string, cancellationDate: string) {
  const { data: ticket } = await supabase
    .from('tickets')
    .select('permit_price, persons, trek_date, status')
    .eq('id', ticketId)
    .maybeSingle();
  if (!ticket) throw new ApiError(404, 'Ticket not found');
  const permitTotal = Number(ticket.permit_price) * ticket.persons;
  return { permitTotal, ...computeRefund(ticket.trek_date, cancellationDate, permitTotal) };
}

export async function cancelTicket(adminId: string, raw: unknown, ip?: string | null) {
  const input = cancelSchema.parse(raw);

  const { data: ticket } = await supabase.from('tickets').select('*').eq('id', input.ticketId).maybeSingle();
  if (!ticket) throw new ApiError(404, 'Ticket not found');
  if (['cancelled', 'refund_pending', 'refund_completed'].includes(ticket.status)) {
    throw new ApiError(409, `Ticket already ${ticket.status}`);
  }

  const permitTotal = Number(ticket.permit_price) * ticket.persons;
  const calc = computeRefund(ticket.trek_date, input.cancellationDate, permitTotal);

  const { data: refund, error } = await supabase
    .from('refunds')
    .insert({
      ticket_id: ticket.id,
      cancellation_date: input.cancellationDate,
      days_before_trek: calc.daysBefore,
      refund_percent: calc.percent,
      refund_amount: calc.amount,
      expected_refund_date: calc.expectedRefundDate,
      status: 'pending',
      remarks: input.remarks ?? null,
      created_by: adminId,
    })
    .select('*')
    .single();
  if (error) throw new ApiError(500, error.message);

  // Ticket becomes refund_pending if money is due, else simply cancelled.
  const newStatus = calc.amount > 0 ? 'refund_pending' : 'cancelled';
  await supabase.from('tickets').update({ status: newStatus }).eq('id', ticket.id);

  if (calc.amount > 0) {
    await postLedger({
      type: 'refund_expected',
      amount: calc.amount,
      ticketId: ticket.id,
      memberId: ticket.member_id,
      refundId: refund.id,
      referenceNumber: ticket.ticket_code,
      createdBy: adminId,
      notes: `${calc.percent}% refund expected by ${calc.expectedRefundDate}`,
    });
  }
  await audit({ actorId: adminId, action: 'ticket.cancel', entity: 'ticket', entityId: ticket.id, metadata: { ...calc }, ip });
  await notify({
    userId: ticket.member_id,
    title: 'Ticket cancelled',
    body:
      calc.amount > 0
        ? `Ticket ${ticket.ticket_code} cancelled. ${calc.percent}% refund (${inr(calc.amount)}) expected by ${calc.expectedRefundDate}.`
        : `Ticket ${ticket.ticket_code} cancelled. No refund applies (cancelled < 4 days before trek).`,
    link: '/refunds',
  });

  return { refund, ticketStatus: newStatus };
}

/** Mark a refund as being processed by the official booking source (manual). */
export async function markRefundProcessing(adminId: string, refundId: string, ip?: string | null) {
  const { data: refund } = await supabase.from('refunds').select('id, status, ticket_id, refund_amount').eq('id', refundId).maybeSingle();
  if (!refund) throw new ApiError(404, 'Refund not found');
  if (refund.status !== 'pending') throw new ApiError(409, `Refund already ${refund.status}`);

  await supabase.from('refunds').update({ status: 'processing' }).eq('id', refundId);
  await audit({ actorId: adminId, action: 'refund.processing', entity: 'refund', entityId: refundId, ip });

  const { data: ticket } = await supabase.from('tickets').select('member_id, ticket_code').eq('id', refund.ticket_id).maybeSingle();
  if (ticket) {
    await notify({
      userId: ticket.member_id,
      title: 'Refund processing',
      body: `Refund of ${inr(refund.refund_amount)} for ticket ${ticket.ticket_code} is being processed.`,
      link: '/refunds',
    });
  }
  return { ok: true };
}

export async function markRefundCompleted(adminId: string, refundId: string, receivedDate: string, ip?: string | null) {
  const { data: refund } = await supabase.from('refunds').select('*').eq('id', refundId).maybeSingle();
  if (!refund) throw new ApiError(404, 'Refund not found');
  if (refund.status === 'completed') throw new ApiError(409, 'Refund already completed');

  await supabase
    .from('refunds')
    .update({ status: 'completed', received_date: receivedDate })
    .eq('id', refundId);
  await supabase.from('tickets').update({ status: 'refund_completed' }).eq('id', refund.ticket_id);

  await postLedger({
    type: 'refund_received',
    amount: Number(refund.refund_amount),
    ticketId: refund.ticket_id,
    refundId: refund.id,
    createdBy: adminId,
    notes: `Refund received on ${receivedDate}`,
  });
  await audit({ actorId: adminId, action: 'refund.complete', entity: 'refund', entityId: refundId, ip });

  const { data: ticket } = await supabase.from('tickets').select('member_id, ticket_code').eq('id', refund.ticket_id).maybeSingle();
  if (ticket) {
    await notify({
      userId: ticket.member_id,
      title: 'Refund completed ✅',
      body: `Refund of ${inr(refund.refund_amount)} for ticket ${ticket.ticket_code} has been received.`,
      link: '/refunds',
    });
  }
  return { ok: true };
}

export async function listRefunds(filters: { status?: string; memberId?: string }) {
  let q = supabase
    .from('refunds')
    .select('*, ticket:ticket_id(ticket_code, trek_name, member_id, persons, permit_price, member:member_id(full_name,email))')
    .order('created_at', { ascending: false });
  if (filters.status) q = q.eq('status', filters.status);

  const { data, error } = await q;
  if (error) throw new ApiError(500, error.message);

  let rows = data ?? [];
  if (filters.memberId) rows = rows.filter((r: any) => r.ticket?.member_id === filters.memberId);

  // "Open" = not yet received (pending or processing).
  const open = rows.filter((r: any) => r.status !== 'completed');
  const processing = rows.filter((r: any) => r.status === 'processing');
  const completed = rows.filter((r: any) => r.status === 'completed');
  return {
    items: rows,
    summary: {
      refundPending: open.length,
      refundProcessing: processing.length,
      refundCompleted: completed.length,
      refundValue: rows.reduce((s: number, r: any) => s + Number(r.refund_amount), 0),
      refundExpected: open.reduce((s: number, r: any) => s + Number(r.refund_amount), 0),
      refundReceived: completed.reduce((s: number, r: any) => s + Number(r.refund_amount), 0),
    },
  };
}
