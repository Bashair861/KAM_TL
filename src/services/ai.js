import { createServerFn } from "@tanstack/react-start";
import {
  fetchAccount,
  fetchAccountHistory,
  fetchEscalations,
  fetchOpportunities,
} from "@/services/db";

const DEFAULT_MODEL = "gpt-5-mini";

const AI_RESPONSE_FORMAT = {
  type: "json_schema",
  name: "account_ai_recommendations",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "summary",
      "confidence",
      "riskLevel",
      "risks",
      "opportunities",
      "recommendations",
      "roadmap",
      "followUpQuestions",
    ],
    properties: {
      summary: { type: "string" },
      confidence: { type: "number" },
      riskLevel: { type: "string", enum: ["low", "medium", "high", "critical"] },
      risks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "severity", "evidence"],
          properties: {
            title: { type: "string" },
            severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
            evidence: { type: "string" },
          },
        },
      },
      opportunities: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "potential", "evidence"],
          properties: {
            title: { type: "string" },
            potential: { type: "string" },
            evidence: { type: "string" },
          },
        },
      },
      recommendations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "owner", "timeframe", "evidence"],
          properties: {
            title: { type: "string" },
            owner: { type: "string" },
            timeframe: { type: "string" },
            evidence: { type: "string" },
          },
        },
      },
      roadmap: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["phase", "actions"],
          properties: {
            phase: { type: "string" },
            actions: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      },
      followUpQuestions: {
        type: "array",
        items: { type: "string" },
      },
    },
  },
};

const SYSTEM_INSTRUCTIONS = `
You are Aether KAM's AI account advisor.
Use only the provided CRM/account context.
Do not invent facts, meetings, names, dates, or financial values.
Think like a senior Key Account Management leader.
Prioritize retention risk, renewal urgency, relationship quality, delivery health, escalation exposure, contract posture, and growth upside.
Return concise, practical guidance that a KAM can act on this week.
Return only valid JSON with this shape:
{
  "summary": "string",
  "confidence": 0.0,
  "riskLevel": "low" | "medium" | "high" | "critical",
  "risks": [{"title":"string","severity":"low|medium|high|critical","evidence":"string"}],
  "opportunities": [{"title":"string","potential":"string","evidence":"string"}],
  "recommendations": [{"title":"string","owner":"string","timeframe":"string","evidence":"string"}],
  "roadmap": [{"phase":"string","actions":["string"]}],
  "followUpQuestions": ["string"]
}
`;

function validateAskAiInput(data) {
  const input = data && typeof data === "object" ? data : {};
  const accountId = String(input.accountId ?? "").trim();
  const question = String(input.question ?? "").trim();
  if (!accountId) throw new Error("accountId is required");
  if (!question) throw new Error("question is required");
  return {
    accountId,
    question: question.slice(0, 1200),
    scope: input.scope === "portfolio" ? "portfolio" : "account",
    focus: String(input.focus ?? "roadmap").slice(0, 80),
    timeframe: String(input.timeframe ?? "30_days").slice(0, 80),
    user: {
      id: String(input.user?.id ?? ""),
      name: String(input.user?.name ?? "Unknown"),
      role: String(input.user?.role ?? "KAM"),
    },
  };
}

function shortMoney(value) {
  if (value == null || Number.isNaN(Number(value))) return "unknown";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value));
}

function metricLabels(block) {
  return (block?.metrics ?? [])
    .slice(0, 5)
    .map((m) => `${m.label}: ${m.value}${m.hint ? ` (${m.hint})` : ""}`);
}

