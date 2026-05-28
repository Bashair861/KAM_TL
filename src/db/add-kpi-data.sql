-- ============================================================
-- add-kpi-data.sql
-- Run in Supabase SQL Editor ONCE.
-- Adds kpi_data (checkbox state) to health_scores.
-- Adds UPDATE policies for health_scores + health_metrics.
-- ============================================================

-- 1. Add kpi_data column to health_scores
ALTER TABLE public.health_scores
  ADD COLUMN IF NOT EXISTS kpi_data jsonb;

-- 2. RLS UPDATE policies (safe to re-run)
DO $$ BEGIN
  CREATE POLICY "authenticated can update health_scores"
    ON public.health_scores FOR UPDATE TO authenticated
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "authenticated can update health_metrics"
    ON public.health_metrics FOR UPDATE TO authenticated
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
