import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/data/kam-data";
import { fetchAccounts, fetchKamUsers, updateAccountKam, createAccount, deleteAccount } from "@/services/db";
import { useAuth } from "@/context/AuthContext";
import { TrendingDown, TrendingUp, X, Loader2, Building2, Trash2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/accounts/")({
  head: () => ({
    meta: [
      { title: "Accounts Portfolio — Aether KAM" },
      { name: "description", content: "Full list of key accounts with health, contract value, and trend." },
    ],
  }),
  component: AccountsListPage,
});

// ── helpers ──────────────────────────────────────────────────────────────────

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function initials(name) {
  return name.split(" ").map((w) => w[0] ?? "").join("").slice(0, 3).toUpperCase();
}

// ── page ─────────────────────────────────────────────────────────────────────

function AccountsListPage() {
  const { profile } = useAuth();
  const role = profile?.role ?? "KAM";
  const userId = profile?.id;
  const isHead = role === "Head of KAM";
  const queryClient = useQueryClient();

  const [showNewModal, setShowNewModal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteError, setDeleteError] = useState("");

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
    mutationFn: ({ accountId, kamId }) => updateAccountKam(accountId, kamId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["accounts"] }),
  });

  const { mutate: confirmDelete, isPending: deleting } = useMutation({
    mutationFn: (accountId) => deleteAccount(accountId),
    onSuccess: () => {
      setConfirmDeleteId(null);
      setDeleteError("");
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (err) => setDeleteError(err.message ?? "Delete failed. Make sure the RLS policy is applied in Supabase."),
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
          {isHead && (
            <button
              onClick={() => setShowNewModal(true)}
              className="px-4 py-2 bg-accent text-white text-xs font-semibold rounded-md hover:opacity-90 transition-opacity"
            >
              + New Account
            </button>
          )}
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
                {isHead && <th className="px-6 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {accounts.map((a) => (
                <tr key={a.id} className="hover:bg-muted/40 transition-colors">
                  <td className="px-6 py-4">
                    <Link to="/accounts/$accountId" params={{ accountId: a.id }} className="flex items-center gap-3 group">
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
                    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${a.trend >= 0 ? "text-success" : "text-crit"}`}>
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
                  {isHead && (
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setConfirmDeleteId(a.id)}
                        title="Delete account"
                        className="size-7 rounded-md hover:bg-crit/10 hover:text-crit flex items-center justify-center text-muted-foreground transition-colors ml-auto"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showNewModal && (
        <NewAccountModal
          kamUsers={kamUsers}
          onClose={() => setShowNewModal(false)}
          onCreated={() => {
            setShowNewModal(false);
            queryClient.invalidateQueries({ queryKey: ["accounts"] });
          }}
        />
      )}

      {confirmDeleteId && (
        <DeleteConfirmModal
          account={accounts.find((a) => a.id === confirmDeleteId)}
          deleting={deleting}
          error={deleteError}
          onCancel={() => { setConfirmDeleteId(null); setDeleteError(""); }}
          onConfirm={() => confirmDelete(confirmDeleteId)}
        />
      )}
    </div>
  );
}

// ── Delete Confirmation Modal ─────────────────────────────────────────────────

function DeleteConfirmModal({ account, deleting, error, onCancel, onConfirm }) {
  if (!account) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={!deleting ? onCancel : undefined}
    >
      <div
        className="bg-background w-full max-w-md rounded-xl border shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-5">
          <span className="size-10 rounded-full bg-crit/10 text-crit flex items-center justify-center shrink-0">
            <AlertTriangle className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold">Delete account?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-semibold text-foreground">{account.name}</span> and all its
              data — health scores, activities, escalations, contracts, history — will be
              permanently deleted. This cannot be undone.
            </p>
          </div>
        </div>
        {error && (
          <p className="text-xs text-crit bg-crit/10 border border-crit/20 rounded-md px-3 py-2 mb-4">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 text-xs border rounded-md hover:bg-muted transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="px-4 py-2 bg-crit text-white text-xs font-bold rounded-md disabled:opacity-50 flex items-center gap-1.5 hover:opacity-90 transition-opacity"
          >
            {deleting ? <><Loader2 className="size-3 animate-spin" /> Deleting…</> : "Yes, delete account"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── New Account Modal ─────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: "",
  shortCode: "",
  industry: "",
  region: "",
  tier: "Enterprise",
  contractType: "Staff Augmented",
  contractValue: "",
  arr: "",
  renewalDays: "",
  primaryContactName: "",
  assignedKamId: "",
};

function NewAccountModal({ kamUsers, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  // Auto-derive short code from name
  useEffect(() => {
    if (form.name) {
      setForm((f) => ({ ...f, shortCode: initials(form.name) }));
    }
  }, [form.name]);

  const accountId = slugify(form.name);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const { mutate: submit, isPending } = useMutation({
    mutationFn: () =>
      createAccount({
        id: accountId,
        name: form.name,
        shortCode: form.shortCode,
        industry: form.industry,
        region: form.region,
        tier: form.tier,
        contractType: form.contractType,
        contractValue: parseInt(form.contractValue) || 0,
        arr: parseInt(form.arr) || 0,
        renewalDays: parseInt(form.renewalDays) || 365,
        primaryContactName: form.primaryContactName,
        assignedKamId: form.assignedKamId || null,
      }),
    onSuccess: onCreated,
    onError: (err) => setError(err.message ?? "Failed to create account. The ID may already exist."),
  });

  function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) return setError("Account name is required.");
    if (!form.industry.trim()) return setError("Industry is required.");
    if (!form.region.trim()) return setError("Region is required.");
    submit();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 md:p-8" onClick={onClose}>
      <div
        className="bg-background w-full max-w-2xl rounded-xl border shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="size-9 rounded-md bg-accent/10 text-accent flex items-center justify-center">
              <Building2 className="size-4" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-accent">Head of KAM</p>
              <h2 className="text-base font-bold">Add New Account</h2>
            </div>
          </div>
          <button onClick={onClose} className="size-8 rounded-md border flex items-center justify-center hover:bg-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>

        {/* form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">

          {/* Account name */}
          <Field label="Account Name" required>
            <input
              autoFocus
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Helios Robotics"
              className={inputCls}
            />
          </Field>

          {/* Short code + auto ID */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Short Code" required hint="2–3 uppercase letters shown in the avatar">
              <input
                value={form.shortCode}
                onChange={(e) => set("shortCode", e.target.value.toUpperCase().slice(0, 3))}
                placeholder="HR"
                className={inputCls}
                maxLength={3}
              />
            </Field>
            <Field label="Account ID" hint="Auto-generated — used as the URL slug">
              <input
                value={accountId}
                disabled
                className={`${inputCls} opacity-50 cursor-not-allowed`}
              />
            </Field>
          </div>

          {/* Industry + Region */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Industry" required>
              <input
                value={form.industry}
                onChange={(e) => set("industry", e.target.value)}
                placeholder="e.g. FinTech"
                className={inputCls}
              />
            </Field>
            <Field label="Region" required>
              <input
                value={form.region}
                onChange={(e) => set("region", e.target.value)}
                placeholder="e.g. EMEA"
                className={inputCls}
              />
            </Field>
          </div>

          {/* Tier + Contract type */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tier" required>
              <select value={form.tier} onChange={(e) => set("tier", e.target.value)} className={inputCls}>
                <option>Enterprise</option>
                <option>Growth</option>
                <option>Strategic</option>
              </select>
            </Field>
            <Field label="Contract Type" required>
              <select value={form.contractType} onChange={(e) => set("contractType", e.target.value)} className={inputCls}>
                <option>Staff Augmented</option>
                <option>Time Based</option>
                <option>Retainer</option>
                <option>Project</option>
              </select>
            </Field>
          </div>

          {/* Contract value + ARR */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Contract Value ($)" required>
              <input
                type="number"
                min={0}
                value={form.contractValue}
                onChange={(e) => set("contractValue", e.target.value)}
                placeholder="e.g. 1200000"
                className={inputCls}
              />
            </Field>
            <Field label="ARR ($)" required>
              <input
                type="number"
                min={0}
                value={form.arr}
                onChange={(e) => set("arr", e.target.value)}
                placeholder="e.g. 1200000"
                className={inputCls}
              />
            </Field>
          </div>

          {/* Renewal days + primary contact */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Renewal (days)" required>
              <input
                type="number"
                min={1}
                value={form.renewalDays}
                onChange={(e) => set("renewalDays", e.target.value)}
                placeholder="e.g. 365"
                className={inputCls}
              />
            </Field>
            <Field label="Primary Contact Name">
              <input
                value={form.primaryContactName}
                onChange={(e) => set("primaryContactName", e.target.value)}
                placeholder="e.g. Sarah Jenkins"
                className={inputCls}
              />
            </Field>
          </div>

          {/* Assign KAM */}
          <Field label="Assign to KAM">
            <select value={form.assignedKamId} onChange={(e) => set("assignedKamId", e.target.value)} className={inputCls}>
              <option value="">— unassigned —</option>
              {kamUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </Field>

          {error && (
            <p className="text-xs text-crit bg-crit/10 border border-crit/20 rounded-md px-3 py-2">{error}</p>
          )}
        </form>

        {/* footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between gap-3 bg-muted/20">
          <p className="text-[10px] text-muted-foreground">
            Health starts at 50 · status: healthy · can be updated after creation
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-xs border rounded-md hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="px-4 py-2 bg-accent text-white text-xs font-bold rounded-md disabled:opacity-50 flex items-center gap-1.5 hover:opacity-90 transition-opacity"
            >
              {isPending ? <><Loader2 className="size-3 animate-spin" /> Creating…</> : "Create Account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── primitives ────────────────────────────────────────────────────────────────

const inputCls = "w-full bg-background border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent";

function Field({ label, required, hint, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {label}
        {required && <span className="text-crit">*</span>}
      </label>
      {hint && <p className="text-[10px] text-muted-foreground -mt-1">{hint}</p>}
      {children}
    </div>
  );
}
