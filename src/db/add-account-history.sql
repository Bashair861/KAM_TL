-- ============================================================
-- add-account-history.sql
-- Run in Supabase SQL Editor ONCE.
-- Creates audit log table for account field changes.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.account_history (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id text        REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  field_name text        NOT NULL,
  old_value  text,
  new_value  text,
  edited_by  text        NOT NULL,
  edited_at  timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.account_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "authenticated can read account_history"
    ON public.account_history FOR SELECT TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated can insert account_history"
    ON public.account_history FOR INSERT TO authenticated
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
