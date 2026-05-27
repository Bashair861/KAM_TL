import { createFileRoute, Link } from "@tanstack/react-router";
import { accounts, portfolioTotals, formatCurrency, escalations, portfolioNews, openActionItems, getAccount, calendarSources, globalCalendar } from "@/data/kam-data";
import { StatCard } from "@/components/shared/StatCard";
import { ArrowUpRight, TrendingUp, TrendingDown, AlertTriangle, Newspaper, ListChecks, UserPlus, UserCog, Calendar, Trophy, ShieldAlert, CalendarDays, Plus } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Aether KAM" },
      { name: "description", content: "Portfolio overview, account health, and active escalations." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div className="flex flex-col">
      <header className="bg-card border-b flex flex-col md:flex-row md:h-16 md:items-center md:justify-between px-4 md:px-8 py-3 md:py-0 gap-2 sticky top-14 md:top-0 z-10">
        <div>
          <h1 className="font-semibold text-base md:text-lg">Portfolio Dashboard</h1>
          <p className="text-[11px] md:text-xs text-muted-foreground">Real-time relationship diagnostics across all key accounts</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[11px] md:text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-success" />
            System stable · Last sync 2m ago
          </div>
        </div>
      </header>

      <div className="p-4 md:p-8 max-w-7xl w-full mx-auto space-y-6 md:space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            label="Avg Health Score"
            value={portfolioTotals.avgHealth}
            hint="Across 5 active accounts"
            accent="success"
            bar={portfolioTotals.avgHealth}
            info="Weighted average of each account's composite Health Score (0–100). Composed of 8 sub-scores: Relationship, Project, White-space, Contract, CSAT, Risk, Resources, and Financial health — each on a 0–10 scale and scaled to 100."
          />
          <StatCard
            label="Portfolio ARR"
            value={formatCurrency(portfolioTotals.totalARR)}
            hint="+8.4% vs last quarter"
            accent="accent"
            info="Sum of Annual Recurring Revenue across every active key account. Calculated as Σ (account.arr) — billed contract value normalised to a 12-month run-rate, excluding one-off services."
          />
          <StatCard
            label="At-Risk ARR"
            value={formatCurrency(portfolioTotals.atRiskARR)}
            hint="2 accounts in watch"
            accent="warn"
            info="ARR of accounts whose Health Score is below 60 OR whose Retention Risk is rated Medium/High. Formula: Σ (arr where health < 60 OR retentionRisk ∈ {Medium, High})."
          />
          <StatCard
            label="Growth Upside"
            value={formatCurrency(portfolioTotals.growthUpside)}
            hint="15 whitespace items"
            accent="accent"
            info="Estimated incremental ARR from white-space opportunities (services applicable to the client but not yet sold). Sum of pipeline-weighted growthUpside values across accounts."
          />
        </div>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card rounded-xl border shadow-sm">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="text-sm font-bold">Key Accounts</h3>
              <Link to="/accounts" className="text-[11px] font-semibold text-accent hover:underline">
                View all →
              </Link>
            </div>
            <div className="divide-y">
              {accounts.map((a) => (
                <Link
                  key={a.id}
                  to="/accounts/$accountId"
                  params={{ accountId: a.id }}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-muted/40 transition-colors group"
                >
                  <div className="size-10 rounded-lg bg-primary/5 border flex items-center justify-center font-bold text-sm">
                    {a.shortCode}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate">{a.name}</p>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {a.industry}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="w-24 bg-muted h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            a.health >= 75
                              ? "bg-success"
                              : a.health >= 55
                                ? "bg-warn"
                                : "bg-crit"
                          }`}
                          style={{ width: `${a.health}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono font-bold">{a.health}</span>
                      <span
                        className={`text-[11px] flex items-center gap-0.5 ${
                          a.trend >= 0 ? "text-success" : "text-crit"
                        }`}
                      >
                        {a.trend >= 0 ? (
                          <TrendingUp className="size-3" />
                        ) : (
                          <TrendingDown className="size-3" />
                        )}
                        {a.trend >= 0 ? "+" : ""}
                        {a.trend}%
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCurrency(a.arr)}</p>
                    <p className="text-[11px] text-muted-foreground">{a.renewalDays}d to renewal</p>
                  </div>
                  <ArrowUpRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-card rounded-xl border shadow-sm">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <AlertTriangle className="size-4 text-crit" />
                  Active Escalations
                </h3>
                <Link to="/escalations" className="text-[11px] font-semibold text-accent hover:underline">
                  Open console →
                </Link>
              </div>
              <div className="divide-y">
                {escalations.map((e) => (
                  <Link
                    key={e.id}
                    to="/escalations"
                    className="block px-6 py-4 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          e.priority === "P1"
                            ? "bg-crit/10 text-crit"
                            : "bg-warn/10 text-warn"
                        }`}
                      >
                        {e.priority}
                      </span>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        SLA {Math.floor(e.slaRemainingHours)}h
                      </span>
                    </div>
                    <p className="text-sm font-semibold leading-snug">{e.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">Opened {e.openedAt}</p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="bg-primary text-primary-foreground rounded-xl p-6">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">This week</p>
              <p className="text-2xl font-bold leading-tight">
                4 QBRs scheduled <span className="text-slate-400">·</span> 12 touchpoints logged
              </p>
              <p className="text-xs text-slate-400 mt-3">
                Cooperation index up 1.4 points across the portfolio.
              </p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Portfolio News */}
          <div className="bg-card rounded-xl border shadow-sm">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Newspaper className="size-4 text-accent" />
                Portfolio News
              </h3>
              <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                {portfolioNews.length} updates
              </span>
            </div>
            <div className="divide-y max-h-[420px] overflow-y-auto">
              {portfolioNews.map((n) => {
                const acc = n.accountId ? getAccount(n.accountId) : undefined;
                const Icon =
                  n.type === "new_account" ? UserPlus :
                  n.type === "management_change" ? UserCog :
                  n.type === "renewal" ? Calendar :
                  n.type === "milestone" ? Trophy :
                  n.type === "risk" ? ShieldAlert :
                  AlertTriangle;
                const tone =
                  n.type === "new_account" ? "text-success bg-success/10" :
                  n.type === "management_change" ? "text-accent bg-accent/10" :
                  n.type === "renewal" ? "text-warn bg-warn/10" :
                  n.type === "milestone" ? "text-accent bg-accent/10" :
                  n.type === "risk" ? "text-crit bg-crit/10" :
                  "text-muted-foreground bg-muted";
                return (
                  <div key={n.id} className="px-6 py-3 flex items-start gap-3">
                    <span className={`size-7 rounded-md flex items-center justify-center shrink-0 ${tone}`}>
                      <Icon className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{n.body}</p>
                      <p className="text-[10px] font-mono uppercase text-muted-foreground mt-1">
                        {n.time}{acc ? ` · ${acc.name}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* My open action items */}
          <div className="bg-card rounded-xl border shadow-sm">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <ListChecks className="size-4 text-accent" />
                My Open Action Items
              </h3>
              <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                {openActionItems.length} open
              </span>
            </div>
            <div className="divide-y max-h-[420px] overflow-y-auto">
              {openActionItems.map((a) => {
                const acc = a.accountId ? getAccount(a.accountId) : undefined;
                return (
                  <div key={a.id} className="px-6 py-3 flex items-start gap-3">
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
                        a.priority === "P1" ? "bg-crit/10 text-crit" :
                        a.priority === "P2" ? "bg-warn/10 text-warn" :
                        "bg-muted text-muted-foreground"
                      }`}
                    >
                      {a.priority}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug">{a.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {acc?.name ?? "Portfolio"} · {a.source}
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                      {a.due}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Global Calendar — aggregated company + multi-mailbox calendars */}
        <section className="bg-card rounded-xl border shadow-sm">
          <div className="px-4 md:px-6 py-4 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <CalendarDays className="size-4 text-accent" />
                Global Calendar
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Unified view of company Google Workspace + every linked mailbox. No more swivel-chairing.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md border hover:bg-muted transition-colors">
                Sync now
              </button>
              <button className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md bg-accent text-white flex items-center gap-1 hover:opacity-90 transition-opacity">
                <Plus className="size-3" /> Connect calendar
              </button>
            </div>
          </div>

          {/* connected calendar sources */}
          <div className="px-4 md:px-6 py-3 border-b flex flex-wrap gap-2">
            {calendarSources.map((s) => (
              <span
                key={s.id}
                className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border ${
                  s.connected ? "bg-muted/40" : "bg-muted/10 opacity-50"
                }`}
                title={s.email}
              >
                <span className={`size-2 rounded-full ${s.color}`} />
                <span className="font-semibold">{s.label}</span>
                <span className="text-muted-foreground hidden sm:inline">· {s.provider}</span>
                {!s.connected && <span className="text-[9px] uppercase font-bold text-muted-foreground">Off</span>}
              </span>
            ))}
          </div>

          {/* unified event timeline */}
          <ul className="divide-y max-h-[420px] overflow-y-auto">
            {globalCalendar.map((e) => {
              const src = calendarSources.find((s) => s.id === e.source);
              const acc = e.accountId ? getAccount(e.accountId) : undefined;
              return (
                <li key={e.id} className="px-4 md:px-6 py-3 flex items-start gap-3 hover:bg-muted/30 transition-colors">
                  <span className={`mt-1 size-2 rounded-full shrink-0 ${src?.color ?? "bg-muted-foreground"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold leading-snug">{e.title}</p>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
                        e.type === "qbr" ? "bg-accent/10 text-accent" :
                        e.type === "call" ? "bg-warn/10 text-warn" :
                        e.type === "task" ? "bg-muted text-muted-foreground" :
                        "bg-success/10 text-success"
                      }`}>{e.type}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {e.start} · {e.durationMin}m
                      {acc && <> · {acc.name}</>}
                      {e.attendees && <> · {e.attendees} attendees</>}
                    </p>
                    <p className="text-[10px] font-mono uppercase text-muted-foreground mt-0.5">
                      via {src?.label ?? "unknown"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
