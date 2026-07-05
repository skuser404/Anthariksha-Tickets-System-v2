import { supabase } from '../lib/supabase.js';

/** Humanized live activity feed derived from the immutable audit log. */
export async function activityFeed(limit = 60) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, action, entity, entity_id, metadata, created_at, actor:actor_id(full_name)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const verbs: Record<string, string> = {
    'ticket.create': 'submitted a ticket',
    'ticket.approved': 'approved a ticket',
    'ticket.not_confirmed': 'rejected a ticket',
    'ticket.bulk_approved': 'bulk-approved tickets',
    'ticket.bulk_not_confirmed': 'bulk-rejected tickets',
    'ticket.cancel': 'cancelled a ticket',
    'ticket.tags': 'updated ticket tags',
    'payment.create': 'recorded a payment',
    'refund.complete': 'completed a refund',
    'replacement.create': 'created a replacement',
    'trek.create': 'added a trek',
    'trek.update': 'updated trek pricing',
    'member.create': 'created a member',
    'member.activate': 'activated a member',
    'member.deactivate': 'deactivated a member',
    'ledger.adjustment': 'posted a ledger adjustment',
    'settings.change': 'changed settings',
    'password.change': 'changed a password',
  };

  return (data ?? []).map((l: any) => ({
    id: l.id,
    actor: l.actor?.full_name ?? 'System',
    action: l.action,
    text: verbs[l.action] ?? l.action.replace('.', ' '),
    entity: l.entity,
    entityId: l.entity_id,
    at: l.created_at,
  }));
}

/** Per-member performance metrics + rankings for the leaderboard. */
export async function leaderboard() {
  const [{ data: tickets }, { data: fin }] = await Promise.all([
    supabase.from('tickets').select('member_id, status, persons, member:member_id(full_name)'),
    supabase.from('member_financials').select('member_id, total_earned, total_paid, balance'),
  ]);

  const finMap = new Map((fin ?? []).map((f) => [f.member_id, f]));
  const map = new Map<string, any>();

  for (const t of tickets ?? []) {
    const id = t.member_id;
    const name = (t as any).member?.full_name ?? 'Unknown';
    const row = map.get(id) ?? { memberId: id, name, total: 0, approved: 0, decided: 0, rejected: 0, cancelled: 0, persons: 0 };
    row.total += 1;
    row.persons += t.persons;
    if (t.status === 'approved') row.approved += 1;
    if (t.status === 'not_confirmed') { row.rejected += 1; row.decided += 1; }
    if (t.status === 'approved') row.decided += 1;
    if (['cancelled', 'refund_pending', 'refund_completed'].includes(t.status)) row.cancelled += 1;
    map.set(id, row);
  }

  const rows = [...map.values()].map((r) => {
    const f = finMap.get(r.memberId);
    return {
      ...r,
      earned: Number(f?.total_earned ?? 0),
      balance: Number(f?.balance ?? 0),
      approvalRate: r.decided ? Math.round((r.approved / r.decided) * 100) : 0,
      avgPersons: r.total ? Math.round((r.persons / r.total) * 10) / 10 : 0,
      refundRatio: r.total ? Math.round((r.cancelled / r.total) * 100) : 0,
    };
  });

  const topBy = (key: string) => [...rows].sort((a, b) => b[key] - a[key]).slice(0, 5);

  return {
    members: rows.sort((a, b) => b.earned - a.earned),
    topEarners: topBy('earned'),
    topApproved: topBy('approved'),
    bestApprovalRate: [...rows].filter((r) => r.decided >= 2).sort((a, b) => b.approvalRate - a.approvalRate).slice(0, 5),
    mostActive: topBy('total'),
  };
}

/** Top treks (separate query so we have trek names). */
export async function topTreks() {
  const { data } = await supabase.from('tickets').select('trek_name, persons, permit_price, status').eq('status', 'approved');
  const map = new Map<string, { trek: string; persons: number; revenue: number; tickets: number }>();
  for (const t of data ?? []) {
    const row = map.get(t.trek_name) ?? { trek: t.trek_name, persons: 0, revenue: 0, tickets: 0 };
    row.persons += t.persons;
    row.revenue += Number(t.permit_price) * t.persons;
    row.tickets += 1;
    map.set(t.trek_name, row);
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}
