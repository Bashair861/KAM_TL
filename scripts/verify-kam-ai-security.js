import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  buildSafeAgentPayload,
  canAccessAccountForAi,
} from "../src/services/kam-ai-suggestions.server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "..");
const sourcePath = resolve(rootDir, "src/services/kam-ai-suggestions.server.js");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const sensitiveBlock = {
  score: 4.2,
  metrics: [{ id: "metric-secret", label: "Very Secret Metric", value: 3 }],
  kpiData: [
    {
      id: "section-secret",
      name: "Secret Section",
      fields: [
        { id: "criterion-secret", label: "Sensitive criterion text", checked: false, weight: 35 },
      ],
    },
  ],
};

const context = {
  account: {
    id: "secret-account-id",
    name: "Acme Secret Corp",
    industry: "Healthcare",
    tier: "Enterprise",
    health: 55,
    trend: -4,
    contractValue: 400000,
    arr: 283000,
    growthUpside: 90000,
    renewalDays: 48,
    retentionRisk: "High",
    revenueAtRisk: 120000,
    growthPipelineValue: 350000,
    growthPotentialLevel: "High",
    cooperation: 5,
    serviceConsumption: 6,
    meetingsPerMonth: 1,
    teamSize: 14,
    whiteSpaceCount: 3,
    primaryContact: { name: "Priya Secret", role: "CTO", phone: "+1-555-0101" },
    websiteUrl: "https://secret.example.com/account",
    linkedinUrl: "https://linkedin.com/company/acme-secret",
    stakeholders: [
      {
        name: "Sarah Jenkins",
        role: "CTO",
        email: "sarah@example.com",
        phone: "+1-555-0102",
        influence: "Decision Maker",
        lastContact: "6w ago",
      },
      {
        name: "Omar Patel",
        role: "Procurement Lead",
        email: "omar@example.com",
        influence: "Blocker",
        lastContact: "2d ago",
      },
    ],
    relationshipHealth: sensitiveBlock,
    projectHealth: sensitiveBlock,
    resourceHealth: sensitiveBlock,
    financialHealth: sensitiveBlock,
    riskScoring: sensitiveBlock,
    csat: sensitiveBlock,
    whiteSpace: sensitiveBlock,
    activities: [
      {
        title: "Raw saved activity title",
        area: "Relationship",
        status: "Open",
        expectedLift: "20%",
      },
    ],
  },
  tasks: [
    {
      title: "Raw task title",
      description: "Raw task description with private details",
      area: "Relationship",
      status: "Open",
      priority: "High",
      dueDate: "2026-06-20",
    },
  ],
  opportunities: [
    {
      title: "Raw opportunity note",
      source: "Website summary",
      nextStep: "Private next step",
      url: "https://secret.example.com/opportunity",
      confidence: "High",
      potential: 125000,
    },
  ],
  escalations: [
    {
      title: "Raw escalation title",
      description: "Raw escalation description",
      recommendation: "Raw recommendation",
      priority: "P1",
      slaRemainingHours: 12,
    },
  ],
  scoreHistory: [
    {
      parameter: "Relationship",
      metric: "Executive Coverage",
      score: 4,
      snapshotMonth: "2026-06-01",
      notes: "Raw score note",
    },
  ],
  thresholdOverrides: [
    {
      parameter: "Risk",
      threshold: 7,
      targetScore: 9,
      reason: "Raw threshold reason",
    },
  ],
  savedRuleActivities: [
    {
      title: "Raw rule activity title",
      parameter: "Risk",
      status: "Generated",
      expectedLift: "30%",
    },
  ],
  meetingSummaries: [
    {
      title: "Raw meeting title",
      overview: "Raw meeting summary",
      shortSummary: "Raw short summary",
      actionItems: "Raw action items",
      derivedActionItems: [{ title: "Raw derived action" }],
      derivedOpportunities: [{ title: "Raw derived opportunity" }],
      meetingDate: new Date().toISOString(),
    },
  ],
  model: {
    scoreMetricActivities: [{ id: "score-1" }],
    activityRows: [{ title: "Raw model row", area: "Risk", status: "Suggested" }],
  },
};

