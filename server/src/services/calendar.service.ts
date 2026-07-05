import { supabase } from '../lib/supabase.js';

export interface CalendarEvent {
  date: string; // YYYY-MM-DD
  type: 'booking' | 'trek' | 'approval' | 'cancellation' | 'refund_expected' | 'refund_received' | 'payment';
  label: string;
  ref?: string;
}

/** All dated operational records for a given month (YYYY-MM). */
export async function calendarEvents(month: string): Promise<CalendarEvent[]> {
  const start = `${month}-01`;
  const end = `${month}-31`;
  const events: CalendarEvent[] = [];

  const [{ data: tickets }, { data: refunds }, { data: payments }] = await Promise.all([
    supabase.from('tickets').select('ticket_code, trek_name, booking_date, trek_date, verified_at, status'),
    supabase.from('refunds').select('cancellation_date, expected_refund_date, received_date, status, ticket:ticket_id(ticket_code)'),
    supabase.from('payments').select('amount, payment_date, member:member_id(full_name)'),
  ]);

  const inMonth = (d: string | null | undefined) => !!d && d >= start && d <= end;

  for (const t of tickets ?? []) {
    if (inMonth(t.booking_date)) events.push({ date: t.booking_date, type: 'booking', label: `Booking ${t.ticket_code}`, ref: t.ticket_code });
    if (inMonth(t.trek_date)) events.push({ date: t.trek_date, type: 'trek', label: `Trek ${t.trek_name} (${t.ticket_code})`, ref: t.ticket_code });
    if (t.status === 'approved' && t.verified_at && inMonth(t.verified_at.slice(0, 10)))
      events.push({ date: t.verified_at.slice(0, 10), type: 'approval', label: `Approved ${t.ticket_code}`, ref: t.ticket_code });
  }
  for (const r of refunds ?? []) {
    const code = (r as any).ticket?.ticket_code ?? '';
    if (inMonth(r.cancellation_date)) events.push({ date: r.cancellation_date, type: 'cancellation', label: `Cancelled ${code}`, ref: code });
    if (inMonth(r.expected_refund_date)) events.push({ date: r.expected_refund_date, type: 'refund_expected', label: `Refund due ${code}`, ref: code });
    if (r.status === 'completed' && inMonth(r.received_date)) events.push({ date: r.received_date!, type: 'refund_received', label: `Refund received ${code}`, ref: code });
  }
  for (const p of payments ?? []) {
    if (inMonth(p.payment_date)) events.push({ date: p.payment_date, type: 'payment', label: `Payment ₹${Number(p.amount).toFixed(0)} · ${(p as any).member?.full_name ?? ''}` });
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}
