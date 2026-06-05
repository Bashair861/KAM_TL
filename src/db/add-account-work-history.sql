-- ============================================================
-- add-account-work-history.sql
-- Run in Supabase SQL Editor AFTER add-account-history.sql.
-- Adds database triggers that write account-related work changes
-- into public.account_history.
-- ============================================================

CREATE OR REPLACE FUNCTION public.account_history_actor()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() ->> 'name', ''),
    NULLIF(auth.jwt() -> 'user_metadata' ->> 'name', ''),
    NULLIF(auth.jwt() ->> 'email', ''),
    NULLIF(current_setting('request.jwt.claim.email', true), ''),
    'System'
  );
$$;

CREATE OR REPLACE FUNCTION public.write_account_history(
  p_account_id text,
  p_field_name text,
  p_old_value text,
  p_new_value text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF p_account_id IS NULL OR p_field_name IS NULL THEN
    RETURN;
  END IF;

  IF p_old_value IS NOT DISTINCT FROM p_new_value THEN
    RETURN;
  END IF;

  INSERT INTO public.account_history (
    account_id,
    field_name,
    old_value,
    new_value,
    edited_by
  )
  VALUES (
    p_account_id,
    p_field_name,
    p_old_value,
    p_new_value,
    public.account_history_actor()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.history_activity_summary(
  p_title text,
  p_area text,
  p_status text,
  p_owner text,
  p_due text,
  p_rag text,
  p_expected_lift text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT concat_ws(
    ' | ',
    'Title: ' || p_title,
    'Area: ' || p_area,
    'Status: ' || p_status,
    CASE WHEN p_owner IS NOT NULL THEN 'Owner: ' || p_owner END,
    CASE WHEN p_due IS NOT NULL THEN 'Due: ' || p_due END,
    'RAG: ' || p_rag,
    CASE WHEN p_expected_lift IS NOT NULL THEN 'Expected lift: ' || p_expected_lift END
  );
$$;

CREATE OR REPLACE FUNCTION public.audit_account_activity_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  activity_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    activity_name := OLD.title;
  ELSE
    activity_name := NEW.title;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.write_account_history(
      NEW.account_id,
      'Activity created',
      NULL,
      public.history_activity_summary(
        NEW.title,
        NEW.area::text,
        NEW.status::text,
        NEW.owner,
        NEW.due,
        NEW.rag::text,
        NEW.expected_lift
      )
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    PERFORM public.write_account_history(NEW.account_id, 'Activity title', OLD.title, NEW.title);
    PERFORM public.write_account_history(NEW.account_id, 'Activity area: ' || activity_name, OLD.area::text, NEW.area::text);
    PERFORM public.write_account_history(NEW.account_id, 'Activity owner: ' || activity_name, OLD.owner, NEW.owner);
    PERFORM public.write_account_history(NEW.account_id, 'Activity due: ' || activity_name, OLD.due, NEW.due);
    PERFORM public.write_account_history(NEW.account_id, 'Activity status: ' || activity_name, OLD.status::text, NEW.status::text);
    PERFORM public.write_account_history(NEW.account_id, 'Activity RAG: ' || activity_name, OLD.rag::text, NEW.rag::text);
    PERFORM public.write_account_history(NEW.account_id, 'Activity expected lift: ' || activity_name, OLD.expected_lift, NEW.expected_lift);
    RETURN NEW;
  END IF;

  PERFORM public.write_account_history(
    OLD.account_id,
    'Activity deleted',
    public.history_activity_summary(
      OLD.title,
      OLD.area::text,
      OLD.status::text,
      OLD.owner,
      OLD.due,
      OLD.rag::text,
      OLD.expected_lift
    ),
    NULL
  );
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.history_escalation_summary(
  p_title text,
  p_priority text,
  p_sla text,
  p_rca text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT concat_ws(
    ' | ',
    'Title: ' || p_title,
    'Priority: ' || p_priority,
    CASE WHEN p_sla IS NOT NULL THEN 'SLA remaining: ' || p_sla || 'h' END,
    CASE WHEN p_rca IS NOT NULL THEN 'RCA: ' || p_rca END
  );
$$;

CREATE OR REPLACE FUNCTION public.audit_account_escalation_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  escalation_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    escalation_name := OLD.title;
  ELSE
    escalation_name := NEW.title;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.write_account_history(
      NEW.account_id,
      'Escalation created',
      NULL,
      public.history_escalation_summary(
        NEW.title,
        NEW.priority::text,
        NEW.sla_remaining_hours::text,
        NEW.rca
      )
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    PERFORM public.write_account_history(NEW.account_id, 'Escalation title', OLD.title, NEW.title);
    PERFORM public.write_account_history(NEW.account_id, 'Escalation priority: ' || escalation_name, OLD.priority::text, NEW.priority::text);
    PERFORM public.write_account_history(NEW.account_id, 'Escalation SLA: ' || escalation_name, OLD.sla_remaining_hours::text, NEW.sla_remaining_hours::text);
    PERFORM public.write_account_history(NEW.account_id, 'Escalation RCA: ' || escalation_name, OLD.rca, NEW.rca);
    PERFORM public.write_account_history(NEW.account_id, 'Escalation description: ' || escalation_name, OLD.description, NEW.description);
    PERFORM public.write_account_history(NEW.account_id, 'Escalation recommendation: ' || escalation_name, OLD.recommendation, NEW.recommendation);
    PERFORM public.write_account_history(NEW.account_id, 'Escalation realistic check: ' || escalation_name, OLD.realistic_check, NEW.realistic_check);
    PERFORM public.write_account_history(NEW.account_id, 'Escalation client feedback: ' || escalation_name, OLD.client_feedback, NEW.client_feedback);
    PERFORM public.write_account_history(NEW.account_id, 'Escalation stakeholders: ' || escalation_name, array_to_string(OLD.stakeholders, ', '), array_to_string(NEW.stakeholders, ', '));
    RETURN NEW;
  END IF;

  PERFORM public.write_account_history(
    OLD.account_id,
    'Escalation deleted',
    public.history_escalation_summary(
      OLD.title,
      OLD.priority::text,
      OLD.sla_remaining_hours::text,
      OLD.rca
    ),
    NULL
  );
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_account_escalation_action_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_account_id text;
  v_escalation_title text;
  v_escalation_id text;
  action_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_escalation_id := OLD.escalation_id;
    action_name := OLD.label;
  ELSE
    v_escalation_id := NEW.escalation_id;
    action_name := NEW.label;
  END IF;

  SELECT e.account_id, e.title
    INTO v_account_id, v_escalation_title
  FROM public.escalations e
  WHERE e.id = v_escalation_id;

  IF v_account_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.write_account_history(
      v_account_id,
      'Escalation action item created: ' || v_escalation_title,
      NULL,
      action_name || ' (' || CASE WHEN NEW.done THEN 'Done' ELSE 'Open' END || ')'
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    PERFORM public.write_account_history(v_account_id, 'Escalation action item: ' || v_escalation_title, OLD.label, NEW.label);
    PERFORM public.write_account_history(
      v_account_id,
      'Escalation action item status: ' || action_name,
      CASE WHEN OLD.done THEN 'Done' ELSE 'Open' END,
      CASE WHEN NEW.done THEN 'Done' ELSE 'Open' END
    );
    RETURN NEW;
  END IF;

  PERFORM public.write_account_history(
    v_account_id,
    'Escalation action item deleted: ' || v_escalation_title,
    action_name || ' (' || CASE WHEN OLD.done THEN 'Done' ELSE 'Open' END || ')',
    NULL
  );
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_account_retention_growth_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  service_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    service_name := OLD.service;
  ELSE
    service_name := NEW.service;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.write_account_history(
      NEW.account_id,
      'Retention/growth service added',
      NULL,
      NEW.service
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    PERFORM public.write_account_history(NEW.account_id, 'Retention/growth service', OLD.service, NEW.service);
    PERFORM public.write_account_history(NEW.account_id, 'Service offered: ' || service_name, OLD.offered::text, NEW.offered::text);
    PERFORM public.write_account_history(NEW.account_id, 'Service delivered: ' || service_name, OLD.delivered::text, NEW.delivered::text);
    PERFORM public.write_account_history(NEW.account_id, 'Service applicable: ' || service_name, OLD.applicable::text, NEW.applicable::text);
    PERFORM public.write_account_history(NEW.account_id, 'Service tracking note: ' || service_name, OLD.tracking_note, NEW.tracking_note);
    RETURN NEW;
  END IF;

  PERFORM public.write_account_history(OLD.account_id, 'Retention/growth service removed', OLD.service, NULL);
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_account_education_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  topic_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    topic_name := OLD.topic;
  ELSE
    topic_name := NEW.topic;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.write_account_history(NEW.account_id, 'Education record added', NULL, NEW.topic);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    PERFORM public.write_account_history(NEW.account_id, 'Education date: ' || topic_name, OLD.date, NEW.date);
    PERFORM public.write_account_history(NEW.account_id, 'Education topic', OLD.topic, NEW.topic);
    PERFORM public.write_account_history(NEW.account_id, 'Education approach: ' || topic_name, OLD.approach, NEW.approach);
    PERFORM public.write_account_history(NEW.account_id, 'Education outcome: ' || topic_name, OLD.outcome, NEW.outcome);
    RETURN NEW;
  END IF;

  PERFORM public.write_account_history(OLD.account_id, 'Education record removed', OLD.topic, NULL);
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_account_opportunity_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  opportunity_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    opportunity_name := OLD.title;
  ELSE
    opportunity_name := NEW.title;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.write_account_history(NEW.account_id, 'Opportunity added', NULL, NEW.title);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    PERFORM public.write_account_history(NEW.account_id, 'Opportunity title', OLD.title, NEW.title);
    PERFORM public.write_account_history(NEW.account_id, 'Opportunity source: ' || opportunity_name, OLD.source, NEW.source);
    PERFORM public.write_account_history(NEW.account_id, 'Opportunity signal date: ' || opportunity_name, OLD.signal_date, NEW.signal_date);
    PERFORM public.write_account_history(NEW.account_id, 'Opportunity potential: ' || opportunity_name, OLD.potential::text, NEW.potential::text);
    PERFORM public.write_account_history(NEW.account_id, 'Opportunity confidence: ' || opportunity_name, OLD.confidence::text, NEW.confidence::text);
    PERFORM public.write_account_history(NEW.account_id, 'Opportunity next step: ' || opportunity_name, OLD.next_step, NEW.next_step);
    RETURN NEW;
  END IF;

  PERFORM public.write_account_history(OLD.account_id, 'Opportunity removed', OLD.title, NULL);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS account_history_audit_activities ON public.activities;
CREATE TRIGGER account_history_audit_activities
AFTER INSERT OR UPDATE OR DELETE ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.audit_account_activity_history();

DROP TRIGGER IF EXISTS account_history_audit_escalations ON public.escalations;
CREATE TRIGGER account_history_audit_escalations
AFTER INSERT OR UPDATE OR DELETE ON public.escalations
FOR EACH ROW EXECUTE FUNCTION public.audit_account_escalation_history();

DROP TRIGGER IF EXISTS account_history_audit_escalation_action_items ON public.escalation_action_items;
CREATE TRIGGER account_history_audit_escalation_action_items
AFTER INSERT OR UPDATE OR DELETE ON public.escalation_action_items
FOR EACH ROW EXECUTE FUNCTION public.audit_account_escalation_action_history();

DROP TRIGGER IF EXISTS account_history_audit_retention_growth ON public.retention_growth;
CREATE TRIGGER account_history_audit_retention_growth
AFTER INSERT OR UPDATE OR DELETE ON public.retention_growth
FOR EACH ROW EXECUTE FUNCTION public.audit_account_retention_growth_history();

DROP TRIGGER IF EXISTS account_history_audit_education_log ON public.education_log;
CREATE TRIGGER account_history_audit_education_log
AFTER INSERT OR UPDATE OR DELETE ON public.education_log
FOR EACH ROW EXECUTE FUNCTION public.audit_account_education_history();

DROP TRIGGER IF EXISTS account_history_audit_opportunities ON public.opportunities;
CREATE TRIGGER account_history_audit_opportunities
AFTER INSERT OR UPDATE OR DELETE ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.audit_account_opportunity_history();
