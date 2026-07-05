-- ============================================================================
-- Migration 0003: Reference seed data (trek pricing + app settings)
-- User accounts + sample tickets are seeded by the Node script
-- (server/scripts/seed.ts) so passwords get correctly bcrypt-hashed.
-- ============================================================================

insert into trek_pricing (name, permit_price) values
  ('Kudremukh',           575),
  ('Netravati',           500),
  ('Bandaje Falls',       500),
  ('Kurinjal',            500),
  ('Gangadikal',          500),
  ('Narasimha Parvatha',  500)
on conflict (name) do nothing;

insert into settings (key, value) values
  ('commission_per_person', '50'::jsonb),
  ('refund_window',         '{"full_days":7,"half_days":4,"refund_lead_days":30}'::jsonb),
  ('org',                   '{"name":"Antariksha Trek Operations","booking_site":"Aranya Vihara"}'::jsonb)
on conflict (key) do update set value = excluded.value;