const payload = buildSafeAgentPayload(context);
const payloadText = JSON.stringify(payload).toLowerCase();

const forbiddenValues = [
  "secret-account-id",
  "acme secret corp",
  "priya secret",
  "sarah jenkins",
  "omar patel",
  "+1-555-0101",
  "+1-555-0102",
  "sarah@example.com",
  "omar@example.com",
  "https://secret.example.com",
  "linkedin.com/company/acme-secret",
  "raw task title",
  "raw task description",
  "raw opportunity note",
  "private next step",
  "raw escalation title",
  "raw escalation description",
  "raw recommendation",
  "raw score note",
  "raw threshold reason",
  "raw rule activity title",
  "raw meeting title",
  "raw meeting summary",
  "raw short summary",
  "raw action items",
  "raw derived action",
  "raw derived opportunity",
  "secret section",
  "sensitive criterion text",
  "very secret metric",
];

for (const value of forbiddenValues) {
  assert(!payloadText.includes(value), `Safe payload leaked forbidden value: ${value}`);
}

assert(payload.accountSignals.industry === "Healthcare", "Safe payload lost industry signal.");
assert(payload.accountSignals.arrBand === "250k_to_500k", "Safe payload lost ARR band.");
assert(payload.accountSignals.stakeholderSignals.total === 2, "Safe payload lost stakeholder count.");
assert(
  payload.scoreMarkingMetrics && typeof payload.scoreMarkingMetrics === "object",
  "Safe payload must use scoreMarkingMetrics.",
);
assert(
  payload.scoreMarkingMetrics.relationship.uncheckedCriteriaCount === 1,
  "Safe payload lost score marking metrics context.",
);
assert(
  !Object.hasOwn(payload, "scoreMarkingMatrics"),
  "Safe payload should not use misspelled scoreMarkingMatrics.",
);
assert(payload.taskSignals.total === 1, "Safe payload lost task count.");
assert(payload.opportunitySignals.total === 1, "Safe payload lost opportunity count.");
assert(payload.escalationSignals.total === 1, "Safe payload lost escalation count.");
assert(payload.meetingSignals.total === 1, "Safe payload lost meeting count.");
assert(payload.scoreGaps.some((gap) => gap.uncheckedCriteriaCount === 1), "Safe payload lost score gap count.");

assert(
  canAccessAccountForAi({ role: "KAM", profileId: "kam-1", assignedKamId: "kam-1" }),
  "Assigned KAM should be allowed.",
);
assert(
  !canAccessAccountForAi({ role: "KAM", profileId: "kam-1", assignedKamId: "kam-2" }),
  "Non-assigned KAM should be denied.",
);
assert(
  canAccessAccountForAi({ role: "CEO", profileId: "ceo-1", assignedKamId: "kam-2" }),
  "CEO should be allowed.",
);
assert(
  canAccessAccountForAi({ role: "Head of KAM", profileId: "head-1", assignedKamId: "kam-2" }),
  "Head of KAM should be allowed.",
);
assert(
  canAccessAccountForAi({ role: "C Level", profileId: "ceo-2", assignedKamId: "kam-2" }),
  "C Level alias should be treated as CEO.",
);
assert(
  canAccessAccountForAi({ role: " head   of   kam ", profileId: "head-2", assignedKamId: "kam-2" }),
  "Role normalization should handle casing and extra spaces.",
);
assert(
  !canAccessAccountForAi({ role: "Analyst", profileId: "analyst-1", assignedKamId: "analyst-1" }),
  "Unknown roles should be denied.",
);

const source = readFileSync(sourcePath, "utf8");
assert(source.includes("store: false"), "OpenAI request must include store:false.");

const authIndex = source.indexOf(
  "authenticateAndAuthorizeAiRequest(accountId, authContext.authorizationHeader)",
);
const gatherIndex = source.indexOf("gatherKamSuggestionContext(accountId, auth.client)");
assert(authIndex >= 0, "Authorization call is missing.");
assert(gatherIndex >= 0, "Context gather call is missing.");
assert(authIndex < gatherIndex, "Context is gathered before authorization.");

console.log("KAM AI security checks passed.");
