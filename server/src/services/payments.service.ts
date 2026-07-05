import { z } from 'zod';
import { ApiError } from '../lib/http.js';
import { supabase } from '../lib/supabase.js';
import { audit, notify } from '../lib/audit.js';
import { inr } from '../lib/format.js';
import { postLedger } from '../lib/ledger.js';

export const createPaymentSchema = z.object({
  memberId: z.string().uuid(),
  amount: z.number().positive(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  method: z.enum(['upi', 'bank_transfer', 'cash', 'cheque', 'other']).default('upi'),
  referenceNumber: z.string().max(120).optional(),
  remarks: z.string().max(1000).optional(),
});

export async function recordPayment(adminId: string, raw: unknown, ip?: string | null) {
  const input = createPaymentSchema.parse(raw);

  const { data: member } = await supabase
    .from('users')
    .select('id, full_name, role')
    .eq('id', input.memberId)
    .maybeSingle();
  if (!member || member.role !== 'member') throw new ApiError(404, 'Member not found');

  const { data, error } = await supabase
    .from('payments')
    .insert({
      member_id: input.memberId,
      amount: input.amount,
      payment_date: input.paymentDate ?? new Date().toISOString().slice(0, 10),
      method: input.method,
      reference_number: input.referenceNumber ?? null,
      remarks: input.remarks ?? null,
      created_by: adminId,
    })
    .select('*')
    .single();
  if (error) throw new ApiError(500, error.message);

  await postLedger({
    type: 'commission_paid',
    amount: input.amount,
    memberId: input.memberId,
    paymentId: data.id,
    referenceNumber: data.receipt_no,
    notes: input.remarks ?? `Payout via ${input.method}`,
    createdBy: adminId,
  });
  await audit({ actorId: adminId, action: 'payment.create', entity: 'payment', entityId: data.id, metadata: { amount: input.amount }, ip });
  await notify({
    userId: input.memberId,
    title: 'Payment received 💸',
    body: `${inr(input.amount)} paid via ${input.method.replace('_', ' ')}. Receipt ${data.receipt_no}.`,
    link: '/payments',
  });

  return data;
}

export async function listPayments(filters: { memberId?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const fromIdx = (page - 1) * pageSize;

  let q = supabase
    .from('payments')
    .select('*, member:member_id(full_name,email)', { count: 'exact' })
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(fromIdx, fromIdx + pageSize - 1);
  if (filters.memberId) q = q.eq('member_id', filters.memberId);

  const { data, count, error } = await q;
  if (error) throw new ApiError(500, error.message);
  return { items: data ?? [], total: count ?? 0, page, pageSize };
}

/** Per-member financial summary (earned / paid / balance) for the whole org. */
export async function memberFinancials() {
  const { data, error } = await supabase
    .from('member_financials')
    .select('*')
    .order('balance', { ascending: false });
  if (error) throw new ApiError(500, error.message);
  return data ?? [];
}

export async function memberLedger(memberId: string) {
  const [{ data: fin }, { data: payments }] = await Promise.all([
    supabase.from('member_financials').select('*').eq('member_id', memberId).maybeSingle(),
    supabase
      .from('payments')
      .select('*')
      .eq('member_id', memberId)
      .order('payment_date', { ascending: false }),
  ]);
  return {
    totalEarned: Number(fin?.total_earned ?? 0),
    totalPaid: Number(fin?.total_paid ?? 0),
    balance: Number(fin?.balance ?? 0),
    payments: payments ?? [],
  };
}
