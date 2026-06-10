import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { getRolePermissions } from "@/data/kam-data";
import { fetchAccounts, fetchAccount, fetchEducationLog, saveEducationSession } from "@/services/db";
import { fetchEducationArticles } from "@/services/education";
import { useAuth } from "@/context/AuthContext";
import {
  ExternalLink, BookOpen, Sparkles, Loader2, RefreshCw,
  Plus, CheckCircle2, Share2, X,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/educate")({
  head: () => ({
    meta: [
      { title: "Education — tkxel KAM" },
      { name: "description", content: "Service-based education articles and session tracking." },
    ],
  }),
  component: EducatePage,
});

const ARTICLE_TABS = [
  { key: "account",        label: "Account Feed",        desc: "Personalised to the account's active services" },
  { key: "modern-services",label: "Modern Services",     desc: "Emerging enterprise technologies businesses are adopting" },
  { key: "approaches",     label: "Modern Approaches",   desc: "Latest KAM, customer success & relationship strategies" },
  { key: "best-practices", label: "Best Practices",      desc: "Delivery excellence, SLA management & escalation frameworks" },
];

function EducatePage() {
  const { profile } = useAuth();
  const role = profile?.role ?? "KAM";
  const canWrite = Boolean(profile && getRolePermissions(role).write);
  const queryClient = useQueryClient();
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [activeTab, setActiveTab] = useState("account");
  const [logOpen, setLogOpen] = useState(false);
  const [sharedIds, setSharedIds] = useState([]);

  // Log session form state
  const [form, setForm] = useState({ accountId: "", date: "", topic: "", approach: "", outcome: "" });
  const [formError, setFormError] = useState("");

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", role, profile?.id],
    queryFn: () => fetchAccounts({ role, userId: profile?.id }),
    enabled: Boolean(profile),
  });

  useEffect(() => {
    if (!accounts.length) {
      setSelectedAccountId("");
      setForm((f) => ({ ...f, accountId: "" }));
      return;
    }
    if (!selectedAccountId || !accounts.some((account) => account.id === selectedAccountId)) {
      const first = accounts[0].id;
      setSelectedAccountId(first);
      setForm((f) => ({ ...f, accountId: first }));
    }
  }, [accounts, selectedAccountId]);

  const { data: fullAccount } = useQuery({
    queryKey: ["account", selectedAccountId],
    queryFn: () => fetchAccount(selectedAccountId),
    enabled: !!selectedAccountId,
  });

  const selectedAccount = fullAccount ?? accounts.find((a) => a.id === selectedAccountId);

  // Education log (all accounts or filtered)
  const { data: educationLog = [], refetch: refetchLog } = useQuery({
    queryKey: ["education-log", accounts.map((account) => account.id).join("|")],
    queryFn: () => fetchEducationLog(accounts.map((account) => account.id)),
    enabled: accounts.length > 0,
  });

  // Articles mutation
  const articlesMutation = useMutation({
    mutationFn: (tab) =>
      fetchEducationArticles({
        data: {
          type: tab ?? activeTab,
          services: selectedAccount?.retentionGrowth ?? [],
          industry: selectedAccount?.industry ?? "",
          accountName: selectedAccount?.name ?? "",
          user: {
            id: profile?.id,
            name: profile?.name,
            role: profile?.role,
          },
        },
      }),
  });

  // Reset shared state when account or tab changes
  useEffect(() => {
    setSharedIds([]);
  }, [selectedAccountId, activeTab]);

  // Log session mutation
  const logMutation = useMutation({
    mutationFn: () => saveEducationSession({ ...form, editedBy: profile?.name ?? "Unknown" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["education-log"] });
      queryClient.invalidateQueries({ queryKey: ["account-history", form.accountId] });
      setLogOpen(false);
      setForm((f) => ({ ...f, date: "", topic: "", approach: "", outcome: "" }));
      setFormError("");
    },
    onError: (e) => setFormError(e.message),
  });

  // Share article → log as session
  const shareMutation = useMutation({
    mutationFn: (article) =>
      saveEducationSession({
        accountId: selectedAccountId,
        date: new Date().toISOString().split("T")[0],
        topic: article.title,
        approach: `Article shared from ${article.source}`,
        outcome: "",
        editedBy: profile?.name ?? "Unknown",
      }),
    onSuccess: (_, article) => {
      setSharedIds((prev) => [...prev, article.id]);
      queryClient.invalidateQueries({ queryKey: ["education-log"] });
      queryClient.invalidateQueries({ queryKey: ["account-history", selectedAccountId] });
    },
  });

  function handleLog() {
    if (!canWrite) {
      setFormError("You have read-only access.");
      return;
    }
    if (!form.accountId || !form.date || !form.topic) {
      setFormError("Account, date, and topic are required.");
      return;
    }
    setFormError("");
    logMutation.mutate();
  }

  const articles = articlesMutation.data ?? [];
  const currentTab = ARTICLE_TABS.find((t) => t.key === activeTab);

  return (
    <div className="flex flex-col">
      <header className="h-16 bg-card border-b flex items-center justify-between px-8 sticky top-0 z-10">
        <div>
          <h1 className="font-semibold text-lg">Education</h1>
          <p className="text-xs text-muted-foreground">
            Service-based articles, modern approaches & session tracking
          </p>
        </div>
        <button
          onClick={() => { setForm((f) => ({ ...f, accountId: selectedAccountId })); setLogOpen(true); }}
          disabled={!canWrite || !selectedAccountId}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="size-3" /> Log Session
        </button>
      </header>

      <div className="p-8 max-w-6xl w-full mx-auto space-y-8">

        {/* ── Article Feed ── */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-accent" />
              <h3 className="text-sm font-bold">Article Feed</h3>
            </div>
            <div className="flex items-center gap-2">
              {activeTab === "account" && (
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="text-xs border rounded-md px-3 py-1.5 bg-background min-w-[160px]"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              )}
              <button
                onClick={() => { setSharedIds([]); articlesMutation.mutate(activeTab); }}
                disabled={articlesMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border rounded-md hover:bg-muted disabled:opacity-50"
              >
                {articlesMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                Refresh
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 border-b overflow-x-auto">
            {ARTICLE_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Active services chips (account tab only) */}
          {activeTab === "account" && selectedAccount?.retentionGrowth?.filter((s) => s.delivered).length > 0 && (
            <div className="px-6 pt-4 flex flex-wrap gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground self-center mr-1">
                Active services:
              </span>
              {selectedAccount.retentionGrowth.filter((s) => s.delivered).map((s) => (
                <span key={s.service} className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-semibold">
                  {s.service}
                </span>
              ))}
            </div>
          )}

          {/* Tab description */}
          <p className="px-6 pt-3 text-[11px] text-muted-foreground">{currentTab?.desc}</p>

          <div className="p-6">
            {articlesMutation.isPending && (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Searching the web…
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
                  <ArticleCard
                    key={a.id}
                    article={a}
                    shared={sharedIds.includes(a.id)}
                    onShare={() => shareMutation.mutate(a)}
                    sharing={shareMutation.isPending}
                    canShare={canWrite && Boolean(selectedAccountId)}
                  />
                ))}
              </div>
            )}
            {!articlesMutation.isPending && !articlesMutation.isError && articles.length === 0 && (
              <div className="py-10 text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  Select an account and click <strong>Refresh</strong> to fetch web articles.
                </p>
                <button
                  onClick={() => { setSharedIds([]); articlesMutation.mutate(activeTab); }}
                  disabled={articlesMutation.isPending}
                  className="mx-auto flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-md disabled:opacity-50"
                >
                  <RefreshCw className="size-3" /> Load Articles
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Education History ── */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 text-accent" />
              <h3 className="text-sm font-bold">Education History</h3>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">
              {educationLog.length} session{educationLog.length !== 1 ? "s" : ""}
            </span>
          </div>
          {educationLog.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              No sessions logged yet. Click "+ Log Session" to add one.
            </div>
          ) : (
            <div className="divide-y">
              {educationLog.map((e) => {
                const acc = accounts.find((a) => a.id === e.accountId);
                return (
                  <div key={e.id} className="px-6 py-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{e.topic}</p>
                      <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                        {e.date} · {acc?.name ?? e.accountId}
                      </p>
                      {e.approach && (
                        <p className="text-[11px] text-muted-foreground mt-1">{e.approach}</p>
                      )}
                    </div>
                    {e.outcome && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-success/10 text-success font-semibold shrink-0">
                        {e.outcome}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Log Session Dialog ── */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Education Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Account</label>
              <select
                value={form.accountId}
                onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
                className="w-full mt-1 text-xs border rounded-md px-3 py-2 bg-background"
              >
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full mt-1 text-xs border rounded-md px-3 py-2 bg-background"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Topic *</label>
              <input
                value={form.topic}
                onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                placeholder="e.g. Cloud migration best practices"
                className="w-full mt-1 text-xs border rounded-md px-3 py-2 bg-background"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Approach</label>
              <input
                value={form.approach}
                onChange={(e) => setForm((f) => ({ ...f, approach: e.target.value }))}
                placeholder="e.g. 30-min exec brief, article share, workshop"
                className="w-full mt-1 text-xs border rounded-md px-3 py-2 bg-background"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Outcome</label>
              <input
                value={form.outcome}
                onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))}
                placeholder="e.g. Client requested follow-up, Positive"
                className="w-full mt-1 text-xs border rounded-md px-3 py-2 bg-background"
              />
            </div>
            {formError && <p className="text-xs text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <button onClick={() => setLogOpen(false)} className="px-4 py-2 text-xs border rounded-md hover:bg-muted">
              Cancel
            </button>
            <button
              onClick={handleLog}
              disabled={logMutation.isPending || !canWrite}
              className="px-4 py-2 text-xs bg-primary text-primary-foreground rounded-md disabled:opacity-50 flex items-center gap-1.5"
            >
              {logMutation.isPending && <Loader2 className="size-3 animate-spin" />}
              Save Session
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ArticleCard({ article, shared, onShare, sharing, canShare }) {
  return (
    <div className="border rounded-lg p-4 hover:border-accent/40 transition-colors flex flex-col">
      <div className="flex items-start justify-between mb-2 gap-2">
        <span className="text-[10px] uppercase tracking-widest font-bold text-accent">{article.source}</span>
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
          <span key={t} className="px-1.5 py-0.5 rounded bg-accent/10 text-accent text-[10px] font-semibold">{t}</span>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-3">
        {article.url && article.url !== "#" && (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold text-accent uppercase tracking-wider flex items-center gap-1 hover:underline"
          >
            Read article <ExternalLink className="size-3" />
          </a>
        )}
        <button
          onClick={onShare}
          disabled={shared || sharing || !canShare}
          className={`ml-auto flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${
            shared ? "text-success" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {shared ? <CheckCircle2 className="size-3" /> : <Share2 className="size-3" />}
          {shared ? "Shared" : "Mark as Shared"}
        </button>
      </div>
    </div>
  );
}
