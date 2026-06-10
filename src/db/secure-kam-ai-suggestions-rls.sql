-- ============================================================
-- secure-kam-ai-suggestions-rls.sql
-- Run in Supabase SQL Editor after the AI/activity/task tables exist.
--
-- Security intent:
-- - CEO and Head of KAM can read all account-scoped KAM data.
-- - KAM can read/manage only accounts assigned through accounts.assigned_kam_id.
-- - Anonymous users cannot read or write sensitive KAM tables.
-- - AI request audit/rate-limit rows are user scoped.
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_app_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.id = auth.uid()
     OR lower(p.email) = lower(auth.jwt() ->> 'email')
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid()
     OR lower(p.email) = lower(auth.jwt() ->> 'email')
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.can_view_account(target_account_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.current_app_role() IN ('CEO', 'Head of KAM') THEN true
    WHEN public.current_app_role() = 'KAM' THEN EXISTS (
      SELECT 1
      FROM public.accounts a
      WHERE a.id = target_account_id
        AND a.assigned_kam_id = public.current_app_profile_id()
    )
    ELSE false
  END
$$;

CREATE OR REPLACE FUNCTION public.can_manage_account_activity(target_account_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.current_app_role() = 'Head of KAM' THEN true
    WHEN public.current_app_role() = 'KAM' THEN EXISTS (
      SELECT 1
      FROM public.accounts a
      WHERE a.id = target_account_id
        AND a.assigned_kam_id = public.current_app_profile_id()
    )
    ELSE false
  END
$$;

GRANT EXECUTE ON FUNCTION public.current_app_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_account(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_account_activity(text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.kam_ai_suggestion_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_id text NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  failure_category text,
  model text,
  suggestion_count int,
  security_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kam_ai_audit_event_type_check
    CHECK (event_type IN ('request_started', 'request_success', 'request_failed', 'request_fallback'))
);

CREATE INDEX IF NOT EXISTS kam_ai_audit_profile_account_created_idx
  ON public.kam_ai_suggestion_audit_logs(profile_id, account_id, created_at DESC);

ALTER TABLE public.kam_ai_suggestion_audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.kam_ai_suggestion_audit_logs FROM anon;
GRANT SELECT, INSERT ON public.kam_ai_suggestion_audit_logs TO authenticated;

DROP POLICY IF EXISTS "kam ai audit select own" ON public.kam_ai_suggestion_audit_logs;
CREATE POLICY "kam ai audit select own"
  ON public.kam_ai_suggestion_audit_logs
  FOR SELECT
  TO authenticated
  USING (profile_id = public.current_app_profile_id());

DROP POLICY IF EXISTS "kam ai audit insert own" ON public.kam_ai_suggestion_audit_logs;
CREATE POLICY "kam ai audit insert own"
  ON public.kam_ai_suggestion_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id = public.current_app_profile_id()
    AND public.can_view_account(account_id)
  );

-- No anonymous access to sensitive account-scoped AI/activity tables.
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.activity_ai_suggestions FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.tasks FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.opportunities FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.activity_score_history FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.activity_rule_activities FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.activity_rule_evidence FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.fireflies_meeting_summaries FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.accounts FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.stakeholders FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.health_scores FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.health_metrics FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.contract_details FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.activities FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.retention_growth FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.education_log FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.escalations FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.escalation_action_items FROM anon;

GRANT SELECT ON public.accounts, public.stakeholders, public.health_scores, public.health_metrics,
  public.contract_details, public.activities, public.retention_growth, public.education_log,
  public.escalations, public.escalation_action_items, public.tasks, public.opportunities,
  public.activity_score_history, public.activity_rule_activities, public.activity_rule_evidence,
  public.fireflies_meeting_summaries, public.activity_ai_suggestions
  TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.tasks, public.opportunities, public.activity_score_history,
  public.activity_rule_activities, public.activity_rule_evidence, public.fireflies_meeting_summaries,
  public.activity_ai_suggestions
  TO authenticated;

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stakeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retention_growth ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_rule_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_rule_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fireflies_meeting_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_ai_suggestions ENABLE ROW LEVEL SECURITY;

-- Drop broad policies created by earlier helper migrations.
DROP POLICY IF EXISTS "public read" ON public.accounts;
DROP POLICY IF EXISTS "secure read accounts" ON public.accounts;

DROP POLICY IF EXISTS "tasks: public read" ON public.tasks;
DROP POLICY IF EXISTS "tasks: authenticated insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks: authenticated update" ON public.tasks;
DROP POLICY IF EXISTS "tasks: authenticated delete" ON public.tasks;
DROP POLICY IF EXISTS "tasks select" ON public.tasks;
DROP POLICY IF EXISTS "tasks insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks update" ON public.tasks;
DROP POLICY IF EXISTS "tasks delete" ON public.tasks;

DROP POLICY IF EXISTS "public read" ON public.opportunities;
DROP POLICY IF EXISTS "app can write opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "secure read opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "secure insert opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "secure update opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "opportunities select" ON public.opportunities;
DROP POLICY IF EXISTS "opportunities insert" ON public.opportunities;
DROP POLICY IF EXISTS "opportunities update" ON public.opportunities;
DROP POLICY IF EXISTS "opportunities delete" ON public.opportunities;

DROP POLICY IF EXISTS "authenticated can read activity_score_history" ON public.activity_score_history;
DROP POLICY IF EXISTS "authenticated can insert activity_score_history" ON public.activity_score_history;
DROP POLICY IF EXISTS "authenticated can update activity_score_history" ON public.activity_score_history;
DROP POLICY IF EXISTS "activity_score_history select" ON public.activity_score_history;
DROP POLICY IF EXISTS "activity_score_history insert" ON public.activity_score_history;
DROP POLICY IF EXISTS "activity_score_history update" ON public.activity_score_history;
DROP POLICY IF EXISTS "activity_score_history delete" ON public.activity_score_history;

DROP POLICY IF EXISTS "authenticated can read activity_rule_activities" ON public.activity_rule_activities;
DROP POLICY IF EXISTS "authenticated can insert activity_rule_activities" ON public.activity_rule_activities;
DROP POLICY IF EXISTS "authenticated can update activity_rule_activities" ON public.activity_rule_activities;
DROP POLICY IF EXISTS "secure read activity rule activities" ON public.activity_rule_activities;
DROP POLICY IF EXISTS "secure insert activity rule activities" ON public.activity_rule_activities;
DROP POLICY IF EXISTS "secure update activity rule activities" ON public.activity_rule_activities;
DROP POLICY IF EXISTS "app can write activity_rule_activities" ON public.activity_rule_activities;

DROP POLICY IF EXISTS "authenticated can read activity_rule_evidence" ON public.activity_rule_evidence;
DROP POLICY IF EXISTS "authenticated can insert activity_rule_evidence" ON public.activity_rule_evidence;
DROP POLICY IF EXISTS "authenticated can update activity_rule_evidence" ON public.activity_rule_evidence;

DROP POLICY IF EXISTS "authenticated can read fireflies_meeting_summaries" ON public.fireflies_meeting_summaries;
DROP POLICY IF EXISTS "authenticated can insert fireflies_meeting_summaries" ON public.fireflies_meeting_summaries;
DROP POLICY IF EXISTS "authenticated can update fireflies_meeting_summaries" ON public.fireflies_meeting_summaries;
DROP POLICY IF EXISTS "secure read fireflies meeting summaries" ON public.fireflies_meeting_summaries;
DROP POLICY IF EXISTS "secure insert fireflies meeting summaries" ON public.fireflies_meeting_summaries;
DROP POLICY IF EXISTS "secure update fireflies meeting summaries" ON public.fireflies_meeting_summaries;

DROP POLICY IF EXISTS "activity ai suggestions read" ON public.activity_ai_suggestions;
DROP POLICY IF EXISTS "activity ai suggestions insert" ON public.activity_ai_suggestions;
DROP POLICY IF EXISTS "activity ai suggestions update" ON public.activity_ai_suggestions;
DROP POLICY IF EXISTS "activity ai suggestions delete" ON public.activity_ai_suggestions;

DROP POLICY IF EXISTS "secure read accounts" ON public.accounts;
DROP POLICY IF EXISTS "secure read stakeholders" ON public.stakeholders;
DROP POLICY IF EXISTS "secure read health scores" ON public.health_scores;
DROP POLICY IF EXISTS "secure read health metrics" ON public.health_metrics;
DROP POLICY IF EXISTS "secure read contract details" ON public.contract_details;
DROP POLICY IF EXISTS "secure read activities" ON public.activities;
DROP POLICY IF EXISTS "secure read retention growth" ON public.retention_growth;
DROP POLICY IF EXISTS "secure read education log" ON public.education_log;
DROP POLICY IF EXISTS "secure read escalations" ON public.escalations;
DROP POLICY IF EXISTS "secure read escalation action items" ON public.escalation_action_items;
DROP POLICY IF EXISTS "secure read tasks" ON public.tasks;
DROP POLICY IF EXISTS "secure insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "secure update tasks" ON public.tasks;
DROP POLICY IF EXISTS "secure delete tasks" ON public.tasks;
DROP POLICY IF EXISTS "secure read opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "secure insert opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "secure update opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "secure delete opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "secure read activity score history" ON public.activity_score_history;
DROP POLICY IF EXISTS "secure insert activity score history" ON public.activity_score_history;
DROP POLICY IF EXISTS "secure update activity score history" ON public.activity_score_history;
DROP POLICY IF EXISTS "secure delete activity score history" ON public.activity_score_history;
DROP POLICY IF EXISTS "secure read activity rule activities" ON public.activity_rule_activities;
DROP POLICY IF EXISTS "secure insert activity rule activities" ON public.activity_rule_activities;
DROP POLICY IF EXISTS "secure update activity rule activities" ON public.activity_rule_activities;
DROP POLICY IF EXISTS "secure delete activity rule activities" ON public.activity_rule_activities;
DROP POLICY IF EXISTS "secure read activity rule evidence" ON public.activity_rule_evidence;
DROP POLICY IF EXISTS "secure insert activity rule evidence" ON public.activity_rule_evidence;
DROP POLICY IF EXISTS "secure update activity rule evidence" ON public.activity_rule_evidence;
DROP POLICY IF EXISTS "secure delete activity rule evidence" ON public.activity_rule_evidence;
DROP POLICY IF EXISTS "secure read fireflies meeting summaries" ON public.fireflies_meeting_summaries;
DROP POLICY IF EXISTS "secure insert fireflies meeting summaries" ON public.fireflies_meeting_summaries;
DROP POLICY IF EXISTS "secure update fireflies meeting summaries" ON public.fireflies_meeting_summaries;
DROP POLICY IF EXISTS "secure delete fireflies meeting summaries" ON public.fireflies_meeting_summaries;
DROP POLICY IF EXISTS "secure read activity ai suggestions" ON public.activity_ai_suggestions;
DROP POLICY IF EXISTS "secure insert activity ai suggestions" ON public.activity_ai_suggestions;
DROP POLICY IF EXISTS "secure update activity ai suggestions" ON public.activity_ai_suggestions;
DROP POLICY IF EXISTS "secure delete activity ai suggestions" ON public.activity_ai_suggestions;

-- Read policies.
CREATE POLICY "secure read accounts"
  ON public.accounts FOR SELECT TO authenticated
  USING (public.can_view_account(id));

CREATE POLICY "secure read stakeholders"
  ON public.stakeholders FOR SELECT TO authenticated
  USING (public.can_view_account(account_id));

CREATE POLICY "secure read health scores"
  ON public.health_scores FOR SELECT TO authenticated
  USING (public.can_view_account(account_id));

CREATE POLICY "secure read health metrics"
  ON public.health_metrics FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.health_scores hs
      WHERE hs.id = health_score_id
        AND public.can_view_account(hs.account_id)
    )
  );

