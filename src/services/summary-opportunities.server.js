import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import {
  fetchAccount,
  fetchOpportunities,
  upsertOpportunitiesFromMeetingAgent,
} from "@/services/db";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5.4-mini";
const MAX_OPPORTUNITIES = 6;
const STRICT_OPPORTUNITY_SIGNAL_PATTERN =
  /\b(hire|hiring|hired|hires|job|jobs|job\s+post|job\s+opening|open\s+role|opening|openings|recruit|recruiting|recruitment|headcount|expand|expands|expanded|expanding|expansion|opportunity|opportunities)\b/i;
const OPPORTUNITY_TOKEN_STOP_WORDS = new Set([
  "account",
  "and",
  "business",
  "client",
  "company",
  "for",
  "from",
  "growth",
  "need",
  "needs",
  "new",
  "rapid",
  "service",
  "services",
  "support",
  "the",
  "this",
  "to",
  "with",
]);

const OPPORTUNITY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["opportunities"],
  properties: {
    opportunities: {
      type: "array",
      maxItems: MAX_OPPORTUNITIES,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "source",
          "source_excerpt",
          "category",
          "potential",
          "confidence",
          "next_step",
        ],
        properties: {
          title: { type: "string" },
          source: { type: "string", enum: ["LinkedIn summary", "Website summary"] },
          source_excerpt: { type: "string" },
          category: { type: "string", enum: ["Growth", "Retention", "Resource"] },
          potential: { type: "integer" },
          confidence: { type: "string", enum: ["High", "Medium", "Low"] },
          next_step: { type: "string" },
        },
      },
    },
  },
};

const SYSTEM_PROMPT = [
  "You are an opportunity extraction agent for a Key Account Management system.",
  "Extract only real commercial opportunities from LinkedIn and website summaries.",
  "Strict guardrail: only extract a candidate when the source text clearly contains hiring, job, recruiting, headcount, expansion, expand, or opportunity language.",
  "Good opportunities include hiring/job posts that imply resource demand, team expansion, new locations, new business units, new service domains, or explicit expansion/opportunity signals.",
  "Do not infer opportunities only from generic technology words, industry descriptions, awards, biographies, or vague marketing language.",
  "Do not return two opportunities that are just reworded versions of the same signal.",
  "Ignore generic company descriptions, awards, biographies, and vague marketing language unless they create a concrete KAM action.",
  "Return at most 6 opportunities. Return an empty array if there are no strong opportunities.",
  "Each opportunity must include a concrete next step for the KAM.",
  "The source_excerpt must include the specific hiring/job/expansion/opportunity wording that justifies the opportunity.",
  "Return only JSON matching the schema.",
].join(" ");

function validateInput(input = {}) {
  if (!input || typeof input.accountId !== "string" || !input.accountId.trim()) {
    throw new Error("Opportunity extraction requires a valid account id.");
  }
  return { accountId: input.accountId };
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
    getRuntimeEnvValue("OPENAI_OPPORTUNITY_MODEL") ??
    getRuntimeEnvValue("OPENAI_MODEL") ??
    DEFAULT_MODEL
  );
}

