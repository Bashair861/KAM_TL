import { createServerFn } from "@tanstack/react-start";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";
const OPENAI_FALLBACK_MODELS = ["gpt-5.4-mini", "gpt-4o-mini", "gpt-4.1-mini"];

function readEnv(name) {
  if (typeof process !== "undefined" && process.env?.[name]) return process.env[name];
  return undefined;
}

function validateInput(input) {
  if (!input || typeof input !== "object") throw new Error("Invalid LinkedIn summary payload.");
  const accountId = String(input.accountId ?? "").trim();
  const accessToken = String(input.accessToken ?? "");
  if (!accountId) throw new Error("Account ID is required before generating a LinkedIn summary.");
  if (!accessToken) throw new Error("Please sign in again before generating a LinkedIn summary.");
  return { accountId, accessToken };
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
    throw new Error("Supabase environment variables are required before generating a summary.");
  }

  const { createClient } = await import("@supabase/supabase-js");
  const requester = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await requester.auth.getUser(accessToken);
  if (error || !data?.user) {
    throw new Error("Please sign in again before generating a LinkedIn summary.");
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
    "Use the supplied LinkedIn URL and public web search to create a concise account brief.",
    "Write exactly 2 to 3 short paragraphs, no bullet points, no markdown headings.",
    "Focus on these metrics: new job postings, company major activities, competitor information, and CEO status or communication updates.",
    "If a metric has no reliable public signal, say that there is no clear public signal instead of inventing details.",
    "When source URLs are useful, include at most one concise URL per paragraph.",
    "Never repeat the same URL in the answer, and do not cite OpenAI, model, or provider URLs as sources.",
    "",
    `Account name: ${account.name}`,
    `Industry: ${account.industry ?? "Unknown"}`,
    `Region: ${account.region ?? "Unknown"}`,
    `Known competitors: ${(account.competitors ?? []).join(", ") || "Unknown"}`,
    `LinkedIn URL: ${account.linkedin_url}`,
  ].join("\n");
}

function extractGeminiText(responseJson) {
  const parts = responseJson?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((part) => part.text ?? "").join("").trim();
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

async function generateWithGemini(account) {
  const apiKey = readEnv("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing. Add it to .env.local and deployment env vars.");
  }

  const model = readEnv("GEMINI_MODEL") ?? DEFAULT_GEMINI_MODEL;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(account) }] }],
        tools: [{ google_search: {} }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: 900,
        },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini summary generation failed (${response.status}): ${body}`);
  }

  const json = await response.json();
  const summary = normalizeSummary(extractGeminiText(json));
  if (!summary) throw new Error("Gemini returned an empty LinkedIn summary.");
  return summary;
}

async function generateWithOpenAI(account) {
  const apiKey = readEnv("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  const attempted = [];
  for (const model of openAIModelCandidates()) {
    const response = await requestOpenAISummary(apiKey, model, account);
    if (response.ok) {
      const json = await response.json();
      const summary = normalizeSummary(extractOpenAIText(json));
      if (!summary) throw new Error("OpenAI returned an empty LinkedIn summary.");
      return summary;
    }

    const body = await response.text();
    attempted.push(`${model} (${response.status})`);
    if (isOpenAIModelAccessError(response.status, body)) continue;
    throw new Error(`OpenAI summary generation failed (${response.status}): ${body}`);
  }

  throw new Error(
    `OpenAI summary generation failed because none of the configured models were available. Tried: ${attempted.join(", ")}.`,
  );
}

async function generateSummary(account) {
  if (readEnv("GEMINI_API_KEY")) return generateWithGemini(account);
  if (readEnv("OPENAI_API_KEY")) return generateWithOpenAI(account);
  throw new Error("Add GEMINI_API_KEY or OPENAI_API_KEY before generating a LinkedIn summary.");
}

export const generateLinkedinSummaryServer = createServerFn({ method: "POST" })
  .inputValidator(validateInput)
  .handler(async ({ data }) => {
    const { admin } = await createSupabaseClients(data.accessToken);
    const { data: account, error: accountError } = await admin
      .from("accounts")
      .select("id, name, industry, region, competitors, linkedin_url")
      .eq("id", data.accountId)
      .single();
    if (accountError) throw accountError;
    if (!account?.linkedin_url) {
      throw new Error("Add a LinkedIn URL before generating the account summary.");
    }

    const summary = await generateSummary(account);
    const generatedAt = new Date().toISOString();
    const { error: updateError } = await admin
      .from("accounts")
      .update({ linkedin_summary: summary, linkedin_summary_updated_at: generatedAt })
      .eq("id", data.accountId);
    if (updateError) {
      if (isMissingColumnError(updateError, "linkedin_summary")) {
        throw new Error(
          "Database field linkedin_summary is missing. Run src/db/add-linkedin-summary.sql in Supabase SQL Editor, then try again.",
        );
      }
      if (isMissingColumnError(updateError, "linkedin_summary_updated_at")) {
        const { error: summaryOnlyError } = await admin
          .from("accounts")
          .update({ linkedin_summary: summary })
          .eq("id", data.accountId);
        if (summaryOnlyError) throw summaryOnlyError;
        return { summary, updatedAt: generatedAt };
      }
      throw updateError;
    }

    return { summary, updatedAt: generatedAt };
  });
