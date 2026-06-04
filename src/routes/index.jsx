import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  formatCurrency,
  portfolioNews,
  openActionItems,
  getAccount,
  calendarSources,
  globalCalendar,
} from "@/data/kam-data";
import { fetchAccounts, fetchEscalations } from "@/services/db";
import { createGoogleCalendarAuthUrl, fetchGoogleCalendarDashboard } from "@/services/calendar";
import { StatCard } from "@/components/shared/StatCard";
import { useAuth } from "@/context/AuthContext";
import {
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Newspaper,
  ListChecks,
  UserPlus,
  UserCog,
  Calendar,
  Trophy,
  ShieldAlert,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Aether KAM" },
      {
        name: "description",
        content: "Portfolio overview, account health, and active escalations.",
      },
    ],
  }),
  component: DashboardPage,
});
function DashboardPage() {
  const { session, profile } = useAuth();
  const role = profile?.role ?? "KAM";
  const userId = profile?.id;
  const [selectedCalendarSource, setSelectedCalendarSource] = useState("all");
  const [calendarView, setCalendarView] = useState("month");
  const [calendarCursor, setCalendarCursor] = useState(() => new Date());
  const startCalendarConnect = useServerFn(createGoogleCalendarAuthUrl);
  const loadGoogleCalendar = useServerFn(fetchGoogleCalendarDashboard);
  const { data: accounts = [], error: accountsError } = useQuery({
    queryKey: ["accounts", userId, role],
    queryFn: () => fetchAccounts({ role, userId }),
  });
  const { data: escalations = [] } = useQuery({
    queryKey: ["escalations"],
    queryFn: () => fetchEscalations(),
  });
  const {
    data: liveCalendar,
    error: calendarError,
    isFetching: calendarFetching,
    refetch: refetchCalendar,
  } = useQuery({
    queryKey: ["google-calendar", userId, session?.access_token],
    queryFn: () =>
      loadGoogleCalendar({
        data: {
          authAccessToken: session.access_token,
          profileId: userId,
          redirectOrigin: window.location.origin,
        },
      }),
    enabled: Boolean(session?.access_token && userId),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const {
    mutate: connectCalendar,
    error: connectCalendarError,
    isPending: calendarConnecting,
  } = useMutation({
    mutationFn: () =>
      startCalendarConnect({
        data: {
          authAccessToken: session.access_token,
          profileId: userId,
          redirectOrigin: window.location.origin,
        },
      }),
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
  });
  const liveSources = liveCalendar?.sources ?? [];
  const hasLiveCalendar = liveSources.length > 0;
  const displayedCalendarSources = hasLiveCalendar ? liveSources : calendarSources;
  const displayedCalendarEvents = useMemo(() => {
    const events = hasLiveCalendar ? (liveCalendar?.events ?? []) : globalCalendar;
    return events.map((event) => {
      if (event.accountId) return event;
      const title = event.title.toLowerCase();
      const matchedAccount = accounts.find((account) => {
        const name = account.name.toLowerCase();
        const code = account.shortCode?.toLowerCase();
        return title.includes(name) || (code && title.includes(code));
      });
      return matchedAccount ? { ...event, accountId: matchedAccount.id } : event;
    });
  }, [accounts, hasLiveCalendar, liveCalendar?.events]);
  const filteredCalendarEvents =
    selectedCalendarSource === "all"
      ? displayedCalendarEvents
      : displayedCalendarEvents.filter((event) => event.source === selectedCalendarSource);
  useEffect(() => {
    if (
      selectedCalendarSource !== "all" &&
      !displayedCalendarSources.some((source) => source.id === selectedCalendarSource)
    ) {
      setSelectedCalendarSource("all");
    }
  }, [displayedCalendarSources, selectedCalendarSource]);
  const calendarStatusMessage =
    connectCalendarError?.message ||
    calendarError?.message ||
    liveCalendar?.message ||
    (!hasLiveCalendar ? "Showing sample calendar data until Google Calendar is connected." : "");
  const portfolioTotals = {
    totalARR: accounts.reduce((s, a) => s + a.arr, 0),
    atRiskARR: accounts.filter((a) => a.status !== "healthy").reduce((s, a) => s + a.arr, 0),
    growthUpside: accounts.reduce((s, a) => s + a.growthUpside, 0),
    avgHealth: accounts.length
      ? Math.round(accounts.reduce((s, a) => s + a.health, 0) / accounts.length)
      : 0,
    activeEscalations: escalations.length,
  };
  return (
    <div className="flex flex-col">
      {accountsError && (
        <div className="m-4 p-3 bg-crit/10 border border-crit/30 rounded-lg text-xs text-crit font-mono whitespace-pre-wrap">
          DB error: {JSON.stringify(accountsError, null, 2)}
        </div>
      )}
      <header className="bg-card border-b flex flex-col md:flex-row md:h-16 md:items-center md:justify-between px-4 md:px-8 py-3 md:py-0 gap-2 sticky top-14 md:top-0 z-10">
        <div>
          <h1 className="font-semibold text-base md:text-lg">Portfolio Dashboard</h1>
          <p className="text-[11px] md:text-xs text-muted-foreground">
            Real-time relationship diagnostics across all key accounts
          </p>
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
              <Link
                to="/accounts"
                className="text-[11px] font-semibold text-accent hover:underline"
              >
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
                            a.health >= 75 ? "bg-success" : a.health >= 55 ? "bg-warn" : "bg-crit"
                          }`}
                          style={{ width: `${a.health}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono font-bold">{a.health}</span>
                      <span
                        className={`text-[11px] flex items-center gap-0.5 ${a.trend >= 0 ? "text-success" : "text-crit"}`}
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
                <Link
                  to="/escalations"
                  className="text-[11px] font-semibold text-accent hover:underline"
                >
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
                          e.priority === "P1" ? "bg-crit/10 text-crit" : "bg-warn/10 text-warn"
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
                  n.type === "new_account"
                    ? UserPlus
                    : n.type === "management_change"
                      ? UserCog
                      : n.type === "renewal"
                        ? Calendar
                        : n.type === "milestone"
                          ? Trophy
                          : n.type === "risk"
                            ? ShieldAlert
                            : AlertTriangle;
                const tone =
                  n.type === "new_account"
                    ? "text-success bg-success/10"
                    : n.type === "management_change"
                      ? "text-accent bg-accent/10"
                      : n.type === "renewal"
                        ? "text-warn bg-warn/10"
                        : n.type === "milestone"
                          ? "text-accent bg-accent/10"
                          : n.type === "risk"
                            ? "text-crit bg-crit/10"
                            : "text-muted-foreground bg-muted";
                return (
                  <div key={n.id} className="px-6 py-3 flex items-start gap-3">
                    <span
                      className={`size-7 rounded-md flex items-center justify-center shrink-0 ${tone}`}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{n.body}</p>
                      <p className="text-[10px] font-mono uppercase text-muted-foreground mt-1">
                        {n.time}
                        {acc ? ` · ${acc.name}` : ""}
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
                        a.priority === "P1"
                          ? "bg-crit/10 text-crit"
                          : a.priority === "P2"
                            ? "bg-warn/10 text-warn"
                            : "bg-muted text-muted-foreground"
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
                Unified view of company Google Workspace + every linked mailbox. No more
                swivel-chairing.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="h-8 rounded-md border bg-muted/30 p-0.5 flex items-center">
                {["month", "week"].map((view) => (
                  <button
                    key={view}
                    onClick={() => setCalendarView(view)}
                    className={`h-6 px-2.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      calendarView === view
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {view}
                  </button>
                ))}
              </div>
              <select
                value={selectedCalendarSource}
                onChange={(e) => setSelectedCalendarSource(e.target.value)}
                className="h-8 max-w-[220px] rounded-md border bg-card px-2 text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Filter calendar events"
              >
                <option value="all">All calendars</option>
                {displayedCalendarSources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => refetchCalendar()}
                disabled={calendarFetching || !session?.access_token}
                className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {calendarFetching ? "Syncing..." : "Sync now"}
              </button>
              <button
                onClick={() => connectCalendar()}
                disabled={calendarConnecting || !session?.access_token}
                className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-md bg-accent text-white flex items-center gap-1 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="size-3" />
                {calendarConnecting ? "Connecting..." : "Connect calendar"}
              </button>
            </div>
          </div>

          {calendarStatusMessage && (
            <div className="px-4 md:px-6 py-2 border-b bg-muted/30 text-[11px] text-muted-foreground">
              {calendarStatusMessage}
            </div>
          )}

          {/* connected calendar sources */}
          <div className="px-4 md:px-6 py-3 border-b flex flex-wrap gap-2">
            {displayedCalendarSources.map((s) => (
              <span
                key={s.id}
                className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border ${s.connected ? "bg-muted/40" : "bg-muted/10 opacity-50"}`}
                title={s.email}
              >
                <span className={`size-2 rounded-full ${s.color}`} />
                <span className="font-semibold">{s.label}</span>
                <span className="text-muted-foreground hidden sm:inline">· {s.provider}</span>
                {!s.connected && (
                  <span className="text-[9px] uppercase font-bold text-muted-foreground">Off</span>
                )}
              </span>
            ))}
          </div>

          <CalendarBoard
            accounts={accounts}
            cursor={calendarCursor}
            events={filteredCalendarEvents}
            onCursorChange={setCalendarCursor}
            sources={displayedCalendarSources}
            view={calendarView}
          />
        </section>
      </div>
    </div>
  );
}
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_TITLE = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const SHORT_DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const EVENT_TIME = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
function CalendarBoard({ accounts, cursor, events, onCursorChange, sources, view }) {
  const days = useMemo(() => getCalendarDays(cursor, view), [cursor, view]);
  const calendarEvents = useMemo(
    () =>
      events
        .map((event) => ({ ...event, calendarDate: parseCalendarEventDate(event) }))
        .filter((event) => event.calendarDate)
        .sort((a, b) => a.calendarDate.getTime() - b.calendarDate.getTime()),
    [events],
  );
  const eventsByDay = useMemo(() => {
    const grouped = new Map();
    calendarEvents.forEach((event) => {
      const key = dayKey(event.calendarDate);
      grouped.set(key, [...(grouped.get(key) ?? []), event]);
    });
    return grouped;
  }, [calendarEvents]);
  const title =
    view === "month"
      ? MONTH_TITLE.format(cursor)
      : `${SHORT_DATE.format(days[0])} - ${SHORT_DATE.format(days[6])}`;
  const today = startOfDay(new Date());
  const goToToday = () => onCursorChange(new Date());
  const move = (direction) => {
    onCursorChange(
      view === "month" ? addMonths(cursor, direction) : addDays(cursor, direction * 7),
    );
  };

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-lg font-bold">{title}</p>
          <p className="text-[11px] text-muted-foreground">
            {calendarEvents.length} upcoming event{calendarEvents.length === 1 ? "" : "s"} in this
            view
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="h-8 px-3 rounded-md border text-[11px] font-bold uppercase tracking-wider hover:bg-muted transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => move(-1)}
            className="size-8 rounded-md border flex items-center justify-center hover:bg-muted transition-colors"
            aria-label={`Previous ${view}`}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            onClick={() => move(1)}
            className="size-8 rounded-md border flex items-center justify-center hover:bg-muted transition-colors"
            aria-label={`Next ${view}`}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-background">
        <div className="grid grid-cols-7 min-w-[760px] border-b bg-muted/30">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 min-w-[760px]">
          {days.map((day) => {
            const key = dayKey(day);
            const dayEvents = eventsByDay.get(key) ?? [];
            const visibleEvents = view === "month" ? dayEvents.slice(0, 3) : dayEvents;
            const outsideMonth = view === "month" && day.getMonth() !== cursor.getMonth();
            const isToday = sameDay(day, today);

            return (
              <div
                key={key}
                className={`border-r border-b p-2 ${
                  view === "week" ? "min-h-[420px]" : "min-h-[130px]"
                } ${outsideMonth ? "bg-muted/20 text-muted-foreground" : "bg-background"}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className={`size-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      isToday ? "bg-accent text-white" : ""
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {dayEvents.length}
                    </span>
                  )}
                </div>
                <div
                  className={
                    view === "week" ? "space-y-2 max-h-[360px] overflow-y-auto" : "space-y-1"
                  }
                >
                  {visibleEvents.map((event) => (
                    <CalendarEventCard
                      key={event.id}
                      account={findCalendarAccount(event, accounts)}
                      compact={view === "month"}
                      event={event}
                      source={sources.find((source) => source.id === event.source)}
                    />
                  ))}
                  {view === "month" && dayEvents.length > visibleEvents.length && (
                    <p className="text-[10px] font-semibold text-muted-foreground px-1">
                      +{dayEvents.length - visibleEvents.length} more
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {!calendarEvents.length && (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            No upcoming events or tasks found for this calendar.
          </div>
        )}
      </div>
    </div>
  );
}
function CalendarEventCard({ account, compact, event, source }) {
  const typeClass =
    event.type === "qbr"
      ? "bg-accent/10 text-accent"
      : event.type === "call"
        ? "bg-warn/10 text-warn"
        : event.type === "task"
          ? "bg-muted text-muted-foreground"
          : "bg-success/10 text-success";
  const content = (
    <>
      <div className="flex items-start gap-1.5">
        <span
          className={`mt-1 size-2 rounded-full shrink-0 ${source?.color ?? "bg-muted-foreground"}`}
        />
        <div className="min-w-0">
          <p
            className={`font-semibold leading-tight truncate ${compact ? "text-[11px]" : "text-xs"}`}
          >
            {event.title}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
            {formatEventClock(event)}
            {account ? ` - ${account.name}` : ""}
          </p>
        </div>
      </div>
      {!compact && (
        <div className="mt-2 flex flex-wrap gap-1">
          <span
            className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${typeClass}`}
          >
            {event.type}
          </span>
          {event.attendees && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {event.attendees} guests
            </span>
          )}
        </div>
      )}
    </>
  );

  if (event.htmlLink) {
    return (
      <a
        href={event.htmlLink}
        target="_blank"
        rel="noreferrer"
        className="block rounded-md border bg-card p-2 hover:border-accent/40 hover:bg-muted/30 transition-colors"
      >
        {content}
      </a>
    );
  }

  return <div className="rounded-md border bg-card p-2">{content}</div>;
}
function getCalendarDays(cursor, view) {
  const start =
    view === "week"
      ? startOfWeek(cursor)
      : startOfWeek(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
  const count = view === "week" ? 7 : 42;
  return Array.from({ length: count }, (_, index) => addDays(start, index));
}
function parseCalendarEventDate(event) {
  if (event.startDateTime) {
    const parsed = new Date(event.startDateTime);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const start = String(event.start ?? "");
  const today = startOfDay(new Date());
  const timeMatch = start.match(/(\d{1,2}):(\d{2})/);
  const withTime = (date) => {
    const next = new Date(date);
    if (timeMatch) {
      next.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
    }
    return next;
  };

  if (start.startsWith("Today")) return withTime(today);
  if (start.startsWith("Tomorrow")) return withTime(addDays(today, 1));

  const weekday = WEEKDAYS.findIndex((day) => start.startsWith(day));
  if (weekday >= 0) {
    const diff = (weekday - today.getDay() + 7) % 7;
    return withTime(addDays(today, diff));
  }

  const parsed = new Date(start);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function formatEventClock(event) {
  if (event.type === "task") return "Due";
  const date = event.calendarDate ?? parseCalendarEventDate(event);
  if (!date) return event.start ?? "Time TBD";
  const duration = event.durationMin ? ` (${event.durationMin}m)` : "";
  return `${EVENT_TIME.format(date)}${duration}`;
}
function findCalendarAccount(event, accounts) {
  if (!event.accountId) return null;
  return (
    accounts.find((account) => account.id === event.accountId) ??
    getAccount(event.accountId) ??
    null
  );
}
function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}
function startOfWeek(date) {
  const next = startOfDay(date);
  next.setDate(next.getDate() - next.getDay());
  return next;
}
function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}
function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function dayKey(date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].join("-");
}
