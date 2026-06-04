import { supabase } from "@/lib/supabase";
// ─── mappers ─────────────────────────────────────────────────────────────────
function mapFlatAccount(r) {
  return {
    id: r.id,
    name: r.name,
    shortCode: r.short_code,
    industry: r.industry,
    tier: r.tier,
    health: r.health,
    trend: r.trend,
    contractValue: r.contract_value,
    arr: r.arr,
    renewalDays: r.renewal_days,
    contractType: r.contract_type,
    lastTouch: r.last_touch,
    status: r.status,
    retentionRisk: r.retention_risk,
    growthUpside: r.growth_upside,
    whiteSpaceCount: r.white_space_count,
    cooperation: r.cooperation,
    serviceConsumption: r.service_consumption,
    meetingsPerMonth: r.meetings_per_month,
    contractCompliance: r.contract_compliance,
    primaryContact: {
      name: r.primary_contact_name,
      role: r.primary_contact_role,
    },
    founded: r.founded,
    employees: r.employees,
    region: r.region,
    description: r.description,
    businessInfo: r.business_info,
    clientHistory: r.client_history,
    revenue: r.revenue,
    mrrArr: r.mrr_arr ?? undefined,
    isStartup: r.is_startup,
    engagementTenure: r.engagement_tenure,
    teamSize: r.team_size,
    competitors: r.competitors ?? [],
    mainBusinessFlow: r.main_business_flow,
    assignedKamId: r.assigned_kam_id ?? null,
  };
}
function mapHealthBlock(score, metrics, kpiData) {
  return {
    score,
    metrics: metrics.map((m) => ({
      id: m.id,
      label: m.label,
      value: m.value,
      ...(m.hint ? { hint: m.hint } : {}),
    })),
    kpiData: kpiData ?? null,
  };
}

function mapActivityRuleEvidence(row) {
  return {
    id: row.id,
    ruleActivityId: row.rule_activity_id,
    submittedBy: row.submitted_by,
    evidenceQuality: row.evidence_quality,
    reviewStatus: row.review_status,
    title: row.title,
    notes: row.notes ?? "",
    artifactUrl: row.artifact_url ?? "",
    checklist: row.checklist ?? {},
    requestedLift: row.requested_lift ?? "",
    approvedLift: row.approved_lift ?? "",
    reviewer: row.reviewer ?? "",
    rejectionReason: row.rejection_reason ?? "",
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    updatedAt: row.updated_at,
  };
}

function mapActivityRuleActivity(row, evidenceRows = []) {
  return {
    id: row.id,
    accountId: row.account_id,
    sourceActivityId: row.source_activity_id,
    ruleId: row.rule_id,
    parameter: row.parameter,
    impactedMetric: row.impacted_metric,
    title: row.title,
    nextStep: row.next_step ?? "",
    owner: row.owner ?? "",
    dueDate: row.due_date ?? "",
    rag: row.rag,
    status: row.status,
    activityScorePct: Number(row.activity_score_pct ?? 0),
    weakSignal: row.weak_signal ?? "",
    currentValue: row.current_value ?? "",
    targetValue: row.target_value ?? "",
    expectedLift: row.expected_lift ?? "",
    successCriteria: row.success_criteria ?? "",
    evidenceRequired: row.evidence_required ?? [],
    triggerLogic: row.trigger_logic ?? null,
    evidenceLiftPolicy: row.evidence_lift_policy ?? [],
    activityScoreLogic: row.activity_score_logic ?? [],
    approvalSla: row.approval_sla ?? null,
    reviewCadence: row.review_cadence ?? null,
    sourceType: row.source_type ?? "",
    sourceRef: row.source_ref ?? "",
    generatedAt: row.generated_at,
    acceptedAt: row.accepted_at,
    plannedAt: row.planned_at,
    completedAt: row.completed_at,
    evidenceSubmittedAt: row.evidence_submitted_at,
    validatedAt: row.validated_at,
    closedAt: row.closed_at,
    updatedAt: row.updated_at,
    evidenceReviews: evidenceRows.map(mapActivityRuleEvidence),
  };
}

