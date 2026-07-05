-- ============================================================================
-- Migration 0009: Force-delete a member (destructive purge)
--   Permanently removes a member AND all their records. The immutable ledger is
--   normally append-only; it can be purged ONLY inside purge_member(), which sets
--   a transaction-local flag the ledger trigger honours. Nothing else can mutate
--   the ledger.
-- ============================================================================

-- Ledger stays append-only, except during an explicit member purge.
create or replace function ledger_block_mutation()
returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('app.allow_purge', true), 'off') = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'ledger_entries is append-only and cannot be %', tg_op;
end $$;

-- Atomically purge a member and every record tied to them.
create or replace function purge_member(p_member uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from users where id = p_member and role = 'member') then
    raise exception 'Not a deletable member';
  end if;

  -- Allow ledger deletion for the duration of this transaction only.
  perform set_config('app.allow_purge', 'on', true);

  -- Ledger entries first (FK set-null back-references would otherwise be blocked).
  delete from ledger_entries
    where member_id = p_member
       or ticket_id in (select id from tickets where member_id = p_member)
       or payment_id in (select id from payments where member_id = p_member)
       or refund_id in (
            select r.id from refunds r
            join tickets t on t.id = r.ticket_id
            where t.member_id = p_member);

  delete from payments where member_id = p_member;
  -- Deleting the member's tickets cascades their refunds, comments and notes.
  delete from tickets  where member_id = p_member;
  delete from notifications where user_id = p_member;

  -- Finally the account (otp cascades; login/audit/replacement FKs set null).
  delete from users where id = p_member and role = 'member';
end $$;
