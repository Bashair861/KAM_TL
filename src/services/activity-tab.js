export const ACTIVITY_TAB_AREAS = [
  "KYC",
  "Relationship",
  "Project",
  "Resource",
  "Financial",
  "Risk",
  "Escalation",
  "Growth",
  "Retention",
  "CSAT",
];

const AREA_ORDER = new Map(ACTIVITY_TAB_AREAS.map((area, index) => [area, index]));
const HIGH_VALUE_THRESHOLD = 100_000;
const ACTIVITY_RECOMMENDATION_PARAMETERS = {
  scoreGap: "Score Gap / Weakest KPI",
  stakeholderCoverage: "Stakeholder Coverage",
  deliveryRisk: "Delivery / Escalation Risk",
  valueGrowth: "Value / Growth Support",
  retentionRisk: "Retention Risk",
  accountIntelligence: "Account Intelligence",
  meetingSignal: "Meeting Signal",
};

function toId(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function buildEvidence({ source, sourceType, date, excerpt, reason }) {
  return { source, sourceType, date, excerpt, reason };
}

function buildActionItems(items) {
  return (items ?? []).filter(Boolean);
}

function getScoreSignals(account) {
  return [
    {
      key: "relationship",
      area: "Relationship",
      label: "Relationship",
      block: account.relationshipHealth,
      metricPrefix: "Score Marking Matrics",
    },
    {
      key: "project",
      area: "Project",
      label: "Project",
      block: account.projectHealth,
      metricPrefix: "Score Marking Matrics",
    },
    {
      key: "resource",
      area: "Resource",
      label: "Resource",
      block: account.resourceHealth,
      metricPrefix: "Score Marking Matrics",
    },
    {
      key: "financial",
      area: "Financial",
      label: "Financial",
      block: account.financialHealth,
      metricPrefix: "Score Marking Matrics",
    },
    {
      key: "risk",
      area: "Risk",
      label: "Risk",
      block: account.riskScoring,
      metricPrefix: "Score Marking Matrics",
    },
    {
      key: "csat",
      area: "CSAT",
      label: "CSAT",
      block: account.csat,
      metricPrefix: "Score Marking Matrics",
    },
  ];
}

function getLowestMetric(block) {
  const metrics = block?.metrics ?? [];
  if (!metrics.length) return null;
  return metrics.reduce(
    (lowest, metric) => (metric.value < lowest.value ? metric : lowest),
    metrics[0],
  );
}

function getPotentialSlice(account, divisor = 3) {
  const base = account.growthUpside || account.arr * 0.05 || 60_000;
  return Math.max(25_000, Math.round(base / divisor));
}

function isMeetingSource(source = "") {
  return /transcript|call|meeting|qbr/i.test(source);
}

function isEscalationSource(source = "") {
  return /escalation/i.test(source);
}

function derivePriority(opportunity, account) {
  if (
    (opportunity.potentialValue ?? 0) >= HIGH_VALUE_THRESHOLD * 2 ||
    (opportunity.healthArea === "Retention" && account.retentionRisk !== "Low")
  ) {
    return "High";
  }
  if (
    opportunity.confidence === "High" ||
    (opportunity.potentialValue ?? 0) >= HIGH_VALUE_THRESHOLD
  ) {
    return "Medium";
  }
  return "Low";
}

function summarizeMetrics(block) {
  const lowest = getLowestMetric(block);
  if (!lowest) return "Recent score signal available.";
  return `${lowest.label} is at ${lowest.value}/10${lowest.hint ? ` (${lowest.hint})` : ""}.`;
}

function getScore(account, key, fallback = 10) {
  return account?.[key]?.score ?? fallback;
}

function formatScore(score) {
  return Number.isFinite(score) ? score.toFixed(1).replace(/\.0$/, "") : "n/a";
}

function formatGrowthUpside(account, divisor = 4) {
  return `$${Math.round(getPotentialSlice(account, divisor) / 1000)}k`;
}

function isStaleStakeholderContact(lastContact = "") {
  const value = lastContact.toLowerCase();
  if (/month|quarter|q[1-4]|last/i.test(lastContact)) return true;

  const weeks = value.match(/(\d+)\s*w/);
  if (weeks && Number(weeks[1]) >= 2) return true;

  const days = value.match(/(\d+)\s*d/);
  return Boolean(days && Number(days[1]) >= 21);
}

function getStakeholderSignal(account) {
  const stakeholders = account.stakeholders ?? [];
  const staleStakeholders = stakeholders.filter((stakeholder) =>
    isStaleStakeholderContact(stakeholder.lastContact),
  );
  const blockers = stakeholders.filter((stakeholder) =>
    /blocker|risk|detractor/i.test(stakeholder.influence ?? ""),
  );
  const champions = stakeholders.filter((stakeholder) =>
    /champion|sponsor|executive/i.test(stakeholder.influence ?? ""),
  );

  return {
    stakeholders,
    staleStakeholders,
    blockers,
    champions,
    hasCoverageGap: !champions.length || Boolean(blockers.length) || Boolean(staleStakeholders.length),
  };
}

function getOpenEscalation(escalations) {
  return (escalations ?? [])[0] ?? null;
}

function buildOpportunityEvidence(opportunity, account) {
  const evidence = [
    buildEvidence({
      source: opportunity.source,
      sourceType: isMeetingSource(opportunity.source)
        ? "Fireflies meeting notes"
        : isEscalationSource(opportunity.source)
          ? "Escalation"
          : "Overview",
      date: opportunity.signalDate ?? "Recent",
      excerpt: isMeetingSource(opportunity.source)
        ? `Client conversation surfaced a signal around "${opportunity.title}".`
        : isEscalationSource(opportunity.source)
          ? `Open client risk context can be converted into a structured recovery play.`
          : `Client context and account signal point toward "${opportunity.title}".`,
      reason: opportunity.nextStep,
    }),
  ];

  if (opportunity.healthArea === "Growth") {
    evidence.push(
      buildEvidence({
        source: "Retention VS Growth",
        sourceType: "Retention VS Growth",
        date: "Current account state",
        excerpt: `${account.whiteSpaceCount} white-space signals and ${account.growthUpside > 0 ? `up to $${Math.round(account.growthUpside / 1000)}k growth upside` : "active growth upside"} are already tracked on this account.`,
        reason: "This opportunity expands current footprint with the client.",
      }),
    );
  }

  if (opportunity.healthArea === "Retention") {
    evidence.push(
      buildEvidence({
        source: "Overview",
        sourceType: "Overview",
        date: "Today",
        excerpt: `Renewal in ${account.renewalDays} days with retention risk at ${account.retentionRisk}.`,
        reason: "Protecting renewal momentum should be prioritized before commercial expansion.",
      }),
    );
  }

  return evidence;
}

function buildBackendOpportunities(account, opportunities) {
  return (opportunities ?? []).map((opportunity) => {
    const healthArea = isEscalationSource(opportunity.source) ? "Retention" : "Growth";
    const nextStep = opportunity.nextStep ?? "Validate fit with sponsor";
    const item = {
      id: `opp-${opportunity.id}`,
      title: opportunity.title,
      source: isMeetingSource(opportunity.source) ? "Fireflies meeting notes" : opportunity.source,
      priority: "Medium",
      potentialValue: opportunity.potential ?? 0,
      confidence: opportunity.confidence ?? "Medium",
      parameter: ACTIVITY_RECOMMENDATION_PARAMETERS.valueGrowth,
      nextStep,
      actionItems: buildActionItems([
        nextStep,
        "Identify buyer, sponsor, and approval path",
        "Create follow-up date and internal owner",
      ]),
      healthArea,
      approvalRequired: (opportunity.potential ?? 0) >= HIGH_VALUE_THRESHOLD,
      approverRole: (opportunity.potential ?? 0) >= HIGH_VALUE_THRESHOLD ? "Head of KAM" : null,
      signalDate: opportunity.signalDate ?? "Recent",
    };

    item.priority = derivePriority(item, account);
    item.evidence = buildOpportunityEvidence(item, account);
    return item;
  });
}

function buildWhitespaceOpportunity(account) {
  const whiteSpace = (account.retentionGrowth ?? []).find(
    (service) => !service.offered && service.applicable,
  );
  if (!whiteSpace) return null;

  const item = {
    id: `opp-whitespace-${toId(whiteSpace.service)}`,
    title: `${whiteSpace.service} expansion path for ${account.name}`,
    source: "Retention VS Growth",
    priority: account.whiteSpaceCount >= 3 ? "High" : "Medium",
    potentialValue: getPotentialSlice(account, Math.max(account.whiteSpaceCount || 1, 2)),
    confidence: account.whiteSpaceCount >= 3 ? "High" : "Medium",
    parameter: ACTIVITY_RECOMMENDATION_PARAMETERS.valueGrowth,
    nextStep: `Validate ${whiteSpace.service} fit in the next client review`,
    actionItems: buildActionItems([
      `Confirm business need for ${whiteSpace.service}`,
      "Identify buyer, sponsor, and expected value",
      "Create a scoped proposal or discovery follow-up",
    ]),
    healthArea: "Growth",
    approvalRequired: false,
    approverRole: null,
    signalDate: "Current account state",
    evidence: [
      buildEvidence({
        source: "Retention VS Growth",
        sourceType: "Retention VS Growth",
        date: "Current account state",
        excerpt:
          whiteSpace.trackingNote ||
          `${whiteSpace.service} is applicable but has not been offered yet.`,
        reason: "Applicable whitespace should be translated into the next best offer.",
      }),
      buildEvidence({
        source: "Overview",
        sourceType: "Overview",
        date: "Today",
        excerpt: `${account.whiteSpaceCount} whitespace items and ${account.growthUpside > 0 ? `$${Math.round(account.growthUpside / 1000)}k estimated growth upside` : "active growth potential"} exist on this account.`,
        reason: "Growth opportunity is already supported by account context.",
      }),
    ],
  };

  return item;
}

function buildRetentionOpportunity(account, escalations) {
  const hasEscalation = (escalations ?? []).length > 0;
  if (!hasEscalation && account.retentionRisk === "Low" && account.renewalDays > 120) return null;

  return {
    id: `opp-retention-${account.id}`,
    title: `Renewal recovery plan before the ${account.renewalDays}-day window tightens`,
    source: hasEscalation ? "Escalation + Retention" : "Overview",
    priority: account.retentionRisk === "High" || account.renewalDays <= 90 ? "High" : "Medium",
    potentialValue: Math.max(Math.round(account.arr * 0.08), 50_000),
    confidence: hasEscalation ? "High" : "Medium",
    parameter: ACTIVITY_RECOMMENDATION_PARAMETERS.retentionRisk,
    nextStep: "Prepare sponsor recovery plan and renewal talking points",
    actionItems: buildActionItems([
      "List renewal blockers and risk owners",
      "Prepare sponsor recovery plan and renewal talking points",
      "Set recovery milestones before the renewal window tightens",
    ]),
    healthArea: "Retention",
    approvalRequired: true,
    approverRole: "Head of KAM",
    signalDate: "Today",
    evidence: [
      buildEvidence({
        source: "Overview",
        sourceType: "Overview",
        date: "Today",
        excerpt: `Renewal in ${account.renewalDays} days, retention risk ${account.retentionRisk}, health ${account.health}.`,
        reason: "Renewal and health context create a clear retention-planning trigger.",
      }),
      ...(hasEscalation
        ? [
            buildEvidence({
              source: "Escalation",
              sourceType: "Escalation",
              date: "Open",
              excerpt: `${escalations[0].title} remains active with priority ${escalations[0].priority}.`,
              reason: "Open escalations should be converted into retention-safe action plans.",
            }),
          ]
        : []),
    ],
  };
}

function buildMissingKycSuggestion(account) {
  const fields = [
    ["Business info", account.businessInfo],
    ["Client history", account.clientHistory],
    ["Competitors", account.competitors?.length ? account.competitors.join(", ") : ""],
    ["Main business flow", account.mainBusinessFlow],
    ["Primary contact", account.primaryContact?.name],
    ["Team size", account.teamSize],
  ];
  const missing = fields.filter(
    ([, value]) => value === null || value === undefined || value === "",
  );
  if (!missing.length) return null;

  return {
    id: `rag-kyc-${account.id}`,
    title: "Complete missing account intelligence fields",
    urgency: "A",
    healthArea: "KYC",
    parameter: ACTIVITY_RECOMMENDATION_PARAMETERS.accountIntelligence,
    reason: `${missing.length} KYC fields are incomplete, which weakens scoring context and action planning.`,
    expectedLift: "+KYC health",
    confidence: "High",
    nextStep: "Fill the missing account fields in Overview",
    actionItems: buildActionItems([
      "Complete missing KYC/account fields",
      "Validate decision makers, competitors, and business flow",
      "Refresh score recommendations after account context is updated",
    ]),
    evidence: [
      buildEvidence({
        source: "Overview",
        sourceType: "KYC/Account health",
        date: "Today",
        excerpt: `Missing fields: ${missing.map(([label]) => label).join(", ")}.`,
        reason: "KYC completeness improves account-quality signals and action quality.",
      }),
    ],
  };
}

function buildScoreRecommendation(account, escalations, config) {
  const block = config.block;
  if (!block) return null;

  const score = block.score ?? 0;
  if (score >= config.threshold) return null;

  const lowestMetric = getLowestMetric(block);
  const hasEscalation = (escalations ?? []).length > 0;
  const urgency =
    config.forceUrgency ??
    (score <= config.redThreshold || (config.area === "Retention" && account.renewalDays <= 90)
      ? "R"
      : "A");

  return {
    id: `rag-${config.key}-${account.id}`,
    title: config.title(account),
    urgency,
    healthArea: config.area,
    parameter: config.parameter ?? ACTIVITY_RECOMMENDATION_PARAMETERS.scoreGap,
    reason: config.reason(account, lowestMetric),
    expectedLift: config.expectedLift(account),
    confidence: hasEscalation && config.area === "Retention" ? "High" : config.confidence(score),
    nextStep: config.nextStep(account),
    actionItems: buildActionItems(
      config.actionItems?.(account, lowestMetric) ?? [config.nextStep(account)],
    ),
    evidence: [
      buildEvidence({
        source: config.metricPrefix,
        sourceType: config.metricPrefix,
        date: "Current score snapshot",
        excerpt: `${config.label} score is ${score}/10. ${summarizeMetrics(block)}`,
        reason: config.evidenceReason,
      }),
      ...(config.area === "Retention" && hasEscalation
        ? [
            buildEvidence({
              source: "Escalation",
              sourceType: "Escalation",
              date: "Open",
              excerpt: `${escalations[0].title} is still open and can affect renewal confidence.`,
              reason: "Open escalations make this activity more urgent.",
            }),
          ]
        : []),
    ],
  };
}

function buildStakeholderCoverageRecommendation(account) {
  const relationshipScore = getScore(account, "relationshipHealth");
  const stakeholderSignal = getStakeholderSignal(account);
  if (relationshipScore >= 8.7 && !stakeholderSignal.hasCoverageGap) return null;

  const staleNames = stakeholderSignal.staleStakeholders
    .slice(0, 2)
    .map((stakeholder) => stakeholder.name)
    .join(", ");
  const blockerNames = stakeholderSignal.blockers
    .slice(0, 2)
    .map((stakeholder) => stakeholder.name)
    .join(", ");
  const relationshipMetric = getLowestMetric(account.relationshipHealth);

  return {
    id: `rag-stakeholder-coverage-${account.id}`,
    title: `Refresh stakeholder map and sponsor coverage for ${account.name}`,
    urgency: relationshipScore <= 7 || stakeholderSignal.blockers.length ? "R" : "A",
    healthArea: "Relationship",
    parameter: ACTIVITY_RECOMMENDATION_PARAMETERS.stakeholderCoverage,
    reason:
      `Relationship score is ${formatScore(relationshipScore)}/10` +
      `${relationshipMetric ? ` and ${relationshipMetric.label.toLowerCase()} is the weakest relationship metric` : ""}.` +
      `${blockerNames ? ` Blocker coverage exists around ${blockerNames}.` : ""}` +
      `${staleNames ? ` Recent contact is stale for ${staleNames}.` : ""}`,
    expectedLift: "+1.0 Relationship",
    confidence: relationshipScore <= 7 || stakeholderSignal.blockers.length ? "High" : "Medium",
    nextStep: "Confirm champion, blocker, decision maker, and next sponsor touchpoint",
    actionItems: buildActionItems([
      "Update the stakeholder map with champion, blocker, buyer, and decision maker",
      "Schedule the next sponsor touchpoint",
      blockerNames ? `Create blocker-handling plan for ${blockerNames}` : null,
      staleNames ? `Refresh contact with ${staleNames}` : null,
    ]),
    evidence: [
      buildEvidence({
        source: "Score Marking Matrics",
        sourceType: "Score Marking Matrics",
        date: "Current score snapshot",
        excerpt: `Relationship score is ${formatScore(relationshipScore)}/10. ${summarizeMetrics(account.relationshipHealth)}`,
        reason: "Relationship score gaps should be backed by named stakeholder actions.",
      }),
      buildEvidence({
        source: "Overview",
        sourceType: "Stakeholder map",
        date: "Current account state",
        excerpt: `${stakeholderSignal.stakeholders.length} stakeholders tracked; ${stakeholderSignal.champions.length} champion signals; ${stakeholderSignal.blockers.length} blocker signals.`,
        reason: "Coverage quality determines whether score-improvement actions reach the right sponsor.",
      }),
    ],
  };
}

function buildDeliveryRiskRecommendation(account, escalations) {
  const openEscalation = getOpenEscalation(escalations);
  const projectScore = getScore(account, "projectHealth");
  const riskScore = getScore(account, "riskScoring");
  const csatScore = getScore(account, "csat");
  const shouldRecommend =
    Boolean(openEscalation) || projectScore < 8 || riskScore < 7.8 || csatScore < 8.3;

  if (!shouldRecommend) return null;

  const urgency = openEscalation || riskScore <= 6.8 || csatScore <= 7.5 ? "R" : "A";
  const weakestProjectMetric = getLowestMetric(account.projectHealth);
  const area = openEscalation ? "Escalation" : riskScore < projectScore ? "Risk" : "Project";

  return {
    id: `rag-delivery-risk-${account.id}`,
    title: openEscalation
      ? "Convert open escalation into a score recovery plan"
      : "Run a delivery-risk review before score drops further",
    urgency,
    healthArea: area,
    parameter: ACTIVITY_RECOMMENDATION_PARAMETERS.deliveryRisk,
    reason:
      `Project ${formatScore(projectScore)}/10, risk ${formatScore(riskScore)}/10, and CSAT ${formatScore(csatScore)}/10 create a delivery-risk signal.` +
      `${weakestProjectMetric ? ` Weakest delivery metric: ${weakestProjectMetric.label}.` : ""}`,
    expectedLift: openEscalation ? "+1.0 CSAT" : "+1.2 Project",
    confidence: urgency === "R" ? "High" : "Medium",
    nextStep: openEscalation
      ? "Assign recovery owners, due dates, and client-facing status message"
      : "Review blockers, quality issues, and delivery dependencies with client leads",
    actionItems: buildActionItems([
      openEscalation
        ? "Confirm escalation recovery owner and client-facing update"
        : "Review delivery blockers with internal and client leads",
      "Document due dates for each risk item",
      "Send summary with commitments and next checkpoint",
    ]),
    evidence: [
      buildEvidence({
        source: "Score Marking Matrics",
        sourceType: "Score Marking Matrics",
        date: "Current score snapshot",
        excerpt: `Project ${formatScore(projectScore)}/10, risk ${formatScore(riskScore)}/10, CSAT ${formatScore(csatScore)}/10.`,
        reason: "Delivery, risk, and satisfaction scores should be evaluated together.",
      }),
      ...(openEscalation
        ? [
            buildEvidence({
              source: "Escalation",
              sourceType: "Escalation",
              date: "Open",
              excerpt: `${openEscalation.title} is active with priority ${openEscalation.priority}.`,
              reason: "Open escalations should become explicit recovery activities.",
            }),
          ]
        : []),
    ],
  };
}

function buildValueGrowthRecommendation(account) {
  const financialScore = getScore(account, "financialHealth");
  const growthUpside = account.growthUpside ?? 0;
  const whiteSpaceCount = account.whiteSpaceCount ?? 0;
  const whiteSpace = (account.retentionGrowth ?? []).find(
    (service) => !service.offered && service.applicable,
  );
  const shouldRecommend = financialScore < 8.8 || whiteSpaceCount > 0 || growthUpside > 0;

  if (!shouldRecommend) return null;

  return {
    id: `rag-value-growth-${account.id}`,
    title: whiteSpace
      ? `Turn ${whiteSpace.service} whitespace into a value-backed next step`
      : "Refresh value realization narrative for score improvement",
    urgency: financialScore <= 7 || whiteSpaceCount >= 3 ? "A" : "G",
    healthArea: whiteSpace ? "Growth" : "Financial",
    parameter: ACTIVITY_RECOMMENDATION_PARAMETERS.valueGrowth,
    reason:
      `Financial score is ${formatScore(financialScore)}/10 with ${whiteSpaceCount} whitespace signals` +
      `${growthUpside > 0 ? ` and about $${Math.round(growthUpside / 1000)}k growth upside` : ""}.`,
    expectedLift: whiteSpace ? `+${formatGrowthUpside(account)} Growth` : "+0.8 Financial",
    confidence: whiteSpaceCount >= 3 || financialScore <= 7.5 ? "High" : "Medium",
    nextStep: whiteSpace
      ? `Validate ${whiteSpace.service} need, value case, and buyer in the next client review`
      : "Package outcomes, ROI signals, and renewal value into one client-ready note",
    actionItems: buildActionItems([
      whiteSpace
        ? `Validate ${whiteSpace.service} need and buyer`
        : "Summarize measurable value delivered so far",
      "Confirm growth or renewal value story with sponsor",
      "Add next commercial step with owner and date",
    ]),
    evidence: [
      buildEvidence({
        source: "Score Marking Matrics",
        sourceType: "Score Marking Matrics",
        date: "Current score snapshot",
        excerpt: `Financial score is ${formatScore(financialScore)}/10. ${summarizeMetrics(account.financialHealth)}`,
        reason: "Financial health should be improved through a clear value narrative.",
      }),
      buildEvidence({
        source: "Retention VS Growth",
        sourceType: "Retention VS Growth",
        date: "Current account state",
        excerpt: whiteSpace
          ? `${whiteSpace.service} is applicable but not yet offered. ${whiteSpace.trackingNote ?? ""}`.trim()
          : `${whiteSpaceCount} whitespace signals and $${Math.round(growthUpside / 1000)}k estimated growth upside are tracked.`,
        reason: "Growth signals give the KAM a practical path to improve account value.",
      }),
    ],
  };
}

function buildRagRecommendations(account, escalations) {
  const configs = [
    {
      key: "relationship",
      area: "Relationship",
      label: "Relationship",
      block: account.relationshipHealth,
      metricPrefix: "Score Marking Matrics",
      threshold: 8.5,
      redThreshold: 7.2,
      title: () => `Rebuild executive sponsor cadence with ${account.primaryContact.name}`,
      reason: (currentAccount, lowestMetric) =>
        `Relationship score is ${currentAccount.relationshipHealth.score}/10${lowestMetric ? ` and ${lowestMetric.label.toLowerCase()} is the weakest live signal` : ""}.`,
      expectedLift: () => "+1.2 Relationship",
      nextStep: () => "Lock a sponsor touchpoint before the next business review",
      actionItems: (currentAccount, lowestMetric) => [
        "Confirm executive sponsor and decision-maker access",
        "Schedule sponsor touchpoint before the next business review",
        lowestMetric ? `Improve weak signal: ${lowestMetric.label}` : "Refresh relationship notes",
      ],
      confidence: (score) => (score <= 7.4 ? "High" : "Medium"),
      evidenceReason:
        "Low relationship signals should be converted into deliberate sponsor coverage.",
    },
    {
      key: "project",
      area: "Project",
      label: "Project",
      block: account.projectHealth,
      metricPrefix: "Score Marking Matrics",
      threshold: 8.3,
      redThreshold: 7.0,
      title: () => `Run an architecture and delivery review with ${account.primaryContact.role}`,
      reason: (currentAccount, lowestMetric) =>
        `Project score is ${currentAccount.projectHealth.score}/10${lowestMetric ? ` and ${lowestMetric.label.toLowerCase()} needs attention` : ""}.`,
      expectedLift: () => "+1.5 Project",
      nextStep: () => "Book a working session with delivery and client technical leads",
      actionItems: (currentAccount, lowestMetric) => [
        "Book delivery review with client technical lead",
        "Identify blockers, defects, and scope-change risks",
        lowestMetric ? `Create action owner for ${lowestMetric.label}` : "Confirm next delivery milestone",
      ],
      confidence: (score) => (score <= 7.5 ? "High" : "Medium"),
      evidenceReason:
        "Delivery health gaps should be addressed before they become client-visible risk.",
    },
    {
      key: "resource",
      area: "Resource",
      label: "Resource",
      block: account.resourceHealth,
      metricPrefix: "Score Marking Matrics",
      threshold: 8.2,
      redThreshold: 7.5,
      title: () => "Strengthen backup coverage for critical account roles",
      reason: (currentAccount) =>
        `Resource score is ${currentAccount.resourceHealth.score}/10 with ${currentAccount.resourceHealth.criticalResources} critical roles and ${currentAccount.resourceHealth.leavesThisMonth} leave events this month.`,
      expectedLift: () => "+1.3 Resource",
      nextStep: () => "Confirm backup owners and knowledge-transfer plan this week",
      actionItems: (currentAccount) => [
        "Confirm backup owner for every critical role",
        "Create knowledge-transfer plan for leave coverage",
        `Review ${currentAccount.resourceHealth.criticalResources} critical roles this week`,
      ],
      confidence: (score) => (score <= 7.5 ? "High" : "Medium"),
      evidenceReason: "Resource resilience directly impacts delivery continuity and confidence.",
    },
    {
      key: "financial",
      area: "Financial",
      label: "Financial",
      block: account.financialHealth,
      metricPrefix: "Score Marking Matrics",
      threshold: 8.8,
      redThreshold: 7.0,
      title: () => "Refresh the value realization story for the current engagement",
      reason: (currentAccount, lowestMetric) =>
        `Financial score is ${currentAccount.financialHealth.score}/10${lowestMetric ? ` and ${lowestMetric.label.toLowerCase()} is lagging the rest of the account` : ""}.`,
      expectedLift: () => "+0.8 Financial",
      nextStep: () => "Package measurable value outcomes for the next client review",
      actionItems: (currentAccount, lowestMetric) => [
        "Prepare measurable value outcomes for client review",
        "Check margin, billing, and discount leakage",
        lowestMetric ? `Address financial weak signal: ${lowestMetric.label}` : "Confirm renewal value story",
      ],
      confidence: (score) => (score <= 7.5 ? "High" : "Medium"),
      evidenceReason: "A stronger value story supports both retention and expansion.",
    },
    {
      key: "risk",
      area: "Risk",
      label: "Risk",
      block: account.riskScoring,
      metricPrefix: "Score Marking Matrics",
      threshold: 7.8,
      redThreshold: 6.8,
      title: () => "Run a risk review on delivery, competitor, and stakeholder blockers",
      reason: (currentAccount, lowestMetric) =>
        `Risk score is ${currentAccount.riskScoring.score}/10${lowestMetric ? ` and ${lowestMetric.label.toLowerCase()} is the biggest warning signal` : ""}.`,
      expectedLift: () => "+1.0 Risk",
      nextStep: () => "Review blockers and assign owners before the next status update",
      actionItems: (currentAccount, lowestMetric) => [
        "List top account risks and assign owners",
        "Confirm competitor, renewal, and delivery risk status",
        lowestMetric ? `Create mitigation for ${lowestMetric.label}` : "Set next risk review date",
      ],
      confidence: (score) => (score <= 7.0 ? "High" : "Medium"),
      evidenceReason: "Risk signals should be addressed while they are still manageable.",
    },
    {
      key: "csat",
      area: "CSAT",
      label: "CSAT",
      block: account.csat,
      metricPrefix: "Score Marking Matrics",
      threshold: 8.9,
      redThreshold: 7.5,
      title: () => "Close the feedback loop on sponsor and delivery concerns",
      reason: (currentAccount, lowestMetric) =>
        `CSAT score is ${currentAccount.csat.score}/10${lowestMetric ? ` and ${lowestMetric.label.toLowerCase()} needs a follow-up response` : ""}.`,
      expectedLift: () => "+1.1 CSAT",
      nextStep: () => "Share an improvement update and confirm sentiment in the next touchpoint",
      actionItems: (currentAccount, lowestMetric) => [
        "Close feedback loop with sponsor or main contact",
        "Share improvement update and owner list",
        lowestMetric ? `Follow up on CSAT weak signal: ${lowestMetric.label}` : "Confirm latest client sentiment",
      ],
      confidence: (score) => (score <= 7.8 ? "High" : "Medium"),
      evidenceReason: "Customer feedback should be turned into clear follow-up commitments.",
    },
  ];

  const recommendations = configs
    .map((config) => buildScoreRecommendation(account, escalations, config))
    .filter(Boolean);

  [
    buildStakeholderCoverageRecommendation(account),
    buildDeliveryRiskRecommendation(account, escalations),
    buildValueGrowthRecommendation(account),
  ]
    .filter(Boolean)
    .forEach((recommendation) => recommendations.push(recommendation));

  if (
    account.retentionRisk !== "Low" ||
    account.renewalDays <= 120 ||
    (escalations ?? []).length > 0
  ) {
    recommendations.push({
      id: `rag-retention-${account.id}`,
      title: "Create a renewal and recovery action plan",
      urgency: account.retentionRisk === "High" || account.renewalDays <= 90 ? "R" : "A",
      healthArea: "Retention",
      parameter: ACTIVITY_RECOMMENDATION_PARAMETERS.retentionRisk,
      reason: `Retention risk is ${account.retentionRisk} with renewal in ${account.renewalDays} days.`,
      expectedLift: "+Retention confidence",
      confidence: (escalations ?? []).length ? "High" : "Medium",
      nextStep: "Align recovery milestones, sponsor messaging, and renewal blockers",
      actionItems: buildActionItems([
        "Confirm renewal owner, sponsor, and approval path",
        "List renewal blockers and required recovery milestones",
        "Send sponsor-facing recovery or value plan",
      ]),
      evidence: [
        buildEvidence({
          source: "Overview",
          sourceType: "Overview",
          date: "Today",
          excerpt: `Health ${account.health}, renewal in ${account.renewalDays} days, retention risk ${account.retentionRisk}.`,
          reason: "Retention planning is needed before the renewal window narrows further.",
        }),
        ...((escalations ?? []).length
          ? [
              buildEvidence({
                source: "Escalation",
                sourceType: "Escalation",
                date: "Open",
                excerpt: `${escalations[0].title} is currently active and can influence renewal sentiment.`,
                reason: "Escalation context increases urgency for a recovery plan.",
              }),
            ]
          : []),
      ],
    });
  }

  const kycSuggestion = buildMissingKycSuggestion(account);
  if (kycSuggestion) recommendations.push(kycSuggestion);

  return recommendations
    .sort((left, right) => {
      const urgencyOrder = { R: 0, A: 1, G: 2 };
      const leftOrder = urgencyOrder[left.urgency] ?? 3;
      const rightOrder = urgencyOrder[right.urgency] ?? 3;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return (AREA_ORDER.get(left.healthArea) ?? 99) - (AREA_ORDER.get(right.healthArea) ?? 99);
    })
    .slice(0, 8);
}

function buildMeetingAction(account, record, index, fallbacks) {
  const template = fallbacks[index] ?? fallbacks[fallbacks.length - 1];
  return {
    id: `meeting-${account.id}-${index + 1}`,
    title: template.title,
    meetingTitle: record.topic,
    meetingDate: record.date,
    sourceExcerpt: record.outcome || record.approach || "Meeting note available for follow-up.",
    healthArea: template.healthArea,
    parameter: template.parameter ?? ACTIVITY_RECOMMENDATION_PARAMETERS.meetingSignal,
    expectedLift: template.expectedLift,
    confidence: template.confidence,
    nextStep: template.nextStep,
    actionItems: buildActionItems(
      template.actionItems ?? [
        template.nextStep,
        "Assign owner and due date",
        "Send client-facing follow-up summary",
      ],
    ),
    evidence: [
      buildEvidence({
        source: `Fireflies ${record.topic}`,
        sourceType: "Fireflies meeting notes",
        date: record.date,
        excerpt: record.outcome || record.approach || record.topic,
        reason: template.reason,
      }),
      ...template.extraEvidence,
    ],
  };
}

function buildMeetingActions(account, opportunities, escalations) {
  const records = (account.educationLog ?? []).slice(0, 3);
  const growthService = (account.retentionGrowth ?? []).find(
    (service) => !service.offered && service.applicable,
  );
  const transcriptOpportunity = (opportunities ?? []).find((opportunity) =>
    isMeetingSource(opportunity.source),
  );
  const openEscalation = (escalations ?? [])[0];

  const fallbacks = [
    {
      title: `Schedule architecture review with ${account.primaryContact.role}`,
      healthArea: "Project",
      expectedLift: "+1.3 Project",
      confidence: "High",
      nextStep: "Confirm technical attendees and target outcomes",
      reason:
        "Meeting context points to a technical follow-up that can improve delivery confidence.",
      extraEvidence: [
        buildEvidence({
          source: "Score Marking Matrics",
          sourceType: "Score Marking Matrics",
          date: "Current score snapshot",
          excerpt: `Project score is ${account.projectHealth.score}/10 with ${summarizeMetrics(account.projectHealth)}`,
          reason: "Project signals support a technical follow-up action.",
        }),
      ],
    },
    {
      title: growthService
        ? `Validate ${growthService.service} interest with the sponsor`
        : "Share roadmap summary and confirm next sponsor ask",
      healthArea: growthService ? "Growth" : "Relationship",
      expectedLift: growthService
        ? `+$${Math.round(getPotentialSlice(account, 4) / 1000)}k Growth`
        : "+1.0 Relationship",
      confidence: growthService ? "Medium" : "High",
      nextStep: growthService
        ? `Turn the meeting signal into a scoped ${growthService.service} proposal`
        : "Send follow-up summary and lock the next executive check-in",
      reason: growthService
        ? "Meeting notes can be translated into a specific whitespace follow-up."
        : "Relationship continuity depends on a timely sponsor follow-up.",
      extraEvidence: growthService
        ? [
            buildEvidence({
              source: "Retention VS Growth",
              sourceType: "Retention VS Growth",
              date: "Current account state",
              excerpt:
                growthService.trackingNote ||
                `${growthService.service} is applicable but not yet offered.`,
              reason: "Whitespace evidence supports the follow-up.",
            }),
          ]
        : [],
    },
    {
      title: openEscalation
        ? "Send recovery memo and confirm escalation owners"
        : transcriptOpportunity
          ? `Follow up on "${transcriptOpportunity.title}" while signal is fresh`
          : "Capture next-step owners from the latest client discussion",
      healthArea: openEscalation ? "Escalation" : transcriptOpportunity ? "Growth" : "Retention",
      expectedLift: openEscalation
        ? "+1.0 CSAT"
        : transcriptOpportunity
          ? `+$${Math.round((transcriptOpportunity.potential ?? 0) / 1000)}k Growth`
          : "+Retention confidence",
      confidence: openEscalation ? "High" : "Medium",
      nextStep: openEscalation
        ? "Confirm owners, due dates, and client-facing message"
        : transcriptOpportunity
          ? transcriptOpportunity.nextStep
          : "Document owner and due date before the next client update",
      reason: openEscalation
        ? "Escalation-related commitments should become explicit follow-up actions."
        : "Meeting notes revealed a follow-up opportunity worth formalizing.",
      extraEvidence: openEscalation
        ? [
            buildEvidence({
              source: "Escalation",
              sourceType: "Escalation",
              date: "Open",
              excerpt: `${openEscalation.title} is active with ${openEscalation.actionItems.length} action items already tracked.`,
              reason: "Escalation context makes this action time-sensitive.",
            }),
          ]
        : transcriptOpportunity
          ? [
              buildEvidence({
                source: "Fireflies meeting notes",
                sourceType: "Fireflies meeting notes",
                date: transcriptOpportunity.signalDate ?? "Recent",
                excerpt: transcriptOpportunity.title,
                reason: "Client conversation already surfaced a next-step-worthy signal.",
              }),
            ]
          : [],
    },
  ];

  if (!records.length) {
    return [
      buildMeetingAction(
        account,
        {
          topic: "Latest client sync",
          date: "Recent",
          outcome: "Follow-up action should be drafted from the latest meeting signal.",
        },
        0,
        fallbacks,
      ),
    ];
  }

  return records.map((record, index) => buildMeetingAction(account, record, index, fallbacks));
}

function normalizeExistingArea(activity) {
  if (activity.area === "Profit") {
    return /renewal|arr|upsell|pitch|poc|growth/i.test(activity.title) ? "Growth" : "Financial";
  }
  return activity.area;
}

function buildExistingEvidence(account, activity, area) {
  const scoreSignal =
    getScoreSignals(account).find((signal) => signal.area === area)?.block ||
    account.relationshipHealth;

  return [
    buildEvidence({
      source: area === "Growth" ? "Retention VS Growth" : "Score Marking Matrics",
      sourceType: area === "Growth" ? "Retention VS Growth" : "Score Marking Matrics",
      date: "Current account state",
      excerpt:
        area === "Growth"
          ? `${account.whiteSpaceCount} whitespace items and ${account.growthUpside > 0 ? `$${Math.round(account.growthUpside / 1000)}k estimated upside` : "active upside"} support this activity.`
          : `${area} score is ${scoreSignal?.score ?? "n/a"}/10. ${summarizeMetrics(scoreSignal)}`,
      reason: `This existing activity is already aligned to ${area.toLowerCase()} improvement.`,
    }),
  ];
}

function mapExistingActivityRow(account, activity) {
  const area = normalizeExistingArea(activity);
  return {
    id: `existing-${activity.id}`,
    rowType: "existing",
    sourceId: activity.id,
    sourceKind: "existing",
    area,
    title: activity.title,
    owner: activity.owner || "Unassigned",
    dueDate: activity.due || "Not set",
    status: activity.status,
    rag: activity.rag,
    parameter: "Existing Activity",
    expectedLift: activity.expectedLift || "—",
    confidence: "Confirmed",
    reason: `Active ${area.toLowerCase()} plan already in progress for this account.`,
    evidence: buildExistingEvidence(account, activity, area),
    nextStep: activity.title,
    actionItems: buildActionItems([activity.title]),
  };
}

function mapSuggestionToActivityRow(suggestion, sourceKind) {
  return {
    id: suggestion.id,
    rowType: "suggested",
    sourceId: suggestion.id,
    sourceKind,
    area: suggestion.healthArea,
    title: suggestion.title,
    owner: "KAM Person",
    dueDate: suggestion.urgency === "R" ? "In 3d" : suggestion.urgency === "A" ? "In 7d" : "In 14d",
    status: "Suggested",
    rag: suggestion.urgency ?? "A",
    parameter: suggestion.parameter ?? "Recommendation",
    expectedLift: suggestion.expectedLift,
    confidence: suggestion.confidence,
    reason: suggestion.reason ?? suggestion.nextStep,
    evidence: suggestion.evidence,
    nextStep: suggestion.nextStep,
    actionItems: buildActionItems(suggestion.actionItems ?? [suggestion.nextStep]),
  };
}

export function buildActivityTabModel({ account, opportunities, escalations }) {
  const backendOpportunities = buildBackendOpportunities(account, opportunities);
  const whitespaceOpportunity = buildWhitespaceOpportunity(account);
  const retentionOpportunity = buildRetentionOpportunity(account, escalations);

  const opportunityItems = [backendOpportunities, whitespaceOpportunity, retentionOpportunity]
    .flat()
    .filter(Boolean)
    .sort((left, right) => {
      const priorityOrder = { High: 0, Medium: 1, Low: 2 };
      const leftOrder = priorityOrder[left.priority] ?? 3;
      const rightOrder = priorityOrder[right.priority] ?? 3;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return (right.potentialValue ?? 0) - (left.potentialValue ?? 0);
    });

  const ragRecommendations = buildRagRecommendations(account, escalations);
  const meetingActions = buildMeetingActions(account, opportunities, escalations);
  const existingRows = (account.activities ?? []).map((activity) =>
    mapExistingActivityRow(account, activity),
  );
  const suggestedRows = [
    ...ragRecommendations.map((item) => mapSuggestionToActivityRow(item, "rag")),
    ...meetingActions.map((item) => mapSuggestionToActivityRow(item, "meeting")),
  ].sort((left, right) => {
    const leftArea = AREA_ORDER.get(left.area) ?? 99;
    const rightArea = AREA_ORDER.get(right.area) ?? 99;
    if (leftArea !== rightArea) return leftArea - rightArea;
    const ragOrder = { R: 0, A: 1, G: 2 };
    return (ragOrder[left.rag] ?? 3) - (ragOrder[right.rag] ?? 3);
  });

  return {
    opportunities: opportunityItems,
    ragRecommendations,
    meetingActions,
    activityRows: [...existingRows, ...suggestedRows],
  };
}
