import { createServerFn } from "@tanstack/react-start";
import { recordOpenAiUsage } from "@/services/ai-usage";

const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";
const OPENAI_FALLBACK_MODELS = ["gpt-5.4-mini", "gpt-4o-mini", "gpt-4.1-mini"];

function readEnv(name) {
  if (typeof process !== "undefined" && process.env?.[name]) return process.env[name];
  return undefined;
}

function validateInput(input) {
  if (!input || typeof input !== "object") throw new Error("Invalid website summary payload.");
  const accountId = String(input.accountId ?? "").trim();
  const accessToken = String(input.accessToken ?? "");
  if (!accountId) throw new Error("Account ID is required before generating a website summary.");
  if (!accessToken) throw new Error("Please sign in again before generating a website summary.");
  return { accountId, accessToken, user: input.user ?? {} };
}

function isMissingColumnError(error, column) {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    message.includes(column.toLowerCase())
  );
}

async function createSupabaseClients(accessToken) {
  const supabaseUrl = readEnv("VITE_SUPABASE_URL");
  const supabaseAnonKey = readEnv("VITE_SUPABASE_ANON_KEY");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw new Error("Supabase environment variables are required before generating a website summary.");
  }

  const { createClient } = await import("@supabase/supabase-js");
  const requester = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await requester.auth.getUser(accessToken);
  if (error || !data?.user) {
    throw new Error("Please sign in again before generating a website summary.");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { admin };
}

function normalizeSummary(text) {
  const paragraphs = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3);
  return paragraphs.join("\n\n").trim();
}

function buildPrompt(account) {
  return [
    "You are an account intelligence assistant for an enterprise Key Account Manager.",
    "Use the supplied company website URL and public web search to create a concise account brief.",
    "Write exactly 2 to 3 short paragraphs, no bullet points, no markdown headings.",
    "Focus on these metrics: new job postings, company major activities, competitor information, and CEO status or communication updates.",
    "Prioritize evidence from the company website, careers pages, newsroom/blog pages, leadership pages, and reliable public web sources.",
    "If a metric has no reliable public signal, say that there is no clear public signal instead of inventing details.",
    "When source URLs are useful, include at most one concise URL per paragraph.",
    "Never repeat the same URL in the answer, and do not cite OpenAI, model, or provider URLs as sources.",
    "",
    `Account name: ${account.name}`,
    `Industry: ${account.industry ?? "Unknown"}`,
    `Region: ${account.region ?? "Unknown"}`,
    `Known competitors: ${(account.competitors ?? []).join(", ") || "Unknown"}`,
    `Company website URL: ${account.website_url}`,
  ].join("\n");
}

function extractOpenAIText(responseJson) {
  if (typeof responseJson?.output_text === "string") return responseJson.output_text.trim();
  const parts = [];
  for (const item of responseJson?.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content?.text === "string") parts.push(content.text);
    }
  }
  return parts.join("").trim();
}

function openAIModelCandidates() {
  return [readEnv("OPENAI_MODEL"), DEFAULT_OPENAI_MODEL, ...OPENAI_FALLBACK_MODELS]
    .filter(Boolean)
    .filter((model, index, models) => models.indexOf(model) === index);
}

function isOpenAIModelAccessError(status, body) {
  const text = String(body ?? "").toLowerCase();
  return (
    (status === 403 || status === 404) &&
    (text.includes("model_not_found") || text.includes("does not have access to model"))
  );
}

async function requestOpenAISummary(apiKey, model, account) {
  return fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      tools: [{ type: "web_search" }],
      tool_choice: "auto",
      input: buildPrompt(account),
      max_output_tokens: 900,
    }),
  });
}

async function generateWithOpenAI(account, user = {}) {
  const apiKey = readEnv("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing. Add it before generating a website summary.");
  }

  const attempted = [];
  for (const model of openAIModelCandidates()) {
    const response = await requestOpenAISummary(apiKey, model, account);
    if (response.ok) {
      const json = await response.json();
      await recordOpenAiUsage({
        feature: "Website Summary",
        agent: "account_website_summary",
        model,
        responseJson: json,
        accountId: account.id,
        metadata: {
          accountName: account.name,
        },
        toolCalls: [{ type: "web_search", count: 1 }],
        user,
      });
      const summary = normalizeSummary(extractOpenAIText(json));
      if (!summary) throw new Error("OpenAI returned an empty website summary.");
      return summary;
    }

    const body = await response.text();
    attempted.push(`${model} (${response.status})`);
    if (isOpenAIModelAccessError(response.status, body)) continue;
    throw new Error(`OpenAI website summary generation failed (${response.status}): ${body}`);
  }

  throw new Error(
    `OpenAI website summary generation failed because none of the configured models were available. Tried: ${attempted.join(", ")}.`,
  );
}

export const generateWebsiteSummaryServer = createServerFn({ method: "POST" })
  .inputValidator(validateInput)
  .handler(async ({ data }) => {
    const { admin } = await createSupabaseClients(data.accessToken);
    const { data: account, error: accountError } = await admin
      .from("accounts")
      .select("id, name, industry, region, competitors, website_url")
      .eq("id", data.accountId)
      .single();
    if (accountError) {
      if (isMissingColumnError(accountError, "website_url")) {
        throw new Error(
          "Database field website_url is missing. Run src/db/add-account-website-summary.sql in Supabase SQL Editor, then try again.",
        );
      }
      throw accountError;
    }
    if (!account?.website_url) {
      throw new Error("Add a Website URL before generating the account website summary.");
    }

    const summary = await generateWithOpenAI(account, data.user);
    const generatedAt = new Date().toISOString();
    const { error: updateError } = await admin
      .from("accounts")
      .update({ website_summary: summary, website_summary_updated_at: generatedAt })
      .eq("id", data.accountId);
    if (updateError) {
      if (isMissingColumnError(updateError, "website_summary")) {
        throw new Error(
          "Database field website_summary is missing. Run src/db/add-account-website-summary.sql in Supabase SQL Editor, then try again.",
        );
      }
      if (isMissingColumnError(updateError, "website_summary_updated_at")) {
        const { error: summaryOnlyError } = await admin
          .from("accounts")
          .update({ website_summary: summary })
          .eq("id", data.accountId);
        if (summaryOnlyError) throw summaryOnlyError;
        return { summary, updatedAt: generatedAt };
      }
      throw updateError;
    }

    return { summary, updatedAt: generatedAt };
  });