function buildAccountContext({ account, escalations, opportunities, history }) {
  const whiteSpace = account.retentionGrowth?.filter((s) => !s.offered && s.applicable) ?? [];
  const inFlight = account.retentionGrowth?.filter((s) => s.offered && !s.delivered) ?? [];
  const delivered = account.retentionGrowth?.filter((s) => s.delivered) ?? [];

  return {
    profile: {
      id: account.id,
      name: account.name,
      industry: account.industry,
      region: account.region,
      tier: account.tier,
      description: account.description,
      businessInfo: account.businessInfo,
      clientHistory: account.clientHistory,
      primaryContact: account.primaryContact,
      stakeholders: account.stakeholders,
      competitors: account.competitors,
      mainBusinessFlow: account.mainBusinessFlow,
      assignedKamId: account.assignedKamId,
    },
    commercial: {
      arr: shortMoney(account.arr),
      contractValue: shortMoney(account.contractValue),
      growthUpside: shortMoney(account.growthUpside),
      renewalDays: account.renewalDays,
      contractType: account.contractType,
      retentionRisk: account.retentionRisk,
      status: account.status,
      whiteSpaceCount: account.whiteSpaceCount,
    },
    health: {
      overall: account.health,
      trend: account.trend,
      relationship: {
        score: account.relationshipHealth?.score,
        metrics: metricLabels(account.relationshipHealth),
      },
      project: {
        score: account.projectHealth?.score,
        metrics: metricLabels(account.projectHealth),
      },
      whiteSpace: { score: account.whiteSpace?.score, metrics: metricLabels(account.whiteSpace) },
      contract: {
        score: account.contractScoring?.score,
        metrics: metricLabels(account.contractScoring),
      },
      csat: { score: account.csat?.score, metrics: metricLabels(account.csat) },
      risk: { score: account.riskScoring?.score, metrics: metricLabels(account.riskScoring) },
      resource: {
        score: account.resourceHealth?.score,
        metrics: metricLabels(account.resourceHealth),
        teamSize: account.resourceHealth?.teamSize,
        backupExists: account.resourceHealth?.backupExists,
        leavesThisMonth: account.resourceHealth?.leavesThisMonth,
        criticalResources: account.resourceHealth?.criticalResources,
      },
      financial: {
        score: account.financialHealth?.score,
        metrics: metricLabels(account.financialHealth),
      },
    },
    contract: {
      autoRenew: account.contractScoring?.autoRenew,
      nonTerminator: account.contractScoring?.nonTerminator,
      minOneYear: account.contractScoring?.minOneYear,
      priceHike: account.contractScoring?.priceHike,
      swot: account.contractScoring?.swot,
      customerFeedback: account.contractScoring?.customerFeedback,
    },
    work: {
      activities: account.activities,
      escalations: escalations.slice(0, 8),
      opportunities: opportunities.slice(0, 8),
      deliveredServices: delivered,
      inFlightServices: inFlight,
      whiteSpaceServices: whiteSpace,
      educationLog: account.educationLog,
      recentHistory: history.slice(0, 8),
    },
  };
}

function normalizeAiResult(result) {
  return {
    summary: String(result?.summary ?? "No summary returned."),
    confidence: Number(result?.confidence ?? 0.7),
    riskLevel: ["low", "medium", "high", "critical"].includes(result?.riskLevel)
      ? result.riskLevel
      : "medium",
    risks: Array.isArray(result?.risks) ? result.risks.slice(0, 5) : [],
    opportunities: Array.isArray(result?.opportunities) ? result.opportunities.slice(0, 5) : [],
    recommendations: Array.isArray(result?.recommendations)
      ? result.recommendations.slice(0, 6)
      : [],
    roadmap: Array.isArray(result?.roadmap) ? result.roadmap.slice(0, 4) : [],
    followUpQuestions: Array.isArray(result?.followUpQuestions)
      ? result.followUpQuestions.slice(0, 4)
      : [],
  };
}

