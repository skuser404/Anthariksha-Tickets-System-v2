-- ============================================================================
-- Migration 0006: add a "processing" refund status
-- Refund lifecycle is now: pending -> processing -> completed (all manual).
-- The app only RECORDS status; it never initiates or processes money.
-- ============================================================================

alter type refund_status add value if not exists 'processing' after 'pending';
