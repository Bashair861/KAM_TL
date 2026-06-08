import { ACTIVITY_TAB_AREAS } from "@/services/activity-tab";

const AI_SCORE_AREA_PLANS = {
  Relationship: {
    title: (account) => `Run stakeholder coverage review for ${account.name}`,
    description:
      "Map active users, sponsor, procurement or finance contacts, and executive decision makers; assign next outreach for missing coverage.",
    nextStep: "Complete stakeholder map, confirm sponsor coverage, and schedule missing relationship touchpoints.",
    expectedLift: "25%",
    impactedMetric: "Stakeholder coverage and executive cadence",
    evidenceRequired: ["Updated stakeholder map", "Meeting or outreach notes"],
  },
  Project: {
    title: (account) => `Create project health recovery tracker for ${account.name}`,
    description:
      "Convert project risks, delivery gaps, and pending feedback into a weekly owner-based recovery tracker.",
    nextStep: "List project blockers, assign internal owners, and review recovery status with the client.",
    expectedLift: "30%",
    impactedMetric: "Delivery predictability and feedback closure",
    evidenceRequired: ["Recovery tracker", "Client review notes"],
  },
  Resource: {
    title: (account) => `Validate backup and KT coverage for ${account.name}`,
    description:
      "Check critical resources, backup owners, leave coverage, and knowledge-transfer documents before the next delivery review.",
    nextStep: "Confirm backup owners for critical roles and update KT coverage evidence.",
    expectedLift: "25%",
    impactedMetric: "Backup coverage and resource continuity",
    evidenceRequired: ["Backup coverage plan", "KT artifact"],
  },
  Financial: {
    title: (account) => `Review margin and commercial leakage for ${account.name}`,
    description:
      "Check open billing, discount leakage, resource allocation, and expansion-commercial fit with finance and delivery owners.",
    nextStep: "Prepare a commercial review note with margin risks, invoice status, and improvement actions.",
    expectedLift: "20%",
    impactedMetric: "Revenue quality and commercial hygiene",
    evidenceRequired: ["Commercial review note", "Finance confirmation"],
  },
  Risk: {
    title: (account) => `Create risk mitigation plan for ${account.name}`,
    description:
      "Collect competitor, escalation, churn, payment, and stakeholder-change risks into one owner-led mitigation plan.",
    nextStep: "Rank account risks, assign mitigation owners, and confirm the first review date.",
    expectedLift: "30%",
    impactedMetric: "Risk control and mitigation progress",
    evidenceRequired: ["Risk register", "Mitigation owner notes"],
  },
  CSAT: {
    title: (account) => `Run client sentiment pulse for ${account.name}`,
    description:
      "Collect direct client feedback, recent ticket sentiment, and unresolved complaints; convert findings into improvement actions.",
    nextStep: "Run a short sentiment pulse and document the top two improvement actions.",
    expectedLift: "25%",
    impactedMetric: "Client sentiment and feedback closure",
    evidenceRequired: ["Feedback note", "Closed-loop action record"],
  },
  Health: {
    title: (account) => `Create overall health improvement plan for ${account.name}`,
    description:
      "Pick the weakest account-health areas and convert them into a short owner-based plan for the next account review.",
    nextStep: "Select the two weakest health areas and define owner, due date, and evidence for each.",
    expectedLift: "20%",
    impactedMetric: "Overall account health",
    evidenceRequired: ["Health improvement plan", "Review notes"],
  },
  KYC: {
    title: (account) => `Refresh KYC and account context for ${account.name}`,
    description:
      "Update decision makers, business context, contract details, and account notes so managers can act on current information.",
    nextStep: "Refresh account profile, stakeholders, and contract context before the next review.",
    expectedLift: "15%",
    impactedMetric: "Account context completeness",
    evidenceRequired: ["Updated account profile", "Stakeholder confirmation"],
  },
};

const AI_SCORE_HEALTH_BLOCKS = [
  { area: "Relationship", blockKey: "relationshipHealth" },
  { area: "Project", blockKey: "projectHealth" },
  { area: "Resource", blockKey: "resourceHealth" },
  { area: "Financial", blockKey: "financialHealth" },
  { area: "Risk", blockKey: "riskScoring" },
  { area: "CSAT", blockKey: "csat" },
];

