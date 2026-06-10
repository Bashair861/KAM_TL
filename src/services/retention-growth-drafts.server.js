import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

function readEnv(name) {
  const metaEnv =
    typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : undefined;
  return metaEnv?.[name] ?? globalThis?.process?.env?.[name] ?? globalThis?.__env?.[name] ?? "";
}

function getRequiredEnv(name, fallbackName) {
  const value = readEnv(name) || (fallbackName ? readEnv(fallbackName) : "");
  if (!value) throw new Error(`${name}${fallbackName ? ` or ${fallbackName}` : ""} is required.`);
  return value;
}

function getSupabaseAdmin() {
  return createClient(
    getRequiredEnv("SUPABASE_URL", "VITE_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}

function cleanString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function mapRetentionGrowthDraft(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    kind: row.kind,
    title: row.title,
    owner: row.owner ?? "",
    dueDate: row.due_date ?? "",
    nextStep: row.next_step ?? "",
    potentialValueLabel: row.potential_value_label ?? "Not provided",
    reason: row.reason ?? "",
    evidence: row.evidence ?? [],
    offerType: row.offer_type ?? null,
    approvalState: row.approval_state ?? "",
    createdBy: row.created_by ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const FALLBACK_DRAFT_SOURCE_PREFIX = "retention-growth-draft:";
const FALLBACK_DRAFT_HEALTH_AREA = "Retention vs Growth Draft";

function isMissingDraftTableError(error) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

function getFallbackDraftSourceId(draftId) {
  return `${FALLBACK_DRAFT_SOURCE_PREFIX}${draftId}`;
}

function getFallbackDraftStatus(approvalState = "") {
  const state = String(approvalState).toLowerCase();
  if (state.includes("converted")) return "converted_to_action";
  if (state.startsWith("rejected")) return "dismissed";
  return "draft";
}

function mapFallbackRetentionGrowthDraft(row) {
  let payload = {};
  try {
    payload = JSON.parse(row.source_reference || "{}");
  } catch {
    payload = {};
  }

  const fallbackId = String(row.source_id ?? "").startsWith(FALLBACK_DRAFT_SOURCE_PREFIX)
    ? String(row.source_id).slice(FALLBACK_DRAFT_SOURCE_PREFIX.length)
    : row.id;
  const approvalState =
    payload.approvalState ??
    (row.status === "converted_to_action"
      ? "Converted to action item"
      : row.status === "dismissed"
        ? "Rejected by Head of KAM"
        : "Pending Head of KAM approval");

  return {
    id: payload.id ?? fallbackId,
    accountId: row.account_id,
    kind: payload.kind ?? "plan",
    title: row.title ?? payload.title ?? "Retention/Growth draft",
    owner: payload.owner ?? "",
    dueDate: payload.dueDate ?? "",
    nextStep: row.description ?? payload.nextStep ?? "",
    potentialValueLabel: row.expected_lift ?? payload.potentialValueLabel ?? "Not provided",
    reason: row.reason ?? payload.reason ?? "",
    evidence: payload.evidence ?? [],
    offerType: payload.offerType ?? null,
    approvalState,
    createdBy: payload.createdBy ?? row.requested_by ?? "",
    createdAt: payload.createdAt ?? row.created_at,
    updatedAt: payload.updatedAt ?? row.updated_at,
  };
}

async function fetchFallbackRetentionGrowthDrafts(admin, accountId) {
  const { data, error } = await admin
    .from("activity_ai_suggestions")
    .select("*")
    .eq("account_id", accountId)
    .eq("health_area", FALLBACK_DRAFT_HEALTH_AREA)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapFallbackRetentionGrowthDraft);
}

async function upsertFallbackRetentionGrowthDraft(admin, accountId, draft, createdBy) {
  const now = new Date().toISOString();
  const sourceId = getFallbackDraftSourceId(draft.id);
  const payload = {
    id: draft.id,
    kind: draft.kind,
    owner: draft.owner,
    dueDate: draft.dueDate,
    evidence: draft.evidence ?? [],
    offerType: draft.offerType,
    approvalState: draft.approvalState,
    potentialValueLabel: draft.potentialValueLabel,
    createdBy,
    createdAt: draft.createdAt ?? now,
    updatedAt: now,
  };
  const row = {
    account_id: accountId,
    requested_by: createdBy,
    source_id: sourceId,
    title: draft.title,
    description: draft.nextStep,
    health_area: FALLBACK_DRAFT_HEALTH_AREA,
    expected_lift: draft.potentialValueLabel ?? "Not provided",
    reason: draft.reason,
    source_reference: JSON.stringify(payload),
    status: getFallbackDraftStatus(draft.approvalState),
    updated_at: now,
  };

  const { data: existingRows, error: existingError } = await admin
    .from("activity_ai_suggestions")
    .select("id")
    .eq("account_id", accountId)
    .eq("source_id", sourceId)
    .limit(1);
  if (existingError) throw existingError;

  const existingId = existingRows?.[0]?.id;
  const query = existingId
    ? admin.from("activity_ai_suggestions").update(row).eq("id", existingId)
    : admin.from("activity_ai_suggestions").insert({ ...row, created_at: draft.createdAt ?? now });
  const { data, error } = await query.select("*").single();

  if (error) throw error;
  return mapFallbackRetentionGrowthDraft(data);
}

function validateFetchInput(input = {}) {
  return {
    accountId: cleanString(input.accountId),
  };
}

function validateUpsertInput(input = {}) {
  return {
    accountId: cleanString(input.accountId),
    createdBy: cleanString(input.createdBy, "Unknown"),
    draft: input.draft && typeof input.draft === "object" ? input.draft : null,
  };
}

export const fetchRetentionGrowthDraftsServer = createServerFn({ method: "POST" })
  .inputValidator(validateFetchInput)
  .handler(async ({ data }) => {
    if (!data.accountId) return [];
    const admin = getSupabaseAdmin();

    const { data: rows, error } = await admin
      .from("retention_growth_drafts")
      .select("*")
      .eq("account_id", data.accountId)
      .order("created_at", { ascending: false });

    if (error) {
      if (isMissingDraftTableError(error)) {
        return fetchFallbackRetentionGrowthDrafts(admin, data.accountId);
      }
      throw error;
    }

    return (rows ?? []).map(mapRetentionGrowthDraft);
  });

export const upsertRetentionGrowthDraftServer = createServerFn({ method: "POST" })
  .inputValidator(validateUpsertInput)
  .handler(async ({ data }) => {
    if (!data.accountId) {
      throw new Error("Account id is required to save a retention/growth draft.");
    }
    if (!data.draft?.id) throw new Error("Draft id is required.");

    const now = new Date().toISOString();
    const row = {
      id: data.draft.id,
      account_id: data.accountId,
      kind: data.draft.kind,
      title: data.draft.title,
      owner: data.draft.owner,
      due_date: data.draft.dueDate,
      next_step: data.draft.nextStep,
      potential_value_label: data.draft.potentialValueLabel,
      reason: data.draft.reason,
      evidence: data.draft.evidence ?? [],
      offer_type: data.draft.offerType,
      approval_state: data.draft.approvalState,
      created_by: data.createdBy,
      created_at: data.draft.createdAt ?? now,
      updated_at: now,
    };

    const admin = getSupabaseAdmin();
    const { data: savedRow, error } = await admin
      .from("retention_growth_drafts")
      .upsert(row, { onConflict: "id" })
      .select("*")
      .single();

    if (isMissingDraftTableError(error)) {
      return upsertFallbackRetentionGrowthDraft(admin, data.accountId, data.draft, data.createdBy);
    }
    if (error) throw error;
    return mapRetentionGrowthDraft(savedRow);
  });
