const SHORT_CODE_RE = /^[A-Z0-9]{2,4}$/;
const ACCOUNT_REPAIR_SELECT = [
  "id",
  "name",
  "short_code",
  "contract_value",
  "arr",
  "growth_upside",
  "revenue_at_risk",
  "growth_pipeline_value",
  "health",
  "retention_health_score",
  "growth_potential_score",
  "cooperation",
  "service_consumption",
  "contract_compliance",
  "white_space_count",
  "meetings_per_month",
  "team_size",
  "founded",
].join(", ");

function hasOwnField(object, key) {
  return Object.prototype.hasOwnProperty.call(object ?? {}, key);
}

function hasMeaningfulAccountName(value) {
  const text = String(value ?? "").trim();
  return text.length >= 2 && /[\p{L}\p{N}]/u.test(text);
}

function deriveShortCodeCandidate(value) {
  const text = String(value ?? "").toUpperCase();
  const parts = text.match(/[A-Z0-9]+/g) ?? [];
  const initials = parts.map((part) => part[0]).join("");
  const compact = text.replace(/[^A-Z0-9]/g, "");
  const candidate = (initials.length >= 2 ? initials : compact).slice(0, 4);
  return candidate.length >= 2 && SHORT_CODE_RE.test(candidate) ? candidate : null;
}

function buildFallbackShortCode(...values) {
  for (const value of values) {
    const candidate = deriveShortCodeCandidate(value);
    if (candidate) return candidate;
  }
  return "AC";
}

function buildFallbackAccountName(row) {
  const idText = String(row?.id ?? "").replace(/[^A-Za-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  return idText ? `Account ${idText}` : "Account Record";
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function repairRequiredScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(Math.max(number, 0), 100);
}

function repairOptionalScore(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.min(Math.max(number, 0), 100);
}

function repairRequiredCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : 0;
}

function repairOptionalCount(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
}

function repairFounded(value) {
  if (value === null || value === undefined || value === "") return null;
  const year = Math.round(Number(value));
  const maxYear = new Date().getFullYear() + 1;
  return Number.isFinite(year) && year >= 1800 && year <= maxYear ? year : null;
}

export async function repairAccountConstraintUpdates(client, accountId, updates = {}) {
  if (!client || !accountId || Object.keys(updates).length === 0) return updates;

  const { data, error } = await client
    .from("accounts")
    .select(ACCOUNT_REPAIR_SELECT)
    .eq("id", accountId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return updates;

  const repairs = {};

  if (!hasOwnField(updates, "name") && !hasMeaningfulAccountName(data.name)) {
    repairs.name = buildFallbackAccountName(data);
  }
  if (!hasOwnField(updates, "short_code") && !SHORT_CODE_RE.test(String(data.short_code ?? "").trim())) {
    repairs.short_code = buildFallbackShortCode(updates.name, data.name, data.id);
  }

  ["contract_value", "arr", "growth_upside", "revenue_at_risk", "growth_pipeline_value"].forEach((column) => {
    if (!hasOwnField(updates, column) && !isFiniteNumber(data[column])) repairs[column] = 0;
    else if (!hasOwnField(updates, column) && Number(data[column]) < 0) repairs[column] = 0;
  });

  ["health", "retention_health_score", "growth_potential_score"].forEach((column) => {
    if (!hasOwnField(updates, column)) {
      const repaired = repairRequiredScore(data[column]);
      if (Number(data[column]) !== repaired) repairs[column] = repaired;
    }
  });

  ["cooperation", "service_consumption", "contract_compliance"].forEach((column) => {
    if (!hasOwnField(updates, column)) {
      const repaired = repairOptionalScore(data[column]);
      const current = data[column] === null || data[column] === undefined ? null : Number(data[column]);
      if (current !== repaired) repairs[column] = repaired;
    }
  });

  if (!hasOwnField(updates, "white_space_count")) {
    const repaired = repairRequiredCount(data.white_space_count);
    if (Number(data.white_space_count) !== repaired) repairs.white_space_count = repaired;
  }

  ["meetings_per_month", "team_size"].forEach((column) => {
    if (!hasOwnField(updates, column)) {
      const repaired = repairOptionalCount(data[column]);
      const current = data[column] === null || data[column] === undefined ? null : Number(data[column]);
      if (current !== repaired) repairs[column] = repaired;
    }
  });

  if (!hasOwnField(updates, "founded")) {
    const repaired = repairFounded(data.founded);
    const current = data.founded === null || data.founded === undefined ? null : Number(data.founded);
    if (current !== repaired) repairs.founded = repaired;
  }

  return Object.keys(repairs).length > 0 ? { ...updates, ...repairs } : updates;
}
