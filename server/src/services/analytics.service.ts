import { supabase } from '../lib/supabase.js';

interface TicketLite {
  status: string;
  persons: number;
  permit_price: number;
  commission_amount: number;
  trek_name: string;
  trek_date: string;
  created_at: string;
}

const monthKey = (iso: string) => iso.slice(0, 7); // YYYY-MM

/**
 * Org-wide money-flow analytics for the financial dashboard.
 * Revenue model: the operation collects permit cost from members' bookings and
 * pays each member ₹50/person commission; net profit is what remains after
 * commission and refunds.
 */
export async function moneyFlow() {
  const [{ data: tickets }, { data: payments }, { data: refunds }] = await Promise.all([
    supabase.from('tickets').select('status, persons, permit_price, commission_amount, trek_name, trek_date, created_at'),
    supabase.from('payments').select('amount, payment_date'),
    supabase.from('refunds').select('refund_amount, status, created_at'),
  ]);

  const t = (tickets ?? []) as TicketLite[];
  const approved = t.filter((x) => x.status === 'approved');

  const permitOf = (x: TicketLite) => Number(x.permit_price) * x.persons;

  const totalPermitCost = approved.reduce((s, x) => s + permitOf(x), 0);
  const totalCommission = approved.reduce((s, x) => s + Number(x.commission_amount), 0);
  const totalPaidToMembers = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const pendingCommission = totalCommission - totalPaidToMembers;
  const refundAmount = (refunds ?? []).reduce((s, r) => s + Number(r.refund_amount), 0);

  const grossRevenue = totalPermitCost;
  const netProfit = grossRevenue - totalCommission - refundAmount;
  const profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

  const today = new Date().toISOString().slice(0, 10);
  const todaysRevenue = approved.filter((x) => x.created_at.slice(0, 10) === today).reduce((s, x) => s + permitOf(x), 0);

  // Monthly revenue/commission/profit series (last 12 months present in data).
  const monthly = new Map<string, { month: string; revenue: number; commission: number; refund: number }>();
  for (const x of approved) {
    const k = monthKey(x.created_at);
    const row = monthly.get(k) ?? { month: k, revenue: 0, commission: 0, refund: 0 };
    row.revenue += permitOf(x);
    row.commission += Number(x.commission_amount);
    monthly.set(k, row);
  }
  for (const r of refunds ?? []) {
    const k = monthKey(r.created_at);
    const row = monthly.get(k) ?? { month: k, revenue: 0, commission: 0, refund: 0 };
    row.refund += Number(r.refund_amount);
    monthly.set(k, row);
  }
  const monthlySeries = [...monthly.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({ ...m, profit: m.revenue - m.commission - m.refund }))
    .slice(-12);

  // Daily revenue for the last 30 days.
  const dailyMap = new Map<string, number>();
  for (const x of approved) {
    const k = x.created_at.slice(0, 10);
    dailyMap.set(k, (dailyMap.get(k) ?? 0) + permitOf(x));
  }
  const dailySeries = [...dailyMap.entries()]
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);

  // Per-trek breakdown.
  const trekMap = new Map<string, { trek: string; tickets: number; persons: number; revenue: number; commission: number }>();
  for (const x of approved) {
    const row = trekMap.get(x.trek_name) ?? { trek: x.trek_name, tickets: 0, persons: 0, revenue: 0, commission: 0 };
    row.tickets += 1;
    row.persons += x.persons;
    row.revenue += permitOf(x);
    row.commission += Number(x.commission_amount);
    trekMap.set(x.trek_name, row);
  }
  const trekBreakdown = [...trekMap.values()].sort((a, b) => b.revenue - a.revenue);

  return {
    cards: {
      totalPermitCost,
      totalCommission,
      totalPaidToMembers,
      pendingCommission,
      refundAmount,
      netProfit,
      grossRevenue,
      todaysRevenue,
      profitMargin: Math.round(profitMargin * 10) / 10,
    },
    expenseBreakdown: [
      { name: 'Member Commission', value: totalCommission },
      { name: 'Refunds', value: refundAmount },
      { name: 'Net Profit', value: Math.max(0, netProfit) },
    ],
    monthlySeries,
    dailySeries,
    trekBreakdown,
  };
}

/** Operational KPIs: verification/refund speed, approval %, cancellation ratio, trek popularity. */
export async function operationalMetrics() {
  const [{ data: tickets }, { data: refunds }] = await Promise.all([
    supabase.from('tickets').select('status, persons, trek_name, created_at, verified_at'),
    supabase.from('refunds').select('cancellation_date, received_date, status'),
  ]);
  const t = tickets ?? [];

  const decided = t.filter((x) => ['approved', 'not_confirmed'].includes(x.status));
  const approved = decided.filter((x) => x.status === 'approved');
  const approvalPct = decided.length ? Math.round((approved.length / decided.length) * 100) : 0;

  const cancelled = t.filter((x) => ['cancelled', 'refund_pending', 'refund_completed'].includes(x.status));
  const cancellationRatio = t.length ? Math.round((cancelled.length / t.length) * 100) : 0;

  // Average verification time (hours) between submission and decision.
  const verifTimes = decided
    .filter((x) => x.verified_at)
    .map((x) => (new Date(x.verified_at!).getTime() - new Date(x.created_at).getTime()) / 3_600_000);
  const avgVerificationHours = verifTimes.length ? Math.round((verifTimes.reduce((s, n) => s + n, 0) / verifTimes.length) * 10) / 10 : 0;

  // Average refund time (days) between cancellation and receipt.
  const refundTimes = (refunds ?? [])
    .filter((r) => r.status === 'completed' && r.received_date)
    .map((r) => (new Date(r.received_date!).getTime() - new Date(r.cancellation_date).getTime()) / 86_400_000);
  const avgRefundDays = refundTimes.length ? Math.round((refundTimes.reduce((s, n) => s + n, 0) / refundTimes.length) * 10) / 10 : 0;

  // Trek popularity by persons (approved).
  const popMap = new Map<string, number>();
  for (const x of approved) popMap.set(x.trek_name, (popMap.get(x.trek_name) ?? 0) + x.persons);
  const trekPopularity = [...popMap.entries()].map(([trek, persons]) => ({ trek, persons })).sort((a, b) => b.persons - a.persons);

  return { approvalPct, cancellationRatio, avgVerificationHours, avgRefundDays, totalTickets: t.length, trekPopularity };
}

/** Flexible analytics with filters for the Analytics page. */
export async function analytics(filters: { from?: string; to?: string; trek?: string; status?: string; memberId?: string }) {
  let q = supabase.from('tickets').select('status, persons, permit_price, commission_amount, trek_name, trek_date');
  if (filters.from) q = q.gte('trek_date', filters.from);
  if (filters.to) q = q.lte('trek_date', filters.to);
  if (filters.trek) q = q.eq('trek_name', filters.trek);
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.memberId) q = q.eq('member_id', filters.memberId);

  const { data } = await q;
  const rows = (data ?? []) as TicketLite[];
  const permitOf = (x: TicketLite) => Number(x.permit_price) * x.persons;

  return {
    tickets: rows.length,
    persons: rows.reduce((s, x) => s + x.persons, 0),
    permitCost: rows.reduce((s, x) => s + permitOf(x), 0),
    commission: rows.reduce((s, x) => s + Number(x.commission_amount), 0),
    netProfit: rows.reduce((s, x) => s + (permitOf(x) - Number(x.commission_amount)), 0),
  };
}
