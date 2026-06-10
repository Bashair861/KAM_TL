import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { GLOBAL_ACTIVITY_RULE_MATRIX } from "@/services/activity-score-matrix";
import { buildActivityTabModel } from "@/services/activity-tab";
import {
  buildAiScoreSuggestions,
  isDuplicateAiActivity,
  normalizeAiSuggestionPayload,
  removeDuplicateAiSuggestions,
} from "@/services/activity-ai-suggestions";
import { recordOpenAiUsage } from "@/services/ai-usage";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_MODELS_URL = "https://api.openai.com/v1/models";
const DEFAULT_MODEL = "gpt-5.4-mini";
const MODEL_FALLBACK_CANDIDATES = ["gpt-5.4-mini", "gpt-4.1-mini", "gpt-4o-mini"];
const MAX_CONTEXT_ITEMS = 8;
const AI_AUDIT_TABLE = "kam_ai_suggestion_audit_logs";
const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_REQUESTS = 10;
const KAM_AI_SECURITY_VERSION = "2026-06-10";

const kamAiAuthHeaderMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next, request }) => {
    const authorizationHeader =
      request?.headers?.get("Authorization") ?? request?.headers?.get("authorization") ?? "";
    return next({ context: { authorizationHeader } });
  },
);

const SUGGESTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["suggestions"],
  properties: {
    suggestions: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "description",
          "health_area",
          "reason",
          "expected_lift",
          "source_reference",
        ],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          health_area: { type: "string" },
          reason: { type: "string" },
          expected_lift: { type: "string" },
          source_reference: { type: "string" },
        },
      },
    },
  },
};

const SYSTEM_PROMPT = [
  "You are a KAM strategy advisor. Generate new strategic recommendations for this account. Do not copy Score Marking Metrics items. Do not copy existing activities. Use Score Marking Metrics only to understand how score is calculated. Return only new actionable activities that a KAM can perform to improve the score.",
  "You are an AI Agent for a Key Account Management system.",
  "Your job is to generate account-specific activities that can increase account score.",
  "Use the supplied anonymized account, score, task, opportunity, risk, activity, meeting, and rule signals.",
  "Do not include customer names, account names, people names, emails, URLs, transcript text, or raw notes in any output.",
  "Do not merely summarize existing tasks or copy task, opportunity, escalation, or meeting titles. Analyze gaps across account health, engagement, project delivery, relationship strength, risks, opportunities, and missing activities.",
  "Do not suggest an activity that already exists or is very similar to an existing activity.",
  "Return only structured JSON matching the schema.",
  "Return up to 6 best suggestions. Only include recommendations that are clearly useful, strategic, and account-specific.",
  "Return between 1 and 6 suggestions. If there are only 2 or 3 strong recommendations, return only those.",
  "Do not create weak or generic suggestions just to reach a fixed number.",
  "expected_lift must be a percentage string ending with %, such as 15%, 25%, or 40%.",
].join(" ");

function validateInput(input = {}) {
  if (!input || typeof input !== "object" || typeof input.accountId !== "string") {
    throw new Error("AI suggestions require a valid account id.");
  }
  return { accountId: input.accountId, user: input.user ?? {} };
}

function getRuntimeEnvValue(key) {
  const metaEnv =
    typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : undefined;
  return (
    metaEnv?.[key] ??
    globalThis?.process?.env?.[key] ??
    globalThis?.__env?.[key] ??
    globalThis?.[key]
  );
}

function getOpenAiApiKey() {
  return getRuntimeEnvValue("OPENAI_API_KEY");
}

function getOpenAiModel() {
  return (
    getRuntimeEnvValue("OPENAI_KAM_SUGGESTIONS_MODEL") ??
    getRuntimeEnvValue("OPENAI_MODEL") ??
    DEFAULT_MODEL
  );
}

function getOpenAiModelCandidates() {
  return [
    getOpenAiModel(),
    ...MODEL_FALLBACK_CANDIDATES,
  ].filter((model, index, models) => model && models.indexOf(model) === index);
}

function createSafeError(category, message) {
  const error = new Error(message);
  error.category = category;
  error.safeMessage = message;
  return error;
}

function logKamAi(level, event, details = {}) {
  const safeDetails = Object.fromEntries(
    Object.entries(details).filter(([key]) => !/key|token|secret|authorization|session/i.test(key)),
  );
  const logger = console[level] ?? console.info;
  logger(`[KAM AI Suggestions] ${event}`, safeDetails);
}

function toSafeErrorDetails(error) {
  return {
    name: error?.name,
    message: truncateForLog(error?.message),
    source: error?.source,
    status: error?.status,
    model: error?.model,
    code: error?.code,
    type: error?.type,
    category: error?.category,
  };
}