function fallbackRoadmap(context, question) {
  const account = context.profile;
  const commercial = context.commercial;
  const health = context.health;
  const escalations = context.work.escalations ?? [];
  const opportunities = context.work.opportunities ?? [];
  const whiteSpace = context.work.whiteSpaceServices ?? [];
  const riskLevel =
    commercial.renewalDays <= 30 || escalations.some((e) => e.priority === "P1")
      ? "critical"
      : health.overall < 60 || commercial.retentionRisk === "High"
        ? "high"
        : health.overall < 75 || commercial.retentionRisk === "Medium"
          ? "medium"
          : "low";

  const risks = [
    commercial.renewalDays <= 60 && {
      title: "Renewal window is close",
      severity: commercial.renewalDays <= 30 ? "critical" : "high",
      evidence: `${account.name} renews in ${commercial.renewalDays} days.`,
    },
    escalations.length > 0 && {
      title: "Open escalation exposure",
      severity: escalations.some((e) => e.priority === "P1") ? "critical" : "high",
      evidence: `${escalations.length} escalation(s), including ${escalations.map((e) => e.priority).join(", ")} priority.`,
    },
    health.relationship?.score < 7 && {
      title: "Relationship health needs attention",
      severity: "medium",
      evidence: `Relationship score is ${health.relationship.score}/10.`,
    },
    health.resource?.criticalResources > 0 && {
      title: "Resource concentration risk",
      severity: "medium",
      evidence: `${health.resource.criticalResources} critical resource(s) are flagged.`,
    },
  ].filter(Boolean);

  const recommendedOpportunities = [
    ...opportunities.map((o) => ({
      title: o.title,
      potential: shortMoney(o.potential),
      evidence: `${o.confidence} confidence. Next step: ${o.nextStep || "confirm scope"}.`,
    })),
    ...whiteSpace.slice(0, 3).map((s) => ({
      title: s.service,
      potential: "white-space expansion",
      evidence: s.trackingNote || "Applicable service not yet offered.",
    })),
  ].slice(0, 5);

  return normalizeAiResult({
    summary: `${account.name} should be managed as a ${riskLevel} priority. The answer to "${question}" is to protect renewal confidence first, close delivery risk, then package the strongest growth plays.`,
    confidence: 0.68,
    riskLevel,
    risks,
    opportunities: recommendedOpportunities,
    recommendations: [
      {
        title: "Run an executive account review",
        owner: "KAM",
        timeframe: "This week",
        evidence: `Health ${health.overall}/100, renewal in ${commercial.renewalDays} days, retention risk ${commercial.retentionRisk}.`,
      },
      {
        title: "Convert open risk into named actions",
        owner: "KAM + Delivery Lead",
        timeframe: "7 days",
        evidence: risks[0]?.evidence ?? "Keep account risk visible and time-bound.",
      },
      {
        title: "Prepare a focused expansion pitch",
        owner: "KAM",
        timeframe: "14 days",
        evidence: `${commercial.growthUpside} growth upside and ${commercial.whiteSpaceCount} white-space item(s).`,
      },
    ],
    roadmap: [
      {
        phase: "Week 1",
        actions: ["Confirm sponsor priorities", "Review open escalations", "Update action owners"],
      },
      {
        phase: "Weeks 2-3",
        actions: [
          "Close delivery blockers",
          "Draft renewal/growth narrative",
          "Validate white-space fit",
        ],
      },
      {
        phase: "Days 30-45",
        actions: [
          "Hold exec checkpoint",
          "Package commercial proposal",
          "Log next education topic",
        ],
      },
    ],
    followUpQuestions: [
      "Which stakeholder can sponsor the next expansion discussion?",
      "What is the strongest renewal objection we need to remove?",
      "Which service has the clearest ROI story for this client?",
    ],
  });
}

function extractOpenAiText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text.trim();

  return (
    payload?.output
      ?.flatMap((item) => item.content ?? [])
      ?.map((content) => content.text ?? "")
      ?.join("")
      ?.trim() ?? ""
  );
}

async function askOpenAi({ prompt, model }) {
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.CHATGPT_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions: SYSTEM_INSTRUCTIONS,
      input: prompt,
      max_output_tokens: 1400,
      text: {
        format: AI_RESPONSE_FORMAT,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${body}`);
  }

  const payload = await response.json();
  const text = extractOpenAiText(payload);
  if (!text) throw new Error("OpenAI returned an empty response");
  return JSON.parse(text);
}

export const askAccountAi = createServerFn({ method: "POST" })
  .inputValidator(validateAskAiInput)
  .handler(async ({ data }) => {
    const [account, escalations, opportunities, history] = await Promise.all([
      fetchAccount(data.accountId),
      fetchEscalations(data.accountId),
      fetchOpportunities(data.accountId),
      fetchAccountHistory(data.accountId),
    ]);

    if (!account) throw new Error("Account not found");

    if (
      data.user.role === "KAM" &&
      data.user.id &&
      account.assignedKamId &&
      account.assignedKamId !== data.user.id
    ) {
      throw new Error("You do not have access to this account.");
    }

    const context = buildAccountContext({ account, escalations, opportunities, history });
    const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
    const prompt = `User:
${JSON.stringify(data.user, null, 2)}

Request:
${JSON.stringify(
  {
    scope: data.scope,
    focus: data.focus,
    timeframe: data.timeframe,
    question: data.question,
  },
  null,
  2,
)}

Account context:
${JSON.stringify(context, null, 2)}
`;

    let result;
    let source = "local-fallback";

    try {
      const openAiResult = await askOpenAi({ prompt, model });
      if (openAiResult) {
        result = normalizeAiResult(openAiResult);
        source = "openai";
      }
    } catch (error) {
      console.error(error);
    }

    if (!result) result = fallbackRoadmap(context, data.question);

    return {
      ...result,
      source,
      model: source === "openai" ? model : "local-rules",
      generatedAt: new Date().toISOString(),
      contextSummary: {
        accountId: account.id,
        accountName: account.name,
        escalationsUsed: escalations.length,
        opportunitiesUsed: opportunities.length,
        historyItemsUsed: history.length,
      },
    };
  });
