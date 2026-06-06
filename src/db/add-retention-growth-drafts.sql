-- ============================================================
-- add-retention-growth-drafts.sql
-- Run in Supabase SQL Editor once.
-- Persists Retention VS Growth draft plans/offers so they survive
-- browser refresh and can be reviewed later.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.retention_growth_drafts (
  id                    text PRIMARY KEY,
  account_id            text NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  kind                  text NOT NULL CHECK (kind IN ('plan', 'offer')),
  title                 text NOT NULL,
  owner                 text,
  due_date              text,
  next_step             text,
  potential_value_label text,
  reason                text,
  evidence              jsonb NOT NULL DEFAULT '[]'::jsonb,
  offer_type            text,
  approval_state        text,
  created_by            text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retention_growth_drafts_account_created
  ON public.retention_growth_drafts (account_id, created_at DESC);

ALTER TABLE public.retention_growth_drafts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.retention_growth_drafts TO authenticated;

DO $$ BEGIN
  CREATE POLICY "authenticated can read retention growth drafts"
    ON public.retention_growth_drafts
    FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated can insert retention growth drafts"
    ON public.retention_growth_drafts
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated can update retention growth drafts"
    ON public.retention_growth_drafts
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
