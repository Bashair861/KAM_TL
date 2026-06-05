import { createServerFn } from "@tanstack/react-start";

const ACCOUNT_SYNC_COLUMNS = new Set([
  "industry",
  "business_info",
  "client_history",
  "contract_value",
  "arr",
  "revenue",
  "primary_contact_name",
  "primary_contact_role",
  "region",
  "employees",
  "main_business_flow",
  "renewal_date",
  "contract_duration",
  "contract_type",
  "last_touch",
  "linkedin_url",
  "website_url",
]);
const ACCOUNT_NUMBER_COLUMNS = new Set(["contract_value", "arr"]);
const CONTRACT_SYNC_COLUMNS = new Set([
  "type",
  "duration",
  "renewal_date",
  "auto_renew",
  "non_terminator",
  "min_one_year",
  "price_hike",
  "backup_exists",
  "critical_resources",
  "customer_feedback",
]);
const CONTRACT_BOOLEAN_COLUMNS = new Set([
  "auto_renew",
  "non_terminator",
  "min_one_year",
  "backup_exists",
]);
const CONTRACT_NUMBER_COLUMNS = new Set(["critical_resources"]);
const RETENTION_GROWTH_SYNC_COLUMNS = new Set(["service", "offered", "delivered"]);
const RETENTION_GROWTH_BOOLEAN_COLUMNS = new Set(["offered", "delivered"]);
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

function normalizedNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/[$,\s]/g, ""));
  return Number.isFinite(number) ? Math.round(number) : null;
}

function normalizedBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim().toLowerCase();
  if (["true", "yes", "y", "1"].includes(text)) return true;
  if (["false", "no", "n", "0"].includes(text)) return false;
  return null;
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
  const clean = {};
  Object.entries(updates ?? {}).forEach(([column, value]) => {
    if (!ACCOUNT_SYNC_COLUMNS.has(column) || value === undefined) return;
    clean[column] = ACCOUNT_NUMBER_COLUMNS.has(column) ? normalizedNumber(value) : value;
  });
  return clean;
}

function cleanContractUpdates(updates) {
  const clean = {};
  Object.entries(updates ?? {}).forEach(([column, value]) => {
    if (!CONTRACT_SYNC_COLUMNS.has(column) || value === undefined) return;
    if (CONTRACT_BOOLEAN_COLUMNS.has(column)) {
      clean[column] = normalizedBoolean(value);
      return;
    }
    if (CONTRACT_NUMBER_COLUMNS.has(column)) {
      clean[column] = normalizedNumber(value);
      return;
    }
    clean[column] = value;
  });
  return clean;
}

function cleanRetentionGrowthFields(fields) {
  const clean = {};
  Object.entries(fields ?? {}).forEach(([column, value]) => {
    if (!RETENTION_GROWTH_SYNC_COLUMNS.has(column) || value === undefined) return;
    if (RETENTION_GROWTH_BOOLEAN_COLUMNS.has(column)) {
      clean[column] = normalizedBoolean(value);
      return;
    }
    clean[column] = normalizedText(value);
  });
  return clean;
}

async function syncContractReferences(admin, accountId, accountUpdates, directContractUpdates) {
  const contractUpdates = { account_id: accountId, ...cleanContractUpdates(directContractUpdates) };
  if (Object.prototype.hasOwnProperty.call(accountUpdates, "contract_type")) {
    contractUpdates.type = accountUpdates.contract_type;
  }
  if (Object.prototype.hasOwnProperty.call(accountUpdates, "contract_duration")) {
    contractUpdates.duration = accountUpdates.contract_duration;
  }
  if (Object.prototype.hasOwnProperty.call(accountUpdates, "renewal_date")) {
    contractUpdates.renewal_date = accountUpdates.renewal_date;
  }
  if (Object.keys(contractUpdates).length <= 1) return;

  const { error } = await admin
    .from("contract_details")
    .upsert(contractUpdates, { onConflict: "account_id" });
  if (error) throw error;
}

async function syncRetentionGrowth(admin, accountId, retentionGrowthUpdates) {
  for (const update of retentionGrowthUpdates) {
    const fields = cleanRetentionGrowthFields(update.fields);
    const service = normalizedText(update.service ?? fields.service);
    if (!service) continue;

    const payload = {
      account_id: accountId,
      service,
      ...Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== null)),
    };

    const { data: existingRows, error: fetchError } = await admin
      .from("retention_growth")
      .select("id")
      .eq("account_id", accountId)
      .eq("service", service)
      .limit(1);
    if (fetchError) throw fetchError;

    const existing = existingRows?.[0];
    if (existing) {
      const { account_id: _accountId, service: _service, ...updates } = payload;
      if (Object.keys(updates).length === 0) continue;
      const { error } = await admin.from("retention_growth").update(updates).eq("id", existing.id);
      if (error) throw error;
      continue;
    }

    const { error } = await admin.from("retention_growth").insert(payload);
    if (error) throw error;
  }
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
    const contractUpdates = cleanContractUpdates(data.payload.contractUpdates);
    const retentionGrowthUpdates = Array.isArray(data.payload.retentionGrowthUpdates)
      ? data.payload.retentionGrowthUpdates
      : [];
    const stakeholderUpdates = Array.isArray(data.payload.stakeholderUpdates)
      ? data.payload.stakeholderUpdates
      : [];

    if (Object.keys(accountUpdates).length > 0) {
      const { error } = await admin.from("accounts").update(accountUpdates).eq("id", data.accountId);
      if (error) throw error;
    }

    await syncContractReferences(admin, data.accountId, accountUpdates, contractUpdates);
    await syncRetentionGrowth(admin, data.accountId, retentionGrowthUpdates);
    await syncStakeholders(admin, data.accountId, stakeholderUpdates);
    return {
      accountFieldCount: Object.keys(accountUpdates).length,
      contractFieldCount: Object.keys(contractUpdates).length,
      retentionGrowthGroupCount: retentionGrowthUpdates.length,
      stakeholderGroupCount: stakeholderUpdates.length,
    };
  });
