-- ============================================================
-- add-health-scores-insert-policy.sql
-- Run in Supabase SQL Editor ONCE.
-- Allows authenticated users to insert new health_scores rows
-- (needed when saving KPI data for a brand-new account).
-- ============================================================

DO $$ BEGIN
  CREATE POLICY "authenticated can insert health_scores"
    ON public.health_scores FOR INSERT TO authenticated
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
