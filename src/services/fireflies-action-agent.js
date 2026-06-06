const MAX_ACTION_TEXT_LENGTH = 260;
const MIN_ACTION_TEXT_LENGTH = 8;
const SUMMARY_ACTION_LIMIT = 5;
const DEFAULT_GLOBAL_ACTION_LIMIT = 15;
const DEFAULT_PER_TRANSCRIPT_ACTION_LIMIT = 3;
const CAP_BYPASS_RULE_IDS = new Set(["ESC-01"]);

const ACTION_VERB_PATTERN =
  /\b(schedule|send|share|prepare|create|draft|review|follow up|follow-up|confirm|assign|align|book|capture|document|validate|resolve|close|update|publish|deliver|circulate|complete|collect|define|run|set up|organize|plan|submit|escalate|approve|request|requested|ask|asked)\b/i;

const NOTE_ONLY_PATTERN =
  /\b(fyi|for awareness|discussed|noted|mentioned|talked about|decision was|summary|no action|none|n\/a)\b/i;

const SUMMARY_SIGNAL_PATTERN =
  /\b(requested|asked|needs|need|concern|risk|blocker|delay|renewal|follow-up|follow up|next step|owner|due|pending|waiting|proposal|sponsor|escalation|feedback|action)\b/i;

const CLASSIFIER_PRIORITIES = {
  "ESC-01": 100,
  "RET-01": 90,
  "RISK-01": 80,
  "PROJ-01": 70,
  "CSAT-01": 65,
  "FIN-01": 60,
  "REL-01": 55,
  "RES-01": 50,
  "GROW-01": 45,
  "KYC-01": 40,
};

const CLASSIFIER_CONTEXT_PATTERNS = {
  "RISK-01": /\b(risk|security|compliance|mitigation|dependency|competitor|exposure)\b/i,
  "PROJ-01": /\b(architecture|delivery|milestone|jira|timeline|implementation|technical)\b/i,
  "RES-01": /\b(resource|backup|coverage|staffing|handover|kt|knowledge transfer|leave|owner)\b/i,
  "FIN-01": /\b(roi|invoice|payment|budget|commercial|pricing|arr|savings)\b/i,
  "REL-01": /\b(sponsor|stakeholder|qbr|cadence|executive|cto|cfo|vp|director)\b/i,
};

const CLASSIFIERS = [
  {
    healthArea: "Escalation",
    ruleId: "ESC-01",
    expectedLift: "+0.8 to +1.5 CSAT/Risk",
    pattern: /\b(escalation|rca|incident|outage|p1|p2|service credit|recovery memo)\b/i,
  },
  {
    healthArea: "Retention",
    ruleId: "RET-01",
    expectedLift: "+Retention confidence",
    pattern: /\b(renewal|retention|churn|recovery plan|contract risk|renew)\b/i,
  },
  {
    healthArea: "Project",
    ruleId: "PROJ-01",
    expectedLift: "+0.8 to +1.5 Project",
    pattern: /\b(architecture|delivery|blocker|milestone|jira|timeline|implementation|technical)\b/i,
  },
  {
    healthArea: "Relationship",
    ruleId: "REL-01",
    expectedLift: "+0.5 to +1.2 Relationship",
    pattern: /\b(sponsor|stakeholder|qbr|cadence|executive|cto|cfo|vp|director|touchpoint)\b/i,
  },
  {
    healthArea: "Resource",
    ruleId: "RES-01",
    expectedLift: "+0.7 to +1.3 Resource",
    pattern: /\b(resource|backup|kt|knowledge transfer|coverage|staffing|handover)\b/i,
  },
  {
    healthArea: "Financial",
    ruleId: "FIN-01",
    expectedLift: "+0.4 to +0.8 Financial",
    pattern: /\b(value|roi|invoice|payment|budget|commercial|pricing|arr|savings)\b/i,
  },
  {
    healthArea: "Risk",
    ruleId: "RISK-01",
    expectedLift: "+0.6 to +1.0 Risk",
    pattern: /\b(risk|competitor|security|compliance|mitigation|blocker|dependency)\b/i,
  },
  {
    healthArea: "CSAT",
    ruleId: "CSAT-01",
    expectedLift: "+0.7 to +1.1 CSAT",
    pattern: /\b(feedback|sentiment|csat|concern|complaint|satisfaction|improvement update)\b/i,
  },
  {
    healthArea: "Growth",
    ruleId: "GROW-01",
    expectedLift: "+Growth potential",
    pattern: /\b(pitch|proposal|pilot|poc|upsell|cross-sell|growth|expansion|scope)\b/i,
  },
  {
    healthArea: "KYC",
    ruleId: "KYC-01",
    expectedLift: "+KYC health",
    pattern: /\b(kyc|business info|account info|primary contact|competitor|client history)\b/i,
  },
];

