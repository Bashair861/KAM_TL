-- ============================================================
-- add-activity-threshold-overrides.sql
-- Run in Supabase SQL Editor ONCE after activity governance SQL.
-- Adds account-specific threshold and target-score overrides.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.activity_rule_threshold_overrides (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     text NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  rule_id        text NOT NULL,
  parameter      text NOT NULL,
  threshold      numeric NOT NULL,
  target_score   numeric NOT NULL DEFAULT 10,
  red_threshold  numeric,
  reason         text NOT NULL,
  approved_by    text,
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_threshold_valid_range
    CHECK (threshold >= 0 AND target_score > threshold AND target_score <= 100),
  CONSTRAINT activity_red_threshold_valid_range
    CHECK (red_threshold IS NULL OR (red_threshold >= 0 AND red_threshold <= threshold))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_rule_threshold_override_active
  ON public.activity_rule_threshold_overrides (account_id, rule_id)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_activity_rule_threshold_overrides_account
  ON public.activity_rule_threshold_overrides (account_id, active, updated_at DESC);

ALTER TABLE public.activity_rule_threshold_overrides ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "authenticated can read activity_rule_threshold_overrides"
    ON public.activity_rule_threshold_overrides FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated can insert activity_rule_threshold_overrides"
    ON public.activity_rule_threshold_overrides FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated can update activity_rule_threshold_overrides"
    ON public.activity_rule_threshold_overrides FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Example only. Replace account_id/rule_id/values with POD-approved thresholds.
-- INSERT INTO public.activity_rule_threshold_overrides
--   (account_id, rule_id, parameter, threshold, target_score, red_threshold, reason, approved_by)
-- VALUES
--   ('starlight', 'REL-01', 'Relationship', 8.8, 9.7, 7.4, 'Enterprise account needs stronger sponsor coverage.', 'Head of KAM')
-- ON CONFLICT (account_id, rule_id) WHERE active = true
-- DO UPDATE SET
--   threshold = EXCLUDED.threshold,
--   target_score = EXCLUDED.target_score,
--   red_threshold = EXCLUDED.red_threshold,
--   reason = EXCLUDED.reason,
--   approved_by = EXCLUDED.approved_by,
--   updated_at = now();
