-- ============================================================================
-- Migration 0008: Super-Admin tier + profile photos
--   Super-admin is modelled as an admin with is_super = true (keeps the existing
--   admin/member role checks intact while adding a privileged tier).
-- ============================================================================

alter table users add column if not exists is_super   boolean not null default false;
alter table users add column if not exists avatar_url  text;

-- Promote the default seeded admin to super-admin (idempotent; safe if absent).
update users set is_super = true where email = 'admin@antariksha.test' and role = 'admin';

-- Public bucket for avatars (small images; signed-upload flow from the API).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;
