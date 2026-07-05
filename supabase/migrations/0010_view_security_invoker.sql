-- ============================================================================
-- Migration 0010: make member_financials respect the caller's RLS
--   Fixes the Supabase advisor "Security Definer View" error. Recreating the
--   view WITH (security_invoker = on) guarantees the option is set regardless of
--   the view's prior state. The server uses the service-role key (bypasses RLS),
--   so app behaviour is unchanged.
--   Requires PostgreSQL 15+ (all current Supabase projects).
-- ============================================================================

create or replace view member_financials
with (security_invoker = on) as
select
  u.id                                            as member_id,
  u.full_name,
  coalesce(c.total_earned, 0)::numeric(10,2)      as total_earned,
  coalesce(p.total_paid, 0)::numeric(10,2)        as total_paid,
  (coalesce(c.total_earned,0) - coalesce(p.total_paid,0))::numeric(10,2) as balance
from users u
left join (
  select member_id, sum(commission_amount) as total_earned
  from tickets where status = 'approved' group by member_id
) c on c.member_id = u.id
left join (
  select member_id, sum(amount) as total_paid
  from payments group by member_id
) p on p.member_id = u.id
where u.role = 'member';
