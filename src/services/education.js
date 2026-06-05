import { createServerFn } from "@tanstack/react-start";

function readEnv(name) {
  if (typeof process !== "undefined" && process.env?.[name]) return process.env[name];
  return undefined;
}

export const fetchEducationArticles = createServerFn({ method: "POST" })
  .inputValidator((data) => data)
  .handler(async ({ data }) => {
    const { services = [], industry = "", accountName = "" } = data;
    const apiKey = readEnv("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY not configured in .env");

    const activeServices = services.filter((s) => s.delivered).map((s) => s.service);
    const allServices = services.map((s) => s.service);
    const serviceList = activeServices.length ? activeServices : allServices;
    const hasServices = serviceList.length > 0;

    const { type = "account" } = data;

    let prompt = "";

    if (type === "account") {
      const serviceContext = hasServices
        ? `Their active services include: ${serviceList.join(", ")}.`
        : `They operate in the ${industry} industry.`;
      const articleFocus = hasServices
        ? `Help them get more value from these services. Aim for one article per service where possible.`
        : `Find articles on trends, digital transformation, and innovation relevant to a ${industry} company.`;
      prompt = `You are helping a KAM educate their client "${accountName}" (${industry} industry).
${serviceContext}
Search the web for 6 recent articles (2024–2025) a KAM could share with this client. ${articleFocus}
Return ONLY a valid JSON array — no markdown:
[{"title":"exact title","source":"publication","url":"https://url","summary":"2 sentences","service":"related service or topic","tags":["tag1","tag2"]}]`;
    } else if (type === "modern-services") {
      prompt = `Search the web for 6 recent articles (2024–2025) about modern enterprise services and emerging technologies that businesses are adopting today. Cover areas like: AI-powered services, cloud-native platforms, edge computing, managed security, observability, developer platforms.
Return ONLY a valid JSON array — no markdown:
[{"title":"exact title","source":"publication","url":"https://url","summary":"2 sentences on what this service/tech does and why enterprises are adopting it","service":"technology area","tags":["tag1","tag2"]}]`;
    } else if (type === "approaches") {
      prompt = `Search the web for 6 recent articles (2024–2025) about modern Key Account Management approaches, customer success strategies, and enterprise relationship management. Cover: digital KAM, data-driven account planning, health scoring, executive engagement, QBR best practices, renewal playbooks.
Return ONLY a valid JSON array — no markdown:
[{"title":"exact title","source":"publication","url":"https://url","summary":"2 sentences on the approach and its impact on client retention and growth","service":"KAM area","tags":["tag1","tag2"]}]`;
    } else if (type === "best-practices") {
      prompt = `Search the web for 6 recent articles (2024–2025) about best practices in enterprise tech delivery, client communication, SLA management, escalation handling, and account health. Cover: incident communication, SLA frameworks, RCA templates, client success playbooks, service delivery excellence.
Return ONLY a valid JSON array — no markdown:
[{"title":"exact title","source":"publication","url":"https://url","summary":"2 sentences on the best practice and what problem it solves","service":"practice area","tags":["tag1","tag2"]}]`;
    }

    // Try Responses API (supports web_search_preview tool with gpt-4o)
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        tools: [{ type: "web_search_preview" }],
        input: prompt,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      // Fallback to standard chat completions without web search
      return await fetchWithChatCompletions(apiKey, prompt);
    }

    const json = await res.json();

    // Extract text and annotations from Responses API output
    let content = "";
    const urlMap = {};
    for (const output of json.output ?? []) {
      if (output.type === "message") {
        for (const block of output.content ?? []) {
          if (block.type === "output_text") {
            content = block.text ?? "";
            for (const ann of block.annotations ?? []) {
              if (ann.type === "url_citation" && ann.url) {
                const key = (ann.title ?? "").toLowerCase().trim();
                if (key) urlMap[key] = ann.url;
              }
            }
          }
        }
      }
    }

    return parseArticles(content, urlMap);
  });

function parseArticles(content, urlMap = {}) {
  let articles = [];
  try {
    const match = content.match(/\[[\s\S]*\]/);
    if (match) articles = JSON.parse(match[0]);
  } catch {
    return [];
  }
  return articles.map((a) => ({
    id: crypto.randomUUID(),
    title: a.title ?? "Untitled",
    source: a.source ?? "Unknown",
    url: urlMap[(a.title ?? "").toLowerCase().trim()] ?? a.url ?? "#",
    summary: a.summary ?? "",
    service: a.service ?? "",
    tags: Array.isArray(a.tags) ? a.tags : [],
  }));
}

async function fetchWithChatCompletions(apiKey, prompt) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`OpenAI error ${res.status}: ${err.slice(0, 300)}`);
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content ?? "";
  return parseArticles(content);
}