function truncateForLog(value = "", maxLength = 400) {
  const text = String(value ?? "");
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function getOutputText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  return (payload?.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .filter(Boolean)
    .join("");
}

function normalizeText(value = "") {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashForLog(value = "") {
  let hash = 0;
  const text = String(value ?? "");
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function normalizeRoleName(role = "") {
  const normalized = String(role ?? "").trim().replace(/\s+/g, " ");
  const lowered = normalized.toLowerCase();
  if (lowered === "c level" || lowered === "c-level" || lowered === "ceo") return "CEO";
  if (lowered === "head of kam") return "Head of KAM";
  if (lowered === "kam") return "KAM";
  return "";
}

export function canAccessAccountForAi({ role, profileId, assignedKamId }) {
  const normalizedRole = normalizeRoleName(role);
  if (normalizedRole === "CEO" || normalizedRole === "Head of KAM") return true;
  return normalizedRole === "KAM" && Boolean(profileId) && profileId === assignedKamId;
}

function readAuthorizationAccessToken(authorizationHeader = "") {
  const match = String(authorizationHeader).match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function createUserScopedSupabaseClient(accessToken) {
  const url = getRuntimeEnvValue("VITE_SUPABASE_URL") ?? getRuntimeEnvValue("SUPABASE_URL");
  const anonKey = getRuntimeEnvValue("VITE_SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    throw createSafeError(
      "supabase_env_missing",
      "AI suggestions are unavailable because Supabase is not configured on the server.",
    );
  }

  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

async function fetchProfileForUser(client, user) {
  const selectColumns = "id, name, role, email, is_active";
  const { data: byId, error: byIdError } = await client
    .from("profiles")
    .select(selectColumns)
    .eq("id", user.id)
    .maybeSingle();
  if (byIdError) throw byIdError;
  if (byId) return byId;

  if (!user.email) return null;
  const { data: byEmail, error: byEmailError } = await client
    .from("profiles")
    .select(selectColumns)
    .eq("email", user.email)
    .maybeSingle();
  if (byEmailError) throw byEmailError;
  return byEmail;
}

async function authenticateAndAuthorizeAiRequest(accountId, authorizationHeader) {
  const accessToken = readAuthorizationAccessToken(authorizationHeader);
  if (!accessToken) {
    throw createSafeError(
      "invalid_session",
      "AI suggestions are unavailable because your session could not be verified.",
    );
  }

  const client = createUserScopedSupabaseClient(accessToken);
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser(accessToken);

  if (userError || !user) {
    throw createSafeError(
      "invalid_session",
      "AI suggestions are unavailable because your session could not be verified.",
    );
  }

  const profile = await fetchProfileForUser(client, user);
  if (!profile?.id || profile.is_active === false) {
    throw createSafeError(
      "invalid_session",
      "AI suggestions are unavailable because no active KAM profile is linked to this session.",
    );
  }

  const { data: account, error: accountError } = await client
    .from("accounts")
    .select("id, assigned_kam_id")
    .eq("id", accountId)
    .maybeSingle();
  if (accountError) throw accountError;

  const role = normalizeRoleName(profile.role);
  const canAccess = canAccessAccountForAi({
    role,
    profileId: profile.id,
    assignedKamId: account?.assigned_kam_id,
  });

  if (!account || !canAccess) {
    throw createSafeError(
      "unauthorized_account",
      "AI suggestions are unavailable because you are not authorized to access this account.",
    );
  }

  logKamAi("info", "authorization succeeded", {
    source: "auth",
    role,
    accountRef: hashForLog(accountId),
  });

  return { client, profile: { ...profile, role }, accountAuthRow: account };
}

function isMissingTableError(error) {
  const message = String(error?.message ?? "").toLowerCase();
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    message.includes("could not find the table") ||
    (message.includes("schema cache") && message.includes("table"))
  );
}

async function writeAiAuditEvent(client, event) {
  const row = {
    profile_id: event.profileId,
    account_id: event.accountId,
    event_type: event.eventType,
    failure_category: event.failureCategory ?? null,
    model: event.model ?? null,
    suggestion_count: event.suggestionCount ?? null,
    security_version: KAM_AI_SECURITY_VERSION,
  };

  const { error } = await client.from(AI_AUDIT_TABLE).insert(row);
  if (isMissingTableError(error)) {
    logKamAi("warn", "AI audit table missing", {
      source: "supabase",
      category: "audit_table_missing",
    });
    return;
  }
  if (error) {
    logKamAi("warn", "AI audit insert failed", {
      source: "supabase",
      category: "audit_insert_failed",
      code: error.code,
    });
  }
}

async function enforceAiRateLimit({ client, profileId, accountId }) {
  const windowStart = new Date(
    Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();
  const { count, error } = await client
    .from(AI_AUDIT_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .eq("account_id", accountId)
    .eq("event_type", "request_started")
    .gte("created_at", windowStart);

  if (isMissingTableError(error)) {
    logKamAi("warn", "AI rate limit table missing", {
      source: "supabase",
      category: "rate_limit_table_missing",
    });
    return;
  }
  if (error) throw error;
  if ((count ?? 0) >= RATE_LIMIT_MAX_REQUESTS) {
    throw createSafeError(
      "rate_limited",
      "AI suggestions are temporarily unavailable because this account has reached the request limit. Please try again later.",
    );
  }
}

function mapPersistedActivityToDuplicateRow(activity) {
  return {
    id: activity.id,
    area: activity.parameter,
    healthArea: activity.parameter,
    title: activity.title,
    reason: activity.weakSignal,
    nextStep: activity.nextStep,
    description: activity.successCriteria,
  };
}

function mapAccountActivityToDuplicateRow(activity) {
  return {
    id: activity.id,
    area: activity.area,
    healthArea: activity.area,
    title: activity.title,
    reason: activity.title,
    nextStep: activity.title,
    description: activity.title,
  };
}

function mapGenericForbiddenItemToDuplicateRow(item) {
  return {
    id: item.id,
    area: "",
    healthArea: "",
    title: item.title ?? item.name ?? item.metric ?? "",
    reason: item.reason ?? item.description ?? item.nextStep ?? item.recommendation ?? "",
    nextStep: item.nextStep ?? item.description ?? item.recommendation ?? "",
    description: item.description ?? item.reason ?? item.nextStep ?? item.recommendation ?? "",
  };
}

function buildDuplicateRows({ account, savedRuleActivities, model, tasks, opportunities, escalations }) {
  return [
    ...(account.activities ?? []).map(mapAccountActivityToDuplicateRow),
    ...(savedRuleActivities ?? []).map(mapPersistedActivityToDuplicateRow),
    ...(model.activityRows ?? []),
    ...(model.scoreMetricActivities ?? []).map(mapGenericForbiddenItemToDuplicateRow),
    ...(tasks ?? []).map(mapGenericForbiddenItemToDuplicateRow),
    ...(opportunities ?? []).map(mapGenericForbiddenItemToDuplicateRow),
    ...(escalations ?? []).map(mapGenericForbiddenItemToDuplicateRow),
  ];
}

async function safeContextFetch(label, request) {
  try {
    const result = await request;
    logKamAi("info", "context fetch succeeded", {
      source: "supabase",
      label,
      count: Array.isArray(result) ? result.length : result ? 1 : 0,
    });
    return result;
  } catch (error) {
    logKamAi("warn", "context fetch failed", {
      source: "supabase",
      label,
      ...toSafeErrorDetails(error),
    });
    return [];
  }
}

function compactMetrics(block) {
  const metrics = block?.metrics ?? [];
  const uncheckedFields = (block?.kpiData ?? []).flatMap((section) =>
    (section.fields ?? []).filter((field) => !field.checked),
  );

  return {
    score: block?.score ?? null,
    metricCount: metrics.length,
    averageMetricValue: metrics.length
      ? Number(
          (
            metrics.reduce((sum, metric) => sum + Number(metric.value ?? 0), 0) / metrics.length
          ).toFixed(2),
        )
      : null,
    uncheckedCriteriaCount: uncheckedFields.length,
    uncheckedCriteriaWeightTotal: uncheckedFields.reduce(
      (sum, field) => sum + Number(field.weight ?? 0),
      0,
    ),
  };
}

function buildScoreMetricsContext(account, model) {
  return {
    overallHealth: account.health,
    trend: account.trend,
    relationship: compactMetrics(account.relationshipHealth),
    project: compactMetrics(account.projectHealth),
    resource: compactMetrics(account.resourceHealth),
    financial: compactMetrics(account.financialHealth),
    risk: compactMetrics(account.riskScoring),
    csat: compactMetrics(account.csat),
    whiteSpace: compactMetrics(account.whiteSpace),
    suggestedActivityCountFromScoringRules: model.scoreMetricActivities?.length ?? 0,
  };
}

function buildRulesContext() {
  return GLOBAL_ACTIVITY_RULE_MATRIX.map((rule) => ({
    ruleId: rule.ruleId,
    parameter: rule.parameter,
    metric: rule.metric,
    trigger: rule.trigger,
    scoreLift: rule.scoreLift,
    successCriteria: rule.successCriteria,
  }));
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toMoneyBand(value) {
  const number = toFiniteNumber(String(value ?? "").replace(/[^0-9.-]+/g, ""));
  if (number === null || number <= 0) return "unknown";
  if (number < 50_000) return "under_50k";
  if (number < 100_000) return "50k_to_100k";
  if (number < 250_000) return "100k_to_250k";
  if (number < 500_000) return "250k_to_500k";
  if (number < 1_000_000) return "500k_to_1m";
  return "over_1m";
}

function toNumberBand(value, bands) {
  const number = toFiniteNumber(value);
  if (number === null) return "unknown";
  const band = bands.find((item) => number <= item.max);
  return band?.label ?? bands[bands.length - 1]?.label ?? "unknown";
}

function countBy(items, resolver) {
  return items.reduce((counts, item) => {
    const key = resolver(item) || "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function getStakeholderRoleCategory(role = "") {
  const text = normalizeText(role);
  if (/\b(ceo|cto|cfo|coo|chief|founder|president|executive|vp|vice president)\b/.test(text)) {
    return "executive";
  }
  if (/\b(director|head|lead)\b/.test(text)) return "director_or_head";
  if (/\b(manager|pm|project manager|program manager)\b/.test(text)) return "manager";
  if (/\b(procurement|finance|legal|commercial|buyer)\b/.test(text)) return "commercial";
  if (/\b(engineer|architect|developer|platform|technical|it|security)\b/.test(text)) {
    return "technical";
  }
  return "other";
}

function isStaleRelationshipSignal(lastContact = "") {
  const text = String(lastContact ?? "").toLowerCase();
  if (!text || text === "n/a") return true;
  const match = text.match(/(\d+)\s*(d|day|days|w|week|weeks|m|month|months)/);
  if (!match) return false;
  const amount = Number(match[1]);
  const unit = match[2][0];
  if (unit === "m") return true;
  if (unit === "w") return amount >= 3;
  return unit === "d" && amount >= 21;
}

function getTaskStatusBucket(task = {}) {
  const text = normalizeText(`${task.status} ${task.priority} ${task.dueDate}`);
  if (/\b(done|closed|complete|completed|cancelled|canceled)\b/.test(text)) return "closed";
  if (/\b(blocked|overdue|late|urgent|critical|high)\b/.test(text)) return "at_risk";
  if (/\b(in progress|active|started)\b/.test(text)) return "in_progress";
  return "open";
}

function getSourceCategory(value = "") {
  const text = normalizeText(value);
  if (/fireflies|meeting|transcript|call|qbr/.test(text)) return "meeting";
  if (/website|linkedin|summary scan|public/.test(text)) return "public_summary";
  if (/escalation|risk|incident/.test(text)) return "risk_or_escalation";
  if (/manual|score|matrics|metrics/.test(text)) return "score_or_manual";
  return "other";
}

function getSlaRiskBucket(value) {
  const hours = toFiniteNumber(value);
  if (hours === null) return "unknown";
  if (hours <= 0) return "breached";
  if (hours <= 24) return "within_24h";
  if (hours <= 72) return "within_72h";
  return "over_72h";
}

function getLastMeetingAgeDays(meetingSummaries = []) {
  const dates = meetingSummaries
    .map((meeting) => Date.parse(meeting.meetingDate ?? meeting.createdAt ?? meeting.syncedAt ?? ""))
    .filter(Number.isFinite)
    .sort((left, right) => right - left);
  if (!dates.length) return null;
  return Math.max(0, Math.round((Date.now() - dates[0]) / (24 * 60 * 60 * 1000)));
}

function summarizeScoreHistory(scoreHistory = []) {
  const byParameter = new Map();
  for (const row of scoreHistory) {
    const key = String(row.parameter ?? "unknown");
    const current = byParameter.get(key) ?? [];
    current.push(row);
    byParameter.set(key, current);
  }

  return {
    parameterCount: byParameter.size,
    latestByParameter: [...byParameter.entries()].map(([parameter, rows]) => {
      const sortedRows = rows
        .slice()
        .sort((left, right) => String(right.snapshotMonth).localeCompare(String(left.snapshotMonth)));
      const latest = sortedRows[0];
      const previous = sortedRows[1];
      return {
        parameter,
        latestScore: latest?.score ?? null,
        trendDelta:
          latest?.score !== undefined && previous?.score !== undefined
            ? Number((Number(latest.score) - Number(previous.score)).toFixed(2))
            : null,
      };
    }),
  };
}

function buildStakeholderSignals(stakeholders = []) {
  return {
    total: stakeholders.length,
    byRoleCategory: countBy(stakeholders, (stakeholder) =>
      getStakeholderRoleCategory(stakeholder.role),
    ),
    byInfluence: countBy(stakeholders, (stakeholder) => stakeholder.influence ?? "unknown"),
    staleRelationshipCount: stakeholders.filter((stakeholder) =>
      isStaleRelationshipSignal(stakeholder.lastContact),
    ).length,
  };
}

function buildTaskSignals(tasks = []) {
  return {
    total: tasks.length,
    byStatusBucket: countBy(tasks, getTaskStatusBucket),
    byHealthArea: countBy(tasks, (task) => task.area || "unknown"),
    overdueOrAtRiskCount: tasks.filter((task) => getTaskStatusBucket(task) === "at_risk").length,
  };
}

function buildOpportunitySignals(opportunities = []) {
  return {
    total: opportunities.length,
    bySourceCategory: countBy(opportunities, (opportunity) =>
      getSourceCategory(opportunity.source),
    ),
    byConfidence: countBy(opportunities, (opportunity) => opportunity.confidence ?? "unknown"),
    byPotentialBand: countBy(opportunities, (opportunity) =>
      toMoneyBand(opportunity.potential),
    ),
  };
}

function buildEscalationSignals(escalations = []) {
  return {
    total: escalations.length,
    byPriority: countBy(escalations, (escalation) => escalation.priority ?? "unknown"),
    bySlaRisk: countBy(escalations, (escalation) =>
      getSlaRiskBucket(escalation.slaRemainingHours),
    ),
    openHighRiskCount: escalations.filter((escalation) =>
      ["P1", "P2", "High", "Critical"].includes(String(escalation.priority)),
    ).length,
  };
}

function buildMeetingSignals(meetingSummaries = []) {
  const lastMeetingAgeDays = getLastMeetingAgeDays(meetingSummaries);
  const recentMeetingCount = meetingSummaries.filter((meeting) => {
    const timestamp = Date.parse(meeting.meetingDate ?? meeting.createdAt ?? meeting.syncedAt ?? "");
    if (!Number.isFinite(timestamp)) return false;
    return Date.now() - timestamp <= 30 * 24 * 60 * 60 * 1000;
  }).length;

  return {
    total: meetingSummaries.length,
    recentMeetingCount,
    lastMeetingAgeDays,
    derivedActionItemCount: meetingSummaries.reduce(
      (sum, meeting) => sum + (meeting.derivedActionItems?.length ?? 0),
      0,
    ),
    derivedOpportunityCount: meetingSummaries.reduce(
      (sum, meeting) => sum + (meeting.derivedOpportunities?.length ?? 0),
      0,
    ),
  };
}

function buildExistingActivitySignals({ account, savedRuleActivities, model }) {
  const rows = [
    ...(account.activities ?? []),
    ...(savedRuleActivities ?? []),
    ...(model.activityRows ?? []),
  ];
  return {
    total: rows.length,
    byHealthArea: countBy(rows, (row) => row.area ?? row.healthArea ?? row.parameter ?? "unknown"),
    byStatus: countBy(rows, (row) => row.status ?? "unknown"),
  };
}

function buildScoreGapSignals(account) {
  return [
    ["Relationship", account.relationshipHealth],
    ["Project", account.projectHealth],
    ["Resource", account.resourceHealth],
    ["Financial", account.financialHealth],
    ["Risk", account.riskScoring],
    ["CSAT", account.csat],
  ].map(([area, block]) => ({
    area,
    score: block?.score ?? null,
    uncheckedCriteriaCount: compactMetrics(block).uncheckedCriteriaCount,
    uncheckedCriteriaWeightTotal: compactMetrics(block).uncheckedCriteriaWeightTotal,
  }));
}

export function buildSafeAgentPayload({
  account,
  tasks,
  opportunities,
  escalations,
  scoreHistory,
  thresholdOverrides,
  savedRuleActivities,
  meetingSummaries,
  model,
}) {
  return {
    accountSignals: {
      industry: account.industry,
      tier: account.tier,
      arrBand: toMoneyBand(account.arr),
      contractValueBand: toMoneyBand(account.contractValue),
      growthUpsideBand: toMoneyBand(account.growthUpside),
      renewalDays: account.renewalDays,
      retentionRisk: account.retentionRisk,
      revenueAtRiskBand: toMoneyBand(account.revenueAtRisk),
      growthPipelineValueBand: toMoneyBand(account.growthPipelineValue),
      growthPotentialLevel: account.growthPotentialLevel,
      cooperationScore: account.cooperation,
      serviceConsumption: account.serviceConsumption,
      meetingsPerMonth: account.meetingsPerMonth,
      teamSizeBand: toNumberBand(account.teamSize, [
        { max: 5, label: "1_to_5" },
        { max: 15, label: "6_to_15" },
        { max: 50, label: "16_to_50" },
        { max: Number.POSITIVE_INFINITY, label: "over_50" },
      ]),
      whiteSpaceCount: account.whiteSpaceCount,
      stakeholderSignals: buildStakeholderSignals(account.stakeholders ?? []),
    },
    scoreMarkingMetrics: buildScoreMetricsContext(account, model),
    scoreGaps: buildScoreGapSignals(account),
    scoreHistorySignals: summarizeScoreHistory(scoreHistory),
    thresholdOverrideSignals: {
      total: thresholdOverrides.length,
      byParameter: countBy(thresholdOverrides, (row) => row.parameter ?? "unknown"),
    },
    existingActivitySignals: buildExistingActivitySignals({ account, savedRuleActivities, model }),
    taskSignals: buildTaskSignals(tasks),
    opportunitySignals: buildOpportunitySignals(opportunities),
    escalationSignals: buildEscalationSignals(escalations),
    meetingSignals: buildMeetingSignals(meetingSummaries),
    rules: buildRulesContext(),
    agentToolsUsed: [
      "getCurrentAccountData",
      "getAccountTasks",
      "getAccountOpportunities",
      "getScoreMarkingMatrics",
      "getExistingActivities",
      "searchKnowledgeBase",
      "validateAndDeduplicateSuggestions",
    ],
  };
}

function mapHealthBlock(score, metrics = [], kpiData = null, updatedAt = null) {
  return {
    score,
    metrics: metrics.map((metric) => ({
      id: metric.id,
      label: metric.label,
      value: metric.value,
      complete: Boolean(metric.complete ?? metric.Complete ?? false),
      ...(metric.hint ? { hint: metric.hint } : {}),
    })),
    kpiData,
    updatedAt,
  };
}

function mapFlatAccountForAi(row) {
  return {
    id: row.id,
    name: row.name,
    shortCode: row.short_code,
    industry: row.industry,
    tier: row.tier,
    health: row.health,
    trend: row.trend,
    contractValue: row.contract_value,
    arr: row.arr,
    contractRenewalDate: row.renewal_date ?? row.contract_renewal_date ?? null,
    contractDuration: row.contract_duration ?? "",
    contractType: row.contract_type,
    lastTouch: row.last_touch,
    status: row.status,
    retentionRisk: row.retention_risk,
    growthUpside: row.growth_upside,
    whiteSpaceCount: row.white_space_count,
    retentionHealthScore: row.retention_health_score ?? 0,
    calculatedRetentionRisk: row.calculated_retention_risk ?? row.retention_risk ?? "Low",
    growthPotentialScore: row.growth_potential_score ?? 0,
    growthPotentialLevel: row.growth_potential_level ?? "Low",
    revenueAtRisk: row.revenue_at_risk ?? 0,
    growthPipelineValue: row.growth_pipeline_value ?? 0,
    retentionGrowthQuadrant: row.retention_growth_quadrant ?? null,
    retentionGrowthNextAction: row.retention_growth_next_action ?? null,
    retentionGrowthCalculatedAt: row.retention_growth_calculated_at ?? null,
    retentionGrowthCalculationReason: row.retention_growth_calculation_reason ?? {},
    cooperation: row.cooperation,
    serviceConsumption: row.service_consumption,
    meetingsPerMonth: row.meetings_per_month,
    contractCompliance: row.contract_compliance,
    primaryContact: {
      name: row.primary_contact_name,
      role: row.primary_contact_role,
    },
    engagementTenure: row.engagement_tenure,
    teamSize: row.team_size,
    assignedKamId: row.assigned_kam_id ?? null,
  };
}

function mapAccountTaskForAi(row, index, fallbackAccountId) {
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

function mapActivityScoreHistoryForAi(row) {
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

function mapActivityRuleThresholdOverrideForAi(row) {
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

function mapActivityRuleActivityForAi(row) {
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
    sourceType: row.source_type ?? "",
    sourceRef: row.source_ref ?? "",
    generatedAt: row.generated_at,
    updatedAt: row.updated_at,
  };
}

function mapFirefliesMeetingSummaryForAi(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    transcriptId: row.fireflies_transcript_id,
    title: row.title,
    meetingDate: row.meeting_date,
    overview: row.overview ?? "",
    shortSummary: row.short_summary ?? "",
    actionItems: row.action_items ?? "",
    derivedActionItems: row.derived_action_items ?? [],
    derivedOpportunities: row.derived_opportunities ?? [],
    syncedAt: row.synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchAccountForAi(client, accountId) {
  const [
    { data: acc, error: accErr },
    { data: stakeholders, error: stakeholderError },
    { data: scores, error: scoreError },
    { data: cd, error: contractError },
    { data: activities, error: activityError },
    { data: retentionGrowth, error: retentionError },
    { data: educationLog, error: educationError },
  ] = await Promise.all([
    client.from("accounts").select("*").eq("id", accountId).single(),
    client.from("stakeholders").select("*").eq("account_id", accountId),
    client.from("health_scores").select("*, health_metrics(*)").eq("account_id", accountId),
    client.from("contract_details").select("*").eq("account_id", accountId).maybeSingle(),
    client.from("activities").select("*").eq("account_id", accountId),
    client.from("retention_growth").select("*").eq("account_id", accountId),
    client.from("education_log").select("*").eq("account_id", accountId),
  ]);

  const errors = [
    accErr,
    stakeholderError,
    scoreError,
    contractError,
    activityError,
    retentionError,
    educationError,
  ].filter(Boolean);
  if (errors.length) throw errors[0];
  if (!acc) return null;

  const scoreMap = new Map((scores ?? []).map((score) => [score.area, score]));
  const block = (area) => {
    const score = scoreMap.get(area);
    if (!score) return { score: 0, metrics: [], kpiData: null, updatedAt: null };

    if (Array.isArray(score.kpi_data) && score.kpi_data.length > 0) {
      const derived = score.kpi_data.map((section, index) => {
        const fields = section.fields ?? [];
        const totalWeight = fields.reduce((sum, field) => sum + (Number(field.weight) || 0), 0);
        const earned = fields.reduce(
          (sum, field) => sum + (field.checked ? Number(field.weight) || 0 : 0),
          0,
        );
        const pct = totalWeight > 0 ? (earned / totalWeight) * 100 : 0;
        return {
          id: `derived-${index}`,
          label: section.name,
          value: parseFloat(((pct / 100) * 10).toFixed(1)),
        };
      });
      return mapHealthBlock(score.score, derived, score.kpi_data, score.updated_at);
    }

    return mapHealthBlock(score.score, score.health_metrics ?? [], score.kpi_data, score.updated_at);
  };

  const flat = mapFlatAccountForAi(acc);
  return {
    ...flat,
    stakeholders: (stakeholders ?? []).map((stakeholder) => ({
      name: stakeholder.name,
      role: stakeholder.role,
      influence: stakeholder.influence,
      email: stakeholder.email ?? undefined,
      lastContact: stakeholder.last_contact ?? undefined,
    })),
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
      swot: {},
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
    activities: (activities ?? []).map((activity) => ({
      id: activity.id,
      area: activity.area,
      title: activity.title,
      owner: activity.owner ?? "",
      due: activity.due ?? "",
      status: activity.status,
      rag: activity.rag,
      expectedLift: activity.expected_lift ?? "",
    })),
    retentionGrowth: (retentionGrowth ?? []).map((row) => ({
      service: row.service,
      offered: row.offered,
      delivered: row.delivered,
      applicable: row.applicable,
      trackingNote: row.tracking_note ?? "",
    })),
    educationLog: (educationLog ?? []).map((row) => ({
      date: row.date,
      topic: row.topic,
      approach: row.approach ?? "",
      outcome: row.outcome ?? "",
    })),
  };
}

async function fetchTasksForAi(client, accountId) {
  const { data, error } = await client.from("tasks").select("*").eq("account_id", accountId).limit(100);
  if (error) {
    if (error.code === "42P01" || error.code === "42703") return [];
    throw error;
  }
  return (data ?? []).map((row, index) => mapAccountTaskForAi(row, index, accountId));
}

async function fetchOpportunitiesForAi(client, accountId) {
  const { data, error } = await client.from("opportunities").select("*").eq("account_id", accountId);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    accountId: row.account_id,
    title: row.title,
    source: row.source ?? "",
    signalDate: row.signal_date ?? "",
    potential: row.potential ?? null,
    confidence: row.confidence,
    nextStep: row.next_step ?? "",
  }));
}

async function fetchEscalationsForAi(client, accountId) {
  const { data, error } = await client
    .from("escalations")
    .select("*, escalation_action_items(*)")
    .eq("account_id", accountId);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    accountId: row.account_id,
    title: row.title,
    priority: row.priority,
    slaRemainingHours: row.sla_remaining_hours ?? 0,
    openedAt: row.opened_at ?? "",
    rca: row.rca ?? "",
    description: row.description ?? "",
    recommendation: row.recommendation ?? undefined,
    realisticCheck: row.realistic_check ?? undefined,
    clientFeedback: row.client_feedback ?? undefined,
    stakeholders: row.stakeholders ?? [],
    actionItems: (row.escalation_action_items ?? []).map((item) => ({
      label: item.label,
      done: item.done,
    })),
  }));
}

async function fetchScoreHistoryForAi(client, accountId) {
  const { data, error } = await client
    .from("activity_score_history")
    .select("*")
    .eq("account_id", accountId)
    .order("snapshot_month", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapActivityScoreHistoryForAi);
}

async function fetchThresholdOverridesForAi(client, accountId) {
  const { data, error } = await client
    .from("activity_rule_threshold_overrides")
    .select("*")
    .eq("account_id", accountId)
    .eq("active", true)
    .order("updated_at", { ascending: false });
  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }
  return (data ?? []).map(mapActivityRuleThresholdOverrideForAi);
}

async function fetchActivityRuleActivitiesForAi(client, accountId) {
  const { data, error } = await client
    .from("activity_rule_activities")
    .select("*")
    .eq("account_id", accountId)
    .order("generated_at", { ascending: false });
  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }
  return (data ?? []).map(mapActivityRuleActivityForAi);
}

async function fetchMeetingSummariesForAi(client, accountId) {
  const { data, error } = await client
    .from("fireflies_meeting_summaries")
    .select("*")
    .eq("account_id", accountId)
    .order("meeting_date", { ascending: false, nullsFirst: false })
    .order("synced_at", { ascending: false });
  if (error) {
    if (error.code === "42P01") return [];
    throw error;
  }
  return (data ?? []).map(mapFirefliesMeetingSummaryForAi);
}

export async function gatherKamSuggestionContext(accountId, client) {
  if (!client) {
    throw createSafeError(
      "invalid_session",
      "AI suggestions are unavailable because your session could not be verified.",
    );
  }

  const account = await fetchAccountForAi(client, accountId);
  if (!account) throw new Error("Account not found for AI suggestions.");

  const [
    tasks,
    opportunities,
    escalations,
    scoreHistory,
    thresholdOverrides,
    savedRuleActivities,
    meetingSummaries,
  ] = await Promise.all([
    safeContextFetch("tasks", fetchTasksForAi(client, accountId)),
    safeContextFetch("opportunities", fetchOpportunitiesForAi(client, accountId)),
    safeContextFetch("escalations", fetchEscalationsForAi(client, accountId)),
    safeContextFetch("activity_score_history", fetchScoreHistoryForAi(client, accountId)),
    safeContextFetch(
      "activity_rule_threshold_overrides",
      fetchThresholdOverridesForAi(client, accountId),
    ),
    safeContextFetch("activity_rule_activities", fetchActivityRuleActivitiesForAi(client, accountId)),
    safeContextFetch("fireflies_meeting_summaries", fetchMeetingSummariesForAi(client, accountId)),
  ]);

  const model = buildActivityTabModel({
    account,
    opportunities,
    escalations,
    scoreHistory,
    thresholdOverrides,
  });
  const duplicateRows = buildDuplicateRows({
    account,
    savedRuleActivities,
    model,
    tasks,
    opportunities,
    escalations,
  });

  return {
    account,
    tasks,
    opportunities,
    escalations,
    scoreHistory,
    thresholdOverrides,
    savedRuleActivities,
    meetingSummaries,
    model,
    duplicateRows,
  };
}

async function fetchAvailableOpenAiModels(apiKey) {
  const response = await fetch(OPENAI_MODELS_URL, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const error = await buildOpenAiHttpError(response, "model_list");
    throw error;
  }

  const payload = await response.json().catch(() => null);
  return (payload?.data ?? []).map((model) => model.id).filter(Boolean);
}

function selectAccessibleOpenAiModel(availableModels, preferredModels) {
  for (const preferred of preferredModels) {
    const exactMatch = availableModels.find((model) => model === preferred);
    if (exactMatch) return exactMatch;

    const versionedMatch = availableModels.find((model) => model.startsWith(`${preferred}-`));
    if (versionedMatch) return preferred;
  }

  return availableModels.find((model) => /^gpt-|^o[0-9]/i.test(model)) ?? null;
}

async function buildOpenAiHttpError(response, model) {
  const errorPayload = await response.json().catch(() => null);
  const openAiError = errorPayload?.error ?? {};
  const message =
    openAiError.message ||
    `OpenAI request failed with HTTP ${response.status}.`;
  const error = new Error(message);
  error.source = "openai";
  error.status = response.status;
  error.model = model;
  error.code = openAiError.code;
  error.type = openAiError.type;
  return error;
}

async function postOpenAiSuggestionRequest({ apiKey, model, context }) {
  logKamAi("info", "OpenAI request started", {
    source: "openai",
    model,
    accountRef: hashForLog(context.account?.id),
  });

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      store: false,
      input: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: JSON.stringify(buildSafeAgentPayload(context)),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "kam_ai_score_suggestions",
          schema: SUGGESTION_SCHEMA,
          strict: true,
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await buildOpenAiHttpError(response, model);
    logKamAi("warn", "OpenAI request failed", toSafeErrorDetails(error));
    throw error;
  }

  logKamAi("info", "OpenAI request succeeded", {
    source: "openai",
    model,
    accountRef: hashForLog(context.account?.id),
  });
  return { response, model };
}

async function callOpenAiForSuggestions(context, user = {}) {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    const error = new Error("OPENAI_API_KEY is not configured.");
    error.source = "environment";
    logKamAi("error", "missing OpenAI key", toSafeErrorDetails(error));
    throw error;
  }

  const preferredModels = getOpenAiModelCandidates();
  let result;
  let firstError;

  try {
    result = await postOpenAiSuggestionRequest({
      apiKey,
      model: preferredModels[0],
      context,
    });
  } catch (error) {
    firstError = error;
    if (error.source !== "openai" || ![403, 404].includes(error.status)) {
      throw error;
    }

    const availableModels = await fetchAvailableOpenAiModels(apiKey);
    const fallbackModel = selectAccessibleOpenAiModel(availableModels, preferredModels);

    logKamAi("warn", "OpenAI model access check completed", {
      source: "openai",
      requestedModel: preferredModels[0],
      availableModelCount: availableModels.length,
      fallbackModel,
    });

    if (!fallbackModel || fallbackModel === preferredModels[0]) {
      throw firstError;
    }

    result = await postOpenAiSuggestionRequest({
      apiKey,
      model: fallbackModel,
      context,
    });
  }

  const payload = await result.response.json().catch(() => null);
  await recordOpenAiUsage({
    feature: "Score Matrix Suggestions",
    agent: "kam_score_suggestions",
    model: result.model,
    responseJson: payload,
    accountId: context.account?.id,
    metadata: {
      healthAreas: context.model?.healthAreas?.length ?? 0,
    },
    user,
  });
  const outputText = getOutputText(payload);
  if (!outputText) {
    const error = new Error("OpenAI returned no structured suggestions.");
    error.source = "openai";
    logKamAi("warn", "OpenAI returned empty structured output", toSafeErrorDetails(error));
    throw error;
  }

  return JSON.parse(outputText);
}

function normalizeAndFilterSuggestions(rawSuggestions, accountId, duplicateRows) {
  return removeDuplicateAiSuggestions(
    (rawSuggestions ?? [])
      .map((suggestion) => normalizeAiSuggestionPayload(suggestion, accountId))
      .filter(Boolean),
    duplicateRows,
  ).slice(0, 6);
}

function buildFallbackSuggestions(context, error) {
  const fallbackSuggestions = buildAiScoreSuggestions({
    account: context.account,
    model: context.model,
    accountTasks: context.tasks,
    opportunities: context.opportunities,
    escalations: context.escalations,
    meetingSummaries: context.meetingSummaries,
    activityRows: context.duplicateRows,
    scoreHistory: context.scoreHistory,
    thresholdOverrides: context.thresholdOverrides,
  }).filter((suggestion) => !isDuplicateAiActivity(suggestion, context.duplicateRows));

  return {
    suggestions: fallbackSuggestions.slice(0, 6),
    fallback: true,
    status: fallbackSuggestions.length
      ? `${formatSafeUserError(error)} Showing strategic fallback suggestions instead.`
      : `${formatSafeUserError(error)} No strong AI recommendations found for this account.`,
  };
}

function formatSafeUserError(error) {
  if (error?.safeMessage) return error.safeMessage;
  if (error?.category === "invalid_session") {
    return "AI suggestions are unavailable because your session could not be verified.";
  }
  if (error?.category === "unauthorized_account") {
    return "AI suggestions are unavailable because you are not authorized to access this account.";
  }
  if (error?.category === "rate_limited") {
    return "AI suggestions are temporarily unavailable because this account has reached the request limit. Please try again later.";
  }
  const message = String(error?.message ?? "OpenAI suggestions failed.");
  if (error?.source === "environment" || /api key|openai_api_key/i.test(message)) {
    return "AI suggestions are unavailable because the OpenAI key is missing on the server.";
  }
  if (error?.source === "supabase") {
    return "AI suggestions are unavailable because the backend is not authorized to access account context.";
  }
  if (error?.source === "openai" && error.status === 403) {
    return "AI suggestions are unavailable because OpenAI rejected the request. Check model and project permissions.";
  }
  if (error?.source === "openai") {
    return "AI suggestions are unavailable because OpenAI could not generate a response.";
  }
  if (/fetch failed|network|econn|timeout|failed to fetch/i.test(message)) {
    return "OpenAI request could not reach the API.";
  }
  return "AI suggestions are unavailable because the request could not be completed safely.";
}

export async function generateKamAiSuggestions({ accountId }, authContext = {}) {
  let context;
  let auth;
  let selectedModel = null;

  try {
    auth = await authenticateAndAuthorizeAiRequest(accountId, authContext.authorizationHeader);
    await enforceAiRateLimit({
      client: auth.client,
      profileId: auth.profile.id,
      accountId,
    });
    await writeAiAuditEvent(auth.client, {
      profileId: auth.profile.id,
      accountId,
      eventType: "request_started",
    });
  } catch (error) {
    logKamAi("warn", "AI request blocked before context fetch", {
      source: "auth",
      accountRef: hashForLog(accountId),
      category: error?.category ?? "authorization_failed",
    });
    throw new Error(formatSafeUserError(error));
  }

  try {
    context = await gatherKamSuggestionContext(accountId, auth.client);
    logKamAi("info", "context gathered", {
      source: "server",
      accountRef: hashForLog(accountId),
      tasks: context.tasks.length,
      opportunities: context.opportunities.length,
      escalations: context.escalations.length,
      existingActivities: context.duplicateRows.length,
    });
  } catch (error) {
    error.source = error.source ?? "supabase";
    logKamAi("error", "context gather failed", {
      accountRef: hashForLog(accountId),
      ...toSafeErrorDetails(error),
    });
    await writeAiAuditEvent(auth.client, {
      profileId: auth.profile.id,
      accountId,
      eventType: "request_failed",
      failureCategory: error?.category ?? "supabase_failed",
    });
    throw new Error(formatSafeUserError(error));
  }

  try {
    const openAiResult = await callOpenAiForSuggestions(context, {
      id: auth.profile.id,
      name: auth.profile.name,
      role: auth.profile.role,
    });
    selectedModel = getOpenAiModelCandidates()[0];
    const suggestions = normalizeAndFilterSuggestions(
      openAiResult.suggestions,
      context.account.id,
      context.duplicateRows,
    );

    await writeAiAuditEvent(auth.client, {
      profileId: auth.profile.id,
      accountId,
      eventType: "request_success",
      model: selectedModel,
      suggestionCount: suggestions.length,
    });

    return {
      suggestions,
      fallback: false,
      status: suggestions.length
        ? `${suggestions.length} best AI recommendation${suggestions.length === 1 ? "" : "s"} generated for this account.`
        : "No strong AI recommendations found for this account.",
    };
  } catch (error) {
    logKamAi("warn", "using strategic fallback suggestions", {
      accountRef: hashForLog(accountId),
      ...toSafeErrorDetails(error),
    });
    await writeAiAuditEvent(auth.client, {
      profileId: auth.profile.id,
      accountId,
      eventType: "request_fallback",
      failureCategory: error?.category ?? error?.source ?? "openai_failed",
      model: selectedModel ?? getOpenAiModelCandidates()[0],
    });
    return buildFallbackSuggestions(context, error);
  }
}

export const fetchKamAiSuggestions = createServerFn({ method: "POST" })
  .middleware([kamAiAuthHeaderMiddleware])
  .inputValidator(validateInput)
  .handler(async ({ data, context }) =>
    generateKamAiSuggestions(data, { authorizationHeader: context.authorizationHeader }),
  );
