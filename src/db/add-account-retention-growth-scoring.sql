-- ============================================================
-- add-account-retention-growth-scoring.sql
-- Run in Supabase SQL Editor ONCE.
-- Adds account-level calculated retention/growth scoring fields.
-- The app calculates these from account scores, renewals, Fireflies
-- opportunities, escalations, whitespace, and service data.
-- ============================================================

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS retention_health_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calculated_retention_risk public.retention_risk NOT NULL DEFAULT 'Low',
  ADD COLUMN IF NOT EXISTS growth_potential_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS growth_potential_level text NOT NULL DEFAULT 'Low',
  ADD COLUMN IF NOT EXISTS revenue_at_risk bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS growth_pipeline_value bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retention_growth_quadrant text,
  ADD COLUMN IF NOT EXISTS retention_growth_next_action text,
  ADD COLUMN IF NOT EXISTS retention_growth_calculated_at timestamptz,
  ADD COLUMN IF NOT EXISTS retention_growth_calculation_reason jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_accounts_calculated_retention_risk
  ON public.accounts (calculated_retention_risk);

CREATE INDEX IF NOT EXISTS idx_accounts_growth_potential_level
  ON public.accounts (growth_potential_level);

CREATE INDEX IF NOT EXISTS idx_accounts_retention_growth_calculated_at
  ON public.accounts (retention_growth_calculated_at DESC);
