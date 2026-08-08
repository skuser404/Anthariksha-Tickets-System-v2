import { supabase } from '../lib/supabase.js';
import { orIlike, sanitiseLikeTerm } from '../lib/postgrest.js';

export interface SearchHit {
  type: 'ticket' | 'member' | 'trek' | 'comment' | 'payment' | 'document';
  id: string;
  title: string;
  subtitle: string;
  link: string;
  badge?: string;
}

const LIMIT = 6;

/**
 * Cross-entity search powering the ⌘K palette.
 *
 * Members only ever see their own tickets, comments and payments; the member and
 * trek registries are admin-only. Each entity is queried with its own limit so
 * one noisy type cannot crowd the others out.
 */
export async function globalSearch(
  term: string,
  user: { sub: string; role: 'admin' | 'member' },
): Promise<{ hits: SearchHit[]; term: string }> {
  const q = sanitiseLikeTerm(term);
  if (q.length < 2) return { hits: [], term: q };

  const isAdmin = user.role === 'admin';
  const hits: SearchHit[] = [];

  // --- Tickets (by code, booking email, trek name) ---
  let ticketQuery = supabase
    .from('tickets')
    .select('id, ticket_code, trek_name, trek_date, persons, status, member_id, member:member_id(full_name)')
    .or(orIlike(['ticket_code', 'booking_email', 'trek_name'], q))
    .order('created_at', { ascending: false })
    .limit(LIMIT);
  if (!isAdmin) ticketQuery = ticketQuery.eq('member_id', user.sub);

  const { data: tickets } = await ticketQuery;
  for (const t of (tickets ?? []) as any[]) {
    hits.push({
      type: 'ticket',
      id: t.id,
      title: t.ticket_code,
      subtitle: `${t.trek_name} · ${t.persons} pax${isAdmin && t.member?.full_name ? ` · ${t.member.full_name}` : ''}`,
      link: `/tickets/${t.id}`,
      badge: t.status,
    });
  }

  if (isAdmin) {
    // --- Members (by name, email, phone) ---
    const { data: members } = await supabase
      .from('users')
      .select('id, full_name, email, is_active')
      .eq('role', 'member')
      .or(orIlike(['full_name', 'email', 'phone'], q))
      .limit(LIMIT);
    for (const m of members ?? []) {
      hits.push({
        type: 'member',
        id: m.id,
        title: m.full_name,
        subtitle: m.email,
        link: `/admin/members/${m.id}`,
        badge: m.is_active ? undefined : 'inactive',
      });
    }

    // --- Treks ---
    const { data: treks } = await supabase
      .from('trek_pricing')
      .select('id, name, permit_price, is_active')
      .ilike('name', `%${q}%`)
      .limit(LIMIT);
    for (const t of treks ?? []) {
      hits.push({
        type: 'trek',
        id: t.id,
        title: t.name,
        subtitle: `Permit ₹${Number(t.permit_price).toLocaleString('en-IN')} / person`,
        link: '/admin/treks',
        badge: t.is_active ? undefined : 'inactive',
      });
    }
  }

  // --- Comments (scoped to the member's own tickets) ---
  const commentQuery = supabase
    .from('ticket_comments')
    .select('id, ticket_id, message, type, created_at, ticket:ticket_id(ticket_code, member_id)')
    .ilike('message', `%${q}%`)
    .order('created_at', { ascending: false })
    .limit(LIMIT);
  const { data: comments } = await commentQuery;
  for (const c of (comments ?? []) as any[]) {
    // The join cannot be filtered server-side here, so enforce ownership in code.
    if (!isAdmin && c.ticket?.member_id !== user.sub) continue;
    hits.push({
      type: 'comment',
      id: c.id,
      title: c.message.slice(0, 60),
      subtitle: `Comment on ${c.ticket?.ticket_code ?? 'ticket'}`,
      link: `/tickets/${c.ticket_id}`,
      badge: c.type,
    });
  }

  // --- Permit documents (by file name) ---
  const docQuery = supabase
    .from('ticket_documents')
    .select('id, ticket_id, file_name, version, is_current, ticket:ticket_id(ticket_code, member_id)')
    .eq('is_current', true)
    .ilike('file_name', `%${q}%`)
    .limit(LIMIT);
  const { data: docs } = await docQuery;
  for (const d of (docs ?? []) as any[]) {
    if (!isAdmin && d.ticket?.member_id !== user.sub) continue;
    hits.push({
      type: 'document',
      id: d.id,
      title: d.file_name,
      subtitle: `Permit on ${d.ticket?.ticket_code ?? 'ticket'} (v${d.version})`,
      link: `/tickets/${d.ticket_id}`,
    });
  }

  return { hits, term: q };
}
