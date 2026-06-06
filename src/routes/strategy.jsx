import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/data/kam-data";
import { fetchAccounts, fetchKamUsers } from "@/services/db";
import { buildPortfolioStrategyMetrics } from "@/services/portfolio-metrics";
import { useAuth } from "@/context/AuthContext";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeDollarSign,
  ChevronDown,
  CircleDollarSign,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/strategy")({
  head: () => ({
    meta: [
      { title: "Portfolio Strategy - Aether KAM" },
      {
        name: "description",
        content: "Retention vs growth strategy across the account portfolio.",
      },
    ],
  }),
  component: StrategyPage,
});

const QUADRANT_LAYOUT = [
  "Protect & Recover",
  "Expand Aggressively",
  "Reassess / Monitor",
  "Maintain & Nurture",
];

function StrategyPage() {
  const { profile } = useAuth();
  const role = profile?.role ?? "KAM";
  const userId = profile?.id;
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", userId, role],
    queryFn: () => fetchAccounts({ role, userId }),
  });
  const { data: kamUsers = [] } = useQuery({
    queryKey: ["kam-users"],
    queryFn: () => fetchKamUsers(),
  });
  const portfolio = buildPortfolioStrategyMetrics(accounts, kamUsers);
  const quadrantMap = new Map(portfolio.quadrantRows.map((row) => [row.quadrant, row]));
  const urgentAccounts = getUrgentAccounts(accounts).slice(0, 5);
  const growthAccounts = getGrowthAccounts(accounts).slice(0, 5);

  return (
    <div className="flex flex-col">
      <header className="bg-card border-b px-4 py-4 md:px-8 sticky top-14 md:top-0 z-10">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-accent">
              Portfolio Strategy
            </p>
            <h1 className="text-lg font-semibold">Retention vs Growth Command View</h1>
            <p className="text-xs text-muted-foreground">
              Decide where to protect ARR, where to expand, and which KAM needs support.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:min-w-[560px]">
            <CompactMetric
              icon={TrendingUp}
              label="Forecast NRR"
              value={`${portfolio.forecastNRR}%`}
              tone={portfolio.forecastNRR >= 105 ? "success" : "accent"}
            />
            <CompactMetric
              icon={ShieldCheck}
              label="Forecast GRR"
              value={`${portfolio.forecastGRR}%`}
              tone={portfolio.forecastGRR >= 90 ? "success" : "warn"}
            />
            <CompactMetric
              icon={AlertTriangle}
              label="At Risk"
              value={formatCurrency(portfolio.revenueAtRisk)}
              tone="warn"
            />
            <CompactMetric
              icon={BadgeDollarSign}
              label="Growth"
              value={formatCurrency(portfolio.growthPipeline)}
              tone="accent"
            />
          </div>
        </div>
      </header>

      <div className="p-4 md:p-8 max-w-7xl w-full mx-auto space-y-6">
        <section className="grid grid-cols-1 xl:grid-cols-[1fr,360px] gap-6">
          <StrategyDisclosure
            title="Portfolio Matrix"
            subtitle="X-axis is retention health. Y-axis is growth potential."
            meta={
              <span className="flex items-center gap-2">
                <Users className="size-3.5" />
                {accounts.length} accounts mapped
              </span>
            }
            defaultOpen
          >
            <div className="p-4 md:p-5">
              <div className="grid grid-cols-[18px,1fr] gap-3">
                <div className="[writing-mode:vertical-rl] rotate-180 text-[10px] uppercase tracking-widest text-muted-foreground text-center">
                  Growth potential
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {QUADRANT_LAYOUT.map((quadrant) => (
                      <MatrixQuadrant
                        key={quadrant}
                        row={quadrantMap.get(quadrant)}
                        quadrant={quadrant}
                      />
                    ))}
                  </div>
                  <div className="grid grid-cols-3 items-center text-[10px] uppercase tracking-widest text-muted-foreground">
                    <span>Retention risk</span>
                    <span className="text-center">Retention health</span>
                    <span className="text-right">Healthy</span>
                  </div>
                </div>
              </div>
            </div>
          </StrategyDisclosure>

          <aside className="space-y-6">
            <FocusPanel
              title="Protection Focus"
              subtitle={`${portfolio.atRiskAccountCount} accounts need attention`}
              icon={AlertTriangle}
              items={urgentAccounts.map((account) => ({
                id: account.id,
                name: account.name,
                value: account.revenueAtRisk
                  ? formatCurrency(account.revenueAtRisk)
                  : formatCurrency(account.arr),
                detail: `${account.renewalDays}d renewal | ${
                  account.calculatedRetentionRisk ?? account.retentionRisk
                } risk`,
                tone: "warn",
              }))}
              empty="No urgent retention accounts."
            />
            <FocusPanel
              title="Expansion Focus"
              subtitle={`${portfolio.expansionAccountCount} accounts with known upside`}
              icon={Target}
              items={growthAccounts.map((account) => ({
                id: account.id,
                name: account.name,
                value: formatCurrency(account.growthPipelineValue || account.growthUpside),
                detail: `${account.whiteSpaceCount ?? 0} whitespace plays | ${
                  account.growthPotentialLevel ?? "Growth"
                }`,
                tone: "accent",
              }))}
              empty="No expansion accounts with known upside."
            />
          </aside>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[0.95fr,1.05fr] gap-6">
          <StrategyDisclosure
            title="KAM Pressure"
            subtitle="Ranked by at-risk revenue and struggling accounts."
            meta={<CircleDollarSign className="size-4 text-accent" />}
            defaultOpen
          >
            <div className="max-h-[420px] overflow-y-auto divide-y">
              {portfolio.kamBreakdown.map((row) => (
                <KamPressureRow key={row.id} row={row} totalARR={portfolio.totalARR} />
              ))}
              {!portfolio.kamBreakdown.length && (
                <p className="px-5 py-8 text-center text-xs text-muted-foreground">
                  No KAM assignments available.
                </p>
              )}
            </div>
          </StrategyDisclosure>

          <StrategyDisclosure
            title="Priority Account Lanes"
            subtitle="Quick lane view for weekly account reviews."
            defaultOpen
          >
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
              <Lane
                title="Retain"
                tone="warn"
                items={urgentAccounts.map((account) => ({
                  id: account.id,
                  name: account.name,
                  detail: `${account.renewalDays}d renewal | ${formatCurrency(account.arr)} ARR`,
                  tag: account.calculatedRetentionRisk ?? account.retentionRisk,
                }))}
                empty="No retain lane accounts."
              />
              <Lane
                title="Expand"
                tone="accent"
                items={growthAccounts.map((account) => ({
                  id: account.id,
                  name: account.name,
                  detail: `${formatCurrency(account.growthPipelineValue || account.growthUpside)} pipeline`,
                  tag: account.growthPotentialLevel ?? account.tier,
                }))}
                empty="No expand lane accounts."
              />
            </div>
          </StrategyDisclosure>
        </section>
      </div>
    </div>
  );
}

