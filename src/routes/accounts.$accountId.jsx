import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ROLE_PERMISSIONS, formatCurrency } from "@/data/kam-data";
import {
  buildActivityTabModel,
  ACTIVITY_TAB_AREAS,
  isRetentionGrowthActivityArea,
} from "@/services/activity-tab";
import {
  removeDuplicateAiSuggestions,
  isDuplicateAiActivity,
} from "@/services/activity-ai-suggestions";
import { fetchFirefliesRequiredActionItems } from "@/services/fireflies-action-items.server";
import { fetchKamAiSuggestions } from "@/services/kam-ai-suggestions.server";
import { buildRetentionGrowthTabModel } from "@/services/retention-growth-tab";
import {
  fetchAccount,
  fetchEscalations,
  fetchOpportunities,
  fetchKamUsers,
  updateAccountKam,
  updateAccountKyc,
  updateHealthBlock,
  fetchAccountHistory,
  logAccountChanges,
  fetchActivityScoreHistory,
  fetchActivityRuleThresholdOverrides,
  upsertActivityScoreSnapshot,
  fetchActivityRuleActivities,
  createActivityRuleActivity,
  rejectActivityRuleSuggestion,
  submitActivityRuleEvidence,
  reviewActivityRuleEvidence,
  fetchFirefliesMeetingSummaries,
} from "@/services/db";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Building2,
  Calendar,
  User,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Circle,
  Users,
  DollarSign,
  Workflow,
  Swords,
  Clock,
  AlertTriangle,
  Lock,
  Maximize2,
  X,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Sparkles,
  Lightbulb,
  Loader2,
  ChevronDown,
} from "lucide-react";
export const Route = createFileRoute("/accounts/$accountId")({
  head: ({ params }) => ({
    meta: [
      { title: `Account ${params.accountId} — Aether KAM` },
      { name: "description", content: "Client 360 detail view." },
    ],
  }),
  loader: async ({ params }) => {
    const account = await fetchAccount(params.accountId);
    if (!account) throw notFound();
    return { account };
  },
  notFoundComponent: () => (
    <div className="p-12 text-center">
      <p className="text-muted-foreground">Account not found.</p>
      <Link to="/accounts" className="text-accent text-sm font-semibold mt-2 inline-block">
        Back to portfolio
      </Link>
    </div>
  ),
  errorComponent: ({ error }) => <div className="p-12 text-center text-crit">{error.message}</div>,
  component: AccountDetailPage,
});
const TABS = [
  "Overview",
  "Score Marking Matrics",
  "Activity to Increase Score",
  "Opportunities",
  "Retention VS Growth",
  "Educate client",
  "Escalation",
  "Meeting History",
  "Client History",
];
function AccountDetailPage() {
  const { account } = Route.useLoaderData();
  const { profile } = useAuth();
  const [tab, setTab] = useState("Overview");
  const { data: accountEscalations = [] } = useQuery({
    queryKey: ["escalations", account.id],
    queryFn: () => fetchEscalations(account.id),
  });
  const { data: accountOpportunities = [] } = useQuery({
    queryKey: ["opportunities", account.id],
    queryFn: () => fetchOpportunities(account.id),
  });
  const role = profile?.role ?? "KAM";
  const perms = ROLE_PERMISSIONS[role];
  const editable = perms.write && (perms.scope === "all" || account.id !== undefined);
  return (
    <div className="flex flex-col">
      <header className="bg-card border-b flex flex-col md:flex-row md:items-center md:justify-between px-4 md:px-8 py-3 gap-3 sticky top-14 md:top-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/accounts"
            className="size-8 rounded-md border flex items-center justify-center hover:bg-muted transition-colors shrink-0"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-semibold text-base md:text-lg truncate">{account.name}</h1>
              <span className="px-2 py-0.5 rounded bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-wider border border-accent/20">
                {account.tier}
              </span>
              <span className="px-2 py-0.5 rounded bg-muted text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Key Account
              </span>
            </div>
            <p className="text-[11px] md:text-xs text-muted-foreground truncate">
              {account.industry} · {account.region} · {account.engagementTenure} tenure
            </p>
          </div>
        </div>
        <div className="flex gap-3 items-center justify-end">
          {!editable && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
              <Lock className="size-3" /> Read-only ({role})
            </span>
          )}
          <div className="flex flex-col items-end gap-1">
            <button
              disabled={!editable}
              className="px-3 py-2 border text-xs font-semibold rounded-md hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Log Activity
            </button>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Last sync with Jira · 4m ago
            </p>
          </div>
        </div>
      </header>

      <div className="px-4 md:px-8 max-w-7xl w-full mx-auto">
        {/* Snapshot */}
        <section className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-8">
          <div className="bg-card p-6 rounded-xl border shadow-sm lg:col-span-1 flex flex-col items-center text-center">
            <div className="relative size-32 flex items-center justify-center mb-3">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="oklch(0.929 0.013 255)"
                  strokeWidth="10"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="oklch(0.7 0.17 152)"
                  strokeWidth="10"
                  strokeDasharray={`${(account.health / 100) * 264} 264`}
                  strokeLinecap="round"
                />
              </svg>
              <div>
                <div className="text-3xl font-bold">{account.health}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                  Health
                </div>
              </div>
            </div>
            <span
              className={`text-xs font-medium ${account.trend >= 0 ? "text-success" : "text-crit"} flex items-center gap-1`}
            >
              {account.trend >= 0 ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              {account.trend >= 0 ? "+" : ""}
              {account.trend}% this quarter
            </span>
          </div>

          <div className="bg-card p-6 rounded-xl border shadow-sm">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">
              Contract Value
            </p>
            <span className="text-3xl font-bold">{formatCurrency(account.contractValue)}</span>
            <p className="text-xs text-muted-foreground mt-2">
              Renews in {account.renewalDays} days
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">{account.contractType}</p>
          </div>

          <div className="bg-card p-6 rounded-xl border shadow-sm">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">
              Retention Risk
            </p>
            <span
              className={`text-3xl font-bold uppercase ${
                account.retentionRisk === "Low"
                  ? "text-success"
                  : account.retentionRisk === "Medium"
                    ? "text-warn"
                    : "text-crit"
              }`}
            >
              {account.retentionRisk}
            </span>
            <p className="text-xs text-muted-foreground mt-2">
              CSAT {account.csat.score.toFixed(1)}/10
            </p>
          </div>

          <div className="bg-card p-6 rounded-xl border shadow-sm">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">
              Growth Upside
            </p>
            <span className="text-3xl font-bold text-accent">
              {formatCurrency(account.growthUpside)}
            </span>
            <p className="text-xs text-muted-foreground mt-2">
              {account.whiteSpaceCount} white-space items
            </p>
          </div>
        </section>

        {/* Tabs */}
        <nav className="flex border-b mt-8 gap-6 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 text-sm font-medium whitespace-nowrap transition-colors ${tab === t ? "text-accent border-b-2 border-accent" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t}
            </button>
          ))}
        </nav>

        <div className="py-8 pb-16">
          {tab === "Overview" && <OverviewTab account={account} />}
          {tab === "Score Marking Matrics" && <ScoreMatricsTab account={account} />}
          {tab === "Activity to Increase Score" && (
            <ActivityTab
              account={account}
              opportunities={accountOpportunities}
              escalations={accountEscalations}
            />
          )}
          {tab === "Opportunities" && (
            <OpportunitiesTab
              account={account}
              opportunities={accountOpportunities}
              escalations={accountEscalations}
            />
          )}
          {tab === "Retention VS Growth" && (
            <RetentionGrowthTab
              account={account}
              opportunities={accountOpportunities}
              escalations={accountEscalations}
            />
          )}
          {tab === "Educate client" && <EducateTab account={account} />}
          {tab === "Escalation" && <EscalationsTab list={accountEscalations} />}
          {tab === "Meeting History" && <MeetingHistoryTab account={account} profile={profile} />}
          {tab === "Client History" && <ClientHistoryTab accountId={account.id} />}
        </div>
      </div>
    </div>
  );
}
function RetentionGrowthTabPlanner({ account, opportunities, escalations, profile }) {
  const role = profile?.role ?? "KAM";
  const isAssignedKam = role === "KAM" ? account.assignedKamId === profile?.id : false;
  const canAct = role === "Head of KAM" || (role === "KAM" && isAssignedKam);
  const canApproveCommercial = role === "Head of KAM";
  const isViewOnly = role === "CEO" || (role === "KAM" && !isAssignedKam);
  const model = useMemo(
    () => buildRetentionGrowthTabModel({ account, opportunities, escalations }),
    [account, escalations, opportunities],
  );
  const [resolvedItems, setResolvedItems] = useState({});
  const [draftPlans, setDraftPlans] = useState([]);
  const [draftOffers, setDraftOffers] = useState([]);
  const [planTarget, setPlanTarget] = useState(null);
  const [planForm, setPlanForm] = useState(createInitialReviewForm(null, profile?.name));
  const [offerTarget, setOfferTarget] = useState(null);
  const [offerForm, setOfferForm] = useState(createInitialReviewForm(null, profile?.name));
  const [evidenceTarget, setEvidenceTarget] = useState(null);

  useEffect(() => {
    setResolvedItems({});
    setDraftPlans([]);
    setDraftOffers([]);
    setPlanTarget(null);
    setPlanForm(createInitialReviewForm(null, profile?.name));
    setOfferTarget(null);
    setOfferForm(createInitialReviewForm(null, profile?.name));
    setEvidenceTarget(null);
  }, [account.id, profile?.name]);

  const activeApplicableGrowth = model.applicableGrowth.filter((item) => !resolvedItems[item.id]);
  const activeOpportunities = model.opportunities.filter((item) => !resolvedItems[item.id]);
  const activeOffers = model.recommendedOffers.filter((item) => !resolvedItems[item.id]);
  const draftQueue = useMemo(
    () => sortRetentionDrafts([...draftPlans, ...draftOffers]),
    [draftOffers, draftPlans],
  );

  function openPlanReview(kind, item) {
    setPlanTarget({ kind, item });
    setPlanForm(createInitialReviewForm(item, profile?.name));
  }

  function closePlanReview() {
    setPlanTarget(null);
    setPlanForm(createInitialReviewForm(null, profile?.name));
  }

  function confirmPlanReview() {
    if (!planTarget) return;
    const draft = buildRetentionPlanDraft(planTarget, planForm, canApproveCommercial);
    setDraftPlans((current) => [draft, ...current]);
    setResolvedItems((current) => ({
      ...current,
      [planTarget.item.id]: {
        status: "drafted",
        reviewedAt: new Date().toISOString(),
      },
    }));
    closePlanReview();
  }

  function openOfferReview(item) {
    setOfferTarget(item);
    setOfferForm(createInitialReviewForm(item, profile?.name));
  }

  function closeOfferReview() {
    setOfferTarget(null);
    setOfferForm(createInitialReviewForm(null, profile?.name));
  }

  function confirmOfferReview() {
    if (!offerTarget) return;
    const draft = buildRetentionOfferDraft(offerTarget, offerForm, canApproveCommercial);
    setDraftOffers((current) => [draft, ...current]);
    setResolvedItems((current) => ({
      ...current,
      [offerTarget.id]: {
        status: "drafted",
        reviewedAt: new Date().toISOString(),
      },
    }));
    closeOfferReview();
  }

  return (
    <div className="space-y-6">
      {isViewOnly && (
        <div className="rounded-xl border border-warn/30 bg-warn/5 px-4 py-3 text-sm">
          <p className="font-semibold text-warn">View-only planning surface</p>
          <p className="text-[12px] text-muted-foreground mt-1">
            {role === "CEO"
              ? "CEO can inspect services, opportunities, signals, and evidence here but cannot plan or draft offers."
              : "Only the assigned KAM can plan pitches or create draft offers for this account."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MiniStat label="Current services" value={`${model.currentServices.length} tracked`} />
        <MiniStat label="Whitespace" value={`${activeApplicableGrowth.length} services ready`} />
        <MiniStat label="Recommended offers" value={`${activeOffers.length} active`} />
        <MiniStat
          label="Top retention signal"
          value={model.retentionSignals[0]?.title ?? "No immediate retention alarm"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="text-sm font-bold">What we are offering & giving</h3>
            <p className="text-[11px] text-muted-foreground mt-1">
              Services already live, in flight, offered, or actively delivered for {account.name}.
            </p>
          </div>
          {model.currentServices.length ? (
            <div className="divide-y">
              {model.currentServices.map((service) => (
                <div key={service.id} className="px-6 py-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{service.service}</p>
                    <ServiceStatusBadge status={service.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">{service.description}</p>
                  <MiniStat label="Tracking note" value={service.trackingNote} />
                  <EvidencePreview
                    evidence={service.evidence}
                    onView={() =>
                      setEvidenceTarget({
                        title: service.service,
                        subtitle: `${service.status} service context`,
                        evidence: service.evidence,
                      })
                    }
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="px-6 py-6 text-xs text-muted-foreground">
              No current services are mapped for this account.
            </p>
          )}
        </div>

        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold">Growth - applicable but not offered</h3>
              <p className="text-[11px] text-muted-foreground mt-1">
                Relevant services and whitespace opportunities that fit this client now.
              </p>
            </div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
              {activeApplicableGrowth.length} open
            </span>
          </div>
          {activeApplicableGrowth.length ? (
            <div className="divide-y">
              {activeApplicableGrowth.map((item) => (
                <div key={item.id} className="px-6 py-4 space-y-3">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{item.service}</p>
                        <OfferTypeBadge type={item.offerType} />
                        <ConfidenceBadge confidence={item.confidence} />
                      </div>
                      <p className="text-xs text-muted-foreground">{item.reason}</p>
                      <div className="grid sm:grid-cols-2 gap-3 text-xs">
                        <MiniStat label="Potential value" value={getPotentialValueLabel(item)} />
                        <MiniStat label="Next step" value={item.nextStep} />
                      </div>
                      <EvidencePreview
                        evidence={item.evidence}
                        onView={() =>
                          setEvidenceTarget({
                            title: item.service,
                            subtitle: "Applicable but not offered",
                            evidence: item.evidence,
                          })
                        }
                      />
                    </div>
                    <div className="shrink-0">
                      <Button
                        size="sm"
                        disabled={!canAct}
                        onClick={() => openPlanReview("growth", item)}
                      >
                        Plan Pitch
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-6 py-6 text-xs text-muted-foreground">
              No applicable whitespace services are active for this account right now.
            </p>
          )}
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold">Opportunities related to the client</h3>
            <p className="text-[11px] text-muted-foreground mt-1">
              Client-specific opportunities surfaced from current services, Fireflies notes,
              whitespace, renewal context, and escalations.
            </p>
          </div>
          <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
            {activeOpportunities.length} active
          </span>
        </div>
        {activeOpportunities.length ? (
          <div className="divide-y">
            {activeOpportunities.map((opportunity) => (
              <div key={opportunity.id} className="px-6 py-4 space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{opportunity.title}</p>
                      <PriorityBadge priority={opportunity.priority} />
                      <ConfidenceBadge confidence={opportunity.confidence} />
                      {opportunity.category ? <AreaBadge area={opportunity.category} /> : null}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{opportunity.source}</p>
                    <div className="grid sm:grid-cols-3 gap-3 text-xs">
                      <MiniStat
                        label="Potential value"
                        value={getPotentialValueLabel(opportunity)}
                      />
                      <MiniStat label="Next step" value={opportunity.nextStep} />
                      <MiniStat
                        label="Priority"
                        value={`${opportunity.priority} · ${opportunity.confidence} confidence`}
                      />
                    </div>
                    <EvidencePreview
                      evidence={opportunity.evidence}
                      onView={() =>
                        setEvidenceTarget({
                          title: opportunity.title,
                          subtitle: `${opportunity.source} · ${opportunity.category}`,
                          evidence: opportunity.evidence,
                        })
                      }
                    />
                  </div>
                  <div className="shrink-0">
                    <Button
                      size="sm"
                      disabled={!canAct}
                      onClick={() => openPlanReview("opportunity", opportunity)}
                    >
                      {opportunity.actionLabel ?? "Pursue"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-6 py-6 text-xs text-muted-foreground">
            No client-specific opportunities are active in this planning cycle.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="text-sm font-bold">Retention signals</h3>
            <p className="text-[11px] text-muted-foreground mt-1">
              Signals that can affect renewal confidence, recovery planning, or client risk.
            </p>
          </div>
          {model.retentionSignals.length ? (
            <div className="divide-y">
              {model.retentionSignals.map((signal) => (
                <div key={signal.id} className="px-6 py-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{signal.title}</p>
                    <SignalLevelBadge level={signal.level} tone="risk" />
                  </div>
                  <p className="text-xs text-muted-foreground">{signal.reason}</p>
                  <MiniStat label="Recommended action" value={signal.recommendedAction} />
                  <EvidencePreview
                    evidence={signal.evidence}
                    onView={() =>
                      setEvidenceTarget({
                        title: signal.title,
                        subtitle: "Retention signal",
                        evidence: signal.evidence,
                      })
                    }
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="px-6 py-6 text-xs text-muted-foreground">
              No material retention signals are active right now.
            </p>
          )}
        </div>

        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="text-sm font-bold">Growth signals</h3>
            <p className="text-[11px] text-muted-foreground mt-1">
              Signals that point to expansion, whitespace, budget, or stakeholder interest.
            </p>
          </div>
          {model.growthSignals.length ? (
            <div className="divide-y">
              {model.growthSignals.map((signal) => (
                <div key={signal.id} className="px-6 py-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{signal.title}</p>
                    <SignalLevelBadge level={signal.level} tone="growth" />
                  </div>
                  <p className="text-xs text-muted-foreground">{signal.reason}</p>
                  <MiniStat label="Recommended action" value={signal.recommendedAction} />
                  <EvidencePreview
                    evidence={signal.evidence}
                    onView={() =>
                      setEvidenceTarget({
                        title: signal.title,
                        subtitle: "Growth signal",
                        evidence: signal.evidence,
                      })
                    }
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="px-6 py-6 text-xs text-muted-foreground">
              No material growth signals are active right now.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr,0.8fr] gap-6">
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold">Recommended Offers</h3>
              <p className="text-[11px] text-muted-foreground mt-1">
                AI-assisted offers built from whitespace, client interest, retention signals, and
                current service context.
              </p>
            </div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
              {activeOffers.length} active
            </span>
          </div>
          {activeOffers.length ? (
            <div className="divide-y">
              {activeOffers.map((offer) => (
                <div key={offer.id} className="px-6 py-4 space-y-3">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{offer.title}</p>
                        <OfferTypeBadge type={offer.offerType} />
                        <ConfidenceBadge confidence={offer.confidence} />
                        <ApprovalPill
                          required={offer.approvalRequired}
                          approverRole={offer.approverRole}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{offer.reason}</p>
                      <div className="grid sm:grid-cols-3 gap-3 text-xs">
                        <MiniStat label="Potential value" value={getPotentialValueLabel(offer)} />
                        <MiniStat label="Allowed offer" value={offer.allowedValue} />
                        <MiniStat label="Next step" value={offer.nextStep} />
                      </div>
                      <EvidencePreview
                        evidence={offer.evidence}
                        onView={() =>
                          setEvidenceTarget({
                            title: offer.title,
                            subtitle: `${offer.offerType} offer`,
                            evidence: offer.evidence,
                          })
                        }
                      />
                    </div>
                    <div className="shrink-0">
                      <Button size="sm" disabled={!canAct} onClick={() => openOfferReview(offer)}>
                        Create Draft Offer
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-6 py-6 text-xs text-muted-foreground">
              No recommended offers are active for this account right now.
            </p>
          )}
        </div>

        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="text-sm font-bold">Commercial Guardrails</h3>
            <p className="text-[11px] text-muted-foreground mt-1">
              What can be offered, how much is allowed, and when Head of KAM approval is needed.
            </p>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <MiniStat label="POC limit" value={model.guardrails.summary.pocLimit} />
              <MiniStat label="Discount limit" value={model.guardrails.summary.discountLimit} />
              <MiniStat
                label="Service credit"
                value={model.guardrails.summary.serviceCreditLimit}
              />
              <MiniStat label="KAM proposal limit" value={model.guardrails.summary.proposalLimit} />
            </div>
            <p className="text-xs text-muted-foreground">{model.guardrails.narrative}</p>
            <div className="space-y-3">
              {model.guardrails.rules.map((rule) => (
                <div key={rule.id} className="rounded-xl border p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <OfferTypeBadge type={rule.offer} />
                    <ApprovalPill
                      required={rule.approvalRequired !== "No"}
                      approverRole={rule.approverRole}
                    />
                  </div>
                  <p className="text-sm font-semibold">{rule.allowedOffer}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <MiniStat label="Allowed value" value={rule.allowedValue} />
                    <MiniStat label="Discount limit" value={rule.discountLimit} />
                    <MiniStat label="Service credit" value={rule.serviceCreditLimit} />
                    <MiniStat label="POC limit" value={rule.pocLimit} />
                  </div>
                  <p className="text-xs text-muted-foreground">{rule.reason}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="text-sm font-bold">Not applicable to this client</h3>
          <p className="text-[11px] text-muted-foreground mt-1">
            Services in this list are filtered out from growth opportunities, offers, and pitch
            suggestions.
          </p>
        </div>
        {model.notApplicable.length ? (
          <div className="divide-y">
            {model.notApplicable.map((item) => (
              <div key={item.id} className="px-6 py-4 space-y-3">
                <p className="text-sm font-semibold">{item.service}</p>
                <p className="text-xs text-muted-foreground">{item.reason}</p>
                <EvidencePreview
                  evidence={item.evidence}
                  onView={() =>
                    setEvidenceTarget({
                      title: item.service,
                      subtitle: "Not applicable service",
                      evidence: item.evidence,
                    })
                  }
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="px-6 py-6 text-xs text-muted-foreground">
            No services are currently blocked from pitching for this account.
          </p>
        )}
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="text-sm font-bold">Draft Plans & Offers</h3>
          <p className="text-[11px] text-muted-foreground mt-1">
            Review-ready local drafts created from whitespace, opportunities, and recommended
            offers.
          </p>
        </div>
        {draftQueue.length ? (
          <div className="divide-y">
            {draftQueue.map((draft) => (
              <div key={draft.id} className="px-6 py-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{draft.title}</p>
                  <DraftKindBadge kind={draft.kind} />
                  {draft.offerType ? <OfferTypeBadge type={draft.offerType} /> : null}
                </div>
                <div className="grid sm:grid-cols-3 gap-3 text-xs">
                  <MiniStat label="Owner" value={draft.owner} />
                  <MiniStat label="Due date" value={draft.dueDate} />
                  <MiniStat label="Potential value" value={draft.potentialValueLabel} />
                </div>
                <MiniStat label="Next step" value={draft.nextStep} />
                <p className="text-xs text-muted-foreground">{draft.reason}</p>
                <p className="text-[11px] font-medium text-accent">{draft.approvalState}</p>
                <EvidencePreview
                  evidence={draft.evidence}
                  onView={() =>
                    setEvidenceTarget({
                      title: draft.title,
                      subtitle: draft.kind === "offer" ? "Draft offer" : "Draft plan",
                      evidence: draft.evidence,
                    })
                  }
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="px-6 py-6 text-xs text-muted-foreground">
            No draft pitches or offers have been created in this session yet.
          </p>
        )}
      </div>

      <RetentionPlanReviewSheet
        target={planTarget}
        form={planForm}
        onChange={setPlanForm}
        onClose={closePlanReview}
        onConfirm={confirmPlanReview}
      />

      <RetentionOfferReviewSheet
        target={offerTarget}
        form={offerForm}
        onChange={setOfferForm}
        onClose={closeOfferReview}
        onConfirm={confirmOfferReview}
      />

      <EvidenceDetailSheet target={evidenceTarget} onClose={() => setEvidenceTarget(null)} />
    </div>
  );
}

function ServiceStatusBadge({ status }) {
  const styles = {
    Live: "bg-success/10 text-success",
    Delivered: "bg-accent/10 text-accent",
    "In Flight": "bg-warn/10 text-warn",
    Offered: "bg-muted text-muted-foreground",
  };

  return (
    <span
      className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${styles[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}

function OfferTypeBadge({ type }) {
  const styles = {
    POC: "bg-accent/10 text-accent",
    Upsell: "bg-success/10 text-success",
    "Cross-sell": "bg-success/10 text-success",
    Renewal: "bg-warn/10 text-warn",
    "Service Credit": "bg-warn/10 text-warn",
    Discount: "bg-warn/10 text-warn",
  };

  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-1 ${styles[type] ?? "bg-muted text-muted-foreground"}`}
    >
      {type}
    </span>
  );
}

function ApprovalPill({ required, approverRole }) {
  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-1 ${
        required ? "bg-warn/10 text-warn" : "bg-success/10 text-success"
      }`}
    >
      {required ? `Approval · ${approverRole ?? "Required"}` : "No approval"}
    </span>
  );
}

function SignalLevelBadge({ level, tone }) {
  const styles =
    tone === "risk"
      ? {
          High: "bg-crit/10 text-crit",
          Medium: "bg-warn/10 text-warn",
          Low: "bg-success/10 text-success",
        }
      : {
          High: "bg-success/10 text-success",
          Medium: "bg-accent/10 text-accent",
          Low: "bg-muted text-muted-foreground",
        };

  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-1 ${styles[level] ?? "bg-muted text-muted-foreground"}`}
    >
      {level}
    </span>
  );
}

function DraftKindBadge({ kind }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-accent/10 text-accent px-2 py-1">
      {kind === "offer" ? "Draft Offer" : "Draft Plan"}
    </span>
  );
}

function getPotentialValueLabel(item) {
  return item.potentialValueLabel ?? `+${formatCurrency(item.potentialValue ?? 0)}`;
}

function getDraftApprovalState(item, canApproveCommercial) {
  if (!item.approvalRequired) return "Within KAM authority";
  if (canApproveCommercial) return "Within Head of KAM authority";
  return `Pending ${item.approverRole ?? "Head of KAM"} approval`;
}

function buildRetentionPlanDraft(target, form, canApproveCommercial) {
  const item = target.item;

  return {
    id: `draft-plan-${item.id}`,
    kind: "plan",
    title: form.title.trim(),
    owner: form.owner.trim(),
    dueDate: formatDraftDate(form.dueDate),
    nextStep: form.nextStep.trim(),
    potentialValueLabel: getPotentialValueLabel(item),
    reason: item.reason ?? item.title,
    evidence: item.evidence ?? [],
    approvalState: getDraftApprovalState(item, canApproveCommercial),
    offerType: item.offerType ?? null,
    createdAt: new Date().toISOString(),
  };
}

function buildRetentionOfferDraft(item, form, canApproveCommercial) {
  return {
    id: `draft-offer-${item.id}`,
    kind: "offer",
    title: form.title.trim(),
    owner: form.owner.trim(),
    dueDate: formatDraftDate(form.dueDate),
    nextStep: form.nextStep.trim(),
    potentialValueLabel: getPotentialValueLabel(item),
    reason: item.reason ?? item.title,
    evidence: item.evidence ?? [],
    offerType: item.offerType,
    approvalState: getDraftApprovalState(item, canApproveCommercial),
    createdAt: new Date().toISOString(),
  };
}

function sortRetentionDrafts(drafts) {
  return [...drafts].sort((left, right) => {
    const leftDate = new Date(left.createdAt || 0).getTime();
    const rightDate = new Date(right.createdAt || 0).getTime();
    return rightDate - leftDate;
  });
}

function RetentionPlanReviewSheet({ target, form, onChange, onClose, onConfirm }) {
  const item = target?.item ?? null;
  const actionLabel =
    target?.kind === "opportunity"
      ? (item?.actionLabel ?? "Pursue")
      : target?.kind === "growth"
        ? "Plan Pitch"
        : "Review";

  return (
    <Sheet open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        {item && (
          <>
            <SheetHeader>
              <SheetTitle>{actionLabel} draft plan</SheetTitle>
              <SheetDescription>
                AI suggests the next growth or retention move here. Review the draft before it
                becomes an internal plan item.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 py-5">
              <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {item.category ? <AreaBadge area={item.category} /> : null}
                  {item.priority ? <PriorityBadge priority={item.priority} /> : null}
                  {item.offerType ? <OfferTypeBadge type={item.offerType} /> : null}
                  {item.confidence ? <ConfidenceBadge confidence={item.confidence} /> : null}
                  <ApprovalPill
                    required={Boolean(item.approvalRequired)}
                    approverRole={item.approverRole}
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold">{item.title ?? item.service}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.reason ?? item.nextStep}
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 text-xs">
                  <MiniStat label="Potential value" value={getPotentialValueLabel(item)} />
                  <MiniStat label="Next step" value={item.nextStep} />
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="retention-plan-title">Title</Label>
                  <Input
                    id="retention-plan-title"
                    value={form.title}
                    onChange={(event) =>
                      onChange((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="retention-plan-owner">Owner</Label>
                    <Input
                      id="retention-plan-owner"
                      value={form.owner}
                      onChange={(event) =>
                        onChange((current) => ({ ...current, owner: event.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="retention-plan-due-date">Due date</Label>
                    <Input
                      id="retention-plan-due-date"
                      type="date"
                      value={form.dueDate}
                      onChange={(event) =>
                        onChange((current) => ({ ...current, dueDate: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="retention-plan-next-step">Next step</Label>
                  <Textarea
                    id="retention-plan-next-step"
                    rows={4}
                    value={form.nextStep}
                    onChange={(event) =>
                      onChange((current) => ({ ...current, nextStep: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Evidence
                </p>
                <div className="space-y-3">
                  {(item.evidence ?? []).map((entry, index) => (
                    <div
                      key={`${entry.source}-${index}`}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          {entry.sourceType}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{entry.date}</span>
                      </div>
                      <p className="text-sm font-medium">{entry.source}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {entry.excerpt}
                      </p>
                      <p className="text-[11px] text-foreground">{entry.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <SheetFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={onConfirm}
                disabled={!form.title.trim() || !form.owner.trim() || !form.nextStep.trim()}
              >
                Save draft plan
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function RetentionOfferReviewSheet({ target, form, onChange, onClose, onConfirm }) {
  return (
    <Sheet open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        {target && (
          <>
            <SheetHeader>
              <SheetTitle>Create draft offer</SheetTitle>
              <SheetDescription>
                Review the recommended offer, adjust the internal draft, and mark any approval
                dependency before it moves forward.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 py-5">
              <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <OfferTypeBadge type={target.offerType} />
                  <ConfidenceBadge confidence={target.confidence} />
                  <ApprovalPill
                    required={Boolean(target.approvalRequired)}
                    approverRole={target.approverRole}
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold">{target.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{target.reason}</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 text-xs">
                  <MiniStat label="Potential value" value={getPotentialValueLabel(target)} />
                  <MiniStat label="Allowed offer" value={target.allowedValue} />
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="retention-offer-title">Offer title</Label>
                  <Input
                    id="retention-offer-title"
                    value={form.title}
                    onChange={(event) =>
                      onChange((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="retention-offer-owner">Owner</Label>
                    <Input
                      id="retention-offer-owner"
                      value={form.owner}
                      onChange={(event) =>
                        onChange((current) => ({ ...current, owner: event.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="retention-offer-due-date">Due date</Label>
                    <Input
                      id="retention-offer-due-date"
                      type="date"
                      value={form.dueDate}
                      onChange={(event) =>
                        onChange((current) => ({ ...current, dueDate: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="retention-offer-next-step">Next step</Label>
                  <Textarea
                    id="retention-offer-next-step"
                    rows={4}
                    value={form.nextStep}
                    onChange={(event) =>
                      onChange((current) => ({ ...current, nextStep: event.target.value }))
                    }
                  />
                </div>

                {target.approvalRequired && (
                  <div className="rounded-xl border border-warn/30 bg-warn/5 p-4">
                    <p className="text-sm font-semibold text-warn">
                      Pending {target.approverRole ?? "Head of KAM"} approval
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      This draft can be created by the KAM, but it should not become a final
                      client-facing offer until the required approver reviews it.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Evidence
                </p>
                <div className="space-y-3">
                  {(target.evidence ?? []).map((entry, index) => (
                    <div
                      key={`${entry.source}-${index}`}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          {entry.sourceType}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{entry.date}</span>
                      </div>
                      <p className="text-sm font-medium">{entry.source}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {entry.excerpt}
                      </p>
                      <p className="text-[11px] text-foreground">{entry.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <SheetFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={onConfirm}
                disabled={!form.title.trim() || !form.owner.trim() || !form.nextStep.trim()}
              >
                Create draft offer
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
/* ============================== TAB 1: Overview (KYC) ============================== */
function OverviewTab({ account }) {
  const { profile } = useAuth();
  const role = profile?.role ?? "KAM";
  const isHead = role === "Head of KAM" || role === "CEO";
  const editable = ROLE_PERMISSIONS[role].write;
  const queryClient = useQueryClient();
  const { data: kamUsers = [] } = useQuery({
    queryKey: ["kamUsers"],
    queryFn: fetchKamUsers,
    enabled: isHead,
  });
  const [assignedKamId, setAssignedKamId] = useState(account.assignedKamId ?? null);
  const { mutate: assignKam } = useMutation({
    mutationFn: async (kamId) => {
      const oldName = kamUsers.find((u) => u.id === assignedKamId)?.name ?? "Unassigned";
      const newName = kamUsers.find((u) => u.id === kamId)?.name ?? kamId;
      await updateAccountKam(account.id, kamId);
      await logAccountChanges(
        account.id,
        [{ field: "Assigned KAM", oldValue: oldName, newValue: newName }],
        profile?.name ?? "Unknown",
      );
    },
    onSuccess: (_, kamId) => {
      setAssignedKamId(kamId);
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
  const initialFields = useMemo(
    () => ({
      industry: account.industry,
      business: account.businessInfo,
      history: account.clientHistory,
      revenue: account.revenue,
      mrrArr: account.isStartup && account.mrrArr ? account.mrrArr : "N/A — not a startup client",
      primary: account.primaryContact.name,
      tenure: account.engagementTenure,
      team: String(account.teamSize),
      competitors: account.competitors.join(", "),
      flow: account.mainBusinessFlow,
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }),
    [account.id],
  );
  const [fields, setFields] = useState(initialFields);
  const [savedSnapshot, setSavedSnapshot] = useState(initialFields);
  const [showSaved, setShowSaved] = useState(false);
  const savedTimerRef = useRef(null);
  const isDirty = JSON.stringify(fields) !== JSON.stringify(savedSnapshot);
  // Auto-hide the "saved" confirmation after 3 s
  useEffect(() => {
    if (showSaved) {
      savedTimerRef.current = setTimeout(() => setShowSaved(false), 3000);
    }
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, [showSaved]);
  const KYC_LABELS = {
    industry: "Industry Info",
    business: "Business Info",
    history: "Client History Notes",
    revenue: "Revenue Info",
    mrrArr: "MRR / ARR",
    primary: "Primary Contact",
    tenure: "Engagement Tenure",
    team: "Team Size",
    competitors: "Competitors",
    flow: "Main Business Flow",
  };
  const { mutate: saveKyc, isPending: savingKyc } = useMutation({
    mutationFn: async () => {
      const teamNum = parseInt(fields.team);
      await updateAccountKyc(account.id, {
        industry: fields.industry,
        business_info: fields.business,
        client_history: fields.history,
        revenue: fields.revenue,
        mrr_arr: fields.mrrArr.startsWith("N/A") ? null : fields.mrrArr,
        primary_contact_name: fields.primary,
        engagement_tenure: fields.tenure,
        ...(isNaN(teamNum) ? {} : { team_size: teamNum }),
        competitors: fields.competitors
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        main_business_flow: fields.flow,
      });
      const diffs = Object.keys(fields)
        .filter((k) => fields[k] !== savedSnapshot[k])
        .map((k) => ({
          field: KYC_LABELS[k] ?? k,
          oldValue: savedSnapshot[k],
          newValue: fields[k],
        }));
      await logAccountChanges(account.id, diffs, profile?.name ?? "Unknown");
    },
    onSuccess: () => {
      setSavedSnapshot({ ...fields });
      setShowSaved(true);
    },
  });
  // OCR file state
  const [ocrFile, setOcrFile] = useState(null);
  const [ocrStatus, setOcrStatus] = useState("idle");
  function runOcrSimulation() {
    if (!ocrFile) return;
    setOcrStatus("processing");
    // Front-end simulation only — real OCR will be wired later
    setTimeout(() => {
      setFields((f) => ({
        ...f,
        industry: `${account.industry} · ${account.region} (auto-filled from "${ocrFile.name}")`,
        business: `${account.businessInfo} — extracted from uploaded document.`,
      }));
      setOcrStatus("done");
    }, 1200);
  }
  return (
    <div className="space-y-6">
      {/* KYC Header */}
      <div className="bg-gradient-to-br from-primary/5 to-accent/5 border rounded-xl p-6 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-accent mb-1">
            Step 1 of 6
          </p>
          <h2 className="text-xl font-bold">Know Your Client (KYC)</h2>
          <p className="text-xs text-muted-foreground mt-1">
            All 12 mandatory KYC fields for this key account. Every field is editable.
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-md bg-success/10 text-success text-[11px] font-bold uppercase tracking-wider border border-success/20 w-fit">
          ✓ Key Account
        </span>
      </div>

      {/* OCR Auto-fill upload */}
      <div className="border rounded-xl p-5 bg-card">
        <div className="flex items-start gap-3 mb-3">
          <span className="size-9 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <Sparkles className="size-4" />
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold">OCR Auto-fill from Document</h3>
            <p className="text-[11px] text-muted-foreground">
              Upload a brief, RFP, NDA, deck or scanned card. We'll extract industry, business,
              stakeholders, revenue and auto-populate any KYC field that's empty or unverified.
              (Front-end preview — OCR engine wires up later.)
            </p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <label className="flex-1 flex items-center gap-2 border-2 border-dashed rounded-md px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
            <Upload className="size-4 text-muted-foreground" />
            <span className="text-xs truncate">
              {ocrFile ? ocrFile.name : "Choose a file (PDF, PNG, JPG, DOCX)…"}
            </span>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.docx"
              onChange={(e) => {
                setOcrFile(e.target.files?.[0] ?? null);
                setOcrStatus("idle");
              }}
            />
          </label>
          <button
            onClick={runOcrSimulation}
            disabled={!ocrFile || !editable || ocrStatus === "processing"}
            className="px-4 py-2.5 bg-accent text-white text-xs font-bold rounded-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Sparkles className="size-3.5" />
            {ocrStatus === "processing"
              ? "Extracting…"
              : ocrStatus === "done"
                ? "Re-extract"
                : "Extract & Auto-fill"}
          </button>
        </div>
        {ocrStatus === "done" && (
          <p className="text-[11px] text-success mt-2 flex items-center gap-1">
            <CheckCircle2 className="size-3" />
            Extraction complete — 2 KYC fields updated. Review highlighted fields below.
          </p>
        )}
      </div>

      {/* Assigned KAM */}
      <div className="border rounded-xl p-5 bg-card flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="size-9 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <User className="size-4" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Assigned KAM
            </p>
            {isHead ? (
              <select
                value={assignedKamId ?? ""}
                onChange={(e) => assignKam(e.target.value)}
                className="mt-1 text-sm font-semibold bg-transparent border-b border-muted focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="" disabled>
                  — unassigned —
                </option>
                {kamUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm font-semibold mt-0.5">
                {kamUsers.find((u) => u.id === assignedKamId)?.name ?? profile?.name ?? "—"}
              </p>
            )}
          </div>
        </div>
        {isHead && (
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
            Head of KAM can reassign
          </span>
        )}
      </div>

      {/* 12-field KYC grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <KycField
          n={1}
          label="Account Status"
          icon={<CheckCircle2 className="size-4" />}
          editable={false}
        >
          <span className="text-success font-semibold">Key Account</span>
          <span className="text-muted-foreground">
            {" "}
            · all accounts in our system are key accounts
          </span>
        </KycField>

        <KycField
          n={2}
          label="Industry Info"
          icon={<Building2 className="size-4" />}
          editable={editable}
          value={fields.industry}
          onChange={(v) => setFields((f) => ({ ...f, industry: v }))}
        />

        <KycField
          n={3}
          label="Business Info"
          icon={<Workflow className="size-4" />}
          editable={editable}
          value={fields.business}
          onChange={(v) => setFields((f) => ({ ...f, business: v }))}
          multiline
        />

        <KycField
          n={4}
          label="Client History"
          icon={<Clock className="size-4" />}
          editable={editable}
          value={fields.history}
          onChange={(v) => setFields((f) => ({ ...f, history: v }))}
          multiline
        />

        <KycField
          n={5}
          label="Stakeholders Info"
          icon={<Users className="size-4" />}
          editable={false}
        >
          <p className="font-semibold">{account.stakeholders.length} stakeholders</p>
          <ul className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
            {account.stakeholders.slice(0, 3).map((s) => (
              <li key={s.name}>
                · {s.name} — {s.role} <span className="text-accent">({s.influence})</span>
              </li>
            ))}
          </ul>
        </KycField>

        <KycField
          n={6}
          label="Revenue Info"
          icon={<DollarSign className="size-4" />}
          editable={editable}
          value={fields.revenue}
          onChange={(v) => setFields((f) => ({ ...f, revenue: v }))}
        />

        <KycField
          n={7}
          label="MRR / ARR (Startups)"
          icon={<TrendingUp className="size-4" />}
          editable={editable}
          value={fields.mrrArr}
          onChange={(v) => setFields((f) => ({ ...f, mrrArr: v }))}
        />

        <KycField
          n={8}
          label="Person Info (Primary)"
          icon={<User className="size-4" />}
          editable={editable}
          value={fields.primary}
          onChange={(v) => setFields((f) => ({ ...f, primary: v }))}
        />

        <KycField
          n={9}
          label="Engagement Tenure"
          icon={<Calendar className="size-4" />}
          editable={editable}
          value={fields.tenure}
          onChange={(v) => setFields((f) => ({ ...f, tenure: v }))}
        />

        <KycField
          n={10}
          label="Team Size"
          icon={<Users className="size-4" />}
          editable={editable}
          value={fields.team}
          onChange={(v) => setFields((f) => ({ ...f, team: v }))}
        />

        <KycField
          n={11}
          label="Competitors"
          icon={<Swords className="size-4" />}
          editable={editable}
          value={fields.competitors}
          onChange={(v) => setFields((f) => ({ ...f, competitors: v }))}
        />

        <KycField
          n={12}
          label="Main Business Flow"
          icon={<Workflow className="size-4" />}
          editable={editable}
          wide
          value={fields.flow}
          onChange={(v) => setFields((f) => ({ ...f, flow: v }))}
          multiline
        />
      </div>

      {/* Fixed save bar — visible while dirty or briefly after save */}
      {editable && (isDirty || showSaved) && (
        <div className="fixed bottom-0 left-0 md:left-64 right-0 z-50 border-t bg-card px-6 py-3 flex items-center justify-between shadow-lg">
          <p
            className={`text-xs font-medium ${showSaved && !isDirty ? "text-success" : "text-muted-foreground"}`}
          >
            {showSaved && !isDirty
              ? "✓ KYC fields saved successfully"
              : "You have unsaved changes in KYC fields"}
          </p>
          <div className="flex gap-2">
            {isDirty && (
              <button
                onClick={() => {
                  setFields(savedSnapshot);
                  setShowSaved(false);
                }}
                className="px-3 py-1.5 text-xs border rounded-md hover:bg-muted transition-colors"
              >
                Discard
              </button>
            )}
            {isDirty && (
              <button
                onClick={() => saveKyc()}
                disabled={savingKyc}
                className="px-3 py-1.5 text-xs bg-accent text-white rounded-md disabled:opacity-50 flex items-center gap-1.5 transition-opacity"
              >
                {savingKyc ? (
                  <>
                    <Loader2 className="size-3 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3" /> Save KYC
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Full stakeholders detail */}
      <Card title="Stakeholders — full detail">
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b">
                <th className="pb-2">Name</th>
                <th className="pb-2">Role</th>
                <th className="pb-2">Influence</th>
                <th className="pb-2 text-right">Last contact</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {account.stakeholders.map((s) => (
                <tr key={s.name}>
                  <td className="py-3 flex items-center gap-2">
                    <div className="size-7 rounded-full bg-primary/5 border flex items-center justify-center font-bold text-[10px]">
                      {s.name
                        .split(" ")
                        .map((p) => p[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <span className="font-semibold text-xs">{s.name}</span>
                  </td>
                  <td className="py-3 text-xs text-muted-foreground">{s.role}</td>
                  <td className="py-3">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        s.influence === "Champion"
                          ? "bg-success/10 text-success"
                          : s.influence === "Decision Maker"
                            ? "bg-accent/10 text-accent"
                            : s.influence === "Blocker"
                              ? "bg-crit/10 text-crit"
                              : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {s.influence}
                    </span>
                  </td>
                  <td className="py-3 text-right text-[11px] text-muted-foreground">
                    {s.lastContact ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
function KycField({ n, label, icon, children, wide, editable, value, onChange, multiline }) {
  const [editing, setEditing] = useState(false);
  return (
    <div
      className={`bg-card border rounded-xl p-4 hover:border-accent/40 transition-colors group ${wide ? "md:col-span-2 lg:col-span-3" : ""}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="size-6 rounded-md bg-accent/10 text-accent flex items-center justify-center text-[10px] font-bold font-mono">
          {String(n).padStart(2, "0")}
        </span>
        <span className="text-muted-foreground">{icon}</span>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex-1">
          {label}
        </p>
        {editable && onChange && (
          <button
            onClick={() => setEditing((e) => !e)}
            className="size-6 rounded hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-accent transition-colors"
            aria-label={editing ? "Save" : "Edit"}
          >
            {editing ? <CheckCircle2 className="size-3.5" /> : <Pencil className="size-3" />}
          </button>
        )}
      </div>
      <div className="text-xs">
        {value !== undefined && onChange ? (
          editing ? (
            multiline ? (
              <textarea
                autoFocus
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={() => setEditing(false)}
                rows={3}
                className="w-full bg-background border rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
              />
            ) : (
              <input
                autoFocus
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={() => setEditing(false)}
                className="w-full bg-background border rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
              />
            )
          ) : (
            <p className="leading-relaxed whitespace-pre-wrap">
              {value || (
                <span className="italic text-muted-foreground">— empty — click ✎ to add</span>
              )}
            </p>
          )
        ) : (
          children
        )}
      </div>
    </div>
  );
}
/* ============================== TAB 2: Score Marking Matrics ============================== */
function ScoreMatricsTab({ account }) {
  const [expanded, setExpanded] = useState(null);
  const open = (title, hint, block, area) => setExpanded({ title, hint, block, area });
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ScoreCard
          title="Overall Health"
          score={account.health / 10}
          subtitle={`Trend ${account.trend >= 0 ? "+" : ""}${account.trend}%`}
        />
        <ScoreCard title="CSAT" score={account.csat.score} subtitle="Customer satisfaction" />
        <ScoreCard
          title="Risk"
          score={account.riskScoring.score}
          subtitle="Lower = riskier"
          inverse
        />
      </div>

      <ScoreBlock
        title="Relationship Health"
        hint="Meetups, monthly meetings, director meetings, cooperation"
        block={account.relationshipHealth}
        onExpand={() =>
          open(
            "Relationship Health",
            "Meetups, monthly meetings, director meetings, cooperation",
            account.relationshipHealth,
            "relationship",
          )
        }
      />
      <ScoreBlock
        title="Project Health"
        hint="Deliverables, feedback, quality/defects, scope & change"
        block={account.projectHealth}
        onExpand={() =>
          open(
            "Project Health",
            "Deliverables, feedback, quality/defects, scope & change",
            account.projectHealth,
            "project",
          )
        }
      />
      <ScoreBlock
        title="White Space Analysis"
        hint="Meeting cadence, upsell capacity, services penetration"
        block={account.whiteSpace}
        onExpand={() =>
          open(
            "White Space Analysis",
            "Meeting cadence, upsell capacity, services penetration",
            account.whiteSpace,
            "white_space",
          )
        }
      />

      <ContractScoringBlock account={account} />

      <ScoreBlock
        title="Customer Satisfaction Score"
        hint="NPS, surveys, ticket CSAT, exec sentiment"
        block={account.csat}
        onExpand={() =>
          open(
            "Customer Satisfaction Score",
            "NPS, surveys, ticket CSAT, exec sentiment",
            account.csat,
            "csat",
          )
        }
      />
      <ScoreBlock
        title="Risk Scoring"
        hint="Competitors, geopolitical, POC churn, payments, C-level changes"
        block={account.riskScoring}
        onExpand={() =>
          open(
            "Risk Scoring",
            "Competitors, geopolitical, POC churn, payments, C-level changes",
            account.riskScoring,
            "risk",
          )
        }
      />
      <ResourceHealthBlock
        account={account}
        onExpand={() =>
          open(
            "Resources Health",
            "Backup, leaves, critical roles, team size",
            account.resourceHealth,
            "resource",
          )
        }
      />
      <ScoreBlock
        title="Financial Health"
        hint="Revenue generation & resource allocation efficiency"
        block={account.financialHealth}
        onExpand={() =>
          open(
            "Financial Health",
            "Revenue generation & resource allocation efficiency",
            account.financialHealth,
            "financial",
          )
        }
      />

      {expanded && (
        <KpiEditorModal
          title={expanded.title}
          hint={expanded.hint}
          block={expanded.block}
          area={expanded.area}
          accountId={account.id}
          onClose={() => setExpanded(null)}
        />
      )}
    </div>
  );
}
function ScoreCard({ title, score, subtitle, inverse }) {
  const good = inverse ? score >= 7 : score >= 8;
  const ok = inverse ? score >= 5 : score >= 6;
  const color = good ? "text-success" : ok ? "text-warn" : "text-crit";
  return (
    <div className="bg-card border rounded-xl p-5">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
        {title}
      </p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>
        {score.toFixed(1)}
        <span className="text-base text-muted-foreground">/10</span>
      </p>
      {subtitle && <p className="text-[11px] text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}
function ScoreBlock({ title, hint, block, onExpand }) {
  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="px-4 md:px-6 py-4 border-b flex justify-between items-start gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold">{title}</h3>
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <p className="text-2xl font-bold">
            {block.score.toFixed(1)}
            <span className="text-xs text-muted-foreground">/10</span>
          </p>
          {onExpand && (
            <button
              onClick={onExpand}
              className="size-8 rounded-md border flex items-center justify-center hover:bg-accent hover:text-white transition-colors"
              aria-label={`Expand ${title}`}
              title="Open KPI editor"
            >
              <Maximize2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4">
        {block.metrics.map((m) => (
          <Metric key={m.label} m={m} />
        ))}
      </div>
    </div>
  );
}
function KpiEditorModal({ title, hint, block, area, accountId, onClose }) {
  const { profile } = useAuth();
  const editable = ROLE_PERMISSIONS[profile?.role ?? "KAM"].write;
  const editorUser = profile?.name ?? "Unknown";
  const router = useRouter();
  // Load from persisted kpiData if available, otherwise seed from metrics.
  const [sections, setSections] = useState(() => {
    if (block.kpiData) return block.kpiData;
    return block.metrics.map((m, i) => ({
      id: `kpi-${i}`,
      metricId: m.id,
      name: m.label,
      fields: [
        { id: `${i}-a`, label: "Monthly meeting held on schedule", weight: 50, checked: true },
        { id: `${i}-b`, label: "Director-level participation", weight: 25, checked: false },
        {
          id: `${i}-c`,
          label: "Action items closed before next cycle",
          weight: 25,
          checked: false,
        },
      ],
    }));
  });
  function updateSection(id, fn) {
    setSections((prev) => prev.map((s) => (s.id === id ? fn(s) : s)));
  }
  function addField(sectionId) {
    if (!editable) return;
    updateSection(sectionId, (s) => ({
      ...s,
      fields: [
        ...s.fields,
        { id: `${sectionId}-${Date.now()}`, label: "New field", weight: 0, checked: false },
      ],
    }));
  }
  function removeField(sectionId, fieldId) {
    if (!editable) return;
    updateSection(sectionId, (s) => ({ ...s, fields: s.fields.filter((f) => f.id !== fieldId) }));
  }
  function updateField(sectionId, fieldId, patch) {
    if (!editable) return;
    updateSection(sectionId, (s) => ({
      ...s,
      fields: s.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)),
    }));
  }
  // dynamic scoring per section
  const sectionScores = useMemo(
    () =>
      sections.map((s) => {
        const totalWeight = s.fields.reduce((acc, f) => acc + (Number(f.weight) || 0), 0);
        const earned = s.fields.reduce(
          (acc, f) => acc + (f.checked ? Number(f.weight) || 0 : 0),
          0,
        );
        const pct = totalWeight > 0 ? (earned / totalWeight) * 100 : 0;
        const scoreOutOfFive = (pct / 100) * 5;
        return { id: s.id, totalWeight, earned, pct, scoreOutOfFive };
      }),
    [sections],
  );
  const overallOutOfFive =
    sectionScores.length > 0
      ? sectionScores.reduce((acc, s) => acc + s.scoreOutOfFive, 0) / sectionScores.length
      : 0;
  const { mutate: saveKpi, isPending: savingKpi } = useMutation({
    mutationFn: async () => {
      const newScore = overallOutOfFive * 2;
      const metricUpdates = sections
        .map((s, idx) =>
          s.metricId
            ? { id: s.metricId, label: s.name, value: sectionScores[idx].scoreOutOfFive * 2 }
            : null,
        )
        .filter(Boolean);
      await updateHealthBlock(accountId, area, newScore, metricUpdates, sections);
      await upsertActivityScoreSnapshot({
        accountId,
        parameter: scoreAreaToParameter(area),
        metric: title,
        score: newScore,
        source: "kpi_editor",
        notes: `Snapshot captured from KPI editor by ${editorUser}.`,
      });
      await logAccountChanges(
        accountId,
        [
          {
            field: `Score: ${title}`,
            oldValue: block.score.toFixed(1),
            newValue: newScore.toFixed(1),
          },
        ],
        editorUser,
      );
    },
    onSuccess: () => {
      router.invalidate();
      onClose();
    },
  });
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-stretch md:items-center justify-center md:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-background w-full md:max-w-5xl md:rounded-xl border shadow-2xl flex flex-col max-h-screen md:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="px-4 md:px-6 py-4 border-b flex items-start justify-between gap-3 sticky top-0 bg-background z-10">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-accent">
              KPI Editor — Dynamic Scoring
            </p>
            <h2 className="text-base md:text-lg font-bold truncate">{title}</h2>
            <p className="text-[11px] text-muted-foreground">{hint}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                Avg score
              </p>
              <p
                className={`text-2xl font-bold ${overallOutOfFive >= 4 ? "text-success" : overallOutOfFive >= 2.5 ? "text-warn" : "text-crit"}`}
              >
                {overallOutOfFive.toFixed(2)}
                <span className="text-xs text-muted-foreground">/5</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="size-9 rounded-md border flex items-center justify-center hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* sections */}
        <div className="p-4 md:p-6 space-y-5 overflow-y-auto">
          {sections.map((section, idx) => {
            const ss = sectionScores[idx];
            const weightOk = ss.totalWeight === 100;
            return (
              <div key={section.id} className="border rounded-lg overflow-hidden">
                {/* section header */}
                <div className="px-4 py-3 bg-muted/30 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="size-6 rounded-md bg-accent/10 text-accent flex items-center justify-center text-[10px] font-bold font-mono shrink-0">
                      KPI
                    </span>
                    <input
                      value={section.name}
                      onChange={(e) =>
                        updateSection(section.id, (s) => ({ ...s, name: e.target.value }))
                      }
                      disabled={!editable}
                      className="font-semibold text-sm bg-transparent border-b border-transparent hover:border-muted-foreground/30 focus:border-accent focus:outline-none flex-1 min-w-0 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded ${weightOk ? "bg-success/10 text-success" : "bg-warn/10 text-warn"}`}
                      title={weightOk ? "Weights sum to 100" : "Weights should sum to 100"}
                    >
                      Σ {ss.totalWeight}%
                    </span>
                    <span
                      className={`text-sm font-bold ${ss.scoreOutOfFive >= 4 ? "text-success" : ss.scoreOutOfFive >= 2.5 ? "text-warn" : "text-crit"}`}
                    >
                      {ss.scoreOutOfFive.toFixed(2)}
                      <span className="text-[10px] text-muted-foreground">/5</span>
                    </span>
                  </div>
                </div>

                {/* dependent fields */}
                <ul className="divide-y">
                  {section.fields.map((f) => (
                    <li key={f.id} className="px-4 py-2.5 flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={f.checked}
                        disabled={!editable}
                        onChange={(e) =>
                          updateField(section.id, f.id, { checked: e.target.checked })
                        }
                        className="size-4 accent-accent shrink-0"
                      />
                      <input
                        value={f.label}
                        disabled={!editable}
                        onChange={(e) => updateField(section.id, f.id, { label: e.target.value })}
                        className="flex-1 min-w-0 text-xs bg-transparent border-b border-transparent hover:border-muted-foreground/30 focus:border-accent focus:outline-none px-1 py-0.5 disabled:cursor-not-allowed"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={f.weight}
                          disabled={!editable}
                          onChange={(e) =>
                            updateField(section.id, f.id, {
                              weight: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                            })
                          }
                          className="w-16 text-xs font-mono bg-background border rounded px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed"
                        />
                        <span className="text-[10px] font-mono text-muted-foreground">%</span>
                      </div>
                      <button
                        onClick={() => removeField(section.id, f.id)}
                        disabled={!editable}
                        className="size-7 rounded hover:bg-crit/10 hover:text-crit flex items-center justify-center text-muted-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                        aria-label="Remove field"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>

                {/* add field button */}
                <div className="px-4 py-2 border-t bg-muted/10">
                  <button
                    onClick={() => addField(section.id)}
                    disabled={!editable}
                    className="text-[11px] font-bold uppercase tracking-wider text-accent flex items-center gap-1 hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus className="size-3" /> Add dependent field
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* footer */}
        <div className="px-4 md:px-6 py-3 border-t flex items-center justify-between gap-3 bg-muted/20 sticky bottom-0">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Scoring is dynamic · checked weights ÷ total weight × 5
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs border rounded-md hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => saveKpi()}
              disabled={savingKpi || !editable}
              className="px-4 py-2 bg-accent text-white text-xs font-bold rounded-md disabled:opacity-50 flex items-center gap-1.5 hover:opacity-90 transition-opacity"
            >
              {savingKpi ? (
                <>
                  <Loader2 className="size-3 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3" /> Save & Close
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
function Metric({ m }) {
  const ok = m.value >= 8;
  const warn = m.value >= 6 && m.value < 8;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-semibold">{m.label}</span>
        <span className="font-mono">{m.value.toFixed(1)}</span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${ok ? "bg-success" : warn ? "bg-warn" : "bg-crit"}`}
          style={{ width: `${(m.value / 10) * 100}%` }}
        />
      </div>
      {m.hint && <p className="text-[10px] text-muted-foreground mt-1">{m.hint}</p>}
    </div>
  );
}
function ContractScoringBlock({ account }) {
  const c = account.contractScoring;
  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b flex justify-between items-start">
        <div>
          <h3 className="text-sm font-bold">Contract Scoring</h3>
          <p className="text-[11px] text-muted-foreground">
            Type, duration, value to us, SWOT, feedback, auto-renew & price hike
          </p>
        </div>
        <p className="text-2xl font-bold">
          {c.score.toFixed(1)}
          <span className="text-xs text-muted-foreground">/10</span>
        </p>
      </div>
      <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <Field label="Type" value={c.type} />
        <Field label="Duration" value={c.duration} />
        <Field label="Price hike" value={c.priceHike} />
        <Field label="Renewal" value={`${account.renewalDays} days`} />
        <Field label="Auto-renew" value={c.autoRenew ? "Yes" : "No"} ok={c.autoRenew} />
        <Field label="Non-terminator" value={c.nonTerminator ? "Yes" : "No"} ok={c.nonTerminator} />
        <Field label="Min 1-yr lock" value={c.minOneYear ? "Yes" : "No"} ok={c.minOneYear} />
        <Field label="Value to us" value={formatCurrency(account.contractValue)} />
      </div>
      <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            SWOT
          </p>
          <ul className="text-xs space-y-1.5">
            <li>
              <span className="font-bold text-success">S:</span> {c.swot.s}
            </li>
            <li>
              <span className="font-bold text-crit">W:</span> {c.swot.w}
            </li>
            <li>
              <span className="font-bold text-accent">O:</span> {c.swot.o}
            </li>
            <li>
              <span className="font-bold text-warn">T:</span> {c.swot.t}
            </li>
          </ul>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Customer Feedback
          </p>
          <p className="text-xs italic">{c.customerFeedback}</p>
        </div>
      </div>
    </div>
  );
}
function ResourceHealthBlock({ account, onExpand }) {
  const r = account.resourceHealth;
  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b flex justify-between items-start gap-3">
        <div>
          <h3 className="text-sm font-bold">Resources Health</h3>
          <p className="text-[11px] text-muted-foreground">
            Backup, leaves, critical roles, team size
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <p className="text-2xl font-bold">
            {r.score.toFixed(1)}
            <span className="text-xs text-muted-foreground">/10</span>
          </p>
          {onExpand && (
            <button
              onClick={onExpand}
              className="size-8 rounded-md border flex items-center justify-center hover:bg-accent hover:text-white transition-colors"
              aria-label="Expand Resources Health"
              title="Open KPI editor"
            >
              <Maximize2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mb-2">
        <Field label="Backup exists" value={r.backupExists ? "Yes" : "No"} ok={r.backupExists} />
        <Field label="Leaves this month" value={`${r.leavesThisMonth}`} />
        <Field label="Critical resources" value={`${r.criticalResources}`} />
        <Field label="Team size" value={`${r.teamSize}`} />
      </div>
      <div className="p-6 pt-0 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4">
        {r.metrics.map((m) => (
          <Metric key={m.label} m={m} />
        ))}
      </div>
    </div>
  );
}
/* ============================== TAB 3: Activity to Increase Score ============================== */
function ActivityTab({ account, opportunities, escalations }) {
  const { profile } = useAuth();
  if (account) {
    return (
      <ActivityTabPlanner
        account={account}
        opportunities={opportunities}
        escalations={escalations}
        profile={profile}
      />
    );
  }
  const editable = ROLE_PERMISSIONS[profile?.role ?? "KAM"].write;
  const ragColor = { R: "bg-crit", A: "bg-warn", G: "bg-success" };
  const areas = ["Profit", "Project", "Resource", "Financial", "Relationship"];
  const accountOpportunities = opportunities;
  return (
    <div className="space-y-6">
      {/* Opportunities — new signals KAM can crack */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex items-start gap-3">
            <span className="size-9 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <Lightbulb className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold">Opportunities for {account.name}</h3>
              <p className="text-[11px] text-muted-foreground">
                New signals surfaced from calls, filings and procurement events — pick one to crack.
              </p>
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground self-start md:self-auto">
            {accountOpportunities.length} open
          </span>
        </div>
        {accountOpportunities.length ? (
          <ul className="divide-y">
            {accountOpportunities.map((o) => (
              <li
                key={o.id}
                className="px-4 md:px-6 py-3 flex flex-col md:flex-row md:items-center gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug">{o.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {o.source} · signal {o.signalDate} ·{" "}
                    <span className="text-accent font-semibold">Next: {o.nextStep}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      o.confidence === "High"
                        ? "bg-success/10 text-success"
                        : o.confidence === "Medium"
                          ? "bg-warn/10 text-warn"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {o.confidence}
                  </span>
                  <span className="text-sm font-bold text-success whitespace-nowrap">
                    +{formatCurrency(o.potential)}
                  </span>
                  <button
                    disabled={!editable}
                    className="text-[10px] font-bold uppercase tracking-wider text-accent disabled:opacity-40 whitespace-nowrap"
                  >
                    Pursue →
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-6 py-6 text-xs text-muted-foreground">
            No open opportunities surfaced right now.
          </p>
        )}
      </div>

      <div className="bg-card border rounded-xl p-6">
        <h3 className="text-sm font-bold mb-2">RAG Analysis</h3>
        <p className="text-[11px] text-muted-foreground mb-4">
          Each activity is rated Red / Amber / Green by urgency.
        </p>
        <div className="grid grid-cols-3 gap-4">
          {["R", "A", "G"].map((rag) => {
            const items = account.activities.filter((a) => a.rag === rag);
            return (
              <div key={rag} className="border rounded-lg overflow-hidden">
                <div
                  className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white ${ragColor[rag]}`}
                >
                  {rag === "R" ? "Red — Act now" : rag === "A" ? "Amber — Plan" : "Green — Monitor"}
                  <span className="ml-2 opacity-80">({items.length})</span>
                </div>
                <ul className="p-3 space-y-2 text-xs">
                  {items.length ? (
                    items.map((a) => (
                      <li key={a.id} className="border-b last:border-0 pb-2 last:pb-0">
                        <p className="font-semibold">{a.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {a.area} · {a.owner} · {a.due}
                        </p>
                      </li>
                    ))
                  ) : (
                    <li className="text-muted-foreground text-[11px]">None</li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action items extracted from meeting notes */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold">
              Extract Action Items from Meeting Notes to Increase Score
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Auto-extracted from the last 5 meeting transcripts — accept to push into the
              activities backlog.
            </p>
          </div>
          <button
            disabled={!editable}
            className="text-[10px] font-bold text-accent uppercase tracking-wider disabled:opacity-40"
          >
            Re-run extraction
          </button>
        </div>
        <ul className="divide-y">
          {[
            {
              src: "QBR · 18 May",
              text: "Share 2026 product roadmap deck with sponsor by Friday.",
              lift: "+2 Relationship",
            },
            {
              src: "Weekly Sync · 15 May",
              text: "Schedule architecture review with their new CTO.",
              lift: "+3 Project",
            },
            {
              src: "Escalation Call · 13 May",
              text: "Send written RCA + service-credit memo within 48h.",
              lift: "+4 CSAT",
            },
            {
              src: "Discovery · 09 May",
              text: "Pitch EMEA fulfillment node — confirmed budget exists.",
              lift: "+$120k Growth",
            },
          ].map((it, i) => (
            <li key={i} className="px-6 py-3 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug">{it.text}</p>
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-1">
                  Source: {it.src}
                </p>
              </div>
              <span className="text-[10px] font-bold text-success bg-success/10 px-2 py-0.5 rounded whitespace-nowrap">
                {it.lift}
              </span>
              <button
                disabled={!editable}
                className="text-[10px] font-bold text-accent uppercase tracking-wider disabled:opacity-40 whitespace-nowrap"
              >
                + Add
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold">Activities Across Health Areas</h3>
            <p className="text-[11px] text-muted-foreground">
              Improvement actions for profit, project, resource, financial & relationship health
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              disabled={!editable}
              className="text-[10px] font-bold text-accent uppercase tracking-wider disabled:opacity-40"
            >
              + Add Activity
            </button>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Last sync with Jira · 4m ago
            </p>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b">
              <th className="px-6 py-3">Area</th>
              <th className="px-6 py-3">Activity</th>
              <th className="px-6 py-3">Owner</th>
              <th className="px-6 py-3">Due</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">RAG</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {areas.flatMap((area) =>
              account.activities
                .filter((a) => a.area === area)
                .map((a) => (
                  <tr key={a.id} className="hover:bg-muted/30">
                    <td className="px-6 py-3 text-xs font-semibold">{a.area}</td>
                    <td className="px-6 py-3 text-xs">{a.title}</td>
                    <td className="px-6 py-3 text-xs text-muted-foreground">{a.owner}</td>
                    <td className="px-6 py-3 text-xs">{a.due}</td>
                    <td className="px-6 py-3 text-xs">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          a.status === "Done"
                            ? "bg-success/10 text-success"
                            : a.status === "In Progress"
                              ? "bg-accent/10 text-accent"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-block size-2.5 rounded-full ${ragColor[a.rag]}`} />
                    </td>
                  </tr>
                )),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OpportunitiesTab({ account, opportunities, escalations }) {
  const { profile } = useAuth();
  const role = profile?.role ?? "KAM";
  const isAssignedKam = role === "KAM" ? account.assignedKamId === profile?.id : false;
  const canAct = role === "Head of KAM" || (role === "KAM" && isAssignedKam);
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: scoreHistory = [] } = useQuery({
    queryKey: ["activity-score-history", account.id],
    queryFn: () => fetchActivityScoreHistory(account.id),
    enabled: Boolean(account.id),
  });
  const { data: thresholdOverrides = [] } = useQuery({
    queryKey: ["activity-threshold-overrides", account.id],
    queryFn: () => fetchActivityRuleThresholdOverrides(account.id),
    enabled: Boolean(account.id),
  });
  const { data: savedRuleActivities = [] } = useQuery({
    queryKey: ["activity-rule-activities", account.id],
    queryFn: () => fetchActivityRuleActivities(account.id),
    enabled: Boolean(account.id),
  });
  const model = useMemo(
    () =>
      buildActivityTabModel({
        account,
        opportunities,
        escalations,
        scoreHistory,
        thresholdOverrides,
      }),
    [account, escalations, opportunities, scoreHistory, thresholdOverrides],
  );

  const [resolvedItems, setResolvedItems] = useState({});
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewForm, setReviewForm] = useState(createInitialReviewForm(null, profile?.name));
  const [evidenceTarget, setEvidenceTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    setResolvedItems({});
    setReviewTarget(null);
    setReviewForm(createInitialReviewForm(null, profile?.name));
    setEvidenceTarget(null);
    setRejectTarget(null);
    setRejectReason("");
  }, [account.id, profile?.name]);

  const persistedOpportunityRefs = useMemo(
    () =>
      new Set(
        savedRuleActivities
          .filter(
            (activity) =>
              activity.status !== "Rejected" &&
              activity.status !== "Closed" &&
              activity.sourceType === "opportunity",
          )
          .map((activity) => activity.sourceRef)
          .filter((sourceRef) => sourceRef && sourceRef !== "manual"),
      ),
    [savedRuleActivities],
  );
  const isResolved = useCallback(
    (item) =>
      Boolean(resolvedItems[item.id] || persistedOpportunityRefs.has(getSuggestionSourceRef(item))),
    [persistedOpportunityRefs, resolvedItems],
  );
  const activeOpportunities = model.opportunities.filter((item) => !isResolved(item));

  const { mutate: saveRuleActivity, isPending: savingRuleActivity } = useMutation({
    mutationFn: ({ target, form }) =>
      createActivityRuleActivity(
        buildActivityRuleActivityInput({
          accountId: account.id,
          target,
          form,
        }),
      ),
    onSuccess: (_, { target }) => {
      setResolvedItems((current) => ({
        ...current,
        [target.item.id]: {
          status: "saved",
          reviewedAt: new Date().toISOString(),
        },
      }));
      queryClient.invalidateQueries({ queryKey: ["activity-rule-activities", account.id] });
      queryClient.invalidateQueries({ queryKey: ["opportunities", account.id] });
      router.invalidate();
      closeReview();
    },
  });

  const { mutate: rejectRuleActivity, isPending: rejectingRuleActivity } = useMutation({
    mutationFn: ({ target, reason }) =>
      rejectActivityRuleSuggestion(
        buildRejectedRuleActivityInput({
          accountId: account.id,
          target,
          reason,
          reviewer: profile?.name ?? "Unknown",
        }),
      ),
    onSuccess: (_, { target, reason }) => {
      setResolvedItems((current) => ({
        ...current,
        [getSuggestionSourceRef(target)]: {
          status: "rejected",
          reason,
          reviewedAt: new Date().toISOString(),
        },
      }));
      queryClient.invalidateQueries({ queryKey: ["activity-rule-activities", account.id] });
      setRejectTarget(null);
      setRejectReason("");
    },
  });

  function openReview(kind, item) {
    setReviewTarget({ kind, item });
    setReviewForm(createInitialReviewForm(item, profile?.name));
  }

  function closeReview() {
    setReviewTarget(null);
    setReviewForm(createInitialReviewForm(null, profile?.name));
  }

  function confirmReview() {
    if (!reviewTarget) return;
    saveRuleActivity({ target: reviewTarget, form: reviewForm });
  }

  function confirmReject() {
    if (!rejectTarget || !rejectReason.trim()) return;
    rejectRuleActivity({ target: rejectTarget, reason: rejectReason.trim() });
  }

  return (
    <div className="space-y-6">
      {role === "KAM" && !isAssignedKam && (
        <div className="rounded-xl border border-warn/30 bg-warn/5 px-4 py-3 text-sm">
          <p className="font-semibold text-warn">View-only opportunities for this account</p>
          <p className="text-[12px] text-muted-foreground mt-1">
            Only the assigned KAM can pursue or reject opportunity suggestions here.
          </p>
        </div>
      )}

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex items-start gap-3">
            <span className="size-9 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <Lightbulb className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold">Opportunities related to {account.name}</h3>
              <p className="text-[11px] text-muted-foreground">
                Client-specific opportunities sourced from account context, escalation signals,
                retention/growth context, and Fireflies-derived meeting notes.
              </p>
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground self-start md:self-auto">
            {activeOpportunities.length} open
          </span>
        </div>

        {activeOpportunities.length ? (
          <ul className="divide-y">
            {activeOpportunities.map((opportunity) => (
              <li key={opportunity.id} className="px-4 md:px-6 py-4 space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold leading-snug">{opportunity.title}</p>
                      <PriorityBadge priority={opportunity.priority} />
                      <ConfidenceBadge confidence={opportunity.confidence} />
                      <AreaBadge area={opportunity.healthArea} />
                      {opportunity.approvalRequired && (
                        <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-warn/10 text-warn px-2 py-1">
                          Approval required
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {opportunity.source} Â· {opportunity.signalDate}
                    </p>
                    <ScoreRuleDetails item={opportunity} />
                    <EvidencePreview
                      evidence={opportunity.evidence}
                      onView={() =>
                        setEvidenceTarget({
                          title: opportunity.title,
                          subtitle: `${opportunity.source} Â· ${opportunity.healthArea}`,
                          evidence: opportunity.evidence,
                        })
                      }
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button
                      size="sm"
                      disabled={!canAct}
                      onClick={() => openReview("opportunity", opportunity)}
                    >
                      Pursue
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!canAct}
                      onClick={() => setRejectTarget({ ...opportunity, sourceKind: "opportunity" })}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-6 py-6 text-xs text-muted-foreground">
            No open opportunities are active in this planning cycle.
          </p>
        )}
      </div>

      <ActivityReviewSheet
        target={reviewTarget}
        form={reviewForm}
        onChange={setReviewForm}
        onClose={closeReview}
        onConfirm={confirmReview}
        isSaving={savingRuleActivity}
      />

      <EvidenceDetailSheet target={evidenceTarget} onClose={() => setEvidenceTarget(null)} />

      <RejectRecommendationDialog
        target={rejectTarget}
        value={rejectReason}
        onChange={setRejectReason}
        onClose={() => {
          setRejectTarget(null);
          setRejectReason("");
        }}
        onConfirm={confirmReject}
        isSaving={rejectingRuleActivity}
      />
    </div>
  );
}

function ActivityTabPlanner({ account, opportunities, escalations, profile }) {
  const role = profile?.role ?? "KAM";
  const isAssignedKam = role === "KAM" ? account.assignedKamId === profile?.id : false;
  const canAct = role === "Head of KAM" || (role === "KAM" && isAssignedKam);
  const canApproveEvidence = role === "Head of KAM" || role === "CEO";
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: scoreHistory = [] } = useQuery({
    queryKey: ["activity-score-history", account.id],
    queryFn: () => fetchActivityScoreHistory(account.id),
    enabled: Boolean(account.id),
  });
  const { data: thresholdOverrides = [] } = useQuery({
    queryKey: ["activity-threshold-overrides", account.id],
    queryFn: () => fetchActivityRuleThresholdOverrides(account.id),
    enabled: Boolean(account.id),
  });
  const { data: savedRuleActivities = [] } = useQuery({
    queryKey: ["activity-rule-activities", account.id],
    queryFn: () => fetchActivityRuleActivities(account.id),
    enabled: Boolean(account.id),
  });
  const model = useMemo(
    () =>
      buildActivityTabModel({
        account,
        opportunities,
        escalations,
        scoreHistory,
        thresholdOverrides,
      }),
    [account, escalations, opportunities, scoreHistory, thresholdOverrides],
  );

  const [resolvedItems, setResolvedItems] = useState({});
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewForm, setReviewForm] = useState(createInitialReviewForm(null, profile?.name));
  const [evidenceTarget, setEvidenceTarget] = useState(null);
  const [evidenceSubmitTarget, setEvidenceSubmitTarget] = useState(null);
  const [evidenceForm, setEvidenceForm] = useState(createInitialEvidenceForm(null, profile?.name));
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [firefliesActions, setFirefliesActions] = useState([]);
  const [firefliesStatus, setFirefliesStatus] = useState("");
  const [activityAreaFilter, setActivityAreaFilter] = useState("All");
  const [expectedLiftSort, setExpectedLiftSort] = useState("desc");
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiSuggestionRequested, setAiSuggestionRequested] = useState(false);
  const [addingAiSuggestionId, setAddingAiSuggestionId] = useState("");
  const [aiSuggestionStatus, setAiSuggestionStatus] = useState("");
  const [aiSuggestionWarning, setAiSuggestionWarning] = useState("");
  const [aiSuggestionError, setAiSuggestionError] = useState("");
  const [aiRecommendationSheetOpen, setAiRecommendationSheetOpen] = useState(false);

  const { mutate: rerunFirefliesExtraction, isPending: extractingFireflies } = useMutation({
    mutationFn: () =>
      fetchFirefliesRequiredActionItems({
        data: {
          accountId: account.id,
          limit: 5,
          daysBack: 60,
        },
      }),
    onSuccess: (result) => {
      setFirefliesActions([]);
      setFirefliesStatus(result.status ?? "Fireflies extraction completed.");
      queryClient.invalidateQueries({ queryKey: ["fireflies-meeting-summaries", account.id] });
      queryClient.invalidateQueries({ queryKey: ["activity-rule-activities", account.id] });
      queryClient.invalidateQueries({ queryKey: ["opportunities", account.id] });
    },
    onError: (error) => {
      setFirefliesStatus(error?.message ?? "Fireflies extraction failed.");
    },
  });

  const { mutate: requestAiSuggestions, isPending: generatingAiSuggestions } = useMutation({
    mutationFn: () => fetchKamAiSuggestions({ data: { accountId: account.id } }),
    onMutate: () => {
      setAiSuggestionRequested(true);
      setAiSuggestionError("");
      setAiSuggestionWarning("");
      setAiSuggestionStatus("");
    },
    onSuccess: (result) => {
      const uniqueSuggestions = removeDuplicateAiSuggestions(
        result?.suggestions ?? [],
        activityRows,
      ).slice(0, 6);
      setAiSuggestions(uniqueSuggestions);

      if (result?.fallback) {
        setAiSuggestionWarning(
          result.status || "OpenAI was unavailable; showing local fallback suggestions.",
        );
        return;
      }

      setAiSuggestionStatus(
        result?.status ??
          (uniqueSuggestions.length
            ? `${uniqueSuggestions.length} best AI recommendation${uniqueSuggestions.length === 1 ? "" : "s"} generated for ${account.name}.`
            : "No strong AI recommendations found for this account."),
      );
    },
    onError: (error) => {
      setAiSuggestions([]);
      setAiSuggestionError(error?.message ?? "AI suggestions could not be generated.");
    },
  });

  const { mutate: saveRuleActivity, isPending: savingRuleActivity } = useMutation({
    mutationFn: ({ target, form }) =>
      createActivityRuleActivity(
        buildActivityRuleActivityInput({
          accountId: account.id,
          target,
          form,
        }),
      ),
    onSuccess: (_, { target }) => {
      setResolvedItems((current) => ({
        ...current,
        [target.item.id]: {
          status: "saved",
          reviewedAt: new Date().toISOString(),
        },
      }));
      queryClient.invalidateQueries({ queryKey: ["activity-rule-activities", account.id] });
      router.invalidate();
      closeReview();
    },
  });

  const { mutate: rejectRuleActivity, isPending: rejectingRuleActivity } = useMutation({
    mutationFn: ({ target, reason }) =>
      rejectActivityRuleSuggestion(
        buildRejectedRuleActivityInput({
          accountId: account.id,
          target,
          reason,
          reviewer: profile?.name ?? "Unknown",
        }),
      ),
    onSuccess: (_, { target, reason }) => {
      setResolvedItems((current) => ({
        ...current,
        [getSuggestionSourceRef(target)]: {
          status: "rejected",
          reason,
          reviewedAt: new Date().toISOString(),
        },
      }));
      queryClient.invalidateQueries({ queryKey: ["activity-rule-activities", account.id] });
      setRejectTarget(null);
      setRejectReason("");
    },
  });

  const { mutate: submitEvidence, isPending: submittingEvidence } = useMutation({
    mutationFn: ({ row, form }) =>
      submitActivityRuleEvidence({
        ruleActivityId: row.dbId,
        submittedBy: profile?.name ?? "Unknown",
        evidenceQuality: form.evidenceQuality,
        title: form.title.trim(),
        notes: form.notes.trim(),
        artifactUrl: form.artifactUrl.trim(),
        checklist: buildEvidenceChecklistPayload(form.evidenceQuality),
        requestedLift: row.expectedLift,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity-rule-activities", account.id] });
      setEvidenceSubmitTarget(null);
      setEvidenceForm(createInitialEvidenceForm(null, profile?.name));
    },
  });

  const { mutate: validateEvidence, isPending: validatingEvidence } = useMutation({
    mutationFn: (row) =>
      reviewActivityRuleEvidence({
        evidenceId: row.latestPendingEvidence.id,
        ruleActivityId: row.dbId,
        reviewer: profile?.name ?? "Unknown",
        reviewStatus: "Approved",
        approvedLift: row.expectedLift,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity-rule-activities", account.id] });
      router.invalidate();
    },
  });

  const { mutate: addAiSuggestionActivity } = useMutation({
    mutationFn: (suggestion) =>
      createActivityRuleActivity(
        buildActivityRuleActivityInput({
          accountId: account.id,
          target: { kind: "ai_suggestion", item: suggestion },
          form: createAiSuggestionActivityForm(suggestion, profile?.name),
        }),
      ),
    onMutate: (suggestion) => {
      setAddingAiSuggestionId(suggestion.id);
      setAiSuggestionError("");
      setAiSuggestionStatus("");
    },
    onSuccess: (_, suggestion) => {
      setAiSuggestions((current) => current.filter((item) => item.id !== suggestion.id));
      setAiSuggestionStatus(`Added "${suggestion.title}" to Activities Across Health Areas.`);
      setAiSuggestionWarning("");
      setAiSuggestionError("");
      queryClient.invalidateQueries({ queryKey: ["activity-rule-activities", account.id] });
      router.invalidate();
    },
    onError: (error) => {
      setAiSuggestionError(error?.message ?? "AI suggestion could not be added.");
    },
    onSettled: () => {
      setAddingAiSuggestionId("");
    },
  });

  useEffect(() => {
    setResolvedItems({});
    setReviewTarget(null);
    setReviewForm(createInitialReviewForm(null, profile?.name));
    setEvidenceTarget(null);
    setEvidenceSubmitTarget(null);
    setEvidenceForm(createInitialEvidenceForm(null, profile?.name));
    setRejectTarget(null);
    setRejectReason("");
    setFirefliesActions([]);
    setFirefliesStatus("");
    setActivityAreaFilter("All");
    setExpectedLiftSort("desc");
    setAiSuggestions([]);
    setAiSuggestionRequested(false);
    setAddingAiSuggestionId("");
    setAiSuggestionStatus("");
    setAiSuggestionWarning("");
    setAiSuggestionError("");
  }, [account.id, profile?.name]);

  const activeScoreMetricRefs = useMemo(
    () => new Set(model.scoreMetricActivities.map((item) => getSuggestionSourceRef(item))),
    [model.scoreMetricActivities],
  );
  const activeSavedRuleActivities = useMemo(
    () =>
      savedRuleActivities.filter((activity) => {
        if (activity.status === "Rejected" || activity.status === "Closed") return false;
        if (activity.sourceType === "opportunity") return false;
        if (isRetentionGrowthActivityArea(activity.parameter)) return false;
        if (activity.sourceType === "score_metric") {
          return activeScoreMetricRefs.has(activity.sourceRef);
        }
        return true;
      }),
    [activeScoreMetricRefs, savedRuleActivities],
  );
  const persistedSourceRefs = useMemo(
    () =>
      new Set(
        activeSavedRuleActivities
          .map((activity) => activity.sourceRef)
          .filter((sourceRef) => sourceRef && sourceRef !== "manual"),
      ),
    [activeSavedRuleActivities],
  );
  const isResolved = useCallback(
    (item) =>
      Boolean(resolvedItems[item.id] || persistedSourceRefs.has(getSuggestionSourceRef(item))),
    [persistedSourceRefs, resolvedItems],
  );
  const activeOpportunities = [];
  const activeRagRecommendations = [];
  const showLegacyActivityPanels = Boolean(account.__legacyActivityPanels);
  const savedMeetingActions = useMemo(
    () =>
      activeSavedRuleActivities
        .filter((activity) => activity.sourceType === "fireflies_meeting")
        .map(mapPersistedMeetingActivityToCard),
    [activeSavedRuleActivities],
  );
  const scoreFirefliesActions = useMemo(
    () => firefliesActions.filter((item) => !isRetentionGrowthActivityArea(item.healthArea)),
    [firefliesActions],
  );
  const mergedMeetingActions = useMemo(() => {
    const actionsById = new Map();
    [...model.meetingActions, ...scoreFirefliesActions, ...savedMeetingActions].forEach((item) => {
      actionsById.set(getSuggestionSourceRef(item), item);
    });
    return [...actionsById.values()];
  }, [model.meetingActions, savedMeetingActions, scoreFirefliesActions]);
  const activeMeetingActions = mergedMeetingActions.filter(
    (item) => item.persisted || !isResolved(item),
  );

  const activityRows = useMemo(() => {
    const savedRows = activeSavedRuleActivities.map(mapPersistedRuleActivityToRow);
    const visibleRows = model.activityRows.filter(
      (row) => row.rowType === "existing" || !isResolved(row),
    );
    const firefliesRows = scoreFirefliesActions
      .filter((item) => !isResolved(item))
      .map((item) => mapMeetingActionToActivityRow(item, "meeting"));
    return sortActivityRows([...savedRows, ...visibleRows, ...firefliesRows]);
  }, [activeSavedRuleActivities, isResolved, model.activityRows, scoreFirefliesActions]);
  const activityAreaOptions = useMemo(
    () =>
      ACTIVITY_TAB_AREAS.map((area) => {
        const rows = activityRows.filter((row) => row.area === area);
        return {
          area,
          count: rows.length,
          expectedLift: summarizeExpectedLift(rows),
        };
      }),
    [activityRows],
  );
  const visibleActivityRows = useMemo(() => {
    const filteredRows =
      activityAreaFilter === "All"
        ? activityRows
        : activityRows.filter((row) => row.area === activityAreaFilter);
    return sortActivityRowsByExpectedLift(filteredRows, expectedLiftSort);
  }, [activityAreaFilter, activityRows, expectedLiftSort]);

  function generateAiSuggestions() {
    setAiRecommendationSheetOpen(true);
    requestAiSuggestions();
  }

  function acceptAiSuggestion(suggestion) {
    if (!canAct) return;

    if (isDuplicateAiActivity(suggestion, activityRows)) {
      setAiSuggestionError("This activity already exists.");
      setAiSuggestionWarning("");
      setAiSuggestions((current) => current.filter((item) => item.id !== suggestion.id));
      return;
    }

    addAiSuggestionActivity(suggestion);
  }

  function openReview(kind, item) {
    setReviewTarget({ kind, item });
    setReviewForm(createInitialReviewForm(item, profile?.name));
  }

  function closeReview() {
    setReviewTarget(null);
    setReviewForm(createInitialReviewForm(null, profile?.name));
  }

  function confirmReview() {
    if (!reviewTarget) return;
    saveRuleActivity({ target: reviewTarget, form: reviewForm });
  }

  function openEvidenceSubmit(row) {
    setEvidenceSubmitTarget(row);
    setEvidenceForm(createInitialEvidenceForm(row, profile?.name));
  }

  function confirmReject() {
    if (!rejectTarget || !rejectReason.trim()) return;
    rejectRuleActivity({ target: rejectTarget, reason: rejectReason.trim() });
  }

  function toggleExpectedLiftSort() {
    setExpectedLiftSort((current) => (current === "asc" ? "desc" : "asc"));
  }

  return (
    <div className="space-y-6">
      {role === "KAM" && !isAssignedKam && (
        <div className="rounded-xl border border-warn/30 bg-warn/5 px-4 py-3 text-sm">
          <p className="font-semibold text-warn">View-only planning surface for this account</p>
          <p className="text-[12px] text-muted-foreground mt-1">
            Only the assigned KAM can add, reject, or pursue score-improvement suggestions here.
          </p>
        </div>
      )}

      {showLegacyActivityPanels && (
        <>
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="px-4 md:px-6 py-4 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="flex items-start gap-3">
                <span className="size-9 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
                  <Lightbulb className="size-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold">Opportunities related to {account.name}</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Client-specific opportunities sourced from account context, score gaps,
                    escalation signals, and Fireflies-derived meeting notes.
                  </p>
                </div>
              </div>
              <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground self-start md:self-auto">
                {activeOpportunities.length} open
              </span>
            </div>

            {activeOpportunities.length ? (
              <ul className="divide-y">
                {activeOpportunities.map((opportunity) => (
                  <li key={opportunity.id} className="px-4 md:px-6 py-4 space-y-3">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                      <div className="space-y-2 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold leading-snug">{opportunity.title}</p>
                          <PriorityBadge priority={opportunity.priority} />
                          <ConfidenceBadge confidence={opportunity.confidence} />
                          <AreaBadge area={opportunity.healthArea} />
                          {opportunity.approvalRequired && (
                            <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-warn/10 text-warn px-2 py-1">
                              Approval required
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {opportunity.source} · {opportunity.signalDate}
                        </p>
                        <ScoreRuleDetails item={opportunity} />
                        <EvidencePreview
                          evidence={opportunity.evidence}
                          onView={() =>
                            setEvidenceTarget({
                              title: opportunity.title,
                              subtitle: `${opportunity.source} · ${opportunity.healthArea}`,
                              evidence: opportunity.evidence,
                            })
                          }
                        />
                      </div>
                      <div className="flex items-start lg:items-center shrink-0">
                        <Button
                          size="sm"
                          disabled={!canAct}
                          onClick={() => openReview("opportunity", opportunity)}
                        >
                          Pursue
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-6 py-6 text-xs text-muted-foreground">
                No open opportunities are active in this planning cycle.
              </p>
            )}
          </div>

          <div className="bg-card border rounded-xl p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-bold">Global Activity Rule Matrix</h3>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Standard rules that generate account-specific activities and define validation
                  criteria.
                </p>
              </div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                {activeRagRecommendations.length} active recommendations
              </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              {["R", "A", "G"].map((urgency) => {
                const items = activeRagRecommendations.filter((item) => item.urgency === urgency);
                return (
                  <div key={urgency} className="border rounded-lg overflow-hidden">
                    <div
                      className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white ${
                        urgency === "R" ? "bg-crit" : urgency === "A" ? "bg-warn" : "bg-success"
                      }`}
                    >
                      {urgency === "R"
                        ? "RED — Act Now"
                        : urgency === "A"
                          ? "AMBER — Plan"
                          : "GREEN — Monitor"}
                      <span className="ml-2 opacity-80">({items.length})</span>
                    </div>
                    <div className="p-3 space-y-3">
                      {items.length ? (
                        items.map((item) => (
                          <div key={item.id} className="rounded-lg border p-3 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold leading-snug">{item.title}</p>
                              <AreaBadge area={item.healthArea} />
                              <RuleBadge ruleId={item.ruleId} />
                              <ConfidenceBadge confidence={item.confidence} />
                            </div>
                            <p className="text-xs text-muted-foreground">{item.reason}</p>
                            <ScoreRuleDetails item={item} />
                            <EvidencePreview
                              evidence={item.evidence}
                              onView={() =>
                                setEvidenceTarget({
                                  title: item.title,
                                  subtitle: `RAG analysis · ${item.healthArea}`,
                                  evidence: item.evidence,
                                })
                              }
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                disabled={!canAct}
                                onClick={() => openReview("rag", item)}
                              >
                                Add
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!canAct}
                                onClick={() => setRejectTarget({ ...item, sourceKind: "rag" })}
                              >
                                Reject
                              </Button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          No items in this urgency band.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold">
              Extract Action Items from Meeting Notes to Increase Score
            </h3>
            <p className="text-[11px] text-muted-foreground mt-1">
              Meeting summaries are saved to Meeting History, and guarded action items are saved to
              the activity queue.
            </p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={!canAct || extractingFireflies}
              onClick={() => rerunFirefliesExtraction()}
            >
              {extractingFireflies && <Loader2 className="size-3.5 animate-spin mr-1" />}
              Extract action items
            </Button>
            <p
              className={`text-[10px] ${
                firefliesStatus.includes("failed") || firefliesStatus.includes("Missing")
                  ? "text-crit"
                  : "text-muted-foreground"
              }`}
            >
              {firefliesStatus ||
                "Fetches summaries, derives required actions, and avoids duplicate activities."}
            </p>
          </div>
        </div>

        {activeMeetingActions.length ? (
          <ul className="divide-y">
            {activeMeetingActions.map((item) => (
              <li key={item.id} className="px-6 py-4 space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold leading-snug">{item.title}</p>
                      <AreaBadge area={item.healthArea} />
                      <ConfidenceBadge confidence={item.confidence} />
                      {item.persisted && <ActivityStatusBadge row={item} />}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {item.meetingTitle} · {item.meetingDate}
                    </p>
                    <ScoreRuleDetails item={item} />
                    <EvidencePreview
                      evidence={item.evidence}
                      onView={() =>
                        setEvidenceTarget({
                          title: item.title,
                          subtitle: `${item.meetingTitle} · ${item.meetingDate}`,
                          evidence: item.evidence,
                        })
                      }
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {item.persisted ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canAct || item.status === "Validated"}
                          onClick={() => openEvidenceSubmit(item)}
                        >
                          Evidence
                        </Button>
                        {canApproveEvidence && item.latestPendingEvidence && (
                          <Button
                            size="sm"
                            disabled={validatingEvidence}
                            onClick={() => validateEvidence(item)}
                          >
                            Validate
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          disabled={!canAct}
                          onClick={() => openReview("meeting", item)}
                        >
                          Add
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!canAct}
                          onClick={() => setRejectTarget({ ...item, sourceKind: "meeting" })}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-6 py-6 text-xs text-muted-foreground">
            No meeting-note actions are active right now.
          </p>
        )}
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold">Activities Across Health Areas</h3>
            <p className="text-[11px] text-muted-foreground mt-1">
              Unchecked Score Marking Matrics items, meeting actions, and accepted drafts live in
              one review queue.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="grid gap-1">
              <Label
                htmlFor="activity-health-area-filter"
                className="text-[10px] uppercase tracking-widest text-muted-foreground"
              >
                Health area
              </Label>
              <select
                id="activity-health-area-filter"
                value={activityAreaFilter}
                onChange={(event) => setActivityAreaFilter(event.target.value)}
                className="h-9 min-w-[240px] rounded-md border bg-background px-3 text-xs font-medium"
              >
                <option value="All">
                  All Health Areas ({activityRows.length}) - {summarizeExpectedLift(activityRows)}
                </option>
                {activityAreaOptions.map((option) => (
                  <option key={option.area} value={option.area}>
                    {option.area} ({option.count}) - {option.expectedLift}
                  </option>
                ))}
              </select>
            </div>
            <Button size="sm" variant="outline" onClick={toggleExpectedLiftSort}>
              Expected Lift {expectedLiftSort === "asc" ? "ASC" : "DESC"}
            </Button>
          </div>
        </div>
        <div className="px-6 py-2 border-b bg-muted/20 text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
          Showing {visibleActivityRows.length} of {activityRows.length} items
        </div>
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b">
                <th className="px-6 py-3">Area</th>
                <th className="px-6 py-3">Activity</th>
                <th className="px-6 py-3">
                  <button
                    type="button"
                    onClick={toggleExpectedLiftSort}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    Expected Lift {expectedLiftSort === "asc" ? "ASC" : "DESC"}
                  </button>
                </th>
                <th className="px-6 py-3">Owner</th>
                <th className="px-6 py-3">RAG</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleActivityRows.map((row) => (
                <tr key={row.id} className="align-top hover:bg-muted/20">
                  <td className="px-6 py-4 text-xs font-semibold whitespace-nowrap">
                    <AreaBadge area={row.area} />
                  </td>
                  <td className="px-6 py-4 text-xs min-w-[280px]">
                    <div className="space-y-1">
                      <p className="font-semibold text-foreground">{row.title}</p>
                      <p className="text-muted-foreground leading-relaxed">{row.reason}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-semibold whitespace-nowrap">
                    {row.expectedLift || "—"}
                  </td>
                  <td className="px-6 py-4 text-xs text-muted-foreground whitespace-nowrap">
                    {row.owner}
                  </td>
                  <td className="px-6 py-4">
                    <RagBadge code={row.rag} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleActivityRows.length && (
            <p className="px-6 py-8 text-xs text-muted-foreground">
              No activities are active for this health area.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-accent/10 via-card to-card">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="size-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                <Sparkles className="size-5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-bold">AI Suggestions to Increase Score</h4>
                  <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-accent/10 text-accent px-2 py-1">
                    AI-generated
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-3xl">
                  Generate AI-powered strategic recommendations for this account.
                </p>
                {aiSuggestions.length ? (
                  <p className="mt-2 text-[11px] font-medium text-muted-foreground">
                    {aiSuggestions.length} recommendation{aiSuggestions.length === 1 ? "" : "s"} ready
                    to review.
                  </p>
                ) : null}
              </div>
            </div>
            <Button
              size="sm"
              disabled={generatingAiSuggestions}
              onClick={generateAiSuggestions}
              className="shadow-sm"
            >
              {generatingAiSuggestions && <Loader2 className="size-3.5 animate-spin mr-1" />}
              Ask AI for Suggestions
            </Button>
          </div>
        </div>
      </div>

      <ActivityReviewSheet
        target={reviewTarget}
        form={reviewForm}
        onChange={setReviewForm}
        onClose={closeReview}
        onConfirm={confirmReview}
        isSaving={savingRuleActivity}
      />

      <AiRecommendationsSheet
        open={aiRecommendationSheetOpen}
        onClose={() => setAiRecommendationSheetOpen(false)}
        suggestions={aiSuggestions}
        requested={aiSuggestionRequested}
        isLoading={generatingAiSuggestions}
        status={aiSuggestionStatus}
        warning={aiSuggestionWarning}
        error={aiSuggestionError}
        canAct={canAct}
        addingId={addingAiSuggestionId}
        activityRows={activityRows}
        onAccept={acceptAiSuggestion}
        onRefresh={generateAiSuggestions}
      />

      <EvidenceDetailSheet target={evidenceTarget} onClose={() => setEvidenceTarget(null)} />

      <EvidenceSubmissionDialog
        target={evidenceSubmitTarget}
        form={evidenceForm}
        onChange={setEvidenceForm}
        onClose={() => {
          setEvidenceSubmitTarget(null);
          setEvidenceForm(createInitialEvidenceForm(null, profile?.name));
        }}
        onConfirm={() => submitEvidence({ row: evidenceSubmitTarget, form: evidenceForm })}
        isSaving={submittingEvidence}
      />

      <RejectRecommendationDialog
        target={rejectTarget}
        value={rejectReason}
        onChange={setRejectReason}
        onClose={() => {
          setRejectTarget(null);
          setRejectReason("");
        }}
        onConfirm={confirmReject}
        isSaving={rejectingRuleActivity}
      />
    </div>
  );
}

function AiRecommendationsSheet({
  open,
  onClose,
  suggestions,
  requested,
  isLoading,
  status,
  warning,
  error,
  canAct,
  addingId,
  activityRows,
  onAccept,
  onRefresh,
}) {
  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <div className="min-h-full bg-background">
          <div className="border-b bg-gradient-to-r from-accent/15 via-background to-background px-6 py-5">
            <SheetHeader className="text-left space-y-3">
              <div className="flex items-start gap-3 pr-8">
                <span className="size-11 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                  <Sparkles className="size-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <SheetTitle>AI Recommendations to Increase Score</SheetTitle>
                    <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-accent/10 text-accent px-2 py-1">
                      AI-generated
                    </span>
                  </div>
                  <SheetDescription className="mt-1">
                    Generated from account context, tasks, opportunities, risks, existing
                    activities, and score logic.
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] text-muted-foreground">
                Select only the recommendations you want to add to Activities Across Health Areas.
                {!canAct ? " You can review recommendations, but adding requires activity permissions." : ""}
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={onClose}>
                  <X className="size-3.5 mr-1" />
                  Close
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isLoading}
                  onClick={onRefresh}
                >
                  {isLoading && <Loader2 className="size-3.5 animate-spin mr-1" />}
                  Refresh
                </Button>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            {status && (
              <p
                className={`rounded-lg border px-3 py-2 text-[11px] font-medium ${
                  status.startsWith("Added")
                    ? "border-success/20 bg-success/5 text-success"
                    : "border-border bg-muted/20 text-muted-foreground"
                }`}
              >
                {status}
              </p>
            )}
            {warning && (
              <p className="rounded-lg border border-warn/20 bg-warn/5 px-3 py-2 text-[11px] font-medium text-warn">
                {warning}
              </p>
            )}
            {error && (
              <p className="rounded-lg border border-crit/20 bg-crit/5 px-3 py-2 text-[11px] font-medium text-crit">
                {error}
              </p>
            )}

            {isLoading ? <AiRecommendationSkeleton /> : null}

            {!isLoading && requested && !error && !suggestions.length ? (
              <div className="rounded-xl border bg-muted/20 px-5 py-8 text-center">
                <Sparkles className="mx-auto size-5 text-muted-foreground" />
                <p className="mt-3 text-sm font-semibold">No strong AI recommendations found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  The agent did not find useful, account-specific recommendations that are not
                  already covered by current activities.
                </p>
              </div>
            ) : null}

            {!isLoading && suggestions.length ? (
              <div className="space-y-3">
                {suggestions.map((suggestion) => (
                  <AiRecommendationCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    duplicate={isDuplicateAiActivity(suggestion, activityRows)}
                    isAdding={addingId === suggestion.id}
                    canAct={canAct}
                    onAccept={onAccept}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AiRecommendationSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-xl border bg-card p-4 animate-pulse">
          <div className="flex gap-3">
            <div className="mt-1 size-4 rounded border bg-muted" />
            <div className="flex-1 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-2/3 rounded bg-muted" />
                  <div className="h-3 w-full rounded bg-muted" />
                  <div className="h-3 w-4/5 rounded bg-muted" />
                </div>
                <div className="h-6 w-24 rounded-full bg-muted" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="h-16 rounded-lg bg-muted" />
                <div className="h-16 rounded-lg bg-muted" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AiRecommendationCard({ suggestion, duplicate, isAdding, canAct, onAccept }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex gap-3">
        <input
          type="checkbox"
          className="mt-1 size-4 shrink-0 accent-[hsl(var(--accent))]"
          checked={isAdding}
          disabled={!canAct || isAdding || duplicate}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            event.stopPropagation();
            if (event.target.checked) onAccept(suggestion);
          }}
          aria-label={`Add ${suggestion.title} to Activities Across Health Areas`}
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-accent/10 text-accent px-2 py-1">
                  AI-generated
                </span>
                {duplicate && (
                  <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-crit/10 text-crit px-2 py-1">
                    Duplicate
                  </span>
                )}
                {isAdding && (
                  <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-success/10 text-success px-2 py-1">
                    Adding
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold leading-snug">{suggestion.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {suggestion.description}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <AreaBadge area={suggestion.healthArea} />
              <span className="text-[10px] font-bold uppercase rounded-full bg-accent/10 text-accent px-2 py-1">
                {suggestion.expectedLift}
              </span>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border bg-muted/10 p-3">
              <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                Why this may increase score
              </p>
              <p className="mt-1 text-xs text-foreground leading-relaxed">{suggestion.reason}</p>
            </div>
            <div className="rounded-lg border bg-muted/10 p-3">
              <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                Source
              </p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {suggestion.sourceSummary}
              </p>
            </div>
          </div>

          {duplicate && (
            <p className="text-[11px] font-semibold text-crit">This activity already exists.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityReviewSheet({ target, form, onChange, onClose, onConfirm, isSaving = false }) {
  const item = target?.item ?? null;
  const title = target?.kind === "opportunity" ? "Review pursuit draft" : "Review activity draft";

  return (
    <Sheet open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        {item && (
          <>
            <SheetHeader>
              <SheetTitle>{title}</SheetTitle>
              <SheetDescription>
                Review the suggestion, adjust the details, and add it to the governed activity plan.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 py-5">
              <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <AreaBadge area={item.healthArea ?? item.area} />
                  <RuleBadge ruleId={item.ruleId} />
                  {item.priority ? <PriorityBadge priority={item.priority} /> : null}
                  {item.confidence ? <ConfidenceBadge confidence={item.confidence} /> : null}
                  {item.approvalRequired && (
                    <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-warn/10 text-warn px-2 py-1">
                      {item.approverRole ?? "Head of KAM"} approval required
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.reason ?? item.sourceExcerpt ?? item.nextStep}
                  </p>
                </div>
                <ScoreRuleDetails item={item} />
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="activity-review-title">Title</Label>
                  <Input
                    id="activity-review-title"
                    value={form.title}
                    onChange={(event) =>
                      onChange((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="activity-review-owner">Owner</Label>
                    <Input
                      id="activity-review-owner"
                      value={form.owner}
                      onChange={(event) =>
                        onChange((current) => ({ ...current, owner: event.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="activity-review-due-date">Due date</Label>
                    <Input
                      id="activity-review-due-date"
                      type="date"
                      value={form.dueDate}
                      onChange={(event) =>
                        onChange((current) => ({ ...current, dueDate: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="activity-review-next-step">Next step</Label>
                  <Textarea
                    id="activity-review-next-step"
                    rows={4}
                    value={form.nextStep}
                    onChange={(event) =>
                      onChange((current) => ({ ...current, nextStep: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Evidence
                </p>
                <div className="space-y-3">
                  {(item.evidence ?? []).map((entry, index) => (
                    <div
                      key={`${entry.source}-${index}`}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          {entry.sourceType}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{entry.date}</span>
                      </div>
                      <p className="text-sm font-medium">{entry.source}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {entry.excerpt}
                      </p>
                      <p className="text-[11px] text-foreground">{entry.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <SheetFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={onConfirm}
                disabled={
                  isSaving || !form.title.trim() || !form.owner.trim() || !form.nextStep.trim()
                }
              >
                {isSaving ? "Adding..." : "Add to plan"}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function EvidenceDetailSheet({ target, onClose }) {
  return (
    <Sheet open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        {target && (
          <>
            <SheetHeader>
              <SheetTitle>{target.title}</SheetTitle>
              <SheetDescription>{target.subtitle}</SheetDescription>
            </SheetHeader>

            <div className="space-y-4 py-5">
              {(target.evidence ?? []).map((entry, index) => (
                <div key={`${entry.source}-${index}`} className="rounded-xl border p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {entry.sourceType}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{entry.date}</span>
                  </div>
                  <p className="text-sm font-semibold">{entry.source}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{entry.excerpt}</p>
                  <p className="text-xs text-foreground">{entry.reason}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function EvidenceSubmissionDialog({ target, form, onChange, onClose, onConfirm, isSaving }) {
  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit evidence</DialogTitle>
          <DialogDescription>
            Evidence quality controls how much lift is eligible after reviewer validation.
          </DialogDescription>
        </DialogHeader>

        {target && (
          <div className="space-y-4">
            <div className="rounded-lg border p-3 bg-muted/20">
              <p className="text-sm font-semibold">{target.title}</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Current stage: {target.status} / {target.activityScorePct ?? 0}%
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="evidence-quality">Evidence quality</Label>
              <select
                id="evidence-quality"
                value={form.evidenceQuality}
                onChange={(event) =>
                  onChange((current) => ({ ...current, evidenceQuality: event.target.value }))
                }
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                <option value="Meeting note only">Meeting note only</option>
                <option value="Action tracker plus note">Action tracker plus note</option>
                <option value="Completed action plus outcome proof">
                  Completed action plus outcome proof
                </option>
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="evidence-title">Evidence title</Label>
              <Input
                id="evidence-title"
                value={form.title}
                onChange={(event) =>
                  onChange((current) => ({ ...current, title: event.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="evidence-notes">Notes</Label>
              <Textarea
                id="evidence-notes"
                rows={4}
                value={form.notes}
                onChange={(event) =>
                  onChange((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Mention meeting, tracker, completion proof, owner, and outcome."
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="evidence-url">Artifact URL</Label>
              <Input
                id="evidence-url"
                value={form.artifactUrl}
                onChange={(event) =>
                  onChange((current) => ({ ...current, artifactUrl: event.target.value }))
                }
                placeholder="https://..."
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={isSaving || !form.title.trim() || !form.notes.trim()}
            onClick={onConfirm}
          >
            {isSaving ? "Submitting..." : "Submit evidence"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectRecommendationDialog({
  target,
  value,
  onChange,
  onClose,
  onConfirm,
  isSaving = false,
}) {
  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reject recommendation</DialogTitle>
          <DialogDescription>
            Rejected recommendations are removed from active suggestions in this tab.
          </DialogDescription>
        </DialogHeader>

        {target && (
          <div className="space-y-4">
            <div className="rounded-lg border p-3 bg-muted/20">
              <p className="text-sm font-semibold">{target.title}</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Capture why this suggestion should not stay active.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reject-reason">Rejection reason</Label>
              <Textarea
                id="reject-reason"
                rows={4}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder="Example: already covered by an open action plan, not relevant for this client, or timing is wrong."
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={isSaving || !value.trim()} onClick={onConfirm}>
            {isSaving ? "Rejecting..." : "Reject recommendation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RuleBadge({ ruleId }) {
  if (!ruleId) return null;

  return (
    <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-muted text-muted-foreground px-2 py-1">
      {ruleId}
    </span>
  );
}

function formatEvidenceRequired(evidenceRequired) {
  if (!evidenceRequired) return "Activity evidence";
  if (Array.isArray(evidenceRequired)) return evidenceRequired.join(", ");
  return evidenceRequired;
}

function formatTriggerLogic(triggerLogic) {
  if (!triggerLogic) return null;
  return [
    triggerLogic.primary ? `Primary: ${triggerLogic.primary}` : null,
    triggerLogic.threshold ? `Threshold: ${triggerLogic.threshold}` : null,
    triggerLogic.scoreBand ? `Band: ${triggerLogic.scoreBand}` : null,
    triggerLogic.overrideReason ? `Reason: ${triggerLogic.overrideReason}` : null,
    triggerLogic.trend ? `Trend: ${triggerLogic.trend}` : null,
    triggerLogic.velocity ? `Velocity: ${triggerLogic.velocity}` : null,
    triggerLogic.compound ? `Compound: ${triggerLogic.compound}` : null,
    triggerLogic.optimization ? `Target logic: ${triggerLogic.optimization}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

function formatEvidenceLiftPolicy(policy) {
  if (!policy?.length) return null;
  return policy.map((entry) => `${entry.quality}: ${entry.lift}`).join(" | ");
}

function formatActivityScoreLogic(logic) {
  if (!logic?.length) return null;
  return logic.join(" | ");
}

function formatApprovalSla(approvalSla) {
  if (!approvalSla?.reviewWindow) return null;
  return `Review: ${approvalSla.reviewWindow}; approver: ${approvalSla.primaryApprover}; fallback: ${approvalSla.fallbackApprover}; ${approvalSla.rejectionRule}`;
}

function formatReviewCadence(reviewCadence) {
  if (!reviewCadence?.cadence) return null;
  return `${reviewCadence.cadence}; ${reviewCadence.autoCloseRule}`;
}

function ScoreRuleDetails({ item }) {
  if (
    !item?.ruleId &&
    !item?.successCriteria &&
    !item?.expectedLift &&
    !item?.nextStep &&
    !item?.sourceExcerpt &&
    !item?.potentialValue
  ) {
    return null;
  }

  const triggerLogic = formatTriggerLogic(item.triggerLogic);
  const evidenceLiftPolicy = formatEvidenceLiftPolicy(item.evidenceLiftPolicy);
  const activityScoreLogic = formatActivityScoreLogic(item.activityScoreLogic);
  const approvalSla = formatApprovalSla(item.approvalSla);
  const reviewCadence = formatReviewCadence(item.reviewCadence);
  const summaryParts = [
    item.scoreBand,
    item.potentialValue ? `+${formatCurrency(item.potentialValue)}` : null,
    item.currentValue && item.targetValue ? `${item.currentValue} to ${item.targetValue}` : null,
    item.threshold || item.targetScore
      ? `${item.thresholdSource ?? "Global default"} threshold`
      : null,
    item.nextStep ? "Next step" : null,
  ].filter(Boolean);

  return (
    <details className="group rounded-lg border bg-muted/20 text-xs">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {item.ruleId ? "Rule details" : "Details"}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {summaryParts.length ? summaryParts.join(" | ") : "Evidence and next step"}
          </p>
        </div>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-2 border-t p-3">
        <RuleDetailDisclosure
          label="Rule and metric"
          value={
            item.ruleId
              ? `${item.ruleId} / ${item.impactedMetric ?? item.parameter ?? item.healthArea}`
              : null
          }
        />
        <RuleDetailDisclosure
          label="Potential value"
          value={item.potentialValue ? `+${formatCurrency(item.potentialValue)}` : null}
        />
        <RuleDetailDisclosure
          label="Priority"
          value={
            item.priority
              ? `${item.priority}${item.confidence ? ` / ${item.confidence} confidence` : ""}`
              : null
          }
        />
        <RuleDetailDisclosure label="Expected lift" value={item.expectedLift} />
        <RuleDetailDisclosure label="Next step" value={item.nextStep} />
        <RuleDetailDisclosure label="Source excerpt" value={item.sourceExcerpt} />
        <RuleDetailDisclosure
          label="Current to target"
          value={
            item.currentValue || item.targetValue
              ? `${item.currentValue ?? "Current"} to ${item.targetValue ?? "Target"}`
              : null
          }
        />
        <RuleDetailDisclosure label="Score band" value={item.scoreBand} />
        <RuleDetailDisclosure
          label="Threshold / target"
          value={
            item.threshold || item.targetScore
              ? `${item.thresholdSource ?? "Global default"}: ${item.threshold ?? "n/a"} to ${item.targetScore ?? "n/a"}`
              : null
          }
        />
        <RuleDetailDisclosure label="Threshold reason" value={item.thresholdReason} />
        <RuleDetailDisclosure label="Success criteria" value={item.successCriteria} />
        <RuleDetailDisclosure
          label="Evidence required"
          value={item.evidenceRequired ? formatEvidenceRequired(item.evidenceRequired) : null}
        />
        <RuleDetailDisclosure label="Trigger logic" value={triggerLogic} />
        <RuleDetailDisclosure label="Evidence quality lift" value={evidenceLiftPolicy} />
        <RuleDetailDisclosure label="Activity score logic" value={activityScoreLogic} />
        <RuleDetailDisclosure label="Approval SLA" value={approvalSla} />
        <RuleDetailDisclosure label="Review cadence" value={reviewCadence} />
      </div>
    </details>
  );
}

function RuleDetailDisclosure({ label, value }) {
  if (!value) return null;

  return (
    <details className="group/detail rounded-md border bg-background">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{value}</p>
        </div>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open/detail:rotate-180" />
      </summary>
      <p className="border-t px-3 py-2 text-xs leading-relaxed text-foreground">{value}</p>
    </details>
  );
}

function ActivityRuleCell({ row }) {
  if (!row.ruleId) {
    return (
      <div className="space-y-1">
        <p className="font-semibold text-muted-foreground">{row.impactedMetric ?? "Tracked"}</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Existing activity context
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <RuleBadge ruleId={row.ruleId} />
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {row.parameter}
        </span>
      </div>
      <p className="font-semibold text-foreground">{row.impactedMetric}</p>
      {row.scoreBand && <p className="text-[11px] font-medium text-accent">{row.scoreBand}</p>}
      {(row.currentValue || row.targetValue) && (
        <p className="text-[11px] text-muted-foreground">
          {row.currentValue ?? "Current"} to {row.targetValue ?? "Target"}
        </p>
      )}
    </div>
  );
}

function EvidencePreview({ evidence, onView, compact = false }) {
  const primary = evidence?.[0];
  if (!primary) {
    return <p className="text-[11px] text-muted-foreground">Evidence unavailable.</p>;
  }

  return (
    <div
      className={`rounded-lg border bg-muted/20 ${compact ? "p-2.5" : "p-3"} flex items-start justify-between gap-3`}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {primary.sourceType} · {primary.date}
        </p>
        <p
          className={`${compact ? "text-[11px]" : "text-xs"} text-foreground leading-relaxed mt-1 line-clamp-2`}
        >
          {primary.excerpt}
        </p>
      </div>
      <Button variant="ghost" size="sm" className="shrink-0" onClick={onView}>
        View evidence
      </Button>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </p>
      <p className="text-sm font-medium leading-snug">{value}</p>
    </div>
  );
}

function PriorityBadge({ priority }) {
  const styles = {
    High: "bg-crit/10 text-crit",
    Medium: "bg-warn/10 text-warn",
    Low: "bg-success/10 text-success",
  };

  return (
    <span
      className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${styles[priority] ?? "bg-muted text-muted-foreground"}`}
    >
      {priority}
    </span>
  );
}

function ConfidenceBadge({ confidence }) {
  const styles = {
    High: "bg-success/10 text-success",
    Medium: "bg-warn/10 text-warn",
    Low: "bg-muted text-muted-foreground",
  };

  return (
    <span
      className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${styles[confidence] ?? "bg-muted text-muted-foreground"}`}
    >
      {confidence}
    </span>
  );
}

function AreaBadge({ area }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-accent/10 text-accent px-2 py-1 whitespace-nowrap">
      {area}
    </span>
  );
}

function RagBadge({ code }) {
  const styles = {
    R: "bg-crit",
    A: "bg-warn",
    G: "bg-success",
  };

  return (
    <span
      className={`inline-flex items-center justify-center size-6 rounded-full text-[10px] font-bold text-white ${styles[code] ?? "bg-muted-foreground"}`}
      title={code === "R" ? "Red" : code === "A" ? "Amber" : "Green"}
    >
      {code}
    </span>
  );
}

function ActivityStatusBadge({ row }) {
  if (row.rowType === "suggested") {
    return (
      <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-warn/10 text-warn">
        Suggested
      </span>
    );
  }

  const statusStyles = {
    Validated: "bg-success/10 text-success",
    "Evidence Submitted": "bg-warn/10 text-warn",
    Completed: "bg-accent/10 text-accent",
    Planned: "bg-accent/10 text-accent",
    Accepted: "bg-accent/10 text-accent",
    Generated: "bg-muted text-muted-foreground",
    Rejected: "bg-crit/10 text-crit",
    Closed: "bg-muted text-muted-foreground",
    Done: "bg-success/10 text-success",
    "In Progress": "bg-accent/10 text-accent",
  };
  const styles = statusStyles[row.status] ?? "bg-muted text-muted-foreground";

  return (
    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${styles}`}>
      {row.status}
    </span>
  );
}

function createInitialReviewForm(item, ownerName) {
  if (!item) {
    return {
      title: "",
      owner: ownerName ?? "KAM Person",
      dueDate: getFutureDateInput(7),
      nextStep: "",
    };
  }

  return {
    title: item.title ?? "",
    owner: ownerName ?? "KAM Person",
    dueDate: getFutureDateInput(getSuggestedReviewDays(item)),
    nextStep: item.nextStep ?? item.title ?? "",
  };
}

function getSuggestedReviewDays(item) {
  if (item.urgency === "R" || item.priority === "High") return 3;
  if (item.urgency === "G" || item.priority === "Low") return 14;
  return 7;
}

function getFutureDateInput(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDraftDate(dateValue) {
  if (!dateValue) return "Needs scheduling";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function mapPriorityToRag(priority) {
  return priority === "High" ? "R" : priority === "Low" ? "G" : "A";
}

function mapMeetingActionToActivityRow(item, sourceKind) {
  return {
    id: item.id,
    rowType: "suggested",
    sourceId: item.id,
    sourceKind,
    area: item.healthArea,
    title: item.title,
    owner: "KAM Person",
    dueDate: "In 7d",
    status: "Suggested",
    rag: item.confidence === "High" ? "R" : "A",
    expectedLift: item.expectedLift,
    confidence: item.confidence,
    ruleId: item.ruleId ?? null,
    parameter: item.parameter ?? item.healthArea,
    impactedMetric: item.impactedMetric ?? item.healthArea,
    weakSignal: item.weakSignal ?? item.reason ?? item.sourceExcerpt,
    currentValue: item.currentValue ?? null,
    targetValue: item.targetValue ?? null,
    triggerLogic: item.triggerLogic ?? null,
    evidenceLiftPolicy: item.evidenceLiftPolicy ?? null,
    activityScoreLogic: item.activityScoreLogic ?? null,
    approvalSla: item.approvalSla ?? null,
    reviewCadence: item.reviewCadence ?? null,
    scoreBand: item.scoreBand ?? null,
    threshold: item.threshold ?? null,
    targetScore: item.targetScore ?? null,
    thresholdSource: item.thresholdSource ?? null,
    thresholdReason: item.thresholdReason ?? null,
    successCriteria: item.successCriteria ?? "Complete the activity and review score impact.",
    evidenceRequired: item.evidenceRequired ?? ["Activity evidence"],
    reason: item.reason ?? item.sourceExcerpt ?? item.nextStep,
    evidence: item.evidence ?? [],
    nextStep: item.nextStep,
  };
}

function mapPersistedRuleActivityToRow(activity) {
  const pendingEvidence = activity.evidenceReviews.find(
    (evidence) => evidence.reviewStatus === "Pending" || evidence.reviewStatus === "Partial",
  );
  const evidence = activity.evidenceReviews.length
    ? activity.evidenceReviews.map((entry) => ({
        source: entry.title,
        sourceType: `${entry.evidenceQuality} / ${entry.reviewStatus}`,
        date: formatDraftDate(entry.submittedAt),
        excerpt: entry.notes || entry.artifactUrl || "Evidence submitted for reviewer validation.",
        reason:
          entry.reviewStatus === "Approved"
            ? `Approved by ${entry.reviewer || "reviewer"} for ${entry.approvedLift || activity.expectedLift}.`
            : entry.reviewStatus === "Rejected"
              ? entry.rejectionReason
              : "Awaiting reviewer validation.",
      }))
    : [
        {
          source: "Evidence pending",
          sourceType: "Governance workflow",
          date: activity.generatedAt ? formatDraftDate(activity.generatedAt) : "Current cycle",
          excerpt: activity.successCriteria || activity.weakSignal,
          reason: "Submit evidence before any parameter score lift can be validated.",
        },
      ];

  return {
    id: `saved-${activity.id}`,
    dbId: activity.id,
    rowType: "saved",
    sourceId: activity.sourceRef || activity.id,
    sourceKind: activity.sourceType || "saved",
    area: activity.parameter,
    title: activity.title,
    owner: activity.owner || "Unassigned",
    dueDate: formatDraftDate(activity.dueDate),
    status: activity.status,
    rag: activity.rag,
    expectedLift: activity.expectedLift || "Governed lift",
    confidence: "Saved",
    ruleId: activity.ruleId,
    parameter: activity.parameter,
    impactedMetric: activity.impactedMetric,
    weakSignal: activity.weakSignal,
    currentValue: activity.currentValue,
    targetValue: activity.targetValue,
    triggerLogic: activity.triggerLogic,
    evidenceLiftPolicy: activity.evidenceLiftPolicy,
    activityScoreLogic: activity.activityScoreLogic,
    approvalSla: activity.approvalSla,
    reviewCadence: activity.reviewCadence,
    scoreBand: activity.triggerLogic?.scoreBand?.replace(" band is active.", "") ?? null,
    threshold: extractThresholdNumber(activity.triggerLogic?.threshold),
    targetScore: extractTargetNumber(activity.triggerLogic?.threshold),
    thresholdSource: activity.triggerLogic?.threshold?.split(":")[0] ?? null,
    thresholdReason: activity.triggerLogic?.overrideReason ?? null,
    successCriteria: activity.successCriteria,
    evidenceRequired: activity.evidenceRequired,
    reason: activity.weakSignal || activity.successCriteria,
    evidence,
    evidenceReviews: activity.evidenceReviews,
    latestPendingEvidence: pendingEvidence,
    nextStep: activity.nextStep,
    activityScorePct: activity.activityScorePct,
    reviewState: `Activity score stage: ${activity.activityScorePct}%`,
  };
}

function mapPersistedMeetingActivityToCard(activity) {
  const row = mapPersistedRuleActivityToRow(activity);
  const sourceLabel =
    activity.triggerLogic?.source === "llm_fallback"
      ? "Fireflies meeting (LLM fallback)"
      : activity.triggerLogic?.source === "summary_derived"
        ? "Fireflies meeting (summary derived)"
        : "Fireflies meeting action";

  return {
    ...row,
    id: `meeting-saved-${activity.id}`,
    persisted: true,
    sourceId: activity.sourceRef || activity.id,
    sourceKind: "fireflies_meeting",
    healthArea: row.area,
    meetingTitle: sourceLabel,
    meetingDate: formatDraftDate(activity.generatedAt),
    sourceExcerpt: activity.weakSignal,
    confidence: activity.rag === "R" ? "High" : activity.rag === "G" ? "Low" : "Medium",
    urgency: activity.rag,
  };
}

function getSuggestionSourceRef(item) {
  return item.sourceId ?? item.id;
}

function extractThresholdNumber(summary = "") {
  const match = summary.match(/threshold\s+([0-9.]+)/i);
  return match ? Number(match[1]) : null;
}

function extractTargetNumber(summary = "") {
  const match = summary.match(/target\s+([0-9.]+)/i);
  return match ? Number(match[1]) : null;
}

function getFallbackRuleId(sourceKind) {
  if (sourceKind === "opportunity") return "OPP-01";
  if (sourceKind === "meeting") return "MEET-01";
  return "MANUAL-01";
}

function buildActivityRuleActivityInput({ accountId, target, form }) {
  const { kind, item } = target;
  const sourceRef = getSuggestionSourceRef(item);
  const parameter = item.parameter ?? item.healthArea ?? item.area ?? "Relationship";
  return {
    accountId,
    ruleId: item.ruleId ?? getFallbackRuleId(kind),
    parameter,
    impactedMetric: item.impactedMetric ?? parameter,
    title: form.title.trim(),
    nextStep: form.nextStep.trim(),
    owner: form.owner.trim(),
    dueDate: form.dueDate,
    rag: item.urgency ?? item.rag ?? mapPriorityToRag(item.priority),
    weakSignal: item.weakSignal ?? item.reason ?? item.sourceExcerpt ?? form.nextStep.trim(),
    currentValue: item.currentValue ?? null,
    targetValue: item.targetValue ?? null,
    expectedLift: item.expectedLift ?? `+${formatCurrency(item.potentialValue ?? 0)} potential`,
    successCriteria: item.successCriteria ?? "Complete the activity and review score impact.",
    evidenceRequired: item.evidenceRequired ?? ["Activity evidence"],
    triggerLogic: item.triggerLogic ?? null,
    evidenceLiftPolicy: item.evidenceLiftPolicy ?? null,
    activityScoreLogic: item.activityScoreLogic ?? null,
    approvalSla: item.approvalSla ?? null,
    reviewCadence: item.reviewCadence ?? null,
    scoreBand: item.scoreBand ?? null,
    threshold: item.threshold ?? null,
    targetScore: item.targetScore ?? null,
    thresholdSource: item.thresholdSource ?? null,
    thresholdReason: item.thresholdReason ?? null,
    sourceType: kind,
    sourceRef,
  };
}

function buildRejectedRuleActivityInput({ accountId, target, reason, reviewer }) {
  const sourceKind = target.sourceKind ?? target.healthArea ?? "suggestion";
  const parameter = target.parameter ?? target.healthArea ?? target.area ?? "Relationship";
  return {
    accountId,
    ruleId: target.ruleId ?? getFallbackRuleId(sourceKind),
    parameter,
    impactedMetric: target.impactedMetric ?? parameter,
    title: target.title,
    reason,
    reviewer,
    rag: target.urgency ?? target.rag ?? mapPriorityToRag(target.priority),
    weakSignal: target.weakSignal ?? target.reason ?? target.sourceExcerpt ?? reason,
    currentValue: target.currentValue ?? null,
    targetValue: target.targetValue ?? null,
    expectedLift: target.expectedLift ?? "",
    successCriteria: target.successCriteria ?? "Rejected by reviewer.",
    evidenceRequired: target.evidenceRequired ?? ["Rejection reason"],
    triggerLogic: target.triggerLogic ?? null,
    evidenceLiftPolicy: target.evidenceLiftPolicy ?? null,
    activityScoreLogic: target.activityScoreLogic ?? null,
    approvalSla: target.approvalSla ?? null,
    reviewCadence: target.reviewCadence ?? null,
    sourceType: sourceKind,
    sourceRef: getSuggestionSourceRef(target),
  };
}

function createInitialEvidenceForm(row, submitterName) {
  return {
    submittedBy: submitterName ?? "Unknown",
    evidenceQuality: "Action tracker plus note",
    title: row ? `Evidence for ${row.title}` : "",
    notes: "",
    artifactUrl: "",
  };
}

function buildEvidenceChecklistPayload(evidenceQuality) {
  const checks = {
    "Meeting note only": [
      "Meeting title/date is present",
      "Action is explicit",
      "Account/client context is present",
      "Owner or next step is mentioned",
    ],
    "Action tracker plus note": [
      "Meeting note is present",
      "Owner is assigned",
      "Due date is assigned",
      "Action tracker or task reference is present",
    ],
    "Completed action plus outcome proof": [
      "Completion evidence is present",
      "Outcome/result is documented",
      "Client or internal validation exists",
      "Reviewer can tie outcome to impacted metric",
    ],
  };

  return {
    evidenceQuality,
    checks: checks[evidenceQuality] ?? [],
  };
}

function scoreAreaToParameter(area) {
  const map = {
    relationship: "Relationship",
    project: "Project",
    resource: "Resource",
    financial: "Financial",
    risk: "Risk",
    csat: "CSAT",
    contract: "Financial",
    white_space: "Growth",
  };
  return map[area] ?? area;
}

function getExpectedLiftSortValue(value) {
  const match = String(value ?? "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatLiftNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function summarizeExpectedLift(rows) {
  const percentValues = rows
    .filter((row) => String(row.expectedLift ?? "").includes("%"))
    .map((row) => getExpectedLiftSortValue(row.expectedLift))
    .filter((value) => value !== null);

  if (percentValues.length) {
    const total = percentValues.reduce((sum, value) => sum + value, 0);
    return `${formatLiftNumber(total)}% expected lift`;
  }

  const numericValues = rows
    .map((row) => getExpectedLiftSortValue(row.expectedLift))
    .filter((value) => value !== null);

  if (!numericValues.length) return "0 expected lift";
  return `Max ${formatLiftNumber(Math.max(...numericValues))} expected lift`;
}

function sortActivityRowsByExpectedLift(rows, direction) {
  const baseRows = sortActivityRows(rows);

  return [...baseRows].sort((left, right) => {
    const leftValue = getExpectedLiftSortValue(left.expectedLift);
    const rightValue = getExpectedLiftSortValue(right.expectedLift);

    if (leftValue === null && rightValue === null) return 0;
    if (leftValue === null) return 1;
    if (rightValue === null) return -1;

    return direction === "asc" ? leftValue - rightValue : rightValue - leftValue;
  });
}

function sortActivityRows(rows) {
  const rowTypeOrder = {
    saved: 0,
    suggested: 1,
    existing: 2,
  };
  const ragOrder = { R: 0, A: 1, G: 2 };

  return [...rows].sort((left, right) => {
    const leftArea = ACTIVITY_TAB_AREAS.indexOf(left.area);
    const rightArea = ACTIVITY_TAB_AREAS.indexOf(right.area);
    if (leftArea !== rightArea) return leftArea - rightArea;

    const leftType = rowTypeOrder[left.rowType] ?? 99;
    const rightType = rowTypeOrder[right.rowType] ?? 99;
    if (leftType !== rightType) return leftType - rightType;

    return (ragOrder[left.rag] ?? 99) - (ragOrder[right.rag] ?? 99);
  });
}

function createAiSuggestionActivityForm(suggestion, ownerName) {
  return {
    title: suggestion.title ?? "",
    owner: ownerName ?? "KAM Person",
    dueDate: getFutureDateInput(getSuggestedReviewDays(suggestion)),
    nextStep: suggestion.nextStep ?? suggestion.description ?? suggestion.reason ?? "",
  };
}
/* ============================== TAB 4: Retention VS Growth ============================== */
function RetentionGrowthTab({ account, opportunities, escalations }) {
  const { profile } = useAuth();
  if (account) {
    return (
      <RetentionGrowthTabPlanner
        account={account}
        opportunities={opportunities}
        escalations={escalations}
        profile={profile}
      />
    );
  }
  const editable = ROLE_PERMISSIONS[profile?.role ?? "KAM"].write;
  const delivered = account.retentionGrowth.filter((s) => s.delivered);
  const offeredNotDelivered = account.retentionGrowth.filter((s) => s.offered && !s.delivered);
  const whiteSpace = account.retentionGrowth.filter((s) => !s.offered && s.applicable);
  const notApplicable = account.retentionGrowth.filter((s) => !s.applicable);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="What we are offering & giving">
          <p className="text-[11px] text-muted-foreground mb-3">
            Active services delivered to {account.name}.
          </p>
          <ul className="divide-y">
            {delivered.map((s) => (
              <li key={s.service} className="py-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-success" /> {s.service}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{s.trackingNote}</p>
                </div>
                <span className="text-[10px] font-bold uppercase bg-success/10 text-success px-2 py-0.5 rounded">
                  Live
                </span>
              </li>
            ))}
            {offeredNotDelivered.map((s) => (
              <li key={s.service} className="py-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <Circle className="size-3.5 text-warn" /> {s.service}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{s.trackingNote}</p>
                </div>
                <span className="text-[10px] font-bold uppercase bg-warn/10 text-warn px-2 py-0.5 rounded">
                  In flight
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Growth — applicable but not offered">
          <p className="text-[11px] text-muted-foreground mb-3">
            White-space services we could expand into.
          </p>
          <ul className="divide-y">
            {whiteSpace.length ? (
              whiteSpace.map((s) => (
                <li key={s.service} className="py-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{s.service}</p>
                    <p className="text-[11px] text-muted-foreground">{s.trackingNote}</p>
                  </div>
                  <button
                    disabled={!editable}
                    className="text-[10px] font-bold text-accent uppercase tracking-wider disabled:opacity-40"
                  >
                    Plan pitch →
                  </button>
                </li>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">
                No open white-space services right now.
              </p>
            )}
          </ul>
        </Card>
      </div>

      <Card title="Not applicable to this client">
        <p className="text-[11px] text-muted-foreground mb-3">
          Track explicitly so the team doesn't pitch the wrong thing.
        </p>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          {notApplicable.map((s) => (
            <li key={s.service} className="border rounded-lg p-3">
              <p className="font-semibold">{s.service}</p>
              <p className="text-[11px] text-muted-foreground">{s.trackingNote}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Project Tracking & Client Updates">
        <p className="text-[11px] text-muted-foreground mb-3">
          Cadence of progress updates sent to the client.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="border rounded-lg p-4">
            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
              Weekly status
            </p>
            <p className="text-sm font-semibold mt-1">Sent every Friday</p>
            <p className="text-[11px] text-muted-foreground">Last: 2d ago</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
              Monthly review
            </p>
            <p className="text-sm font-semibold mt-1">2nd Tuesday</p>
            <p className="text-[11px] text-muted-foreground">Next: in 9 days</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
              QBR
            </p>
            <p className="text-sm font-semibold mt-1">Quarterly</p>
            <p className="text-[11px] text-muted-foreground">Next: in 38 days</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
/* ============================== TAB 5: Educate client ============================== */
function EducateTab({ account }) {
  const { profile } = useAuth();
  const editable = ROLE_PERMISSIONS[profile?.role ?? "KAM"].write;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card title="How to build & improve current relationship">
          <ul className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="text-accent font-bold">1.</span> Re-engage{" "}
              {account.primaryContact.name} ({account.primaryContact.role}) with a short sync every
              two weeks.
            </li>
            <li className="flex gap-3">
              <span className="text-accent font-bold">2.</span> Map 1 new stakeholder per quarter to
              widen the relationship beyond a single sponsor.
            </li>
            <li className="flex gap-3">
              <span className="text-accent font-bold">3.</span> Share one industry insight piece per
              month tailored to {account.industry}.
            </li>
            <li className="flex gap-3">
              <span className="text-accent font-bold">4.</span> Translate every project update into
              business outcomes, not features.
            </li>
          </ul>
        </Card>

        <Card title="Education History">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b">
                <th className="pb-2">Date</th>
                <th className="pb-2">Topic</th>
                <th className="pb-2">Approach</th>
                <th className="pb-2">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {account.educationLog.map((e) => (
                <tr key={e.date + e.topic}>
                  <td className="py-3 text-[11px] font-mono text-muted-foreground whitespace-nowrap pr-3">
                    {e.date}
                  </td>
                  <td className="py-3 text-xs font-semibold pr-3">{e.topic}</td>
                  <td className="py-3 text-xs text-muted-foreground pr-3">{e.approach}</td>
                  <td className="py-3 text-xs">{e.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="bg-primary text-primary-foreground rounded-xl p-6 space-y-3">
        <p className="text-[10px] uppercase tracking-widest text-slate-400">
          Suggested Next Education Based on the Backlog
        </p>
        <p className="text-lg font-semibold leading-snug">
          Tell {account.primaryContact.name} what's coming in the next 90 days
        </p>
        <p className="text-xs text-slate-300">
          Recommended approach: 30-min exec brief + 1-pager. Store outcome in Education History.
        </p>
        <div className="flex flex-col gap-2 pt-1">
          <button
            disabled={!editable}
            className="px-4 py-2 bg-white text-primary text-xs font-bold rounded-md disabled:opacity-40"
          >
            Schedule Session
          </button>
          <button
            disabled={!editable}
            className="px-4 py-2 bg-[#25D366] text-white text-xs font-bold rounded-md disabled:opacity-40 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413" />
            </svg>
            Send Suggested Message to WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
/* ============================== TAB 6: Escalation ============================== */
function EscalationsTab({ list }) {
  if (!list.length) {
    return (
      <div className="bg-card border rounded-xl p-12 text-center">
        <AlertTriangle className="size-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No active escalations for this account.</p>
        <p className="text-[11px] text-muted-foreground mt-1">
          When opened, a 48h SLA timer will appear here with RCA, action items, recommendation, and
          a realistic-requirement check.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {list.map((e) => (
        <div key={e.id} className="bg-crit/5 border border-crit/20 rounded-xl p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-crit text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                  {e.priority}
                </span>
                <h3 className="text-sm font-bold">{e.title}</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Opened {e.openedAt} · 48h SLA</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="bg-primary text-primary-foreground px-3 py-1.5 rounded text-[11px] font-mono flex items-center gap-1">
                <Clock className="size-3" /> {e.slaRemainingHours.toFixed(1)}h left
              </div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Last synced with Jira · 3m ago
              </p>
            </div>
          </div>
          <p className="text-sm mb-4">{e.description}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card p-3 rounded border">
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">RCA</p>
              <p className="text-xs">{e.rca}</p>
            </div>
            <div className="bg-card p-3 rounded border">
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">
                Action Items
              </p>
              <ul className="space-y-1.5">
                {e.actionItems.map((a) => (
                  <li key={a.label} className="flex items-center gap-2 text-xs">
                    {a.done ? (
                      <CheckCircle2 className="size-3.5 text-success" />
                    ) : (
                      <Circle className="size-3.5 text-muted-foreground" />
                    )}
                    <span className={a.done ? "line-through text-muted-foreground" : ""}>
                      {a.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-card p-3 rounded border">
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
                Our Recommendation
              </p>
              <p className="text-xs">{e.recommendation ?? "—"}</p>
            </div>
            <div className="bg-card p-3 rounded border">
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
                Realistic / Achievable?
              </p>
              <p className="text-xs">{e.realisticCheck ?? "—"}</p>
            </div>
            <div className="bg-card p-3 rounded border md:col-span-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
                Client Feedback
              </p>
              <p className="text-xs italic">
                {e.clientFeedback ?? "Pending — schedule meeting within 48h."}
              </p>
            </div>
            <div className="bg-card p-3 rounded border md:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                  <span className="inline-block size-1.5 rounded-full bg-accent" />
                  Jira Conversation Summary
                </p>
                <span className="text-[10px] font-mono text-muted-foreground">
                  3 tickets · 12 comments
                </span>
              </div>
              <ul className="space-y-2 text-xs">
                <li className="border-l-2 border-accent/40 pl-3">
                  <p className="font-semibold">
                    [ESC-{e.id.toUpperCase()}-1] On-call engineer acknowledged at 14:02 GMT
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    Hot-patch staged in pre-prod; awaiting QA sign-off before client window.
                  </p>
                </li>
                <li className="border-l-2 border-warn/40 pl-3">
                  <p className="font-semibold">
                    [ESC-{e.id.toUpperCase()}-2] Client requested hourly status updates
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    Set up Slack-Jira bridge to auto-post comments to the client channel.
                  </p>
                </li>
                <li className="border-l-2 border-success/40 pl-3">
                  <p className="font-semibold">
                    [ESC-{e.id.toUpperCase()}-3] RCA draft uploaded by SRE lead
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    Pending KAM review before sharing externally — flagged for 48h SLA.
                  </p>
                </li>
              </ul>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MeetingHistoryTab({ account, profile }) {
  const queryClient = useQueryClient();
  const role = profile?.role ?? "KAM";
  const isAssignedKam = role === "KAM" ? account.assignedKamId === profile?.id : false;
  const canSync = role === "Head of KAM" || (role === "KAM" && isAssignedKam);
  const [syncStatus, setSyncStatus] = useState("");
  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["fireflies-meeting-summaries", account.id],
    queryFn: () => fetchFirefliesMeetingSummaries(account.id),
    enabled: Boolean(account.id),
  });
  const { mutate: syncFirefliesMeetings, isPending: syncingMeetings } = useMutation({
    mutationFn: () =>
      fetchFirefliesRequiredActionItems({
        data: {
          accountId: account.id,
          limit: 10,
          daysBack: 60,
        },
      }),
    onSuccess: (result) => {
      setSyncStatus(result.status ?? "Fireflies meetings synced.");
      queryClient.invalidateQueries({ queryKey: ["fireflies-meeting-summaries", account.id] });
      queryClient.invalidateQueries({ queryKey: ["activity-rule-activities", account.id] });
      queryClient.invalidateQueries({ queryKey: ["opportunities", account.id] });
    },
    onError: (error) => {
      setSyncStatus(error?.message ?? "Fireflies meeting sync failed.");
    },
  });

  const actionCount = meetings.reduce(
    (total, meeting) => total + (meeting.derivedActionItems?.length ?? 0),
    0,
  );
  const opportunityCount = meetings.reduce(
    (total, meeting) => total + (meeting.derivedOpportunities?.length ?? 0),
    0,
  );
  const summaryDerivedCount = meetings.reduce(
    (total, meeting) =>
      total +
      (meeting.derivedActionItems ?? []).filter((item) => item.actionSource === "summary_derived")
        .length,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="bg-card border rounded-xl p-6 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="space-y-2">
          <h3 className="text-sm font-bold">Fireflies Meeting History</h3>
          <p className="text-xs text-muted-foreground max-w-3xl">
            Each synced meeting stores its Fireflies summary, raw action items, agent-derived action
            items, and guardrail diagnostics for {account.name}.
          </p>
          <p
            className={`text-[11px] ${
              syncStatus.includes("failed") || syncStatus.includes("Missing")
                ? "text-crit"
                : "text-muted-foreground"
            }`}
          >
            {syncStatus || "Latest saved meetings appear below after Fireflies sync runs."}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={!canSync || syncingMeetings}
          onClick={() => syncFirefliesMeetings()}
        >
          {syncingMeetings && <Loader2 className="size-3.5 animate-spin mr-1" />}
          Sync Fireflies
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MiniStat label="Meetings saved" value={isLoading ? "Loading" : `${meetings.length}`} />
        <MiniStat label="Action items detected" value={`${actionCount}`} />
        <MiniStat label="Opportunities detected" value={`${opportunityCount}`} />
        <MiniStat label="Summary-derived actions" value={`${summaryDerivedCount}`} />
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-xs text-muted-foreground">
          Loading meeting history...
        </div>
      ) : meetings.length ? (
        <div className="space-y-4">
          {meetings.map((meeting) => (
            <div key={meeting.id} className="bg-card border rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold leading-snug">{meeting.title}</h3>
                    {meeting.agentDiagnostics?.summaryFallbackUsed && (
                      <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-accent/10 text-accent px-2 py-1">
                        Summary derived
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {formatMeetingHistoryDate(meeting.meetingDate)} · synced{" "}
                    {formatMeetingHistoryDate(meeting.syncedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-[10px] font-bold uppercase rounded-full bg-muted text-muted-foreground px-2 py-1">
                    {(meeting.derivedActionItems ?? []).length} actions
                  </span>
                  <span className="text-[10px] font-bold uppercase rounded-full bg-success/10 text-success px-2 py-1">
                    {(meeting.derivedOpportunities ?? []).length} opportunities
                  </span>
                  {meeting.transcriptUrl && (
                    <a
                      href={meeting.transcriptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-bold uppercase tracking-wide text-accent"
                    >
                      Transcript
                    </a>
                  )}
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Summary
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {meeting.overview || meeting.shortSummary || "No summary text available."}
                  </p>
                </div>

                {(meeting.derivedActionItems ?? []).length ? (
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Agent action items
                    </p>
                    <div className="grid gap-3">
                      {meeting.derivedActionItems.map((item) => (
                        <div key={item.id} className="rounded-lg border bg-muted/20 p-3 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <AreaBadge area={item.healthArea} />
                            <RuleBadge ruleId={item.ruleId} />
                            <ConfidenceBadge confidence={item.confidence} />
                            <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-muted text-muted-foreground px-2 py-1">
                              {formatMeetingActionSource(item.actionSource)}
                            </span>
                          </div>
                          <p className="text-sm font-semibold">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.expectedLift}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No action item passed the guarded activity rules for this meeting.
                  </p>
                )}

                {(meeting.derivedOpportunities ?? []).length ? (
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Agent opportunities
                    </p>
                    <div className="grid gap-3">
                      {meeting.derivedOpportunities.map((opportunity) => (
                        <div
                          key={opportunity.id}
                          className="rounded-lg border bg-success/5 p-3 space-y-2"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <AreaBadge area={opportunity.category} />
                            <ConfidenceBadge confidence={opportunity.confidence} />
                            <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-muted text-muted-foreground px-2 py-1">
                              {formatMeetingActionSource(opportunity.sourceType)}
                            </span>
                          </div>
                          <p className="text-sm font-semibold">{opportunity.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(opportunity.potential ?? 0)} · {opportunity.nextStep}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No commercial or retention opportunity passed the guarded opportunity rules.
                  </p>
                )}

                <details className="group rounded-lg border bg-muted/20 text-xs">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
                    <span className="font-bold uppercase tracking-widest text-muted-foreground">
                      Meeting details
                    </span>
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="border-t p-3 space-y-3">
                    <MiniStat
                      label="Participants"
                      value={
                        meeting.participants?.length
                          ? meeting.participants.join(", ")
                          : "Not available"
                      }
                    />
                    <MiniStat
                      label="Raw Fireflies action items"
                      value={meeting.actionItems || "No explicit action items from Fireflies."}
                    />
                    <MiniStat
                      label="Agent diagnostics"
                      value={`Source: ${formatMeetingActionSource(
                        meeting.agentDiagnostics?.actionSource,
                      )}; candidates: ${meeting.agentDiagnostics?.candidateCount ?? 0}; accepted: ${
                        meeting.agentDiagnostics?.acceptedCount ?? 0
                      }; opportunity candidates: ${
                        meeting.agentDiagnostics?.opportunity?.candidateCount ?? 0
                      }; opportunities: ${
                        meeting.agentDiagnostics?.opportunity?.acceptedCount ?? 0
                      }`}
                    />
                  </div>
                </details>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card border rounded-xl p-12 text-center">
          <Clock className="size-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No Fireflies meetings saved yet.</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Sync Fireflies to save meeting summaries and auto-create guarded activity items.
          </p>
        </div>
      )}
    </div>
  );
}

function formatMeetingHistoryDate(value) {
  if (!value) return "Recent";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMeetingActionSource(source) {
  if (source === "llm_fallback") return "LLM fallback";
  if (source === "summary_derived") return "Summary derived";
  if (source === "explicit_action_items") return "Fireflies action item";
  return "Meeting agent";
}

/* ============================== TAB 7: Client History ============================== */
function ClientHistoryTab({ accountId }) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["account-history", accountId],
    queryFn: () => fetchAccountHistory(accountId),
  });
  if (isLoading) {
    return <div className="py-16 text-center text-xs text-muted-foreground">Loading history…</div>;
  }
  if (history.length === 0) {
    return (
      <div className="bg-card border rounded-xl p-12 text-center">
        <Clock className="size-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Every time a KYC field, KAM assignment, or score is updated, it will appear here.
        </p>
      </div>
    );
  }
  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b">
        <h3 className="text-sm font-bold">Change Log</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          All edits to this account — most recent first.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left min-w-[640px]">
          <thead>
            <tr className="bg-muted/30 border-b text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
              <th className="px-6 py-3">Field</th>
              <th className="px-6 py-3">Old Value</th>
              <th className="px-6 py-3">New Value</th>
              <th className="px-6 py-3">Edited By</th>
              <th className="px-6 py-3 text-right">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {history.map((entry) => (
              <HistoryRow key={entry.id} entry={entry} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function HistoryRow({ entry }) {
  return (
    <tr className="hover:bg-muted/20 transition-colors align-top">
      <td className="px-6 py-3 text-xs font-semibold whitespace-nowrap">{entry.fieldName}</td>
      <td className="px-6 py-3 text-xs text-muted-foreground max-w-[200px]">
        <span className="line-clamp-2 block">
          {entry.oldValue ?? <span className="italic">—</span>}
        </span>
      </td>
      <td className="px-6 py-3 text-xs text-foreground max-w-[200px]">
        <span className="line-clamp-2 block">
          {entry.newValue ?? <span className="italic">—</span>}
        </span>
      </td>
      <td className="px-6 py-3 text-xs font-medium whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <div className="size-5 rounded-full bg-accent/10 text-accent flex items-center justify-center text-[9px] font-bold shrink-0">
            {entry.editedBy
              .split(" ")
              .map((p) => p[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          {entry.editedBy}
        </div>
      </td>
      <td className="px-6 py-3 text-right text-[11px] text-muted-foreground whitespace-nowrap">
        {formatHistoryTime(entry.editedAt)}
      </td>
    </tr>
  );
}
function formatHistoryTime(iso) {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
/* ============================== Shared atoms ============================== */
function Card({ title, children }) {
  return (
    <div className="bg-card border rounded-xl p-6">
      <h3 className="text-sm font-bold mb-4">{title}</h3>
      <div className="space-y-3 text-sm">{children}</div>
    </div>
  );
}
function KV({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
function Field({ label, value, ok }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
        {label}
      </p>
      <p
        className={`font-semibold mt-1 ${ok === true ? "text-success" : ok === false ? "text-crit" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
