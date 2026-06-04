import { supabase } from "@/lib/supabase";
import { normalizeRole } from "@/data/kam-data";
import { createManagedAuthUser } from "@/services/user-admin";
import { syncSalesforceMappedFieldsServer } from "@/services/salesforce-sync";
import { generateLinkedinSummaryServer } from "@/services/linkedin-summary";
// ─── mappers ─────────────────────────────────────────────────────────────────
function mapFlatAccount(r) {
  return {
    id: r.id,
    name: r.name,
    shortCode: r.short_code,
    industry: r.industry,
    tier: r.tier,
    health: r.health,
    trend: r.trend,
    contractValue: r.contract_value,
    arr: r.arr,
    renewalDays: r.renewal_days,
    contractType: r.contract_type,
    lastTouch: r.last_touch,
    status: r.status,
    retentionRisk: r.retention_risk,
    growthUpside: r.growth_upside,
    whiteSpaceCount: r.white_space_count,
    cooperation: r.cooperation,
    serviceConsumption: r.service_consumption,
    meetingsPerMonth: r.meetings_per_month,
    contractCompliance: r.contract_compliance,
    primaryContact: {
      name: r.primary_contact_name,
      role: r.primary_contact_role,
    },
    founded: r.founded,
    employees: r.employees,
    region: r.region,
    description: r.description,
    businessInfo: r.business_info,
    clientHistory: r.client_history,
    revenue: r.revenue,
    mrrArr: r.mrr_arr ?? undefined,
    isStartup: r.is_startup,
    engagementTenure: r.engagement_tenure,
    teamSize: r.team_size,
    competitors: r.competitors ?? [],
    mainBusinessFlow: r.main_business_flow,
    linkedinUrl: r.linkedin_url ?? "",
    linkedinSummary: r.linkedin_summary ?? "",
    linkedinSummaryUpdatedAt: r.linkedin_summary_updated_at ?? null,
    assignedKamId: r.assigned_kam_id ?? null,
  };
}
function mapHealthBlock(score, metrics, kpiData) {
  return {
    score,
    metrics: metrics.map((m) => ({
      id: m.id,
      label: m.label,
      value: m.value,
      ...(m.hint ? { hint: m.hint } : {}),
    })),
    kpiData: kpiData ?? null,
  };
}
// ─── fetch accounts (flat) ────────────────────────────────────────────────────
export async function fetchAccounts(opts) {
  let q = supabase.from("accounts").select("*");
  // KAMs only see accounts assigned to them
  if (opts?.role === "KAM" && opts.userId) {
    q = q.eq("assigned_kam_id", opts.userId);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapFlatAccount);
}

function isMissingColumnError(error, column) {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42703" || error.code === "PGRST204" || message.includes(column.toLowerCase())
  );
}

export async function fetchKamUsers() {
  const withStatus = await supabase
    .from("profiles")
    .select("id, name, initials, role, is_active")
    .eq("role", "KAM");

  if (!withStatus.error) {
    return (withStatus.data ?? [])
      .filter((user) => user.is_active !== false)
      .map((user) => ({ ...user, role: normalizeRole(user.role) }));
  }

  if (!isMissingColumnError(withStatus.error, "is_active")) throw withStatus.error;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, initials, role")
    .eq("role", "KAM");
  if (error) throw error;
  return (data ?? []).map((user) => ({ ...user, role: normalizeRole(user.role) }));
}

function mapManagedUser(user) {
  return {
    id: user.id,
    name: user.name,
    initials: user.initials,
    role: normalizeRole(user.role),
    email: user.email ?? "",
    isActive: user.is_active ?? true,
    createdAt: user.created_at ?? null,
  };
}

export async function fetchUsers() {
  const withStatus = await supabase
    .from("profiles")
    .select("id, name, initials, role, email, is_active, created_at")
    .order("created_at", { ascending: false });

  if (!withStatus.error) return (withStatus.data ?? []).map(mapManagedUser);
  if (!isMissingColumnError(withStatus.error, "is_active")) throw withStatus.error;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, initials, role, email, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapManagedUser);
}