function StrategyDisclosure({ title, subtitle, meta, children, defaultOpen = false }) {
  return (
    <details className="group bg-card border rounded-xl overflow-hidden" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 border-b [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <h2 className="text-sm font-bold truncate">{title}</h2>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3 text-[11px] text-muted-foreground">
          {meta}
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </div>
      </summary>
      {children}
    </details>
  );
}

function CompactMetric({ icon: Icon, label, value, tone = "accent" }) {
  const toneClass = getToneClass(tone);

  return (
    <div className="rounded-lg border bg-background/60 px-3 py-2 min-w-0">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
        <Icon className={`size-3.5 ${toneClass}`} />
        <span className="truncate">{label}</span>
      </div>
      <p className={`mt-1 text-lg font-bold truncate ${toneClass}`}>{value}</p>
    </div>
  );
}

function MatrixQuadrant({ row, quadrant }) {
  const accounts = row?.accounts ?? [];
  const tone = getQuadrantTone(quadrant);

  return (
    <details
      className={`group min-h-[260px] rounded-lg border ${getQuadrantSurface(quadrant)} overflow-hidden`}
      open
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{quadrant}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {getQuadrantPortfolioAction(quadrant)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`text-2xl font-bold ${tone}`}>{accounts.length}</span>
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </div>
      </summary>

      <div className="max-h-[300px] space-y-2 overflow-y-auto px-4 pb-4 pr-2">
        {accounts.map((account) => (
          <AccountMiniLink key={account.id} account={account} />
        ))}
        {!accounts.length && (
          <p className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
            No accounts here.
          </p>
        )}
      </div>
    </details>
  );
}

function AccountMiniLink({ account }) {
  return (
    <Link
      to="/accounts/$accountId"
      params={{ accountId: account.id }}
      className="group flex items-center justify-between gap-3 rounded-md border bg-card/80 px-3 py-2 hover:bg-background transition-colors"
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold truncate">{account.name}</p>
        <p className="text-[11px] text-muted-foreground truncate">
          {formatCurrency(account.arr)} ARR | {account.renewalDays}d renewal
        </p>
      </div>
      <ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

function FocusPanel({ title, subtitle, icon: Icon, items, empty }) {
  return (
    <StrategyDisclosure
      title={title}
      subtitle={subtitle}
      meta={<Icon className="size-4 text-accent" />}
      defaultOpen
    >
      <div className="max-h-[320px] overflow-y-auto divide-y">
        {items.map((item) => (
          <Link
            key={item.id}
            to="/accounts/$accountId"
            params={{ accountId: item.id }}
            className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{item.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{item.detail}</p>
            </div>
            <span className={`shrink-0 text-xs font-bold ${getToneClass(item.tone)}`}>
              {item.value}
            </span>
          </Link>
        ))}
        {!items.length && (
          <p className="px-5 py-8 text-center text-xs text-muted-foreground">{empty}</p>
        )}
      </div>
    </StrategyDisclosure>
  );
}

function KamPressureRow({ row, totalARR }) {
  const riskPct = row.arr ? Math.min(Math.round((row.revenueAtRisk / row.arr) * 100), 100) : 0;
  const portfolioShare = totalARR ? Math.min(Math.round((row.arr / totalARR) * 100), 100) : 0;

  return (
    <div className="px-5 py-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{row.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {row.accounts} accounts | {row.strugglingAccounts} struggling
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-warn">{formatCurrency(row.revenueAtRisk)}</p>
          <p className="text-[11px] text-muted-foreground">at risk</p>
        </div>
      </div>
      <div className="grid grid-cols-[1fr,auto] items-center gap-3 text-[11px]">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-warn" style={{ width: `${riskPct}%` }} />
        </div>
        <span className="font-mono text-muted-foreground">{riskPct}% risk</span>
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{formatCurrency(row.arr)} ARR</span>
        <span>{portfolioShare}% of portfolio</span>
        <span>{formatCurrency(row.growthPipeline)} growth</span>
      </div>
    </div>
  );
}

function Lane({ title, tone, items, empty }) {
  return (
    <div className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold">{title}</h3>
        <span className={`text-xs font-bold ${getToneClass(tone)}`}>{items.length}</span>
      </div>
      <div className="mt-4 max-h-[340px] space-y-2 overflow-y-auto pr-1">
        {items.map((item) => (
          <Link
            key={item.id}
            to="/accounts/$accountId"
            params={{ accountId: item.id }}
            className="block rounded-lg border px-3 py-3 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold truncate">{item.name}</p>
              <span className="text-[10px] px-2 py-1 bg-muted rounded font-semibold uppercase tracking-wider">
                {item.tag}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{item.detail}</p>
          </Link>
        ))}
        {!items.length && <p className="py-8 text-center text-xs text-muted-foreground">{empty}</p>}
      </div>
    </div>
  );
}

function getUrgentAccounts(accounts) {
  return [...accounts]
    .filter(
      (account) =>
        account.revenueAtRisk > 0 ||
        account.retentionRisk !== "Low" ||
        account.calculatedRetentionRisk !== "Low" ||
        account.health < 75,
    )
    .sort(
      (left, right) =>
        (right.revenueAtRisk ?? 0) - (left.revenueAtRisk ?? 0) ||
        getRiskRank(right.calculatedRetentionRisk ?? right.retentionRisk) -
          getRiskRank(left.calculatedRetentionRisk ?? left.retentionRisk) ||
        (left.renewalDays ?? Infinity) - (right.renewalDays ?? Infinity),
    );
}

function getGrowthAccounts(accounts) {
  return [...accounts]
    .filter((account) => (account.growthPipelineValue || account.growthUpside) > 0)
    .sort(
      (left, right) =>
        (right.growthPipelineValue || right.growthUpside || 0) -
        (left.growthPipelineValue || left.growthUpside || 0),
    );
}

function getRiskRank(risk) {
  if (risk === "High") return 3;
  if (risk === "Medium") return 2;
  return 1;
}

function getToneClass(tone) {
  return (
    {
      success: "text-success",
      warn: "text-warn",
      crit: "text-crit",
      accent: "text-accent",
    }[tone] ?? "text-accent"
  );
}

function getQuadrantTone(quadrant) {
  if (quadrant === "Protect & Recover") return "text-warn";
  if (quadrant === "Expand Aggressively") return "text-success";
  if (quadrant === "Reassess / Monitor") return "text-crit";
  return "text-accent";
}

function getQuadrantSurface(quadrant) {
  if (quadrant === "Protect & Recover") return "bg-warn/5 border-warn/30";
  if (quadrant === "Expand Aggressively") return "bg-success/5 border-success/30";
  if (quadrant === "Reassess / Monitor") return "bg-crit/5 border-crit/30";
  return "bg-accent/5 border-accent/30";
}

function getQuadrantPortfolioAction(quadrant) {
  if (quadrant === "Protect & Recover") return "Protect ARR first, then reopen expansion.";
  if (quadrant === "Expand Aggressively") return "Prioritize executive expansion motion.";
  if (quadrant === "Reassess / Monitor") return "Resolve blockers or reset account strategy.";
  return "Maintain cadence and watch for whitespace.";
}
