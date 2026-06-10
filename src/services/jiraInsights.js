import { createServerFn } from "@tanstack/react-start";
import { recordOpenAiUsage } from "@/services/ai-usage";

const JIRA_INSIGHTS_MODEL = "gpt-5.4-mini";

function readEnv(name) {
  if (typeof process !== "undefined" && process.env?.[name]) return process.env[name];
  return undefined;
}

function extractText(doc) {
  if (!doc) return "";
  if (typeof doc === "string") return doc;
  const lines = [];
  function walk(node) {
    if (!node) return;
    if (node.type === "text") lines.push(node.text ?? "");
    if (Array.isArray(node.content)) node.content.forEach(walk);
  }
  walk(doc);
  return lines.join(" ").trim();
}

function mapPriority(jiraPriority) {
  const name = (jiraPriority?.name ?? "").toLowerCase();
  if (name === "highest" || name === "high") return "P1";
  if (name === "medium") return "P2";
  return "P3";
}

function slaHours(priority) {
  if (priority === "P1") return 48;
  if (priority === "P2") return 72;
  return 120;
}

function normalizeJiraBaseUrl(baseUrl) {
  try {
    return new URL(String(baseUrl ?? "").trim()).origin;
  } catch {
    throw new Error("JIRA_BASE_URL must be a valid Jira site URL, for example https://your-domain.atlassian.net.");
  }
}

function jiraAuth() {
  const baseUrl = readEnv("JIRA_BASE_URL");
  const email = readEnv("JIRA_EMAIL");
  const token = readEnv("JIRA_API_TOKEN");
  if (!baseUrl || !email || !token) throw new Error("Jira credentials not configured.");

  const credentials =
    typeof Buffer !== "undefined"
      ? Buffer.from(`${email}:${token}`).toString("base64")
      : btoa(`${email}:${token}`);

  return {
    baseUrl: normalizeJiraBaseUrl(baseUrl),
    headers: { Authorization: `Basic ${credentials}`, Accept: "application/json" },
  };
}