export function buildAiScoreSuggestions({
  account,
  accountTasks = [],
  opportunities = [],
  escalations = [],
  meetingSummaries = [],
  activityRows = [],
}) {
  const candidates = [
    ...buildAiSuggestionsFromWeakHealth(account),
    ...buildAiSuggestionsFromTasks(account, accountTasks),
    ...buildAiSuggestionsFromOpportunities(account, opportunities),
    ...buildAiSuggestionsFromEscalations(account, escalations),
    ...buildAiSuggestionsFromMeetings(account, meetingSummaries),
  ];

  return dedupeAiSuggestions(candidates).filter(
    (suggestion) => !isDuplicateAiActivity(suggestion, activityRows),
  ).slice(0, 6);
}

export function removeDuplicateAiSuggestions(suggestions, activityRows) {
  return dedupeAiSuggestions(suggestions).filter(
    (suggestion) => !isDuplicateAiActivity(suggestion, activityRows),
  );
}

export function normalizeAiSuggestionPayload(suggestion, accountId = "account") {
  const title = cleanSuggestionText(suggestion.title);
  const description = cleanSuggestionText(suggestion.description);
  const healthArea =
    cleanSuggestionText(suggestion.healthArea ?? suggestion.health_area) || "Health";
  const reason = cleanSuggestionText(suggestion.reason);
  const expectedLift = normalizeExpectedLiftPercent(
    suggestion.expectedLift ?? suggestion.expected_lift,
  );
  const sourceSummary =
    cleanSuggestionText(suggestion.sourceSummary ?? suggestion.source_reference) ||
    "OpenAI RAG analysis";

  if (!title || !description || !reason || !expectedLift) return null;

  return {
    id: `ai-${accountId}-${toStableAiId(healthArea)}-${toStableAiId(title)}`,
    sourceId: `ai-${accountId}-${toStableAiId(healthArea)}-${toStableAiId(title)}`,
    sourceKind: "ai_suggestion",
    healthArea,
    area: healthArea,
    parameter: healthArea,
    ruleId: getAiRuleId(healthArea),
    impactedMetric: healthArea,
    title,
    description,
    nextStep: description,
    rag: "A",
    reason,
    weakSignal: reason,
    currentValue: null,
    targetValue: "Validated improvement evidence",
    expectedLift,
    successCriteria:
      "Activity is completed, evidence is submitted, and the related score metric is reviewed.",
    evidenceRequired: ["Activity evidence", "Score impact review"],
    triggerLogic: {
      primary: "OpenAI-backed RAG suggestion generated from account data and score context.",
      source: sourceSummary,
    },
    evidenceLiftPolicy: [
      {
        quality: "Action tracker plus note",
        lift: "Mid-range lift",
        requirement: "Owner, due date, and action evidence are present.",
      },
      {
        quality: "Completed action plus outcome proof",
        lift: "Maximum eligible lift",
        requirement: "Completion evidence can be tied back to the impacted score metric.",
      },
    ],
    activityScoreLogic: [
      "Accepted by owner: +10%",
      "Owner and due date assigned: +10%",
      "Completed: +30%",
      "Evidence submitted: +30%",
      "Evidence validated: +20%",
    ],
    approvalSla: {
      reviewWindow: "48 hours after evidence submission",
      primaryApprover: "Head of KAM",
    },
    reviewCadence: {
      cadence: "Monthly",
      autoCloseRule: "Close after evidence is validated and score impact is reviewed.",
    },
    sourceSummary,
  };
}

export function isDuplicateAiActivity(suggestion, activityRows) {
  const candidateArea = normalizeAiText(suggestion.healthArea ?? suggestion.area);
  const candidateTitle = normalizeAiText(suggestion.title);
  const candidateDescription = normalizeAiText(
    suggestion.description ?? suggestion.nextStep ?? suggestion.reason,
  );

  return activityRows.some((row) => {
    const rowArea = normalizeAiText(row.area ?? row.healthArea ?? row.parameter);
    const rowTitle = normalizeAiText(row.title);
    const rowDescription = normalizeAiText(row.reason ?? row.nextStep ?? row.description);

    if (isSimilarAiText(candidateTitle, rowTitle)) return true;
    if (candidateArea && rowArea && candidateArea !== rowArea) return false;

    return (
      candidateDescription.length > 20 && isSimilarAiText(candidateDescription, rowDescription)
    );
  });
}

