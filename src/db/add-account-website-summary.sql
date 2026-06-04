-- ============================================================
-- add-account-website-summary.sql
-- Run in Supabase SQL Editor ONCE.
-- Adds website URL + AI-generated website summary fields to accounts.
-- ============================================================

alter table public.accounts
  add column if not exists website_url text,
  add column if not exists website_summary text,
  add column if not exists website_summary_updated_at timestamptz;

notify pgrst, 'reload schema';
