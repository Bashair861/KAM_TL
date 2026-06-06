import { createServerFn } from "@tanstack/react-start";
import { fetchAccounts } from "@/services/db";

const NEWS_RESULT_LIMIT = 8;
const NEWS_PER_ACCOUNT_LIMIT = 2;

function validatePortfolioNewsInput(data) {
  const input = data && typeof data === "object" ? data : {};
  return {
    user: {
      id: String(input.user?.id ?? ""),
      role: String(input.user?.role ?? "KAM"),
    },
  };
}

function decodeXml(value) {
  return String(value ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function extractTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return decodeXml(match?.[1] ?? "");
}

function classifyNews(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  if (/(acquir|merger|buyout|takeover|purchase)/.test(text)) return "acquisition";
  if (/(cto|cio|ceo|chief|appoint|hire|joins|leadership)/.test(text)) {
    return "management_change";
  }
  if (/(funding|raises|investment|valuation|ipo|revenue|growth)/.test(text)) return "milestone";
  if (/(partner|partnership|alliance|collaboration)/.test(text)) return "partnership";
  if (/(ai|cloud|platform|software|technology|launch|product|data|cyber)/.test(text)) {
    return "technology";
  }
  return "industry_news";
}

function relativeTimeFromDate(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Recently";
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildNewsQuery(account) {
  const keywords = [
    ...(account.newsKeywords ?? []),
    account.industry,
    "technology",
    "AI",
    "cloud",
    "software",
    "acquisition",
    "partnership",
    "product launch",
  ]
    .filter(Boolean)
    .slice(0, 8);
  return `"${account.name}" (${keywords.join(" OR ")})`;
}

function parseGoogleNewsRss(xml, account) {
  const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  return itemMatches.slice(0, NEWS_PER_ACCOUNT_LIMIT).map((item, index) => {
    const title = extractTag(item, "title");
    const description = extractTag(item, "description");
    const link = extractTag(item, "link");
    const publishedAt = extractTag(item, "pubDate");
    return {
      id: `news-${account.id}-${publishedAt || index}-${title}`.replace(/\W+/g, "-").slice(0, 90),
      type: classifyNews(title, description),
      title,
      body: description || `Public news signal related to ${account.name}.`,
      accountId: account.id,
      accountName: account.name,
      time: relativeTimeFromDate(publishedAt),
      publishedAt,
      link,
      source: "Google News",
    };
  });
}

async function fetchAccountNews(account) {
  const query = buildNewsQuery(account);
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
    query,
  )}&hl=en-US&gl=US&ceid=US:en`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Aether-KAM-NewsBot/1.0",
    },
  });
  if (!response.ok) return [];
  return parseGoogleNewsRss(await response.text(), account);
}

function dedupeNews(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.accountId}-${item.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return item.title;
  });
}

export const fetchPortfolioNewsFeed = createServerFn({ method: "POST" })
  .inputValidator(validatePortfolioNewsInput)
  .handler(async ({ data }) => {
    const accounts = await fetchAccounts({ role: data.user.role, userId: data.user.id });
    const newsGroups = await Promise.all(
      accounts.slice(0, 8).map(async (account) => {
        try {
          return await fetchAccountNews(account);
        } catch (error) {
          console.error(`News lookup failed for ${account.name}`, error);
          return [];
        }
      }),
    );

    const items = dedupeNews(newsGroups.flat())
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, NEWS_RESULT_LIMIT);

    return {
      items,
      refreshedAt: new Date().toISOString(),
      source: "google-news-rss",
      message: items.length
        ? ""
        : "No public news found for visible accounts. Showing seeded portfolio news instead.",
    };
  });
