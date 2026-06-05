-- ============================================================
-- add-contract-details-write-policy.sql
-- Run in Supabase SQL Editor ONCE if contract_details RLS blocks
-- SOW uploads or contract detail updates from authenticated users.
-- ============================================================

GRANT SELECT, INSERT, UPDATE ON public.contract_details TO authenticated;

DO $$ BEGIN
  CREATE POLICY "authenticated can read contract_details"
    ON public.contract_details FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated can insert contract_details"
    ON public.contract_details FOR INSERT TO authenticated
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated can update contract_details"
    ON public.contract_details FOR UPDATE TO authenticated
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