function cleanSuggestionText(value = "") {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeExpectedLiftPercent(value) {
  const match = String(value ?? "").match(/\d+(?:\.\d+)?/);
  if (!match) return "";
  const number = Math.max(1, Math.min(100, Math.round(Number(match[0]))));
  return `${number}%`;
}

function buildAiSuggestionsFromTasks(account, accountTasks) {
  const openTasks = accountTasks.filter((task) => !isClosedAccountTask(task));
  const grouped = groupItemsByHealthArea(openTasks, (task) =>
    normalizeAiHealthArea(task.area) ?? inferAiHealthArea(task.title, task.description),
  );

  return [...grouped.entries()].slice(0, 3).map(([area, tasks]) => {
    const rag = tasks.some((task) => getTaskRag(task) === "R") ? "R" : "A";
    return makeAiScoreSuggestion({
      account,
      area,
      title: `Create ${area.toLowerCase()} action governance plan for ${account.name}`,
      description:
        "Group open follow-ups into one manager-owned plan with due dates, evidence requirements, and weekly closure review.",
      nextStep:
        "Review open follow-ups, assign one accountable owner, and define the evidence needed before the next account review.",
      rag,
      reason:
        `${tasks.length} open follow-up ${tasks.length === 1 ? "item" : "items"} indicate execution work that can improve the ${area} score when governed through owner, due date, and evidence tracking.`,
      expectedLift: getAiExpectedLift(area),
      impactedMetric: `${area} execution discipline`,
      sourceSummary: `Task backlog: ${tasks.length} open ${area} follow-up ${tasks.length === 1 ? "item" : "items"}.`,
      weakSignal: `${area} backlog requires manager-owned closure discipline.`,
      evidenceRequired: ["Action owner list", "Due-date tracker", "Closure evidence"],
    });
  });
}

function buildAiSuggestionsFromWeakHealth(account) {
  return getWeakHealthAreas(account).map(({ area, score }) =>
    makeAiScoreSuggestion({
      account,
      area,
      rag: getAreaRag(score),
      reason:
        `${area} health is currently ${formatNullableScore(score)}/10, so a focused, evidence-backed improvement plan can help managers move the account toward a stronger score.`,
      currentValue: `${formatNullableScore(score)}/10`,
      targetValue: "Move toward 8.5+/10",
      sourceSummary: `Account health profile: ${area} score ${formatNullableScore(score)}/10.`,
    }),
  );
}

function buildAiSuggestionsFromOpportunities(account, opportunities) {
  const activeOpportunities = opportunities.filter((opportunity) =>
    !/\b(closed|lost|won|cancelled|canceled)\b/i.test(opportunity.status ?? ""),
  );
  if (!activeOpportunities.length) return [];

  const topPotential = activeOpportunities
    .map((opportunity) => Number(String(opportunity.potential ?? "").replace(/[^0-9.-]+/g, "")))
    .filter(Number.isFinite)
    .reduce((sum, value) => sum + value, 0);

  return [
    makeAiScoreSuggestion({
      account,
      area: "Financial",
      title: `Run expansion qualification review for ${account.name}`,
      description:
        "Validate buyer need, decision path, commercial value, and delivery readiness for active expansion signals before proposing next steps.",
      nextStep:
        "Create a qualification note covering buyer, business problem, value case, delivery fit, and next client action.",
      rag: topPotential > 100000 ? "R" : "A",
      reason:
        `${activeOpportunities.length} active opportunity ${activeOpportunities.length === 1 ? "signal" : "signals"} can improve growth and financial health if converted into a qualified, owner-led expansion plan.`,
      expectedLift: "25%",
      impactedMetric: "Expansion readiness and revenue quality",
      sourceSummary: `Opportunity context: ${activeOpportunities.length} active expansion ${activeOpportunities.length === 1 ? "signal" : "signals"}.`,
      weakSignal: "Expansion signals need qualification before they can improve score.",
      evidenceRequired: ["Qualification note", "Buyer confirmation", "Next-step plan"],
    }),
  ];
}

function buildAiSuggestionsFromEscalations(account, escalations) {
  const activeEscalations = escalations.filter((escalation) =>
    !/\b(closed|resolved|cancelled|canceled)\b/i.test(escalation.status ?? ""),
  );
  if (!activeEscalations.length) return [];

  return [
    makeAiScoreSuggestion({
      account,
      area: "Risk",
      title: `Hold risk-to-recovery review for ${account.name}`,
      description:
        "Convert active risks and escalations into a recovery plan with client-visible owners, target dates, and prevention actions.",
      nextStep:
        "List active risk themes, assign owners, confirm client communication, and document the prevention step for each theme.",
      rag: "R",
      reason:
        `${activeEscalations.length} active risk or escalation ${activeEscalations.length === 1 ? "signal" : "signals"} can pull down account health unless converted into a tracked mitigation plan.`,
      expectedLift: "30%",
      impactedMetric: "Risk control and client confidence",
      sourceSummary: `Risk context: ${activeEscalations.length} active escalation/risk ${activeEscalations.length === 1 ? "signal" : "signals"}.`,
      weakSignal: "Active risk context requires manager-owned recovery tracking.",
      evidenceRequired: ["Risk recovery tracker", "Client communication note", "Prevention action"],
    }),
  ];
}

function buildAiSuggestionsFromMeetings(account, meetingSummaries) {
  if (!meetingSummaries.length) return [];

  return [
    makeAiScoreSuggestion({
      account,
      area: "Relationship",
      title: `Turn recent client meeting themes into next-step plan for ${account.name}`,
      description:
        "Review recent client meeting themes and convert unresolved asks, sponsor expectations, and service signals into accountable next steps.",
      nextStep:
        "Summarize the top client themes, assign owners, and confirm which actions will be reviewed in the next client touchpoint.",
      rag: "A",
      reason:
        `${meetingSummaries.length} recent meeting ${meetingSummaries.length === 1 ? "summary is" : "summaries are"} available, so unresolved client asks can be converted into score-improving execution evidence.`,
      expectedLift: "20%",
      impactedMetric: "Client engagement and closed-loop follow-up",
      sourceSummary: `Meeting context: ${meetingSummaries.length} recent client meeting ${meetingSummaries.length === 1 ? "summary" : "summaries"}.`,
      weakSignal: "Meeting themes need owner-led closure and client confirmation.",
      evidenceRequired: ["Meeting theme summary", "Owner action list", "Client confirmation"],
    }),
  ];
}

function makeAiScoreSuggestion({
  account,
  area = "Health",
  title,
  description,
  nextStep,
  rag,
  reason,
  expectedLift,
  impactedMetric,
  currentValue = null,
  targetValue = null,
  sourceSummary = "Available account context and score data.",
  weakSignal,
  evidenceRequired,
}) {
  const normalizedArea = normalizeAiHealthArea(area) ?? "Health";
  const plan = AI_SCORE_AREA_PLANS[normalizedArea] ?? AI_SCORE_AREA_PLANS.Health;
  const score = getHealthAreaScore(account, normalizedArea);
  const resolvedRag = rag ?? getAreaRag(score);
  const resolvedTitle = title ?? plan.title(account);
  const resolvedDescription = description ?? plan.description;

  return {
    id: `ai-${account.id}-${toStableAiId(normalizedArea)}-${toStableAiId(resolvedTitle)}`,
    sourceId: `ai-${account.id}-${toStableAiId(normalizedArea)}-${toStableAiId(resolvedTitle)}`,
    sourceKind: "ai_suggestion",
    healthArea: normalizedArea,
    area: normalizedArea,
    parameter: normalizedArea,
    ruleId: getAiRuleId(normalizedArea),
    impactedMetric: impactedMetric ?? plan.impactedMetric,
    title: resolvedTitle,
    description: resolvedDescription,
    nextStep: nextStep ?? plan.nextStep,
    rag: resolvedRag,
    reason:
      reason ??
      `${normalizedArea} has an improvement signal in the score/account context, so this activity can help close the gap.`,
    weakSignal:
      weakSignal ??
      `${normalizedArea} improvement opportunity generated from account health, risks, tasks, and relationship context.`,
    currentValue: currentValue ?? (score === null ? null : `${formatNullableScore(score)}/10`),
    targetValue: targetValue ?? "Validated improvement evidence",
    expectedLift: expectedLift ?? getAiExpectedLift(normalizedArea),
    successCriteria:
      "Activity is completed, evidence is submitted, and the related score metric is reviewed.",
    evidenceRequired: evidenceRequired ?? plan.evidenceRequired,
    triggerLogic: {
      primary: "AI/RAG suggestion generated from account context, tasks, risks, opportunities, meetings, and health score context.",
      source: "AI Suggestions to Increase Score",
    },
    evidenceLiftPolicy: [
      {
        quality: "Action tracker plus note",
        lift: "Mid-range lift",
        requirement: "Owner, due date, and action evidence are present.",
      },
      {
        quality: "Completed action plus outcome proof",
        lift: "Maximum eligible lift",
        requirement: "Completion evidence can be tied back to the impacted score metric.",
      },
    ],
    activityScoreLogic: [
      "Accepted by owner: +10%",
      "Owner and due date assigned: +10%",
      "Completed: +30%",
      "Evidence submitted: +30%",
      "Evidence validated: +20%",
    ],
    approvalSla: {
      reviewWindow: "48 hours after evidence submission",
      primaryApprover: "Head of KAM",
    },
    reviewCadence: {
      cadence: "Monthly",
      autoCloseRule: "Close after evidence is validated and score impact is reviewed.",
    },
    sourceSummary,
  };
}

function dedupeAiSuggestions(suggestions) {
  const seen = new Set();
  return suggestions.filter((suggestion) => {
    const key = `${normalizeAiText(suggestion.healthArea)}::${normalizeAiText(suggestion.title)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getWeakHealthAreas(account) {
  return AI_SCORE_HEALTH_BLOCKS.map(({ area, blockKey }) => {
    const block = account[blockKey];
    return {
      area,
      score: Number.isFinite(Number(block?.score)) ? Number(block.score) : null,
    };
  })
    .filter((item) => item.score === null || item.score < 8.5)
    .sort((left, right) => (left.score ?? 99) - (right.score ?? 99));
}

function getHealthAreaScore(account, area) {
  const config = AI_SCORE_HEALTH_BLOCKS.find((item) => item.area === area);
  if (!config) return null;
  const score = Number(account[config.blockKey]?.score);
  return Number.isFinite(score) ? score : null;
}

function getAreaRag(score) {
  if (score === null || score < 6.5) return "R";
  if (score < 8.5) return "A";
  return "G";
}

function getAiExpectedLift(area) {
  const plan = AI_SCORE_AREA_PLANS[area] ?? AI_SCORE_AREA_PLANS.Health;
  return plan.expectedLift;
}

function getAiRuleId(area) {
  const map = {
    Relationship: "AI-REL-01",
    Project: "AI-PROJ-01",
    Resource: "AI-RES-01",
    Financial: "AI-FIN-01",
    Risk: "AI-RISK-01",
    CSAT: "AI-CSAT-01",
    Health: "AI-HEALTH-01",
    KYC: "AI-KYC-01",
  };
  return map[area] ?? "AI-HEALTH-01";
}

function inferAiHealthArea(title = "", description = "") {
  const text = `${title} ${description}`;
  if (/\b(stakeholder|sponsor|ceo|director|relationship|qbr|meeting|contact)\b/i.test(text)) {
    return "Relationship";
  }
  if (/\b(project|delivery|deliverable|milestone|defect|quality|scope|timeline)\b/i.test(text)) {
    return "Project";
  }
  if (/\b(resource|staff|backup|kt|knowledge transfer|handover|coverage|engineer)\b/i.test(text)) {
    return "Resource";
  }
  if (/\b(invoice|billing|payment|margin|commercial|contract|discount|revenue)\b/i.test(text)) {
    return "Financial";
  }
  if (/\b(risk|escalation|competitor|churn|blocker|sla|renewal)\b/i.test(text)) {
    return "Risk";
  }
  if (/\b(csat|nps|feedback|survey|sentiment|satisfaction|complaint)\b/i.test(text)) {
    return "CSAT";
  }
  if (/\b(kyc|profile|account data|context|stakeholder data)\b/i.test(text)) {
    return "KYC";
  }
  return "Relationship";
}

function normalizeAiHealthArea(area) {
  const normalized = normalizeAiText(area);
  return ACTIVITY_TAB_AREAS.find((candidate) => normalizeAiText(candidate) === normalized) ?? null;
}

function getTaskRag(task) {
  const status = normalizeAiText(task.status);
  if (status.includes("blocked") || status.includes("overdue")) return "R";
  if (task.dueDate) return "A";
  return "G";
}

function isClosedAccountTask(task) {
  return /\b(done|closed|complete|completed|cancelled|canceled)\b/i.test(task.status ?? "");
}

function groupItemsByHealthArea(items, resolver) {
  return items.reduce((map, item) => {
    const area = normalizeAiHealthArea(resolver(item)) ?? "Health";
    const current = map.get(area) ?? [];
    current.push(item);
    map.set(area, current);
    return map;
  }, new Map());
}

function formatNullableScore(score) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) return "n/a";
  return Number(score).toFixed(1);
}

function normalizeAiText(value = "") {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSimilarAiText(left, right) {
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function toStableAiId(value = "") {
  return normalizeAiText(value).replace(/\s+/g, "-") || "suggestion";
}
