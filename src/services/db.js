import { supabase } from "@/lib/supabase";
import { normalizeRole } from "@/data/kam-data";
import { createManagedAuthUser, deleteManagedAuthUser } from "@/services/user-admin";
import { syncSalesforceMappedFieldsServer } from "@/services/salesforce-sync";
import { generateLinkedinSummaryServer } from "@/services/linkedin-summary";
import { generateWebsiteSummaryServer } from "@/services/website-summary";
import { applySowFieldsServer } from "@/services/sow-upload";
import { buildRetentionGrowthTabModel } from "@/services/retention-growth-tab";
import { markNotificationsReadServer } from "@/services/notification-read";
import {
  createAccountAssignmentNotifications,
  createActionItemNotifications,
  ensureContractRenewalNotifications,
  isNotificationRole,
} from "@/services/notifications";
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
    contractRenewalDate: r.renewal_date ?? r.contract_renewal_date ?? null,
    contractDuration: r.contract_duration ?? "",
    contractType: r.contract_type,
    lastTouch: r.last_touch,
    status: r.status,
    retentionRisk: r.retention_risk,
    growthUpside: r.growth_upside,
    whiteSpaceCount: r.white_space_count,
    retentionHealthScore: r.retention_health_score ?? 0,
    calculatedRetentionRisk: r.calculated_retention_risk ?? r.retention_risk ?? "Low",
    growthPotentialScore: r.growth_potential_score ?? 0,
    growthPotentialLevel: r.growth_potential_level ?? "Low",
    revenueAtRisk: r.revenue_at_risk ?? 0,
    growthPipelineValue: r.growth_pipeline_value ?? 0,
    retentionGrowthQuadrant: r.retention_growth_quadrant ?? null,
    retentionGrowthNextAction: r.retention_growth_next_action ?? null,
    retentionGrowthCalculatedAt: r.retention_growth_calculated_at ?? null,
    retentionGrowthCalculationReason: r.retention_growth_calculation_reason ?? {},
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
    linkedinUrl: r.linkedin_url ?? "",
    linkedinSummary: r.linkedin_summary ?? "",
    linkedinSummaryUpdatedAt: r.linkedin_summary_updated_at ?? null,
    websiteUrl: r.website_url ?? "",
    websiteSummary: r.website_summary ?? "",
    websiteSummaryUpdatedAt: r.website_summary_updated_at ?? null,
    assignedKamId: r.assigned_kam_id ?? null,
    newsKeywords: r.news_keywords ?? [],
    lastNewsSyncAt: r.last_news_sync_at ?? null,
  };
}
function mapHealthBlock(score, metrics, kpiData, updatedAt) {
  return {
    score,
    metrics: metrics.map((m) => ({
      id: m.id,
      label: m.label,
      value: m.value,
      complete: Boolean(m.complete ?? m.Complete ?? false),
      ...(m.hint ? { hint: m.hint } : {}),
    })),
    kpiData: kpiData ?? null,
    updatedAt: updatedAt ?? null,
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

function mapAccountTaskForAiSuggestion(row, index, fallbackAccountId) {
  return {
    id: row.id ?? row.task_id ?? `task-${fallbackAccountId}-${index}`,
    accountId: row.account_id ?? row.accountId ?? fallbackAccountId,
    title: row.title ?? row.name ?? row.task_name ?? row.subject ?? "Untitled task",
    description: row.description ?? row.details ?? row.notes ?? row.summary ?? "",
    area: row.area ?? row.health_area ?? row.parameter ?? row.category ?? "",
    status: row.status ?? row.state ?? "",
    priority: row.priority ?? row.urgency ?? "",
    owner: row.owner ?? row.assigned_to ?? row.assignee ?? "",
    dueDate: row.due_date ?? row.due ?? row.deadline ?? "",
    source: "tasks",
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

function normalizeActivityDuplicateText(value = "") {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSimilarActivityText(left, right) {
  const a = normalizeActivityDuplicateText(left);
  const b = normalizeActivityDuplicateText(right);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function isDuplicateRuleActivityInput(input, row) {
  const sameArea = isSimilarActivityText(input.parameter, row.parameter);
  const titleMatch = isSimilarActivityText(input.title, row.title);
  const detailMatch = isSimilarActivityText(input.nextStep, row.next_step);
  return sameArea && (titleMatch || detailMatch);
}

function buildActionItemTaskDescription(input) {
  return [
    input.description,
    input.reason ? `Reason: ${input.reason}` : "",
    input.source ? `Source: ${input.source}` : "",
    input.healthArea ? `Health area: ${input.healthArea}` : "",
    input.expectedLift ? `Expected lift: ${input.expectedLift}` : "",
  ]
    .filter((part) => String(part ?? "").trim())
    .join("\n\n");
}

const ACTIVITY_AI_SUGGESTIONS_TABLE = "activity_ai_suggestions";
const MEETING_INSIGHT_ACTION_FOCUS = "meeting_insight_action_item";

function normalizeAiInsightStatus(status) {
  if (status === "converted_to_action" || status === "dismissed" || status === "draft") {
    return status;
  }
  return "draft";
}

function getAiInsightResponse(row) {
  return row?.response && typeof row.response === "object" ? row.response : {};
}

function mapStagedAiRecommendation(row) {
  const response = getAiInsightResponse(row);
  return {
    id: row.id,
    sourceId: row.source_id ?? response.sourceId ?? response.originalId ?? row.id,
    title: row.title ?? response.title ?? row.summary ?? row.prompt ?? "Untitled recommendation",
    description: row.description ?? response.description ?? "",
    healthArea: row.health_area ?? response.healthArea ?? response.health_area ?? "",
    expectedLift: row.expected_lift ?? response.expectedLift ?? response.expected_lift ?? "",
    reason: row.reason ?? response.reason ?? "",
    sourceSummary:
      row.source_reference ??
      response.sourceSummary ??
      response.source_reference ??
      response.sourceReference ??
      row.source ??
      "",
    status: row.status,
    createdAt: row.created_at,
  };
}

function buildAiRecommendationPayload(input) {
  const suggestion = input.suggestion ?? input;
  return {
    originalId: suggestion.id ?? suggestion.sourceId ?? "",
    title: String(suggestion.title ?? "").trim(),
    description: String(suggestion.description ?? "").trim(),
    healthArea: suggestion.healthArea ?? suggestion.health_area ?? "",
    expectedLift: suggestion.expectedLift ?? suggestion.expected_lift ?? "",
    reason: suggestion.reason ?? "",
    sourceSummary:
      suggestion.sourceSummary ?? suggestion.source_reference ?? suggestion.sourceReference ?? "",
  };
}

function buildLocalStagedAiRecommendation(accountId, payload, status = "draft") {
  const sourceId =
    payload.originalId ||
    normalizeActivityDuplicateText(payload.title) ||
    `recommendation-${Date.now()}`;

  return {
    id: `local-ai-${accountId}-${sourceId}`,
    sourceId,
    title: payload.title || "Untitled recommendation",
    description: payload.description ?? "",
    healthArea: payload.healthArea ?? "",
    expectedLift: payload.expectedLift ?? "",
    reason: payload.reason ?? "",
    sourceSummary: payload.sourceSummary ?? "AI Suggestions",
    status,
    createdAt: new Date().toISOString(),
    localOnly: true,
  };
}

function buildMeetingInsightPayload(input) {
  const item = input.item ?? input;
  return {
    sourceRef: input.sourceRef ?? item.sourceRef ?? item.sourceId ?? item.id ?? "",
    title: String(item.title ?? "").trim(),
    description: item.description ?? item.reason ?? item.nextStep ?? "",
    healthArea: item.healthArea ?? item.area ?? "",
    expectedLift: item.expectedLift ?? "",
    reason: item.reason ?? "",
    sourceSummary: item.meetingTitle
      ? `Meeting Insight: ${item.meetingTitle}`
      : (item.sourceSummary ?? "Meeting Insight"),
    meetingTitle: item.meetingTitle ?? "",
    meetingDate: item.meetingDate ?? "",
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

function isMissingTableError(error) {
  const message = String(error?.message ?? "").toLowerCase();
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    /relation .* does not exist/i.test(error?.message ?? "") ||
    message.includes("could not find the table") ||
    (message.includes("schema cache") && message.includes("table"))
  );
}

function isMissingColumnError(error, column = "") {
  const message = String(error?.message ?? "").toLowerCase();
  const columnName = String(column ?? "").toLowerCase();
  return (
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    (columnName && message.includes(columnName)) ||
    (message.includes("could not find") && message.includes("column")) ||
    (message.includes("schema cache") && message.includes("column"))
  );
}

function getActivityAiSuggestionsSchemaError() {
  return new Error(
    "activity_ai_suggestions table schema does not match the app. Run src/db/add-activity-ai-suggestions.sql in Supabase SQL Editor, then restart the app.",
  );
}

function isActivityAiSuggestionsTypeError(error) {
  const message = String(error?.message ?? "").toLowerCase();
  return (
    error?.code === "22P02" && message.includes("invalid input syntax") && message.includes("uuid")
  );
}
function getRowComplete(row) {
  return Boolean(row.complete ?? row.completed ?? row.Complete ?? false);
}
function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function areaLabel(area) {
  return String(area ?? "")
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
function actionLabelFromKpi(label) {
  const clean = String(label ?? "").trim();
  if (!clean) return "Complete KPI follow-up";
  if (
    /^(complete|send|schedule|share|review|prepare|confirm|resolve|submit|update)\b/i.test(clean)
  ) {
    return clean;
  }
  return `Complete: ${clean}`;
}
function priorityRank(priority) {
  if (priority === "P1") return 0;
  if (priority === "P2") return 1;
  return 2;
}
function metricPriorityFromWeight(weight) {
  if (weight >= 50) return "P1";
  if (weight >= 30) return "P2";
  return "P3";
}
function sortDashboardActionItems(items) {
  return [...items].sort((a, b) => {
    if (a.isEscalation !== b.isEscalation) return a.isEscalation ? -1 : 1;
    const priorityDelta = priorityRank(a.priority) - priorityRank(b.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return (b.importanceScore ?? 0) - (a.importanceScore ?? 0);
  });
}
function mapTask(row, accountLookup = new Map(), healthMetricLookup = new Map()) {
  const healthMetric = healthMetricLookup.get(row.health_metric_id);
  const accountId = row.account_id ?? healthMetric?.accountId ?? null;
  const account = accountLookup.get(accountId);
  const isEscalation = Boolean(row.escalation_id);
  return {
    id: row.id,
    sourceType: "task",
    accountId,
    accountName: account?.name ?? accountId ?? "Portfolio",
    title: row.title ?? row.name ?? row.label ?? "Untitled task",
    description: row.description ?? "",
    due: row.due ?? row.due_date ?? "",
    priority: isEscalation ? "P1" : (row.priority ?? "P3"),
    source: isEscalation ? "Escalation" : (row.source ?? row.type ?? healthMetric?.label ?? "Task"),
    complete: getRowComplete(row),
    completedAt: row.completed_at ?? null,
    escalationId: row.escalation_id ?? null,
    isEscalation,
    healthMetricId: row.health_metric_id ?? null,
    healthMetricLabel: healthMetric?.label ?? "",
    healthScoreId: healthMetric?.healthScoreId ?? null,
    healthArea: healthMetric?.area ?? "",
    importanceScore: isEscalation ? 100 : row.health_metric_id ? 70 : 20,
  };
}
function mapRetentionGrowthDraft(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    kind: row.kind,
    title: row.title,
    owner: row.owner ?? "",
    dueDate: row.due_date ?? "",
    nextStep: row.next_step ?? "",
    potentialValueLabel: row.potential_value_label ?? "Not provided",
    reason: row.reason ?? "",
    evidence: row.evidence ?? [],
    offerType: row.offer_type ?? null,
    approvalState: row.approval_state ?? "",
    createdBy: row.created_by ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
// --- fetch accounts (flat) ----------------------------------------------------
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

export async function fetchKamTasks(opts = {}) {
  const accountIds = opts.accountIds ?? (opts.accountId ? [opts.accountId] : null);
  if (accountIds && accountIds.length === 0) return [];

  let q = supabase.from("tasks").select("*").order("created_at", { ascending: false }).limit(100);
  if (accountIds) q = q.in("account_id", accountIds);

  const { data, error } = await q;
  if (isMissingTableError(error)) return [];
  if (error) throw error;

  const tasks = data ?? [];
  const visibleTasks = opts.includeCompleted
    ? tasks
    : tasks.filter((task) => !getRowComplete(task));
  const taskAccountIds = [
    ...new Set(visibleTasks.map((task) => task.account_id).filter((id) => Boolean(id))),
  ];
  const healthMetricIds = [
    ...new Set(visibleTasks.map((task) => task.health_metric_id).filter((id) => Boolean(id))),
  ];

  const [{ data: accounts }, { data: metrics }] = await Promise.all([
    taskAccountIds.length
      ? supabase.from("accounts").select("id, name, short_code").in("id", taskAccountIds)
      : Promise.resolve({ data: [] }),
    healthMetricIds.length
      ? supabase
          .from("health_metrics")
          .select("id, label, complete, Complete, health_scores(id, account_id, area)")
          .in("id", healthMetricIds)
      : Promise.resolve({ data: [] }),
  ]);

  const accountLookup = new Map((accounts ?? []).map((account) => [account.id, account]));
  const healthMetricLookup = new Map(
    (metrics ?? []).map((metric) => {
      const score = Array.isArray(metric.health_scores)
        ? metric.health_scores[0]
        : metric.health_scores;
      return [
        metric.id,
        {
          label: metric.label,
          complete: Boolean(metric.complete ?? metric.Complete ?? false),
          accountId: score?.account_id ?? null,
          healthScoreId: score?.id ?? null,
          area: score?.area ?? "",
        },
      ];
    }),
  );

  return visibleTasks.map((task) => mapTask(task, accountLookup, healthMetricLookup));
}
async function fetchDashboardKpiActionItems(accountIds, accountLookup) {
  const { data, error } = await supabase
    .from("health_scores")
    .select("id, account_id, area, kpi_data")
    .in("account_id", accountIds);
  if (error) throw error;

  const items = [];
  for (const score of data ?? []) {
    const account = accountLookup.get(score.account_id);
    const area = areaLabel(score.area);
    const kpiData = Array.isArray(score.kpi_data) ? score.kpi_data : null;
    if (!kpiData?.length) continue;

    for (const section of kpiData) {
      for (const field of section.fields ?? []) {
        if (field.checked) continue;
        const weight = asNumber(field.weight);
        items.push({
          id: `kpi:${score.id}:${section.id}:${field.id}`,
          sourceType: "kpi_data",
          accountId: score.account_id,
          accountName: account?.name ?? score.account_id,
          title: actionLabelFromKpi(field.label),
          description: `${section.name} KPI is unchecked in the ${area} scorecard.`,
          due: "KPI action",
          priority: metricPriorityFromWeight(weight),
          source: `KPI Data - ${area}`,
          complete: false,
          completedAt: null,
          escalationId: null,
          isEscalation: false,
          healthMetricId: section.metricId ?? null,
          healthMetricLabel: section.name,
          healthScoreId: score.id,
          kpiSectionId: section.id,
          kpiFieldId: field.id,
          healthArea: score.area,
          importanceScore: weight,
        });
      }
    }
  }
  return items;
}
export async function fetchDashboardActionItems(opts = {}) {
  const accounts = await fetchAccounts({ role: opts.role, userId: opts.userId });
  const accountIds = accounts.map((account) => account.id);
  if (accountIds.length === 0) return [];
  const accountLookup = new Map(accounts.map((account) => [account.id, account]));
  const tasks = await fetchKamTasks({ accountIds, includeCompleted: false });
  const kpiItems = await fetchDashboardKpiActionItems(accountIds, accountLookup);
  const primaryItems = sortDashboardActionItems([...tasks, ...kpiItems]);
  return primaryItems;
}
function setKpiDataFieldChecked(kpiData, patch) {
  if (!Array.isArray(kpiData)) return { kpiData, changed: false };
  let changed = false;
  const next = kpiData.map((section) => {
    if (section.id !== patch.kpiSectionId) return section;
    const fields = (section.fields ?? []).map((field) => {
      if (field.id !== patch.kpiFieldId) return field;
      if (Boolean(field.checked) === patch.complete) return field;
      changed = true;
      return { ...field, checked: patch.complete };
    });
    return changed ? { ...section, fields } : section;
  });
  return { kpiData: next, changed };
}
async function updateKpiDataActionComplete({ healthScoreId, kpiSectionId, kpiFieldId, complete }) {
  if (!healthScoreId) return;

  const { data: scoreRow, error: scoreError } = await supabase
    .from("health_scores")
    .select("id, kpi_data")
    .eq("id", healthScoreId)
    .maybeSingle();
  if (scoreError) throw scoreError;
  if (!scoreRow) return;

  const { kpiData, changed } = setKpiDataFieldChecked(scoreRow.kpi_data, {
    kpiSectionId,
    kpiFieldId,
    complete,
  });
  if (!changed) return;

  const { error: updateError } = await supabase
    .from("health_scores")
    .update({ kpi_data: kpiData, updated_at: new Date().toISOString() })
    .eq("id", healthScoreId);
  if (updateError) throw updateError;
}
export async function updateDashboardActionItemComplete(action) {
  const sourceType = action.sourceType ?? "task";
  if (sourceType === "kpi_data") {
    await updateKpiDataActionComplete(action);
    return;
  }

  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from("tasks")
    .update({ Complete: action.complete, updated_at: updatedAt })
    .eq("id", action.id);
  if (error) throw error;
}
export async function updateDashboardTaskComplete(taskId, complete, healthMetricId) {
  await updateDashboardActionItemComplete({
    id: taskId,
    sourceType: "task",
    complete,
    healthMetricId,
  });
}

export async function createAccountActionItemTask(input) {
  const accountId = input.accountId;
  const title = String(input.title ?? "").trim();
  if (!accountId) throw new Error("Account is required before creating an action item.");
  if (!title) throw new Error("Action item title is required.");

  const description = buildActionItemTaskDescription(input);
  const { data: existingRows, error: existingError } = await supabase
    .from("tasks")
    .select("*")
    .eq("account_id", accountId)
    .limit(200);

  if (isMissingTableError(existingError)) {
    throw new Error("Tasks table is missing. Run the tasks migration before adding action items.");
  }
  if (existingError) throw existingError;

  const normalizedTitle = normalizeActivityDuplicateText(title);
  const normalizedDescription = normalizeActivityDuplicateText(description);
  const duplicate = (existingRows ?? [])
    .filter((row) => !getRowComplete(row))
    .some((row) => {
      const rowTitle = normalizeActivityDuplicateText(row.title ?? row.name ?? row.label);
      const rowDescription = normalizeActivityDuplicateText(row.description);
      const titleMatch =
        rowTitle &&
        (rowTitle === normalizedTitle ||
          rowTitle.includes(normalizedTitle) ||
          normalizedTitle.includes(rowTitle));
      const descriptionMatch =
        !normalizedDescription ||
        !rowDescription ||
        rowDescription.includes(normalizedDescription) ||
        normalizedDescription.includes(rowDescription);
      return titleMatch && descriptionMatch;
    });

  if (duplicate) throw new Error("This action item already exists.");

  const row = {
    name: title,
    description,
    type: "Action Item",
    account_id: accountId,
    health_metric_id: input.healthMetricId ?? null,
  };

  const { data, error } = await supabase.from("tasks").insert(row).select("*").single();
  if (error) throw error;
  await createActionItemNotifications(supabase, {
    accountId,
    actionItemId: data.id,
    title,
  }).catch(() => null);
  await logAccountChanges(
    accountId,
    [
      {
        field: "Action item created",
        oldValue: null,
        newValue: summarizeTaskHistory({ ...input, title, description }),
      },
    ],
    input.editedBy ?? "Unknown",
  );
  return mapTask(data);
}

export async function fetchStagedAiRecommendations(input = {}) {
  if (!input.accountId) return [];
  const query = supabase
    .from(ACTIVITY_AI_SUGGESTIONS_TABLE)
    .select("*")
    .eq("account_id", input.accountId)
    .eq("status", "draft")
    .order("created_at", { ascending: true })
    .limit(100);

  const { data, error } = await query;
  if (isMissingTableError(error)) return [];
  if (isMissingColumnError(error) || isActivityAiSuggestionsTypeError(error)) {
    throw getActivityAiSuggestionsSchemaError();
  }
  if (error) throw error;
  return (data ?? []).map(mapStagedAiRecommendation);
}

export async function stageAccountAiRecommendation(input = {}) {
  const accountId = input.accountId;
  if (!accountId) throw new Error("Account is required before staging an AI recommendation.");

  const payload = buildAiRecommendationPayload(input);
  if (!payload.title) throw new Error("AI recommendation title is required.");

  const existingQuery = supabase
    .from(ACTIVITY_AI_SUGGESTIONS_TABLE)
    .select("*")
    .eq("account_id", accountId)
    .eq("status", "draft")
    .limit(100);

  const { data: existingRows, error: existingError } = await existingQuery;
  if (isMissingTableError(existingError)) {
    return buildLocalStagedAiRecommendation(accountId, payload);
  }
  if (isMissingColumnError(existingError) || isActivityAiSuggestionsTypeError(existingError)) {
    throw getActivityAiSuggestionsSchemaError();
  }
  if (existingError) throw existingError;

  const normalizedTitle = normalizeActivityDuplicateText(payload.title);
  const duplicate = (existingRows ?? []).find((row) => {
    const rowTitle = normalizeActivityDuplicateText(mapStagedAiRecommendation(row).title);
    return rowTitle === normalizedTitle;
  });
  if (duplicate) return mapStagedAiRecommendation(duplicate);

  const row = {
    account_id: accountId,
    requested_by: input.requestedBy ?? null,
    source_id: payload.originalId || normalizeActivityDuplicateText(payload.title),
    title: payload.title,
    description: payload.description,
    health_area: payload.healthArea,
    expected_lift: payload.expectedLift,
    reason: payload.reason,
    source_reference: payload.sourceSummary || "AI Suggestions",
    status: "draft",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(ACTIVITY_AI_SUGGESTIONS_TABLE)
    .insert(row)
    .select("*")
    .single();
  if (isMissingTableError(error)) {
    return buildLocalStagedAiRecommendation(accountId, payload);
  }
  if (isMissingColumnError(error) || isActivityAiSuggestionsTypeError(error)) {
    throw getActivityAiSuggestionsSchemaError();
  }
  if (error) throw error;
  return mapStagedAiRecommendation(data);
}

export async function updateStagedAiRecommendationStatus(input = {}) {
  if (!input.id) throw new Error("AI recommendation id is required.");
  const status = normalizeAiInsightStatus(input.status);
  if (String(input.id).startsWith("local-ai-")) {
    return {
      id: input.id,
      status,
      localOnly: true,
    };
  }
  const { data, error } = await supabase
    .from(ACTIVITY_AI_SUGGESTIONS_TABLE)
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", input.id)
    .select("*")
    .single();

  if (isMissingTableError(error)) {
    return {
      id: input.id,
      status,
      localOnly: true,
    };
  }
  if (isMissingColumnError(error) || isActivityAiSuggestionsTypeError(error)) {
    throw getActivityAiSuggestionsSchemaError();
  }
  if (error) throw error;
  return mapStagedAiRecommendation(data);
}

export async function fetchMeetingInsightActionStates(input = {}) {
  if (!input.accountId) return [];
  const { data, error } = await supabase
    .from("ai_insights")
    .select("id, status, summary, response, created_at, updated_at")
    .eq("account_id", input.accountId)
    .eq("scope", "account")
    .eq("focus", MEETING_INSIGHT_ACTION_FOCUS)
    .in("status", ["converted_to_action", "dismissed"])
    .limit(300);

  if (isMissingTableError(error)) return [];
  if (error) throw error;

  return (data ?? []).map((row) => {
    const response = getAiInsightResponse(row);
    return {
      id: row.id,
      status: row.status,
      sourceRef: response.sourceRef ?? "",
      title: response.title ?? row.summary ?? "",
    };
  });
}

export async function markMeetingInsightActionItemState(input = {}) {
  const accountId = input.accountId;
  if (!accountId) throw new Error("Account is required before saving meeting insight state.");

  const payload = buildMeetingInsightPayload(input);
  if (!payload.title) throw new Error("Meeting insight title is required.");
  const status = normalizeAiInsightStatus(input.status ?? "converted_to_action");

  const { data: existingRows, error: existingError } = await supabase
    .from("ai_insights")
    .select("*")
    .eq("account_id", accountId)
    .eq("scope", "account")
    .eq("focus", MEETING_INSIGHT_ACTION_FOCUS)
    .limit(300);

  if (isMissingTableError(existingError)) {
    return null;
  }
  if (existingError) throw existingError;

  const normalizedSourceRef = normalizeActivityDuplicateText(payload.sourceRef);
  const normalizedTitle = normalizeActivityDuplicateText(payload.title);
  const existing = (existingRows ?? []).find((row) => {
    const response = getAiInsightResponse(row);
    const rowSourceRef = normalizeActivityDuplicateText(response.sourceRef);
    const rowTitle = normalizeActivityDuplicateText(response.title ?? row.summary ?? row.prompt);
    return (
      (normalizedSourceRef && rowSourceRef === normalizedSourceRef) ||
      (normalizedTitle && rowTitle === normalizedTitle)
    );
  });

  if (existing) {
    const { data, error } = await supabase
      .from("ai_insights")
      .update({
        status,
        response: { ...getAiInsightResponse(existing), ...payload },
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  const row = {
    scope: "account",
    account_id: accountId,
    requested_by: input.requestedBy ?? null,
    prompt: payload.title,
    focus: MEETING_INSIGHT_ACTION_FOCUS,
    timeframe: "staged",
    summary: payload.title,
    risk_level: "medium",
    source: payload.sourceSummary || "Meeting Insight",
    response: payload,
    context_summary: {
      healthArea: payload.healthArea,
      expectedLift: payload.expectedLift,
    },
    status,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("ai_insights").insert(row).select("*").single();
  if (isMissingTableError(error)) return null;
  if (error) throw error;
  return data;
}
export async function fetchKamUsers() {
  const withStatus = await supabase.from("profiles").select("id, name, initials, role, is_active");

  if (!withStatus.error) {
    return (withStatus.data ?? [])
      .filter((user) => user.is_active !== false)
      .map((user) => ({ ...user, role: normalizeRole(user.role) }));
  }

  if (!isMissingColumnError(withStatus.error, "is_active")) throw withStatus.error;

  const { data, error } = await supabase.from("profiles").select("id, name, initials, role");
  if (error) throw error;
  return (data ?? []).map((user) => ({ ...user, role: normalizeRole(user.role) }));
}

function mapManagedUser(user) {
  return {
    id: user.id,
    name: user.name,
    initials: user.initials,
    role: normalizeRole(user.role),
    email: user.email ?? "",
    isActive: user.is_active ?? true,
    createdAt: user.created_at ?? null,
  };
}

export async function fetchUsers() {
  const withStatus = await supabase
    .from("profiles")
    .select("id, name, initials, role, email, is_active, created_at")
    .order("created_at", { ascending: false });

  if (!withStatus.error) return (withStatus.data ?? []).map(mapManagedUser);
  if (!isMissingColumnError(withStatus.error, "is_active")) throw withStatus.error;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, initials, role, email, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapManagedUser);
}

function isLegacyRoleEnumError(error) {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("invalid input value for enum") && message.includes("user_role");
}

function isMissingRpcError(error) {
  const message = error?.message?.toLowerCase() ?? "";
  return error?.code === "PGRST202" || message.includes("function") || message.includes("rpc");
}

function roleForLegacyEnum(role) {
  return normalizeRole(role);
}

export async function createUserProfile(user) {
  const normalizedRole = normalizeRole(user.role);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Please sign in again before creating users.");

  const authUser = await createManagedAuthUser({
    data: {
      name: user.name,
      email: user.email,
      role: normalizedRole,
      accessToken: session.access_token,
      redirectTo:
        typeof window !== "undefined" ? `${window.location.origin}/set-password` : undefined,
    },
  });
  return {
    ...mapManagedUser(authUser.profile),
    inviteSent: authUser.inviteSent,
  };
}

export async function updateUserRole(userId, role) {
  const normalizedRole = normalizeRole(role);
  const rpc = await supabase.rpc("update_managed_profile_role", {
    profile_id: userId,
    profile_role: normalizedRole,
  });
  if (!rpc.error) return;
  if (!isMissingRpcError(rpc.error)) throw rpc.error;

  const { error } = await supabase
    .from("profiles")
    .update({ role: normalizedRole })
    .eq("id", userId);
  if (!error) return;
  if (isLegacyRoleEnumError(error)) {
    const legacy = await supabase
      .from("profiles")
      .update({ role: roleForLegacyEnum(normalizedRole) })
      .eq("id", userId);
    if (legacy.error) throw legacy.error;
    return;
  }
  throw error;
}

export async function updateUserStatus(userId, isActive) {
  const rpc = await supabase.rpc("update_managed_profile_status", {
    profile_id: userId,
    profile_is_active: isActive,
  });
  if (!rpc.error) return;
  if (!isMissingRpcError(rpc.error)) throw rpc.error;

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", userId);
  if (error) throw error;
}
// --- delete account -----------------------------------------------------------
export async function deleteUserProfile(userId) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Please sign in again before deleting users.");

  return deleteManagedAuthUser({
    data: {
      userId,
      accessToken: session.access_token,
    },
  });
}

export async function deleteAccount(accountId) {
  const { error } = await supabase.from("accounts").delete().eq("id", accountId);
  if (error) throw error;
}
// --- update account KAM assignment -------------------------------------------
export async function updateAccountKam(accountId, kamId) {
  const { data: current, error: currentError } = await supabase
    .from("accounts")
    .select("assigned_kam_id")
    .eq("id", accountId)
    .maybeSingle();
  if (currentError) throw currentError;

  const { error } = await supabase
    .from("accounts")
    .update({ assigned_kam_id: kamId })
    .eq("id", accountId);
  if (error) throw error;

  if (kamId && current?.assigned_kam_id !== kamId) {
    await createAccountAssignmentNotifications(supabase, { accountId, kamId }).catch(() => null);
  }
}
// --- update health block (score + metrics + kpi checkbox state) --------------
export async function updateHealthBlock(accountId, area, score, metricUpdates, kpiData) {
  // Use maybeSingle so missing rows don't throw
  const { data: hs } = await supabase
    .from("health_scores")
    .select("id")
    .eq("account_id", accountId)
    .eq("area", area)
    .maybeSingle();

  if (hs) {
    // Row exists - update score + kpi_data
    const { error } = await supabase
      .from("health_scores")
      .update({ score, kpi_data: kpiData })
      .eq("id", hs.id);
    if (error) throw error;
  } else {
    // No row yet (new account) - insert one
    const { error } = await supabase
      .from("health_scores")
      .insert({ account_id: accountId, area, score, kpi_data: kpiData });
    if (error) throw error;
  }

  // Update existing metric rows (only present for accounts seeded with metrics)
  if (metricUpdates.length > 0) {
    await Promise.all(
      metricUpdates.map((mu) =>
        supabase
          .from("health_metrics")
          .update({ label: mu.label, value: mu.value })
          .eq("id", mu.id),
      ),
    );
  }

  // Recompute accounts.health as the average of all area scores (×10 to stay on 0-100 scale)
  const { data: allAreaScores } = await supabase
    .from("health_scores")
    .select("score")
    .eq("account_id", accountId);
  if (allAreaScores && allAreaScores.length > 0) {
    const avg = allAreaScores.reduce((acc, s) => acc + (s.score ?? 0), 0) / allAreaScores.length;
    const newHealth = parseFloat((avg * 10).toFixed(1));
    await supabase.from("accounts").update({ health: newHealth }).eq("id", accountId);
  }
}
// --- KPI section templates used when creating new accounts -------------------
const NEW_ACCOUNT_KPI_TEMPLATES = {
  relationship: [
    {
      name: "CEO & Executive Engagement",
      fields: [
        { label: "CEO-to-CEO meeting held this quarter", weight: 40 },
        { label: "Director-level meeting completed on schedule", weight: 35 },
        { label: "Executive sponsor actively engaged", weight: 25 },
      ],
    },
    {
      name: "Meeting Cadence",
      fields: [
        { label: "Monthly cadence meetings held on schedule", weight: 50 },
        { label: "Action items closed before next cycle", weight: 30 },
        { label: "Meeting notes shared within 24 hours", weight: 20 },
      ],
    },
    {
      name: "Cooperation & Trust",
      fields: [
        { label: "Client responsive to requests within 48 hours", weight: 60 },
        { label: "Joint planning or roadmap session completed", weight: 40 },
      ],
    },
  ],
  project: [
    {
      name: "Delivery Performance",
      fields: [
        { label: "Sprint or milestone delivered on time", weight: 50 },
        { label: "Defect rate within agreed threshold", weight: 30 },
        { label: "No critical production incidents this cycle", weight: 20 },
      ],
    },
    {
      name: "Quality & Feedback",
      fields: [
        { label: "Client feedback positive this cycle", weight: 55 },
        { label: "Feedback actioned and communicated back to client", weight: 45 },
      ],
    },
    {
      name: "Scope & Change Control",
      fields: [
        { label: "Change requests formally reviewed and documented", weight: 50 },
        { label: "No unmanaged scope creep this cycle", weight: 50 },
      ],
    },
  ],
  white_space: [
    {
      name: "Service Penetration",
      fields: [
        { label: "More than 3 active services currently delivered", weight: 50 },
        { label: "At least 1 new service proposed this quarter", weight: 50 },
      ],
    },
    {
      name: "Upsell & Growth Signals",
      fields: [
        { label: "Upsell opportunity identified and logged in CRM", weight: 50 },
        { label: "White-space pitch scheduled with decision maker", weight: 50 },
      ],
    },
    {
      name: "Account Intelligence",
      fields: [
        { label: "Account notes updated this month", weight: 40 },
        { label: "Competitive landscape reviewed", weight: 30 },
        { label: "Stakeholder map current and verified", weight: 30 },
      ],
    },
  ],
  contract: [
    {
      name: "Contract Terms",
      fields: [
        { label: "Auto-renew clause in place", weight: 35 },
        { label: "Non-terminator clause signed", weight: 35 },
        { label: "Minimum one-year lock confirmed", weight: 30 },
      ],
    },
    {
      name: "Compliance & Renewal",
      fields: [
        { label: "Process compliance score above 7 out of 10", weight: 50 },
        { label: "Renewal conversation initiated 90 days before expiry", weight: 50 },
      ],
    },
    {
      name: "Commercial Terms",
      fields: [
        { label: "Annual price-hike clause agreed and documented", weight: 55 },
        { label: "Annual contract review meeting scheduled", weight: 45 },
      ],
    },
  ],
  csat: [
    {
      name: "NPS & Surveys",
      fields: [
        { label: "NPS score collected and above 7 this quarter", weight: 45 },
        { label: "Quarterly satisfaction survey completed", weight: 35 },
        { label: "Low-score responses addressed within 2 weeks", weight: 20 },
      ],
    },
    {
      name: "Support Quality",
      fields: [
        { label: "Support tickets resolved within SLA", weight: 55 },
        { label: "CSAT rating of 4 or above on closed tickets", weight: 45 },
      ],
    },
    {
      name: "Executive Sentiment",
      fields: [
        { label: "Executive sponsor expressed positive sentiment", weight: 55 },
        { label: "No major complaints or unresolved escalations", weight: 45 },
      ],
    },
  ],
  risk: [
    {
      name: "Competitive Risk",
      fields: [
        { label: "Competitor activity monitored and documented", weight: 45 },
        { label: "Defense strategy or counter-proposal ready", weight: 55 },
      ],
    },
    {
      name: "Relationship & POC Risk",
      fields: [
        { label: "Key POC stable - no resignation or transfer risk", weight: 50 },
        { label: "C-level sponsor accessible and engaged", weight: 50 },
      ],
    },
    {
      name: "Financial Risk",
      fields: [
        { label: "Invoice paid within agreed payment terms", weight: 55 },
        { label: "No overdue balance outstanding", weight: 45 },
      ],
    },
    {
      name: "Operational Risk",
      fields: [
        { label: "Compliance and regulatory requirements met", weight: 50 },
        { label: "No geopolitical disruptions impacting delivery", weight: 50 },
      ],
    },
  ],
  resource: [
    {
      name: "Backup & Continuity",
      fields: [
        { label: "Backup engineer assigned for every critical role", weight: 55 },
        { label: "Knowledge transfer documentation up to date", weight: 45 },
      ],
    },
    {
      name: "Staffing Stability",
      fields: [
        { label: "No unplanned attrition on account this month", weight: 50 },
        { label: "Planned leaves managed without delivery impact", weight: 50 },
      ],
    },
    {
      name: "Critical Resource Retention",
      fields: [
        { label: "Critical resources engaged and retained", weight: 55 },
        { label: "Succession plan in place for key technical roles", weight: 45 },
      ],
    },
  ],
  financial: [
    {
      name: "Revenue Performance",
      fields: [
        { label: "Monthly billing target met", weight: 50 },
        { label: "ARR growth on track versus annual plan", weight: 50 },
      ],
    },
    {
      name: "Margin & Efficiency",
      fields: [
        { label: "Resource utilization above 80 percent", weight: 50 },
        { label: "Cost overruns within 5 percent of budget", weight: 50 },
      ],
    },
    {
      name: "Commercial Growth",
      fields: [
        { label: "Upsell or expansion proposal submitted this quarter", weight: 55 },
        { label: "Renewal pipeline initiated before 90-day mark", weight: 45 },
      ],
    },
  ],
};
function buildNewAccountKpiData(area) {
  const templates = NEW_ACCOUNT_KPI_TEMPLATES[area] ?? NEW_ACCOUNT_KPI_TEMPLATES.relationship;
  return templates.map((tmpl, i) => ({
    id: `kpi-${area}-${i}`,
    name: tmpl.name,
    metricId: null,
    fields: tmpl.fields.map((f, j) => ({
      id: `${area}-${i}-${j}`,
      label: f.label,
      weight: f.weight,
      checked: false,
    })),
  }));
}
const HEALTH_AREAS = [
  "relationship",
  "project",
  "white_space",
  "contract",
  "csat",
  "risk",
  "resource",
  "financial",
];

// --- create new account -------------------------------------------------------
export async function createAccount(data) {
  const { error } = await supabase.from("accounts").insert([
    {
      id: data.id,
      name: data.name,
      short_code: data.shortCode,
      industry: data.industry,
      tier: data.tier,
      health: 50,
      trend: 0,
      contract_value: data.contractValue,
      arr: data.arr,
      renewal_days: data.renewalDays || null,
      renewal_date: data.contractRenewalDate || null,
      contract_duration: data.contractDuration || null,
      contract_type: data.contractType,
      last_touch: "Just now",
      status: "healthy",
      retention_risk: "Low",
      growth_upside: 0,
      white_space_count: 0,
      is_startup: false,
      region: data.region || null,
      primary_contact_name: data.primaryContactName || null,
      linkedin_url: data.linkedinUrl || null,
      linkedin_summary: data.linkedinSummary || null,
      ...(data.linkedinSummaryUpdatedAt
        ? { linkedin_summary_updated_at: data.linkedinSummaryUpdatedAt }
        : {}),
      ...(data.websiteUrl ? { website_url: data.websiteUrl } : {}),
      ...(data.websiteSummary ? { website_summary: data.websiteSummary } : {}),
      ...(data.websiteSummaryUpdatedAt
        ? { website_summary_updated_at: data.websiteSummaryUpdatedAt }
        : {}),
      assigned_kam_id: data.assignedKamId || null,
    },
  ]);
  if (error) throw error;

  const { error: contractError } = await supabase.from("contract_details").upsert(
    {
      account_id: data.id,
      type: data.contractType,
      duration: data.contractDuration || null,
      renewal_date: data.contractRenewalDate || null,
    },
    { onConflict: "account_id" },
  );
  if (contractError) throw contractError;

  // Pre-populate health_scores for all 8 areas so KPI sections show immediately
  const { error: hsError } = await supabase.from("health_scores").insert(
    HEALTH_AREAS.map((area) => ({
      account_id: data.id,
      area,
      score: 0,
      kpi_data: buildNewAccountKpiData(area),
    })),
  );
  if (hsError) throw hsError;

  if (data.assignedKamId) {
    await createAccountAssignmentNotifications(supabase, {
      accountId: data.id,
      kamId: data.assignedKamId,
    }).catch(() => null);
  }

  if (data.contractRenewalDate) {
    await ensureContractRenewalNotifications(supabase).catch(() => null);
  }
}

// --- update account KYC fields -----------------------------------------------
const CONTRACT_DETAIL_UPDATE_COLUMNS = new Set([
  "auto_renew",
  "non_terminator",
  "min_one_year",
  "price_hike",
  "backup_exists",
  "critical_resources",
  "customer_feedback",
]);
export async function updateAccountKyc(accountId, updates) {
  const accountUpdates = Object.fromEntries(
    Object.entries(updates).filter(([key]) => !CONTRACT_DETAIL_UPDATE_COLUMNS.has(key)),
  );
  if (Object.keys(accountUpdates).length > 0) {
    const { error } = await supabase.from("accounts").update(accountUpdates).eq("id", accountId);
    if (error) throw error;
  }

  const contractUpdates = { account_id: accountId };
  if (Object.prototype.hasOwnProperty.call(updates, "contract_type")) {
    contractUpdates.type = updates.contract_type;
  }
  if (Object.prototype.hasOwnProperty.call(updates, "contract_duration")) contractUpdates.duration = updates.contract_duration;
  if (
    Object.prototype.hasOwnProperty.call(updates, "renewal_date") ||
    Object.prototype.hasOwnProperty.call(updates, "contract_renewal_date")
  ) {
    contractUpdates.renewal_date = updates.renewal_date ?? updates.contract_renewal_date;
  }
  CONTRACT_DETAIL_UPDATE_COLUMNS.forEach((column) => {
    if (Object.prototype.hasOwnProperty.call(updates, column)) contractUpdates[column] = updates[column];
  });
  if (Object.keys(contractUpdates).length > 1) {
    contractUpdates.updated_at = new Date().toISOString();
    const { error: contractError } = await supabase
      .from("contract_details")
      .upsert(contractUpdates, { onConflict: "account_id" });
    if (contractError) throw contractError;
  }

  if (
    Object.prototype.hasOwnProperty.call(updates, "renewal_date") ||
    Object.prototype.hasOwnProperty.call(updates, "contract_renewal_date")
  ) {
    await ensureContractRenewalNotifications(supabase).catch(() => null);
  }
}
export async function applySowFields(accountId, fields) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Please sign in again before applying SOW fields.");

  return applySowFieldsServer({
    data: {
      accountId,
      fields,
      accessToken: session.access_token,
    },
  });
}
export async function syncSalesforceMappedFields(accountId, payload, accessTokenOverride) {
  let accessToken = accessTokenOverride;
  if (!accessToken) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    accessToken = session?.access_token;
  }
  if (!accessToken) throw new Error("Please sign in again before syncing Salesforce fields.");

  return syncSalesforceMappedFieldsServer({
    data: {
      accountId,
      payload,
      accessToken,
    },
  });
}
export async function generateAccountLinkedinSummary(accountId) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Please sign in again before generating a LinkedIn summary.");
  }

  return generateLinkedinSummaryServer({
    data: {
      accountId,
      accessToken: session.access_token,
    },
  });
}
// --- fetch single account (full shape) ---------------------------------------
export async function generateAccountWebsiteSummary(accountId) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Please sign in again before generating a website summary.");
  }

  return generateWebsiteSummaryServer({
    data: {
      accountId,
      accessToken: session.access_token,
    },
  });
}

const STAKEHOLDER_INFLUENCE_VALUES = new Set([
  "Champion",
  "Decision Maker",
  "Influencer",
  "Blocker",
]);

function normalizeStakeholderText(value) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function normalizeStakeholderInfluence(value) {
  return STAKEHOLDER_INFLUENCE_VALUES.has(value) ? value : "Influencer";
}

function normalizeStakeholderPayload(values = {}) {
  return {
    name: normalizeStakeholderText(values.name),
    role: normalizeStakeholderText(values.role),
    influence: normalizeStakeholderInfluence(values.influence),
    email: normalizeStakeholderText(values.email),
    phone: normalizeStakeholderText(values.phone),
    last_contact: normalizeStakeholderText(values.lastContact ?? values.last_contact),
  };
}

function mapStakeholderRow(row) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    influence: row.influence,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    lastContact: row.last_contact ?? undefined,
  };
}

export async function createStakeholder(accountId, values) {
  const id = normalizeStakeholderText(accountId);
  if (!id) throw new Error("Account id is required.");

  const payload = normalizeStakeholderPayload(values);
  if (!payload.name) throw new Error("Stakeholder name is required.");
  if (!payload.role) throw new Error("Stakeholder role is required.");

  const { data, error } = await supabase
    .from("stakeholders")
    .insert({
      account_id: id,
      ...payload,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapStakeholderRow(data);
}

export async function updateStakeholder(stakeholderId, values) {
  const id = normalizeStakeholderText(stakeholderId);
  if (!id) throw new Error("Stakeholder id is required.");

  const payload = normalizeStakeholderPayload(values);
  if (!payload.name) throw new Error("Stakeholder name is required.");
  if (!payload.role) throw new Error("Stakeholder role is required.");

  const { data, error } = await supabase
    .from("stakeholders")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return mapStakeholderRow(data);
}

export async function deleteStakeholder(stakeholderId) {
  const id = normalizeStakeholderText(stakeholderId);
  if (!id) throw new Error("Stakeholder id is required.");

  const { error } = await supabase.from("stakeholders").delete().eq("id", id);
  if (error) throw error;
  return id;
}
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
    if (!s) return { score: 0, metrics: [], kpiData: null, updatedAt: null };

    // When kpi_data exists, derive progress bars from it so ScoreBlock always
    // mirrors what the KPI editor shows - section name + weighted checkbox score.
    if (Array.isArray(s.kpi_data) && s.kpi_data.length > 0) {
      const derived = s.kpi_data.map((sec, i) => {
        const fields = sec.fields ?? [];
        const totalWeight = fields.reduce((a, f) => a + (Number(f.weight) || 0), 0);
        const earned = fields.reduce((a, f) => a + (f.checked ? Number(f.weight) || 0 : 0), 0);
        const pct = totalWeight > 0 ? (earned / totalWeight) * 100 : 0;
        return {
          id: `derived-${i}`,
          label: sec.name,
          value: parseFloat(((pct / 100) * 10).toFixed(1)),
        };
      });
      return mapHealthBlock(s.score, derived, s.kpi_data, s.updated_at);
    }

    // Fallback: use raw health_metrics rows (accounts with no kpi_data saved yet)
    return mapHealthBlock(s.score, s.health_metrics ?? [], s.kpi_data, s.updated_at);
  };
  const flat = mapFlatAccount(acc);
  return {
    ...flat,
    stakeholders: (stakeholders ?? []).map(mapStakeholderRow),
    relationshipHealth: block("relationship"),
    projectHealth: block("project"),
    whiteSpace: block("white_space"),
    contractScoring: {
      ...block("contract"),
      type: cd?.type ?? flat.contractType ?? "",
      duration: flat.contractDuration || cd?.duration || "",
      renewalDate: flat.contractRenewalDate ?? cd?.renewal_date ?? null,
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
// --- fetch escalations --------------------------------------------------------
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
// --- fetch opportunities ------------------------------------------------------
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
    potential: o.potential ?? null,
    confidence: o.confidence,
    nextStep: o.next_step ?? "",
  }));
}

export async function upsertOpportunitiesFromMeetingAgent({
  accountId,
  opportunities,
  editedBy = "System",
}) {
  if (!opportunities?.length) return [];

  const rows = opportunities.map((opportunity) => ({
    id: opportunity.id,
    account_id: accountId,
    title: opportunity.title,
    source: opportunity.source,
    signal_date: opportunity.signalDate,
    potential: opportunity.potential ?? null,
    confidence: opportunity.confidence ?? "Medium",
    next_step: opportunity.nextStep,
  }));

  const { data, error } = await supabase
    .from("opportunities")
    .upsert(rows, { onConflict: "id" })
    .select("*");
  if (error) throw error;
  const savedOpportunities = (data ?? []).map((o) => ({
    id: o.id,
    accountId: o.account_id,
    title: o.title,
    source: o.source ?? "",
    signalDate: o.signal_date ?? "",
    potential: o.potential ?? null,
    confidence: o.confidence,
    nextStep: o.next_step ?? "",
  }));
  await logAccountChanges(
    accountId,
    savedOpportunities.map((opportunity) => ({
      field: "Opportunity saved",
      oldValue: null,
      newValue: summarizeOpportunityHistory(opportunity),
    })),
    editedBy,
  );
  return savedOpportunities;
}

function firstRelatedRow(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function buildRetentionGrowthReasonPayload({ model, opportunities, escalations }) {
  return {
    trigger: "account_retention_growth_recalculation",
    rules: {
      retention:
        "Health, renewal proximity, CSAT, risk score, financial score, relationship score, escalations, competitor pressure, and churn/renewal signals.",
      growth:
        "Whitespace count, growth upside, applicable-but-not-offered services, meeting cadence, current service proof, and opportunity pipeline.",
    },
    signals: {
      retention: model.retentionSignals.map((signal) => ({
        id: signal.id,
        level: signal.level,
        title: signal.title,
      })),
      growth: model.growthSignals.map((signal) => ({
        id: signal.id,
        level: signal.level,
        title: signal.title,
      })),
    },
    counts: {
      opportunities: opportunities.length,
      escalations: escalations.length,
      applicableGrowth: model.applicableGrowth.length,
      recommendedOffers: model.recommendedOffers.length,
    },
  };
}

function buildAccountRetentionGrowthUpdate({ model, opportunities, escalations }) {
  const dashboard = model.dashboard;
  const nextAction =
    dashboard.actionRows[0]?.recommendedAction ||
    dashboard.matrix?.recommendedAction ||
    "Maintain account engagement and monitor for new signals.";

  return {
    retention_health_score: dashboard.retentionScore,
    calculated_retention_risk: dashboard.riskLevel,
    retention_risk: dashboard.riskLevel,
    growth_potential_score: dashboard.growthScore,
    growth_potential_level: dashboard.growthLevel,
    revenue_at_risk: dashboard.revenueAtRisk,
    growth_pipeline_value: dashboard.growthPipeline,
    retention_growth_quadrant: dashboard.matrix?.quadrant ?? null,
    retention_growth_next_action: nextAction,
    retention_growth_calculated_at: new Date().toISOString(),
    retention_growth_calculation_reason: buildRetentionGrowthReasonPayload({
      model,
      opportunities,
      escalations,
    }),
  };
}

export async function refreshAccountRetentionGrowthScoring(accountId, editedBy = "System") {
  const [account, opportunities, escalations] = await Promise.all([
    fetchAccount(accountId),
    fetchOpportunities(accountId),
    fetchEscalations(accountId),
  ]);

  if (!account) throw new Error("Account not found for retention/growth scoring.");

  const model = buildRetentionGrowthTabModel({ account, opportunities, escalations });
  const update = buildAccountRetentionGrowthUpdate({ model, opportunities, escalations });
  const { data, error } = await supabase
    .from("accounts")
    .update(update)
    .eq("id", accountId)
    .select("*")
    .single();
  if (error) throw error;

  await logAccountChanges(
    accountId,
    [
      {
        field: "Retention/Growth retention score",
        oldValue: String(account.retentionHealthScore ?? ""),
        newValue: String(update.retention_health_score ?? ""),
      },
      {
        field: "Retention/Growth risk level",
        oldValue: account.calculatedRetentionRisk ?? account.retentionRisk ?? "",
        newValue: update.calculated_retention_risk ?? "",
      },
      {
        field: "Retention/Growth growth score",
        oldValue: String(account.growthPotentialScore ?? ""),
        newValue: String(update.growth_potential_score ?? ""),
      },
      {
        field: "Retention/Growth growth level",
        oldValue: account.growthPotentialLevel ?? "",
        newValue: update.growth_potential_level ?? "",
      },
      {
        field: "Retention/Growth revenue at risk",
        oldValue: String(account.revenueAtRisk ?? ""),
        newValue: String(update.revenue_at_risk ?? ""),
      },
      {
        field: "Retention/Growth pipeline value",
        oldValue: String(account.growthPipelineValue ?? ""),
        newValue: String(update.growth_pipeline_value ?? ""),
      },
      {
        field: "Retention/Growth quadrant",
        oldValue: account.retentionGrowthQuadrant ?? "",
        newValue: update.retention_growth_quadrant ?? "",
      },
      {
        field: "Retention/Growth next action",
        oldValue: account.retentionGrowthNextAction ?? "",
        newValue: update.retention_growth_next_action ?? "",
      },
    ],
    editedBy,
  );

  return {
    account: mapFlatAccount(data),
    dashboard: model.dashboard,
    update,
  };
}

export async function refreshAllAccountRetentionGrowthScoring(opts) {
  const accounts = await fetchAccounts(opts);
  const results = [];

  for (const account of accounts) {
    try {
      results.push(await refreshAccountRetentionGrowthScoring(account.id));
    } catch (error) {
      results.push({
        accountId: account.id,
        failed: true,
        error: error?.message ?? "Unknown scoring error",
      });
    }
  }

  return results;
}
export async function fetchContracts(opts) {
  let q = supabase
    .from("accounts")
    .select(
      "*, contract_details(duration, renewal_date, auto_renew, non_terminator, min_one_year, price_hike, backup_exists, critical_resources, customer_feedback)",
    );
  if (opts?.role === "KAM" && opts.userId) {
    q = q.eq("assigned_kam_id", opts.userId);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((row) => {
    const cd = firstRelatedRow(row.contract_details);
    return {
      ...mapFlatAccount(row),
      duration: row.contract_duration ?? cd?.duration ?? "—",
      renewalDate: row.renewal_date ?? row.contract_renewal_date ?? cd?.renewal_date ?? null,
      autoRenew: Boolean(cd?.auto_renew),
      nonTerminator: Boolean(cd?.non_terminator),
      minOneYear: Boolean(cd?.min_one_year),
      priceHike: cd?.price_hike ?? "-",
      backupExists: Boolean(cd?.backup_exists),
      criticalResources: cd?.critical_resources ?? 0,
      customerFeedback: cd?.customer_feedback ?? "",
    };
  });
}

const CONTRACT_TYPE_VALUES = new Set(["Staff Augmented", "Time Based", "Retainer", "Project"]);

function normalizeContractText(value) {
  return String(value ?? "").trim();
}

function normalizeContractDate(value) {
  const text = normalizeContractText(value);
  return text ? text.slice(0, 10) : null;
}

function normalizeContractMoney(value) {
  const amount = Number(String(value ?? "").replace(/[$,\s]/g, ""));
  if (!Number.isFinite(amount) || amount < 0) throw new Error("Contract value must be a valid number.");
  return Math.round(amount);
}

function normalizeContractScore(value) {
  if (value === "" || value === null || value === undefined) return null;
  const score = Number(value);
  if (!Number.isFinite(score) || score < 0 || score > 10) {
    throw new Error("Process compliance must be between 0 and 10.");
  }
  return Number(score.toFixed(1));
}

function normalizeContractInteger(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error("Critical resources must be a valid number.");
  }
  return Math.round(number);
}

function mapContractDetail(row) {
  if (!row) return null;
  const cd = firstRelatedRow(row.contract_details);
  return {
    ...mapFlatAccount(row),
    duration: row.contract_duration ?? cd?.duration ?? "",
    renewalDate: row.renewal_date ?? row.contract_renewal_date ?? cd?.renewal_date ?? null,
    autoRenew: Boolean(cd?.auto_renew),
    nonTerminator: Boolean(cd?.non_terminator),
    minOneYear: Boolean(cd?.min_one_year),
    priceHike: cd?.price_hike ?? "",
    backupExists: Boolean(cd?.backup_exists),
    criticalResources: cd?.critical_resources ?? 0,
    customerFeedback: cd?.customer_feedback ?? "",
    updatedAt: cd?.updated_at ?? row.updated_at ?? null,
  };
}

export async function fetchContractDetail(accountId, opts = {}) {
  const id = normalizeContractText(accountId);
  if (!id) throw new Error("Account id is required.");

  let q = supabase.from("accounts").select("*, contract_details(*)").eq("id", id);
  if (opts?.role === "KAM" && opts.userId) {
    q = q.eq("assigned_kam_id", opts.userId);
  }

  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return mapContractDetail(data);
}

function displayContractBoolean(value) {
  return value ? "Yes" : "No";
}

function displayContractMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  return `$${amount.toLocaleString("en-US")}`;
}

function displayContractText(value) {
  return normalizeContractText(value);
}

function displayContractDate(value) {
  return value ? String(value).slice(0, 10) : "";
}

function buildContractHistoryChanges(current, next) {
  const rows = [
    {
      field: "Contract Type",
      oldValue: displayContractText(current.contractType),
      newValue: displayContractText(next.accountUpdates.contract_type),
    },
    {
      field: "Contract Duration",
      oldValue: displayContractText(current.duration),
      newValue: displayContractText(next.accountUpdates.contract_duration),
    },
    {
      field: "Contract Value",
      oldValue: displayContractMoney(current.contractValue),
      newValue: displayContractMoney(next.accountUpdates.contract_value),
    },
    {
      field: "Contract Renewal Date",
      oldValue: displayContractDate(current.renewalDate),
      newValue: displayContractDate(next.accountUpdates.renewal_date),
    },
    {
      field: "Contract Process Compliance",
      oldValue: displayContractText(current.contractCompliance),
      newValue: displayContractText(next.accountUpdates.contract_compliance),
    },
    {
      field: "Auto Renew",
      oldValue: displayContractBoolean(current.autoRenew),
      newValue: displayContractBoolean(next.contractUpdates.auto_renew),
    },
    {
      field: "Non Terminator",
      oldValue: displayContractBoolean(current.nonTerminator),
      newValue: displayContractBoolean(next.contractUpdates.non_terminator),
    },
    {
      field: "Minimum One Year",
      oldValue: displayContractBoolean(current.minOneYear),
      newValue: displayContractBoolean(next.contractUpdates.min_one_year),
    },
    {
      field: "Price Hike",
      oldValue: displayContractText(current.priceHike),
      newValue: displayContractText(next.contractUpdates.price_hike),
    },
    {
      field: "Backup Exists",
      oldValue: displayContractBoolean(current.backupExists),
      newValue: displayContractBoolean(next.contractUpdates.backup_exists),
    },
    {
      field: "Critical Resources",
      oldValue: displayContractText(current.criticalResources),
      newValue: displayContractText(next.contractUpdates.critical_resources),
    },
    {
      field: "Customer Feedback",
      oldValue: displayContractText(current.customerFeedback),
      newValue: displayContractText(next.contractUpdates.customer_feedback),
    },
  ];

  return rows.filter((row) => row.oldValue !== row.newValue);
}

function normalizeContractDetailUpdates(values = {}) {
  const contractType = normalizeContractText(values.contractType);
  if (!CONTRACT_TYPE_VALUES.has(contractType)) {
    throw new Error("Select a valid contract type.");
  }

  const duration = normalizeContractText(values.duration);
  const renewalDate = normalizeContractDate(values.renewalDate);
  const contractValue = normalizeContractMoney(values.contractValue);
  const contractCompliance = normalizeContractScore(values.contractCompliance);
  const priceHike = normalizeContractText(values.priceHike);
  const customerFeedback = normalizeContractText(values.customerFeedback);
  const criticalResources = normalizeContractInteger(values.criticalResources);

  return {
    accountUpdates: {
      contract_type: contractType,
      contract_duration: duration,
      contract_value: contractValue,
      renewal_date: renewalDate,
      contract_compliance: contractCompliance,
    },
    contractUpdates: {
      type: contractType,
      duration,
      renewal_date: renewalDate,
      auto_renew: Boolean(values.autoRenew),
      non_terminator: Boolean(values.nonTerminator),
      min_one_year: Boolean(values.minOneYear),
      price_hike: priceHike,
      backup_exists: Boolean(values.backupExists),
      critical_resources: criticalResources,
      customer_feedback: customerFeedback,
    },
  };
}

export async function updateContractDetail(accountId, values, options = {}) {
  const role = normalizeRole(options.role);
  const userId = normalizeContractText(options.userId);
  if (role !== "Head of KAM" && role !== "KAM") {
    throw new Error("Only Head of KAM or the assigned KAM can edit contract details.");
  }
  if (role === "KAM" && !userId) {
    throw new Error("Assigned KAM identity is required before editing contract details.");
  }

  const id = normalizeContractText(accountId);
  if (!id) throw new Error("Account id is required.");

  const current = await fetchContractDetail(id, options);
  if (!current) throw new Error("Contract account was not found.");
  if (role === "KAM" && current.assignedKamId !== userId) {
    throw new Error("Only the assigned KAM can edit this account's contract details.");
  }

  const updates = normalizeContractDetailUpdates(values);
  const changes = buildContractHistoryChanges(current, updates);

  const { error: accountError } = await supabase.from("accounts").update(updates.accountUpdates).eq("id", id);
  if (accountError) throw accountError;

  const { error: contractError } = await supabase
    .from("contract_details")
    .upsert(
      {
        account_id: id,
        ...updates.contractUpdates,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "account_id" },
    );
  if (contractError) throw contractError;

  if (changes.length > 0) {
    await logAccountChanges(id, changes, options.editedBy ?? "Unknown");
  }

  if (displayContractDate(current.renewalDate) !== displayContractDate(updates.accountUpdates.renewal_date)) {
    await ensureContractRenewalNotifications(supabase).catch(() => null);
  }

  return fetchContractDetail(id, options);
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
  const rows = (changes ?? [])
    .map((c) => ({
      field: String(c.field ?? "").trim(),
      oldValue: c.oldValue === undefined || c.oldValue === null ? null : String(c.oldValue),
      newValue: c.newValue === undefined || c.newValue === null ? null : String(c.newValue),
    }))
    .filter((c) => c.field && c.oldValue !== c.newValue);

  if (rows.length === 0) return;
  const { error } = await supabase.from("account_history").insert(
    rows.map((c) => ({
      account_id: accountId,
      field_name: c.field,
      old_value: c.oldValue,
      new_value: c.newValue,
      edited_by: editedBy ?? "Unknown",
    })),
  );
  if (error) throw error;
}

function compactAccountHistoryParts(parts) {
  return parts
    .map((part) => (part === null || part === undefined ? "" : String(part).trim()))
    .filter(Boolean)
    .join(" | ");
}

function formatHistoryDateValue(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function summarizeMeetingHistory(row = {}) {
  return compactAccountHistoryParts([
    row.title ? `Title: ${row.title}` : null,
    row.meeting_date ? `Date: ${formatHistoryDateValue(row.meeting_date)}` : null,
    row.synced_at ? `Synced: ${formatHistoryDateValue(row.synced_at)}` : null,
    Array.isArray(row.derived_action_items)
      ? `Action items: ${row.derived_action_items.length}`
      : null,
    Array.isArray(row.derived_opportunities)
      ? `Opportunities: ${row.derived_opportunities.length}`
      : null,
    row.short_summary ? `Summary: ${row.short_summary}` : null,
  ]);
}

function summarizeRuleActivityHistory(activity = {}) {
  return compactAccountHistoryParts([
    activity.title ? `Title: ${activity.title}` : null,
    activity.parameter ? `Area: ${activity.parameter}` : null,
    activity.status ? `Status: ${activity.status}` : null,
    activity.owner ? `Owner: ${activity.owner}` : null,
    activity.dueDate ? `Due: ${activity.dueDate}` : null,
    activity.rag ? `RAG: ${activity.rag}` : null,
    activity.expectedLift ? `Expected lift: ${activity.expectedLift}` : null,
    activity.nextStep ? `Next step: ${activity.nextStep}` : null,
  ]);
}

function summarizeOpportunityHistory(opportunity = {}) {
  return compactAccountHistoryParts([
    opportunity.title ? `Title: ${opportunity.title}` : null,
    opportunity.source ? `Source: ${opportunity.source}` : null,
    opportunity.signalDate ? `Signal date: ${opportunity.signalDate}` : null,
    opportunity.potential !== null && opportunity.potential !== undefined
      ? `Potential: ${opportunity.potential}`
      : null,
    opportunity.confidence ? `Confidence: ${opportunity.confidence}` : null,
    opportunity.nextStep ? `Next step: ${opportunity.nextStep}` : null,
  ]);
}

function summarizeRetentionGrowthDraftHistory(draft = {}) {
  return compactAccountHistoryParts([
    draft.kind ? `Type: ${draft.kind}` : null,
    draft.title ? `Title: ${draft.title}` : null,
    draft.owner ? `Owner: ${draft.owner}` : null,
    draft.dueDate ? `Due: ${draft.dueDate}` : null,
    draft.potentialValueLabel ? `Potential: ${draft.potentialValueLabel}` : null,
    draft.approvalState ? `Approval: ${draft.approvalState}` : null,
    draft.nextStep ? `Next step: ${draft.nextStep}` : null,
  ]);
}

function summarizeEducationHistory(session = {}) {
  return compactAccountHistoryParts([
    session.date ? `Date: ${session.date}` : null,
    session.topic ? `Topic: ${session.topic}` : null,
    session.approach ? `Approach: ${session.approach}` : null,
    session.outcome ? `Outcome: ${session.outcome}` : null,
  ]);
}

function summarizeTaskHistory(task = {}) {
  return compactAccountHistoryParts([
    task.title ? `Title: ${task.title}` : null,
    task.description ? `Description: ${task.description}` : null,
    task.reason ? `Reason: ${task.reason}` : null,
    task.source ? `Source: ${task.source}` : null,
    task.healthArea ? `Area: ${task.healthArea}` : null,
    task.expectedLift ? `Expected lift: ${task.expectedLift}` : null,
  ]);
}

export async function fetchAccountTasksForAiSuggestions(accountId) {
  if (!accountId) return [];

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("account_id", accountId)
    .limit(100);

  if (error) {
    if (error.code === "42P01" || error.code === "42703") return [];
    throw error;
  }

  return (data ?? []).map((row, index) => mapAccountTaskForAiSuggestion(row, index, accountId));
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

export async function upsertFirefliesMeetingSummaries(accountId, meetings, editedBy = "System") {
  if (!meetings?.length) return [];
  const transcriptIds = meetings.map((meeting) => meeting.transcriptId).filter(Boolean);
  const existingByTranscriptId = new Map();
  if (transcriptIds.length) {
    const { data: existingRows, error: existingError } = await supabase
      .from("fireflies_meeting_summaries")
      .select("*")
      .eq("account_id", accountId)
      .in("fireflies_transcript_id", transcriptIds);
    if (existingError) throw existingError;
    (existingRows ?? []).forEach((row) =>
      existingByTranscriptId.set(row.fireflies_transcript_id, row),
    );
  }

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
  await logAccountChanges(
    accountId,
    (data ?? []).map((row) => {
      const existing = existingByTranscriptId.get(row.fireflies_transcript_id);
      return {
        field: existing ? `Meeting note updated: ${row.title}` : "Meeting note synced",
        oldValue: existing ? summarizeMeetingHistory(existing) : null,
        newValue: summarizeMeetingHistory(row),
      };
    }),
    editedBy,
  );
  return (data ?? []).map(mapFirefliesMeetingSummary);
}

export async function logFirefliesWebhookEvent(input = {}) {
  const row = {
    fireflies_transcript_id: input.transcriptId ?? null,
    event_type: input.eventType ?? "meeting_ready",
    status: input.status ?? "received",
    matched_account_id: input.accountId ?? null,
    match_score: input.matchScore ?? null,
    title: input.title ?? null,
    payload: input.payload ?? {},
    diagnostics: input.diagnostics ?? {},
    error_message: input.errorMessage ?? null,
  };

  const { data, error } = await supabase
    .from("fireflies_webhook_events")
    .insert(row)
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.code === "42P01") {
      console.warn(
        "Fireflies webhook event log table is missing. Run src/db/add-fireflies-webhook-events.sql.",
      );
      return null;
    }
    throw error;
  }

  return data ?? null;
}

export async function fetchRetentionGrowthDrafts(accountId) {
  if (!accountId) return [];
  const { data, error } = await supabase
    .from("retention_growth_drafts")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });

  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }

  return (data ?? []).map(mapRetentionGrowthDraft);
}

export async function upsertRetentionGrowthDraft(accountId, draft, createdBy = "Unknown") {
  if (!accountId) throw new Error("Account id is required to save a retention/growth draft.");
  if (!draft?.id) throw new Error("Draft id is required.");
  const { data: existingDraft } = await supabase
    .from("retention_growth_drafts")
    .select("*")
    .eq("id", draft.id)
    .maybeSingle();

  const now = new Date().toISOString();
  const row = {
    id: draft.id,
    account_id: accountId,
    kind: draft.kind,
    title: draft.title,
    owner: draft.owner,
    due_date: draft.dueDate,
    next_step: draft.nextStep,
    potential_value_label: draft.potentialValueLabel,
    reason: draft.reason,
    evidence: draft.evidence ?? [],
    offer_type: draft.offerType,
    approval_state: draft.approvalState,
    created_by: createdBy,
    created_at: draft.createdAt ?? now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("retention_growth_drafts")
    .upsert(row, { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw error;
  const savedDraft = mapRetentionGrowthDraft(data);
  await logAccountChanges(
    accountId,
    [
      {
        field: existingDraft
          ? `Retention/Growth draft updated: ${savedDraft.title}`
          : "Retention/Growth draft created",
        oldValue: existingDraft
          ? summarizeRetentionGrowthDraftHistory(mapRetentionGrowthDraft(existingDraft))
          : null,
        newValue: summarizeRetentionGrowthDraftHistory(savedDraft),
      },
    ],
    createdBy,
  );
  return savedDraft;
}

export async function deleteFirefliesMeetingHistory({
  accountId,
  meetingIds,
  deleteActionItems = false,
  deleteOpportunities = false,
  editedBy = "Unknown",
}) {
  if (!accountId) throw new Error("Account id is required to delete meeting history.");

  let query = supabase.from("fireflies_meeting_summaries").select("*").eq("account_id", accountId);
  if (meetingIds?.length) query = query.in("id", meetingIds);

  const { data: meetingRows, error: meetingFetchError } = await query;
  if (meetingFetchError) throw meetingFetchError;

  const meetings = meetingRows ?? [];
  const idsToDelete = meetings.map((meeting) => meeting.id).filter(Boolean);
  if (!idsToDelete.length) {
    return { meetingsDeleted: 0, actionItemsDeleted: 0, opportunitiesDeleted: 0 };
  }

  const actionRefs = meetings
    .flatMap((meeting) => meeting.derived_action_items ?? [])
    .map((item) => item.id)
    .filter(Boolean);
  const opportunityIds = meetings
    .flatMap((meeting) => meeting.derived_opportunities ?? [])
    .map((item) => item.id)
    .filter(Boolean);

  let actionItemsDeleted = 0;
  let opportunitiesDeleted = 0;

  if (deleteActionItems && actionRefs.length) {
    const { data, error } = await supabase
      .from("activity_rule_activities")
      .delete()
      .eq("account_id", accountId)
      .in("source_ref", actionRefs)
      .select("id");
    if (error) throw error;
    actionItemsDeleted = data?.length ?? 0;
  }

  if (deleteOpportunities && opportunityIds.length) {
    const { data, error } = await supabase
      .from("opportunities")
      .delete()
      .eq("account_id", accountId)
      .in("id", opportunityIds)
      .select("id");
    if (error) throw error;
    opportunitiesDeleted = data?.length ?? 0;
  }

  const { data: deletedMeetings, error: deleteMeetingsError } = await supabase
    .from("fireflies_meeting_summaries")
    .delete()
    .eq("account_id", accountId)
    .in("id", idsToDelete)
    .select("id");
  if (deleteMeetingsError) throw deleteMeetingsError;

  const result = {
    meetingsDeleted: deletedMeetings?.length ?? 0,
    actionItemsDeleted,
    opportunitiesDeleted,
  };
  await logAccountChanges(
    accountId,
    [
      {
        field: "Meeting history deleted",
        oldValue: meetings.map((meeting) => summarizeMeetingHistory(meeting)).join("\n"),
        newValue: compactAccountHistoryParts([
          `Meetings deleted: ${result.meetingsDeleted}`,
          `Linked activity items deleted: ${result.actionItemsDeleted}`,
          `Linked opportunities deleted: ${result.opportunitiesDeleted}`,
        ]),
      },
    ],
    editedBy,
  );
  return result;
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

  if (input.sourceType !== "manual") {
    const [{ data: existingRows, error: existingError }, { data: legacyRows, error: legacyError }] =
      await Promise.all([
        supabase
          .from("activity_rule_activities")
          .select("id,title,next_step,parameter")
          .eq("account_id", input.accountId)
          .limit(200),
        supabase
          .from("activities")
          .select("id,title,area")
          .eq("account_id", input.accountId)
          .limit(200),
      ]);

    if (existingError) throw existingError;
    if (legacyError) throw legacyError;

    const legacyActivityRows = (legacyRows ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      next_step: row.title,
      parameter: row.area,
    }));

    if (
      [...(existingRows ?? []), ...legacyActivityRows].some((row) =>
        isDuplicateRuleActivityInput(input, row),
      )
    ) {
      throw new Error("This activity already exists.");
    }
  }

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
  await createActionItemNotifications(supabase, {
    accountId: input.accountId,
    actionItemId: data.id,
    title: data.title,
  }).catch(() => null);
  return mapActivityRuleActivity(data);
}

export async function createActivityRuleActivitiesFromMeetingActions({
  accountId,
  actions,
  editedBy = "System",
}) {
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

  const { data, error } = await supabase.from("activity_rule_activities").insert(rows).select("*");
  if (error) throw error;
  await Promise.all(
    (data ?? []).map((row) =>
      createActionItemNotifications(supabase, {
        accountId,
        actionItemId: row.id,
        title: row.title,
      }).catch(() => null),
    ),
  );
  const savedActivities = (data ?? []).map((row) => mapActivityRuleActivity(row));
  await logAccountChanges(
    accountId,
    savedActivities.map((activity) => ({
      field: "Activity created from meeting note",
      oldValue: null,
      newValue: summarizeRuleActivityHistory(activity),
    })),
    editedBy,
  );
  return savedActivities;
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
export async function markActivityRuleActivityDone(activityId) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("activity_rule_activities")
    .update({
      status: "Closed",
      activity_score_pct: 100,
      completed_at: now,
      validated_at: now,
      closed_at: now,
      updated_at: now,
    })
    .eq("id", activityId)
    .select("*")
    .single();
  if (error) throw error;
  return mapActivityRuleActivity(data);
}

export async function markLegacyActivityDone(activityId) {
  const { data, error } = await supabase
    .from("activities")
    .update({
      status: "Done",
      updated_at: new Date().toISOString(),
    })
    .eq("id", activityId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

function formatNotificationTime(createdAt) {
  if (!createdAt) return "";
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return "";
  const diffMs = Date.now() - created.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return created.toLocaleDateString();
}

function mapNotification(n) {
  const embeddedAccount = Array.isArray(n.accounts) ? n.accounts[0] : n.accounts;
  return {
    id: n.id,
    title: n.title,
    body: n.body ?? "",
    accountId: n.account_id ?? undefined,
    accountName: embeddedAccount?.name ?? "",
    time: n.time || formatNotificationTime(n.created_at),
    type: n.type,
    read: Boolean(n.read_at || n.read),
    badgeKey: n.badge_key ?? null,
    targetPath: n.target_path ?? null,
    createdAt: n.created_at ?? null,
  };
}

async function fetchLegacyNotifications() {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapNotification);
}

async function persistNotificationReads(input) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Please sign in again before updating notifications.");
  }

  return markNotificationsReadServer({
    data: {
      accessToken: session.access_token,
      notificationIds: input.notificationIds ?? [],
      badgeKey: input.badgeKey ?? "",
    },
  });
}

// --- fetch notifications ------------------------------------------------------
export async function fetchNotifications(options = {}) {
  const role = options.role;
  if (role && !isNotificationRole(role)) return [];

  if (role && isNotificationRole(role)) {
    await ensureContractRenewalNotifications(supabase).catch(() => null);
  }

  let query = supabase
    .from("notifications")
    .select("*, accounts(name)")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 100);

  if (options.userId) {
    query = query.eq("recipient_profile_id", options.userId);
  }

  const { data, error } = await query;
  if (error && options.userId && isMissingColumnError(error, "recipient_profile_id")) {
    return fetchLegacyNotifications();
  }
  if (error) throw error;
  return (data ?? []).map(mapNotification);
}

