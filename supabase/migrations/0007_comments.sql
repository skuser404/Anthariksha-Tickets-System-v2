-- ============================================================================
-- Migration 0007: Ticket comments & correction-request module
--   * chat-style comments between member and admin on a ticket
--   * comment types + conversation status
--   * attachments stored in a private Supabase Storage bucket
-- ============================================================================

do $$ begin
  create type comment_type as enum (
    'correction_request',
    'ticket_info',
    'booking_issue',
    'cancellation_request',
    'replacement_request',
    'general_question',
    'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type comment_status as enum ('open', 'waiting_admin', 'waiting_member', 'resolved', 'closed');
exception when duplicate_object then null; end $$;

create table if not exists ticket_comments (
  id               uuid primary key default gen_random_uuid(),
  ticket_id        uuid not null references tickets(id) on delete cascade,
  author_id        uuid references users(id) on delete set null,
  author_role      user_role not null,
  type             comment_type not null default 'general_question',
  message          text not null check (char_length(message) <= 500),
  status           comment_status not null default 'open',
  attachment_path  text,            -- storage object path (private bucket)
  attachment_name  text,
  edited_at        timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists idx_ticket_comments_ticket on ticket_comments(ticket_id, created_at);

alter table ticket_comments enable row level security;

-- Members read/insert on their own tickets; admins on all.
drop policy if exists comments_select on ticket_comments;
create policy comments_select on ticket_comments for select
  using (app_is_admin() or exists (
    select 1 from tickets t where t.id = ticket_comments.ticket_id and t.member_id = app_current_user_id()
  ));
drop policy if exists comments_insert on ticket_comments;
create policy comments_insert on ticket_comments for insert
  with check (app_is_admin() or exists (
    select 1 from tickets t where t.id = ticket_comments.ticket_id and t.member_id = app_current_user_id()
  ));

-- ----------------------------------------------------------------------------
-- Private storage bucket for attachments (10 MB max enforced in the API).
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('ticket-attachments', 'ticket-attachments', false)
on conflict (id) do nothing;
