const MATRIX_SOURCE = "Global Activity Rule Matrix";

const DEFAULT_EVIDENCE_LIFT_POLICY = [
  {
    quality: "Meeting note only",
    lift: "Minimum lift only",
    requirement: "Meeting note confirms the action was discussed or assigned.",
  },
  {
    quality: "Action tracker plus note",
    lift: "Mid-range lift",
    requirement: "Owner, due date, and tracked action are documented.",
  },
  {
    quality: "Completed action plus outcome proof",
    lift: "Maximum eligible lift",
    requirement: "Completion evidence and client/account outcome are available.",
  },
];

const DEFAULT_ACTIVITY_SCORE_LOGIC = [
  "Generated from valid rule: 0%",
  "Accepted by owner: +10%",
  "Owner and due date assigned: +10%",
  "Completed: +30%",
  "Evidence submitted: +30%",
  "Evidence validated: +20%",
];

const DEFAULT_APPROVAL_SLA = {
  reviewWindow: "48 hours after evidence submission",
  primaryApprover: "Head of KAM",
  fallbackApprover: "POD Lead",
  partialEvidence: "Apply partial activity progress only; hold parameter lift until validated.",
  rejectionRule: "Rejection reason is mandatory.",
};

const DEFAULT_REVIEW_CADENCE = {
  cadence: "Monthly",
  autoCloseRule:
    "If trigger condition is resolved and evidence is validated, suggest closing the activity.",
};

function buildTriggerLogic(primary) {
  return {
    primary,
    trend: "Trigger if this parameter declines for 2 consecutive monthly reviews once score history is available.",
    velocity:
      "Trigger as Red if this parameter drops by 1.5+ points in one month once score history is available.",
    compound: "Escalate urgency when renewal pressure, escalation, or another weak parameter is active.",
    optimization:
      "If score is above threshold but below target, create improvement, optimization, or excellence activity until target is reached.",
  };
}

function getRuleReviewCadence(ruleId) {
  if (ruleId === "ESC-01") {
    return {
      cadence: "Real-time",
      autoCloseRule:
        "Re-check whenever escalation status changes; suggest close when RCA, owners, and sponsor update are validated.",
    };
  }
  if (ruleId === "RET-01") {
    return {
      cadence: "Weekly until renewal risk returns to Low",
      autoCloseRule:
        "Suggest close when renewal blockers are resolved and sponsor alignment evidence is validated.",
    };
  }
  return DEFAULT_REVIEW_CADENCE;
}

