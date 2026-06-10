import { getEmailDomain, normalizeEmail, normalizeKeyword } from "@/services/fireflies-utils";

const FIREFLIES_GRAPHQL_URL = "https://api.fireflies.ai/graphql";
const DEFAULT_DAYS_BACK = 60;
const DEFAULT_LIMIT = 5;
const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_RETRY_DELAY_MS = 600;

const TRANSCRIPTS_QUERY = `
  query Transcripts(
    $keyword: String
    $fromDate: DateTime
    $toDate: DateTime
    $limit: Int
    $participants: [String!]
  ) {
    transcripts(
      keyword: $keyword
      fromDate: $fromDate
      toDate: $toDate
      limit: $limit
      participants: $participants
    ) {
      id
      title
      date
      transcript_url
      participants
      meeting_attendees {
        displayName
        email
        name
      }
      summary {
        action_items
        overview
        short_summary
      }
    }
  }
`;

const TRANSCRIPT_QUERY = `
  query Transcript($transcriptId: String!) {
    transcript(id: $transcriptId) {
      id
      title
      date
      transcript_url
      participants
      meeting_attendees {
        displayName
        email
        name
      }
      summary {
        action_items
        overview
        short_summary
      }
    }
  }
`;

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

function getFirefliesApiKey() {
  const key = getRuntimeEnvValue("FIREFLIES_API_KEY") ?? getRuntimeEnvValue("FIREFLIES_API_TOKEN");
  if (!key) {
    throw new Error(
      "Missing FIREFLIES_API_KEY. Add it as a server-side environment variable before running Fireflies extraction.",
    );
  }
  return key;
}

function asIsoDate(daysBack = DEFAULT_DAYS_BACK) {
  const date = new Date();
  date.setDate(date.getDate() - daysBack);
  return date.toISOString();
}

function getAccountParticipantEmails(account) {
  return (account.stakeholders ?? [])
    .map((stakeholder) => normalizeEmail(stakeholder.email ?? ""))
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    .slice(0, 10);
}

function getAccountSearchKeywords(account) {
  const domains = (account.stakeholders ?? [])
    .map((stakeholder) => getEmailDomain(stakeholder.email ?? ""))
    .filter(Boolean)
    .flatMap((domain) => [domain, domain.split(".")[0]]);

  return [account.name, account.shortCode, account.primaryContact?.name, ...domains]
    .map(normalizeKeyword)
    .filter((value) => value.length >= 3)
    .filter((value, index, list) => list.indexOf(value) === index)
    .slice(0, 4);
}

function clampLimit(limit) {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(parsed), 1), 10);
}

async function firefliesGraphql({ query, variables }) {
  let response;
  try {
    response = await fetch(FIREFLIES_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getFirefliesApiKey()}`,
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch (error) {
    error.retryable = true;
    throw error;
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(`Fireflies request failed with HTTP ${response.status}.`);
    error.status = response.status;
    error.retryable = response.status === 429 || response.status >= 500;
    throw error;
  }

  if (payload?.errors?.length) {
    const error = new Error(payload.errors.map((entry) => entry.message).join("; "));
    error.retryable = payload.errors.some((entry) =>
      /timeout|rate limit|temporarily|unavailable|internal/i.test(entry.message ?? ""),
    );
    throw error;
  }
  return payload?.data ?? {};
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function firefliesGraphqlWithRetry({ query, variables, retries = DEFAULT_RETRY_COUNT }) {
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await firefliesGraphql({ query, variables });
    } catch (error) {
      lastError = error;
      if (!error.retryable || attempt === retries) break;
      await wait(DEFAULT_RETRY_DELAY_MS * 2 ** attempt);
    }
  }

  throw lastError;
}

function normalizeTranscript(transcript) {
  return {
    id: transcript.id,
    title: transcript.title ?? "Untitled Fireflies meeting",
    date: transcript.date ?? null,
    transcriptUrl: transcript.transcript_url ?? null,
    participants: transcript.participants ?? [],
    attendees: transcript.meeting_attendees ?? [],
    actionItems: transcript.summary?.action_items ?? "",
    overview: transcript.summary?.overview ?? transcript.summary?.short_summary ?? "",
    shortSummary: transcript.summary?.short_summary ?? "",
  };
}

export async function fetchFirefliesTranscriptsForAccount(account, options = {}) {
  const participantEmails = getAccountParticipantEmails(account);
  const limit = clampLimit(options.limit);
  const daysBack = Math.min(Math.max(Number(options.daysBack ?? DEFAULT_DAYS_BACK), 1), 180);
  const retries = Number.isFinite(Number(options.retries))
    ? Math.max(0, Number(options.retries))
    : DEFAULT_RETRY_COUNT;
  const commonVariables = {
    limit,
    fromDate: asIsoDate(daysBack),
    toDate: new Date().toISOString(),
  };
  const queryInputs = [
    ...(participantEmails.length
      ? [{ participants: participantEmails, mode: "participants" }]
      : []),
    ...getAccountSearchKeywords(account).map((keyword) => ({
      keyword,
      mode: "keyword",
    })),
  ];
  const pages = [];
  let lastError = null;

  for (const input of queryInputs) {
    try {
      const data = await firefliesGraphqlWithRetry({
        query: TRANSCRIPTS_QUERY,
        variables: {
          ...commonVariables,
          participants: input.participants,
          keyword: input.keyword,
        },
        retries,
      });
      pages.push({
        mode: input.mode,
        transcripts: data.transcripts ?? [],
      });
    } catch (error) {
      lastError = error;
    }
  }

  if (!pages.length && lastError) throw lastError;

  const dedupedTranscripts = [
    ...new Map(
      pages.flatMap((page) => page.transcripts).map((transcript) => [transcript.id, transcript]),
    ).values(),
  ].slice(0, limit);

  return {
    transcripts: dedupedTranscripts.map(normalizeTranscript),
    query: {
      limit,
      daysBack,
      mode:
        participantEmails.length && pages.some((page) => page.mode === "keyword")
          ? "participants_plus_keyword"
          : participantEmails.length
            ? "participants"
            : "keyword",
      participantCount: participantEmails.length,
      keywordCount: getAccountSearchKeywords(account).length,
    },
  };
}

export async function fetchFirefliesTranscriptById(transcriptId) {
  if (!transcriptId || typeof transcriptId !== "string") {
    throw new Error("Fireflies transcript id is required.");
  }

  const data = await firefliesGraphqlWithRetry({
    query: TRANSCRIPT_QUERY,
    variables: { transcriptId },
  });

  if (!data.transcript) {
    throw new Error("Fireflies transcript was not found or is not accessible.");
  }

  return normalizeTranscript(data.transcript);
}
