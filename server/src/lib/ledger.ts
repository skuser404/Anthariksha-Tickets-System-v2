import { supabase } from './supabase.js';

export type LedgerType =
  | 'commission_earned'
  | 'commission_paid'
  | 'refund_expected'
  | 'refund_received'
  | 'permit_cost'
  | 'manual_adjustment';

type Flow = 'in' | 'out' | 'liability';

const FLOW: Record<LedgerType, Flow> = {
  permit_cost: 'in',
  commission_earned: 'liability',
  commission_paid: 'out',
  refund_expected: 'liability',
  refund_received: 'out',
  manual_adjustment: 'out',
};

export interface LedgerInput {
  type: LedgerType;
  amount: number;
  memberId?: string | null;
  ticketId?: string | null;
  paymentId?: string | null;
  refundId?: string | null;
  referenceNumber?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  flow?: Flow;
}

/** Append an immutable ledger entry. Never updates or deletes existing rows. */
export async function postLedger(entry: LedgerInput): Promise<void> {
  await supabase.from('ledger_entries').insert({
    type: entry.type,
    flow: entry.flow ?? FLOW[entry.type],
    amount: entry.amount,
    member_id: entry.memberId ?? null,
    ticket_id: entry.ticketId ?? null,
    payment_id: entry.paymentId ?? null,
    refund_id: entry.refundId ?? null,
    reference_number: entry.referenceNumber ?? null,
    notes: entry.notes ?? null,
    created_by: entry.createdBy ?? null,
  });
}