function normalizeHistoryKey(value = "") {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function formatHistoryScore(score, parameter) {
  const suffix = parameter === "Health" ? "/100" : "/10";
  return `${Number(score).toFixed(1)}${suffix}`;
}

function getSnapshotMonth(row) {
  return row.snapshotMonth ?? row.snapshot_month ?? "";
}

function getHistoryScore(row) {
  return Number(row.score ?? 0);
}

function getThresholdOverride(ruleId, context = {}) {
  return (context.thresholdOverrides ?? []).find(
    (override) => override.ruleId === ruleId && override.active !== false,
  );
}

function resolveScoreConfig({ ruleId, threshold, redThreshold, targetScore = 10, context }) {
  const override = getThresholdOverride(ruleId, context);
  return {
    threshold: Number(override?.threshold ?? threshold),
    redThreshold: Number(override?.redThreshold ?? redThreshold),
    targetScore: Number(override?.targetScore ?? targetScore),
    thresholdSource: override ? "Account override" : "Global default",
    thresholdReason: override?.reason ?? "Global matrix default applies.",
    approvedBy: override?.approvedBy ?? null,
  };
}

function getScoreBand(score, threshold, targetScore) {
  if (score < threshold) return "Recovery";
  if (score >= targetScore) return "Maintain";

  const improvementCeiling = threshold + (targetScore - threshold) * 0.45;
  const optimizationCeiling = threshold + (targetScore - threshold) * 0.8;

  if (score < improvementCeiling) return "Improvement";
  if (score < optimizationCeiling) return "Optimization";
  return "Excellence";
}

function getScoreBandUrgency(scoreBand) {
  if (scoreBand === "Improvement") return "A";
  if (scoreBand === "Optimization" || scoreBand === "Excellence") return "G";
  return "A";
}

function getScoreBandLift(scoreBand, parameter, targetScore) {
  if (scoreBand === "Recovery") return null;
  return `+${parameter} movement toward ${targetScore}/10`;
}

function resolveTemplate(template, args) {
  return typeof template === "function" ? template(args) : template;
}

function buildThresholdTriggerLogic({
  parameter,
  threshold,
  targetScore,
  thresholdSource,
  thresholdReason,
  scoreBand,
}) {
  return {
    ...buildTriggerLogic(`${parameter} score is below ${threshold}/10`),
    threshold: `${thresholdSource}: threshold ${threshold}/10, target ${targetScore}/10.`,
    scoreBand: `${scoreBand} band is active.`,
    overrideReason: thresholdReason,
  };
}

function buildScoreHistoryTrigger(rule, scoreHistory = []) {
  const parameterKey = normalizeHistoryKey(rule.parameter);
  const metricKey = normalizeHistoryKey(rule.metric);
  const rows = (scoreHistory ?? [])
    .filter((row) => {
      const rowParameter = normalizeHistoryKey(row.parameter);
      const rowMetric = normalizeHistoryKey(row.metric);
      return rowParameter === parameterKey || rowMetric === metricKey;
    })
    .sort((left, right) => new Date(getSnapshotMonth(right)) - new Date(getSnapshotMonth(left)));

  if (rows.length < 2) return null;

  const [latest, previous, prior] = rows;
  const latestScore = getHistoryScore(latest);
  const previousScore = getHistoryScore(previous);
  const priorScore = prior ? getHistoryScore(prior) : null;
  const velocityThreshold = rule.parameter === "Health" ? 10 : 1.5;
  const drop = previousScore - latestScore;
  const velocityTriggered = drop >= velocityThreshold;
  const trendTriggered =
    priorScore !== null && priorScore > previousScore && previousScore > latestScore;

  if (!velocityTriggered && !trendTriggered) return null;

  const latestMonth = getSnapshotMonth(latest) || "latest snapshot";
  const previousMonth = getSnapshotMonth(previous) || "previous snapshot";

  return {
    urgency: velocityTriggered ? "R" : "A",
    weakSignal: velocityTriggered
      ? `${rule.parameter} dropped ${drop.toFixed(1)} point(s) in one month`
      : `${rule.parameter} declined for 2 consecutive monthly reviews`,
    currentValue: formatHistoryScore(latestScore, rule.parameter),
    targetValue: "Stop decline and recover to matrix threshold",
    reason: velocityTriggered
      ? `${rule.parameter} velocity trigger fired because score moved from ${formatHistoryScore(previousScore, rule.parameter)} to ${formatHistoryScore(latestScore, rule.parameter)}.`
      : `${rule.parameter} trend trigger fired because the score declined across consecutive monthly snapshots.`,
    excerpt: `${rule.parameter} score moved from ${formatHistoryScore(previousScore, rule.parameter)} (${previousMonth}) to ${formatHistoryScore(latestScore, rule.parameter)} (${latestMonth}).`,
  };
}

function getLowestMetric(block) {
  const metrics = block?.metrics ?? [];
  if (!metrics.length) return null;
  return metrics.reduce(
    (lowest, metric) => (metric.value < lowest.value ? metric : lowest),
    metrics[0],
  );
}

function getMissingKycFields(account) {
  const fields = [
    ["Business info", account.businessInfo],
    ["Client history", account.clientHistory],
    ["Competitors", account.competitors?.length ? account.competitors.join(", ") : ""],
    ["Main business flow", account.mainBusinessFlow],
    ["Primary contact", account.primaryContact?.name],
    ["Team size", account.teamSize],
  ];

  return fields
    .filter(([, value]) => value === null || value === undefined || value === "")
    .map(([label]) => label);
}

function getOpenWhitespaceService(account) {
  return (account.retentionGrowth ?? []).find((service) => !service.offered && service.applicable);
}

function buildScoreRuleSignal({
  account,
  block,
  ruleId,
  context = {},
  threshold,
  redThreshold,
  targetScore = 10,
  parameter,
  title,
  reason,
  nextStep,
  confidence,
  optimizationTitle,
  optimizationReason,
  optimizationNextStep,
  sourceType = "Score Marking Metrics",
  compoundSignals = [],
  urgencyOverride = null,
}) {
  const score = block?.score ?? 0;
  const config = resolveScoreConfig({
    ruleId,
    threshold,
    redThreshold,
    targetScore,
    context,
  });
  if (score >= config.targetScore) return null;

  const lowestMetric = getLowestMetric(block);
  const scoreBand = getScoreBand(score, config.threshold, config.targetScore);
  const weakMetricText = lowestMetric
    ? `${lowestMetric.label} is at ${lowestMetric.value}/10${lowestMetric.hint ? ` (${lowestMetric.hint})` : ""}`
    : `${parameter} score is ${score}/10`;
  const triggerLogic = buildThresholdTriggerLogic({
    parameter,
    threshold: config.threshold,
    targetScore: config.targetScore,
    thresholdSource: config.thresholdSource,
    thresholdReason: config.thresholdReason,
    scoreBand,
  });

  if (scoreBand !== "Recovery") {
    const args = {
      account,
      score,
      lowestMetric,
      scoreBand,
      threshold: config.threshold,
      targetScore: config.targetScore,
    };
    return {
      title:
        resolveTemplate(optimizationTitle, args) ??
        `Move ${parameter} score from ${score}/10 toward ${config.targetScore}/10`,
      currentValue: `${score}/10`,
      targetValue: `${config.targetScore}/10`,
      weakSignal: `${parameter} is above threshold ${config.threshold}/10 but below target ${config.targetScore}/10`,
      urgency: getScoreBandUrgency(scoreBand),
      confidence: scoreBand === "Excellence" ? "High" : "Medium",
      reason:
        resolveTemplate(optimizationReason, args) ??
        `${parameter} is stable at ${score}/10, but ${weakMetricText.toLowerCase()} should be improved to reach the target score.`,
      nextStep:
        resolveTemplate(optimizationNextStep, args) ??
        `Create a ${scoreBand.toLowerCase()} plan for ${parameter.toLowerCase()} and validate progress with evidence`,
      expectedLift: getScoreBandLift(scoreBand, parameter, config.targetScore),
      scoreBand,
      threshold: config.threshold,
      targetScore: config.targetScore,
      thresholdSource: config.thresholdSource,
      thresholdReason: config.thresholdReason,
      triggerLogic,
      source: MATRIX_SOURCE,
      sourceType,
      excerpt: `${parameter} score is ${score}/10. Target is ${config.targetScore}/10. ${weakMetricText}.`,
      evidenceReason: `Rule applies because ${parameter.toLowerCase()} is below the target score even though it is above the minimum threshold.`,
    };
  }

  return {
    title,
    currentValue: `${score}/10`,
    targetValue: `${config.targetScore}/10`,
    weakSignal: [`${parameter} score below ${config.threshold}/10`, ...compoundSignals].join(" + "),
    urgency: urgencyOverride ?? (score <= config.redThreshold ? "R" : "A"),
    confidence: confidence(score),
    reason: reason(score, lowestMetric),
    nextStep,
    scoreBand,
    threshold: config.threshold,
    targetScore: config.targetScore,
    thresholdSource: config.thresholdSource,
    thresholdReason: config.thresholdReason,
    triggerLogic,
    source: MATRIX_SOURCE,
    sourceType,
    excerpt: `${parameter} score is ${score}/10. ${weakMetricText}.`,
    evidenceReason: `Rule applies because ${parameter.toLowerCase()} is under the defined scoring threshold.`,
  };
}

export const GLOBAL_ACTIVITY_RULE_MATRIX = [
  {
    ruleId: "HLTH-01",
    parameter: "Health",
    metric: "Overall account health",
    trigger: "Overall health is below 70/100",
    triggerLogic: {
      primary: "Overall health is below 70/100",
      trend: "Trigger if overall health declines for 2 consecutive monthly reviews.",
      velocity: "Trigger as Red if health drops by 10+ points in one month.",
      compound: "Escalate when retention risk is not Low, renewal is near, or escalation is open.",
    },
    scoreLift: "No direct Health lift; improves through validated child-parameter rules",
    successCriteria:
      "Recovery plan has named owners, due dates, executive message, and linked parameter actions.",
    evidenceRequired: [
      "Recovery plan",
      "Owner list",
      "Linked parameter actions",
      "Target recovery date",
    ],
    getSignal: (account) => {
      const health = account.health ?? 0;
      if (health >= 70) return null;

      return {
        title: `Create health recovery plan for ${account.name}`,
        currentValue: `${health}/100`,
        targetValue: "Health roll-up improves after child parameter validation",
        weakSignal: "Overall health below 70/100",
        urgency: health <= 55 ? "R" : "A",
        confidence: health <= 55 ? "High" : "Medium",
        reason: `Overall health is ${health}/100, so the account needs a coordinated recovery plan that maps weak child parameters to owned actions.`,
        nextStep:
          "Create one recovery plan with owners, dates, sponsor message, and linked parameter fixes",
        source: "Overview",
        sourceType: "Overview",
        excerpt: `Health ${health}/100, retention risk ${account.retentionRisk}, renewal in ${account.renewalDays} days.`,
        evidenceReason:
          "Health is treated as a roll-up, so this rule coordinates recovery without directly adding health points.",
      };
    },
  },
  {
    ruleId: "REL-01",
    parameter: "Relationship",
    metric: "Sponsor engagement cadence",
    trigger: "Relationship score is below 8.5/10",
    triggerLogic: buildTriggerLogic("Relationship score is below 8.5/10"),
    scoreLift: "+0.5 to +1.2 Relationship",
    successCriteria: "Sponsor touchpoint completed and recurring cadence agreed.",
    evidenceRequired: ["Meeting note", "Next touchpoint date", "Sponsor owner"],
    getSignal: (account, context) =>
      buildScoreRuleSignal({
        account,
        block: account.relationshipHealth,
        ruleId: "REL-01",
        context,
        threshold: 8.5,
        redThreshold: 7.2,
        targetScore: 10,
        parameter: "Relationship",
        title: `Rebuild executive sponsor cadence with ${account.primaryContact.name}`,
        reason: (score, lowestMetric) =>
          `Relationship score is ${score}/10${lowestMetric ? ` and ${lowestMetric.label.toLowerCase()} is the weakest live signal` : ""}.`,
        nextStep: "Lock a sponsor touchpoint before the next business review",
        confidence: (score) => (score <= 7.4 ? "High" : "Medium"),
        optimizationTitle: ({ account: currentAccount, scoreBand }) =>
          `${scoreBand} sponsor coverage plan with ${currentAccount.primaryContact.name}`,
        optimizationReason: ({ score, lowestMetric, targetScore }) =>
          `Relationship is stable at ${score}/10, but ${lowestMetric ? `${lowestMetric.label.toLowerCase()} is the next lever` : "executive coverage still has room"} to reach ${targetScore}/10.`,
        optimizationNextStep:
          "Add proactive sponsor cadence, influence-map coverage, and executive value proof",
      }),
  },
  {
    ruleId: "PROJ-01",
    parameter: "Project",
    metric: "Delivery confidence",
    trigger: "Project score is below 8.3/10",
    triggerLogic: buildTriggerLogic("Project score is below 8.3/10"),
    scoreLift: "+0.8 to +1.5 Project",
    successCriteria: "Delivery blockers are documented with owners, due dates, and client impact.",
    evidenceRequired: ["Review notes", "Action tracker", "Blocker owner list"],
    getSignal: (account, context) =>
      buildScoreRuleSignal({
        account,
        block: account.projectHealth,
        ruleId: "PROJ-01",
        context,
        threshold: 8.3,
        redThreshold: 7.0,
        targetScore: 10,
        parameter: "Project",
        title: `Run an architecture and delivery review with ${account.primaryContact.role}`,
        reason: (score, lowestMetric) =>
          `Project score is ${score}/10${lowestMetric ? ` and ${lowestMetric.label.toLowerCase()} needs attention` : ""}.`,
        nextStep: "Book a working session with delivery and client technical leads",
        confidence: (score) => (score <= 7.5 ? "High" : "Medium"),
        optimizationTitle: ({ account: currentAccount, scoreBand }) =>
          `${scoreBand} delivery predictability plan with ${currentAccount.primaryContact.role}`,
        optimizationReason: ({ score, lowestMetric, targetScore }) =>
          `Project is above minimum at ${score}/10, but ${lowestMetric ? `${lowestMetric.label.toLowerCase()} should improve` : "delivery proof should be strengthened"} to move toward ${targetScore}/10.`,
        optimizationNextStep:
          "Document proactive quality checks, client-visible milestones, and blocker prevention plan",
      }),
  },
  {
    ruleId: "RES-01",
    parameter: "Resource",
    metric: "Critical-role backup coverage",
    trigger: "Resource score is below 8.2/10",
    triggerLogic: buildTriggerLogic("Resource score is below 8.2/10"),
    scoreLift: "+0.7 to +1.3 Resource",
    successCriteria: "Backup owners and knowledge-transfer plan exist for critical roles.",
    evidenceRequired: ["Resource plan", "Backup owner list", "KT schedule"],
    getSignal: (account, context) =>
      buildScoreRuleSignal({
        account,
        block: account.resourceHealth,
        ruleId: "RES-01",
        context,
        threshold: 8.2,
        redThreshold: 7.5,
        targetScore: 10,
        parameter: "Resource",
        title: "Strengthen backup coverage for critical account roles",
        reason: (score) =>
          `Resource score is ${score}/10 with ${account.resourceHealth.criticalResources} critical roles and ${account.resourceHealth.leavesThisMonth} leave events this month.`,
        nextStep: "Confirm backup owners and knowledge-transfer plan this week",
        confidence: (score) => (score <= 7.5 ? "High" : "Medium"),
        optimizationTitle: ({ scoreBand }) =>
          `${scoreBand} resource resilience and succession drill`,
        optimizationReason: ({ score, targetScore }) =>
          `Resource health is ${score}/10, but resilience needs stronger backup proof and KT coverage to reach ${targetScore}/10.`,
        optimizationNextStep:
          "Run a backup-owner drill, update KT artifacts, and validate coverage for critical roles",
      }),
  },
  {
    ruleId: "FIN-01",
    parameter: "Financial",
    metric: "Value realization proof",
    trigger: "Financial score is below 8.8/10",
    triggerLogic: {
      ...buildTriggerLogic("Financial score is below 8.8/10"),
      compound: "Escalate as Red when Financial < 8.8 and renewal is within 90 days.",
    },
    scoreLift: "+0.4 to +0.8 Financial",
    successCriteria: "Client-facing value story is shared with measurable outcomes.",
    evidenceRequired: ["Value summary", "ROI proof point", "Client review note"],
    getSignal: (account, context) =>
      buildScoreRuleSignal({
        account,
        block: account.financialHealth,
        ruleId: "FIN-01",
        context,
        threshold: 8.8,
        redThreshold: 7.0,
        targetScore: 10,
        parameter: "Financial",
        title: "Refresh the value realization story for the current engagement",
        reason: (score, lowestMetric) =>
          `Financial score is ${score}/10${lowestMetric ? ` and ${lowestMetric.label.toLowerCase()} is lagging the rest of the account` : ""}.`,
        nextStep: "Package measurable value outcomes for the next client review",
        confidence: (score) => (score <= 7.5 ? "High" : "Medium"),
        compoundSignals:
          account.renewalDays <= 90 ? ["renewal window is within 90 days"] : [],
        urgencyOverride: account.renewalDays <= 90 ? "R" : null,
        optimizationTitle: ({ scoreBand }) =>
          `${scoreBand} value realization proof for renewal and expansion`,
        optimizationReason: ({ score, lowestMetric, targetScore }) =>
          `Financial health is ${score}/10, but ${lowestMetric ? `${lowestMetric.label.toLowerCase()} can be sharpened` : "value proof can be made stronger"} to reach ${targetScore}/10.`,
        optimizationNextStep:
          "Quantify ROI, attach outcome proof, and prepare value story for sponsor review",
      }),
  },
  {
    ruleId: "RISK-01",
    parameter: "Risk",
    metric: "Risk mitigation ownership",
    trigger: "Risk score is below 7.8/10",
    triggerLogic: buildTriggerLogic("Risk score is below 7.8/10"),
    scoreLift: "+0.6 to +1.0 Risk",
    successCriteria: "Top risks have mitigation owners, deadlines, and client-safe messaging.",
    evidenceRequired: ["Risk register", "Mitigation owner list", "Status update"],
    getSignal: (account, context) =>
      buildScoreRuleSignal({
        account,
        block: account.riskScoring,
        ruleId: "RISK-01",
        context,
        threshold: 7.8,
        redThreshold: 6.8,
        targetScore: 10,
        parameter: "Risk",
        title: "Run a risk review on delivery, competitor, and stakeholder blockers",
        reason: (score, lowestMetric) =>
          `Risk score is ${score}/10${lowestMetric ? ` and ${lowestMetric.label.toLowerCase()} is the biggest warning signal` : ""}.`,
        nextStep: "Review blockers and assign owners before the next status update",
        confidence: (score) => (score <= 7.0 ? "High" : "Medium"),
        optimizationTitle: ({ scoreBand }) =>
          `${scoreBand} risk prevention and early-warning plan`,
        optimizationReason: ({ score, lowestMetric, targetScore }) =>
          `Risk is controlled at ${score}/10, but ${lowestMetric ? `${lowestMetric.label.toLowerCase()} remains the next exposure` : "residual risks should be converted into prevention checks"} to reach ${targetScore}/10.`,
        optimizationNextStep:
          "Create early-warning indicators, mitigation owners, and client-safe prevention updates",
      }),
  },
  {
    ruleId: "CSAT-01",
    parameter: "CSAT",
    metric: "Client feedback closure",
    trigger: "CSAT score is below 8.9/10",
    triggerLogic: buildTriggerLogic("CSAT score is below 8.9/10"),
    scoreLift: "+0.7 to +1.1 CSAT",
    successCriteria: "Client concern is acknowledged, actioned, and checked back with sponsor.",
    evidenceRequired: ["Feedback note", "Action plan", "Client confirmation"],
    getSignal: (account, context) =>
      buildScoreRuleSignal({
        account,
        block: account.csat,
        ruleId: "CSAT-01",
        context,
        threshold: 8.9,
        redThreshold: 7.5,
        targetScore: 10,
        parameter: "CSAT",
        title: "Close the feedback loop on sponsor and delivery concerns",
        reason: (score, lowestMetric) =>
          `CSAT score is ${score}/10${lowestMetric ? ` and ${lowestMetric.label.toLowerCase()} needs a follow-up response` : ""}.`,
        nextStep: "Share an improvement update and confirm sentiment in the next touchpoint",
        confidence: (score) => (score <= 7.8 ? "High" : "Medium"),
        optimizationTitle: ({ scoreBand }) => `${scoreBand} client delight and feedback loop`,
        optimizationReason: ({ score, lowestMetric, targetScore }) =>
          `CSAT is healthy at ${score}/10, but ${lowestMetric ? `${lowestMetric.label.toLowerCase()} can be improved` : "client sentiment should be validated"} to reach ${targetScore}/10.`,
        optimizationNextStep:
          "Capture sponsor confirmation, close open sentiment loops, and document delight proof",
      }),
  },
  {
    ruleId: "ESC-01",
    parameter: "Escalation",
    metric: "Escalation recovery closure",
    trigger: "One or more escalations are open",
    triggerLogic: {
      primary: "One or more escalations are open",
      trend: "Not monthly; escalation is checked whenever open escalation state changes.",
      velocity: "Trigger as Red immediately for P1 escalation.",
      compound: "Escalate when escalation overlaps renewal pressure or low CSAT/Risk score.",
    },
    reviewCadence: getRuleReviewCadence("ESC-01"),
    scoreLift: "+0.8 to +1.5 CSAT/Risk",
    successCriteria: "Escalation has RCA, action owners, due dates, and sponsor update.",
    evidenceRequired: ["RCA", "Action item tracker", "Sponsor update"],
    getSignal: (account, { escalations = [] } = {}) => {
      const openEscalation = escalations[0];
      if (!openEscalation) return null;

      return {
        title: "Convert open escalation into a recovery plan",
        currentValue: `${escalations.length} open`,
        targetValue: "0 open critical blockers",
        weakSignal: "Open escalation exists",
        urgency: openEscalation.priority === "P1" ? "R" : "A",
        confidence: "High",
        reason: `${openEscalation.title} is active and can pull down client sentiment, risk, and retention confidence.`,
        nextStep: "Confirm RCA, owners, due dates, and client-facing recovery message",
        source: "Escalation",
        sourceType: "Escalation",
        excerpt:
          openEscalation.description || openEscalation.recommendation || openEscalation.title,
        evidenceReason:
          "Escalation recovery needs explicit proof before any score movement is justified.",
      };
    },
  },
  {
    ruleId: "RET-01",
    parameter: "Retention",
    metric: "Renewal confidence",
    trigger: "Retention risk is not Low, renewal is within 120 days, or escalation is open",
    triggerLogic: {
      primary: "Retention risk is not Low, renewal is within 120 days, or escalation is open",
      trend: "Weekly re-check while renewal risk is active.",
      velocity: "Trigger as Red when renewal is within 90 days or retention risk becomes High.",
      compound: "Escalate when renewal pressure overlaps escalation, low CSAT, or financial weakness.",
    },
    reviewCadence: getRuleReviewCadence("RET-01"),
    scoreLift: "+Retention confidence",
    successCriteria: "Renewal blockers, sponsor message, and recovery milestones are agreed.",
    evidenceRequired: ["Renewal plan", "Blocker list", "Sponsor alignment note"],
    getSignal: (account, { escalations = [] } = {}) => {
      const hasEscalation = escalations.length > 0;
      if (account.retentionRisk === "Low" && account.renewalDays > 120 && !hasEscalation) {
        return null;
      }

      return {
        title: "Create a renewal and recovery action plan",
        currentValue: `${account.retentionRisk} risk / ${account.renewalDays} days`,
        targetValue: "Low risk before renewal",
        weakSignal: "Renewal pressure or retention risk is active",
        urgency: account.retentionRisk === "High" || account.renewalDays <= 90 ? "R" : "A",
        confidence: hasEscalation ? "High" : "Medium",
        reason: `Retention risk is ${account.retentionRisk} with renewal in ${account.renewalDays} days.`,
        nextStep: "Align recovery milestones, sponsor messaging, and renewal blockers",
        source: "Overview",
        sourceType: "Overview",
        excerpt: `Health ${account.health}, renewal in ${account.renewalDays} days, retention risk ${account.retentionRisk}.`,
        evidenceReason:
          "Retention planning should start before the renewal window narrows further.",
      };
    },
  },
  {
    ruleId: "GROW-02",
    parameter: "Growth",
    metric: "White space analysis maturity",
    trigger: "White Space score is below configured target",
    triggerLogic: buildTriggerLogic("White Space score is below configured target"),
    scoreLift: "+Growth maturity toward 10/10",
    successCriteria:
      "Whitespace map is current, sponsor-validated, and has at least one qualified next step.",
    evidenceRequired: ["Whitespace map", "Sponsor validation", "Qualified next step"],
    getSignal: (account, context) =>
      buildScoreRuleSignal({
        account,
        block: account.whiteSpace,
        ruleId: "GROW-02",
        context,
        threshold: 8.5,
        redThreshold: 6.5,
        targetScore: 10,
        parameter: "Growth",
        title: "Rebuild whitespace analysis into a qualified expansion plan",
        reason: (score, lowestMetric) =>
          `White Space score is ${score}/10${lowestMetric ? ` and ${lowestMetric.label.toLowerCase()} is the weakest expansion signal` : ""}.`,
        nextStep:
          "Refresh service fit, sponsor appetite, and next-best expansion sequence",
        confidence: (score) => (score <= 7.0 ? "High" : "Medium"),
        optimizationTitle: ({ scoreBand }) =>
          `${scoreBand} whitespace conversion plan for expansion`,
        optimizationReason: ({ score, lowestMetric, targetScore }) =>
          `White Space score is ${score}/10, but ${lowestMetric ? `${lowestMetric.label.toLowerCase()} should improve` : "the expansion map needs stronger proof"} to reach ${targetScore}/10.`,
        optimizationNextStep:
          "Validate unoffered services, rank sponsor appetite, and attach a qualified next step",
        sourceType: "Retention VS Growth",
      }),
  },
  {
    ruleId: "GROW-01",
    parameter: "Growth",
    metric: "Whitespace conversion",
    trigger: "Applicable service exists but has not been offered",
    triggerLogic: buildTriggerLogic("Applicable service exists but has not been offered"),
    scoreLift: "+Growth potential",
    successCriteria: "Whitespace service has a reviewed pitch, sponsor ask, or qualified next step.",
    evidenceRequired: ["Pitch draft", "Sponsor feedback", "Qualified next step"],
    getSignal: (account) => {
      const service = getOpenWhitespaceService(account);
      if (!service) return null;

      return {
        title: `Plan pitch for ${service.service}`,
        currentValue: `${account.whiteSpaceCount} whitespace items`,
        targetValue: "1 qualified pitch",
        weakSignal: "Applicable whitespace is not yet offered",
        urgency: account.whiteSpaceCount >= 3 ? "A" : "G",
        confidence: account.whiteSpaceCount >= 3 ? "High" : "Medium",
        reason:
          service.trackingNote ||
          `${service.service} is applicable to this account but has not been offered yet.`,
        nextStep: `Validate ${service.service} fit with the sponsor and draft the pitch`,
        source: "Retention VS Growth",
        sourceType: "Retention VS Growth",
        excerpt:
          service.trackingNote ||
          `${service.service} is applicable but has not been offered yet.`,
        evidenceReason:
          "Growth score movement should be tied to a qualified next step, not just a possible service.",
      };
    },
  },
  {
    ruleId: "KYC-01",
    parameter: "KYC",
    metric: "Account intelligence completeness",
    trigger: "Required KYC fields are missing",
    triggerLogic: {
      primary: "Required KYC fields are missing",
      trend: "Monthly re-check until required account intelligence is complete.",
      velocity: "No velocity trigger; KYC is a completeness gate.",
      compound: "Escalate when missing KYC blocks retention, growth, or sponsor planning.",
    },
    scoreLift: "+KYC health",
    successCriteria: "Required account intelligence fields are completed and reviewed.",
    evidenceRequired: ["Updated overview fields", "Primary contact", "Business context"],
    getSignal: (account) => {
      const missingFields = getMissingKycFields(account);
      if (!missingFields.length) return null;

      return {
        title: "Complete missing account intelligence fields",
        currentValue: `${missingFields.length} missing fields`,
        targetValue: "0 missing required fields",
        weakSignal: "KYC fields are incomplete",
        urgency: "A",
        confidence: "High",
        reason: `${missingFields.length} KYC fields are incomplete, which weakens scoring context and action planning.`,
        nextStep: "Fill the missing account fields in Overview",
        source: "Overview",
        sourceType: "KYC/Account health",
        excerpt: `Missing fields: ${missingFields.join(", ")}.`,
        evidenceReason:
          "KYC completeness improves the quality of scoring context and recommended activities.",
      };
    },
  },
];

export function evaluateActivityScoreRule(rule, account, context = {}) {
  const historyTrigger = buildScoreHistoryTrigger(rule, context.scoreHistory);
  const signal =
    rule.getSignal(account, context) ??
    (historyTrigger
      ? {
          title: `Review ${rule.parameter} score decline before it crosses threshold`,
          currentValue: historyTrigger.currentValue,
          targetValue: historyTrigger.targetValue,
          weakSignal: historyTrigger.weakSignal,
          urgency: historyTrigger.urgency,
          confidence: "High",
          reason: historyTrigger.reason,
          nextStep: `Create a ${rule.parameter.toLowerCase()} recovery activity using ${rule.metric.toLowerCase()} evidence`,
          source: "Score history",
          sourceType: "Score history",
          excerpt: historyTrigger.excerpt,
          evidenceReason:
            "Score history triggered this rule before the static threshold became the only signal.",
        }
      : null);
  if (!signal) return null;

  const weakSignal = [signal.weakSignal ?? rule.trigger, historyTrigger?.weakSignal]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(" + ");
  const urgency =
    historyTrigger?.urgency === "R" || signal.urgency === "R"
      ? "R"
      : historyTrigger?.urgency ?? signal.urgency;

  return {
    ruleId: rule.ruleId,
    parameter: rule.parameter,
    impactedMetric: rule.metric,
    weakSignal,
    currentValue: signal.currentValue,
    targetValue: signal.targetValue,
    expectedLift: signal.expectedLift ?? rule.scoreLift,
    triggerLogic: signal.triggerLogic ?? rule.triggerLogic ?? buildTriggerLogic(rule.trigger),
    evidenceLiftPolicy: rule.evidenceLiftPolicy ?? DEFAULT_EVIDENCE_LIFT_POLICY,
    activityScoreLogic: rule.activityScoreLogic ?? DEFAULT_ACTIVITY_SCORE_LOGIC,
    approvalSla: rule.approvalSla ?? DEFAULT_APPROVAL_SLA,
    reviewCadence: rule.reviewCadence ?? getRuleReviewCadence(rule.ruleId),
    successCriteria: signal.successCriteria ?? rule.successCriteria,
    evidenceRequired: signal.evidenceRequired ?? rule.evidenceRequired,
    title: signal.title,
    urgency,
    confidence: signal.confidence,
    reason: [signal.reason, historyTrigger && signal.source !== "Score history" ? historyTrigger.reason : null]
      .filter(Boolean)
      .join(" "),
    nextStep: signal.nextStep,
    source: signal.source ?? MATRIX_SOURCE,
    sourceType: signal.sourceType ?? MATRIX_SOURCE,
    excerpt: signal.excerpt,
    evidenceReason: signal.evidenceReason,
    scoreBand: signal.scoreBand ?? "Triggered",
    threshold: signal.threshold ?? null,
    targetScore: signal.targetScore ?? null,
    thresholdSource: signal.thresholdSource ?? null,
    thresholdReason: signal.thresholdReason ?? null,
  };
}
