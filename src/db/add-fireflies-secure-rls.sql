-- ============================================================
-- add-fireflies-secure-rls.sql
-- Run in Supabase SQL Editor ONCE after Fireflies tables exist.
-- Fireflies extraction security:
--   CEO: read-only
--   Head of KAM: can extract/sync for all accounts
--   KAM: can extract/sync only assigned accounts
-- Server webhook/cron should use SUPABASE_SERVICE_ROLE_KEY and bypass RLS.
-- ============================================================

-- 1. Helper functions used by RLS policies.
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

CREATE OR REPLACE FUNCTION public.can_extract_fireflies_for_account(target_account_id text)
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
GRANT EXECUTE ON FUNCTION public.can_extract_fireflies_for_account(text) TO authenticated;

-- 2. Grants: no anonymous writes. Authenticated users still pass RLS checks.
REVOKE INSERT, UPDATE, DELETE ON public.fireflies_meeting_summaries FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.activity_rule_activities FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.opportunities FROM anon;
REVOKE UPDATE ON public.accounts FROM anon;

GRANT SELECT ON public.fireflies_meeting_summaries TO authenticated;
GRANT INSERT, UPDATE ON public.fireflies_meeting_summaries TO authenticated;
GRANT SELECT ON public.activity_rule_activities TO authenticated;
GRANT INSERT, UPDATE ON public.activity_rule_activities TO authenticated;
GRANT SELECT ON public.opportunities TO authenticated;
GRANT INSERT, UPDATE ON public.opportunities TO authenticated;
GRANT SELECT, UPDATE ON public.accounts TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;

-- 3. Enable RLS on Fireflies-related write targets.
ALTER TABLE public.fireflies_meeting_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_rule_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Drop broad/old policies that allowed generic writes.
DROP POLICY IF EXISTS "authenticated can read fireflies_meeting_summaries"
  ON public.fireflies_meeting_summaries;
DROP POLICY IF EXISTS "authenticated can insert fireflies_meeting_summaries"
  ON public.fireflies_meeting_summaries;
DROP POLICY IF EXISTS "authenticated can update fireflies_meeting_summaries"
  ON public.fireflies_meeting_summaries;
DROP POLICY IF EXISTS "app can read fireflies_meeting_summaries"
  ON public.fireflies_meeting_summaries;
DROP POLICY IF EXISTS "app can insert fireflies_meeting_summaries"
  ON public.fireflies_meeting_summaries;
DROP POLICY IF EXISTS "app can update fireflies_meeting_summaries"
  ON public.fireflies_meeting_summaries;

DROP POLICY IF EXISTS "authenticated can read activity_rule_activities"
  ON public.activity_rule_activities;
DROP POLICY IF EXISTS "authenticated can insert activity_rule_activities"
  ON public.activity_rule_activities;
DROP POLICY IF EXISTS "authenticated can update activity_rule_activities"
  ON public.activity_rule_activities;
DROP POLICY IF EXISTS "app can write activity_rule_activities"
  ON public.activity_rule_activities;

DROP POLICY IF EXISTS "public read" ON public.opportunities;
DROP POLICY IF EXISTS "app can write opportunities" ON public.opportunities;

DROP POLICY IF EXISTS "public read" ON public.accounts;
DROP POLICY IF EXISTS "app can update accounts retention growth scoring"
  ON public.accounts;

DROP POLICY IF EXISTS "public read" ON public.profiles;

-- 5. Secure read policies.
CREATE POLICY "secure read profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "secure read accounts"
  ON public.accounts
  FOR SELECT
  TO authenticated
  USING (public.can_view_account(id));

CREATE POLICY "secure read fireflies meeting summaries"
  ON public.fireflies_meeting_summaries
  FOR SELECT
  TO authenticated
  USING (public.can_view_account(account_id));

CREATE POLICY "secure read activity rule activities"
  ON public.activity_rule_activities
  FOR SELECT
  TO authenticated
  USING (public.can_view_account(account_id));

CREATE POLICY "secure read opportunities"
  ON public.opportunities
  FOR SELECT
  TO authenticated
  USING (public.can_view_account(account_id));

-- 6. Secure extraction/write policies.
CREATE POLICY "secure insert fireflies meeting summaries"
  ON public.fireflies_meeting_summaries
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_extract_fireflies_for_account(account_id));

CREATE POLICY "secure update fireflies meeting summaries"
  ON public.fireflies_meeting_summaries
  FOR UPDATE
  TO authenticated
  USING (public.can_extract_fireflies_for_account(account_id))
  WITH CHECK (public.can_extract_fireflies_for_account(account_id));

CREATE POLICY "secure insert activity rule activities"
  ON public.activity_rule_activities
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_extract_fireflies_for_account(account_id));

CREATE POLICY "secure update activity rule activities"
  ON public.activity_rule_activities
  FOR UPDATE
  TO authenticated
  USING (public.can_extract_fireflies_for_account(account_id))
  WITH CHECK (public.can_extract_fireflies_for_account(account_id));

CREATE POLICY "secure insert opportunities"
  ON public.opportunities
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_extract_fireflies_for_account(account_id));

CREATE POLICY "secure update opportunities"
  ON public.opportunities
  FOR UPDATE
  TO authenticated
  USING (public.can_extract_fireflies_for_account(account_id))
  WITH CHECK (public.can_extract_fireflies_for_account(account_id));

CREATE POLICY "secure update account scoring"
  ON public.accounts
  FOR UPDATE
  TO authenticated
  USING (public.can_extract_fireflies_for_account(id))
  WITH CHECK (public.can_extract_fireflies_for_account(id));

NOTIFY pgrst, 'reload schema';
