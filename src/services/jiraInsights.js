import { createServerFn } from "@tanstack/react-start";

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

async function fetchSingleJiraIssue(issueKey) {
  const baseUrl = readEnv("JIRA_BASE_URL");
  const email = readEnv("JIRA_EMAIL");
  const token = readEnv("JIRA_API_TOKEN");
  if (!baseUrl || !email || !token) throw new Error("Jira credentials not configured.");

  const credentials =
    typeof Buffer !== "undefined"
      ? Buffer.from(`${email}:${token}`).toString("base64")
      : btoa(`${email}:${token}`);

  const res = await fetch(
    `${baseUrl}/rest/api/3/issue/${issueKey}?fields=summary,description,priority,status,created,subtasks`,
    { headers: { Authorization: `Basic ${credentials}`, Accept: "application/json" } },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jira error ${res.status}: ${body}`);
  }
  return res.json();
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

// ── OpenAI-powered education suggestions ─────────────────────────────────────

async function generateAISuggestions(keywords, title, description, issueKey, accountName) {
  const apiKey = readEnv("OPENAI_API_KEY");
  if (!apiKey) return null;

  const prompt = `You are a KAM (Key Account Manager) assistant. Generate 4-6 education topic suggestions for the KAM to use when talking to the client about this escalation.

Issue: ${issueKey} — ${title}
Account: ${accountName}
Detected keywords: ${keywords.join(", ")}
Description: ${description.slice(0, 600)}

Return ONLY a valid JSON array — no markdown, no code fences:
[
  {
    "title": "Short education topic title",
    "description": "One sentence explaining why this topic is relevant to the ticket",
    "context": "Use before the ${accountName} escalation/RCA conversation.",
    "matchedKeywords": ["up to 3 keywords from the detected list that triggered this suggestion"]
  }
]`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
    }),
  });

  if (!res.ok) return null;
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content ?? "";
  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
  } catch {}
  return null;
}

// ── Server function ────────────────────────────────────────────────────────────

export const analyzeJiraIssue = createServerFn({ method: "POST" })
  .inputValidator((data) => data)
  .handler(async ({ data }) => {
    const { issueKey, accountName, accounts } = data;

    const raw = await fetchSingleJiraIssue(issueKey);
    const priority = mapPriority(raw.fields?.priority);
    const statusName = raw.fields?.status?.name ?? "Unknown";
    const title = raw.fields?.summary ?? issueKey;
    const description = extractText(raw.fields?.description);

    const detectedAccount = detectAccount(raw, accounts);
    const resolvedAccountName = accountName || detectedAccount?.name || "the client";

    const insights = buildInsights(issueKey, title, description, resolvedAccountName);

    // Use AI suggestions if available, fall back to rule-based
    const aiSuggestions = await generateAISuggestions(
      insights.keywords,
      title,
      description,
      issueKey,
      resolvedAccountName,
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
      keywords: insights.keywords,
      educationSuggestions: aiSuggestions ?? insights.educationSuggestions,
      suggestedActionItems: insights.actionItems,
    };
  });
