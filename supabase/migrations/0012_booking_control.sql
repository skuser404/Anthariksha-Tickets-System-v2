-- ============================================================================
-- Migration 0012: Admin-controlled booking
--   * trek_dates      - admin decides which dates members may book
--   * announcements   - notice banner on the member dashboard
--   * trek metadata   - district / description / per-trek instructions
--   * booking account - the account a permit was actually booked under
--
-- Operational status flow is now: pending_verification -> approved | rejected.
-- The cancellation/refund tables are left untouched so existing history stays
-- readable; new refunds are blocked in the API layer, not by dropping data.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Trek metadata
-- ----------------------------------------------------------------------------
alter table trek_pricing add column if not exists district             text;
alter table trek_pricing add column if not exists description          text;
alter table trek_pricing add column if not exists booking_instructions text;

-- ----------------------------------------------------------------------------
-- Bookable dates. A member may only pick a (trek, date) pair that exists here
-- and is open; the API enforces this too, so a tampered form cannot bypass it.
-- ----------------------------------------------------------------------------
do $$ begin
  create type trek_date_status as enum ('available', 'full', 'closed');
exception when duplicate_object then null; end $$;

create table if not exists trek_dates (
  id          uuid primary key default gen_random_uuid(),
  trek_id     uuid not null references trek_pricing(id) on delete cascade,
  trek_date   date not null,
  status      trek_date_status not null default 'available',
  -- Optional cap on total persons across all tickets for this date.
  max_persons int check (max_persons is null or max_persons > 0),
  notes       text,
  created_by  uuid references users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint uq_trek_date unique (trek_id, trek_date)
);
drop trigger if exists trg_trek_dates_updated on trek_dates;
create trigger trg_trek_dates_updated before update on trek_dates
  for each row execute function set_updated_at();

create index if not exists idx_trek_dates_lookup on trek_dates(trek_id, trek_date);
create index if not exists idx_trek_dates_open on trek_dates(trek_date) where status = 'available';

alter table trek_dates enable row level security;
drop policy if exists trek_dates_read on trek_dates;
create policy trek_dates_read on trek_dates for select using (true);
drop policy if exists trek_dates_write on trek_dates;
create policy trek_dates_write on trek_dates for all
  using (app_is_admin()) with check (app_is_admin());

-- ----------------------------------------------------------------------------
-- Announcements shown on the member dashboard
-- ----------------------------------------------------------------------------
do $$ begin
  create type announcement_priority as enum ('normal', 'important');
exception when duplicate_object then null; end $$;

create table if not exists announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(title) between 2 and 160),
  message    text not null check (char_length(message) between 2 and 4000),
  priority   announcement_priority not null default 'normal',
  is_active  boolean not null default true,
  -- Null start = live immediately; null end = never expires.
  starts_at  timestamptz,
  ends_at    timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_announcement_window check (ends_at is null or starts_at is null or ends_at > starts_at)
);
drop trigger if exists trg_announcements_updated on announcements;
create trigger trg_announcements_updated before update on announcements
  for each row execute function set_updated_at();

create index if not exists idx_announcements_live
  on announcements(is_active, starts_at, ends_at);

alter table announcements enable row level security;
drop policy if exists announcements_read on announcements;
create policy announcements_read on announcements for select using (true);
drop policy if exists announcements_write on announcements;
create policy announcements_write on announcements for all
  using (app_is_admin()) with check (app_is_admin());

-- ----------------------------------------------------------------------------
-- The account/name the permit was actually booked under on the official site.
-- ----------------------------------------------------------------------------
alter table tickets add column if not exists booking_account_name text;

-- ----------------------------------------------------------------------------
-- Rejected-document archive bookkeeping (the file is moved in Drive, not
-- deleted, so a rejection stays auditable).
-- ----------------------------------------------------------------------------
alter table ticket_documents add column if not exists rejected_at        timestamptz;
alter table ticket_documents add column if not exists rejected_file_id   text;
alter table ticket_documents add column if not exists rejected_folder_id text;

-- ----------------------------------------------------------------------------
-- Booking guidance shown by the member "How to Book" guide. Admin-editable, so
-- nothing here is hardcoded in the frontend.
-- ----------------------------------------------------------------------------
insert into settings (key, value) values (
  'booking_guide',
  '{
     "bookingUrl": "https://aranyavihara.karnataka.gov.in",
     "supportContact": "",
     "steps": [
       {"title": "Open the official booking website", "body": "Use the link below to open the official permit booking site."},
       {"title": "Sign up or log in", "body": "Register with your email and phone number, and complete OTP verification if the site asks for it."},
       {"title": "Select district, trek and date", "body": "Choose the same trek and date that are listed in this portal."},
       {"title": "Complete the booking", "body": "Pay the permit fee on the official site and confirm the booking."},
       {"title": "Download the permit", "body": "Save or screenshot the confirmation/permit document to your phone."},
       {"title": "Submit it here", "body": "Come back to this portal, click Add Ticket, fill in the booking details and upload the permit."}
     ],
     "importantNotes": [
       "Upload the original permit document - the Ticket ID and trek date must be clearly readable.",
       "Commission is credited only after an admin verifies the booking."
     ]
   }'::jsonb
) on conflict (key) do nothing;

-- Maximum persons selectable on the member form (the form renders a dropdown).
insert into settings (key, value) values ('max_persons_per_ticket', '10'::jsonb)
  on conflict (key) do nothing;

-- Cancellation/refund is retired operationally. The flag lets the API refuse new
-- refund records while leaving existing rows readable.
insert into settings (key, value) values ('refunds_enabled', 'false'::jsonb)
  on conflict (key) do update set value = 'false'::jsonb;