CREATE POLICY "secure read contract details"
  ON public.contract_details FOR SELECT TO authenticated
  USING (public.can_view_account(account_id));

CREATE POLICY "secure read activities"
  ON public.activities FOR SELECT TO authenticated
  USING (public.can_view_account(account_id));

CREATE POLICY "secure read retention growth"
  ON public.retention_growth FOR SELECT TO authenticated
  USING (public.can_view_account(account_id));

CREATE POLICY "secure read education log"
  ON public.education_log FOR SELECT TO authenticated
  USING (public.can_view_account(account_id));

CREATE POLICY "secure read escalations"
  ON public.escalations FOR SELECT TO authenticated
  USING (public.can_view_account(account_id));

CREATE POLICY "secure read escalation action items"
  ON public.escalation_action_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.escalations e
      WHERE e.id = escalation_id
        AND public.can_view_account(e.account_id)
    )
  );

CREATE POLICY "secure read tasks"
  ON public.tasks FOR SELECT TO authenticated
  USING (account_id IS NULL OR public.can_view_account(account_id));

CREATE POLICY "secure read opportunities"
  ON public.opportunities FOR SELECT TO authenticated
  USING (public.can_view_account(account_id));

CREATE POLICY "secure read activity score history"
  ON public.activity_score_history FOR SELECT TO authenticated
  USING (public.can_view_account(account_id));

