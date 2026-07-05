-- ============================================================================
-- Migration 0010: make member_financials respect the caller's RLS
--   Fixes the Supabase advisor "Security Definer View" warning. With
--   security_invoker = on, the view runs with the querying role's permissions
--   and RLS instead of the view owner's. The server uses the service-role key
--   (which bypasses RLS), so behaviour is unchanged for the app.
-- ============================================================================

alter view member_financials set (security_invoker = on);