function mapActivityScoreHistory(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    parameter: row.parameter,
    metric: row.metric ?? "",
    score: Number(row.score),
    snapshotMonth: row.snapshot_month,
    source: row.source,
    notes: row.notes ?? "",
    createdAt: row.created_at,
  };
}

function mapActivityRuleThresholdOverride(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    ruleId: row.rule_id,
    parameter: row.parameter,
    threshold: Number(row.threshold),
    targetScore: Number(row.target_score),
    redThreshold: row.red_threshold === null ? null : Number(row.red_threshold),
    reason: row.reason ?? "",
    approvedBy: row.approved_by ?? "",
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
// ─── fetch accounts (flat) ────────────────────────────────────────────────────
function mapFirefliesMeetingSummary(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    transcriptId: row.fireflies_transcript_id,
    title: row.title,
    meetingDate: row.meeting_date,
    transcriptUrl: row.transcript_url ?? "",
    participants: row.participants ?? [],
    attendees: row.attendees ?? [],
    summary: row.summary ?? {},
    overview: row.overview ?? "",
    shortSummary: row.short_summary ?? "",
    actionItems: row.action_items ?? "",
    derivedActionItems: row.derived_action_items ?? [],
    derivedOpportunities: row.derived_opportunities ?? [],
    agentDiagnostics: row.agent_diagnostics ?? {},
    sourceQuery: row.source_query ?? {},
    syncedAt: row.synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchAccounts(opts) {
  let q = supabase.from("accounts").select("*");
  // KAMs only see accounts assigned to them
  if (opts?.role === "KAM" && opts.userId) {
    q = q.eq("assigned_kam_id", opts.userId);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapFlatAccount);
}
export async function fetchKamUsers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, initials, role")
    .eq("role", "KAM");
  if (error) throw error;
  return data ?? [];
}
// ─── update account KAM assignment ───────────────────────────────────────────
export async function updateAccountKam(accountId, kamId) {
  const { error } = await supabase
    .from("accounts")
    .update({ assigned_kam_id: kamId })
    .eq("id", accountId);
  if (error) throw error;
}
// ─── update health block (score + metrics + kpi checkbox state) ──────────────
export async function updateHealthBlock(accountId, area, score, metricUpdates, kpiData) {
  const { data: hs, error: hsErr } = await supabase
    .from("health_scores")
    .select("id")
    .eq("account_id", accountId)
    .eq("area", area)
    .single();
  if (hsErr || !hs) throw hsErr ?? new Error(`No health score found for area: ${area}`);
  const { error: scoreErr } = await supabase
    .from("health_scores")
    .update({ score, kpi_data: kpiData })
    .eq("id", hs.id);
  if (scoreErr) throw scoreErr;
  await Promise.all(
    metricUpdates.map((mu) =>
      supabase.from("health_metrics").update({ label: mu.label, value: mu.value }).eq("id", mu.id),
    ),
  );
}
// ─── update account KYC fields ───────────────────────────────────────────────
export async function updateAccountKyc(accountId, updates) {
  const { error } = await supabase.from("accounts").update(updates).eq("id", accountId);
  if (error) throw error;
}
// ─── fetch single account (full shape) ───────────────────────────────────────
export async function fetchAccount(id) {
  const [
    { data: acc, error: accErr },
    { data: stakeholders },
    { data: scores },
    { data: cd },
    { data: activities },
    { data: retentionGrowth },
    { data: educationLog },
  ] = await Promise.all([
    supabase.from("accounts").select("*").eq("id", id).single(),
    supabase.from("stakeholders").select("*").eq("account_id", id),
    supabase.from("health_scores").select("*, health_metrics(*)").eq("account_id", id),
    supabase.from("contract_details").select("*").eq("account_id", id).maybeSingle(),
    supabase.from("activities").select("*").eq("account_id", id),
    supabase.from("retention_growth").select("*").eq("account_id", id),
    supabase.from("education_log").select("*").eq("account_id", id),
  ]);
  if (accErr || !acc) return null;
  const scoreMap = new Map((scores ?? []).map((s) => [s.area, s]));
  const block = (area) => {
    const s = scoreMap.get(area);
    return s
      ? mapHealthBlock(s.score, s.health_metrics ?? [], s.kpi_data)
      : { score: 0, metrics: [], kpiData: null };
  };
  const flat = mapFlatAccount(acc);
  return {
    ...flat,
    stakeholders: (stakeholders ?? []).map((s) => ({
      name: s.name,
      role: s.role,
      influence: s.influence,
      email: s.email ?? undefined,
      lastContact: s.last_contact ?? undefined,
    })),
    relationshipHealth: block("relationship"),
    projectHealth: block("project"),
    whiteSpace: block("white_space"),
    contractScoring: {
      ...block("contract"),
      type: cd?.type ?? "",
      duration: cd?.duration ?? "",
      autoRenew: cd?.auto_renew ?? false,
      nonTerminator: cd?.non_terminator ?? false,
      minOneYear: cd?.min_one_year ?? false,
      priceHike: cd?.price_hike ?? "",
      swot: {
        s: cd?.swot_s ?? "",
        w: cd?.swot_w ?? "",
        o: cd?.swot_o ?? "",
        t: cd?.swot_t ?? "",
      },
      customerFeedback: cd?.customer_feedback ?? "",
    },
    csat: block("csat"),
    riskScoring: block("risk"),
    resourceHealth: {
      ...block("resource"),
      backupExists: cd?.backup_exists ?? false,
      leavesThisMonth: cd?.leaves_this_month ?? 0,
      criticalResources: cd?.critical_resources ?? 0,
      teamSize: flat.teamSize,
    },
    financialHealth: block("financial"),
    activities: (activities ?? []).map((a) => ({
      id: a.id,
      area: a.area,
      title: a.title,
      owner: a.owner ?? "",
      due: a.due ?? "",
      status: a.status,
      rag: a.rag,
      expectedLift: a.expected_lift ?? "",
    })),
    retentionGrowth: (retentionGrowth ?? []).map((r) => ({
      service: r.service,
      offered: r.offered,
      delivered: r.delivered,
      applicable: r.applicable,
      trackingNote: r.tracking_note ?? "",
    })),
    educationLog: (educationLog ?? []).map((e) => ({
      date: e.date,
      topic: e.topic,
      approach: e.approach ?? "",
      outcome: e.outcome ?? "",
    })),
  };
}
// ─── fetch escalations ────────────────────────────────────────────────────────
export async function fetchEscalations(accountId) {
  let q = supabase.from("escalations").select("*, escalation_action_items(*)");
  if (accountId) q = q.eq("account_id", accountId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((e) => ({
    id: e.id,
    accountId: e.account_id,
    title: e.title,
    priority: e.priority,
    slaRemainingHours: e.sla_remaining_hours ?? 0,
    openedAt: e.opened_at ?? "",
    rca: e.rca ?? "",
    description: e.description ?? "",
    recommendation: e.recommendation ?? undefined,
    realisticCheck: e.realistic_check ?? undefined,
    clientFeedback: e.client_feedback ?? undefined,
    stakeholders: e.stakeholders ?? [],
    actionItems: (e.escalation_action_items ?? []).map((a) => ({ label: a.label, done: a.done })),
  }));
}
// ─── fetch opportunities ──────────────────────────────────────────────────────
export async function fetchOpportunities(accountId) {
  let q = supabase.from("opportunities").select("*");
  if (accountId) q = q.eq("account_id", accountId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((o) => ({
    id: o.id,
    accountId: o.account_id,
    title: o.title,
    source: o.source ?? "",
    signalDate: o.signal_date ?? "",
    potential: o.potential ?? 0,
    confidence: o.confidence,
    nextStep: o.next_step ?? "",
  }));
}

export async function upsertOpportunitiesFromMeetingAgent({ accountId, opportunities }) {
  if (!opportunities?.length) return [];

  const rows = opportunities.map((opportunity) => ({
    id: opportunity.id,
    account_id: accountId,
    title: opportunity.title,
    source: opportunity.source,
    signal_date: opportunity.signalDate,
    potential: opportunity.potential ?? 0,
    confidence: opportunity.confidence ?? "Medium",
    next_step: opportunity.nextStep,
  }));

  const { data, error } = await supabase
    .from("opportunities")
    .upsert(rows, { onConflict: "id" })
    .select("*");
  if (error) throw error;
  return (data ?? []).map((o) => ({
    id: o.id,
    accountId: o.account_id,
    title: o.title,
    source: o.source ?? "",
    signalDate: o.signal_date ?? "",
    potential: o.potential ?? 0,
    confidence: o.confidence,
    nextStep: o.next_step ?? "",
  }));
}
export async function fetchContracts(opts) {
  let q = supabase
    .from("accounts")
    .select("*, contract_details(duration, auto_renew, non_terminator, price_hike)");
  if (opts?.role === "KAM" && opts.userId) {
    q = q.eq("assigned_kam_id", opts.userId);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((row) => {
    const cd = row.contract_details?.[0];
    return {
      ...mapFlatAccount(row),
      duration: cd?.duration ?? "—",
      autoRenew: cd?.auto_renew ?? false,
      nonTerminator: cd?.non_terminator ?? false,
      priceHike: cd?.price_hike ?? "—",
    };
  });
}
export async function fetchAccountHistory(accountId) {
  const { data, error } = await supabase
    .from("account_history")
    .select("*")
    .eq("account_id", accountId)
    .order("edited_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((h) => ({
    id: h.id,
    fieldName: h.field_name,
    oldValue: h.old_value,
    newValue: h.new_value,
    editedBy: h.edited_by,
    editedAt: h.edited_at,
  }));
}
export async function logAccountChanges(accountId, changes, editedBy) {
  if (changes.length === 0) return;
  const { error } = await supabase.from("account_history").insert(
    changes.map((c) => ({
      account_id: accountId,
      field_name: c.field,
      old_value: c.oldValue,
      new_value: c.newValue,
      edited_by: editedBy,
    })),
  );
  if (error) throw error;
}

export async function fetchActivityScoreHistory(accountId) {
  const { data, error } = await supabase
    .from("activity_score_history")
    .select("*")
    .eq("account_id", accountId)
    .order("snapshot_month", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapActivityScoreHistory);
}

export async function upsertActivityScoreSnapshot({
  accountId,
  parameter,
  metric,
  score,
  snapshotMonth,
  source = "score_snapshot",
  notes = "",
}) {
  const month =
    snapshotMonth ??
    new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), 1))
      .toISOString()
      .slice(0, 10);

  const { error } = await supabase.from("activity_score_history").upsert(
    {
      account_id: accountId,
      parameter,
      metric,
      score,
      snapshot_month: month,
      source,
      notes,
    },
    { onConflict: "account_id,parameter,metric,snapshot_month" },
  );
  if (error) throw error;
}