CREATE POLICY "secure read activity rule activities"
  ON public.activity_rule_activities FOR SELECT TO authenticated
  USING (public.can_view_account(account_id));

CREATE POLICY "secure read activity rule evidence"
  ON public.activity_rule_evidence FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.activity_rule_activities a
      WHERE a.id = rule_activity_id
        AND public.can_view_account(a.account_id)
    )
  );

CREATE POLICY "secure read fireflies meeting summaries"
  ON public.fireflies_meeting_summaries FOR SELECT TO authenticated
  USING (public.can_view_account(account_id));

CREATE POLICY "secure read activity ai suggestions"
  ON public.activity_ai_suggestions FOR SELECT TO authenticated
  USING (public.can_view_account(account_id));

-- Write policies.
CREATE POLICY "secure insert tasks"
  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (account_id IS NULL OR public.can_manage_account_activity(account_id));

CREATE POLICY "secure update tasks"
  ON public.tasks FOR UPDATE TO authenticated
  USING (account_id IS NULL OR public.can_manage_account_activity(account_id))
  WITH CHECK (account_id IS NULL OR public.can_manage_account_activity(account_id));

CREATE POLICY "secure delete tasks"
  ON public.tasks FOR DELETE TO authenticated
  USING (account_id IS NULL OR public.can_manage_account_activity(account_id));

