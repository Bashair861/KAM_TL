import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import {
  getEmailDomain,
  getTranscriptEmailDomains,
  getTranscriptEmails,
  normalizeEmail,
  normalizeSearchText as normalize,
} from "@/services/fireflies-utils";

const DEFAULT_SYNC_LIMIT = 5;
const DEFAULT_SYNC_DAYS_BACK = 60;

function validateInput(input = {}) {
  if (!input || typeof input !== "object") {
    throw new Error("Fireflies extraction requires an account id.");
  }
  if (!input.accountId || typeof input.accountId !== "string") {
    throw new Error("Fireflies extraction requires a valid account id.");
  }

  return {
    accountId: input.accountId,
    limit: Math.min(Math.max(Number(input.limit ?? DEFAULT_SYNC_LIMIT), 1), 10),
    daysBack: Math.min(Math.max(Number(input.daysBack ?? DEFAULT_SYNC_DAYS_BACK), 1), 180),
    actorAccessToken:
      typeof input.actorAccessToken === "string" ? input.actorAccessToken.trim() : "",
  };
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

function createActorSupabaseClient(accessToken) {
  const url = getRuntimeEnvValue("VITE_SUPABASE_URL");
  const anonKey = getRuntimeEnvValue("VITE_SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    throw new Error("Supabase environment is not configured for Fireflies authorization.");
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

async function fetchActorProfile(actorClient, user) {
  const { data: byId, error: byIdError } = await actorClient
    .from("profiles")
    .select("id, name, role, email")
    .eq("id", user.id)
    .maybeSingle();
  if (byIdError) throw byIdError;
  if (byId) return byId;

  if (!user.email) return null;

  const { data: byEmail, error: byEmailError } = await actorClient
    .from("profiles")
    .select("id, name, role, email")
    .eq("email", user.email)
    .maybeSingle();
  if (byEmailError) throw byEmailError;
  return byEmail;
}

async function assertCanRunManualFirefliesSync({ accountId, actorAccessToken }) {
  if (!actorAccessToken) {
    throw new Error("Please sign in before running Fireflies extraction.");
  }

  const actorClient = createActorSupabaseClient(actorAccessToken);
  const {
    data: { user },
    error: userError,
  } = await actorClient.auth.getUser(actorAccessToken);

  if (userError || !user) {
    throw new Error("Your session could not be verified for Fireflies extraction.");
  }

  const profile = await fetchActorProfile(actorClient, user);
  if (!profile) {
    throw new Error("No KAM profile is linked to the signed-in user.");
  }

  if (profile.role === "CEO") {
    throw new Error("CEO can view Fireflies meeting history but cannot run extraction.");
  }

  if (profile.role === "Head of KAM") {
    return profile;
  }

  if (profile.role !== "KAM") {
    throw new Error("Only Head of KAM or the assigned KAM can run Fireflies extraction.");
  }

  const { data: account, error: accountError } = await actorClient
    .from("accounts")
    .select("id, assigned_kam_id")
    .eq("id", accountId)
    .maybeSingle();
  if (accountError) throw accountError;

  if (!account || account.assigned_kam_id !== profile.id) {
    throw new Error("Only the assigned KAM can run Fireflies extraction for this account.");
  }

  return profile;
}

function getTranscriptSearchText(transcript) {
  return normalize(
    [
      transcript.title,
      transcript.overview,
      transcript.shortSummary,
      transcript.actionItems,
      ...(transcript.participants ?? []),
      ...(transcript.attendees ?? []).map((attendee) =>
        [attendee.name, attendee.displayName, attendee.email].filter(Boolean).join(" "),
      ),
    ].join(" "),
  );
}

function getWebhookEventType(payload = {}) {
  return (
    payload.event ?? payload.event_type ?? payload.eventType ?? payload.type ?? "meeting_ready"
  );
}

function buildWebhookPayloadSummary(payload = {}, transcriptId) {
  return {
    event: getWebhookEventType(payload),
    transcriptId:
      payload.transcript_id ??
      payload.transcriptId ??
      payload.fireflies_transcript_id ??
      transcriptId ??
      null,
    payloadKeys: Object.keys(payload).slice(0, 20),
  };
}

function scoreAccountTranscriptMatch(account, transcript) {
  const transcriptEmails = new Set(getTranscriptEmails(transcript));
  const transcriptDomains = new Set(getTranscriptEmailDomains(transcript));
  const transcriptText = getTranscriptSearchText(transcript);
  let score = 0;

  for (const stakeholder of account.stakeholders ?? []) {
    const email = normalizeEmail(stakeholder.email ?? "");
    if (email && transcriptEmails.has(email)) score += 100;
    const domain = getEmailDomain(email);
    if (domain && transcriptDomains.has(domain)) score += 45;
    const name = normalize(stakeholder.name ?? "");
    if (name.length >= 4 && transcriptText.includes(name)) score += 20;
  }

  const accountName = normalize(account.name ?? "");
  if (accountName.length >= 4 && transcriptText.includes(accountName)) score += 80;

  const shortCode = normalize(account.shortCode ?? "");
  if (shortCode.length >= 2 && transcriptText.includes(shortCode)) score += 30;

  const primaryContactName = normalize(account.primaryContact?.name ?? "");
  if (primaryContactName.length >= 4 && transcriptText.includes(primaryContactName)) score += 20;

  return score;
}

async function findAccountForFirefliesTranscript(transcript, { fetchAccounts, fetchAccount }) {
  const accounts = await fetchAccounts();
  const detailedAccounts = await Promise.all(
    accounts.map((account) => fetchAccount(account.id).catch(() => null)),
  );
  const scoredMatches = detailedAccounts
    .filter(Boolean)
    .map((account) => ({
      account,
      score: scoreAccountTranscriptMatch(account, transcript),
    }))
    .sort((left, right) => right.score - left.score);
  const bestMatch = scoredMatches[0];

  if (!bestMatch || bestMatch.score <= 0) {
    const error = new Error("No matching account was found for this Fireflies meeting.");
    error.statusCode = 202;
    error.matchDiagnostics = {
      transcriptTitle: transcript.title ?? "",
      transcriptEmailDomains: getTranscriptEmailDomains(transcript),
      transcriptEmailsSeen: getTranscriptEmails(transcript).slice(0, 10),
      topCandidates: scoredMatches.slice(0, 5).map(({ account, score }) => ({
        accountId: account.id,
        accountName: account.name,
        score,
      })),
    };
    throw error;
  }

  return bestMatch.account;
}

function buildSavedMeetingFallback({ account, data, error, savedMeetings }) {
  return {
    failed: true,
    error,
    transcripts: [],
    query: {
      limit: data.limit,
      daysBack: data.daysBack,
      mode: "fallback_saved_meetings",
      participantCount: account.stakeholders?.length ?? 0,
      requestedBy: "system_or_authorized_user",
    },
    savedMeetings,
    fallbackItems: savedMeetings.flatMap((meeting) => meeting.derivedActionItems ?? []),
    fallbackOpportunities: savedMeetings.flatMap((meeting) => meeting.derivedOpportunities ?? []),
  };
}

export async function syncFirefliesForAccount({
  accountId,
  limit = DEFAULT_SYNC_LIMIT,
  daysBack = DEFAULT_SYNC_DAYS_BACK,
  actorAccessToken = "",
  systemSync = false,
  queryOverride = null,
  transcriptsOverride = null,
}) {
  const data = validateInput({ accountId, limit, daysBack });
  const actorProfile = systemSync
    ? null
    : await assertCanRunManualFirefliesSync({
        accountId: data.accountId,
        actorAccessToken,
      });
  const [
    {
      fetchAccount,
      fetchActivityScoreHistory,
      fetchFirefliesMeetingSummaries,
      upsertFirefliesMeetingSummaries,
      createActivityRuleActivitiesFromMeetingActions,
      upsertOpportunitiesFromMeetingAgent,
      refreshAccountRetentionGrowthScoring,
    },
    { fetchFirefliesTranscriptsForAccount },
    { runFirefliesMeetingAgent },
  ] = await Promise.all([
    import("@/services/db"),
    import("@/services/fireflies-client"),
    import("@/services/fireflies-meeting-agent"),
  ]);

  const account = await fetchAccount(data.accountId);
  if (!account) {
    throw new Error("Account not found for Fireflies extraction.");
  }

  const scoreHistoryPromise = fetchActivityScoreHistory(account.id).catch(() => []);
  const firefliesResult = transcriptsOverride
    ? {
        transcripts: transcriptsOverride,
        query: queryOverride ?? {
          limit: transcriptsOverride.length,
          daysBack: null,
          mode: "webhook_transcript",
          participantCount: account.stakeholders?.length ?? 0,
          requestedBy: actorProfile?.id ?? "system",
        },
      }
    : await fetchFirefliesTranscriptsForAccount(account, {
        limit: data.limit,
        daysBack: data.daysBack,
      }).catch(async (error) => {
        const savedMeetings = await fetchFirefliesMeetingSummaries(account.id).catch(() => []);
        return buildSavedMeetingFallback({ account, data, error, savedMeetings });
      });

  const scoreHistory = await scoreHistoryPromise;

  if (firefliesResult.failed) {
    return {
      items: firefliesResult.fallbackItems,
      opportunities: firefliesResult.fallbackOpportunities,
      savedMeetings: firefliesResult.savedMeetings,
      savedActivities: [],
      savedOpportunities: [],
      query: firefliesResult.query,
      diagnostics: {
        fallback: true,
        reason: firefliesResult.error?.message ?? "Fireflies request failed.",
        savedMeetingsReturned: firefliesResult.savedMeetings.length,
      },
      status: `Fireflies is unavailable, so no new sync was run. Showing ${firefliesResult.savedMeetings.length} previously saved meeting summar${firefliesResult.savedMeetings.length === 1 ? "y" : "ies"} instead.`,
    };
  }

  const { transcripts, query } = firefliesResult;
  const result = await runFirefliesMeetingAgent({
    account,
    transcripts,
    query,
    scoreHistory,
    maxItems: data.limit,
    globalMaxItems: Math.max(data.limit * 3, 15),
    perTranscriptLimit: 3,
    opportunityGlobalMaxItems: Math.max(data.limit * 2, 12),
    opportunityPerTranscriptLimit: 3,
    user: {
      id: actorProfile?.id,
      name: actorProfile?.name,
      role: actorProfile?.role,
    },
  });
  const allActions = result.items;
  const allOpportunities = result.opportunities;
  const editedBy = actorProfile?.name ?? "System";
  const savedMeetings = await upsertFirefliesMeetingSummaries(
    account.id,
    result.meetings,
    editedBy,
  );
  const savedActivities = await createActivityRuleActivitiesFromMeetingActions({
    accountId: account.id,
    actions: allActions,
    editedBy,
  });
  const savedOpportunities = await upsertOpportunitiesFromMeetingAgent({
    accountId: account.id,
    opportunities: allOpportunities,
    editedBy,
  });
  const retentionGrowthScoring = await refreshAccountRetentionGrowthScoring(account.id, editedBy).catch(
    (error) => ({
      failed: true,
      error: error?.message ?? "Retention/growth scoring failed after Fireflies sync.",
    }),
  );

  return {
    ...result,
    accountId: account.id,
    accountName: account.name,
    requestedBy: actorProfile?.id ?? "system",
    items: allActions,
    opportunities: allOpportunities,
    savedMeetings,
    savedActivities,
    savedOpportunities,
    retentionGrowthScoring,
    query,
    status:
      allActions.length > 0 || allOpportunities.length > 0
        ? `Synced ${savedMeetings.length} meeting summar${savedMeetings.length === 1 ? "y" : "ies"}, saved ${savedActivities.length} activity item${savedActivities.length === 1 ? "" : "s"}, and saved ${savedOpportunities.length} opportunit${savedOpportunities.length === 1 ? "y" : "ies"}.`
        : `Synced ${savedMeetings.length} meeting summar${savedMeetings.length === 1 ? "y" : "ies"}; no required actions or opportunities passed the guardrails.`,
  };
}

export async function syncFirefliesTranscriptForAccount({ accountId, transcript, query = {} }) {
  if (!transcript?.id) {
    throw new Error("Fireflies transcript sync requires a transcript id.");
  }

  return syncFirefliesForAccount({
    accountId,
    limit: 1,
    daysBack: DEFAULT_SYNC_DAYS_BACK,
    systemSync: true,
    transcriptsOverride: [transcript],
    queryOverride: {
      mode: "webhook_transcript",
      transcriptId: transcript.id,
      ...query,
    },
  });
}

export async function syncFirefliesWebhookMeeting({ transcriptId, payload = {} }) {
  const [
    { fetchAccounts, fetchAccount, logFirefliesWebhookEvent },
    { fetchFirefliesTranscriptById },
  ] = await Promise.all([import("@/services/db"), import("@/services/fireflies-client")]);
  const webhookEvent = getWebhookEventType(payload);
  const payloadSummary = buildWebhookPayloadSummary(payload, transcriptId);

  const transcript = await fetchFirefliesTranscriptById(transcriptId);
  let account;
  try {
    account = await findAccountForFirefliesTranscript(transcript, {
      fetchAccounts,
      fetchAccount,
    });
  } catch (error) {
    if (error.statusCode === 202) {
      await logFirefliesWebhookEvent({
        transcriptId,
        eventType: webhookEvent,
        status: "unmatched",
        title: transcript.title,
        payload: payloadSummary,
        diagnostics: error.matchDiagnostics ?? {},
        errorMessage: error.message,
      }).catch((logError) => {
        console.warn(
          `Failed to log unmatched Fireflies transcript ${transcriptId}: ${logError.message}`,
        );
      });
    }
    throw error;
  }

  return syncFirefliesTranscriptForAccount({
    accountId: account.id,
    transcript,
    query: {
      source: "fireflies_webhook",
      webhookEvent,
    },
  });
}

export async function syncFirefliesRecentForAllAccounts({
  limit = DEFAULT_SYNC_LIMIT,
  daysBack = DEFAULT_SYNC_DAYS_BACK,
} = {}) {
  const { fetchAccounts } = await import("@/services/db");
  const accounts = await fetchAccounts();
  const results = [];

  for (const account of accounts) {
    try {
      results.push({
        accountId: account.id,
        ok: true,
        result: await syncFirefliesForAccount({
          accountId: account.id,
          limit,
          daysBack,
          systemSync: true,
        }),
      });
    } catch (error) {
      results.push({
        accountId: account.id,
        ok: false,
        error: error?.message ?? "Fireflies account sync failed.",
      });
    }
  }

  return {
    accountsScanned: accounts.length,
    results,
  };
}

export const fetchFirefliesRequiredActionItems = createServerFn({ method: "POST" })
  .inputValidator(validateInput)
  .handler(async ({ data }) => syncFirefliesForAccount(data));
