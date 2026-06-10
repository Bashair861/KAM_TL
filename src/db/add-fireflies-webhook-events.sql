-- ============================================================
-- add-fireflies-webhook-events.sql
-- Run in Supabase SQL Editor once.
-- Persists Fireflies webhook diagnostics when a transcript cannot
-- be matched to an account, so meetings do not disappear silently.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fireflies_webhook_events (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fireflies_transcript_id   text,
  event_type               text NOT NULL DEFAULT 'meeting_ready',
  status                   text NOT NULL DEFAULT 'received',
  matched_account_id       text REFERENCES public.accounts(id) ON DELETE SET NULL,
  match_score              numeric,
  title                    text,
  payload                  jsonb NOT NULL DEFAULT '{}'::jsonb,
  diagnostics              jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message            text,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fireflies_webhook_events_transcript
  ON public.fireflies_webhook_events (fireflies_transcript_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fireflies_webhook_events_status
  ON public.fireflies_webhook_events (status, created_at DESC);

ALTER TABLE public.fireflies_webhook_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.fireflies_webhook_events TO authenticated;

DO $$ BEGIN
  CREATE POLICY "authenticated can read fireflies webhook events"
    ON public.fireflies_webhook_events
    FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
