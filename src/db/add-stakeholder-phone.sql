-- ============================================================
-- add-stakeholder-phone.sql
-- Run in Supabase SQL Editor ONCE.
-- Adds phone storage for Salesforce Contact -> Stakeholder sync
-- and manual stakeholder create/edit in the account Overview tab.
-- ============================================================

alter table public.stakeholders
  add column if not exists phone text;
