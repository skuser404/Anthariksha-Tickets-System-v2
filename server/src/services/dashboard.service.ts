import { supabase } from '../lib/supabase.js';

interface TicketLite {
  status: string;
  persons: number;
  permit_price: number;
  commission_amount: number;
  trek_name: string;
  trek_date: string;
  created_at: string;
  member_id: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const monthKey = (iso: string) => iso.slice(0, 7);
const permitOf = (t: TicketLite) => Number(t.permit_price) * t.persons;

/** Rich admin dashboard: today's KPIs, pending queues, member counts + charts. */
export async function adminDashboard() {
  const [{ data: ticketRows }, { data: refunds }, { data: members }, { data: financials }] = await Promise.all([
    supabase.from('tickets').select('status, persons, permit_price, commission_amount, trek_name, trek_date, created_at, member_id'),
    supabase.from('refunds').select('refund_amount, status, created_at'),
    supabase.from('users').select('id, is_active').eq('role', 'member'),
    supabase.from('member_financials').select('balance'),
  ]);
  const pendingPayments = (financials ?? []).filter((f) => Number(f.balance) > 0).length;

  const tickets = (ticketRows ?? []) as TicketLite[];
  const td = today();
  const approved = tickets.filter((t) => t.status === 'approved');
  const todays = tickets.filter((t) => t.created_at.slice(0, 10) === td);
  const todaysApproved = todays.filter((t) => t.status === 'approved');

  const todaysPermitCost = todaysApproved.reduce((s, t) => s + permitOf(t), 0);
  const todaysCommission = todaysApproved.reduce((s, t) => s + Number(t.commission_amount), 0);
  const todaysRefund = (refunds ?? []).filter((r) => r.created_at.slice(0, 10) === td).reduce((s, r) => s + Number(r.refund_amount), 0);

  const activeMembers = (members ?? []).filter((m) => m.is_active).length;

  // Charts -------------------------------------------------------------
  // Daily ticket trend (last 30 days, by submission date).
  const dailyMap = new Map<string, { date: string; tickets: number; persons: number }>();
  for (const t of tickets) {
    const k = t.created_at.slice(0, 10);
    const row = dailyMap.get(k) ?? { date: k, tickets: 0, persons: 0 };
    row.tickets += 1;
    row.persons += t.persons;
    dailyMap.set(k, row);
  }
  const dailyTrend = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);

  // Monthly revenue & commission (approved).
  const monthlyMap = new Map<string, { month: string; revenue: number; commission: number }>();
  for (const t of approved) {
    const k = monthKey(t.created_at);
    const row = monthlyMap.get(k) ?? { month: k, revenue: 0, commission: 0 };
    row.revenue += permitOf(t);
    row.commission += Number(t.commission_amount);
    monthlyMap.set(k, row);
  }
  const monthly = [...monthlyMap.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-12);

  // Most booked trek (by persons).
  const trekMap = new Map<string, number>();
  for (const t of approved) trekMap.set(t.trek_name, (trekMap.get(t.trek_name) ?? 0) + t.persons);
  const mostBookedTrek = [...trekMap.entries()].map(([trek, persons]) => ({ trek, persons })).sort((a, b) => b.persons - a.persons).slice(0, 8);

  return {
    cards: {
      todaysTickets: todays.length,
      todaysPersons: todays.reduce((s, t) => s + t.persons, 0),
      todaysPermitCost,
      todaysCommission,
      todaysRefundAmount: todaysRefund,
      todaysRevenue: todaysPermitCost,
      todaysExpenses: todaysCommission + todaysRefund,
      netProfit: approved.reduce((s, t) => s + permitOf(t), 0) - approved.reduce((s, t) => s + Number(t.commission_amount), 0) - (refunds ?? []).reduce((s, r) => s + Number(r.refund_amount), 0),
      monthlyRevenue: monthly.at(-1)?.revenue ?? 0,
      pendingVerifications: tickets.filter((t) => t.status === 'pending_verification').length,
      pendingRefunds: (refunds ?? []).filter((r) => r.status === 'pending').length,
      pendingPayments,
      totalMembers: members?.length ?? 0,
      activeMembers,
      totalTickets: tickets.length,
      cancelledTickets: tickets.filter((t) => t.status === 'cancelled' || t.status === 'refund_pending' || t.status === 'refund_completed').length,
      replacementTickets: tickets.filter((t) => t.status === 'replacement_completed').length,
    },
    charts: { dailyTrend, monthly, mostBookedTrek },
  };
}

/** Enriched member dashboard with avg/day + monthly earnings, used alongside the cards. */
export async function memberExtras(memberId: string) {
  const { data: rows } = await supabase
    .from('tickets')
    .select('status, persons, commission_amount, trek_date, created_at')
    .eq('member_id', memberId);
  const tickets = (rows ?? []) as TicketLite[];

  const workingDays = new Set(tickets.map((t) => t.trek_date)).size;
  const avgTicketsPerDay = workingDays ? Math.round((tickets.length / workingDays) * 10) / 10 : 0;

  const thisMonth = monthKey(today());
  const monthlyEarnings = tickets
    .filter((t) => t.status === 'approved' && monthKey(t.created_at) === thisMonth)
    .reduce((s, t) => s + Number(t.commission_amount), 0);

  return { avgTicketsPerDay, monthlyEarnings };
}
