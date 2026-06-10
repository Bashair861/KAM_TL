import { createServerFn } from "@tanstack/react-start";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const AI_USAGE_REFRESH_LABEL = "Daily";
export const OPENAI_PRICING_SOURCE_URL = "https://developers.openai.com/api/docs/pricing";
export const OPENAI_PRICING_EFFECTIVE_DATE = "2026-06-09";

export const OPENAI_PRICING_CATALOG = {
  "gpt-5.5": {
    provider: "OpenAI",
    inputPer1M: 5,
    cachedInputPer1M: 0.5,
    outputPer1M: 30,
    context: "Standard short context",
  },
  "gpt-5.4": {
    provider: "OpenAI",
    inputPer1M: 2.5,
    cachedInputPer1M: 0.25,
    outputPer1M: 15,
    context: "Standard short context",
  },
  "gpt-5.4-mini": {
    provider: "OpenAI",
    inputPer1M: 0.75,
    cachedInputPer1M: 0.075,
    outputPer1M: 4.5,
    context: "Standard short context",
  },
  "gpt-5.4-nano": {
    provider: "OpenAI",
    inputPer1M: 0.2,
    cachedInputPer1M: 0.02,
    outputPer1M: 1.25,
    context: "Standard short context",
  },
  "gpt-5": {
    provider: "OpenAI",
    inputPer1M: 1.25,
    cachedInputPer1M: 0.125,
    outputPer1M: 10,
    context: "Standard",
  },
  "gpt-5-mini": {
    provider: "OpenAI",
    inputPer1M: 0.25,
    cachedInputPer1M: 0.025,
    outputPer1M: 2,
    context: "Standard",
  },
  "gpt-5-nano": {
    provider: "OpenAI",
    inputPer1M: 0.05,
    cachedInputPer1M: 0.005,
    outputPer1M: 0.4,
    context: "Standard",
  },
  "gpt-4.1": {
    provider: "OpenAI",
    inputPer1M: 2,
    cachedInputPer1M: 0.5,
    outputPer1M: 8,
    context: "Standard",
  },
  "gpt-4.1-mini": {
    provider: "OpenAI",
    inputPer1M: 0.4,
    cachedInputPer1M: 0.1,
    outputPer1M: 1.6,
    context: "Standard",
  },
  "gpt-4.1-nano": {
    provider: "OpenAI",
    inputPer1M: 0.1,
    cachedInputPer1M: 0.025,
    outputPer1M: 0.4,
    context: "Standard",
  },
  "gpt-4o": {
    provider: "OpenAI",
    inputPer1M: 2.5,
    cachedInputPer1M: 1.25,
    outputPer1M: 10,
    context: "Standard",
  },
  "gpt-4o-mini": {
    provider: "OpenAI",
    inputPer1M: 0.15,
    cachedInputPer1M: 0.075,
    outputPer1M: 0.6,
    context: "Standard",
  },
};

const OPENAI_TOOL_PRICING = {
  web_search: {
    label: "Web search",
    perCallUsd: 10 / 1000,
  },
  web_search_preview_reasoning: {
    label: "Web search preview",
    perCallUsd: 10 / 1000,
  },
  web_search_preview_non_reasoning: {
    label: "Web search preview",
    perCallUsd: 25 / 1000,
  },
};

function readEnv(name) {
  if (typeof process !== "undefined" && process.env?.[name]) return process.env[name];
  return undefined;
}

function normalizeRequester(user = {}) {
  const id = String(user?.id ?? "").trim();
  const name = String(user?.name ?? "").trim();
  const role = String(user?.role ?? "").trim();
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return {
    requesterProfileId: uuidPattern.test(id) ? id : null,
    requesterName: name || null,
    requesterRole: role || null,
  };
}

function parseNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundCost(value) {
  return Math.round(parseNumber(value) * 1_000_000) / 1_000_000;
}

function dayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toISOString().slice(0, 10);
}