async function jiraRequest(path, options = {}) {
  const { baseUrl, headers } = jiraAuth();
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jira error ${res.status}: ${body}`);
  }

  const body = await res.text();
  try {
    return JSON.parse(body);
  } catch {
    const preview = body.trim().slice(0, 80);
    throw new Error(
      `Jira returned a non-JSON response. Check JIRA_BASE_URL in .env.local; it should be the Jira site root like ${baseUrl}. Response started with: ${preview}`,
    );
  }
}

function normalizeSpaceName(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeSpaceToken(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}

function uniqueSpaceAliases(values) {
  return [
    ...new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  ];
}

function normalizeIssueKey(issueKey) {
  const normalized = String(issueKey ?? "").trim().toUpperCase();
  if (!normalized) return "";
  if (!/^[A-Z][A-Z0-9_]*-\d+$/.test(normalized)) {
    throw new Error("Enter a valid Jira issue key.");
  }
  return normalized;
}

async function fetchJiraSpaceSearchResults(query = "") {
  const spaces = [];
  let startAt = 0;
  const maxResults = 50;

  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({
      startAt: String(startAt),
      maxResults: String(maxResults),
    });
    if (query) params.set("query", query);

    // Jira calls Spaces "projects" in the REST API.
    const json = await jiraRequest(`/rest/api/3/project/search?${params.toString()}`);
    const values = json.values ?? [];
    spaces.push(...values);

    if (json.isLast || values.length === 0) break;
    startAt += values.length;
    if (typeof json.total === "number" && startAt >= json.total) break;
  }

  return spaces;
}

function scoreJiraSpaceMatch(space, aliases) {
  const spaceName = normalizeSpaceName(space?.name);
  const spaceNameToken = normalizeSpaceToken(space?.name);
  const spaceKeyToken = normalizeSpaceToken(space?.key);

  let bestScore = 0;
  for (const alias of aliases) {
    const aliasName = normalizeSpaceName(alias);
    const aliasToken = normalizeSpaceToken(alias);
    if (!aliasName || !aliasToken) continue;

    if (spaceName === aliasName || spaceKeyToken === aliasToken) {
      bestScore = Math.max(bestScore, 100);
      continue;
    }

    if (spaceNameToken === aliasToken) {
      bestScore = Math.max(bestScore, 90);
      continue;
    }

    if (aliasName.length >= 3 && spaceName.includes(aliasName)) {
      bestScore = Math.max(bestScore, 60);
      continue;
    }

    if (aliasToken.length >= 3 && spaceNameToken.includes(aliasToken)) {
      bestScore = Math.max(bestScore, 50);
    }
  }

  return bestScore;
}

async function findJiraSpaceByAccountName(accountName, aliases = []) {
  const name = String(accountName ?? "").trim();
  if (!name) throw new Error("Select an account before importing.");

  const spaceAliases = uniqueSpaceAliases([name, ...aliases]);
  const candidateMap = new Map();

  for (const alias of spaceAliases) {
    const spaces = await fetchJiraSpaceSearchResults(alias);
    for (const space of spaces) {
      candidateMap.set(space.id ?? space.key ?? space.name, space);
    }
  }

  let candidates = [...candidateMap.values()];
  let scored = candidates
    .map((space) => ({ space, score: scoreJiraSpaceMatch(space, spaceAliases) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);
  if (scored.length > 0) return scored[0].space;

  const allSpaces = await fetchJiraSpaceSearchResults();
  if (candidateMap.size === 0 && allSpaces.length === 0) {
    throw new Error(
      "The configured Jira API user cannot see any Jira spaces. Check JIRA_EMAIL and JIRA_API_TOKEN in .env.local, and make sure that Jira user has access to this space.",
    );
  }

  candidates = allSpaces.filter((space) => !candidateMap.has(space.id ?? space.key ?? space.name));
  scored = candidates
    .map((space) => ({ space, score: scoreJiraSpaceMatch(space, spaceAliases) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  return scored[0]?.space ?? null;
}

async function fetchJiraIssueForSpace(issueKey, space) {
  const key = normalizeIssueKey(issueKey);
  const spaceKey = String(space?.key ?? "").replace(/"/g, '\\"');
  const escalationKeywordJql = 'text ~ "Escalation"';
  const jql = key
    ? `project = "${spaceKey}" AND key = "${key}" AND ${escalationKeywordJql} ORDER BY created DESC`
    : `project = "${spaceKey}" AND statusCategory != Done AND ${escalationKeywordJql} ORDER BY created DESC`;

  const json = await jiraRequest("/rest/api/3/search/jql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jql,
      fields: ["summary", "description", "priority", "status", "created", "subtasks", "project"],
      maxResults: 1,
    }),
  });

  return (json.issues ?? [])[0] ?? null;
}

function detectAccount(issueData, accounts) {
  const text = [issueData.fields?.summary ?? "", extractText(issueData.fields?.description)]
    .join(" ")
    .toLowerCase();
  for (const acc of accounts ?? []) {
    if (acc.name && text.includes(acc.name.toLowerCase())) return acc;
    if (acc.shortCode && text.includes(acc.shortCode.toLowerCase())) return acc;
  }
  return null;
}

// ── Local insight engine (no AI key required) ─────────────────────────────────

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of",
  "with", "by", "from", "is", "are", "was", "were", "be", "been", "has",
  "have", "had", "do", "does", "did", "will", "would", "could", "should",
  "may", "might", "this", "that", "these", "those", "it", "its", "we", "our",
  "they", "their", "you", "your", "i", "my", "me", "he", "she", "his", "her",
  "as", "if", "not", "no", "so", "then", "also", "all", "any", "can", "into",
  "up", "out", "about", "after", "before", "when", "where", "which", "who",
  "what", "how", "there", "some", "more", "other", "new", "per", "via", "vs",
  "being", "am", "us", "him", "them", "just", "only", "than", "over", "under",
  "during", "since", "until", "while", "within", "without", "through",
  "across", "along", "around", "between", "both", "each", "few", "many",
  "much", "own", "same", "such", "too", "very", "s", "t", "re", "ve", "ll",
  "d", "m",
]);

const TOPIC_RULES = [
  {
    match: ["api", "latency", "performance", "timeout", "downtime", "outage", "slow", "endpoint", "throughput", "503", "504", "500"],
    title: "API reliability and incident communication",
    description: "Ticket mentions API downtime or instability.",
  },
  {
    match: ["payment", "checkout", "billing", "invoice", "transaction", "charge", "refund", "order"],
    title: "Payment workflow risk and client communication",
    description: "Ticket mentions payment or checkout impact.",
  },
  {
    match: ["rca", "root cause", "post-mortem", "prevention", "retrospective", "incident report"],
    title: "Post-incident RCA best practices",
    description: "Client expects a root-cause analysis and prevention plan.",
  },
  {
    match: ["p1", "critical", "urgent", "highest", "escalation", "escalate", "sla breach", "client escalation", "escalation management", "escalated", "kam escalation"],
    title: "P1 escalation communication",
    description: "Ticket has escalation language or highest priority.",
  },
  {
    match: ["deploy", "deployment", "release", "rollback", "hotfix", "patch", "build", "pipeline"],
    title: "Release risk and rollback readiness",
    description: "Ticket references a recent backend deployment.",
  },
  {
    match: ["customer", "client", "user", "notification", "communicate", "announcement", "stakeholder"],
    title: "Customer-facing incident updates",
    description: "Support or communication updates are required.",
  },
  {
    match: ["data", "database", "sync", "migration", "integrity", "corruption", "backup"],
    title: "Data integrity and recovery communication",
    description: "Ticket involves data sync or database issues.",
  },
  {
    match: ["security", "access", "permission", "auth", "unauthorized", "breach", "vulnerability"],
    title: "Security incident response and client trust",
    description: "Ticket involves access or security concerns.",
  },
  {
    match: ["integration", "third-party", "webhook", "connector", "middleware", "sdk", "dependency"],
    title: "Third-party integration failure handling",
    description: "Ticket involves a third-party integration or dependency.",
  },
  {
    match: ["team", "resource", "capacity", "staffing", "bandwidth", "availability"],
    title: "Resource risk and team capacity planning",
    description: "Ticket highlights team availability or staffing gaps.",
  },
];

const ACTION_TEMPLATES = [
  (key) => `Create or link escalation record for ${key}.`,
  (key, account) => `Schedule ${account} escalation call within 24 hours.`,
  () => "Confirm affected services, outage windows, and customer-facing impact.",
  (key, account) => `Assign an RCA owner and draft root cause, impact, and prevention notes for ${account}.`,
  () => "Schedule a client escalation call and define an update cadence.",
  () => "Review the latest deployment, rollback options, and monitoring gaps.",
  (key, account) => `Prepare an interim customer communication update for ${account} KAM review.`,
  () => "Capture client feedback, business impact, and expected resolution timeline.",
  (key, account) => `Share final RCA and prevention plan with ${account} stakeholders.`,
  () => "Verify SLA standing and document any breach risk for this incident.",
];

const TOPIC_EXTRA_ACTIONS = {
  "payment": (key, account) => `Document impacted payment workflows and delayed confirmation cases for ${account}.`,
  "api": () => "Validate API health dashboard and confirm current status with engineering lead.",
  "deploy": () => "Confirm rollback viability and check if a hotfix deployment is in progress.",
  "security": () => "Escalate to security team and prepare a client-facing security notice.",
  "data": () => "Confirm data integrity checks are running and assess recovery options.",
  "rca": () => "Set up RCA document and share initial findings with client within 48 hours.",
};

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function extractKeywords(title, description) {
  const tokens = tokenize(`${title} ${description}`);
  const freq = {};
  for (const t of tokens) freq[t] = (freq[t] ?? 0) + 1;

  const titleTokens = new Set(tokenize(title));
  const scored = Object.entries(freq)
    .map(([word, count]) => ({ word, score: count + (titleTokens.has(word) ? 3 : 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 14)
    .map((e) => e.word);

  const phrases = (title.toLowerCase().match(/[a-z]+ [a-z]+/g) ?? [])
    .filter((p) => !p.split(" ").every((w) => STOP_WORDS.has(w)))
    .slice(0, 3);

  return [...new Set([...phrases, ...scored])].slice(0, 12);
}

function buildInsights(issueKey, title, description, accountName) {
  const text = `${title} ${description}`.toLowerCase();

  const keywords = extractKeywords(title, description);

  const matchedTopics = TOPIC_RULES.filter((rule) =>
    rule.match.some((kw) => text.includes(kw)),
  );

  const educationSuggestions = matchedTopics.slice(0, 6).map((t) => ({
    title: t.title,
    description: t.description,
    context: `Use before the ${accountName} escalation/RCA conversation.`,
    matchedKeywords: t.match.filter((kw) => text.includes(kw)).slice(0, 4),
  }));

  const baseActions = ACTION_TEMPLATES.map((fn) => fn(issueKey, accountName));
  const extraActions = Object.entries(TOPIC_EXTRA_ACTIONS)
    .filter(([kw]) => text.includes(kw))
    .map(([, fn]) => fn(issueKey, accountName));

  const actionItems = [...new Set([...baseActions, ...extraActions])].slice(0, 12);

  return { keywords, educationSuggestions, actionItems };
}

// ── OpenAI-powered insights (education suggestions + action items) ────────────

async function generateAIInsights(keywords, title, description, issueKey, accountName, accountId, user) {
  const apiKey = readEnv("OPENAI_API_KEY");
  if (!apiKey) return null;

  const prompt = `You are a KAM (Key Account Manager) assistant. Analyze this client escalation and return both education suggestions AND action items.

Issue: ${issueKey} — ${title}
Account: ${accountName}
Detected keywords: ${keywords.join(", ")}
Description: ${description.slice(0, 600)}

Return ONLY a valid JSON object — no markdown, no code fences:
{
  "educationSuggestions": [
    {
      "title": "Short education topic title",
      "description": "One sentence explaining why this is relevant to the ticket",
      "context": "Use before the ${accountName} escalation/RCA conversation.",
      "matchedKeywords": ["up to 3 keywords from the detected list"]
    }
  ],
  "actionItems": [
    "Specific KAM action item string referencing ${accountName} and ${issueKey} where relevant"
  ]
}

Requirements:
- educationSuggestions: 4–6 items, each grounded in the ticket content
- actionItems: 8–12 specific, actionable steps the KAM should take to resolve this escalation`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: JIRA_INSIGHTS_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
    }),
  });

  if (!res.ok) return null;
  const json = await res.json();
  await recordOpenAiUsage({
    feature: "Jira Escalation Insights",
    agent: "jira_escalation_insights",
    model: JIRA_INSIGHTS_MODEL,
    responseJson: json,
    accountId,
    metadata: {
      issueKey,
      keywordCount: keywords.length,
    },
    user,
  });
  const text = json.choices?.[0]?.message?.content ?? "";
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}
  return null;
}

// ── Server function ────────────────────────────────────────────────────────────

export const analyzeJiraIssue = createServerFn({ method: "POST" })
  .inputValidator((data) => data)
  .handler(async ({ data }) => {
    const { issueKey, accountId, accountName, accounts, user } = data;
    const selectedAccount =
      (accounts ?? []).find((account) => account.id === accountId) ??
      (accounts ?? []).find((account) => normalizeSpaceName(account.name) === normalizeSpaceName(accountName));
    const selectedAccountName = selectedAccount?.name ?? accountName;

    if (!selectedAccountName) throw new Error("Select an account before importing.");

    const jiraSpace = await findJiraSpaceByAccountName(selectedAccountName, [
      selectedAccount?.shortCode,
    ]);
    if (!jiraSpace) {
      throw new Error(`Space with selected account name "${selectedAccountName}" was not found in Jira.`);
    }

    const normalizedIssueKey = normalizeIssueKey(issueKey);
    const raw = await fetchJiraIssueForSpace(normalizedIssueKey, jiraSpace);
    if (!raw) {
      const issueText = normalizedIssueKey ? ` ${normalizedIssueKey}` : "";
      throw new Error(
        `No Jira task${issueText} containing keyword "Escalation" was found in space "${jiraSpace.name}".`,
      );
    }

    const resolvedIssueKey = raw.key ?? normalizedIssueKey;
    const priority = mapPriority(raw.fields?.priority);
    const statusName = raw.fields?.status?.name ?? "Unknown";
    const title = raw.fields?.summary ?? resolvedIssueKey;
    const description = extractText(raw.fields?.description);

    const detectedAccount = selectedAccount ?? detectAccount(raw, accounts);
    const resolvedAccountName = selectedAccountName || detectedAccount?.name || "the client";

    const insights = buildInsights(resolvedIssueKey, title, description, resolvedAccountName);

    // Use AI for both education suggestions and action items; fall back to rule-based
    const aiInsights = await generateAIInsights(
      insights.keywords,
      title,
      description,
      resolvedIssueKey,
      resolvedAccountName,
      selectedAccount?.id ?? detectedAccount?.id ?? null,
      user,
    );

    return {
      issue: {
        key: raw.key,
        title,
        description,
        priority,
        priorityLabel: raw.fields?.priority?.name ?? priority,
        status: statusName,
        openedAt: raw.fields?.created ?? new Date().toISOString(),
        slaRemainingHours: slaHours(priority),
        subtaskActionItems: (raw.fields?.subtasks ?? []).map((s) => ({
          label: s.fields?.summary ?? s.key,
          done: false,
        })),
      },
      detectedAccount: detectedAccount
        ? { id: detectedAccount.id, name: detectedAccount.name }
        : null,
      jiraSpace: {
        id: jiraSpace.id,
        key: jiraSpace.key,
        name: jiraSpace.name,
      },
      jiraProject: {
        id: jiraSpace.id,
        key: jiraSpace.key,
        name: jiraSpace.name,
      },
      keywords: insights.keywords,
      educationSuggestions: aiInsights?.educationSuggestions ?? insights.educationSuggestions,
      suggestedActionItems: aiInsights?.actionItems ?? insights.actionItems,
    };
  });
