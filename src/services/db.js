import { supabase } from "@/lib/supabase";
import { normalizeRole } from "@/data/kam-data";
import { createManagedAuthUser, deleteManagedAuthUser } from "@/services/user-admin";
import { syncSalesforceMappedFieldsServer } from "@/services/salesforce-sync";
import { generateLinkedinSummaryServer } from "@/services/linkedin-summary";
import { generateWebsiteSummaryServer } from "@/services/website-summary";
import { applySowFieldsServer } from "@/services/sow-upload";
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
  return error?.code === "42P01" || /relation .* does not exist/i.test(error?.message ?? "");
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

function isMissingColumnError(error, column) {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42703" || error.code === "PGRST204" || message.includes(column.toLowerCase())
  );
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
export async function fetchKamUsers() {
  const withStatus = await supabase
    .from("profiles")
    .select("id, name, initials, role, is_active")
    .eq("role", "KAM");

  if (!withStatus.error) {
    return (withStatus.data ?? [])
      .filter((user) => user.is_active !== false)
      .map((user) => ({ ...user, role: normalizeRole(user.role) }));
  }

  if (!isMissingColumnError(withStatus.error, "is_active")) throw withStatus.error;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, initials, role")
    .eq("role", "KAM");
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
  const { error } = await supabase
    .from("accounts")
    .update({ assigned_kam_id: kamId })
    .eq("id", accountId);
  if (error) throw error;
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
      renewal_days: data.renewalDays,
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
}

// --- update account KYC fields -----------------------------------------------
export async function updateAccountKyc(accountId, updates) {
  const { error } = await supabase.from("accounts").update(updates).eq("id", accountId);
  if (error) throw error;
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
export async function syncSalesforceMappedFields(accountId, payload) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token)
    throw new Error("Please sign in again before syncing Salesforce fields.");

  return syncSalesforceMappedFieldsServer({
    data: {
      accountId,
      payload,
      accessToken: session.access_token,
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

function firstRelatedRow(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
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
    const cd = firstRelatedRow(row.contract_details);
    return {
      ...mapFlatAccount(row),
      duration: cd?.duration ?? "-",
      autoRenew: Boolean(cd?.auto_renew),
      nonTerminator: Boolean(cd?.non_terminator),
      priceHike: cd?.price_hike ?? "-",
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

  return (data ?? []).map((row, index) =>
    mapAccountTaskForAiSuggestion(row, index, accountId),
  );
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

  if (input.sourceType !== "manual") {
    const [
      { data: existingRows, error: existingError },
      { data: legacyRows, error: legacyError },
    ] = await Promise.all([
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

// --- fetch notifications ------------------------------------------------------
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

// ─── education log ────────────────────────────────────────────────────────────
export async function fetchEducationLog(accountId) {
  let q = supabase
    .from("education_log")
    .select("*")
    .order("created_at", { ascending: false });
  if (accountId) q = q.eq("account_id", accountId);
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
}
