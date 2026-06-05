import {
  GLOBAL_ACTIVITY_RULE_MATRIX,
  evaluateActivityScoreRule,
} from "@/services/activity-score-matrix";

export const ACTIVITY_TAB_AREAS = [
  "KYC",
  "Health",
  "Relationship",
  "Project",
  "Resource",
  "Financial",
  "Risk",
  "Escalation",
  "CSAT",
];

const AREA_ORDER = new Map(ACTIVITY_TAB_AREAS.map((area, index) => [area, index]));
const HIGH_VALUE_THRESHOLD = 100_000;
const RETENTION_GROWTH_AREAS = new Set(["Growth", "Retention"]);
const RETENTION_GROWTH_RULE_IDS = new Set(["RET-01", "GROW-01", "GROW-02"]);

const SCORE_BLOCKS = [
  {
    key: "relationship",
    area: "Relationship",
    title: "Relationship Health",
    blockKey: "relationshipHealth",
    ruleId: "REL-KPI",
    expectedLift: "+Relationship movement",
  },
  {
    key: "project",
    area: "Project",
    title: "Project Health",
    blockKey: "projectHealth",
    ruleId: "PROJ-KPI",
    expectedLift: "+Project movement",
  },
  {
    key: "resource",
    area: "Resource",
    title: "Resources Health",
    blockKey: "resourceHealth",
    ruleId: "RES-KPI",
    expectedLift: "+Resource movement",
  },
  {
    key: "financial",
    area: "Financial",
    title: "Financial Health",
    blockKey: "financialHealth",
    ruleId: "FIN-KPI",
    expectedLift: "+Financial movement",
  },
  {
    key: "risk",
    area: "Risk",
    title: "Risk Scoring",
    blockKey: "riskScoring",
    ruleId: "RISK-KPI",
    expectedLift: "+Risk movement",
  },
  {
    key: "csat",
    area: "CSAT",
    title: "Customer Satisfaction Score",
    blockKey: "csat",
    ruleId: "CSAT-KPI",
    expectedLift: "+CSAT movement",
  },
];

export function isRetentionGrowthActivityArea(area) {
  return RETENTION_GROWTH_AREAS.has(area);
}

