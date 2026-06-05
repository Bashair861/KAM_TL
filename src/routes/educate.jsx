import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { advisoryHistory, getAccount } from "@/data/kam-data";
import { fetchAccounts } from "@/services/db";
import { fetchEducationArticles } from "@/services/education";
import { ExternalLink, BookOpen, Sparkles, Loader2, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/educate")({
  head: () => ({
    meta: [
      { title: "Education — Aether KAM" },
      {
        name: "description",
        content: "Service-based education articles and advisory sessions for KAM accounts.",
      },
    ],
  }),
  component: EducatePage,
});

function EducatePage() {
  const [selectedAccountId, setSelectedAccountId] = useState("");

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => fetchAccounts(),
  });

  useEffect(() => {
    if (!selectedAccountId && accounts.length) setSelectedAccountId(accounts[0].id);
  }, [accounts.length]);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? accounts[0];

  const articlesMutation = useMutation({
    mutationFn: () =>
      fetchEducationArticles({
        data: {
          services: selectedAccount?.retentionGrowth ?? [],
          industry: selectedAccount?.industry ?? "",
          accountName: selectedAccount?.name ?? "",
        },
      }),
  });

  // Auto-fetch when account changes and we haven't fetched yet
  useEffect(() => {
    if (selectedAccount) articlesMutation.mutate();
  }, [selectedAccountId]);

  const articles = articlesMutation.data ?? [];

  return (
    <div className="flex flex-col">
      <header className="h-16 bg-card border-b flex items-center justify-between px-8 sticky top-0 z-10">
        <div>
          <h1 className="font-semibold text-lg">Education</h1>
          <p className="text-xs text-muted-foreground">
            Service-based web articles personalised per account
          </p>
        </div>
        <button className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-md">
          + Log Session
        </button>
      </header>

      <div className="p-8 max-w-6xl w-full mx-auto space-y-8">

        {/* ── Account Education Feed ── */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-accent" />
              <h3 className="text-sm font-bold">Account Education Feed</h3>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="text-xs border rounded-md px-3 py-1.5 bg-background min-w-[180px]"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <button
                onClick={() => articlesMutation.mutate()}
                disabled={articlesMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border rounded-md hover:bg-muted disabled:opacity-50"
              >
                {articlesMutation.isPending
                  ? <Loader2 className="size-3 animate-spin" />
                  : <RefreshCw className="size-3" />}
                Refresh
              </button>
            </div>
          </div>

          {/* Services being used */}
          {selectedAccount?.retentionGrowth?.filter((s) => s.delivered).length > 0 && (
            <div className="px-6 pt-4 flex flex-wrap gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground self-center mr-1">
                Active services:
              </span>
              {selectedAccount.retentionGrowth
                .filter((s) => s.delivered)
                .map((s) => (
                  <span
                    key={s.service}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-semibold"
                  >
                    {s.service}
                  </span>
                ))}
            </div>
          )}

          <div className="p-6">
            {articlesMutation.isPending && (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Searching the web for articles relevant to {selectedAccount?.name}…
              </div>
            )}

            {articlesMutation.isError && (
              <div className="py-10 text-center text-sm text-destructive">
                {articlesMutation.error?.message}
              </div>
            )}

            {!articlesMutation.isPending && articles.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {articles.map((a) => (
                  <ArticleCard key={a.id} article={a} />
                ))}
              </div>
            )}

            {!articlesMutation.isPending && !articlesMutation.isError && articles.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Select an account and click Refresh to load articles.
              </div>
            )}
          </div>
        </div>

        {/* ── Advisory History ── */}
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
      </div>
    </div>
  );
}

function ArticleCard({ article }) {
  return (
    <div className="border rounded-lg p-4 hover:border-accent/40 transition-colors flex flex-col">
      <div className="flex items-start justify-between mb-2 gap-2">
        <span className="text-[10px] uppercase tracking-widest font-bold text-accent">
          {article.source}
        </span>
        {article.service && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold shrink-0">
            {article.service}
          </span>
        )}
      </div>
      <p className="text-sm font-semibold leading-snug mb-2">{article.title}</p>
      <p className="text-xs text-muted-foreground leading-snug flex-1">{article.summary}</p>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {article.tags.map((t) => (
          <span
            key={t}
            className="px-1.5 py-0.5 rounded bg-accent/10 text-accent text-[10px] font-semibold"
          >
            {t}
          </span>
        ))}
      </div>
      {article.url && article.url !== "#" && (
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 text-[10px] font-bold text-accent uppercase tracking-wider flex items-center gap-1 self-start hover:underline"
        >
          Read article <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  );
}
