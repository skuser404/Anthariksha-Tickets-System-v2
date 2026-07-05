import { supabase } from './supabase.js';

export interface TicketFlag {
  code: 'duplicate_booking_email' | 'duplicate_email_trekdate' | 'repeat_member_submission' | 'unusual_person_count' | 'unusual_commission';
  severity: 'warning' | 'danger';
  message: string;
}

const COMMISSION_PER_PERSON = 50;

/**
 * Smart-verification checks run when a ticket is submitted. The DB already blocks
 * exact-duplicate Ticket IDs (unique constraint); these are the softer signals an
 * admin should see before approving.
 */
export async function computeTicketFlags(input: {
  memberId: string;
  bookingEmail: string;
  trekName: string;
  trekDate: string;
  persons: number;
  permitPrice: number;
  commissionPerPerson?: number;
}): Promise<TicketFlag[]> {
  const flags: TicketFlag[] = [];

  // Invalid / unusual person count.
  if (input.persons <= 0 || input.persons > 20) {
    flags.push({ code: 'unusual_person_count', severity: 'warning', message: `Unusual person count (${input.persons}).` });
  }

  // Commission must equal persons × rate.
  const expected = input.persons * (input.commissionPerPerson ?? COMMISSION_PER_PERSON);
  if (Math.round(input.persons * (input.commissionPerPerson ?? COMMISSION_PER_PERSON)) !== expected) {
    flags.push({ code: 'unusual_commission', severity: 'danger', message: 'Commission value looks incorrect.' });
  }

  // Same booking email used elsewhere.
  const { count: emailCount } = await supabase
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('booking_email', input.bookingEmail);
  if ((emailCount ?? 0) > 0) {
    flags.push({ code: 'duplicate_booking_email', severity: 'warning', message: `Booking email used on ${emailCount} other ticket(s).` });
  }

  // Same email + trek date (likely the same underlying booking).
  const { count: comboCount } = await supabase
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('booking_email', input.bookingEmail)
    .eq('trek_date', input.trekDate);
  if ((comboCount ?? 0) > 0) {
    flags.push({ code: 'duplicate_email_trekdate', severity: 'danger', message: 'Same booking email + trek date already submitted.' });
  }

  // Same member repeating an identical (trek + date) submission.
  const { count: repeatCount } = await supabase
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', input.memberId)
    .eq('trek_name', input.trekName)
    .eq('trek_date', input.trekDate);
  if ((repeatCount ?? 0) > 0) {
    flags.push({ code: 'repeat_member_submission', severity: 'warning', message: 'You already submitted a ticket for this trek and date.' });
  }

  return flags;
}
