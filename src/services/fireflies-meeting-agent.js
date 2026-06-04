import { runFirefliesMeetingActionAgent } from "@/services/fireflies-action-agent";
import { runFirefliesLlmFallbackAgent } from "@/services/fireflies-llm-fallback-agent";
import { runFirefliesOpportunityAgent } from "@/services/fireflies-opportunity-agent";

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

function hasTranscriptContent(transcript) {
  return [transcript.actionItems, transcript.overview, transcript.shortSummary]
    .filter(Boolean)
    .join(" ")
    .trim().length >= 40;
}

function shouldUseLlmFallback({ transcript, actionResult, opportunityResult }) {
  if (!hasTranscriptContent(transcript)) return false;
  if (!actionResult || !opportunityResult) return true;
  if ((actionResult.acceptedCount ?? 0) === 0 && (opportunityResult.acceptedCount ?? 0) === 0) {
    return true;
  }
  return hasLowConfidence(actionResult.actions) || hasLowConfidence(opportunityResult.opportunities);
}

function mergeActionResult(baseResult, fallbackResult) {
  const actions = dedupeItems(
    [...(baseResult?.actions ?? []), ...(fallbackResult?.actions ?? [])],
    (item) => normalize(`${item.ruleId} ${item.title} ${item.sourceExcerpt}`),
  );

  return {
    ...(baseResult ?? {}),
    transcriptId: baseResult?.transcriptId ?? fallbackResult?.transcriptId,
    actions,
    acceptedCount: actions.length,
    llmAcceptedCount: fallbackResult?.actions?.length ?? 0,
    llmDiagnostics: fallbackResult?.diagnostics ?? null,
  };
}

function mergeOpportunityResult(baseResult, fallbackResult) {
  const opportunities = dedupeItems(
    [...(baseResult?.opportunities ?? []), ...(fallbackResult?.opportunities ?? [])],
    (item) => normalize(`${item.category} ${item.title}`),
  );

  return {
    ...(baseResult ?? {}),
    transcriptId: baseResult?.transcriptId ?? fallbackResult?.transcriptId,
    opportunities,
    acceptedCount: opportunities.length,
    llmAcceptedCount: fallbackResult?.opportunities?.length ?? 0,
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

  const fallbackTranscripts = transcripts.filter((transcript) =>
    shouldUseLlmFallback({
      transcript,
      actionResult: baseActionResultsByTranscript.get(transcript.id),
      opportunityResult: baseOpportunityResultsByTranscript.get(transcript.id),
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
    ),
  );
  const mergedOpportunityTranscriptResults = transcripts.map((transcript) =>
    mergeOpportunityResult(
      baseOpportunityResultsByTranscript.get(transcript.id),
      llmResultsByTranscript.get(transcript.id),
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

  return {
    items: mergedActionTranscriptResults.flatMap((result) => result.actions ?? []),
    opportunities: mergedOpportunityTranscriptResults.flatMap(
      (result) => result.opportunities ?? [],
    ),
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
