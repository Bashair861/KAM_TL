import { runFirefliesMeetingActionAgent } from "@/services/fireflies-action-agent";
import { runFirefliesLlmFallbackAgent } from "@/services/fireflies-llm-fallback-agent";
import { runFirefliesOpportunityAgent } from "@/services/fireflies-opportunity-agent";

const ACTION_CAP_BYPASS_RULE_IDS = new Set(["ESC-01"]);

function normalizeMeetingDate(value) {
  if (!value) return null;
  const numericDate = new Date(Number(value));
  if (!Number.isNaN(numericDate.getTime())) return numericDate.toISOString();
  const parsedDate = new Date(value);
  if (!Number.isNaN(parsedDate.getTime())) return parsedDate.toISOString();
  return null;
}

function indexTranscriptResults(results = []) {
  return new Map(results.map((result) => [result.transcriptId, result]));
}

function normalize(value = "") {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function dedupeItems(items, getKey) {
  const seen = new Set();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasLowConfidence(items = []) {
  return items.some((item) => item.confidence === "Low");
}

function normalizeLimit(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Infinity;
}

function hasRemainingCapacity(items = [], limit = Infinity, canBypass = () => false) {
  if (!Number.isFinite(limit)) return false;
  return items.filter((item) => !canBypass(item)).length < limit;
}

function canBypassActionCap(item) {
  return ACTION_CAP_BYPASS_RULE_IDS.has(item?.ruleId);
}

function limitItems(items, limit = Infinity, canBypass = () => false) {
  if (!Number.isFinite(limit)) return items;
  const kept = [];
  let counted = 0;

  for (const item of items) {
    if (canBypass(item)) {
      kept.push(item);
      continue;
    }
    if (counted >= limit) continue;
    kept.push(item);
    counted += 1;
  }

  return kept;
}

function hasTranscriptContent(transcript) {
  return (
    [transcript.actionItems, transcript.overview, transcript.shortSummary]
      .filter(Boolean)
      .join(" ")
      .trim().length >= 40
  );
}

function shouldUseLlmFallback({
  transcript,
  actionResult,
  opportunityResult,
  actionPerTranscriptLimit,
  opportunityPerTranscriptLimit,
}) {
  if (!hasTranscriptContent(transcript)) return false;
  if (!actionResult || !opportunityResult) return true;
  if ((actionResult.acceptedCount ?? 0) === 0 && (opportunityResult.acceptedCount ?? 0) === 0) {
    return true;
  }
  if (hasLowConfidence(actionResult.actions) || hasLowConfidence(opportunityResult.opportunities)) {
    return true;
  }
  return (
    hasRemainingCapacity(actionResult.actions, actionPerTranscriptLimit, canBypassActionCap) ||
    hasRemainingCapacity(opportunityResult.opportunities, opportunityPerTranscriptLimit)
  );
}

function mergeActionResult(baseResult, fallbackResult, { perTranscriptLimit = Infinity } = {}) {
  const actions = dedupeItems(
    [...(baseResult?.actions ?? []), ...(fallbackResult?.actions ?? [])],
    (item) => normalize(`${item.ruleId} ${item.title} ${item.sourceExcerpt}`),
  );
  const cappedActions = limitItems(actions, perTranscriptLimit, canBypassActionCap);

  return {
    ...(baseResult ?? {}),
    transcriptId: baseResult?.transcriptId ?? fallbackResult?.transcriptId,
    actions: cappedActions,
    acceptedCount: cappedActions.length,
    llmAcceptedCount: fallbackResult?.actions?.length ?? 0,
    llmLimitedByRemainingCap: Math.max(actions.length - cappedActions.length, 0),
    llmDiagnostics: fallbackResult?.diagnostics ?? null,
  };
}

function mergeOpportunityResult(
  baseResult,
  fallbackResult,
  { perTranscriptLimit = Infinity } = {},
) {
  const opportunities = dedupeItems(
    [...(baseResult?.opportunities ?? []), ...(fallbackResult?.opportunities ?? [])],
    (item) => normalize(`${item.category} ${item.title}`),
  );
  const cappedOpportunities = limitItems(opportunities, perTranscriptLimit);

  return {
    ...(baseResult ?? {}),
    transcriptId: baseResult?.transcriptId ?? fallbackResult?.transcriptId,
    opportunities: cappedOpportunities,
    acceptedCount: cappedOpportunities.length,
    llmAcceptedCount: fallbackResult?.opportunities?.length ?? 0,
    llmLimitedByRemainingCap: Math.max(opportunities.length - cappedOpportunities.length, 0),
    llmDiagnostics: fallbackResult?.diagnostics ?? null,
  };
}

function buildMeetingSummaryObject({ transcript, actionResult, opportunityResult, query }) {
  const actions = actionResult?.actions ?? [];
  const opportunities = opportunityResult?.opportunities ?? [];
  return {
    transcriptId: transcript.id,
    title: transcript.title,
    meetingDate: normalizeMeetingDate(transcript.date),
    transcriptUrl: transcript.transcriptUrl,
    participants: transcript.participants ?? [],
    attendees: transcript.attendees ?? [],
    overview: transcript.overview ?? "",
    shortSummary: transcript.shortSummary ?? "",
    actionItems: transcript.actionItems ?? "",
    summary: {
      overview: transcript.overview ?? "",
      shortSummary: transcript.shortSummary ?? "",
      actionItems: transcript.actionItems ?? "",
    },
    derivedActionItems: actions,
    derivedOpportunities: opportunities,
    agentDiagnostics: {
      actionSource: actionResult?.actionSource ?? "none",
      summaryFallbackUsed: Boolean(actionResult?.summaryFallbackUsed),
      candidateCount: actionResult?.candidateCount ?? 0,
      acceptedCount: actionResult?.acceptedCount ?? 0,
      action: {
        actionSource: actionResult?.actionSource ?? "none",
        summaryFallbackUsed: Boolean(actionResult?.summaryFallbackUsed),
        candidateCount: actionResult?.candidateCount ?? 0,
        acceptedCount: actionResult?.acceptedCount ?? 0,
      },
      opportunity: {
        candidateCount: opportunityResult?.candidateCount ?? 0,
        acceptedCount: opportunityResult?.acceptedCount ?? 0,
      },
      llm: {
        actionAcceptedCount: actionResult?.llmAcceptedCount ?? 0,
        opportunityAcceptedCount: opportunityResult?.llmAcceptedCount ?? 0,
        diagnostics: actionResult?.llmDiagnostics ?? opportunityResult?.llmDiagnostics ?? null,
      },
    },
    sourceQuery: query ?? {},
  };
}

export async function runFirefliesMeetingAgent({
  account,
  transcripts,
  query,
  scoreHistory = [],
  maxItems = 5,
  globalMaxItems,
  perTranscriptLimit,
  opportunityGlobalMaxItems,
  opportunityPerTranscriptLimit,
}) {
  const actionResult = runFirefliesMeetingActionAgent({
    account,
    transcripts,
    scoreHistory,
    maxItems,
    globalMaxItems,
    perTranscriptLimit,
  });
  const opportunityResult = runFirefliesOpportunityAgent({
    account,
    transcripts,
    globalMaxItems: opportunityGlobalMaxItems,
    perTranscriptLimit: opportunityPerTranscriptLimit,
  });
  const baseActionResultsByTranscript = indexTranscriptResults(actionResult.transcriptResults);
  const baseOpportunityResultsByTranscript = indexTranscriptResults(
    opportunityResult.transcriptResults,
  );
  const actionPerTranscriptLimit = normalizeLimit(perTranscriptLimit);
  const opportunityTranscriptLimit = normalizeLimit(opportunityPerTranscriptLimit);

  const fallbackTranscripts = transcripts.filter((transcript) =>
    shouldUseLlmFallback({
      transcript,
      actionResult: baseActionResultsByTranscript.get(transcript.id),
      opportunityResult: baseOpportunityResultsByTranscript.get(transcript.id),
      actionPerTranscriptLimit,
      opportunityPerTranscriptLimit: opportunityTranscriptLimit,
    }),
  );
  const llmResult = await runFirefliesLlmFallbackAgent({
    account,
    transcripts: fallbackTranscripts,
  });
  const llmResultsByTranscript = indexTranscriptResults(llmResult.transcriptResults);

  const mergedActionTranscriptResults = transcripts.map((transcript) =>
    mergeActionResult(
      baseActionResultsByTranscript.get(transcript.id),
      llmResultsByTranscript.get(transcript.id),
      { perTranscriptLimit: actionPerTranscriptLimit },
    ),
  );
  const mergedOpportunityTranscriptResults = transcripts.map((transcript) =>
    mergeOpportunityResult(
      baseOpportunityResultsByTranscript.get(transcript.id),
      llmResultsByTranscript.get(transcript.id),
      { perTranscriptLimit: opportunityTranscriptLimit },
    ),
  );
  const actionResultsByTranscript = indexTranscriptResults(mergedActionTranscriptResults);
  const opportunityResultsByTranscript = indexTranscriptResults(mergedOpportunityTranscriptResults);

  const meetings = transcripts.map((transcript) =>
    buildMeetingSummaryObject({
      transcript,
      actionResult: actionResultsByTranscript.get(transcript.id),
      opportunityResult: opportunityResultsByTranscript.get(transcript.id),
      query,
    }),
  );

  const mergedActions = mergedActionTranscriptResults.flatMap((result) => result.actions ?? []);
  const mergedOpportunities = mergedOpportunityTranscriptResults.flatMap(
    (result) => result.opportunities ?? [],
  );

  return {
    items: limitItems(mergedActions, normalizeLimit(globalMaxItems), canBypassActionCap),
    opportunities: limitItems(mergedOpportunities, normalizeLimit(opportunityGlobalMaxItems)),
    diagnostics: {
      actions: actionResult.diagnostics,
      opportunities: opportunityResult.diagnostics,
      llmFallback: llmResult.diagnostics,
    },
    transcriptResults: mergedActionTranscriptResults,
    opportunityTranscriptResults: mergedOpportunityTranscriptResults,
    meetings,
  };
}