CREATE POLICY "secure insert opportunities"
  ON public.opportunities FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_account_activity(account_id));

CREATE POLICY "secure update opportunities"
  ON public.opportunities FOR UPDATE TO authenticated
  USING (public.can_manage_account_activity(account_id))
  WITH CHECK (public.can_manage_account_activity(account_id));

CREATE POLICY "secure delete opportunities"
  ON public.opportunities FOR DELETE TO authenticated
  USING (public.can_manage_account_activity(account_id));

CREATE POLICY "secure insert activity score history"
  ON public.activity_score_history FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_account_activity(account_id));

CREATE POLICY "secure update activity score history"
  ON public.activity_score_history FOR UPDATE TO authenticated
  USING (public.can_manage_account_activity(account_id))
  WITH CHECK (public.can_manage_account_activity(account_id));

CREATE POLICY "secure delete activity score history"
  ON public.activity_score_history FOR DELETE TO authenticated
  USING (public.can_manage_account_activity(account_id));

CREATE POLICY "secure insert activity rule activities"
  ON public.activity_rule_activities FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_account_activity(account_id));

CREATE POLICY "secure update activity rule activities"
  ON public.activity_rule_activities FOR UPDATE TO authenticated
  USING (public.can_manage_account_activity(account_id))
  WITH CHECK (public.can_manage_account_activity(account_id));

