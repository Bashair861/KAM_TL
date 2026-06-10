import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  Clock,
  Database,
  DollarSign,
  Gauge,
  Loader2,
  Lock,
  RefreshCcw,
  Shield,
  UserRound,
} from "lucide-react";
import {
  AI_USAGE_REFRESH_LABEL,
  fetchAiCostDashboard,
  OPENAI_PRICING_SOURCE_URL,
} from "@/services/ai-usage";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/ai-costs")({
  head: () => ({
    meta: [
      { title: "AI Costs - tkxel KAM" },
      {
        name: "description",
        content: "Head of KAM AI usage, token, and estimated cost dashboard.",
      },
    ],
  }),
  component: AiCostsPage,
});

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const numberFormatter = new Intl.NumberFormat("en-US");

function formatUsd(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed === 0) return "$0.00";
  return currencyFormatter.format(parsed);
}

function formatNumber(value) {
  return numberFormatter.format(Math.round(Number(value) || 0));
}

function formatTokens(value) {
  const parsed = Number(value) || 0;
  if (parsed >= 1_000_000) return `${(parsed / 1_000_000).toFixed(2)}M`;
  if (parsed >= 1_000) return `${(parsed / 1_000).toFixed(1)}K`;
  return formatNumber(parsed);
}

function formatDateTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const SCROLL_AREA_STYLE = { scrollbarGutter: "stable" };

