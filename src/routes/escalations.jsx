import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { getRolePermissions, getAccount } from "@/data/kam-data";
import {
  fetchAccounts,
  fetchEscalations,
  createEscalation,
  toggleEscalationActionItem,
  updateEscalationStage,
} from "@/services/db";
import { analyzeJiraIssue } from "@/services/jiraInsights";
import { saveJiraEscalations } from "@/services/jira";
import { useAuth } from "@/context/AuthContext";
import {
  Loader2, Search, Zap, Plus, X, AlertTriangle,
  CheckCircle2, Circle, Clock, Trash2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/escalations")({
  validateSearch: (search) => ({
    tab: typeof search.tab === "string" ? search.tab : "import",
  }),
  head: () => ({
    meta: [
      { title: "Escalations - tkxel KAM" },
      { name: "description", content: "Jira import, escalation insights and open escalations board." },
    ],
  }),
  component: EscalationsPage,
});

const ESCALATION_STAGES = [
  { key: "Triage", title: "Triage (< 24h)", actionLabel: "Triage" },
  { key: "In Progress", title: "In Progress", actionLabel: "In Progress" },
  { key: "Awaiting Client", title: "Awaiting Client", actionLabel: "Awaiting" },
];

function getEscalationStage(escalation) {
  return ESCALATION_STAGES.some((stage) => stage.key === escalation?.stage)
    ? escalation.stage
    : "Triage";
}

