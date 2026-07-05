import { supabase } from '../lib/supabase.js';
import { inr } from '../lib/format.js';

export interface Insight {
  tone: 'info' | 'success' | 'warning' | 'danger';
  icon: string; // lucide icon name resolved on the client
  text: string;
}

const dayKey = (iso: string) => iso.slice(0, 10);
const within = (iso: string, days: number) => Date.now() - new Date(iso).getTime() <= days * 86_400_000;

/**
 * Rule-based "smart" insights for the admin dashboard. No LLM required — these
 * are deterministic observations derived from current data.
 */
export async function adminInsights(): Promise<Insight[]> {
  const [{ data: tickets }, { data: refunds }] = await Promise.all([
    supabase.from('tickets').select('status, persons, permit_price, commission_amount, trek_name, created_at'),
    supabase.from('refunds').select('refund_amount, status, expected_refund_date, created_at'),
  ]);

  const t = tickets ?? [];
  const r = refunds ?? [];
  const out: Insight[] = [];
  const today = dayKey(new Date().toISOString());

  // Pending approvals.
  const pending = t.filter((x) => x.status === 'pending_verification').length;
  if (pending > 0) {
    out.push({ tone: 'info', icon: 'Clock', text: `${pending} ticket${pending > 1 ? 's are' : ' is'} waiting for approval.` });
  }

  // Overdue refunds (not yet received, past expected date).
  const overdue = r.filter((x) => x.status !== 'completed' && x.expected_refund_date < today).length;
  if (overdue > 0) {
    out.push({ tone: 'danger', icon: 'AlertTriangle', text: `${overdue} refund${overdue > 1 ? 's are' : ' is'} overdue.` });
  }

  // Top revenue trek (approved).
  const trekRev = new Map<string, number>();
  for (const x of t.filter((x) => x.status === 'approved')) {
    trekRev.set(x.trek_name, (trekRev.get(x.trek_name) ?? 0) + Number(x.permit_price) * x.persons);
  }
  const top = [...trekRev.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top) {
    out.push({ tone: 'success', icon: 'TrendingUp', text: `${top[0]} generated the highest revenue (${inr(top[1])}).` });
  }

  // Refund trend: this week vs previous week (by count).
  const thisWeek = r.filter((x) => within(x.created_at, 7)).length;
  const prevWeek = r.filter((x) => !within(x.created_at, 7) && within(x.created_at, 14)).length;
  if (prevWeek > 0) {
    const change = Math.round(((thisWeek - prevWeek) / prevWeek) * 100);
    if (Math.abs(change) >= 10) {
      out.push({
        tone: change > 0 ? 'warning' : 'success',
        icon: change > 0 ? 'TrendingUp' : 'TrendingDown',
        text: `Refunds ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(change)}% this week.`,
      });
    }
  } else if (thisWeek > 0) {
    out.push({ tone: 'warning', icon: 'RotateCcw', text: `${thisWeek} refund${thisWeek > 1 ? 's were' : ' was'} created this week.` });
  }

  // Today's submissions.
  const todays = t.filter((x) => dayKey(x.created_at) === today).length;
  if (todays > 0) {
    out.push({ tone: 'info', icon: 'Ticket', text: `${todays} ticket${todays > 1 ? 's were' : ' was'} submitted today.` });
  }

  if (out.length === 0) {
    out.push({ tone: 'success', icon: 'CheckCircle2', text: 'All clear — no pending approvals or overdue refunds.' });
  }
  return out.slice(0, 5);
}

export async function memberInsights(memberId: string): Promise<Insight[]> {
  const { data } = await supabase
    .from('tickets')
    .select('status, commission_amount, created_at')
    .eq('member_id', memberId);
  const t = data ?? [];
  const out: Insight[] = [];

  const pending = t.filter((x) => x.status === 'pending_verification').length;
  if (pending > 0) out.push({ tone: 'info', icon: 'Clock', text: `${pending} of your tickets ${pending > 1 ? 'are' : 'is'} awaiting verification.` });

  const monthKey = new Date().toISOString().slice(0, 7);
  const monthEarn = t.filter((x) => x.status === 'approved' && x.created_at.slice(0, 7) === monthKey).reduce((s, x) => s + Number(x.commission_amount), 0);
  if (monthEarn > 0) out.push({ tone: 'success', icon: 'TrendingUp', text: `You've earned ${inr(monthEarn)} in commission this month.` });

  const approved = t.filter((x) => ['approved', 'not_confirmed'].includes(x.status));
  if (approved.length >= 3) {
    const rate = Math.round((approved.filter((x) => x.status === 'approved').length / approved.length) * 100);
    out.push({ tone: rate >= 80 ? 'success' : 'warning', icon: 'Target', text: `Your approval rate is ${rate}%.` });
  }

  if (out.length === 0) out.push({ tone: 'info', icon: 'PlusCircle', text: 'Submit your first ticket to start earning commission.' });
  return out.slice(0, 4);
}
