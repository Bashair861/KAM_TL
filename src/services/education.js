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

    if (!serviceList.length) throw new Error("No services found for this account.");

    const prompt = `You are helping a Key Account Manager educate their client "${accountName}" in the ${industry} industry.

Their active services include: ${serviceList.join(", ")}.

Search the web and find 6 high-quality, recent articles (2024–2025) that a KAM could share with this client to help them get more value from these services. Aim for one article per service where possible.

Return ONLY a valid JSON array — no markdown, no code fences:
[
  {
    "title": "Exact article title from the web",
    "source": "Publication or website name",
    "url": "https://actual-article-url",
    "summary": "2 sentences explaining what this article covers and why it matters to a ${industry} business using ${serviceList[0] ?? "this service"}",
    "service": "Which service from the list this article relates to",
    "tags": ["2 to 3 short relevant tags"]
  }
]`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-search-preview",
        web_search_options: { search_context_size: "medium" },
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`OpenAI error ${res.status}: ${err.slice(0, 300)}`);
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "";

    // Build a URL map from web search annotations (real cited URLs)
    const annotations = json.choices?.[0]?.message?.annotations ?? [];
    const urlMap = {};
    for (const ann of annotations) {
      if (ann.type === "url_citation" && ann.url_citation?.url) {
        const key = (ann.url_citation.title ?? "").toLowerCase().trim();
        if (key) urlMap[key] = ann.url_citation.url;
      }
    }

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
  });