export async function fetchActivityRuleThresholdOverrides(accountId) {
  const { data, error } = await supabase
    .from("activity_rule_threshold_overrides")
    .select("*")
    .eq("account_id", accountId)
    .eq("active", true)
    .order("updated_at", { ascending: false });
  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }
  return (data ?? []).map(mapActivityRuleThresholdOverride);
}

export async function fetchFirefliesMeetingSummaries(accountId) {
  const { data, error } = await supabase
    .from("fireflies_meeting_summaries")
    .select("*")
    .eq("account_id", accountId)
    .order("meeting_date", { ascending: false, nullsFirst: false })
    .order("synced_at", { ascending: false });
  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }
  return (data ?? []).map(mapFirefliesMeetingSummary);
}

export async function upsertFirefliesMeetingSummaries(accountId, meetings) {
  if (!meetings?.length) return [];
  const now = new Date().toISOString();
  const rows = meetings.map((meeting) => ({
    account_id: accountId,
    fireflies_transcript_id: meeting.transcriptId,
    title: meeting.title,
    meeting_date: meeting.meetingDate,
    transcript_url: meeting.transcriptUrl || null,
    participants: meeting.participants ?? [],
    attendees: meeting.attendees ?? [],
    summary: meeting.summary ?? {},
    overview: meeting.overview ?? "",
    short_summary: meeting.shortSummary ?? "",
    action_items: meeting.actionItems ?? "",
    derived_action_items: meeting.derivedActionItems ?? [],
    derived_opportunities: meeting.derivedOpportunities ?? [],
    agent_diagnostics: meeting.agentDiagnostics ?? {},
    source_query: meeting.sourceQuery ?? {},
    synced_at: now,
    updated_at: now,
  }));

  const { data, error } = await supabase
    .from("fireflies_meeting_summaries")
    .upsert(rows, { onConflict: "account_id,fireflies_transcript_id" })
    .select("*");
  if (error) throw error;
  return (data ?? []).map(mapFirefliesMeetingSummary);
}

