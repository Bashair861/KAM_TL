import { createServerFn } from "@tanstack/react-start";

const ACCOUNT_SYNC_COLUMNS = new Set([
  "industry",
  "business_info",
  "client_history",
  "revenue",
  "primary_contact_name",
  "primary_contact_role",
  "region",
  "employees",
  "main_business_flow",
  "linkedin_url",
  "website_url",
]);
const STAKEHOLDER_SYNC_COLUMNS = new Set(["name", "role", "email", "influence", "last_contact"]);
const INFLUENCE_VALUES = new Set(["Champion", "Decision Maker", "Influencer", "Blocker"]);

function readEnv(name) {
  if (typeof process !== "undefined" && process.env?.[name]) return process.env[name];
  return undefined;
}

function normalizedText(value) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function stakeholderMatchKey(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeInfluence(value) {
  return INFLUENCE_VALUES.has(value) ? value : "Influencer";
}

function validateSyncInput(input) {
  if (!input || typeof input !== "object") throw new Error("Invalid Salesforce sync payload.");
  const accountId = String(input.accountId ?? "").trim();
  const accessToken = String(input.accessToken ?? "");
  const payload = input.payload && typeof input.payload === "object" ? input.payload : {};
  if (!accountId) throw new Error("Account ID is required for Salesforce sync.");
  if (!accessToken) throw new Error("Please sign in again before syncing Salesforce fields.");
  return { accountId, accessToken, payload };
}

async function createSupabaseClients(accessToken) {
  const supabaseUrl = readEnv("VITE_SUPABASE_URL");
  const supabaseAnonKey = readEnv("VITE_SUPABASE_ANON_KEY");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    throw new Error("Supabase environment variables are required before syncing Salesforce fields.");
  }

  const { createClient } = await import("@supabase/supabase-js");
  const requester = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await requester.auth.getUser(accessToken);
  if (error || !data?.user) throw new Error("Please sign in again before syncing Salesforce fields.");

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { admin };
}

function cleanAccountUpdates(updates) {
  return Object.fromEntries(
    Object.entries(updates ?? {}).filter(
      ([column, value]) => ACCOUNT_SYNC_COLUMNS.has(column) && value !== undefined,
    ),
  );
}

function cleanStakeholderFields(fields) {
  const clean = {};
  Object.entries(fields ?? {}).forEach(([column, value]) => {
    if (!STAKEHOLDER_SYNC_COLUMNS.has(column)) return;
    if (column === "influence") {
      clean.influence = normalizeInfluence(value);
      return;
    }
    clean[column] = normalizedText(value);
  });
  return clean;
}

async function syncStakeholders(admin, accountId, stakeholderUpdates) {
  if (stakeholderUpdates.length === 0) return;

  const { data: existingStakeholders, error: fetchError } = await admin
    .from("stakeholders")
    .select("*")
    .eq("account_id", accountId);
  if (fetchError) throw fetchError;

  const byEmail = new Map();
  const byName = new Map();
  (existingStakeholders ?? []).forEach((stakeholder) => {
    if (stakeholder.email) byEmail.set(stakeholderMatchKey(stakeholder.email), stakeholder);
    byName.set(stakeholderMatchKey(stakeholder.name), stakeholder);
  });

  for (const update of stakeholderUpdates) {
    const fields = cleanStakeholderFields(update.fields);
    const sourceName = normalizedText(update.sourceName);
    const sourceEmail = normalizedText(update.sourceEmail);
    const match =
      (sourceEmail && byEmail.get(stakeholderMatchKey(sourceEmail))) ||
      (sourceName && byName.get(stakeholderMatchKey(sourceName)));

    if (match) {
      const cleanUpdate = Object.fromEntries(
        Object.entries(fields).filter(([, value]) => value !== null && value !== undefined),
      );
      if (Object.keys(cleanUpdate).length > 0) {
        const { error } = await admin.from("stakeholders").update(cleanUpdate).eq("id", match.id);
        if (error) throw error;
      }
      continue;
    }

    const newName = fields.name ?? sourceName;
    if (!newName) continue;
    const insertPayload = {
      account_id: accountId,
      name: newName,
      role: fields.role ?? "Stakeholder",
      influence: fields.influence ?? "Influencer",
      email: fields.email ?? null,
      last_contact: fields.last_contact ?? null,
    };
    const { error } = await admin.from("stakeholders").insert(insertPayload);
    if (error) throw error;
  }
}

export const syncSalesforceMappedFieldsServer = createServerFn({ method: "POST" })
  .inputValidator(validateSyncInput)
  .handler(async ({ data }) => {
    const { admin } = await createSupabaseClients(data.accessToken);
    const accountUpdates = cleanAccountUpdates(data.payload.accountUpdates);
    const stakeholderUpdates = Array.isArray(data.payload.stakeholderUpdates)
      ? data.payload.stakeholderUpdates
      : [];

    if (Object.keys(accountUpdates).length > 0) {
      const { error } = await admin.from("accounts").update(accountUpdates).eq("id", data.accountId);
      if (error) throw error;
    }

    await syncStakeholders(admin, data.accountId, stakeholderUpdates);
    return {
      accountFieldCount: Object.keys(accountUpdates).length,
      stakeholderGroupCount: stakeholderUpdates.length,
    };
  });
