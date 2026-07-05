import { supabase } from '../lib/supabase.js';
import { ApiError } from '../lib/http.js';

export type ReportType =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'member'
  | 'trek'
  | 'refund'
  | 'payment'
  | 'commission';

export interface ReportColumn {
  key: string;
  label: string;
  type?: 'currency' | 'number' | 'date' | 'text';
}

export interface Report {
  type: ReportType;
  title: string;
  generatedAt: string;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  summary: Record<string, number>;
}

interface Filters {
  from?: string;
  to?: string;
  memberId?: string;
  trek?: string;
}

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

const permitOf = (t: TicketLite) => Number(t.permit_price) * t.persons;
const isoWeek = (d: Date) => {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

async function loadTickets(filters: Filters): Promise<TicketLite[]> {
  let q = supabase
    .from('tickets')
    .select('status, persons, permit_price, commission_amount, trek_name, trek_date, created_at, member_id');
  if (filters.from) q = q.gte('trek_date', filters.from);
  if (filters.to) q = q.lte('trek_date', filters.to);
  if (filters.trek) q = q.eq('trek_name', filters.trek);
  if (filters.memberId) q = q.eq('member_id', filters.memberId);
  const { data, error } = await q;
  if (error) throw new ApiError(500, error.message);
  return (data ?? []) as TicketLite[];
}

/** Group approved tickets by a key fn into a time/category series. */
function aggregate(tickets: TicketLite[], keyFn: (t: TicketLite) => string, keyLabel: string): Report['rows'] {
  const map = new Map<string, { key: string; tickets: number; persons: number; permitCost: number; commission: number; netProfit: number }>();
  for (const t of tickets.filter((x) => x.status === 'approved')) {
    const k = keyFn(t);
    const row = map.get(k) ?? { key: k, tickets: 0, persons: 0, permitCost: 0, commission: 0, netProfit: 0 };
    row.tickets += 1;
    row.persons += t.persons;
    row.permitCost += permitOf(t);
    row.commission += Number(t.commission_amount);
    row.netProfit += permitOf(t) - Number(t.commission_amount);
    map.set(k, row);
  }
  return [...map.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((r) => ({ [keyLabel]: r.key, tickets: r.tickets, persons: r.persons, permitCost: r.permitCost, commission: r.commission, netProfit: r.netProfit }));
}

const TIME_COLUMNS = (label: string, key: string): ReportColumn[] => [
  { key, label, type: 'text' },
  { key: 'tickets', label: 'Tickets', type: 'number' },
  { key: 'persons', label: 'Persons', type: 'number' },
  { key: 'permitCost', label: 'Permit Cost', type: 'currency' },
  { key: 'commission', label: 'Commission', type: 'currency' },
  { key: 'netProfit', label: 'Net Profit', type: 'currency' },
];

function sumColumn(rows: Report['rows'], key: string) {
  return rows.reduce((s, r) => s + Number(r[key] ?? 0), 0);
}

export async function buildReport(type: ReportType, filters: Filters): Promise<Report> {
  const generatedAt = new Date().toISOString();
  const base = (title: string, columns: ReportColumn[], rows: Report['rows'], summaryKeys: string[]): Report => ({
    type,
    title,
    generatedAt,
    columns,
    rows,
    summary: Object.fromEntries(summaryKeys.map((k) => [k, sumColumn(rows, k)])),
  });

  if (type === 'daily' || type === 'weekly' || type === 'monthly' || type === 'yearly') {
    const tickets = await loadTickets(filters);
    const cfg = {
      daily: { label: 'Date', key: 'date', fn: (t: TicketLite) => t.trek_date },
      weekly: { label: 'Week', key: 'week', fn: (t: TicketLite) => isoWeek(new Date(t.trek_date)) },
      monthly: { label: 'Month', key: 'month', fn: (t: TicketLite) => t.trek_date.slice(0, 7) },
      yearly: { label: 'Year', key: 'year', fn: (t: TicketLite) => t.trek_date.slice(0, 4) },
    }[type];
    const rows = aggregate(tickets, cfg.fn, cfg.key);
    return base(`${type[0].toUpperCase()}${type.slice(1)} Report`, TIME_COLUMNS(cfg.label, cfg.key), rows, ['tickets', 'persons', 'permitCost', 'commission', 'netProfit']);
  }

  if (type === 'trek') {
    const tickets = await loadTickets(filters);
    const rows = aggregate(tickets, (t) => t.trek_name, 'trek');
    return base('Trek Report', TIME_COLUMNS('Trek', 'trek'), rows, ['tickets', 'persons', 'permitCost', 'commission', 'netProfit']);
  }

  if (type === 'member' || type === 'commission') {
    const { data: fin, error } = await supabase.from('member_financials').select('*').order('balance', { ascending: false });
    if (error) throw new ApiError(500, error.message);
    const rows = (fin ?? []).map((f) => ({
      member: f.full_name,
      totalEarned: Number(f.total_earned),
      totalPaid: Number(f.total_paid),
      balance: Number(f.balance),
    }));
    return base(type === 'member' ? 'Member Report' : 'Commission Report', [
      { key: 'member', label: 'Member', type: 'text' },
      { key: 'totalEarned', label: 'Commission Earned', type: 'currency' },
      { key: 'totalPaid', label: 'Total Paid', type: 'currency' },
      { key: 'balance', label: 'Balance', type: 'currency' },
    ], rows, ['totalEarned', 'totalPaid', 'balance']);
  }

  if (type === 'payment') {
    let q = supabase.from('payments').select('*, member:member_id(full_name)').order('payment_date', { ascending: false });
    if (filters.from) q = q.gte('payment_date', filters.from);
    if (filters.to) q = q.lte('payment_date', filters.to);
    if (filters.memberId) q = q.eq('member_id', filters.memberId);
    const { data, error } = await q;
    if (error) throw new ApiError(500, error.message);
    const rows = (data ?? []).map((p: any) => ({
      receipt: p.receipt_no,
      member: p.member?.full_name ?? '',
      date: p.payment_date,
      method: String(p.method).replace('_', ' '),
      reference: p.reference_number ?? '',
      amount: Number(p.amount),
    }));
    return base('Payment Report', [
      { key: 'receipt', label: 'Receipt', type: 'text' },
      { key: 'member', label: 'Member', type: 'text' },
      { key: 'date', label: 'Date', type: 'date' },
      { key: 'method', label: 'Method', type: 'text' },
      { key: 'reference', label: 'Reference', type: 'text' },
      { key: 'amount', label: 'Amount', type: 'currency' },
    ], rows, ['amount']);
  }

  if (type === 'refund') {
    const { data, error } = await supabase
      .from('refunds')
      .select('*, ticket:ticket_id(ticket_code, trek_name, member:member_id(full_name))')
      .order('created_at', { ascending: false });
    if (error) throw new ApiError(500, error.message);
    const rows = (data ?? []).map((r: any) => ({
      ticket: r.ticket?.ticket_code ?? '',
      member: r.ticket?.member?.full_name ?? '',
      cancelledOn: r.cancellation_date,
      percent: r.refund_percent,
      amount: Number(r.refund_amount),
      expected: r.expected_refund_date,
      status: r.status,
    }));
    return base('Refund Report', [
      { key: 'ticket', label: 'Ticket', type: 'text' },
      { key: 'member', label: 'Member', type: 'text' },
      { key: 'cancelledOn', label: 'Cancelled On', type: 'date' },
      { key: 'percent', label: 'Refund %', type: 'number' },
      { key: 'amount', label: 'Refund Amount', type: 'currency' },
      { key: 'expected', label: 'Expected By', type: 'date' },
      { key: 'status', label: 'Status', type: 'text' },
    ], rows, ['amount']);
  }

  throw new ApiError(400, `Unknown report type: ${type}`);
}

/** Render a report as CSV text. */
export function reportToCsv(report: Report): string {
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = report.columns.map((c) => esc(c.label)).join(',');
  const body = report.rows.map((row) => report.columns.map((c) => esc(row[c.key])).join(',')).join('\n');
  return `${header}\n${body}`;
}
