-- ============================================================================
-- Migration 0005: optional member two-factor (email OTP) + login-alert prefs
-- ============================================================================

-- Members can opt in to email-OTP 2FA (admins always have it).
alter table users add column if not exists email_2fa boolean not null default false;

-- Per-user toggle for "new login" alert emails.
alter table users add column if not exists login_alerts boolean not null default true;
