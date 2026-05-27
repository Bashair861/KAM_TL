import { createFileRoute } from "@tanstack/react-router";
import { advisoryHistory, getAccount, industryArticles } from "@/data/kam-data";
import { ExternalLink, Sparkles, BookOpen } from "lucide-react";

export const Route = createFileRoute("/educate")({
  head: () => ({
    meta: [
      { title: "Education — Aether KAM" },
      { name: "description", content: "Advisory sessions, best-practice playbooks, and modern industry suggestions for KAMs." },
    ],
  }),
  component: EducatePage,
});

function EducatePage() {
  return (
    <div className="flex flex-col">
      <header className="h-16 bg-card border-b flex items-center justify-between px-8 sticky top-0 z-10">
        <div>
          <h1 className="font-semibold text-lg">Education</h1>
          <p className="text-xs text-muted-foreground">Advisory sessions, playbooks and modern industry reading</p>
        </div>
        <button className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-md">
          + Log Session
        </button>
      </header>

      <div className="p-8 max-w-6xl w-full mx-auto space-y-8">
        {/* Advisory History */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center gap-2">
            <BookOpen className="size-4 text-accent" />
            <h3 className="text-sm font-bold">Advisory History</h3>
          </div>
          <div className="divide-y">
            {advisoryHistory.map((h) => (
              <div key={h.title} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{h.title}</p>
                  <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                    {h.date} · {getAccount(h.accountId)?.name}
                  </p>
                </div>
                <button className="text-[10px] font-bold text-accent uppercase tracking-wider">
                  Open notes
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Modern Industry Suggestions */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-accent" />
              <h3 className="text-sm font-bold">Modern Suggestions — Latest Industry Reading</h3>
            </div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
              Refreshed daily
            </span>
          </div>
          <p className="px-6 pt-3 text-[11px] text-muted-foreground">
            Curated articles from KAM, AI, and enterprise-tech sources — use them to spark conversations and strengthen client relationships.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
            {industryArticles.map((a) => (
              <div key={a.id} className="border rounded-lg p-4 hover:border-accent/40 transition-colors flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-accent">{a.source}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{a.date}</span>
                </div>
                <p className="text-sm font-semibold leading-snug mb-2">{a.title}</p>
                <p className="text-xs text-muted-foreground leading-snug flex-1">{a.summary}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {a.tags.map((t) => (
                    <span key={t} className="px-1.5 py-0.5 rounded bg-accent/10 text-accent text-[10px] font-semibold">
                      {t}
                    </span>
                  ))}
                </div>
                <button className="mt-3 text-[10px] font-bold text-accent uppercase tracking-wider flex items-center gap-1 self-start">
                  Read article <ExternalLink className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