export async function markNotificationsRead(notificationIds = []) {
  const ids = notificationIds.filter(Boolean);
  if (!ids.length) return;

  let serverError = null;
  try {
    await persistNotificationReads({ notificationIds: ids });
    return;
  } catch (error) {
    serverError = error;
  }

  const readAt = new Date().toISOString();
  const { error } = await supabase
    .from("notifications")
    .update({ read: true, read_at: readAt })
    .in("id", ids);
  if (error && isMissingColumnError(error, "read_at")) {
    const { error: fallbackError } = await supabase
      .from("notifications")
      .update({ read: true })
      .in("id", ids);
    if (fallbackError) throw serverError ?? fallbackError;
    return;
  }
  if (error) throw serverError ?? error;
}

export async function markAllNotificationsRead(options = {}) {
  const notificationIds = (options.notificationIds ?? []).filter(Boolean);

  let serverError = null;
  try {
    await persistNotificationReads({ notificationIds });
    return;
  } catch (error) {
    serverError = error;
  }

  const readAt = new Date().toISOString();
  let query = supabase
    .from("notifications")
    .update({ read: true, read_at: readAt })
    .eq("read", false);

  if (notificationIds.length) {
    query = query.in("id", notificationIds);
  } else if (options.userId) {
    query = query.eq("recipient_profile_id", options.userId);
  }

  const { error } = await query;
  if (
    error &&
    (isMissingColumnError(error, "read_at") || isMissingColumnError(error, "recipient_profile_id"))
  ) {
    let fallback = supabase.from("notifications").update({ read: true }).eq("read", false);
    if (notificationIds.length) {
      fallback = fallback.in("id", notificationIds);
    } else if (options.userId && !isMissingColumnError(error, "recipient_profile_id")) {
      fallback = fallback.eq("recipient_profile_id", options.userId);
    }
    const { error: fallbackError } = await fallback;
    if (fallbackError) throw serverError ?? fallbackError;
    return;
  }
  if (error) throw serverError ?? error;
}

