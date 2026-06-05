-- ============================================================
-- add-stakeholder-sync-policy.sql
-- Run in Supabase SQL Editor ONCE.
-- Allows authenticated users to insert/update stakeholders.
-- Needed for Salesforce Contact -> Stakeholder sync.
-- ============================================================

grant insert, update on public.stakeholders to authenticated;

DO $$ BEGIN
  CREATE POLICY "authenticated can insert stakeholders"
    ON public.stakeholders FOR INSERT TO authenticated
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated can update stakeholders"
    ON public.stakeholders FOR UPDATE TO authenticated
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
