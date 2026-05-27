import { createFileRoute } from "@tanstack/react-router";
import { accounts, formatCurrency } from "@/data/kam-data";

export const Route = createFileRoute("/strategy")({
  head: () => ({
    meta: [
      { title: "Strategy Builder — Aether KAM" },
      { name: "description", content: "Retention vs growth strategy across the account portfolio." },
    ],
  }),
  component: StrategyPage,
});

function StrategyPage() {
  return (
    <div className="flex flex-col">
      <header className="h-16 bg-card border-b flex items-center justify-between px-8 sticky top-0 z-10">
        <div>
          <h1 className="font-semibold text-lg">Strategy Builder</h1>
          <p className="text-xs text-muted-foreground">Retention vs growth lanes per account</p>
        </div>
      </header>

      <div className="p-8 max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Lane
          title="Retention"
          subtitle="Protect ARR and renewal probability"
          accent="bg-success"
          items={accounts
            .filter((a) => a.health < 75)
            .map((a) => ({
              name: a.name,
              detail: `${a.renewalDays}d to renewal · ${formatCurrency(a.arr)} ARR`,
              tag: a.retentionRisk,
            }))}
        />
        <Lane
          title="Growth"
          subtitle="Whitespace and expansion plays"
          accent="bg-accent"
          items={accounts
            .filter((a) => a.growthUpside >= 400_000)
            .map((a) => ({
              name: a.name,
              detail: `Upside ${formatCurrency(a.growthUpside)} · ${a.whiteSpaceCount} plays`,
              tag: a.tier,
            }))}
        />
      </div>
    </div>
  );
}

function Lane({
  title,
  subtitle,
  accent,
  items,
}: {
  title: string;
  subtitle: string;
  accent: string;
  items: { name: string; detail: string; tag: string }[];
}) {
  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b flex items-center gap-3">
        <span className={`size-2 rounded-full ${accent}`} />
        <div>
          <h3 className="text-sm font-bold">{title}</h3>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="divide-y">
        {items.map((i) => (
          <div key={i.name} className="px-6 py-4 flex items-center justify-between hover:bg-muted/40 transition-colors">
            <div>
              <p className="text-sm font-semibold">{i.name}</p>
              <p className="text-[11px] text-muted-foreground">{i.detail}</p>
            </div>
            <span className="text-[10px] px-2 py-1 bg-muted rounded font-semibold uppercase tracking-wider">
              {i.tag}
            </span>
          </div>
        ))}
        {!items.length && (
          <p className="px-6 py-8 text-center text-xs text-muted-foreground">No accounts in this lane.</p>
        )}
      </div>
    </div>
  );
}