function normalize(value = "") {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeHistoryKey(value = "") {
  return normalize(value).replace(/\s+/g, "");
}

function toId(value = "") {
  return normalize(value).replace(/\s+/g, "-").slice(0, 80) || "action";
}

function splitActionItems(raw = "") {
  return raw
    .split(/\r?\n|(?:^|\s)(?:\d+\.|[-*•])\s+/)
    .map((item) =>
      item
        .replace(/^[-*•\d.\s]+/, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

function splitSummaryCandidates(raw = "") {
  return raw
    .split(/\r?\n|(?<=[.!?])\s+|;\s+/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item.length >= MIN_ACTION_TEXT_LENGTH);
}

function deriveActionItemsFromSummary(raw = "") {
  return splitSummaryCandidates(raw)
    .map((candidate) => {
      if (hasConcreteActionShape(candidate)) return candidate;
      if (!SUMMARY_SIGNAL_PATTERN.test(candidate)) return null;
      return `Review and follow up on: ${candidate}`;
    })
    .filter(Boolean)
    .slice(0, SUMMARY_ACTION_LIMIT);
}

function getTranscriptCandidateActions(transcript) {
  const explicitItems = splitActionItems(transcript.actionItems).filter(
    (item) => !NOTE_ONLY_PATTERN.test(item),
  );
  if (explicitItems.length) {
    return {
      actionSource: "explicit_action_items",
      candidates: explicitItems,
      explicitCount: explicitItems.length,
      summaryFallbackUsed: false,
    };
  }

  const summaryCandidates = deriveActionItemsFromSummary(
    [transcript.overview, transcript.shortSummary].filter(Boolean).join(" "),
  );
  return {
    actionSource: "summary_derived",
    candidates: summaryCandidates,
    explicitCount: 0,
    summaryFallbackUsed: true,
  };
}

function getTranscriptDate(transcript) {
  if (!transcript.date) return "Recent";
  const date = new Date(Number(transcript.date));
  if (!Number.isNaN(date.getTime())) return date.toLocaleDateString("en-US");
  const parsed = new Date(transcript.date);
  if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleDateString("en-US");
  return String(transcript.date);
}

function getAccountKeywords(account) {
  return [
    account.name,
    account.shortCode,
    account.primaryContact?.name,
    account.primaryContact?.role,
    ...(account.stakeholders ?? []).map((stakeholder) => stakeholder.name),
    ...(account.retentionGrowth ?? []).map((service) => service.service),
  ]
    .map(normalize)
    .filter((value) => value.length >= 3);
}

function getStrongAccountKeywords(account) {
  return [
    account.name,
    account.shortCode,
    account.primaryContact?.name,
    ...(account.stakeholders ?? []).map((stakeholder) => stakeholder.name),
  ]
    .map(normalize)
    .filter((value) => value.length >= 4);
}

function getAccountRelevance(account, transcript, actionText) {
  const haystack = normalize(
    [
      actionText,
      transcript.title,
      transcript.overview,
      ...(transcript.participants ?? []),
      ...(transcript.attendees ?? []).map((attendee) => `${attendee.name} ${attendee.email}`),
    ].join(" "),
  );
  const keywords = getAccountKeywords(account);
  if (!keywords.length) {
    return { relevant: false, matchStrength: "none", matchedKeywords: [] };
  }

  const matchedKeywords = keywords.filter((keyword) => haystack.includes(keyword));
  if (!matchedKeywords.length) {
    return { relevant: false, matchStrength: "none", matchedKeywords: [] };
  }

  const strongKeywords = new Set(getStrongAccountKeywords(account));
  const hasStrongMatch = matchedKeywords.some((keyword) => strongKeywords.has(keyword));
  return {
    relevant: true,
    matchStrength: hasStrongMatch || matchedKeywords.length >= 2 ? "strong" : "partial",
    matchedKeywords,
  };
}

function isRelevantToAccount(account, transcript, actionText) {
  return getAccountRelevance(account, transcript, actionText).relevant;
}

function getSnapshotMonth(row) {
  return row.snapshotMonth ?? row.snapshot_month ?? "";
}

function getHistoryScore(row) {
  return Number(row.score ?? 0);
}

function getScoreHistoryContext(parameter, scoreHistory = []) {
  const parameterKey = normalizeHistoryKey(parameter);
  const rows = (scoreHistory ?? [])
    .filter((row) => {
      const rowParameter = normalizeHistoryKey(row.parameter);
      const rowMetric = normalizeHistoryKey(row.metric);
      return rowParameter === parameterKey || rowMetric.includes(parameterKey);
    })
    .sort((left, right) => new Date(getSnapshotMonth(right)) - new Date(getSnapshotMonth(left)));

  if (rows.length < 2) return null;

  const [latest, previous, prior] = rows;
  const latestScore = getHistoryScore(latest);
  const previousScore = getHistoryScore(previous);
  const priorScore = prior ? getHistoryScore(prior) : null;
  const drop = previousScore - latestScore;
  const velocityTriggered = drop >= 1.5;
  const trendTriggered =
    priorScore !== null && priorScore > previousScore && previousScore > latestScore;

  if (!velocityTriggered && !trendTriggered) return null;

  return {
    urgency: velocityTriggered ? "R" : "A",
    weakSignal: velocityTriggered
      ? `${parameter} dropped ${drop.toFixed(1)} point(s) in one month`
      : `${parameter} declined for 2 consecutive monthly reviews`,
    currentValue: `${latestScore.toFixed(1)}/10`,
    targetValue: "Stop decline and recover to matrix threshold",
    reason: velocityTriggered
      ? `${parameter} score moved from ${previousScore.toFixed(1)}/10 to ${latestScore.toFixed(1)}/10.`
      : `${parameter} score is declining across consecutive score snapshots.`,
  };
}

function getClassifierScore(actionText, classifier) {
  if (!classifier.pattern.test(actionText)) return 0;

  let score = CLASSIFIER_PRIORITIES[classifier.ruleId] ?? 10;
  if (CLASSIFIER_CONTEXT_PATTERNS[classifier.ruleId]?.test(actionText)) score += 25;

  if (classifier.ruleId === "RISK-01" && /\bblocker\b/i.test(actionText)) score += 8;
  if (
    classifier.ruleId === "RES-01" &&
    /\b(backup|coverage|leave|handover|staffing|resource|owner)\b/i.test(actionText)
  ) {
    score += 35;
  }
  if (
    classifier.ruleId === "PROJ-01" &&
    /\bblocker\b/i.test(actionText) &&
    !CLASSIFIER_CONTEXT_PATTERNS["PROJ-01"].test(actionText)
  ) {
    score -= 12;
  }

  return score;
}

function classifyAction(actionText, account) {
  const serviceMatch = (account.retentionGrowth ?? []).find((service) =>
    normalize(actionText).includes(normalize(service.service)),
  );
  if (serviceMatch && /\b(validate|pitch|proposal|pilot|poc|scope|offer)\b/i.test(actionText)) {
    return CLASSIFIERS.find((classifier) => classifier.ruleId === "GROW-01");
  }

  return CLASSIFIERS.map((classifier) => ({
    classifier,
    score: getClassifierScore(actionText, classifier),
  }))
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score)[0]?.classifier;
}

function shouldBypassActionCap(classifier) {
  return CAP_BYPASS_RULE_IDS.has(classifier?.ruleId);
}

function hasConcreteActionShape(actionText) {
  if (actionText.length < MIN_ACTION_TEXT_LENGTH || actionText.length > MAX_ACTION_TEXT_LENGTH) {
    return false;
  }
  if (NOTE_ONLY_PATTERN.test(actionText)) return false;
  return ACTION_VERB_PATTERN.test(actionText);
}

function getConfidence(actionText, classifier, { actionSource, relevance, historyContext } = {}) {
  if (historyContext?.urgency === "R") return "High";
  if (actionSource === "summary_derived") return "Low";

  const hasDate = /\b(today|tomorrow|this week|next week|monday|tuesday|wednesday|thursday|friday|by\s+\w+|\d{1,2}\/\d{1,2})\b/i.test(
    actionText,
  );
  const hasOwner = /\b(kam|owner|sponsor|client|cto|cfo|vp|director|delivery|team)\b/i.test(
    actionText,
  );
  if (classifier.ruleId === "ESC-01" || (hasDate && hasOwner)) return "High";
  if (relevance?.matchStrength === "partial") return "Medium";
  return "Medium";
}

function getUrgency(confidence, historyContext) {
  if (historyContext?.urgency) return historyContext.urgency;
  if (confidence === "High") return "R";
  if (confidence === "Low") return "G";
  return "A";
}

function buildGuardedAction({
  account,
  transcript,
  actionText,
  index,
  actionSource,
  scoreHistory = [],
}) {
  if (!hasConcreteActionShape(actionText)) return null;
  const relevance = getAccountRelevance(account, transcript, actionText);
  if (!relevance.relevant) return null;

  const classifier = classifyAction(actionText, account);
  if (!classifier) return null;

  const meetingDate = getTranscriptDate(transcript);
  const historyContext = getScoreHistoryContext(classifier.healthArea, scoreHistory);
  const confidence = getConfidence(actionText, classifier, {
    actionSource,
    relevance,
    historyContext,
  });
  const sourcePrefix =
    actionSource === "summary_derived"
      ? `fireflies-summary-${transcript.id}`
      : `fireflies-${transcript.id}`;
  return {
    id: `${sourcePrefix}-${toId(actionText)}-${index}`,
    title: actionText,
    meetingTitle: transcript.title,
    meetingDate,
    actionSource,
    sourceExcerpt: actionText,
    healthArea: classifier.healthArea,
    ruleId: classifier.ruleId,
    parameter: classifier.healthArea,
    impactedMetric: "Meeting-derived required action",
    weakSignal: [
      "Fireflies meeting action item matched a scoring rule guardrail",
      historyContext?.weakSignal,
    ]
      .filter(Boolean)
      .join(" + "),
    currentValue: historyContext?.currentValue ?? "Meeting action identified",
    targetValue: historyContext?.targetValue ?? "Validated activity evidence",
    successCriteria: "Action has owner, due date or next step, and evidence before score movement.",
    evidenceRequired: ["Fireflies action item", "Owner/date confirmation", "Completion evidence"],
    expectedLift: classifier.expectedLift,
    confidence,
    urgency: getUrgency(confidence, historyContext),
    nextStep: actionText,
    evidence: [
      {
        source: `Fireflies ${transcript.title}`,
        sourceType: "Fireflies meeting notes",
        date: meetingDate,
        excerpt: actionText,
        reason:
          actionSource === "summary_derived"
            ? `The guarded agent derived this action from the meeting summary and mapped it to the global scoring rules.${historyContext ? ` ${historyContext.reason}` : ""}`
            : `The guarded agent kept this item because it is an explicit action mapped to the global scoring rules.${historyContext ? ` ${historyContext.reason}` : ""}`,
      },
    ],
  };
}

export function runFirefliesMeetingActionAgent({
  account,
  transcripts,
  scoreHistory = [],
  maxItems = DEFAULT_GLOBAL_ACTION_LIMIT,
  globalMaxItems = maxItems,
  perTranscriptLimit = DEFAULT_PER_TRANSCRIPT_ACTION_LIMIT,
}) {
  const accepted = [];
  const seen = new Set();
  const transcriptResults = [];
  const diagnostics = {
    transcriptsScanned: transcripts.length,
    rawActionItemsSeen: 0,
    summaryFallbacksUsed: 0,
    summaryCandidatesSeen: 0,
    rejectedAsNoise: 0,
    rejectedAsUnrelated: 0,
    rejectedAsUnmapped: 0,
    limitedByPerTranscript: 0,
    limitedByGlobal: 0,
    bypassedPerTranscriptLimitForCritical: 0,
    bypassedGlobalLimitForCritical: 0,
  };

  for (const transcript of transcripts) {
    const {
      actionSource,
      candidates,
      explicitCount,
      summaryFallbackUsed,
    } = getTranscriptCandidateActions(transcript);
    const transcriptAccepted = [];

    diagnostics.rawActionItemsSeen += explicitCount;
    if (summaryFallbackUsed) {
      diagnostics.summaryFallbacksUsed += 1;
      diagnostics.summaryCandidatesSeen += candidates.length;
    }

    for (const [index, actionText] of candidates.entries()) {
      const key = normalize(actionText);
      if (seen.has(key)) continue;
      seen.add(key);

      if (!hasConcreteActionShape(actionText)) {
        diagnostics.rejectedAsNoise += 1;
        continue;
      }
      if (!isRelevantToAccount(account, transcript, actionText)) {
        diagnostics.rejectedAsUnrelated += 1;
        continue;
      }
      const classifier = classifyAction(actionText, account);
      if (!classifier) {
        diagnostics.rejectedAsUnmapped += 1;
        continue;
      }

      const bypassesCap = shouldBypassActionCap(classifier);
      if (transcriptAccepted.length >= perTranscriptLimit && !bypassesCap) {
        diagnostics.limitedByPerTranscript += 1;
        continue;
      }
      if (transcriptAccepted.length >= perTranscriptLimit && bypassesCap) {
        diagnostics.bypassedPerTranscriptLimitForCritical += 1;
      }

      const item = buildGuardedAction({
        account,
        transcript,
        actionText,
        index,
        actionSource,
        scoreHistory,
      });
      if (item) {
        transcriptAccepted.push(item);
        if (accepted.length < globalMaxItems || shouldBypassActionCap(item)) {
          if (accepted.length >= globalMaxItems) {
            diagnostics.bypassedGlobalLimitForCritical += 1;
          }
          accepted.push(item);
        } else {
          diagnostics.limitedByGlobal += 1;
        }
      }
    }

    transcriptResults.push({
      transcriptId: transcript.id,
      actionSource,
      summaryFallbackUsed,
      candidateCount: candidates.length,
      acceptedCount: transcriptAccepted.length,
      actions: transcriptAccepted,
    });
  }

  return { items: accepted, diagnostics, transcriptResults };
}

export function runFirefliesActionItemAgent({ account, transcripts, maxItems = 5 }) {
  const { items, diagnostics } = runFirefliesMeetingActionAgent({
    account,
    transcripts,
    globalMaxItems: maxItems,
    maxItems,
  });
  return { items, diagnostics };
}
