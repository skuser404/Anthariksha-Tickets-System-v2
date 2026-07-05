-- ============================================================================
-- Migration 0002: Row-Level Security
-- ----------------------------------------------------------------------------
-- NOTE: The Express API connects with the Supabase SERVICE ROLE key, which
-- bypasses RLS. These policies are a defense-in-depth layer so that if you ever
-- expose the anon key directly to the client, members can only see their own
-- rows. The Express layer sets `request.jwt.claims` is NOT used here; instead we
-- rely on a session GUC `app.current_user_id` / `app.current_user_role` that the
-- API sets per request. For pure service-role access these policies are inert.
-- ============================================================================

-- Helper accessors for the per-request GUCs set by the API.
create or replace function app_current_user_id() returns uuid
language sql stable as $$
  select nullif(current_setting('app.current_user_id', true), '')::uuid
$$;

create or replace function app_is_admin() returns boolean
language sql stable as $$
  select coalesce(current_setting('app.current_user_role', true) = 'admin', false)
$$;

alter table tickets             enable row level security;
alter table payments            enable row level security;
alter table refunds             enable row level security;
alter table notifications       enable row level security;
alter table replacement_tickets enable row level security;
alter table original_tickets    enable row level security;

-- Tickets: members see/insert their own; admins see all.
drop policy if exists tickets_select on tickets;
create policy tickets_select on tickets for select
  using (app_is_admin() or member_id = app_current_user_id());

drop policy if exists tickets_insert on tickets;
create policy tickets_insert on tickets for insert
  with check (app_is_admin() or member_id = app_current_user_id());

drop policy if exists tickets_update on tickets;
create policy tickets_update on tickets for update
  using (app_is_admin() or member_id = app_current_user_id());

-- Payments: members read their own, only admins write.
drop policy if exists payments_select on payments;
create policy payments_select on payments for select
  using (app_is_admin() or member_id = app_current_user_id());
drop policy if exists payments_write on payments;
create policy payments_write on payments for all
  using (app_is_admin()) with check (app_is_admin());

-- Refunds: tied to a ticket owned by the member, or admin.
drop policy if exists refunds_select on refunds;
create policy refunds_select on refunds for select
  using (app_is_admin() or exists (
    select 1 from tickets t where t.id = refunds.ticket_id and t.member_id = app_current_user_id()
  ));
drop policy if exists refunds_write on refunds;
create policy refunds_write on refunds for all
  using (app_is_admin()) with check (app_is_admin());

-- Notifications: each user sees their own.
drop policy if exists notifications_own on notifications;
create policy notifications_own on notifications for all
  using (app_is_admin() or user_id = app_current_user_id())
  with check (app_is_admin() or user_id = app_current_user_id());

-- Replacement & original tickets: admin only.
drop policy if exists replacement_admin on replacement_tickets;
create policy replacement_admin on replacement_tickets for all
  using (app_is_admin()) with check (app_is_admin());
drop policy if exists original_admin on original_tickets;
create policy original_admin on original_tickets for all
  using (app_is_admin()) with check (app_is_admin());
