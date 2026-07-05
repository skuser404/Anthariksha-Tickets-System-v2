-- ============================================================================
-- Migration 0004: Phase 4 enterprise features
--   * Immutable financial ledger
--   * Ticket smart-verification flags + colored tags
--   * Admin-only private ticket notes
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Ledger types
-- ----------------------------------------------------------------------------
do $$ begin
  create type ledger_type as enum (
    'commission_earned',
    'commission_paid',
    'refund_expected',
    'refund_received',
    'permit_cost',
    'manual_adjustment'
  );
exception when duplicate_object then null; end $$;

-- direction: money INTO the operation, OUT of it, or a tracked LIABILITY/accrual
do $$ begin
  create type ledger_flow as enum ('in', 'out', 'liability');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- Immutable financial ledger. Append-only: a revoke trigger blocks UPDATE/DELETE.
-- ----------------------------------------------------------------------------
create table if not exists ledger_entries (
  id                uuid primary key default gen_random_uuid(),
  type              ledger_type not null,
  flow              ledger_flow not null,
  amount            numeric(12,2) not null,
  member_id         uuid references users(id) on delete set null,
  ticket_id         uuid references tickets(id) on delete set null,
  payment_id        uuid references payments(id) on delete set null,
  refund_id         uuid references refunds(id) on delete set null,
  reference_number  text,
  notes             text,
  created_by        uuid references users(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index if not exists idx_ledger_type on ledger_entries(type, created_at desc);
create index if not exists idx_ledger_member on ledger_entries(member_id);
create index if not exists idx_ledger_ticket on ledger_entries(ticket_id);

-- Enforce immutability at the database level.
create or replace function ledger_block_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'ledger_entries is append-only and cannot be % ', tg_op;
end $$;
drop trigger if exists trg_ledger_no_update on ledger_entries;
create trigger trg_ledger_no_update before update or delete on ledger_entries
  for each row execute function ledger_block_mutation();

-- ----------------------------------------------------------------------------
-- Ticket smart-verification flags + colored tags
-- ----------------------------------------------------------------------------
alter table tickets add column if not exists flags jsonb not null default '[]'::jsonb;
alter table tickets add column if not exists tags  text[] not null default '{}';
create index if not exists idx_tickets_tags on tickets using gin (tags);

-- ----------------------------------------------------------------------------
-- Admin-only private notes on a ticket
-- ----------------------------------------------------------------------------
create table if not exists ticket_notes (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references tickets(id) on delete cascade,
  author_id   uuid references users(id) on delete set null,
  body        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_ticket_notes_ticket on ticket_notes(ticket_id, created_at desc);

alter table ledger_entries enable row level security;
alter table ticket_notes   enable row level security;

-- Ledger + notes are admin-only (service role bypasses RLS anyway).
drop policy if exists ledger_admin on ledger_entries;
create policy ledger_admin on ledger_entries for all
  using (app_is_admin()) with check (app_is_admin());
drop policy if exists notes_admin on ticket_notes;
create policy notes_admin on ticket_notes for all
  using (app_is_admin()) with check (app_is_admin());
