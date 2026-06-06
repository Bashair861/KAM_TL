const DEFAULT_GLOBAL_OPPORTUNITY_LIMIT = 12;
const DEFAULT_PER_TRANSCRIPT_OPPORTUNITY_LIMIT = 3;
const MIN_OPPORTUNITY_TEXT_LENGTH = 12;
const MAX_OPPORTUNITY_TEXT_LENGTH = 300;

const OPPORTUNITY_SIGNAL_PATTERN =
  /\b(budget|proposal|pilot|poc|upsell|cross-sell|cross sell|expansion|expand|scope|additional|new region|new team|new module|license|licenses|seats|users|interested|evaluate|evaluating|purchase|buy|renewal|renew|retention|churn|contract extension|recovery package|commercial)\b/i;

const NOISE_PATTERN =
  /\b(fyi|for awareness|no opportunity|none|n\/a|not interested|no budget|out of scope)\b/i;

const RETENTION_SIGNAL_PATTERN =
  /\b(renewal|renew|retention|churn|contract extension|recovery package|save the account|at risk|service credit)\b/i;

const GROWTH_SIGNAL_PATTERN =
  /\b(proposal|pilot|poc|upsell|cross-sell|cross sell|expansion|expand|additional|new region|new team|new module|license|licenses|seats|users|interested|evaluate|evaluating|purchase|buy|scope)\b/i;

const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);

