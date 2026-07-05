import { supabase } from '../lib/supabase.js';
import { notify } from '../lib/audit.js';
import { inr } from '../lib/format.js';

const LARGE_COMMISSION = 1000;

/** Has an identical notification been sent to this user in the last ~23 hours? */
async function recentlyNotified(userId: string, title: string): Promise<boolean> {
  const since = new Date(Date.now() - 23 * 3_600_000).toISOString();
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('title', title)
    .gte('created_at', since);
  return (count ?? 0) > 0;
}

async function notifyAdminsOnce(title: string, body: string, link?: string) {
  const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin');
  for (const a of admins ?? []) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await recentlyNotified(a.id, title))) {
      // eslint-disable-next-line no-await-in-loop
      await notify({ userId: a.id, title, body, link });
    }
  }
}

/**
 * Smart-notification automation. Runs on a schedule (and on demand) to surface
 * operational issues to admins without manual checking.
 */
export async function runSmartNotifications(): Promise<{ checks: Record<string, number> }> {
  const now = Date.now();
  const checks: Record<string, number> = {};

  // 1) Pending verification > 24h.
  const cutoff24 = new Date(now - 24 * 3_600_000).toISOString();
  const { data: stale } = await supabase
    .from('tickets')
    .select('id, ticket_code, commission_amount, flags')
    .eq('status', 'pending_verification')
    .lt('created_at', cutoff24);
  checks.pending_over_24h = (stale ?? []).length;
  if ((stale ?? []).length > 0) {
    await notifyAdminsOnce('Tickets awaiting verification', `${stale!.length} ticket(s) have been pending for over 24 hours.`, '/admin/tickets');
  }

  // 2) Large pending commission values.
  const large = (stale ?? []).filter((t) => Number(t.commission_amount) >= LARGE_COMMISSION);
  checks.large_commission = large.length;
  if (large.length > 0) {
    await notifyAdminsOnce('Large commission pending', `${large.length} pending ticket(s) carry commission ≥ ${inr(LARGE_COMMISSION)}.`, '/admin/tickets');
  }

  // 3) Flagged (duplicate) pending tickets.
  const flagged = (stale ?? []).filter((t) => Array.isArray(t.flags) && (t.flags as unknown[]).length > 0);
  checks.flagged_pending = flagged.length;

  // 4) Refund deadline approaching (expected within 3 days, still pending).
  const today = new Date().toISOString().slice(0, 10);
  const in3 = new Date(now + 3 * 86_400_000).toISOString().slice(0, 10);
  const { data: dueSoon } = await supabase
    .from('refunds')
    .select('id')
    .neq('status', 'completed')
    .gte('expected_refund_date', today)
    .lte('expected_refund_date', in3);
  checks.refunds_due_soon = (dueSoon ?? []).length;
  if ((dueSoon ?? []).length > 0) {
    await notifyAdminsOnce('Refund deadlines approaching', `${dueSoon!.length} refund(s) are expected within 3 days.`, '/refunds');
  }

  // 5) Overdue refunds (expected date passed, not yet received).
  const { data: overdue } = await supabase
    .from('refunds')
    .select('id')
    .neq('status', 'completed')
    .lt('expected_refund_date', today);
  checks.refunds_overdue = (overdue ?? []).length;
  if ((overdue ?? []).length > 0) {
    await notifyAdminsOnce('Overdue refunds', `${overdue!.length} refund(s) are past their expected date.`, '/refunds');
  }

  return { checks };
}

/** Start the in-process scheduler (runs on boot, then on an interval). */
export function startNotificationScheduler(intervalMs = 6 * 3_600_000) {
  const safeRun = () => runSmartNotifications().catch((e) => console.error('Smart notifications failed:', e));
  setTimeout(safeRun, 15_000); // shortly after boot
  setInterval(safeRun, intervalMs).unref();
}