function isLegacyRoleEnumError(error) {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("invalid input value for enum") && message.includes("user_role");
}

function isMissingRpcError(error) {
  const message = error?.message?.toLowerCase() ?? "";
  return error?.code === "PGRST202" || message.includes("function") || message.includes("rpc");
}

function roleForLegacyEnum(role) {
  return normalizeRole(role);
}

export async function createUserProfile(user) {
  const normalizedRole = normalizeRole(user.role);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Please sign in again before creating users.");

  const authUser = await createManagedAuthUser({
    data: {
      name: user.name,
      email: user.email,
      role: normalizedRole,
      accessToken: session.access_token,
      redirectTo:
        typeof window !== "undefined" ? `${window.location.origin}/set-password` : undefined,
    },
  });
  return {
    ...mapManagedUser(authUser.profile),
    inviteSent: authUser.inviteSent,
  };
}

export async function updateUserRole(userId, role) {
  const normalizedRole = normalizeRole(role);
  const rpc = await supabase.rpc("update_managed_profile_role", {
    profile_id: userId,
    profile_role: normalizedRole,
  });
  if (!rpc.error) return;
  if (!isMissingRpcError(rpc.error)) throw rpc.error;

  const { error } = await supabase.from("profiles").update({ role: normalizedRole }).eq("id", userId);
  if (!error) return;
  if (isLegacyRoleEnumError(error)) {
    const legacy = await supabase
      .from("profiles")
      .update({ role: roleForLegacyEnum(normalizedRole) })
      .eq("id", userId);
    if (legacy.error) throw legacy.error;
    return;
  }
  throw error;
}

export async function updateUserStatus(userId, isActive) {
  const rpc = await supabase.rpc("update_managed_profile_status", {
    profile_id: userId,
    profile_is_active: isActive,
  });
  if (!rpc.error) return;
  if (!isMissingRpcError(rpc.error)) throw rpc.error;

  const { error } = await supabase.from("profiles").update({ is_active: isActive }).eq("id", userId);
  if (error) throw error;
}
// ─── update account KAM assignment ───────────────────────────────────────────
export async function updateAccountKam(accountId, kamId) {
  const { error } = await supabase
    .from("accounts")
    .update({ assigned_kam_id: kamId })
    .eq("id", accountId);
  if (error) throw error;
}
// ─── update health block (score + metrics + kpi checkbox state) ──────────────
export async function updateHealthBlock(accountId, area, score, metricUpdates, kpiData) {
  // Use maybeSingle so missing rows don't throw
  const { data: hs } = await supabase
    .from("health_scores")
    .select("id")
    .eq("account_id", accountId)
    .eq("area", area)
    .maybeSingle();

  if (hs) {
    // Row exists — update score + kpi_data
    const { error } = await supabase
      .from("health_scores")
      .update({ score, kpi_data: kpiData })
      .eq("id", hs.id);
    if (error) throw error;
  } else {
    // No row yet (new account) — insert one
    const { error } = await supabase
      .from("health_scores")
      .insert({ account_id: accountId, area, score, kpi_data: kpiData });
    if (error) throw error;
  }

  // Update existing metric rows (only present for accounts seeded with metrics)
  if (metricUpdates.length > 0) {
    await Promise.all(
      metricUpdates.map((mu) =>
        supabase.from("health_metrics").update({ label: mu.label, value: mu.value }).eq("id", mu.id),
      ),
    );
  }
}
// ─── create new account ───────────────────────────────────────────────────────

export async function createAccount(data) {
  const { error } = await supabase.from("accounts").insert([{
    id: data.id,
    name: data.name,
    short_code: data.shortCode,
    industry: data.industry,
    tier: data.tier,
    health: 50,
    trend: 0,
    contract_value: data.contractValue,
    arr: data.arr,
    renewal_days: data.renewalDays,
    contract_type: data.contractType,
    last_touch: "Just now",
    status: "healthy",
    retention_risk: "Low",
    growth_upside: 0,
    white_space_count: 0,
    is_startup: false,
    region: data.region || null,
    primary_contact_name: data.primaryContactName || null,
    linkedin_url: data.linkedinUrl || null,
    linkedin_summary: data.linkedinSummary || null,
    ...(data.linkedinSummaryUpdatedAt
      ? { linkedin_summary_updated_at: data.linkedinSummaryUpdatedAt }
      : {}),
    assigned_kam_id: data.assignedKamId || null,
  }]);
  if (error) throw error;
}

