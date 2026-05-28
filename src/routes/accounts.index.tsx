import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/data/kam-data";
import { fetchAccounts, fetchKamUsers, updateAccountKam } from "@/services/db";
import { useAuth } from "@/context/AuthContext";
import { TrendingDown, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/accounts/")({
  head: () => ({
    meta: [
      { title: "Accounts Portfolio — Aether KAM" },
      { name: "description", content: "Full list of key accounts with health, contract value, and trend." },
    ],
  }),
  component: AccountsListPage,
});

function AccountsListPage() {
  const { profile } = useAuth();
  const role = profile?.role ?? "KAM";
  const userId = profile?.id;
  const isHead = role === "Head of KAM" || role === "CEO";
  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["accounts", userId, role],
    queryFn: () => fetchAccounts({ role, userId }),
  });

  const { data: kamUsers = [] } = useQuery({
    queryKey: ["kamUsers"],
    queryFn: fetchKamUsers,
    enabled: isHead,
  });

  const { mutate: assignKam } = useMutation({
    mutationFn: ({ accountId, kamId }: { accountId: string; kamId: string }) =>
      updateAccountKam(accountId, kamId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounts"] }),
  });

  return (
    <div className="flex flex-col">
      <header className="h-16 bg-card border-b flex items-center justify-between px-8 sticky top-0 z-10">
        <div>
          <h1 className="font-semibold text-lg">Accounts Portfolio</h1>
          <p className="text-xs text-muted-foreground">
            {isLoading ? "Loading…" : `${accounts.length} active accounts · sorted by health`}
          </p>
        </div>
        <div className="flex gap-2">
          <input
            placeholder="Search accounts…"
            className="h-9 w-64 rounded-md border bg-card px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-md">
            + New Account
          </button>
        </div>
      </header>

      <div className="p-8 max-w-7xl w-full mx-auto">
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-muted/40 border-b text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                <th className="px-6 py-3">Account</th>
                <th className="px-6 py-3">Industry</th>
                <th className="px-6 py-3">Health</th>
                <th className="px-6 py-3">Trend</th>
                <th className="px-6 py-3">Contract</th>
                <th className="px-6 py-3">Assigned KAM</th>
                <th className="px-6 py-3 text-right">ARR</th>
                <th className="px-6 py-3 text-right">Renewal</th>
                <th className="px-6 py-3 text-right">Last Touch</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {accounts.map((a) => (
                <tr key={a.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-6 py-4">
                    <Link
                      to="/accounts/$accountId"
                      params={{ accountId: a.id }}
                      className="flex items-center gap-3 group"
                    >
                      <div className="size-9 rounded-lg bg-primary/5 border flex items-center justify-center font-bold text-xs">
                        {a.shortCode}
                      </div>
                      <div>
                        <p className="font-semibold group-hover:text-accent transition-colors">{a.name}</p>
                        <p className="text-[11px] text-muted-foreground">{a.tier} · {a.region}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-xs text-muted-foreground">{a.industry}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-muted h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${a.health >= 75 ? "bg-success" : a.health >= 55 ? "bg-warn" : "bg-crit"}`}
                          style={{ width: `${a.health}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono font-bold">{a.health}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                        a.trend >= 0 ? "text-success" : "text-crit"
                      }`}
                    >
                      {a.trend >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                      {a.trend >= 0 ? "+" : ""}{a.trend}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs">{a.contractType}</td>
                  <td className="px-6 py-4">
                    {isHead ? (
                      <select
                        value={a.assignedKamId ?? ""}
                        onChange={(e) => assignKam({ accountId: a.id, kamId: e.target.value })}
                        className="text-xs bg-card border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent"
                      >
                        <option value="" disabled>— unassigned —</option>
                        {kamUsers.map((u) => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {kamUsers.find((u) => u.id === a.assignedKamId)?.name ?? "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold">{formatCurrency(a.arr)}</td>
                  <td className="px-6 py-4 text-right text-xs">
                    <span className={a.renewalDays < 30 ? "text-warn font-semibold" : "text-muted-foreground"}>
                      {a.renewalDays}d
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-xs text-muted-foreground">{a.lastTouch}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
