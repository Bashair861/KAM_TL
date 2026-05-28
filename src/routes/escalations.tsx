import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getAccount } from "@/data/kam-data";
import { fetchEscalations } from "@/services/db";
import type { Escalation } from "@/data/kam-data";
import { CheckCircle2, Circle, Clock } from "lucide-react";

export const Route = createFileRoute("/escalations")({
  head: () => ({
    meta: [
      { title: "Escalations Console — Aether KAM" },
      { name: "description", content: "Active client escalations with SLA timers, RCA, and action items." },
    ],
  }),
  component: EscalationsPage,
});

function EscalationsPage() {
  const { data: escalations = [] } = useQuery({ queryKey: ["escalations"], queryFn: () => fetchEscalations() });

  const columns: { title: string; status: "open" | "in_progress" | "resolved" }[] = [
    { title: "Triage (< 24h)", status: "open" },
    { title: "In Progress", status: "in_progress" },
    { title: "Awaiting Client", status: "resolved" },
  ];

  return (
    <div className="flex flex-col">
      <header className="bg-card border-b flex items-center justify-between px-8 py-3 sticky top-0 z-10">
        <div>
          <h1 className="font-semibold text-lg">Escalations Console</h1>
          <p className="text-xs text-muted-foreground">
            48-hour SLA on every P1 · arrange client meeting, capture RCA, define action items
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button className="px-4 py-2 bg-crit text-white text-xs font-semibold rounded-md">
            + New Escalation
          </button>
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Last sync with Jira · 6m ago
          </p>
        </div>
      </header>

      <div className="p-8 max-w-7xl w-full mx-auto space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <Kpi label="Open P1" value="2" color="text-crit" />
          <Kpi label="Avg SLA Remaining" value="29h" color="text-warn" />
          <Kpi label="Resolved (7d)" value="6" color="text-success" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {columns.map((col, idx) => (
            <div key={col.title} className="bg-muted/30 rounded-xl border p-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center justify-between">
                {col.title}
                <span className="bg-card border text-[10px] px-1.5 py-0.5 rounded font-mono">
                  {idx === 0 ? escalations.length : idx === 1 ? 1 : 0}
                </span>
              </h3>
              <div className="space-y-3">
                {(idx === 0 ? escalations : idx === 1 ? escalations.slice(0, 1) : []).map((e) => (
                  <EscalationCard key={`${col.title}-${e.id}`} esc={e} />
                ))}
                {idx === 2 && (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    Nothing awaiting client response.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-card p-5 rounded-xl border">
      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function EscalationCard({ esc }: { esc: Escalation }) {
  const acc = getAccount(esc.accountId);
  return (
    <div className="bg-card border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
            esc.priority === "P1" ? "bg-crit/10 text-crit" : "bg-warn/10 text-warn"
          }`}
        >
          {esc.priority}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
          <Clock className="size-3" />
          {esc.slaRemainingHours.toFixed(1)}h
        </span>
      </div>
      <p className="text-sm font-semibold leading-snug">{esc.title}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{acc?.name}</p>
      <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2">{esc.description}</p>
      <div className="mt-3 pt-3 border-t space-y-1.5">
        {esc.actionItems.slice(0, 3).map((a) => (
          <div key={a.label} className="flex items-center gap-2 text-[11px]">
            {a.done ? (
              <CheckCircle2 className="size-3 text-success shrink-0" />
            ) : (
              <Circle className="size-3 text-muted-foreground shrink-0" />
            )}
            <span className={a.done ? "line-through text-muted-foreground" : ""}>{a.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
