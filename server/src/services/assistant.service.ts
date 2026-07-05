import { supabase } from '../lib/supabase.js';
import { inr } from '../lib/format.js';

export interface AssistantAnswer {
  answer: string;
  data?: unknown;
  matched: string;
}

const monthKey = (iso: string) => iso.slice(0, 7);
const todayKey = () => new Date().toISOString().slice(0, 10);

/**
 * Intent-based natural-language assistant for admins. Matches the question
 * against a set of operational intents and answers from live data — no external
 * LLM required, so it's deterministic, private and free to run.
 */
export async function ask(question: string): Promise<AssistantAnswer> {
  const q = question.toLowerCase();
  const has = (...words: string[]) => words.every((w) => q.includes(w));
  const any = (...words: string[]) => words.some((w) => q.includes(w));

  // --- Today's ticket summary ---
  if (has('today') && any('summary', 'ticket', 'activity')) {
    const { data } = await supabase.from('tickets').select('status, persons, permit_price, commission_amount, created_at');
    const today = (data ?? []).filter((t) => t.created_at.slice(0, 10) === todayKey());
    const persons = today.reduce((s, t) => s + t.persons, 0);
    const permit = today.reduce((s, t) => s + Number(t.permit_price) * t.persons, 0);
    const pending = today.filter((t) => t.status === 'pending_verification').length;
    return {
      matched: 'today_summary',
      answer: `Today: ${today.length} ticket(s), ${persons} person(s), ${inr(permit)} permit value. ${pending} awaiting verification.`,
      data: { tickets: today.length, persons, permit, pending },
    };
  }

  // --- Highest commission this month / top earner ---
  if (any('highest', 'top', 'most') && any('commission', 'earn', 'earner')) {
    const { data } = await supabase.from('member_financials').select('full_name, total_earned').order('total_earned', { ascending: false }).limit(1);
    const top = data?.[0];
    return {
      matched: 'top_earner',
      answer: top ? `${top.full_name} earned the most commission (${inr(top.total_earned)}).` : 'No commission recorded yet.',
      data: top,
    };
  }

  // --- Refunds pending > 30 days ---
  if (any('refund') && (any('30', 'thirty', 'overdue', 'delay', 'late'))) {
    const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const { data } = await supabase
      .from('refunds')
      .select('refund_amount, cancellation_date, expected_refund_date, ticket:ticket_id(ticket_code)')
      .neq('status', 'completed')
      .lte('cancellation_date', cutoff);
    const total = (data ?? []).reduce((s, r) => s + Number(r.refund_amount), 0);
    return {
      matched: 'overdue_refunds',
      answer: (data ?? []).length
        ? `${data!.length} refund(s) have been pending for 30+ days, totalling ${inr(total)}.`
        : 'No refunds have been pending for more than 30 days. 🎉',
      data,
    };
  }

  // --- Highest revenue / permit cost trek (optionally this week) ---
  if (any('trek') && any('highest', 'most', 'top') && any('revenue', 'permit', 'cost', 'booked')) {
    const thisWeek = any('week', 'this week');
    const { data } = await supabase.from('tickets').select('trek_name, persons, permit_price, status, created_at').eq('status', 'approved');
    const cutoff = Date.now() - 7 * 86_400_000;
    const rows = (data ?? []).filter((t) => (thisWeek ? new Date(t.created_at).getTime() >= cutoff : true));
    const map = new Map<string, number>();
    for (const t of rows) map.set(t.trek_name, (map.get(t.trek_name) ?? 0) + Number(t.permit_price) * t.persons);
    const top = [...map.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      matched: 'top_trek',
      answer: top ? `${top[0]} generated the highest permit cost${thisWeek ? ' this week' : ''} (${inr(top[1])}).` : 'No approved tickets in range.',
      data: top ? { trek: top[0], permitCost: top[1] } : null,
    };
  }

  // --- Pending approvals ---
  if (any('pending', 'waiting', 'approval', 'verify', 'verification')) {
    const { count } = await supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'pending_verification');
    return { matched: 'pending', answer: `${count ?? 0} ticket(s) are waiting for verification.`, data: { pending: count ?? 0 } };
  }

  // --- Outstanding balances ---
  if (any('balance', 'outstanding', 'owe', 'unpaid', 'due')) {
    const { data } = await supabase.from('member_financials').select('full_name, balance').gt('balance', 0).order('balance', { ascending: false });
    const total = (data ?? []).reduce((s, m) => s + Number(m.balance), 0);
    return {
      matched: 'balances',
      answer: (data ?? []).length ? `${data!.length} member(s) have outstanding balances totalling ${inr(total)}.` : 'No outstanding balances.',
      data,
    };
  }

  // --- Highest submissions ---
  if (any('most', 'highest', 'top') && any('submission', 'submit', 'tickets')) {
    const { data } = await supabase.from('tickets').select('member_id, member:member_id(full_name)');
    const map = new Map<string, { name: string; count: number }>();
    for (const t of data ?? []) {
      const name = (t as any).member?.full_name ?? 'Unknown';
      const row = map.get(t.member_id) ?? { name, count: 0 };
      row.count += 1;
      map.set(t.member_id, row);
    }
    const top = [...map.values()].sort((a, b) => b.count - a.count)[0];
    return { matched: 'top_submitter', answer: top ? `${top.name} has submitted the most tickets (${top.count}).` : 'No tickets yet.', data: top };
  }

  // --- Duplicate / flagged tickets ---
  if (any('duplicate', 'flag', 'suspicious')) {
    const { data } = await supabase.from('tickets').select('ticket_code, flags').eq('status', 'pending_verification');
    const flagged = (data ?? []).filter((t) => Array.isArray(t.flags) && t.flags.length > 0);
    return {
      matched: 'flagged',
      answer: flagged.length ? `${flagged.length} pending ticket(s) have verification flags to review.` : 'No flagged pending tickets.',
      data: flagged.map((t) => t.ticket_code),
    };
  }

  return {
    matched: 'unknown',
    answer:
      "I can help with: today's summary, top earner, overdue refunds, top trek by revenue, pending approvals, outstanding balances, top submitter, and flagged tickets. Try rephrasing your question around one of those.",
  };
}

export const SUGGESTIONS = [
  "Show today's ticket summary.",
  'Who earned the highest commission this month?',
  'List refunds pending for more than 30 days.',
  'Which trek generated the highest permit cost this week?',
  'Who has outstanding balances?',
  'Are there any flagged tickets?',
];