CREATE POLICY "secure delete activity rule activities"
  ON public.activity_rule_activities FOR DELETE TO authenticated
  USING (public.can_manage_account_activity(account_id));

CREATE POLICY "secure insert activity rule evidence"
  ON public.activity_rule_evidence FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.activity_rule_activities a
      WHERE a.id = rule_activity_id
        AND public.can_manage_account_activity(a.account_id)
    )
  );

CREATE POLICY "secure update activity rule evidence"
  ON public.activity_rule_evidence FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.activity_rule_activities a
      WHERE a.id = rule_activity_id
        AND public.can_manage_account_activity(a.account_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.activity_rule_activities a
      WHERE a.id = rule_activity_id
        AND public.can_manage_account_activity(a.account_id)
    )
  );

CREATE POLICY "secure delete activity rule evidence"
  ON public.activity_rule_evidence FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.activity_rule_activities a
      WHERE a.id = rule_activity_id
        AND public.can_manage_account_activity(a.account_id)
    )
  );

CREATE POLICY "secure insert fireflies meeting summaries"
  ON public.fireflies_meeting_summaries FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_account_activity(account_id));

CREATE POLICY "secure update fireflies meeting summaries"
  ON public.fireflies_meeting_summaries FOR UPDATE TO authenticated
  USING (public.can_manage_account_activity(account_id))
  WITH CHECK (public.can_manage_account_activity(account_id));

CREATE POLICY "secure delete fireflies meeting summaries"
  ON public.fireflies_meeting_summaries FOR DELETE TO authenticated
  USING (public.can_manage_account_activity(account_id));

CREATE POLICY "secure insert activity ai suggestions"
  ON public.activity_ai_suggestions FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_account_activity(account_id)
    AND (requested_by IS NULL OR requested_by = public.current_app_profile_id()::text)
  );

CREATE POLICY "secure update activity ai suggestions"
  ON public.activity_ai_suggestions FOR UPDATE TO authenticated
  USING (public.can_manage_account_activity(account_id))
  WITH CHECK (public.can_manage_account_activity(account_id));

CREATE POLICY "secure delete activity ai suggestions"
  ON public.activity_ai_suggestions FOR DELETE TO authenticated
  USING (public.can_manage_account_activity(account_id));

DO $$
BEGIN
  IF to_regclass('public.ai_insights') IS NULL THEN
    RAISE NOTICE 'Skipping ai_insights RLS hardening because public.ai_insights does not exist.';
  ELSE
    REVOKE SELECT, INSERT, UPDATE, DELETE ON public.ai_insights FROM anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_insights TO authenticated;
    ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "ai insights read" ON public.ai_insights;
    DROP POLICY IF EXISTS "ai insights insert" ON public.ai_insights;
    DROP POLICY IF EXISTS "ai insights update" ON public.ai_insights;
    DROP POLICY IF EXISTS "ai insights delete" ON public.ai_insights;
    DROP POLICY IF EXISTS "secure read ai insights" ON public.ai_insights;
    DROP POLICY IF EXISTS "secure insert ai insights" ON public.ai_insights;
    DROP POLICY IF EXISTS "secure update ai insights" ON public.ai_insights;
    DROP POLICY IF EXISTS "secure delete ai insights" ON public.ai_insights;

    CREATE POLICY "secure read ai insights"
      ON public.ai_insights FOR SELECT TO authenticated
      USING (account_id IS NULL OR public.can_view_account(account_id));

    CREATE POLICY "secure insert ai insights"
      ON public.ai_insights FOR INSERT TO authenticated
      WITH CHECK (
        account_id IS NULL OR public.can_manage_account_activity(account_id)
      );

    CREATE POLICY "secure update ai insights"
      ON public.ai_insights FOR UPDATE TO authenticated
      USING (account_id IS NULL OR public.can_manage_account_activity(account_id))
      WITH CHECK (account_id IS NULL OR public.can_manage_account_activity(account_id));

    CREATE POLICY "secure delete ai insights"
      ON public.ai_insights FOR DELETE TO authenticated
      USING (account_id IS NULL OR public.can_manage_account_activity(account_id));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