// ─── update account KYC fields ───────────────────────────────────────────────
export async function updateAccountKyc(accountId, updates) {
  const { error } = await supabase.from("accounts").update(updates).eq("id", accountId);
  if (error) throw error;
}
export async function syncSalesforceMappedFields(accountId, payload) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Please sign in again before syncing Salesforce fields.");

  return syncSalesforceMappedFieldsServer({
    data: {
      accountId,
      payload,
      accessToken: session.access_token,
    },
  });
}
export async function generateAccountLinkedinSummary(accountId) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Please sign in again before generating a LinkedIn summary.");
  }

  return generateLinkedinSummaryServer({
    data: {
      accountId,
      accessToken: session.access_token,
    },
  });
}
// ─── fetch single account (full shape) ───────────────────────────────────────
export async function fetchAccount(id) {
  const [
    { data: acc, error: accErr },
    { data: stakeholders },
    { data: scores },
    { data: cd },
    { data: activities },
    { data: retentionGrowth },
    { data: educationLog },
  ] = await Promise.all([
    supabase.from("accounts").select("*").eq("id", id).single(),
    supabase.from("stakeholders").select("*").eq("account_id", id),
    supabase.from("health_scores").select("*, health_metrics(*)").eq("account_id", id),
    supabase.from("contract_details").select("*").eq("account_id", id).maybeSingle(),
    supabase.from("activities").select("*").eq("account_id", id),
    supabase.from("retention_growth").select("*").eq("account_id", id),
    supabase.from("education_log").select("*").eq("account_id", id),
  ]);
  if (accErr || !acc) return null;
  const scoreMap = new Map((scores ?? []).map((s) => [s.area, s]));
  const block = (area) => {
    const s = scoreMap.get(area);
    if (!s) return { score: 0, metrics: [], kpiData: null };
    const dbMetrics = s.health_metrics ?? [];
    // For new accounts with no health_metrics rows, derive display bars from kpi_data sections
    if (dbMetrics.length === 0 && Array.isArray(s.kpi_data) && s.kpi_data.length > 0) {
      const derived = s.kpi_data.map((sec, i) => {
        const fields = sec.fields ?? [];
        const totalWeight = fields.reduce((a, f) => a + (Number(f.weight) || 0), 0);
        const earned = fields.reduce((a, f) => a + (f.checked ? Number(f.weight) || 0 : 0), 0);
        const pct = totalWeight > 0 ? (earned / totalWeight) * 100 : 0;
        return { id: `derived-${i}`, label: sec.name, value: parseFloat(((pct / 100) * 10).toFixed(1)) };
      });
      return mapHealthBlock(s.score, derived, s.kpi_data);
    }
    return mapHealthBlock(s.score, dbMetrics, s.kpi_data);
  };
  const flat = mapFlatAccount(acc);
  return {
    ...flat,
    stakeholders: (stakeholders ?? []).map((s) => ({
      name: s.name,
      role: s.role,
      influence: s.influence,
      email: s.email ?? undefined,
      lastContact: s.last_contact ?? undefined,
    })),
    relationshipHealth: block("relationship"),
    projectHealth: block("project"),
    whiteSpace: block("white_space"),
    contractScoring: {
      ...block("contract"),
      type: cd?.type ?? "",
      duration: cd?.duration ?? "",
      autoRenew: cd?.auto_renew ?? false,
      nonTerminator: cd?.non_terminator ?? false,
      minOneYear: cd?.min_one_year ?? false,
      priceHike: cd?.price_hike ?? "",
      swot: {
        s: cd?.swot_s ?? "",
        w: cd?.swot_w ?? "",
        o: cd?.swot_o ?? "",
        t: cd?.swot_t ?? "",
      },
      customerFeedback: cd?.customer_feedback ?? "",
    },
    csat: block("csat"),
    riskScoring: block("risk"),
    resourceHealth: {
      ...block("resource"),
      backupExists: cd?.backup_exists ?? false,
      leavesThisMonth: cd?.leaves_this_month ?? 0,
      criticalResources: cd?.critical_resources ?? 0,
      teamSize: flat.teamSize,
    },
    financialHealth: block("financial"),
    activities: (activities ?? []).map((a) => ({
      id: a.id,
      area: a.area,
      title: a.title,
      owner: a.owner ?? "",
      due: a.due ?? "",
      status: a.status,
      rag: a.rag,
      expectedLift: a.expected_lift ?? "",
    })),
    retentionGrowth: (retentionGrowth ?? []).map((r) => ({
      service: r.service,
      offered: r.offered,
      delivered: r.delivered,
      applicable: r.applicable,
      trackingNote: r.tracking_note ?? "",
    })),
    educationLog: (educationLog ?? []).map((e) => ({
      date: e.date,
      topic: e.topic,
      approach: e.approach ?? "",
      outcome: e.outcome ?? "",
    })),
  };
}
// ─── fetch escalations ────────────────────────────────────────────────────────
export async function fetchEscalations(accountId) {
  let q = supabase.from("escalations").select("*, escalation_action_items(*)");
  if (accountId) q = q.eq("account_id", accountId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((e) => ({
    id: e.id,
    accountId: e.account_id,
    title: e.title,
    priority: e.priority,
    slaRemainingHours: e.sla_remaining_hours ?? 0,
    openedAt: e.opened_at ?? "",
    rca: e.rca ?? "",
    description: e.description ?? "",
    recommendation: e.recommendation ?? undefined,
    realisticCheck: e.realistic_check ?? undefined,
    clientFeedback: e.client_feedback ?? undefined,
    stakeholders: e.stakeholders ?? [],
    actionItems: (e.escalation_action_items ?? []).map((a) => ({ label: a.label, done: a.done })),
  }));
}
// ─── fetch opportunities ──────────────────────────────────────────────────────
export async function fetchOpportunities(accountId) {
  let q = supabase.from("opportunities").select("*");
  if (accountId) q = q.eq("account_id", accountId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((o) => ({
    id: o.id,
    accountId: o.account_id,
    title: o.title,
    source: o.source ?? "",
    signalDate: o.signal_date ?? "",
    potential: o.potential ?? 0,
    confidence: o.confidence,
    nextStep: o.next_step ?? "",
  }));
}

function firstRelatedRow(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function fetchContracts(opts) {
  let q = supabase
    .from("accounts")
    .select("*, contract_details(duration, auto_renew, non_terminator, price_hike)");
  if (opts?.role === "KAM" && opts.userId) {
    q = q.eq("assigned_kam_id", opts.userId);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((row) => {
    const cd = firstRelatedRow(row.contract_details);
    return {
      ...mapFlatAccount(row),
      duration: cd?.duration ?? "—",
      autoRenew: Boolean(cd?.auto_renew),
      nonTerminator: Boolean(cd?.non_terminator),
      priceHike: cd?.price_hike ?? "—",
    };
  });
}
export async function fetchAccountHistory(accountId) {
  const { data, error } = await supabase
    .from("account_history")
    .select("*")
    .eq("account_id", accountId)
    .order("edited_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((h) => ({
    id: h.id,
    fieldName: h.field_name,
    oldValue: h.old_value,
    newValue: h.new_value,
    editedBy: h.edited_by,
    editedAt: h.edited_at,
  }));
}
export async function logAccountChanges(accountId, changes, editedBy) {
  if (changes.length === 0) return;
  const { error } = await supabase.from("account_history").insert(
    changes.map((c) => ({
      account_id: accountId,
      field_name: c.field,
      old_value: c.oldValue,
      new_value: c.newValue,
      edited_by: editedBy,
    })),
  );
  if (error) throw error;
}
// ─── fetch notifications ──────────────────────────────────────────────────────
export async function fetchNotifications() {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body ?? "",
    accountId: n.account_id ?? undefined,
    time: n.time ?? "",
    type: n.type,
    read: n.read,
  }));
}
