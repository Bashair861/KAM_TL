-- ============================================================
-- add-activity-scoring-governance.sql
-- Run in Supabase SQL Editor ONCE.
-- Adds persistence for the Global Activity Rule Matrix:
--   1) score history for trend/velocity triggers
--   2) generated rule activities with activity-score stage tracking
--   3) evidence submission/review for parameter score lift
-- ============================================================

-- 1. Extend activity_area so generated activities can be persisted.
ALTER TYPE public.activity_area ADD VALUE IF NOT EXISTS 'KYC';
ALTER TYPE public.activity_area ADD VALUE IF NOT EXISTS 'Health';
ALTER TYPE public.activity_area ADD VALUE IF NOT EXISTS 'Risk';
ALTER TYPE public.activity_area ADD VALUE IF NOT EXISTS 'Escalation';
ALTER TYPE public.activity_area ADD VALUE IF NOT EXISTS 'Growth';
ALTER TYPE public.activity_area ADD VALUE IF NOT EXISTS 'Retention';
ALTER TYPE public.activity_area ADD VALUE IF NOT EXISTS 'CSAT';

-- 2. Governance enums.
DO $$ BEGIN
  CREATE TYPE public.activity_rule_status AS ENUM (
    'Generated',
    'Accepted',
    'Planned',
    'Completed',
    'Evidence Submitted',
    'Validated',
    'Rejected',
    'Closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.evidence_quality AS ENUM (
    'Meeting note only',
    'Action tracker plus note',
    'Completed action plus outcome proof'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.evidence_review_status AS ENUM (
    'Pending',
    'Partial',
    'Approved',
    'Rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Monthly score snapshots for trend and velocity triggers.
CREATE TABLE IF NOT EXISTS public.activity_score_history (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     text NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  parameter      text NOT NULL,
  metric         text,
  score          numeric NOT NULL,
  snapshot_month date NOT NULL,
  source         text NOT NULL DEFAULT 'score_snapshot',
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, parameter, metric, snapshot_month)
);

CREATE INDEX IF NOT EXISTS idx_activity_score_history_account_parameter
  ON public.activity_score_history (account_id, parameter, snapshot_month DESC);

-- 4. Persist generated/accepted rule activities.
CREATE TABLE IF NOT EXISTS public.activity_rule_activities (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id             text NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  source_activity_id      text REFERENCES public.activities(id) ON DELETE SET NULL,
  rule_id                text NOT NULL,
  parameter              text NOT NULL,
  impacted_metric         text NOT NULL,
  title                  text NOT NULL,
  next_step              text,
  owner                  text,
  due_date               date,
  rag                    public.rag_status NOT NULL DEFAULT 'A',
  status                 public.activity_rule_status NOT NULL DEFAULT 'Generated',
  activity_score_pct      numeric NOT NULL DEFAULT 0 CHECK (activity_score_pct >= 0 AND activity_score_pct <= 100),
  weak_signal             text,
  current_value           text,
  target_value            text,
  expected_lift           text,
  success_criteria        text,
  evidence_required       text[],
  trigger_logic           jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_lift_policy    jsonb NOT NULL DEFAULT '[]'::jsonb,
  activity_score_logic    jsonb NOT NULL DEFAULT '[]'::jsonb,
  approval_sla            jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_cadence          jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_type             text,
  source_ref              text,
  generated_at            timestamptz NOT NULL DEFAULT now(),
  accepted_at             timestamptz,
  planned_at              timestamptz,
  completed_at            timestamptz,
  evidence_submitted_at   timestamptz,
  validated_at            timestamptz,
  closed_at               timestamptz,
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_rule_activities_account_status
  ON public.activity_rule_activities (account_id, status, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_rule_activities_rule
  ON public.activity_rule_activities (rule_id, parameter);

-- Avoid duplicate active suggestions from the same rule/source pair.
CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_rule_active_source
  ON public.activity_rule_activities (account_id, rule_id, COALESCE(source_ref, 'manual'))
  WHERE status NOT IN ('Rejected', 'Closed');

-- 5. Evidence submissions and reviewer decisions.
CREATE TABLE IF NOT EXISTS public.activity_rule_evidence (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_activity_id       uuid NOT NULL REFERENCES public.activity_rule_activities(id) ON DELETE CASCADE,
  submitted_by           text NOT NULL,
  evidence_quality       public.evidence_quality NOT NULL,
  review_status          public.evidence_review_status NOT NULL DEFAULT 'Pending',
  title                  text NOT NULL,
  notes                  text,
  artifact_url            text,
  checklist              jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_lift          text,
  approved_lift           text,
  reviewer                text,
  rejection_reason        text,
  submitted_at            timestamptz NOT NULL DEFAULT now(),
  reviewed_at             timestamptz,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rejected_evidence_needs_reason
    CHECK (review_status <> 'Rejected' OR NULLIF(trim(rejection_reason), '') IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_activity_rule_evidence_activity
  ON public.activity_rule_evidence (rule_activity_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_rule_evidence_review_status
  ON public.activity_rule_evidence (review_status, submitted_at DESC);

-- 6. Lightweight checklist reference for evidence quality.
CREATE TABLE IF NOT EXISTS public.activity_evidence_quality_checklist (
  evidence_quality public.evidence_quality PRIMARY KEY,
  required_checks   text[] NOT NULL,
  lift_policy       text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.activity_evidence_quality_checklist
  (evidence_quality, required_checks, lift_policy)
VALUES
  (
    'Meeting note only',
    ARRAY['Meeting title/date is present', 'Action is explicit', 'Account/client context is present', 'Owner or next step is mentioned'],
    'Minimum eligible lift only'
  ),
  (
    'Action tracker plus note',
    ARRAY['Meeting note is present', 'Owner is assigned', 'Due date is assigned', 'Action tracker or task reference is present'],
    'Mid-range eligible lift'
  ),
  (
    'Completed action plus outcome proof',
    ARRAY['Completion evidence is present', 'Outcome/result is documented', 'Client or internal validation exists', 'Reviewer can tie outcome to impacted metric'],
    'Maximum eligible lift'
  )
ON CONFLICT (evidence_quality) DO UPDATE
SET required_checks = EXCLUDED.required_checks,
    lift_policy = EXCLUDED.lift_policy;

-- 7. RLS policies. Current app uses broad authenticated access like existing helper migrations.
ALTER TABLE public.activity_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_rule_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_rule_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_evidence_quality_checklist ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "authenticated can read activity_score_history"
    ON public.activity_score_history FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated can insert activity_score_history"
    ON public.activity_score_history FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated can read activity_rule_activities"
    ON public.activity_rule_activities FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated can insert activity_rule_activities"
    ON public.activity_rule_activities FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated can update activity_rule_activities"
    ON public.activity_rule_activities FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated can read activity_rule_evidence"
    ON public.activity_rule_evidence FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated can insert activity_rule_evidence"
    ON public.activity_rule_evidence FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated can update activity_rule_evidence"
    ON public.activity_rule_evidence FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated can read activity_evidence_quality_checklist"
    ON public.activity_evidence_quality_checklist FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
