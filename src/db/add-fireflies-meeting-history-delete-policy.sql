-- ============================================================
-- add-fireflies-meeting-history-delete-policy.sql
-- Run in Supabase SQL Editor ONCE after add-fireflies-secure-rls.sql.
-- Allows Head of KAM and assigned KAMs to delete Fireflies meeting
-- history and optionally the action/opportunity records generated
-- from those meetings. CEO remains view-only.
-- ============================================================

GRANT DELETE ON public.fireflies_meeting_summaries TO authenticated;
GRANT DELETE ON public.activity_rule_activities TO authenticated;
GRANT DELETE ON public.opportunities TO authenticated;

DROP POLICY IF EXISTS "secure delete fireflies meeting summaries"
  ON public.fireflies_meeting_summaries;
DROP POLICY IF EXISTS "secure delete activity rule activities"
  ON public.activity_rule_activities;
DROP POLICY IF EXISTS "secure delete opportunities"
  ON public.opportunities;

CREATE POLICY "secure delete fireflies meeting summaries"
  ON public.fireflies_meeting_summaries
  FOR DELETE
  TO authenticated
  USING (public.can_extract_fireflies_for_account(account_id));

CREATE POLICY "secure delete activity rule activities"
  ON public.activity_rule_activities
  FOR DELETE
  TO authenticated
  USING (
    public.can_extract_fireflies_for_account(account_id)
    AND source_type = 'fireflies_meeting'
  );

CREATE POLICY "secure delete opportunities"
  ON public.opportunities
  FOR DELETE
  TO authenticated
  USING (
    public.can_extract_fireflies_for_account(account_id)
    AND (id LIKE 'fireflies-opp-%' OR id LIKE 'llm-fireflies-opp-%')
  );

NOTIFY pgrst, 'reload schema';
