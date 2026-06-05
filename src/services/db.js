import { supabase } from "@/lib/supabase";
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
    assignedKamId: r.assigned_kam_id ?? null,
    linkedinUrl: r.linkedin_url ?? "",
    websiteUrl: r.website_url ?? "",
    newsKeywords: r.news_keywords ?? [],
    lastNewsSyncAt: r.last_news_sync_at ?? null,
  };
}
function mapHealthBlock(score, metrics, kpiData) {
  return {
    score,
    metrics: metrics.map((m) => ({
      id: m.id,
      label: m.label,
      value: m.value,
      complete: Boolean(m.complete ?? m.Complete ?? false),
      ...(m.hint ? { hint: m.hint } : {}),
    })),
    kpiData: kpiData ?? null,
  };
}
function isMissingTableError(error) {
  return error?.code === "42P01" || /relation .* does not exist/i.test(error?.message ?? "");
}
function getRowComplete(row) {
  return Boolean(row.complete ?? row.completed ?? row.Complete ?? false);
}
function mapTask(row, accountLookup = new Map(), healthMetricLookup = new Map()) {
  const healthMetric = healthMetricLookup.get(row.health_metric_id);
  const accountId = row.account_id ?? healthMetric?.accountId ?? null;
  const account = accountLookup.get(accountId);
  return {
    id: row.id,
    accountId,
    accountName: account?.name ?? accountId ?? "Portfolio",
    title: row.title ?? row.name ?? row.label ?? "Untitled task",
    description: row.description ?? "",
    due: row.due ?? row.due_date ?? "",
    priority: row.priority ?? "P3",
    source: row.source ?? row.type ?? healthMetric?.label ?? "Task",
    complete: getRowComplete(row),
    completedAt: row.completed_at ?? null,
    healthMetricId: row.health_metric_id ?? null,
    healthMetricLabel: healthMetric?.label ?? "",
    healthArea: healthMetric?.area ?? "",
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
export async function fetchKamTasks(opts = {}) {
  const accountIds = opts.accountIds ?? (opts.accountId ? [opts.accountId] : null);
  if (accountIds && accountIds.length === 0) return [];

  let q = supabase.from("tasks").select("*").order("created_at", { ascending: false }).limit(100);
  if (accountIds) q = q.in("account_id", accountIds);

  const { data, error } = await q;
  if (isMissingTableError(error)) return [];
  if (error) throw error;

  const tasks = data ?? [];
  const visibleTasks = opts.includeCompleted
    ? tasks
    : tasks.filter((task) => !getRowComplete(task));
  const taskAccountIds = [
    ...new Set(visibleTasks.map((task) => task.account_id).filter((id) => Boolean(id))),
  ];
  const healthMetricIds = [
    ...new Set(visibleTasks.map((task) => task.health_metric_id).filter((id) => Boolean(id))),
  ];

  const [{ data: accounts }, { data: metrics }] = await Promise.all([
    taskAccountIds.length
      ? supabase.from("accounts").select("id, name, short_code").in("id", taskAccountIds)
      : Promise.resolve({ data: [] }),
    healthMetricIds.length
      ? supabase
          .from("health_metrics")
          .select("id, label, complete, Complete, health_scores(account_id, area)")
          .in("id", healthMetricIds)
      : Promise.resolve({ data: [] }),
  ]);

  const accountLookup = new Map((accounts ?? []).map((account) => [account.id, account]));
  const healthMetricLookup = new Map(
    (metrics ?? []).map((metric) => {
      const score = Array.isArray(metric.health_scores)
        ? metric.health_scores[0]
        : metric.health_scores;
      return [
        metric.id,
        {
          label: metric.label,
          complete: Boolean(metric.complete ?? metric.Complete ?? false),
          accountId: score?.account_id ?? null,
          area: score?.area ?? "",
        },
      ];
    }),
  );

  return visibleTasks.map((task) => mapTask(task, accountLookup, healthMetricLookup));
}
export async function fetchDashboardActionItems(opts = {}) {
  const accounts = await fetchAccounts({ role: opts.role, userId: opts.userId });
  const accountIds = accounts.map((account) => account.id);
  if (accountIds.length === 0) return [];
  const tasks = await fetchKamTasks({ accountIds, includeCompleted: false });
  if (tasks.length > 0) return tasks;

  const { data, error } = await supabase
    .from("activities")
    .select("*, accounts(id, name, short_code)")
    .in("account_id", accountIds)
    .neq("status", "Done")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((activity) => ({
    id: activity.id,
    accountId: activity.account_id,
    accountName: activity.accounts?.name ?? activity.account_id,
    title: activity.title,
    description: "",
    due: activity.due ?? "",
    priority: activity.rag === "R" ? "P1" : activity.rag === "A" ? "P2" : "P3",
    source: activity.area ?? "Activity",
    complete: false,
    completedAt: null,
    healthMetricId: null,
    healthMetricLabel: "",
    healthArea: "",
    readOnlyFallback: true,
  }));
}
export async function updateDashboardTaskComplete(taskId, complete, healthMetricId) {
  const completedAt = complete ? new Date().toISOString() : null;
  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from("tasks")
    .update({ Complete: complete, updated_at: updatedAt })
    .eq("id", taskId);
  if (error) throw error;

  if (healthMetricId) {
    const { error: metricError } = await supabase
      .from("health_metrics")
      .update({ Complete: complete, complete, completed_at: completedAt })
      .eq("id", healthMetricId);
    if (metricError) throw metricError;
  }
}
export async function fetchKamUsers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, initials, role")
    .eq("role", "KAM");
  if (error) throw error;
  return data ?? [];
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
  const { data: hs, error: hsErr } = await supabase
    .from("health_scores")
    .select("id")
    .eq("account_id", accountId)
    .eq("area", area)
    .single();
  if (hsErr || !hs) throw hsErr ?? new Error(`No health score found for area: ${area}`);
  const { error: scoreErr } = await supabase
    .from("health_scores")
    .update({ score, kpi_data: kpiData })
    .eq("id", hs.id);
  if (scoreErr) throw scoreErr;
  await Promise.all(
    metricUpdates.map((mu) =>
      supabase.from("health_metrics").update({ label: mu.label, value: mu.value }).eq("id", mu.id),
    ),
  );
}
// ─── update account KYC fields ───────────────────────────────────────────────
export async function updateAccountKyc(accountId, updates) {
  const { error } = await supabase.from("accounts").update(updates).eq("id", accountId);
  if (error) throw error;
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
    return s
      ? mapHealthBlock(s.score, s.health_metrics ?? [], s.kpi_data)
      : { score: 0, metrics: [], kpiData: null };
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
    const cd = row.contract_details?.[0];
    return {
      ...mapFlatAccount(row),
      duration: cd?.duration ?? "—",
      autoRenew: cd?.auto_renew ?? false,
      nonTerminator: cd?.non_terminator ?? false,
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
