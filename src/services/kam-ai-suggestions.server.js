import { createServerFn } from "@tanstack/react-start";
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
  "You are a KAM strategy advisor. Generate new strategic recommendations for this account. Do not copy Score Marking Matrics items. Do not copy existing activities. Use Score Marking Matrics only to understand how score is calculated. Return only new actionable activities that a KAM can perform to improve the score.",
  "You are an AI Agent for a Key Account Management system.",
  "Your job is to generate account-specific activities that can increase account score.",
  "Use the supplied account, score, task, opportunity, risk, activity, meeting, and rule context.",
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

function logKamAi(level, event, details = {}) {
  const safeDetails = Object.fromEntries(
    Object.entries(details).filter(([key]) => !/key|token|secret|authorization/i.test(key)),
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

function buildScoreMatricsContext(account, model) {
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

function buildAgentPayload({
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
    account: {
      id: account.id,
      name: account.name,
      industry: account.industry,
      tier: account.tier,
      arr: account.arr,
      growthUpside: account.growthUpside,
      renewalDays: account.renewalDays,
      retentionRisk: account.retentionRisk,
      engagementTenure: account.engagementTenure,
      cooperation: account.cooperation,
      serviceConsumption: account.serviceConsumption,
      meetingsPerMonth: account.meetingsPerMonth,
      primaryContact: account.primaryContact,
      stakeholders: (account.stakeholders ?? []).map((stakeholder) => ({
        name: stakeholder.name,
        role: stakeholder.role,
        influence: stakeholder.influence,
        lastContact: stakeholder.lastContact,
      })),
    },
    scoreMarkingMatrics: buildScoreMatricsContext(account, model),
    scoreHistory: scoreHistory.slice(0, MAX_CONTEXT_ITEMS).map((row) => ({
      parameter: row.parameter,
      metric: row.metric,
      score: row.score,
      snapshotMonth: row.snapshotMonth,
      notes: row.notes,
    })),
    thresholdOverrides: thresholdOverrides.slice(0, MAX_CONTEXT_ITEMS).map((row) => ({
      ruleId: row.ruleId,
      parameter: row.parameter,
      threshold: row.threshold,
      targetScore: row.targetScore,
      reason: row.reason,
    })),
    existingActivities: savedRuleActivities.slice(0, 40).map((activity) => ({
      title: activity.title,
      healthArea: activity.parameter,
      description: activity.nextStep || activity.weakSignal,
      status: activity.status,
      expectedLift: activity.expectedLift,
    })),
    existingLegacyActivities: (account.activities ?? []).slice(0, MAX_CONTEXT_ITEMS).map((activity) => ({
      title: activity.title,
      healthArea: activity.area,
      status: activity.status,
      expectedLift: activity.expectedLift,
    })),
    tasks: tasks.slice(0, MAX_CONTEXT_ITEMS).map((task) => ({
      title: task.title,
      description: task.description,
      area: task.area,
      status: task.status,
      taskSignal: task.priority,
      dueDate: task.dueDate,
    })),
    opportunities: opportunities.slice(0, MAX_CONTEXT_ITEMS).map((opportunity) => ({
      title: opportunity.title,
      source: opportunity.source,
      potential: opportunity.potential,
      confidence: opportunity.confidence,
      nextStep: opportunity.nextStep,
    })),
    risksAndEscalations: escalations.slice(0, MAX_CONTEXT_ITEMS).map((escalation) => ({
      title: escalation.title,
      escalationSignal: escalation.priority,
      slaRemainingHours: escalation.slaRemainingHours,
      description: escalation.description,
      recommendation: escalation.recommendation,
      actionItems: escalation.actionItems,
    })),
    recentCustomerActivity: meetingSummaries.slice(0, 5).map((meeting) => ({
      title: meeting.title,
      date: meeting.meetingDate,
      overview: meeting.overview || meeting.shortSummary,
      actionItems: meeting.actionItems,
      derivedActionItems: meeting.derivedActionItems,
      derivedOpportunities: meeting.derivedOpportunities,
    })),
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

async function gatherKamSuggestionContext(accountId) {
  const {
    fetchAccount,
    fetchAccountTasksForAiSuggestions,
    fetchActivityRuleActivities,
    fetchActivityRuleThresholdOverrides,
    fetchActivityScoreHistory,
    fetchEscalations,
    fetchFirefliesMeetingSummaries,
    fetchOpportunities,
  } = await import("@/services/db");

  const account = await fetchAccount(accountId);
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
    safeContextFetch("tasks", fetchAccountTasksForAiSuggestions(accountId)),
    safeContextFetch("opportunities", fetchOpportunities(accountId)),
    safeContextFetch("escalations", fetchEscalations(accountId)),
    safeContextFetch("activity_score_history", fetchActivityScoreHistory(accountId)),
    safeContextFetch(
      "activity_rule_threshold_overrides",
      fetchActivityRuleThresholdOverrides(accountId),
    ),
    safeContextFetch("activity_rule_activities", fetchActivityRuleActivities(accountId)),
    safeContextFetch("fireflies_meeting_summaries", fetchFirefliesMeetingSummaries(accountId)),
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
    accountId: context.account?.id,
  });

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: JSON.stringify(buildAgentPayload(context)),
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
    accountId: context.account?.id,
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
  return message;
}

export async function generateKamAiSuggestions({ accountId, user = {} }) {
  let context;

  try {
    context = await gatherKamSuggestionContext(accountId);
    logKamAi("info", "context gathered", {
      source: "server",
      accountId,
      tasks: context.tasks.length,
      opportunities: context.opportunities.length,
      escalations: context.escalations.length,
      existingActivities: context.duplicateRows.length,
    });
  } catch (error) {
    error.source = error.source ?? "supabase";
    logKamAi("error", "context gather failed", {
      accountId,
      ...toSafeErrorDetails(error),
    });
    throw new Error(formatSafeUserError(error));
  }

  try {
    const openAiResult = await callOpenAiForSuggestions(context, user);
    const suggestions = normalizeAndFilterSuggestions(
      openAiResult.suggestions,
      context.account.id,
      context.duplicateRows,
    );

    return {
      suggestions,
      fallback: false,
      status: suggestions.length
        ? `${suggestions.length} best AI recommendation${suggestions.length === 1 ? "" : "s"} generated for ${context.account.name}.`
        : "No strong AI recommendations found for this account.",
    };
  } catch (error) {
    logKamAi("warn", "using strategic fallback suggestions", {
      accountId,
      ...toSafeErrorDetails(error),
    });
    return buildFallbackSuggestions(context, error);
  }
}

export const fetchKamAiSuggestions = createServerFn({ method: "POST" })
  .inputValidator(validateInput)
  .handler(async ({ data }) => generateKamAiSuggestions(data));
