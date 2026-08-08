-- ============================================================================
-- Migration 0011: Permit documents stored in Google Drive
--   Ticket permits (PDF/JPG/PNG) live in Google Drive, not Supabase Storage.
--   This table is the system of record linking a ticket to its Drive object.
--
--   Version history: a replacement does NOT delete the old row. The previous
--   version is archived (is_current = false, archived_at set) so the audit
--   trail survives. Exactly one current document per ticket is enforced by a
--   partial unique index.
-- ============================================================================

create table if not exists ticket_documents (
  id                uuid primary key default gen_random_uuid(),
  ticket_id         uuid not null references tickets(id) on delete cascade,

  -- Google Drive linkage
  drive_file_id     text not null,
  drive_file_url    text not null,          -- webViewLink (preview in browser)
  drive_folder_id   text,
  drive_folder_url  text,

  -- File metadata
  file_name         text not null,
  mime_type         text not null,
  file_size         bigint not null check (file_size > 0),
  checksum          text,                   -- Drive md5Checksum, for duplicate detection

  -- Versioning
  version           int not null default 1 check (version > 0),
  is_current        boolean not null default true,
  archived_at       timestamptz,
  archived_by       uuid references users(id) on delete set null,
  replaced_reason   text,

  uploaded_by       uuid references users(id) on delete set null,
  uploaded_at       timestamptz not null default now()
);

create index if not exists idx_ticket_documents_ticket on ticket_documents(ticket_id, version desc);
create index if not exists idx_ticket_documents_checksum on ticket_documents(checksum) where checksum is not null;
create index if not exists idx_ticket_documents_file on ticket_documents(drive_file_id);

-- At most one live document per ticket; archived versions are unconstrained.
create unique index if not exists uq_ticket_documents_current
  on ticket_documents(ticket_id) where is_current;

alter table ticket_documents enable row level security;

-- Members read their own ticket's documents; admins read all.
drop policy if exists ticket_documents_select on ticket_documents;
create policy ticket_documents_select on ticket_documents for select
  using (app_is_admin() or exists (
    select 1 from tickets t where t.id = ticket_documents.ticket_id and t.member_id = app_current_user_id()
  ));

-- ----------------------------------------------------------------------------
-- Verification audit fields on the ticket itself.
-- `verified_by` / `verified_at` already exist (migration 0001); a rejection now
-- also records a mandatory reason.
-- ----------------------------------------------------------------------------
alter table tickets add column if not exists rejection_reason text;

-- ----------------------------------------------------------------------------
-- Google Drive configuration lives in the existing key/value settings table.
-- NOTE: only the folder id and non-secret status live here. The service-account
-- private key is read from the GOOGLE_DRIVE_CREDENTIALS env var and is never
-- written to the database.
-- ----------------------------------------------------------------------------
insert into settings (key, value)
values ('google_drive', '{"rootFolderId": null, "lastSyncAt": null, "lastSyncStatus": null}'::jsonb)
on conflict (key) do nothing;