function isMissingAiUsageTableError(error) {
  const message = String(error?.message ?? "").toLowerCase();
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    message.includes("ai_usage_events") ||
    message.includes("schema cache")
  );
}

function resolvePricingModel(model) {
  const modelId = String(model ?? "").trim();
  if (!modelId) return null;
  if (OPENAI_PRICING_CATALOG[modelId]) return modelId;

  const keys = Object.keys(OPENAI_PRICING_CATALOG).sort((a, b) => b.length - a.length);
  return keys.find((key) => modelId.startsWith(`${key}-`)) ?? null;
}

function isReasoningSearchModel(model) {
  return /^gpt-5|^o[0-9]/i.test(String(model ?? ""));
}

function normalizeToolCalls(toolCalls = [], model) {
  return toolCalls
    .map((tool) => {
      const type = String(tool?.type ?? "").trim();
      const count = Math.max(0, Math.round(parseNumber(tool?.count ?? 1)));
      if (!type || count === 0) return null;
      if (type === "web_search_preview") {
        const key = isReasoningSearchModel(model)
          ? "web_search_preview_reasoning"
          : "web_search_preview_non_reasoning";
        return { type, count, pricingKey: key, ...OPENAI_TOOL_PRICING[key] };
      }
      if (!OPENAI_TOOL_PRICING[type]) return { type, count, pricingKey: type, label: type, perCallUsd: 0 };
      return { type, count, pricingKey: type, ...OPENAI_TOOL_PRICING[type] };
    })
    .filter(Boolean);
}

export function extractOpenAiUsage(payload) {
  const usage = payload?.usage ?? {};
  const inputTokens = parseNumber(usage.input_tokens ?? usage.prompt_tokens);
  const outputTokens = parseNumber(usage.output_tokens ?? usage.completion_tokens);
  const totalTokens = parseNumber(usage.total_tokens) || inputTokens + outputTokens;
  const cachedInputTokens = parseNumber(
    usage.input_tokens_details?.cached_tokens ??
      usage.prompt_tokens_details?.cached_tokens ??
      usage.prompt_tokens_details?.cached_input_tokens,
  );

  return {
    inputTokens,
    cachedInputTokens,
    outputTokens,
    totalTokens,
  };
}

export function estimateOpenAiCost(model, usage, toolCalls = []) {
  const pricingModel = resolvePricingModel(model);
  const pricing = pricingModel ? OPENAI_PRICING_CATALOG[pricingModel] : null;
  const billableInputTokens = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
  const inputCostUsd = pricing ? (billableInputTokens / 1_000_000) * pricing.inputPer1M : 0;
  const cachedInputCostUsd =
    pricing && pricing.cachedInputPer1M != null
      ? (usage.cachedInputTokens / 1_000_000) * pricing.cachedInputPer1M
      : 0;
  const outputCostUsd = pricing ? (usage.outputTokens / 1_000_000) * pricing.outputPer1M : 0;
  const normalizedToolCalls = normalizeToolCalls(toolCalls, model);
  const toolCostUsd = normalizedToolCalls.reduce(
    (sum, tool) => sum + tool.count * parseNumber(tool.perCallUsd),
    0,
  );
  const estimatedCostUsd = inputCostUsd + cachedInputCostUsd + outputCostUsd + toolCostUsd;

  return {
    pricingKnown: Boolean(pricing),
    pricingModel,
    inputCostUsd: roundCost(inputCostUsd),
    cachedInputCostUsd: roundCost(cachedInputCostUsd),
    outputCostUsd: roundCost(outputCostUsd),
    toolCostUsd: roundCost(toolCostUsd),
    estimatedCostUsd: roundCost(estimatedCostUsd),
    toolCalls: normalizedToolCalls.map((tool) => ({
      type: tool.type,
      count: tool.count,
      label: tool.label,
      perCallUsd: tool.perCallUsd,
    })),
    pricingSnapshot: pricing
      ? {
          sourceUrl: OPENAI_PRICING_SOURCE_URL,
          effectiveDate: OPENAI_PRICING_EFFECTIVE_DATE,
          model: pricingModel,
          inputPer1M: pricing.inputPer1M,
          cachedInputPer1M: pricing.cachedInputPer1M,
          outputPer1M: pricing.outputPer1M,
          context: pricing.context,
        }
      : {
          sourceUrl: OPENAI_PRICING_SOURCE_URL,
          effectiveDate: OPENAI_PRICING_EFFECTIVE_DATE,
          model: model ?? "unknown",
          note: "Pricing not configured for this model.",
        },
  };
}

