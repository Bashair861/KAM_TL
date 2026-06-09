-- ============================================================
-- add-stakeholder-delete-policy.sql
-- Run in Supabase SQL Editor ONCE if RLS is enabled.
-- Allows authenticated users to delete stakeholders from the
-- account Overview Stakeholders section.
-- ============================================================

grant delete on public.stakeholders to authenticated;

DO $$ BEGIN
  CREATE POLICY "authenticated can delete stakeholders"
    ON public.stakeholders FOR DELETE TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
