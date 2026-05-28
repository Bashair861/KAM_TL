import { supabase } from "@/lib/supabase";
import type {
  Account,
  Escalation,
  Notification,
  Opportunity,
} from "@/data/kam-data";

// ─── mappers ─────────────────────────────────────────────────────────────────

function mapFlatAccount(r: Record<string, unknown>) {
  return {
    id: r.id as string,
    name: r.name as string,
    shortCode: r.short_code as string,
    industry: r.industry as string,
    tier: r.tier as Account["tier"],
    health: r.health as number,
    trend: r.trend as number,
    contractValue: r.contract_value as number,
    arr: r.arr as number,
    renewalDays: r.renewal_days as number,
    contractType: r.contract_type as Account["contractType"],
    lastTouch: r.last_touch as string,
    status: r.status as Account["status"],
    retentionRisk: r.retention_risk as Account["retentionRisk"],
    growthUpside: r.growth_upside as number,
    whiteSpaceCount: r.white_space_count as number,
    cooperation: r.cooperation as number,
    serviceConsumption: r.service_consumption as number,
    meetingsPerMonth: r.meetings_per_month as number,
    contractCompliance: r.contract_compliance as number,
    primaryContact: {
      name: r.primary_contact_name as string,
      role: r.primary_contact_role as string,
    },
    founded: r.founded as number,
    employees: r.employees as string,
    region: r.region as string,
    description: r.description as string,
    businessInfo: r.business_info as string,
    clientHistory: r.client_history as string,
    revenue: r.revenue as string,
    mrrArr: (r.mrr_arr as string | null) ?? undefined,
    isStartup: r.is_startup as boolean,
    engagementTenure: r.engagement_tenure as string,
    teamSize: r.team_size as number,
    competitors: (r.competitors as string[]) ?? [],
    mainBusinessFlow: r.main_business_flow as string,
    assignedKamId: (r.assigned_kam_id as string | null) ?? null,
  };
}

function mapHealthBlock(
  score: number,
  metrics: Array<{ id: string; label: string; value: number; hint: string | null }>,
  kpiData?: unknown,
) {
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

export async function fetchAccounts(opts?: { role?: string; userId?: string }) {
  let q = supabase.from("accounts").select("*");
  // KAMs only see accounts assigned to them
  if (opts?.role === "KAM" && opts.userId) {
    q = q.eq("assigned_kam_id", opts.userId);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapFlatAccount);
}

export type FlatAccount = Awaited<ReturnType<typeof fetchAccounts>>[number];

// ─── fetch KAM users (for assignment dropdown) ────────────────────────────────

export type KamUser = { id: string; name: string; initials: string; role: string };

export async function fetchKamUsers(): Promise<KamUser[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, initials, role")
    .eq("role", "KAM");
  if (error) throw error;
  return (data ?? []) as KamUser[];
}

// ─── update account KAM assignment ───────────────────────────────────────────

export async function updateAccountKam(accountId: string, kamId: string): Promise<void> {
  const { error } = await supabase
    .from("accounts")
    .update({ assigned_kam_id: kamId })
    .eq("id", accountId);
  if (error) throw error;
}

// ─── update health block (score + metrics + kpi checkbox state) ──────────────

export async function updateHealthBlock(
  accountId: string,
  area: string,
  score: number,
  metricUpdates: Array<{ id: string; label: string; value: number }>,
  kpiData: unknown,
): Promise<void> {
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
      supabase
        .from("health_metrics")
        .update({ label: mu.label, value: mu.value })
        .eq("id", mu.id),
    ),
  );
}

// ─── update account KYC fields ───────────────────────────────────────────────

export async function updateAccountKyc(
  accountId: string,
  updates: {
    industry?: string;
    business_info?: string;
    client_history?: string;
    revenue?: string;
    mrr_arr?: string | null;
    primary_contact_name?: string;
    engagement_tenure?: string;
    team_size?: number;
    competitors?: string[];
    main_business_flow?: string;
  },
): Promise<void> {
  const { error } = await supabase
    .from("accounts")
    .update(updates)
    .eq("id", accountId);
  if (error) throw error;
}

// ─── fetch single account (full shape) ───────────────────────────────────────

export async function fetchAccount(id: string): Promise<Account | null> {
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

  // Build a map: area → { score, metrics[] }
  type ScoreRow = { area: string; score: number; kpi_data: unknown; health_metrics: Array<{ id: string; label: string; value: number; hint: string | null }> };
  const scoreMap = new Map<string, ScoreRow>(
    (scores ?? []).map((s) => [s.area, s as ScoreRow]),
  );

  const block = (area: string) => {
    const s = scoreMap.get(area);
    return s
      ? mapHealthBlock(s.score, s.health_metrics ?? [], s.kpi_data)
      : { score: 0, metrics: [], kpiData: null };
  };

  const flat = mapFlatAccount(acc as Record<string, unknown>);

  return {
    ...flat,
    stakeholders: (stakeholders ?? []).map((s) => ({
      name: s.name,
      role: s.role,
      influence: s.influence as Account["stakeholders"][number]["influence"],
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
      area: a.area as Account["activities"][number]["area"],
      title: a.title,
      owner: a.owner ?? "",
      due: a.due ?? "",
      status: a.status as Account["activities"][number]["status"],
      rag: a.rag as Account["activities"][number]["rag"],
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
  } as Account;
}

// ─── fetch escalations ────────────────────────────────────────────────────────

export async function fetchEscalations(accountId?: string): Promise<Escalation[]> {
  let q = supabase
    .from("escalations")
    .select("*, escalation_action_items(*)");

  if (accountId) q = q.eq("account_id", accountId);

  const { data, error } = await q;
  if (error) throw error;

  return (data ?? []).map((e) => ({
    id: e.id,
    accountId: e.account_id,
    title: e.title,
    priority: e.priority as Escalation["priority"],
    slaRemainingHours: e.sla_remaining_hours ?? 0,
    openedAt: e.opened_at ?? "",
    rca: e.rca ?? "",
    description: e.description ?? "",
    recommendation: e.recommendation ?? undefined,
    realisticCheck: e.realistic_check ?? undefined,
    clientFeedback: e.client_feedback ?? undefined,
    stakeholders: (e.stakeholders as string[]) ?? [],
    actionItems: (
      (e.escalation_action_items as Array<{ label: string; done: boolean }>) ?? []
    ).map((a) => ({ label: a.label, done: a.done })),
  }));
}

// ─── fetch opportunities ──────────────────────────────────────────────────────

export async function fetchOpportunities(accountId?: string): Promise<Opportunity[]> {
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
    confidence: o.confidence as Opportunity["confidence"],
    nextStep: o.next_step ?? "",
  }));
}

// ─── fetch notifications ──────────────────────────────────────────────────────

export async function fetchNotifications(): Promise<Notification[]> {
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
    type: n.type as Notification["type"],
    read: n.read,
  }));
}