function toId(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

function buildEvidence({ source, sourceType, date, excerpt, reason }) {
  return { source, sourceType, date, excerpt, reason };
}

function getScoreSignals(account) {
  return [
    {
      key: "health",
      area: "Health",
      label: "Health",
      block: { score: account.health, metrics: [] },
      metricPrefix: "Overview",
    },
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

function isRetentionOpportunitySource(source = "") {
  return /retention|renewal|churn|recovery/i.test(source);
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

function getFallbackKpiData(block) {
  return (block?.metrics ?? []).map((metric, index) => ({
    id: `kpi-${index}`,
    metricId: metric.id,
    name: metric.label,
    fields: [
      { id: `${index}-a`, label: "Monthly meeting held on schedule", weight: 50, checked: true },
      { id: `${index}-b`, label: "Director-level participation", weight: 25, checked: false },
      {
        id: `${index}-c`,
        label: "Action items closed before next cycle",
        weight: 25,
        checked: false,
      },
    ],
  }));
}

function formatScoreMetricExpectedLift(field) {
  const weight = Number(field?.weight ?? 0);
  if (!Number.isFinite(weight)) return "0%";
  return `${weight}%`;
}

function getSectionScore(section) {
  const fields = section?.fields ?? [];
  const totalWeight = fields.reduce((sum, field) => sum + Number(field.weight ?? 0), 0);
  if (!totalWeight) return 0;
  const earned = fields.reduce(
    (sum, field) => sum + (field.checked ? Number(field.weight ?? 0) : 0),
    0,
  );
  return Number(((earned / totalWeight) * 10).toFixed(1));
}

function getScoreMetricActivities(account) {
  return SCORE_BLOCKS.flatMap((config) => {
    const block = account[config.blockKey];
    const sections = block?.kpiData ?? getFallbackKpiData(block);

    return sections.flatMap((section) =>
      (section.fields ?? [])
        .filter((field) => !field.checked)
        .map((field) => ({
          id: `score-metric-${account.id}-${config.key}-${toId(section.id)}-${toId(field.id)}`,
          rowType: "suggested",
          sourceId: `score-metric-${config.key}-${section.id}-${field.id}`,
          sourceKind: "score_metric",
          area: config.area,
          title: field.label,
          owner: "KAM Person",
          dueDate: "In 7d",
          status: "Suggested",
          rag: block?.score <= 7 ? "R" : block?.score < 8.5 ? "A" : "G",
          expectedLift: formatScoreMetricExpectedLift(field),
          scoreAreaKey: config.key,
          scoreAreaTitle: config.title,
          scoreSectionId: section.id,
          scoreSection: section.name,
          scoreCriterionId: field.id,
          scoreCriterion: field.label,
          scoreSortValue: getSectionScore(section),
          relatedScoreGaps: [`${config.title} > ${section.name}`],
          confidence: "High",
          ruleId: config.ruleId,
          parameter: config.area,
          impactedMetric: section.name,
          weakSignal: `${section.name} has an unchecked score-marking criterion: ${field.label}`,
          currentValue: `${block?.score ?? "n/a"}/10`,
          targetValue: "Checked and saved in Score Marking Matrics",
          triggerLogic: {
            primary: "A score-marking checklist item is unchecked.",
            source: "Score Marking Matrics",
          },
          evidenceLiftPolicy: [],
          activityScoreLogic: [],
          approvalSla: {},
          reviewCadence: {
            cadence: "Re-evaluate after Score Marking Matrics are saved.",
            autoCloseRule:
              "Remove this suggested activity once the checklist item is checked and saved.",
          },
          scoreBand: null,
          threshold: null,
          targetScore: null,
          thresholdSource: null,
          thresholdReason: null,
          successCriteria:
            "Complete this checklist item, mark it checked in Score Marking Matrics, and save the score.",
          evidenceRequired: ["Updated score marking checklist", "Completion note"],
          reason: `${config.title} > ${section.name} still needs: ${field.label}.`,
          evidence: [
            buildEvidence({
              source: "Score Marking Matrics",
              sourceType: "Score Marking Matrics",
              date: "Current score snapshot",
              excerpt: `${section.name}: ${field.label} is unchecked with ${field.weight ?? 0}% weight.`,
              reason:
                "Unchecked score-marking criteria are converted into activities until they are completed.",
            }),
          ],
          nextStep: `Complete "${field.label}" and check it in ${section.name}`,
        })),
    );
  });
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
    const healthArea =
      isEscalationSource(opportunity.source) || isRetentionOpportunitySource(opportunity.source)
        ? "Retention"
        : "Growth";
    const item = {
      id: `opp-${opportunity.id}`,
      title: opportunity.title,
      source: isMeetingSource(opportunity.source) ? "Fireflies meeting notes" : opportunity.source,
      priority: "Medium",
      potentialValue: opportunity.potential ?? 0,
      confidence: opportunity.confidence ?? "Medium",
      nextStep: opportunity.nextStep ?? "Validate fit with sponsor",
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
    nextStep: `Validate ${whiteSpace.service} fit in the next client review`,
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
    nextStep: "Prepare sponsor recovery plan and renewal talking points",
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

function buildScoreRecommendation(account, escalations, rule, scoreHistory, thresholdOverrides) {
  const signal = evaluateActivityScoreRule(rule, account, {
    escalations,
    scoreHistory,
    thresholdOverrides,
  });
  if (!signal) return null;

  return {
    id: `rag-${signal.ruleId.toLowerCase()}-${account.id}`,
    ruleId: signal.ruleId,
    parameter: signal.parameter,
    impactedMetric: signal.impactedMetric,
    weakSignal: signal.weakSignal,
    currentValue: signal.currentValue,
    targetValue: signal.targetValue,
    triggerLogic: signal.triggerLogic,
    evidenceLiftPolicy: signal.evidenceLiftPolicy,
    activityScoreLogic: signal.activityScoreLogic,
    approvalSla: signal.approvalSla,
    reviewCadence: signal.reviewCadence,
    successCriteria: signal.successCriteria,
    evidenceRequired: signal.evidenceRequired,
    scoreBand: signal.scoreBand,
    threshold: signal.threshold,
    targetScore: signal.targetScore,
    thresholdSource: signal.thresholdSource,
    thresholdReason: signal.thresholdReason,
    title: signal.title,
    urgency: signal.urgency,
    healthArea: signal.parameter,
    reason: signal.reason,
    expectedLift: signal.expectedLift,
    confidence: signal.confidence,
    nextStep: signal.nextStep,
    evidence: [
      buildEvidence({
        source: signal.source,
        sourceType: signal.sourceType,
        date: "Current score snapshot",
        excerpt: signal.excerpt,
        reason: signal.evidenceReason,
      }),
      ...(signal.parameter === "Retention" && (escalations ?? []).length
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
  };
}

function buildRagRecommendations(account, escalations, scoreHistory, thresholdOverrides) {
  const recommendations = GLOBAL_ACTIVITY_RULE_MATRIX.filter(
    (rule) => !RETENTION_GROWTH_RULE_IDS.has(rule.ruleId),
  )
    .map((rule) =>
      buildScoreRecommendation(account, escalations, rule, scoreHistory, thresholdOverrides),
    )
    .filter(Boolean);

  return recommendations.sort((left, right) => {
    const urgencyOrder = { R: 0, A: 1, G: 2 };
    const leftOrder = urgencyOrder[left.urgency] ?? 3;
    const rightOrder = urgencyOrder[right.urgency] ?? 3;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return (AREA_ORDER.get(left.healthArea) ?? 99) - (AREA_ORDER.get(right.healthArea) ?? 99);
  });
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
    expectedLift: template.expectedLift,
    confidence: template.confidence,
    nextStep: template.nextStep,
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
  if (area === "Health") {
    return [
      buildEvidence({
        source: "Overview",
        sourceType: "Overview",
        date: "Current account state",
        excerpt: `Overall health is ${account.health}/100 with retention risk ${account.retentionRisk}.`,
        reason: "This existing activity is aligned to overall account health recovery.",
      }),
    ];
  }

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
    expectedLift: activity.expectedLift || "—",
    confidence: "Confirmed",
    ruleId: null,
    parameter: area,
    impactedMetric: "Existing activity",
    weakSignal: "Existing activity is already tracked",
    currentValue: null,
    targetValue: null,
    triggerLogic: null,
    evidenceLiftPolicy: null,
    activityScoreLogic: null,
    approvalSla: null,
    reviewCadence: null,
    scoreBand: null,
    threshold: null,
    targetScore: null,
    thresholdSource: null,
    thresholdReason: null,
    successCriteria: "Complete the existing activity and confirm the impact during review.",
    evidenceRequired: ["Activity update"],
    reason: `Active ${area.toLowerCase()} plan already in progress for this account.`,
    evidence: buildExistingEvidence(account, activity, area),
    nextStep: activity.title,
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
    expectedLift: suggestion.expectedLift,
    confidence: suggestion.confidence,
    ruleId: suggestion.ruleId ?? null,
    parameter: suggestion.parameter ?? suggestion.healthArea,
    impactedMetric: suggestion.impactedMetric ?? suggestion.healthArea,
    weakSignal: suggestion.weakSignal ?? suggestion.reason,
    currentValue: suggestion.currentValue ?? null,
    targetValue: suggestion.targetValue ?? null,
    triggerLogic: suggestion.triggerLogic ?? null,
    evidenceLiftPolicy: suggestion.evidenceLiftPolicy ?? null,
    activityScoreLogic: suggestion.activityScoreLogic ?? null,
    approvalSla: suggestion.approvalSla ?? null,
    reviewCadence: suggestion.reviewCadence ?? null,
    scoreBand: suggestion.scoreBand ?? null,
    threshold: suggestion.threshold ?? null,
    targetScore: suggestion.targetScore ?? null,
    thresholdSource: suggestion.thresholdSource ?? null,
    thresholdReason: suggestion.thresholdReason ?? null,
    successCriteria: suggestion.successCriteria ?? "Complete the activity and review score impact.",
    evidenceRequired: suggestion.evidenceRequired ?? ["Activity evidence"],
    reason: suggestion.reason ?? suggestion.nextStep,
    evidence: suggestion.evidence,
    nextStep: suggestion.nextStep,
  };
}

export function buildActivityTabModel({
  account,
  opportunities,
  escalations,
  scoreHistory = [],
  thresholdOverrides = [],
}) {
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

  const ragRecommendations = buildRagRecommendations(
    account,
    escalations,
    scoreHistory,
    thresholdOverrides,
  );
  const scoreMetricActivities = getScoreMetricActivities(account).filter(
    (item) => !isRetentionGrowthActivityArea(item.area),
  );
  const meetingActions = buildMeetingActions(account, opportunities, escalations).filter(
    (item) => !isRetentionGrowthActivityArea(item.healthArea),
  );
  const suggestedRows = [
    ...scoreMetricActivities,
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
    scoreMetricActivities,
    meetingActions,
    activityRows: suggestedRows,
  };
}