function AiCostsPage() {
  const { profile, loading } = useAuth();
  const isHeadOfKam = profile?.role === "Head of KAM";

  const dashboardQuery = useQuery({
    queryKey: ["ai-cost-dashboard", profile?.role],
    queryFn: () => fetchAiCostDashboard({ data: { role: profile?.role } }),
    enabled: isHeadOfKam,
    refetchInterval: MS_PER_DAY,
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        Loading AI costs
      </div>
    );
  }

  if (!isHeadOfKam) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="border rounded-lg bg-card p-8 text-center">
          <Lock className="size-10 mx-auto text-muted-foreground mb-3" />
          <h1 className="text-xl font-bold">Access restricted</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Only Head of KAM users can view AI usage and cost.
          </p>
        </div>
      </div>
    );
  }

  const dashboard = dashboardQuery.data;
  const totals = dashboard?.totals ?? {};
  const last30d = totals.last30d ?? {};
  const features = dashboard?.features ?? [];
  const kamCosts = dashboard?.kamCosts ?? [];
  const daily = dashboard?.daily ?? [];
  const pricing = dashboard?.pricing ?? [];

  return (
    <div className="px-4 md:px-8 py-8 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-accent mb-1">
            AI Cost Control
          </p>
          <h1 className="text-2xl font-bold">AI Costs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {AI_USAGE_REFRESH_LABEL} OpenAI token usage and estimated spend for tkxel KAM agents.
          </p>
        </div>
        <button
          type="button"
          onClick={() => dashboardQuery.refetch()}
          disabled={dashboardQuery.isFetching}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {dashboardQuery.isFetching ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCcw className="size-4" />
          )}
          Refresh
        </button>
      </header>

      {dashboard?.setupRequired && (
        <section className="border border-warn/30 bg-warn/10 rounded-lg p-4 flex items-start gap-3">
          <Database className="size-5 text-warn shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-bold">Usage table not ready</h2>
            <p className="text-sm text-muted-foreground mt-1">{dashboard.setupMessage}</p>
          </div>
        </section>
      )}

      {dashboardQuery.error && (
        <section className="border border-crit/30 bg-crit/10 rounded-lg p-4 text-sm text-crit">
          {dashboardQuery.error.message}
        </section>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricTile
          icon={DollarSign}
          label="Last 24h Cost"
          value={formatUsd(totals.last24h?.estimatedCostUsd)}
          detail={`${formatTokens(totals.last24h?.totalTokens)} tokens`}
        />
        <MetricTile
          icon={Gauge}
          label="Last 7d Cost"
          value={formatUsd(totals.last7d?.estimatedCostUsd)}
          detail={`${formatNumber(totals.last7d?.calls)} AI calls`}
        />
        <MetricTile
          icon={Bot}
          label="Last 30d Cost"
          value={formatUsd(last30d.estimatedCostUsd)}
          detail={`${formatTokens(last30d.totalTokens)} total tokens`}
        />
        <MetricTile
          icon={Clock}
          label="Updated"
          value={formatDateTime(dashboard?.updatedAt)}
          detail={`${last30d.unknownPricingCalls ?? 0} calls need pricing review`}
        />
      </section>

      <section className="bg-card border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">AI Cost by KAM</h2>
            <p className="text-xs text-muted-foreground mt-1">Last 30 days grouped by requester</p>
          </div>
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <UserRound className="size-4" />
            {formatNumber(kamCosts.length)} users
          </span>
        </div>
        <div
          className="max-h-[360px] min-h-[220px] overflow-x-auto overflow-y-scroll"
          style={SCROLL_AREA_STYLE}
        >
          <table className="w-full min-w-[860px] text-sm">
            <thead className="sticky top-0 z-10 bg-muted text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-bold">KAM</th>
                <th className="px-4 py-3 text-left font-bold">Role</th>
                <th className="px-4 py-3 text-right font-bold">Calls</th>
                <th className="px-4 py-3 text-right font-bold">Input</th>
                <th className="px-4 py-3 text-right font-bold">Output</th>
                <th className="px-4 py-3 text-right font-bold">Cost</th>
                <th className="px-4 py-3 text-right font-bold">Last Used</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {dashboardQuery.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Loading KAM usage
                  </td>
                </tr>
              ) : kamCosts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No KAM usage recorded yet.
                  </td>
                </tr>
              ) : (
                kamCosts.map((row) => (
                  <tr key={row.requesterProfileId ?? `${row.requesterName}-${row.requesterRole}`}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{row.requesterName}</p>
                      {!row.requesterProfileId && (
                        <p className="text-xs text-muted-foreground">Older or system-generated row</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.requesterRole}</td>
                    <td className="px-4 py-3 text-right">{formatNumber(row.calls)}</td>
                    <td className="px-4 py-3 text-right">{formatTokens(row.inputTokens)}</td>
                    <td className="px-4 py-3 text-right">{formatTokens(row.outputTokens)}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatUsd(row.estimatedCostUsd)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                      {formatDateTime(row.lastUsedAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1.5fr_0.9fr] gap-5">
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold">AI Agents and Cost</h2>
              <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {formatNumber(features.length)} tracked
            </span>
          </div>
          <div
            className="max-h-[420px] min-h-[240px] overflow-x-auto overflow-y-scroll"
            style={SCROLL_AREA_STYLE}
          >
            <table className="w-full min-w-[720px] text-sm">
              <thead className="sticky top-0 z-10 bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">Feature</th>
                  <th className="px-4 py-3 text-left font-bold">Model</th>
                  <th className="px-4 py-3 text-right font-bold">Calls</th>
                  <th className="px-4 py-3 text-right font-bold">Input</th>
                  <th className="px-4 py-3 text-right font-bold">Output</th>
                  <th className="px-4 py-3 text-right font-bold">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {dashboardQuery.isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Loading AI usage
                    </td>
                  </tr>
                ) : features.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No AI usage recorded yet.
                    </td>
                  </tr>
                ) : (
                  features.map((row) => (
                    <tr key={`${row.feature}-${row.agent}-${row.model}`}>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{row.feature}</p>
                        <p className="text-xs text-muted-foreground">{row.agent}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{row.model}</td>
                      <td className="px-4 py-3 text-right">{formatNumber(row.calls)}</td>
                      <td className="px-4 py-3 text-right">{formatTokens(row.inputTokens)}</td>
                      <td className="px-4 py-3 text-right">{formatTokens(row.outputTokens)}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatUsd(row.estimatedCostUsd)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="text-base font-bold">Daily Usage</h2>
            <p className="text-xs text-muted-foreground mt-1">Recent days with AI calls</p>
          </div>
          <div
            className="max-h-[420px] min-h-[240px] overflow-y-scroll divide-y"
            style={SCROLL_AREA_STYLE}
          >
            {daily.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground text-center">
                No daily usage recorded.
              </div>
            ) : (
              daily.map((row) => (
                <div key={row.date} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-sm">{row.date}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(row.calls)} calls | {formatTokens(row.totalTokens)} tokens
                    </p>
                  </div>
                  <p className="text-sm font-bold">{formatUsd(row.estimatedCostUsd)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="bg-card border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div>
            <h2 className="text-base font-bold">OpenAI Pricing Used</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Standard short-context token pricing per 1M tokens.
            </p>
          </div>
          <a
            href={dashboard?.sourceUrl ?? OPENAI_PRICING_SOURCE_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
          >
            <Shield className="size-4" />
            Pricing source
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-bold">Model</th>
                <th className="px-4 py-3 text-right font-bold">Input</th>
                <th className="px-4 py-3 text-right font-bold">Cached Input</th>
                <th className="px-4 py-3 text-right font-bold">Output</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pricing.map((row) => (
                <tr key={row.model}>
                  <td className="px-4 py-3 font-mono text-xs">{row.model}</td>
                  <td className="px-4 py-3 text-right">{formatUsd(row.inputPer1M)}</td>
                  <td className="px-4 py-3 text-right">{formatUsd(row.cachedInputPer1M)}</td>
                  <td className="px-4 py-3 text-right">{formatUsd(row.outputPer1M)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MetricTile({ icon: Icon, label, value, detail }) {
  return (
    <div className="border rounded-lg bg-card p-4 flex items-center gap-3 min-w-0">
      <span className="size-10 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="text-xl font-bold mt-1 truncate">{value}</p>
        <p className="text-xs text-muted-foreground mt-1 truncate">{detail}</p>
      </div>
    </div>
  );
}
