import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { fetchAccounts } from "@/services/db";
import { analyzeJiraIssue } from "@/services/jiraInsights";
import { saveJiraEscalations } from "@/services/jira";
import { Loader2, Search, Zap, Plus, X } from "lucide-react";

export const Route = createFileRoute("/escalations")({
  head: () => ({
    meta: [
      { title: "Jira Ticket Insights — Aether KAM" },
      {
        name: "description",
        content: "Import a Jira issue, extract client keywords, education suggestions, and escalation action items.",
      },
    ],
  }),
  component: EscalationsPage,
});

function EscalationsPage() {
  const queryClient = useQueryClient();
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [issueKey, setIssueKey] = useState("SCRUM-1");
  const [result, setResult] = useState(null);
  const [savedOk, setSavedOk] = useState(false);
  const [checkedItems, setCheckedItems] = useState([]);
  const [customItems, setCustomItems] = useState([]);
  const [newItemText, setNewItemText] = useState("");

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => fetchAccounts(),
  });

  // Set initial account when accounts first load (onSuccess removed in TanStack Query v5)
  useEffect(() => {
    if (!selectedAccountId && accounts.length) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts.length]);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? accounts[0];

  const analyzeMutation = useMutation({
    mutationFn: () =>
      analyzeJiraIssue({
        data: {
          issueKey: issueKey.trim().toUpperCase(),
          accountName: selectedAccount?.name ?? accounts[0]?.name ?? "",
          accounts: accounts.map((a) => ({ id: a.id, name: a.name, shortCode: a.shortCode })),
        },
      }),
    onSuccess: (data) => {
      setResult(data);
      setSavedOk(false);
      setCheckedItems(data.suggestedActionItems.slice());
      setCustomItems([]);
      setNewItemText("");
      if (data.detectedAccount && !selectedAccountId) {
        setSelectedAccountId(data.detectedAccount.id);
      }
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const accountId = selectedAccountId || result?.detectedAccount?.id || accounts[0]?.id;
      const allItems = [
        ...checkedItems.map((label) => ({ label, done: false })),
        ...customItems.map((label) => ({ label, done: false })),
      ];
      const actionItems = allItems.length ? allItems : result.issue.subtaskActionItems;
      return saveJiraEscalations({
        data: {
          issues: [{ ...result.issue, actionItems }],
          accountId,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["escalations"], exact: false });
      setSavedOk(true);
    },
  });

  const priorityColor =
    result?.issue.priority === "P1"
      ? "bg-red-100 text-red-600"
      : result?.issue.priority === "P2"
        ? "bg-orange-100 text-orange-600"
        : "bg-gray-100 text-gray-500";

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b px-8 py-4 sticky top-0 z-10">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-primary" />
            <div>
              <h1 className="font-semibold text-base">Jira Ticket Insights</h1>
              <p className="text-xs text-muted-foreground">
                Import a Jira issue, extract client keywords, education suggestions, and escalation action items.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="text-xs border rounded-md px-3 py-2 bg-background min-w-[180px]"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <input
              value={issueKey}
              onChange={(e) => setIssueKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && analyzeMutation.mutate()}
              placeholder="SCRUM-1"
              className="text-xs border rounded-md px-3 py-2 bg-background w-28 font-mono"
            />
            <button
              onClick={() => analyzeMutation.mutate()}
              disabled={!issueKey.trim() || analyzeMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-foreground text-background text-xs font-semibold rounded-md disabled:opacity-50"
            >
              {analyzeMutation.isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Search className="size-3" />
              )}
              Import
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      {!result && !analyzeMutation.isPending && !analyzeMutation.isError && (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Select an account, enter a Jira issue key, and click Import.
        </div>
      )}

      {analyzeMutation.isPending && (
        <div className="flex-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Fetching and analysing Jira issue…
        </div>
      )}

      {analyzeMutation.isError && (
        <div className="flex-1 flex items-center justify-center text-sm text-destructive px-8 text-center">
          {analyzeMutation.error?.message ?? "Failed to fetch issue."}
        </div>
      )}

      {result && !analyzeMutation.isPending && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 divide-x flex-1">
          {/* ── Col 1: Imported Issue ── */}
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Imported Issue
              </p>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || savedOk}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded flex items-center gap-1.5 ${
                  savedOk
                    ? "bg-green-100 text-green-700"
                    : "bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                }`}
              >
                {saveMutation.isPending && <Loader2 className="size-3 animate-spin" />}
                {savedOk ? "Saved ✓" : "Save to Escalation"}
              </button>
            </div>

            {saveMutation.isError && (
              <p className="text-xs text-destructive">{saveMutation.error?.message}</p>
            )}

            <div>
              <a
                href="#"
                className="text-sm font-semibold text-primary hover:underline leading-snug"
              >
                {result.issue.key} · {result.issue.title}
              </a>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                {result.issue.status}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${priorityColor}`}>
                {result.issue.priorityLabel}
              </span>
              {(result.detectedAccount ?? selectedAccount) && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                  {result.detectedAccount?.name ?? selectedAccount?.name}
                </span>
              )}
            </div>

            {result.detectedAccount && (
              <p className="text-[10px] text-muted-foreground italic border rounded px-2 py-1.5">
                Account auto-detected from Jira ticket content.
              </p>
            )}

            {result.keywords.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Keywords
                </p>
                <div className="flex flex-wrap gap-1">
                  {result.keywords.map((kw) => (
                    <span
                      key={kw}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.issue.description && (
              <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-6">
                {result.issue.description}
              </p>
            )}
          </div>

          {/* ── Col 2: Education Suggestions ── */}
          <div className="p-6 space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Education Suggestions
            </p>
            {result.educationSuggestions.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No suggestions — add an ANTHROPIC_API_KEY to .env to enable AI analysis.
              </p>
            )}
            <div className="space-y-3">
              {result.educationSuggestions.map((s, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-1">
                  <p className="text-xs font-semibold">{s.title}</p>
                  <p className="text-[11px] text-muted-foreground">{s.description}</p>
                  {s.context && (
                    <p className="text-[11px] text-primary cursor-default">{s.context}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Col 3: Suggested Action Items ── */}
          <div className="p-6 space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Suggested Action Items
            </p>
            <div className="space-y-2">
              {result.suggestedActionItems.map((item) => (
                <label key={item} className="flex items-start gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    className="mt-0.5 shrink-0 accent-primary"
                    checked={checkedItems.includes(item)}
                    onChange={() =>
                      setCheckedItems((prev) =>
                        prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item],
                      )
                    }
                  />
                  <span className="text-[11px] text-foreground leading-snug group-hover:text-primary transition-colors">
                    {item}
                  </span>
                </label>
              ))}

              {customItems.map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <input type="checkbox" className="mt-0.5 shrink-0 accent-primary" defaultChecked />
                  <span className="text-[11px] text-foreground leading-snug flex-1">{item}</span>
                  <button
                    onClick={() => setCustomItems((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <input
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newItemText.trim()) {
                    setCustomItems((prev) => [...prev, newItemText.trim()]);
                    setNewItemText("");
                  }
                }}
                placeholder="Add your own action item…"
                className="flex-1 text-xs border rounded-md px-2 py-1.5 bg-background"
              />
              <button
                onClick={() => {
                  if (newItemText.trim()) {
                    setCustomItems((prev) => [...prev, newItemText.trim()]);
                    setNewItemText("");
                  }
                }}
                className="px-2 py-1.5 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {checkedItems.length + customItems.length} item{checkedItems.length + customItems.length !== 1 ? "s" : ""} will be saved with the escalation.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
