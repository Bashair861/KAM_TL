import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

function cleanString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function env(name) {
  const metaEnv =
    typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : undefined;
  return (
    metaEnv?.[name] ??
    globalThis?.process?.env?.[name] ??
    globalThis?.__env?.[name] ??
    globalThis?.[name] ??
    ""
  );
}

function getRequiredEnv(name, fallbackNames = []) {
  const aliases = Array.isArray(fallbackNames)
    ? fallbackNames
    : fallbackNames
      ? [fallbackNames]
      : [];
  const value = env(name) || aliases.map((alias) => env(alias)).find((candidate) => candidate);
  if (!value) {
    throw new Error(`${[name, ...aliases].join(" or ")} is required`);
  }
  return value;
}

function getSupabaseAdmin() {
  const supabaseUrl = getRequiredEnv("SUPABASE_URL", "VITE_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getSupabaseUserClient(authAccessToken) {
  const supabaseUrl = getRequiredEnv("SUPABASE_URL", "VITE_SUPABASE_URL");
  const anonKey = getRequiredEnv("VITE_SUPABASE_ANON_KEY");

  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${authAccessToken}`,
      },
    },
  });
}

async function verifySignedInUser(authAccessToken) {
  if (!authAccessToken) throw new Error("Please sign in before saving score history.");

  const userClient = getSupabaseUserClient(authAccessToken);
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser(authAccessToken);

  if (error || !user) throw new Error("Could not verify the signed-in Supabase user.");
  return user;
}

function validateSnapshotInput(data) {
  const input = data && typeof data === "object" ? data : {};
  return {
    authAccessToken: cleanString(input.authAccessToken),
    accountId: cleanString(input.accountId),
    parameter: cleanString(input.parameter),
    metric: cleanString(input.metric),
    score: Number(input.score),
    snapshotMonth: cleanString(input.snapshotMonth),
    source: cleanString(input.source, "score_snapshot"),
    notes: cleanString(input.notes),
  };
}

export const upsertActivityScoreSnapshotServer = createServerFn({ method: "POST" })
  .inputValidator(validateSnapshotInput)
  .handler(async ({ data }) => {
    await verifySignedInUser(data.authAccessToken);

    if (!data.accountId) throw new Error("Account is required before saving score history.");
    if (!data.parameter) throw new Error("Score parameter is required before saving score history.");
    if (!Number.isFinite(data.score)) {
      throw new Error("Score value is invalid.");
    }

    const snapshotMonth =
      data.snapshotMonth ||
      new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), 1))
        .toISOString()
        .slice(0, 10);

    const admin = getSupabaseAdmin();
    const { error } = await admin.from("activity_score_history").upsert(
      {
        account_id: data.accountId,
        parameter: data.parameter,
        metric: data.metric,
        score: data.score,
        snapshot_month: snapshotMonth,
        source: data.source || "score_snapshot",
        notes: data.notes,
      },
      { onConflict: "account_id,parameter,metric,snapshot_month" },
    );

    if (error) {
      console.error("[activity-score-history] Snapshot upsert failed:", {
        code: error.code,
        message: error.message,
        accountId: data.accountId,
        parameter: data.parameter,
        metric: data.metric,
      });
      throw new Error(`Could not save score history: ${error.message}`);
    }

    return { ok: true };
  });
