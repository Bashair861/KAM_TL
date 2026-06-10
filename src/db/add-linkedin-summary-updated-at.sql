-- ============================================================
-- add-linkedin-summary-updated-at.sql
-- Run in Supabase SQL Editor ONCE.
-- Tracks when the AI-generated account LinkedIn summary was last updated.
-- ============================================================

alter table public.accounts
  add column if not exists linkedin_summary_updated_at timestamptz;

notify pgrst, 'reload schema';
