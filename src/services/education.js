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

    const serviceContext = hasServices
      ? `Their active services include: ${serviceList.join(", ")}.`
      : `They operate in the ${industry} industry.`;

    const articleFocus = hasServices
      ? `Help them get more value from these services. Aim for one article per service where possible.`
      : `Find articles on industry trends, best practices, and digital transformation relevant to a ${industry} company.`;

    const serviceField = hasServices
      ? `"service": "Which service from the list this article relates to",`
      : `"service": "Relevant topic or area",`;

    const prompt = `You are helping a Key Account Manager educate their client "${accountName}" in the ${industry} industry.

${serviceContext}

Search the web and find 6 high-quality, recent articles (2024–2025) that a KAM could share with this client. ${articleFocus}

Return ONLY a valid JSON array — no markdown, no code fences:
[
  {
    "title": "Exact article title from the web",
    "source": "Publication or website name",
    "url": "https://actual-article-url",
    "summary": "2 sentences explaining what this article covers and why it matters to a ${industry} business",
    ${serviceField}
    "tags": ["2 to 3 short relevant tags"]
  }
]`;

    // Try Responses API (supports web_search_preview tool with gpt-4o)
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
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
      model: "gpt-4o",
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