export async function fetchActivityRuleActivities(accountId) {
  const { data: rows, error } = await supabase
    .from("activity_rule_activities")
    .select("*")
    .eq("account_id", accountId)
    .order("generated_at", { ascending: false });
  if (error) throw error;

  const ids = (rows ?? []).map((row) => row.id);
  let evidenceByActivity = new Map();

  if (ids.length) {
    const { data: evidenceRows, error: evidenceError } = await supabase
      .from("activity_rule_evidence")
      .select("*")
      .in("rule_activity_id", ids)
      .order("submitted_at", { ascending: false });
    if (evidenceError) throw evidenceError;

    evidenceByActivity = (evidenceRows ?? []).reduce((map, row) => {
      const current = map.get(row.rule_activity_id) ?? [];
      current.push(row);
      map.set(row.rule_activity_id, current);
      return map;
    }, new Map());
  }

  return (rows ?? []).map((row) => mapActivityRuleActivity(row, evidenceByActivity.get(row.id)));
}

export async function createActivityRuleActivity(input) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("activity_rule_activities")
    .insert({
      account_id: input.accountId,
      rule_id: input.ruleId,
      parameter: input.parameter,
      impacted_metric: input.impactedMetric,
      title: input.title,
      next_step: input.nextStep,
      owner: input.owner,
      due_date: input.dueDate || null,
      rag: input.rag ?? "A",
      status: "Planned",
      activity_score_pct: input.owner && input.dueDate ? 20 : 10,
      weak_signal: input.weakSignal,
      current_value: input.currentValue,
      target_value: input.targetValue,
      expected_lift: input.expectedLift,
      success_criteria: input.successCriteria,
      evidence_required: input.evidenceRequired ?? [],
      trigger_logic: input.triggerLogic ?? {},
      evidence_lift_policy: input.evidenceLiftPolicy ?? [],
      activity_score_logic: input.activityScoreLogic ?? [],
      approval_sla: input.approvalSla ?? {},
      review_cadence: input.reviewCadence ?? {},
      source_type: input.sourceType,
      source_ref: input.sourceRef,
      accepted_at: now,
      planned_at: input.owner && input.dueDate ? now : null,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapActivityRuleActivity(data);
}

export async function createActivityRuleActivitiesFromMeetingActions({ accountId, actions }) {
  if (!actions?.length) return [];

  const sourceRefs = actions.map((action) => action.id).filter(Boolean);
  if (!sourceRefs.length) return [];

  const { data: existingRows, error: existingError } = await supabase
    .from("activity_rule_activities")
    .select("source_ref")
    .eq("account_id", accountId)
    .in("source_ref", sourceRefs);
  if (existingError) throw existingError;

  const existingRefs = new Set((existingRows ?? []).map((row) => row.source_ref));
  const now = new Date().toISOString();
  const rows = actions
    .filter((action) => !existingRefs.has(action.id))
    .map((action) => ({
      account_id: accountId,
      rule_id: action.ruleId ?? "MEET-01",
      parameter: action.parameter ?? action.healthArea ?? "Relationship",
      impacted_metric: action.impactedMetric ?? "Meeting-derived required action",
      title: action.title,
      next_step: action.nextStep ?? action.title,
      owner: null,
      due_date: null,
      rag:
        action.urgency ??
        (action.confidence === "High" ? "R" : action.confidence === "Low" ? "G" : "A"),
      status: "Generated",
      activity_score_pct: 0,
      weak_signal: action.weakSignal ?? "Fireflies meeting action item matched guardrails",
      current_value: action.currentValue ?? "Meeting action identified",
      target_value: action.targetValue ?? "Validated activity evidence",
      expected_lift: action.expectedLift ?? "",
      success_criteria:
        action.successCriteria ??
        "Action has owner, due date or next step, and evidence before score movement.",
      evidence_required: action.evidenceRequired ?? [
        "Fireflies action item",
        "Owner/date confirmation",
        "Completion evidence",
      ],
      trigger_logic: {
        primary: "Fireflies meeting action passed the guarded meeting-action agent.",
        source: action.actionSource ?? "explicit_action_items",
      },
      evidence_lift_policy: [],
      activity_score_logic: [],
      approval_sla: {},
      review_cadence: {},
      source_type: "fireflies_meeting",
      source_ref: action.id,
      generated_at: now,
      updated_at: now,
    }));

  if (!rows.length) return [];

  const { data, error } = await supabase
    .from("activity_rule_activities")
    .insert(rows)
    .select("*");
  if (error) throw error;
  return (data ?? []).map((row) => mapActivityRuleActivity(row));
}

export async function rejectActivityRuleSuggestion(input) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("activity_rule_activities")
    .insert({
      account_id: input.accountId,
      rule_id: input.ruleId,
      parameter: input.parameter,
      impacted_metric: input.impactedMetric,
      title: input.title,
      next_step: input.reason,
      owner: input.reviewer,
      rag: input.rag ?? "A",
      status: "Rejected",
      activity_score_pct: 0,
      weak_signal: input.weakSignal,
      current_value: input.currentValue,
      target_value: input.targetValue,
      expected_lift: input.expectedLift,
      success_criteria: input.successCriteria,
      evidence_required: input.evidenceRequired ?? [],
      trigger_logic: input.triggerLogic ?? {},
      evidence_lift_policy: input.evidenceLiftPolicy ?? [],
      activity_score_logic: input.activityScoreLogic ?? [],
      approval_sla: input.approvalSla ?? {},
      review_cadence: input.reviewCadence ?? {},
      source_type: input.sourceType,
      source_ref: input.sourceRef,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapActivityRuleActivity(data);
}

export async function submitActivityRuleEvidence({
  ruleActivityId,
  submittedBy,
  evidenceQuality,
  title,
  notes,
  artifactUrl,
  checklist = {},
  requestedLift,
}) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("activity_rule_evidence")
    .insert({
      rule_activity_id: ruleActivityId,
      submitted_by: submittedBy,
      evidence_quality: evidenceQuality,
      title,
      notes,
      artifact_url: artifactUrl || null,
      checklist,
      requested_lift: requestedLift,
    })
    .select("*")
    .single();
  if (error) throw error;

  const { error: activityError } = await supabase
    .from("activity_rule_activities")
    .update({
      status: "Evidence Submitted",
      activity_score_pct: 80,
      completed_at: now,
      evidence_submitted_at: now,
      updated_at: now,
    })
    .eq("id", ruleActivityId);
  if (activityError) throw activityError;

  return mapActivityRuleEvidence(data);
}

export async function reviewActivityRuleEvidence({
  evidenceId,
  ruleActivityId,
  reviewer,
  reviewStatus,
  approvedLift,
  rejectionReason = "",
}) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("activity_rule_evidence")
    .update({
      review_status: reviewStatus,
      approved_lift: reviewStatus === "Approved" ? approvedLift : null,
      reviewer,
      rejection_reason: reviewStatus === "Rejected" ? rejectionReason : null,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", evidenceId)
    .select("*")
    .single();
  if (error) throw error;

  const statusByReview = {
    Approved: "Validated",
    Partial: "Evidence Submitted",
    Rejected: "Rejected",
  };
  const pctByReview = {
    Approved: 100,
    Partial: 80,
    Rejected: 60,
  };
  const activityStatus = statusByReview[reviewStatus] ?? "Evidence Submitted";
  const { error: activityError } = await supabase
    .from("activity_rule_activities")
    .update({
      status: activityStatus,
      activity_score_pct: pctByReview[reviewStatus] ?? 80,
      validated_at: reviewStatus === "Approved" ? now : null,
      updated_at: now,
    })
    .eq("id", ruleActivityId);
  if (activityError) throw activityError;

  return mapActivityRuleEvidence(data);
}
// ─── fetch notifications ──────────────────────────────────────────────────────
export async function fetchNotifications() {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body ?? "",
    accountId: n.account_id ?? undefined,
    time: n.time ?? "",
    type: n.type,
    read: n.read,
  }));
}
