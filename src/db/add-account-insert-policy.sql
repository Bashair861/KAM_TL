-- ============================================================
-- add-account-insert-policy.sql
-- Run in Supabase SQL Editor ONCE.
-- Adds INSERT policy on accounts table so Head of KAM can
-- create new accounts from the UI.
-- ============================================================

DO $$ BEGIN
  CREATE POLICY "authenticated can insert accounts"
    ON public.accounts FOR INSERT TO authenticated
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