async function createUsageAdminClient() {
  const supabaseUrl = readEnv("VITE_SUPABASE_URL");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return null;

  const { createClient } = await import("@supabase/supabase-js");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function recordOpenAiUsage({
  feature,
  agent,
  model,
  responseJson,
  accountId = null,
  requestStatus = "success",
  metadata = {},
  toolCalls = [],
  user = {},
}) {
  try {
    const actualModel = String(model ?? responseJson?.model ?? "unknown");
    const requester = normalizeRequester(user);
    const usage = extractOpenAiUsage(responseJson);
    const hasTokenUsage = usage.inputTokens || usage.outputTokens || usage.totalTokens;
    const normalizedToolCalls = normalizeToolCalls(toolCalls, actualModel);
    if (!hasTokenUsage && normalizedToolCalls.length === 0) return null;

    const cost = estimateOpenAiCost(actualModel, usage, normalizedToolCalls);
    const client = await createUsageAdminClient();
    if (!client) return null;

    const row = {
      provider: "openai",
      feature: String(feature ?? "AI Request"),
      agent: agent ? String(agent) : null,
      model: actualModel,
      account_id: accountId || null,
      requester_profile_id: requester.requesterProfileId,
      requester_name: requester.requesterName,
      requester_role: requester.requesterRole,
      input_tokens: usage.inputTokens,
      cached_input_tokens: usage.cachedInputTokens,
      output_tokens: usage.outputTokens,
      total_tokens: usage.totalTokens,
      input_cost_usd: cost.inputCostUsd,
      cached_input_cost_usd: cost.cachedInputCostUsd,
      output_cost_usd: cost.outputCostUsd,
      tool_cost_usd: cost.toolCostUsd,
      estimated_cost_usd: cost.estimatedCostUsd,
      pricing_known: cost.pricingKnown,
      request_status: requestStatus,
      pricing_snapshot: cost.pricingSnapshot,
      metadata: {
        ...metadata,
        toolCalls: cost.toolCalls,
      },
    };

    const { error } = await client.from("ai_usage_events").insert(row);
    if (error) {
      if (!isMissingAiUsageTableError(error)) {
        console.warn("AI usage logging failed", error.message ?? error);
      }
      return null;
    }
    return row;
  } catch (error) {
    console.warn("AI usage logging failed", error?.message ?? error);
    return null;
  }
}

function summarizeRows(rows) {
  return rows.reduce(
    (summary, row) => ({
      calls: summary.calls + 1,
      inputTokens: summary.inputTokens + parseNumber(row.input_tokens),
      cachedInputTokens: summary.cachedInputTokens + parseNumber(row.cached_input_tokens),
      outputTokens: summary.outputTokens + parseNumber(row.output_tokens),
      totalTokens: summary.totalTokens + parseNumber(row.total_tokens),
      estimatedCostUsd: roundCost(summary.estimatedCostUsd + parseNumber(row.estimated_cost_usd)),
      unknownPricingCalls: summary.unknownPricingCalls + (row.pricing_known === false ? 1 : 0),
    }),
    {
      calls: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      unknownPricingCalls: 0,
    },
  );
}

function groupFeatureRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = [row.feature ?? "AI Request", row.agent ?? "General", row.model ?? "unknown"].join("|");
    const current =
      groups.get(key) ?? {
        feature: row.feature ?? "AI Request",
        agent: row.agent ?? "General",
        model: row.model ?? "unknown",
        lastUsedAt: row.created_at,
        rows: [],
      };
    current.rows.push(row);
    if (new Date(row.created_at) > new Date(current.lastUsedAt)) current.lastUsedAt = row.created_at;
    groups.set(key, current);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      rows: undefined,
      ...summarizeRows(group.rows),
    }))
    .sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd || b.calls - a.calls);
}

function groupDailyRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = dayKey(row.created_at);
    const current = groups.get(key) ?? { date: key, rows: [] };
    current.rows.push(row);
    groups.set(key, current);
  }

  return [...groups.values()]
    .map((group) => ({
      date: group.date,
      ...summarizeRows(group.rows),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function groupKamRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const name = row.requester_name || "Unassigned";
    const role = row.requester_role || "Unknown";
    const key = row.requester_profile_id || `${name}|${role}`;
    const current =
      groups.get(key) ?? {
        requesterProfileId: row.requester_profile_id ?? null,
        requesterName: name,
        requesterRole: role,
        lastUsedAt: row.created_at,
        rows: [],
      };
    current.rows.push(row);
    if (new Date(row.created_at) > new Date(current.lastUsedAt)) current.lastUsedAt = row.created_at;
    groups.set(key, current);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      rows: undefined,
      ...summarizeRows(group.rows),
    }))
    .sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd || b.calls - a.calls);
}

function emptyDashboard(overrides = {}) {
  return {
    setupRequired: false,
    updatedAt: new Date().toISOString(),
    refreshCadence: AI_USAGE_REFRESH_LABEL,
    sourceUrl: OPENAI_PRICING_SOURCE_URL,
    pricingEffectiveDate: OPENAI_PRICING_EFFECTIVE_DATE,
    totals: {
      last24h: summarizeRows([]),
      last7d: summarizeRows([]),
      last30d: summarizeRows([]),
    },
    features: [],
    kamCosts: [],
    daily: [],
    pricing: Object.entries(OPENAI_PRICING_CATALOG).map(([model, pricing]) => ({
      model,
      ...pricing,
    })),
    ...overrides,
  };
}

function validateDashboardInput(input) {
  return {
    role: String(input?.role ?? ""),
  };
}

export const fetchAiCostDashboard = createServerFn({ method: "POST" })
  .inputValidator(validateDashboardInput)
  .handler(async ({ data }) => {
    if (data.role !== "Head of KAM") {
      throw new Error("Only Head of KAM can view AI usage and cost.");
    }

    const client = await createUsageAdminClient();
    if (!client) {
      return emptyDashboard({
        setupRequired: true,
        setupMessage:
          "Supabase service role variables are required before AI usage can be loaded.",
      });
    }

    const since = new Date(Date.now() - 30 * MS_PER_DAY).toISOString();
    const { data: rows = [], error } = await client
      .from("ai_usage_events")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) {
      if (isMissingAiUsageTableError(error)) {
        return emptyDashboard({
          setupRequired: true,
          setupMessage:
            "Run src/db/add-ai-usage-events.sql in Supabase SQL Editor to start collecting AI usage.",
        });
      }
      throw error;
    }

    const now = Date.now();
    const inLastDays = (days) =>
      rows.filter((row) => now - new Date(row.created_at).getTime() <= days * MS_PER_DAY);

    return emptyDashboard({
      updatedAt: new Date().toISOString(),
      totals: {
        last24h: summarizeRows(inLastDays(1)),
        last7d: summarizeRows(inLastDays(7)),
        last30d: summarizeRows(rows),
      },
      features: groupFeatureRows(rows),
      kamCosts: groupKamRows(rows),
      daily: groupDailyRows(rows),
    });
  });