export async function markNotificationsReadByBadge(badgeKey, options = {}) {
  if (!badgeKey) return;

  const notificationIds = (options.notificationIds ?? []).filter(Boolean);

  let serverError = null;
  try {
    await persistNotificationReads({ notificationIds, badgeKey });
    return;
  } catch (error) {
    serverError = error;
  }

  const readAt = new Date().toISOString();
  let query = supabase
    .from("notifications")
    .update({ read: true, read_at: readAt })
    .eq("read", false);

  if (notificationIds.length) {
    query = query.in("id", notificationIds);
  } else {
    query = query.eq("badge_key", badgeKey);
    if (options.userId) query = query.eq("recipient_profile_id", options.userId);
  }

  const { error } = await query;
  if (
    error &&
    (isMissingColumnError(error, "badge_key") ||
      isMissingColumnError(error, "recipient_profile_id"))
  ) {
    return;
  }
  if (error && isMissingColumnError(error, "read_at")) {
    let fallback = supabase.from("notifications").update({ read: true }).eq("read", false);
    if (notificationIds.length) {
      fallback = fallback.in("id", notificationIds);
    } else {
      fallback = fallback.eq("badge_key", badgeKey);
      if (options.userId) fallback = fallback.eq("recipient_profile_id", options.userId);
    }
    const { error: fallbackError } = await fallback;
    if (fallbackError) throw serverError ?? fallbackError;
    return;
  }
  if (error) throw serverError ?? error;
}

// ─── education log ────────────────────────────────────────────────────────────
export async function fetchEducationLog(accountId) {
  let q = supabase.from("education_log").select("*").order("created_at", { ascending: false });
  if (Array.isArray(accountId)) {
    if (!accountId.length) return [];
    q = q.in("account_id", accountId);
  } else if (accountId) {
    q = q.eq("account_id", accountId);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((e) => ({
    id: e.id,
    accountId: e.account_id,
    date: e.date,
    topic: e.topic,
    approach: e.approach ?? "",
    outcome: e.outcome ?? "",
    createdAt: e.created_at,
  }));
}

export async function saveEducationSession(session) {
  const { error } = await supabase.from("education_log").insert({
    account_id: session.accountId,
    date: session.date,
    topic: session.topic,
    approach: session.approach ?? null,
    outcome: session.outcome ?? null,
  });
  if (error) throw error;
  await logAccountChanges(
    session.accountId,
    [
      {
        field: "Education record added",
        oldValue: null,
        newValue: summarizeEducationHistory(session),
      },
    ],
    session.editedBy ?? "Unknown",
  );
}