function normalize(value = "") {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function getEmailDomain(value = "") {
  const domain = normalizeEmail(value).split("@")[1] ?? "";
  return PUBLIC_EMAIL_DOMAINS.has(domain) ? "" : domain;
}

function toId(value = "") {
  return normalize(value).replace(/\s+/g, "-").slice(0, 80) || "opportunity";
}

function splitCandidates(raw = "") {
  return raw
    .split(/\r?\n|(?<=[.!?])\s+|;\s+|(?:^|\s)(?:\d+\.|[-*•])\s+/)
    .map((item) =>
      item
        .replace(/^[-*•\d.\s]+/, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((item) => item.length >= MIN_OPPORTUNITY_TEXT_LENGTH);
}

function getTranscriptDate(transcript) {
  if (!transcript.date) return "Recent";
  const numericDate = new Date(Number(transcript.date));
  if (!Number.isNaN(numericDate.getTime())) return numericDate.toLocaleDateString("en-US");
  const parsedDate = new Date(transcript.date);
  if (!Number.isNaN(parsedDate.getTime())) return parsedDate.toLocaleDateString("en-US");
  return String(transcript.date);
}

function getAccountKeywords(account) {
  return [
    account.name,
    account.shortCode,
    account.primaryContact?.name,
    ...(account.stakeholders ?? []).map((stakeholder) => stakeholder.name),
    ...(account.retentionGrowth ?? []).map((service) => service.service),
  ]
    .map(normalize)
    .filter((value) => value.length >= 3);
}

function getAccountEmailDomains(account) {
  return [
    account.primaryContact?.email,
    ...(account.stakeholders ?? []).map((stakeholder) => stakeholder.email),
  ]
    .map(getEmailDomain)
    .filter(Boolean);
}

function getTranscriptEmailDomains(transcript) {
  return [
    ...(transcript.participants ?? []),
    ...(transcript.attendees ?? []).map((attendee) => attendee.email),
  ]
    .map(getEmailDomain)
    .filter(Boolean);
}

function getAccountRelevance(account, transcript, text) {
  const haystack = normalize(
    [
      text,
      transcript.title,
      transcript.overview,
      transcript.shortSummary,
      ...(transcript.participants ?? []),
      ...(transcript.attendees ?? []).map((attendee) => `${attendee.name} ${attendee.email}`),
    ].join(" "),
  );
  const keywords = getAccountKeywords(account);
  const matchedDomains = getAccountEmailDomains(account).filter((domain) =>
    getTranscriptEmailDomains(transcript).includes(domain),
  );
  if (!keywords.length && !matchedDomains.length) {
    return { relevant: false, matchStrength: "none" };
  }

  const matches = keywords.filter((keyword) => haystack.includes(keyword));
  if (!matches.length && !matchedDomains.length) {
    return { relevant: false, matchStrength: "none" };
  }
  return {
    relevant: true,
    matchStrength: matches.length >= 2 || matchedDomains.length ? "strong" : "partial",
  };
}

function getMatchingService(account, text) {
  const normalizedText = normalize(text);
  return (account.retentionGrowth ?? []).find((service) =>
    normalizedText.includes(normalize(service.service)),
  );
}

function hasOpportunityShape(text) {
  if (text.length < MIN_OPPORTUNITY_TEXT_LENGTH || text.length > MAX_OPPORTUNITY_TEXT_LENGTH) {
    return false;
  }
  if (NOISE_PATTERN.test(text)) return false;
  return OPPORTUNITY_SIGNAL_PATTERN.test(text);
}

function classifyOpportunity(account, text) {
  const service = getMatchingService(account, text);
  if (RETENTION_SIGNAL_PATTERN.test(text)) return { category: "Retention", service };
  if (service || GROWTH_SIGNAL_PATTERN.test(text)) return { category: "Growth", service };
  return null;
}

function parsePotentialAmount(text) {
  const match = text.match(/(?:\$|usd\s*)?(\d+(?:[.,]\d+)?)(\s?k|\s?m|,\d{3})\b/i);
  if (!match) return null;

  const rawNumber = match[1].replace(/,/g, "");
  const base = Number(rawNumber);
  if (!Number.isFinite(base)) return null;

  const suffix = (match[2] ?? "").trim().toLowerCase();
  if (suffix === "m") return Math.round(base * 1_000_000);
  if (suffix === "k") return Math.round(base * 1_000);
  if (suffix.includes(",")) return Math.round(Number(`${match[1]}${suffix}`.replace(/,/g, "")));
  return Math.round(base);
}

function getExplicitPotential(text) {
  const explicitAmount = parsePotentialAmount(text);
  return explicitAmount && explicitAmount >= 10_000 ? explicitAmount : null;
}

function getConfidence({ text, sourceType, relevance, category }) {
  const hasBudget = /\b(budget|funded|approved|purchase|buy|commercial|\$|usd|\d+\s?[km])\b/i.test(
    text,
  );
  const hasDecisionMaker = /\b(sponsor|cto|cfo|vp|director|procurement|executive)\b/i.test(text);
  const hasNextStep =
    /\b(proposal|pilot|poc|scope|schedule|follow up|follow-up|draft|validate)\b/i.test(text);

  if (category === "Retention" && hasNextStep) return "High";
  if (sourceType === "explicit_action_items" && (hasBudget || hasDecisionMaker || hasNextStep)) {
    return "High";
  }
  if (sourceType === "summary_derived" && relevance.matchStrength === "partial") return "Low";
  return "Medium";
}

function buildNextStep(category, service, text) {
  if (/\b(proposal|pilot|poc|scope|schedule|draft|validate|follow up|follow-up)\b/i.test(text)) {
    return text;
  }
  if (category === "Retention") {
    return "Validate renewal blocker, commercial owner, and recovery package in the next sponsor touchpoint";
  }
  if (service) {
    return `Validate ${service.service} fit with sponsor and draft the next-best offer`;
  }
  return "Validate business need, budget, decision owner, and next-step proposal";
}

function getOpportunityCandidates(transcript) {
  const explicit = splitCandidates(transcript.actionItems).filter(hasOpportunityShape);
  const summary = splitCandidates(
    [transcript.overview, transcript.shortSummary].filter(Boolean).join(" "),
  ).filter(hasOpportunityShape);

  return [
    ...explicit.map((text) => ({ text, sourceType: "explicit_action_items" })),
    ...summary.map((text) => ({ text, sourceType: "summary_derived" })),
  ];
}

function buildOpportunity({ account, transcript, text, sourceType, index }) {
  const relevance = getAccountRelevance(account, transcript, text);
  if (!relevance.relevant) return null;

  const classification = classifyOpportunity(account, text);
  if (!classification) return null;

  const { category, service } = classification;
  const confidence = getConfidence({ text, sourceType, relevance, category });
  const potential = getExplicitPotential(text);
  const meetingDate = getTranscriptDate(transcript);
  const titlePrefix = category === "Retention" ? "Retention opportunity" : "Growth opportunity";
  const title = service
    ? `${titlePrefix}: ${service.service}`
    : `${titlePrefix}: ${text.slice(0, 110)}`;

  return {
    id: `fireflies-opp-${transcript.id}-${toId(title)}-${index}`,
    title,
    category,
    source:
      category === "Retention" ? "Escalation + Fireflies meeting notes" : "Fireflies meeting notes",
    signalDate: meetingDate,
    potential,
    confidence,
    nextStep: buildNextStep(category, service, text),
    sourceType,
    sourceExcerpt: text,
    service: service?.service ?? null,
    evidence: [
      {
        source: `Fireflies ${transcript.title}`,
        sourceType: "Fireflies meeting notes",
        date: meetingDate,
        excerpt: text,
        reason:
          category === "Retention"
            ? "The opportunity agent kept this as a retention opportunity because the meeting contains renewal or churn-risk language."
            : "The opportunity agent kept this as a growth opportunity because the meeting contains expansion, budget, scope, or service-fit language.",
      },
    ],
  };
}

export function runFirefliesOpportunityAgent({
  account,
  transcripts,
  globalMaxItems = DEFAULT_GLOBAL_OPPORTUNITY_LIMIT,
  perTranscriptLimit = DEFAULT_PER_TRANSCRIPT_OPPORTUNITY_LIMIT,
}) {
  const items = [];
  const seen = new Set();
  const transcriptResults = [];
  const diagnostics = {
    transcriptsScanned: transcripts.length,
    candidatesSeen: 0,
    rejectedAsDuplicate: 0,
    rejectedAsUnrelated: 0,
    rejectedAsUnclassified: 0,
    limitedByPerTranscript: 0,
    limitedByGlobal: 0,
  };

  for (const transcript of transcripts) {
    const transcriptItems = [];
    const candidates = getOpportunityCandidates(transcript);
    diagnostics.candidatesSeen += candidates.length;

    for (const [index, candidate] of candidates.entries()) {
      const key = normalize(candidate.text);
      if (seen.has(key)) {
        diagnostics.rejectedAsDuplicate += 1;
        continue;
      }
      seen.add(key);

      if (!getAccountRelevance(account, transcript, candidate.text).relevant) {
        diagnostics.rejectedAsUnrelated += 1;
        continue;
      }
      if (!classifyOpportunity(account, candidate.text)) {
        diagnostics.rejectedAsUnclassified += 1;
        continue;
      }
      if (transcriptItems.length >= perTranscriptLimit) {
        diagnostics.limitedByPerTranscript += 1;
        continue;
      }

      const opportunity = buildOpportunity({
        account,
        transcript,
        text: candidate.text,
        sourceType: candidate.sourceType,
        index,
      });

      if (opportunity) {
        transcriptItems.push(opportunity);
        if (items.length < globalMaxItems) {
          items.push(opportunity);
        } else {
          diagnostics.limitedByGlobal += 1;
        }
      }
    }

    transcriptResults.push({
      transcriptId: transcript.id,
      candidateCount: candidates.length,
      acceptedCount: transcriptItems.length,
      opportunities: transcriptItems,
    });
  }

  return { items, diagnostics, transcriptResults };
}