function getSupabaseAdmin() {
  const supabaseUrl = getRuntimeEnvValue("SUPABASE_URL") ?? getRuntimeEnvValue("VITE_SUPABASE_URL");
  const serviceRoleKey = getRuntimeEnvValue("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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

function toId(value = "") {
  return normalizeText(value).replace(/\s+/g, "-").slice(0, 80) || "opportunity";
}

function hasStrictOpportunitySignal(candidate = {}) {
  const sourceText = String(candidate.sourceExcerpt ?? candidate.source_excerpt ?? "").trim();
  const fallbackText = [candidate.title, candidate.nextStep ?? candidate.next_step]
    .filter(Boolean)
    .join(" ");
  return STRICT_OPPORTUNITY_SIGNAL_PATTERN.test(sourceText || fallbackText);
}

function canonicalOpportunityToken(token = "") {
  if (/^(hire|hiring|hired|hires|recruit|recruiting|recruitment|headcount)$/.test(token)) {
    return "hire";
  }
  if (/^(job|jobs|role|roles|opening|openings)$/.test(token)) return "job";
  if (/^(expand|expands|expanded|expanding|expansion|growth)$/.test(token)) return "expand";
  if (/^opportunit/.test(token)) return "opportunity";
  if (/^consult/.test(token)) return "consultant";
  if (/^internation/.test(token)) return "international";
  return token;
}

function getOpportunityTokens(candidate = {}) {
  const text = [candidate.title, candidate.sourceExcerpt, candidate.nextStep]
    .filter(Boolean)
    .join(" ");
  return new Set(
    normalizeText(text)
      .split(" ")
      .map(canonicalOpportunityToken)
      .filter((token) => token.length >= 3 && !OPPORTUNITY_TOKEN_STOP_WORDS.has(token)),
  );
}

function getSimilarityScore(leftTokens, rightTokens) {
  if (!leftTokens.size || !rightTokens.size) return 0;
  const intersectionSize = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const unionSize = new Set([...leftTokens, ...rightTokens]).size;
  const overlap = intersectionSize / Math.min(leftTokens.size, rightTokens.size);
  const jaccard = intersectionSize / unionSize;
  return Math.max(jaccard, overlap >= 0.9 && intersectionSize >= 3 ? overlap : 0);
}

function areSimilarOpportunities(left, right) {
  const leftTitle = normalizeText(left?.title);
  const rightTitle = normalizeText(right?.title);
  if (leftTitle && rightTitle && leftTitle === rightTitle) return true;

  return getSimilarityScore(getOpportunityTokens(left), getOpportunityTokens(right)) >= 0.72;
}

function hashText(value = "") {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function splitSignals(text = "") {
  return String(text ?? "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 30)
    .slice(0, 80);
}

const SIGNAL_RULES = [
  {
    category: "Resource",
    confidence: "High",
    pattern:
      /\b(hiring|job post|job opening|open role|recruit|talent|headcount|staff|engineer|developer|resource|team expansion)\b/i,
    title: (account) => `Resource expansion signal for ${account.name}`,
    nextStep: "Validate hiring demand and propose a matching resource or team-extension plan.",
    potentialFactor: 0.1,
  },
  {
    category: "Growth",
    confidence: "High",
    pattern:
      /\b(ai|automation|data platform|analytics|cloud|cybersecurity|security|devops|erp|crm|modernization|digital transformation|migration)\b/i,
    title: (account) => `Technology services opportunity for ${account.name}`,
    nextStep: "Map the initiative to current capabilities and schedule a discovery call with the sponsor.",
    potentialFactor: 0.12,
  },
  {
    category: "Growth",
    confidence: "Medium",
    pattern:
      /\b(new office|new market|expansion|launch|new product|new location|region|international|branch|facility)\b/i,
    title: (account) => `Expansion support opportunity for ${account.name}`,
    nextStep: "Confirm expansion timeline and identify delivery, data, or staffing support needs.",
    potentialFactor: 0.08,
  },
  {
    category: "Retention",
    confidence: "Medium",
    pattern:
      /\b(compliance|regulatory|risk|audit|quality|sla|customer support|incident|operational issue|service reliability)\b/i,
    title: (account) => `Risk and compliance support opportunity for ${account.name}`,
    nextStep: "Review risk context and propose a client-safe recovery or compliance support plan.",
    potentialFactor: 0.06,
  },
  {
    category: "Growth",
    confidence: "Medium",
    pattern: /\b(procurement|vendor|partner|rfp|outsourc|managed service|consulting|implementation)\b/i,
    title: (account) => `Vendor support opportunity for ${account.name}`,
    nextStep: "Identify buyer, scope, and budget owner for a targeted proposal.",
    potentialFactor: 0.1,
  },
];

function estimatePotential(account, factor = 0.08) {
  const base = Number(account.arr || account.contractValue || account.growthUpside || 500000);
  const value = Math.max(50000, Math.round(base * factor));
  return Math.round(value / 1000) * 1000;
}

function buildLocalOpportunityCandidates(account) {
  const sources = [
    { source: "LinkedIn summary", text: account.linkedinSummary },
    { source: "Website summary", text: account.websiteSummary },
  ];
  const candidates = [];

  for (const source of sources) {
    for (const sentence of splitSignals(source.text)) {
      const rule = SIGNAL_RULES.find((candidateRule) => candidateRule.pattern.test(sentence));
      if (!rule) continue;
      candidates.push({
        title: rule.title(account),
        source: source.source,
        sourceExcerpt: sentence,
        category: rule.category,
        potential: estimatePotential(account, rule.potentialFactor),
        confidence: rule.confidence,
        nextStep: rule.nextStep,
      });
    }
  }

  return dedupeOpportunityCandidates(candidates).slice(0, MAX_OPPORTUNITIES);
}

function normalizeAiOpportunity(raw = {}) {
  const title = String(raw.title ?? "").trim();
  const source = /linkedin/i.test(raw.source) ? "LinkedIn summary" : "Website summary";
  const sourceExcerpt = String(raw.source_excerpt ?? raw.sourceExcerpt ?? "").trim();
  const category = ["Growth", "Retention", "Resource"].includes(raw.category)
    ? raw.category
    : "Growth";
  const confidence = ["High", "Medium", "Low"].includes(raw.confidence)
    ? raw.confidence
    : "Medium";
  const nextStep = String(raw.next_step ?? raw.nextStep ?? "").trim();
  if (!title || !sourceExcerpt || !nextStep) return null;
  return {
    title,
    source,
    sourceExcerpt,
    category,
    potential: Math.max(0, Math.round(Number(raw.potential) || 0)),
    confidence,
    nextStep,
  };
}

function dedupeOpportunityCandidates(candidates = []) {
  const accepted = [];
  for (const candidate of candidates) {
    if (!hasStrictOpportunitySignal(candidate)) continue;
    const key = normalizeText(`${candidate.title} ${candidate.source}`);
    if (!key) continue;
    if (accepted.some((existing) => areSimilarOpportunities(existing, candidate))) continue;
    accepted.push(candidate);
  }
  return accepted;
}

async function callOpenAiForOpportunities(account) {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getOpenAiModel(),
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            account: {
              id: account.id,
              name: account.name,
              industry: account.industry,
              arr: account.arr,
              contractValue: account.contractValue,
              growthUpside: account.growthUpside,
              retentionRisk: account.retentionRisk,
            },
            linkedinSummary: account.linkedinSummary || "",
            websiteSummary: account.websiteSummary || "",
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "summary_opportunities",
          schema: OPPORTUNITY_SCHEMA,
          strict: true,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI opportunity extraction failed with HTTP ${response.status}.`);
  }

  const payload = await response.json().catch(() => null);
  const outputText = getOutputText(payload);
  if (!outputText) return [];
  const parsed = JSON.parse(outputText);
  return dedupeOpportunityCandidates(
    (parsed.opportunities ?? []).map(normalizeAiOpportunity).filter(Boolean),
  );
}

function mapToPersistedOpportunity(account, candidate, index) {
  const sourceId = hashText(`${candidate.source}|${candidate.title}|${candidate.sourceExcerpt}`);
  return {
    id: `summary-opp-${account.id}-${toId(candidate.title)}-${sourceId}-${index}`,
    title: candidate.title,
    source: candidate.source,
    signalDate: "Summary scan",
    potential: candidate.potential || estimatePotential(account),
    confidence: candidate.confidence ?? "Medium",
    nextStep: candidate.nextStep,
  };
}

function mapPersistedOpportunityRow(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    title: row.title,
    source: row.source ?? "",
    signalDate: row.signal_date ?? "",
    potential: row.potential ?? 0,
    confidence: row.confidence,
    nextStep: row.next_step ?? "",
  };
}

async function persistSummaryOpportunities({ accountId, opportunities }) {
  if (!opportunities?.length) return [];

  const admin = getSupabaseAdmin();
  if (!admin) {
    return upsertOpportunitiesFromMeetingAgent({ accountId, opportunities });
  }

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

  const { data, error } = await admin
    .from("opportunities")
    .upsert(rows, { onConflict: "id" })
    .select("*");

  if (error) {
    console.error("[summary-opportunities] Opportunity upsert failed:", {
      code: error.code,
      message: error.message,
      accountId,
      count: rows.length,
    });
    throw new Error(`Could not save extracted opportunities: ${error.message}`);
  }

  return (data ?? []).map(mapPersistedOpportunityRow);
}

function removeExistingOpportunities(candidates, existingOpportunities) {
  const existing = existingOpportunities ?? [];
  const newCandidates = [];

  for (const candidate of dedupeOpportunityCandidates(candidates)) {
    if (existing.some((opportunity) => areSimilarOpportunities(candidate, opportunity))) continue;
    if (newCandidates.some((opportunity) => areSimilarOpportunities(candidate, opportunity))) {
      continue;
    }
    newCandidates.push(candidate);
  }

  return newCandidates;
}

async function buildSummaryOpportunities(account) {
  const hasSummary = Boolean(account.linkedinSummary?.trim() || account.websiteSummary?.trim());
  if (!hasSummary) return { opportunities: [], fallback: false, status: "No summaries available." };

  try {
    const opportunities = await callOpenAiForOpportunities(account);
    return { opportunities, fallback: false, status: "AI opportunity extraction completed." };
  } catch (error) {
    const opportunities = buildLocalOpportunityCandidates(account);
    return {
      opportunities,
      fallback: true,
      status: opportunities.length
        ? "AI opportunity extraction was unavailable; local summary signals were used."
        : "No strong opportunities found in LinkedIn or website summaries.",
    };
  }
}

export const syncSummaryOpportunitiesServer = createServerFn({ method: "POST" }).handler(
  async ({ data }) => {
    const { accountId } = validateInput(data);
    const account = await fetchAccount(accountId);
    if (!account) throw new Error("Account not found.");

    const existingOpportunities = await fetchOpportunities(accountId);
    const result = await buildSummaryOpportunities(account);
    const newCandidates = removeExistingOpportunities(result.opportunities, existingOpportunities);
    const savedOpportunities = await persistSummaryOpportunities({
      accountId,
      opportunities: newCandidates.map((candidate, index) =>
        mapToPersistedOpportunity(account, candidate, index),
      ),
    });

    return {
      ok: true,
      savedCount: savedOpportunities.length,
      fallback: result.fallback,
      status: result.status,
      syncedAt: new Date().toISOString(),
    };
  },
);
