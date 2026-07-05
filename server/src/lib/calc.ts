/**
 * Pure financial calculations — no I/O, so they're trivially unit-testable.
 */

export const COMMISSION_PER_PERSON = 50;
export const REFUND_LEAD_DAYS = 30;

/** Commission credited to a member for a ticket. */
export function commissionFor(persons: number, perPerson = COMMISSION_PER_PERSON): number {
  return Math.max(0, Math.trunc(persons)) * perPerson;
}

export interface RefundCalc {
  daysBefore: number;
  percent: 0 | 50 | 100;
  amount: number;
  expectedRefundDate: string;
}

/**
 * Refund policy based on days between cancellation and the trek date:
 *   ≥7 days → 100%, 4–6 days → 50%, <4 days → 0%.
 * Expected refund date = cancellation date + 30 days.
 */
export function computeRefund(trekDate: string, cancellationDate: string, permitTotal: number): RefundCalc {
  const trek = new Date(trekDate + 'T00:00:00Z');
  const cancel = new Date(cancellationDate + 'T00:00:00Z');
  const daysBefore = Math.round((trek.getTime() - cancel.getTime()) / 86_400_000);

  const percent: 0 | 50 | 100 = daysBefore >= 7 ? 100 : daysBefore >= 4 ? 50 : 0;
  const amount = Math.round((permitTotal * percent) / 100);
  const expected = new Date(cancel.getTime() + REFUND_LEAD_DAYS * 86_400_000);

  return { daysBefore, percent, amount, expectedRefundDate: expected.toISOString().slice(0, 10) };
}