function EscalationsPage() {
  const { tab: initialTab } = Route.useSearch();
  const { profile } = useAuth();
  const role = profile?.role ?? "KAM";
  const userId = profile?.id;
  const canWrite = Boolean(profile && getRolePermissions(role).write);
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState(initialTab ?? "import");

  useEffect(() => {
    setActiveTab(initialTab ?? "import");
  }, [initialTab]);

  // Jira import state
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [result, setResult] = useState(null);
  const [savedOk, setSavedOk] = useState(false);
  const [checkedItems, setCheckedItems] = useState([]);
  const [customItems, setCustomItems] = useState([]);
  const [newItemText, setNewItemText] = useState("");
  const [priority, setPriority] = useState("P1");

  // Escalation detail modal
  const [selectedEscalation, setSelectedEscalation] = useState(null);
  const [movingStage, setMovingStage] = useState(null);

  // Create escalation dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ accountId: "", title: "", description: "", rca: "" });
  const [createPriority, setCreatePriority] = useState("P1");
  const [createItems, setCreateItems] = useState([]);
  const [createItemText, setCreateItemText] = useState("");
  const [createError, setCreateError] = useState("");

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", role, userId],
    queryFn: () => fetchAccounts({ role, userId }),
    enabled: Boolean(userId),
  });

  const { data: allEscalations = [] } = useQuery({
    queryKey: ["escalations", role, userId],
    queryFn: () => fetchEscalations(null, { role, userId }),
    enabled: Boolean(userId),
  });

  useEffect(() => {
    if (!accounts.length) {
      if (selectedAccountId) setSelectedAccountId("");
      return;
    }
    if (selectedAccountId && !accounts.some((a) => a.id === selectedAccountId)) {
      setSelectedAccountId("");
    }
  }, [accounts, selectedAccountId]);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) ?? null;

  // Jira analyze mutation
  const analyzeMutation = useMutation({
    mutationFn: () => {
      if (!selectedAccount) throw new Error("Select an account before importing.");
      return analyzeJiraIssue({
        data: {
          issueKey: "",
          accountId: selectedAccount.id,
          accountName: selectedAccount.name,
          accounts: accounts.map((a) => ({ id: a.id, name: a.name, shortCode: a.shortCode })),
          user: {
            id: profile?.id,
            name: profile?.name,
            role: profile?.role,
          },
        },
      });
    },
    onSuccess: (data) => {
      setResult(data);
      setSavedOk(false);
      setCheckedItems(data.suggestedActionItems.slice());
      setCustomItems([]);
      setNewItemText("");
      setPriority(data.issue.priority);
      if (data.detectedAccount && !selectedAccountId) setSelectedAccountId(data.detectedAccount.id);
    },
  });

  // Save Jira escalation
  const saveMutation = useMutation({
    mutationFn: () => {
      if (!canWrite) throw new Error("You have read-only access.");
      const accountId = result?.detectedAccount?.id || selectedAccountId;
      if (!accountId) throw new Error("Select an account before saving.");
      const allItems = [
        ...checkedItems.map((label) => ({ label, done: false })),
        ...customItems.map((label) => ({ label, done: false })),
      ];
      return saveJiraEscalations({
        data: {
          issues: [{ ...result.issue, priority, actionItems: allItems.length ? allItems : result.issue.subtaskActionItems }],
          accountId,
          editedBy: profile?.name ?? "Unknown",
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["escalations"], exact: false });
      setSavedOk(true);
    },
  });

  // Create escalation mutation
  const createMutation = useMutation({
    mutationFn: ({ form, priority: p, items }) => {
      if (!form.title.trim()) throw new Error("Title is required.");
      if (!form.accountId) throw new Error("Account is required.");
      return createEscalation({
        accountId: form.accountId,
        title: form.title.trim(),
        priority: p,
        description: form.description.trim() || null,
        rca: form.rca.trim() || null,
        actionItems: items,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["escalations"], exact: false });
      setCreateOpen(false);
      setCreateForm({ accountId: selectedAccountId, title: "", description: "", rca: "" });
      setCreatePriority("P1");
      setCreateItems([]);
      setCreateItemText("");
      setCreateError("");
    },
    onError: (e) => setCreateError(e.message),
  });

  const stageMutation = useMutation({
    mutationFn: ({ escalation, stage }) =>
      updateEscalationStage(escalation.id, stage, { editedBy: profile?.name ?? "Unknown" }),
    onMutate: ({ escalation, stage }) => setMovingStage({ id: escalation.id, stage }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["escalations"], exact: false });
      setSelectedEscalation((current) =>
        current?.id === updated.id ? { ...current, stage: updated.stage } : current,
      );
    },
    onSettled: () => setMovingStage(null),
  });

  function openCreateDialog() {
    setCreateForm({ accountId: selectedAccountId || accounts[0]?.id || "", title: "", description: "", rca: "" });
    setCreatePriority("P1");
    setCreateItems([]);
    setCreateItemText("");
    setCreateError("");
    setCreateOpen(true);
  }

  const priorityColor = (p) =>
    p === "P1" ? "bg-red-100 text-red-600 border-red-200"
    : p === "P2" ? "bg-orange-100 text-orange-600 border-orange-200"
    : "bg-gray-100 text-gray-500 border-gray-200";

  const priorityBadge = (p) =>
    p === "P1" ? "bg-crit/10 text-crit"
    : p === "P2" ? "bg-warn/10 text-warn"
    : "bg-muted text-muted-foreground";

  const openCols = ESCALATION_STAGES.map((stage) => ({
    ...stage,
    items: allEscalations.filter((escalation) => getEscalationStage(escalation) === stage.key),
  }));
  const matchedJiraSpace = result?.jiraSpace ?? result?.jiraProject;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b px-8 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Zap className="size-4 text-primary" />
              <h1 className="font-semibold text-base">Escalations</h1>
            </div>
            {/* Tabs */}
            <div className="flex border rounded-lg overflow-hidden text-xs font-semibold">
              {[
                { key: "import", label: "Jira Import" },
                { key: "open",   label: `Open (${allEscalations.length})` },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-4 py-1.5 transition-colors ${
                    activeTab === t.key
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canWrite && (
              <button
                onClick={openCreateDialog}
                disabled={!accounts.length}
                className="flex items-center gap-1.5 px-4 py-2 bg-crit text-white text-xs font-semibold rounded-md disabled:opacity-50 hover:bg-crit/90"
              >
                <AlertTriangle className="size-3" />
                Create Escalation
              </button>
            )}
            {activeTab === "import" && (
              <>
                <select
                  value={selectedAccountId}
                  onChange={(e) => {
                    setSelectedAccountId(e.target.value);
                    setResult(null);
                    setSavedOk(false);
                  }}
                  disabled={!accounts.length}
                  className="text-xs border rounded-md px-3 py-2 bg-background min-w-[160px]"
                >
                  <option value="" disabled>Select account</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <button
                  onClick={() => analyzeMutation.mutate()}
                  disabled={!canWrite || !accounts.length || !selectedAccountId || analyzeMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-foreground text-background text-xs font-semibold rounded-md disabled:opacity-50"
                >
                  {analyzeMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : <Search className="size-3" />}
                  Import
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── TAB: Jira Import ── */}
      {activeTab === "import" && (
        <>
          {!result && !analyzeMutation.isPending && !analyzeMutation.isError && (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              {canWrite ? "Select an account and click Import. Add an issue key only for a specific Jira issue."
                        : "You have read-only access."}
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
              {/* Col 1: Issue */}
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Imported Issue</p>
                  <button
                    onClick={() => saveMutation.mutate()}
                    disabled={!canWrite || saveMutation.isPending || savedOk}
                    className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded flex items-center gap-1.5 ${
                      savedOk ? "bg-green-100 text-green-700"
                              : "bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                    }`}
                  >
                    {saveMutation.isPending && <Loader2 className="size-3 animate-spin" />}
                    {savedOk ? "Saved ✓" : "Save to Escalation"}
                  </button>
                </div>
                {saveMutation.isError && <p className="text-xs text-destructive">{saveMutation.error?.message}</p>}
                <a href="#" className="text-sm font-semibold text-primary hover:underline leading-snug block">
                  {result.issue.key} · {result.issue.title}
                </a>
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">{result.issue.status}</span>
                  {(result.detectedAccount ?? selectedAccount) && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                      {result.detectedAccount?.name ?? selectedAccount?.name}
                    </span>
                  )}
                  {matchedJiraSpace && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">
                      Jira space: {matchedJiraSpace.name} ({matchedJiraSpace.key})
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Priority</p>
                  <div className="flex gap-1.5">
                    {["P1","P2","P3"].map((p) => (
                      <button key={p} onClick={() => setPriority(p)}
                        className={`px-3 py-1 text-[11px] font-bold rounded border transition-all ${
                          priority === p ? priorityColor(p) + " ring-1 ring-offset-1 ring-current"
                                        : "bg-muted text-muted-foreground border-muted hover:bg-muted/80"
                        }`}>
                        {p}
                      </button>
                    ))}
                    <span className="text-[10px] text-muted-foreground self-center ml-1">(Jira: {result.issue.priorityLabel})</span>
                  </div>
                </div>
                {result.detectedAccount && (
                  <p className="text-[10px] text-muted-foreground italic border rounded px-2 py-1.5">
                    Account matched against the selected Jira space.
                  </p>
                )}
                {result.keywords.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Keywords</p>
                    <div className="flex flex-wrap gap-1">
                      {result.keywords.map((kw) => (
                        <span key={kw} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{kw}</span>
                      ))}
                    </div>
                  </div>
                )}
                {result.issue.description && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-6">{result.issue.description}</p>
                )}
              </div>

              {/* Col 2: Education Suggestions */}
              <div className="p-6 space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  AI Education Suggestions
                </p>
                {result.educationSuggestions.length === 0 && (
                  <p className="text-xs text-muted-foreground">No suggestions generated.</p>
                )}
                <div className="space-y-3">
                  {result.educationSuggestions.map((s, i) => (
                    <div key={i} className="border rounded-lg p-3 space-y-1.5">
                      <p className="text-xs font-semibold">{s.title}</p>
                      <p className="text-[11px] text-muted-foreground">{s.description}</p>
                      {s.matchedKeywords?.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {s.matchedKeywords.map((kw) => (
                            <span key={kw} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{kw}</span>
                          ))}
                        </div>
                      )}
                      {s.context && <p className="text-[11px] text-primary">{s.context}</p>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Col 3: Action Items */}
              <div className="p-6 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Suggested Action Items
                </p>

                {/* Suggested items (checklist style) */}
                <div className="border rounded-lg divide-y overflow-hidden">
                  {result.suggestedActionItems.map((item) => (
                    <label key={item} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 cursor-pointer">
                      <input
                        type="checkbox"
                        className="shrink-0 accent-primary"
                        checked={checkedItems.includes(item)}
                        onChange={() =>
                          setCheckedItems((prev) =>
                            prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
                          )
                        }
                      />
                      <span className="text-xs text-foreground leading-snug flex-1">{item}</span>
                    </label>
                  ))}
                </div>

                {/* Custom items */}
                {customItems.length > 0 && (
                  <div className="border rounded-lg divide-y overflow-hidden">
                    {customItems.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2.5 bg-accent/5">
                        <input type="checkbox" className="shrink-0 accent-primary" defaultChecked />
                        <span className="text-xs flex-1">{item}</span>
                        <button
                          onClick={() => setCustomItems((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add item input */}
                <div className="flex gap-2">
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
                    className="px-2.5 py-1.5 border rounded-md hover:bg-muted text-xs font-semibold text-accent flex items-center gap-1"
                  >
                    <Plus className="size-3" /> Add
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {checkedItems.length + customItems.length} item{checkedItems.length + customItems.length !== 1 ? "s" : ""} will be saved.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB: Open Escalations ── */}
      {activeTab === "open" && (
        <div className="p-8 max-w-7xl w-full mx-auto">
          {stageMutation.isError && (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
              {stageMutation.error?.message ?? "Could not update escalation stage."}
            </div>
          )}
          {allEscalations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
              <AlertTriangle className="size-8 opacity-30" />
              <p className="text-sm">No escalations yet.</p>
              {canWrite && (
                <button onClick={openCreateDialog} className="text-xs font-semibold text-primary hover:underline">
                  + Create one manually
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {openCols.map((col) => (
                <div key={col.key} className="bg-muted/30 rounded-xl border p-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center justify-between">
                    {col.title}
                    <span className="bg-card border text-[10px] px-1.5 py-0.5 rounded font-mono">{col.items.length}</span>
                  </h3>
                  <div className="space-y-3">
                    {col.items.map((e) => (
                      <EscalationCard
                        key={e.id}
                        esc={e}
                        accounts={accounts}
                        priorityBadge={priorityBadge}
                        stageOptions={ESCALATION_STAGES}
                        canMove={canWrite}
                        movingStage={movingStage}
                        onStageChange={(stage) => stageMutation.mutate({ escalation: e, stage })}
                        onOpen={() => setSelectedEscalation(e)}
                      />
                    ))}
                    {col.items.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-6">None</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Escalation Detail Modal ── */}
      {selectedEscalation && (
        <EscalationDetailModal
          esc={selectedEscalation}
          accounts={accounts}
          priorityBadge={priorityBadge}
          priorityColor={priorityColor}
          editedBy={profile?.name ?? "Unknown"}
          onClose={() => setSelectedEscalation(null)}
          onActionToggled={(updated) => {
            setSelectedEscalation(updated);
            queryClient.invalidateQueries({ queryKey: ["escalations"], exact: false });
          }}
        />
      )}

      {/* ── Create Escalation Dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-crit" />
              Create Escalation
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Account *</label>
              <select value={createForm.accountId} onChange={(e) => setCreateForm((f) => ({ ...f, accountId: e.target.value }))}
                className="w-full mt-1 text-xs border rounded-md px-3 py-2 bg-background">
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Title *</label>
              <input value={createForm.title} onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. API downtime impacting client workflows"
                className="w-full mt-1 text-xs border rounded-md px-3 py-2 bg-background" />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Priority *</label>
              <div className="flex gap-2 mt-1">
                {["P1","P2","P3"].map((p) => (
                  <button key={p} type="button" onClick={() => setCreatePriority(p)}
                    className={`px-4 py-1.5 text-xs font-bold rounded border transition-all ${
                      createPriority === p ? priorityColor(p) + " ring-1 ring-offset-1 ring-current"
                                           : "bg-muted text-muted-foreground border-muted hover:bg-muted/80"
                    }`}>
                    {p}
                  </button>
                ))}
                <span className="text-[10px] text-muted-foreground self-center ml-1">
                  SLA: {createPriority === "P1" ? "48h" : createPriority === "P2" ? "72h" : "120h"}
                </span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Description</label>
              <textarea value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What is the issue? What's the client impact?"
                rows={3} className="w-full mt-1 text-xs border rounded-md px-3 py-2 bg-background resize-none" />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Root Cause Analysis</label>
              <textarea value={createForm.rca} onChange={(e) => setCreateForm((f) => ({ ...f, rca: e.target.value }))}
                placeholder="Known or suspected root cause"
                rows={2} className="w-full mt-1 text-xs border rounded-md px-3 py-2 bg-background resize-none" />
            </div>

            {/* Action Items — styled like screenshot */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Action Items</label>
              <div className="mt-1 border rounded-lg overflow-hidden divide-y">
                {createItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/20">
                    <input type="checkbox" className="shrink-0 accent-primary" />
                    <span className="flex-1 text-xs">{item}</span>
                    <button type="button" onClick={() => setCreateItems((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2 px-3 py-2">
                  <input
                    value={createItemText}
                    onChange={(e) => setCreateItemText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && createItemText.trim()) {
                        setCreateItems((prev) => [...prev, createItemText.trim()]);
                        setCreateItemText("");
                      }
                    }}
                    placeholder="Type and press Enter to add…"
                    className="flex-1 text-xs outline-none bg-transparent"
                  />
                </div>
              </div>
              <button type="button"
                onClick={() => { if (createItemText.trim()) { setCreateItems((prev) => [...prev, createItemText.trim()]); setCreateItemText(""); } }}
                className="mt-1.5 text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1 hover:opacity-70"
              >
                <Plus className="size-3" /> Add Action Item
              </button>
            </div>

            {createError && <p className="text-xs text-destructive">{createError}</p>}
          </div>

          <DialogFooter>
            <button onClick={() => setCreateOpen(false)} className="px-4 py-2 text-xs border rounded-md hover:bg-muted">Cancel</button>
            <button
              onClick={() => createMutation.mutate({ form: createForm, priority: createPriority, items: createItems })}
              disabled={createMutation.isPending}
              className="px-4 py-2 text-xs bg-crit text-white rounded-md disabled:opacity-50 flex items-center gap-1.5 hover:bg-crit/90"
            >
              {createMutation.isPending && <Loader2 className="size-3 animate-spin" />}
              Create Escalation
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EscalationCard({
  esc,
  accounts,
  priorityBadge,
  stageOptions,
  canMove,
  movingStage,
  onStageChange,
  onOpen,
}) {
  const acc = accounts.find((a) => a.id === esc.accountId) ?? { name: esc.accountId };
  const currentStage = getEscalationStage(esc);
  const isMoving = movingStage?.id === esc.id;

  return (
    <div
      onClick={onOpen}
      className="bg-card border rounded-lg p-4 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${priorityBadge(esc.priority)}`}>
          {esc.priority}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
          <Clock className="size-3" />
          {Number(esc.slaRemainingHours ?? 0).toFixed(1)}h
        </span>
      </div>
      <p className="text-sm font-semibold leading-snug">{esc.title}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{acc.name}</p>
      <span className="inline-flex mt-2 text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
        {currentStage}
      </span>
      {esc.description && (
        <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2">{esc.description}</p>
      )}
      {esc.actionItems?.length > 0 && (
        <div className="mt-3 pt-3 border-t space-y-1.5">
          {esc.actionItems.slice(0, 3).map((a) => (
            <div key={a.label} className="flex items-center gap-2 text-[11px]">
              {a.done
                ? <CheckCircle2 className="size-3 text-success shrink-0" />
                : <Circle className="size-3 text-muted-foreground shrink-0" />}
              <span className={a.done ? "line-through text-muted-foreground" : ""}>{a.label}</span>
            </div>
          ))}
          {esc.actionItems.length > 3 && (
            <p className="text-[10px] text-muted-foreground">+{esc.actionItems.length - 3} more</p>
          )}
        </div>
      )}
      {canMove && (
        <div className="mt-3 pt-3 border-t flex flex-wrap gap-1.5">
          {stageOptions
            .filter((stage) => stage.key !== currentStage)
            .map((stage) => (
              <button
                key={stage.key}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onStageChange(stage.key);
                }}
                disabled={isMoving}
                className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isMoving && movingStage?.stage === stage.key && <Loader2 className="size-3 animate-spin" />}
                {stage.actionLabel}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

function formatDate(val) {
  if (!val) return "—";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return val; }
}

function EscalationDetailModal({ esc, accounts, priorityBadge, priorityColor, editedBy, onClose, onActionToggled }) {
  const acc = accounts.find((a) => a.id === esc.accountId) ?? { name: esc.accountId };
  const [items, setItems] = useState(esc.actionItems ?? []);
  const [togglingIdx, setTogglingIdx] = useState(null);

  async function toggle(item, idx) {
    if (!item.id || togglingIdx !== null) return;
    const newDone = !item.done;
    setTogglingIdx(idx);
    // Optimistic update
    const updated = items.map((a, i) => i === idx ? { ...a, done: newDone } : a);
    setItems(updated);
    try {
      await toggleEscalationActionItem(item.id, newDone, { editedBy });
      onActionToggled({ ...esc, actionItems: updated });
    } catch {
      // Revert on failure
      setItems(items);
    } finally {
      setTogglingIdx(null);
    }
  }

  const slaColor = esc.slaRemainingHours < 24 ? "text-crit" : esc.slaRemainingHours < 48 ? "text-warn" : "text-success";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded shrink-0 mt-0.5 ${priorityBadge(esc.priority)}`}>
              {esc.priority}
            </span>
            <DialogTitle className="text-base leading-snug">{esc.title}</DialogTitle>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">{acc.name}</span>
            <span>·</span>
            <span className={`font-mono font-bold ${slaColor}`}>
              <Clock className="size-3 inline mr-0.5" />
              {Number(esc.slaRemainingHours ?? 0).toFixed(1)}h SLA remaining
            </span>
            <span>·</span>
            <span>Opened {formatDate(esc.openedAt)}</span>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-4 pr-1">
          {esc.description && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Description</p>
              <p className="text-sm leading-relaxed">{esc.description}</p>
            </div>
          )}

          {esc.rca && (
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Root Cause Analysis</p>
              <p className="text-xs leading-relaxed">{esc.rca}</p>
            </div>
          )}

          {items.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Action Items ({items.filter((a) => a.done).length}/{items.length} done)
              </p>
              <div className="border rounded-lg divide-y overflow-hidden">
                {items.map((a, i) => (
                  <label
                    key={a.id ?? a.label}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                      a.done ? "bg-success/5 hover:bg-success/10" : "hover:bg-muted/30"
                    } ${togglingIdx === i ? "opacity-60" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={a.done}
                      onChange={() => toggle(a, i)}
                      disabled={togglingIdx !== null}
                      className="shrink-0 accent-primary size-4"
                    />
                    <span className={`text-xs flex-1 leading-snug ${a.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {a.label}
                    </span>
                    {togglingIdx === i
                      ? <Loader2 className="size-3.5 animate-spin text-muted-foreground shrink-0" />
                      : a.done
                        ? <CheckCircle2 className="size-3.5 text-success shrink-0" />
                        : null
                    }
                  </label>
                ))}
              </div>
            </div>
          )}

          {esc.recommendation && (
            <div className="bg-accent/5 border border-accent/20 rounded-lg p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-accent mb-1">Recommendation</p>
              <p className="text-xs leading-relaxed">{esc.recommendation}</p>
            </div>
          )}

          {esc.clientFeedback && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Client Feedback</p>
              <p className="text-xs leading-relaxed">{esc.clientFeedback}</p>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 border-t">
          <button onClick={onClose} className="px-4 py-2 text-xs border rounded-md hover:bg-muted">
            Close
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
