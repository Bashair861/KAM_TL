-- ============================================================
-- add-fireflies-meeting-history.sql
-- Run in Supabase SQL Editor ONCE.
-- Persists Fireflies meeting summaries per account and keeps the
-- sync idempotent by transcript id.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fireflies_meeting_summaries (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id               text NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  fireflies_transcript_id   text NOT NULL,
  title                    text NOT NULL,
  meeting_date             timestamptz,
  transcript_url           text,
  participants             text[] NOT NULL DEFAULT '{}',
  attendees                jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary                  jsonb NOT NULL DEFAULT '{}'::jsonb,
  overview                 text,
  short_summary            text,
  action_items             text,
  derived_action_items     jsonb NOT NULL DEFAULT '[]'::jsonb,
  derived_opportunities    jsonb NOT NULL DEFAULT '[]'::jsonb,
  agent_diagnostics        jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_query             jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at                timestamptz NOT NULL DEFAULT now(),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, fireflies_transcript_id)
);

ALTER TABLE public.fireflies_meeting_summaries
  ADD COLUMN IF NOT EXISTS derived_opportunities jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_fireflies_meeting_summaries_account_date
  ON public.fireflies_meeting_summaries (account_id, meeting_date DESC NULLS LAST, synced_at DESC);

ALTER TABLE public.fireflies_meeting_summaries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "authenticated can read fireflies_meeting_summaries"
    ON public.fireflies_meeting_summaries FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated can insert fireflies_meeting_summaries"
    ON public.fireflies_meeting_summaries FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated can update fireflies_meeting_summaries"
    ON public.fireflies_meeting_summaries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
