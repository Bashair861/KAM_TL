import { createFileRoute } from "@tanstack/react-router";
import { accounts, formatCurrency } from "@/data/kam-data";

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
  return (
    <div className="flex flex-col">
      <header className="bg-card border-b flex items-center justify-between px-8 py-3 sticky top-0 z-10">
        <div>
          <h1 className="font-semibold text-lg">Contracts</h1>
          <p className="text-xs text-muted-foreground">Type, duration, renewal window, value scoring</p>
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-0.5">
            Last sync with Portfolio Compliance Sheet · 14m ago
          </p>
        </div>
      </header>

      <div className="p-8 max-w-7xl w-full mx-auto">
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm text-left">
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
              {accounts.map((a) => (
                <tr key={a.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-6 py-4 font-semibold">{a.name}</td>
                  <td className="px-6 py-4 text-xs">{a.contractType}</td>
                  <td className="px-6 py-4 text-xs">24 months</td>
                  <td className="px-6 py-4 text-right font-semibold">{formatCurrency(a.contractValue)}</td>
                  <td className="px-6 py-4 text-right text-xs">
                    <span className={a.renewalDays < 30 ? "text-warn font-semibold" : "text-muted-foreground"}>
                      {a.renewalDays}d
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-xs font-mono">{a.contractCompliance.toFixed(1)}/10</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
