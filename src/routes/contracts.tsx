import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/data/kam-data";
import { fetchContracts } from "@/services/db";
import { useAuth } from "@/context/AuthContext";
import { AlertTriangle, FileText } from "lucide-react";

export const Route = createFileRoute("/contracts")({
  head: () => ({
    meta: [
      { title: "Contracts — Aether KAM" },
      { name: "description", content: "Contract portfolio, renewals, type, and value scoring." },
    ],
  }),
  component: ContractsPage,
});

function ContractsPage() {
  const { profile } = useAuth();
  const role = profile?.role ?? "KAM";
  const userId = profile?.id;

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["contracts", userId, role],
    queryFn: () => fetchContracts({ role, userId }),
  });

  return (
    <div className="flex flex-col">
      <header className="bg-card border-b flex items-center justify-between px-8 py-3 sticky top-0 z-10">
        <div>
          <h1 className="font-semibold text-lg">Contracts</h1>
          <p className="text-xs text-muted-foreground">Type, duration, renewal window, value &amp; compliance</p>
        </div>
      </header>

      <div className="p-8 max-w-7xl w-full mx-auto space-y-6">

        {/* ── Contracts table ─────────────────────────────────────────────── */}
        <div className="bg-card border rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-muted-foreground">Loading contracts…</div>
          ) : contracts.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="size-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No contracts found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[900px]">
                <thead>
                  <tr className="bg-muted/40 border-b text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                    <th className="px-6 py-3">Account</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Duration</th>
                    <th className="px-6 py-3 text-right">Value</th>
                    <th className="px-6 py-3 text-right">Renewal</th>
                    <th className="px-6 py-3 text-right">Process Compliance</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {contracts.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-6 py-4">
                        <Link
                          to="/accounts/$accountId"
                          params={{ accountId: c.id }}
                          className="flex items-center gap-2 group"
                        >
                          <div className="size-8 rounded-md bg-primary/5 border flex items-center justify-center font-bold text-[11px] shrink-0">
                            {c.shortCode}
                          </div>
                          <div>
                            <p className="font-semibold text-xs group-hover:text-accent transition-colors">{c.name}</p>
                            <p className="text-[10px] text-muted-foreground">{c.tier}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">{c.contractType}</td>
                      <td className="px-6 py-4 text-xs">{c.duration}</td>
                      <td className="px-6 py-4 text-right font-semibold text-sm">{formatCurrency(c.contractValue)}</td>
                      <td className="px-6 py-4 text-right">
                        <RenewalBadge days={c.renewalDays} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <ComplianceBadge value={c.contractCompliance} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared atoms ────────────────────────────────────────────────────────────

function RenewalBadge({ days }: { days: number }) {
  const urgent = days <= 14;
  const warn   = days <= 30;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
      urgent ? "text-crit" : warn ? "text-warn" : "text-muted-foreground"
    }`}>
      {(urgent || warn) && <AlertTriangle className="size-3" />}
      {days}d
    </span>
  );
}

function ComplianceBadge({ value }: { value: number }) {
  const color = value >= 9 ? "text-success" : value >= 7 ? "text-warn" : "text-crit";
  return (
    <span className={`text-xs font-mono font-bold ${color}`}>
      {value.toFixed(1)}<span className="text-muted-foreground font-normal">/10</span>
    </span>
  );
}
