-- ============================================================
-- add-account-linkedin-url.sql
-- Run in Supabase SQL Editor ONCE.
-- Adds an account-level LinkedIn URL field used by Salesforce sync.
-- ============================================================

alter table public.accounts
  add column if not exists linkedin_url text;
