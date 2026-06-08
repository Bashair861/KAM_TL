-- ============================================================
-- add-linkedin-summary.sql
-- Run in Supabase SQL Editor ONCE.
-- Adds an AI-generated account-level LinkedIn summary field.
-- ============================================================

alter table public.accounts
  add column if not exists linkedin_summary text;

notify pgrst, 'reload schema';
