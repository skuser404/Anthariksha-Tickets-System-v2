-- ============================================================================
-- Antariksha Trek Operations & Commission Management System
-- Migration 0001: Core schema (normalized relational model)
-- Target: Supabase PostgreSQL
-- ============================================================================

create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "citext";         -- case-insensitive email

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('admin', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ticket_status as enum (
    'pending_verification',
    'approved',
    'not_confirmed',
    'cancelled',
    'refund_pending',
    'refund_completed',
    'replacement_completed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum ('upi', 'bank_transfer', 'cash', 'cheque', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type refund_status as enum ('pending', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type notification_channel as enum ('in_app', 'email', 'push');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- updated_at helper
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ----------------------------------------------------------------------------
-- Users  (auth owned by the Express layer; passwords are bcrypt hashes)
-- ----------------------------------------------------------------------------
create table if not exists users (
  id                uuid primary key default gen_random_uuid(),
  full_name         text not null,
  email             citext not null unique,
  phone             text,
  password_hash     text not null,
  role              user_role not null default 'member',
  is_active         boolean not null default true,
  -- 2FA / TOTP (optional authenticator app second factor for admins)
  totp_secret       text,
  totp_enabled      boolean not null default false,
  -- account lockout
  failed_otp_count  int not null default 0,
  locked_until      timestamptz,
  last_login_at     timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger trg_users_updated before update on users
  for each row execute function set_updated_at();
create index if not exists idx_users_role on users(role);

-- ----------------------------------------------------------------------------
-- One-time passwords (email OTP for admin 2FA, short lived)
-- ----------------------------------------------------------------------------
create table if not exists otp_codes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  code_hash    text not null,                 -- bcrypt hash of the 6-digit code
  purpose      text not null default 'login',
  expires_at   timestamptz not null,
  consumed_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists idx_otp_user on otp_codes(user_id, created_at desc);

-- ----------------------------------------------------------------------------
-- Login attempt audit (IP, device, timestamp, outcome)
-- ----------------------------------------------------------------------------
create table if not exists login_attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete set null,
  email       citext,
  success     boolean not null,
  stage       text not null default 'password',  -- password | otp
  ip_address  inet,
  user_agent  text,
  reason      text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_login_attempts_user on login_attempts(user_id, created_at desc);

-- ----------------------------------------------------------------------------
-- Trek pricing (admin editable; history preserved by snapshotting price onto
-- each ticket so changing a trek's price never mutates old records)
-- ----------------------------------------------------------------------------
create table if not exists trek_pricing (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  permit_price numeric(10,2) not null check (permit_price >= 0),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger trg_trek_pricing_updated before update on trek_pricing
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Tickets (member submissions). Commission = persons * commission_per_person.
-- permit_price is a SNAPSHOT taken at submission time.
-- ----------------------------------------------------------------------------
create table if not exists tickets (
  id                      uuid primary key default gen_random_uuid(),
  ticket_code             text not null,                 -- the official Aranya Vihara ticket id
  member_id               uuid not null references users(id) on delete restrict,
  trek_id                 uuid references trek_pricing(id) on delete set null,
  trek_name               text not null,                 -- snapshot
  booking_email           citext not null,
  booking_date            date not null,
  trek_date               date not null,
  persons                 int not null check (persons > 0),
  permit_price            numeric(10,2) not null check (permit_price >= 0),  -- snapshot per person
  commission_per_person   numeric(10,2) not null default 50,
  commission_amount       numeric(10,2) not null default 0,
  status                  ticket_status not null default 'pending_verification',
  remarks                 text,
  verified_by             uuid references users(id) on delete set null,
  verified_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  -- duplicate guard: same official ticket code cannot be submitted twice
  constraint uq_ticket_code unique (ticket_code)
);
create trigger trg_tickets_updated before update on tickets
  for each row execute function set_updated_at();
create index if not exists idx_tickets_member on tickets(member_id);
create index if not exists idx_tickets_status on tickets(status);
create index if not exists idx_tickets_trek_date on tickets(trek_date);
create index if not exists idx_tickets_booking_email on tickets(booking_email);

-- Keep commission_amount consistent automatically
create or replace function compute_ticket_commission()
returns trigger language plpgsql as $$
begin
  new.commission_amount = new.persons * coalesce(new.commission_per_person, 50);
  return new;
end $$;
create trigger trg_tickets_commission before insert or update on tickets
  for each row execute function compute_ticket_commission();

-- ----------------------------------------------------------------------------
-- Original tickets (admin reference register)
-- ----------------------------------------------------------------------------
create table if not exists original_tickets (
  id              uuid primary key default gen_random_uuid(),
  ticket_code     text not null,
  booking_email   citext not null,
  booking_date    date not null,
  trek_date       date not null,
  persons         int not null check (persons > 0),
  permit_price    numeric(10,2) not null check (permit_price >= 0),
  status          ticket_status not null default 'approved',
  remarks         text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger trg_original_tickets_updated before update on original_tickets
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Replacement tickets
-- ----------------------------------------------------------------------------
create table if not exists replacement_tickets (
  id                 uuid primary key default gen_random_uuid(),
  old_ticket_id      uuid references tickets(id) on delete set null,
  old_ticket_code    text not null,
  new_ticket_code    text not null,
  booking_email      citext not null,
  replacement_date   date not null,
  persons            int not null check (persons > 0),
  permit_cost        numeric(10,2) not null check (permit_cost >= 0),
  remarks            text,
  created_by         uuid references users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger trg_replacement_tickets_updated before update on replacement_tickets
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Payments (admin -> member). Ledger; balance = sum(commission approved) - sum(payments)
-- ----------------------------------------------------------------------------
create table if not exists payments (
  id               uuid primary key default gen_random_uuid(),
  member_id        uuid not null references users(id) on delete restrict,
  amount           numeric(10,2) not null check (amount > 0),
  payment_date     date not null default current_date,
  method           payment_method not null default 'upi',
  reference_number text,
  remarks          text,
  receipt_no       text not null unique default ('RCPT-' || to_char(now(),'YYYYMMDD') || '-' || substr(gen_random_uuid()::text,1,8)),
  created_by       uuid references users(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists idx_payments_member on payments(member_id);

-- ----------------------------------------------------------------------------
-- Refunds (driven by cancellations)
-- ----------------------------------------------------------------------------
create table if not exists refunds (
  id                  uuid primary key default gen_random_uuid(),
  ticket_id           uuid not null references tickets(id) on delete cascade,
  cancellation_date   date not null,
  days_before_trek    int not null,
  refund_percent      int not null,           -- 0 / 50 / 100
  refund_amount       numeric(10,2) not null,
  expected_refund_date date not null,         -- cancellation_date + 30 days
  status              refund_status not null default 'pending',
  received_date       date,
  remarks             text,
  created_by          uuid references users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger trg_refunds_updated before update on refunds
  for each row execute function set_updated_at();
create index if not exists idx_refunds_status on refunds(status);

-- ----------------------------------------------------------------------------
-- Notifications (in-app + email/push fan-out record)
-- ----------------------------------------------------------------------------
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  title       text not null,
  body        text not null,
  channel     notification_channel not null default 'in_app',
  link        text,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_notifications_user on notifications(user_id, is_read, created_at desc);

-- ----------------------------------------------------------------------------
-- Audit logs (who did what)
-- ----------------------------------------------------------------------------
create table if not exists audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references users(id) on delete set null,
  action      text not null,
  entity      text not null,
  entity_id   text,
  metadata    jsonb,
  ip_address  inet,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_entity on audit_logs(entity, entity_id);

-- ----------------------------------------------------------------------------
-- Settings (key/value app config)
-- ----------------------------------------------------------------------------
create table if not exists settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);
create trigger trg_settings_updated before update on settings
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Convenience view: per-member financial summary
-- ----------------------------------------------------------------------------
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
