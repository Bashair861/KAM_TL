import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  DollarSign,
  FileText,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/data/kam-data";
import { useAuth } from "@/context/AuthContext";
import { fetchContractDetail, updateContractDetail } from "@/services/db";
import { formatRenewalDate } from "@/lib/utils";

export const Route = createFileRoute("/contract-detail/$accountId")({
  head: () => ({
    meta: [
      { title: "Contract Detail - tkxel KAM" },
      { name: "description", content: "Contract detail, portfolio clauses, and audit history." },
    ],
  }),
  component: ContractDetailPage,
});

const CONTRACT_TYPES = ["Staff Augmented", "Time Based", "Retainer", "Project"];

function contractToForm(contract) {
  return {
    contractType: contract?.contractType || "Staff Augmented",
    duration: contract?.duration || "",
    contractValue:
      contract?.contractValue === null || contract?.contractValue === undefined
        ? ""
        : String(contract.contractValue),
    renewalDate: contract?.renewalDate ? String(contract.renewalDate).slice(0, 10) : "",
    contractCompliance:
      contract?.contractCompliance === null || contract?.contractCompliance === undefined
        ? ""
        : String(contract.contractCompliance),
    autoRenew: Boolean(contract?.autoRenew),
    nonTerminator: Boolean(contract?.nonTerminator),
    minOneYear: Boolean(contract?.minOneYear),
    priceHike: contract?.priceHike || "",
    backupExists: Boolean(contract?.backupExists),
    criticalResources:
      contract?.criticalResources === null || contract?.criticalResources === undefined
        ? "0"
        : String(contract.criticalResources),
    customerFeedback: contract?.customerFeedback || "",
  };
}

function normalizeComparable(form) {
  return {
    ...form,
    duration: form.duration.trim(),
    priceHike: form.priceHike.trim(),
    customerFeedback: form.customerFeedback.trim(),
    contractValue: String(Number(String(form.contractValue).replace(/[$,\s]/g, ""))),
    contractCompliance: form.contractCompliance === "" ? "" : String(Number(form.contractCompliance)),
    criticalResources: String(Math.round(Number(form.criticalResources || 0))),
  };
}

function ContractDetailPage() {
  const { accountId } = Route.useParams();
  const { profile, loading } = useAuth();
  const queryClient = useQueryClient();
  const role = profile?.role ?? "KAM";
  const [form, setForm] = useState(null);
  const [saveMessage, setSaveMessage] = useState("");

  const {
    data: contract,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["contract-detail", accountId, role, profile?.id],
    queryFn: () => fetchContractDetail(accountId, { role, userId: profile?.id }),
    enabled: !loading && Boolean(profile),
  });
  const isAssignedKam = role === "KAM" && contract?.assignedKamId === profile?.id;
  const canEdit = role === "Head of KAM" || isAssignedKam;

  useEffect(() => {
    if (contract) setForm(contractToForm(contract));
  }, [contract]);

  const initialForm = useMemo(() => (contract ? contractToForm(contract) : null), [contract]);
  const isDirty = useMemo(() => {
    if (!form || !initialForm) return false;
    return JSON.stringify(normalizeComparable(form)) !== JSON.stringify(normalizeComparable(initialForm));
  }, [form, initialForm]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateContractDetail(accountId, form, {
        role,
        userId: profile?.id,
        editedBy: profile?.name ?? "Unknown",
      }),
    onMutate: () => setSaveMessage(""),
    onSuccess: async (updatedContract) => {
      if (updatedContract) {
        queryClient.setQueryData(["contract-detail", accountId, role, profile?.id], updatedContract);
        setForm(contractToForm(updatedContract));
      }
      setSaveMessage("Contract details saved and tracked in Client History.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["contracts"] }),
        queryClient.invalidateQueries({ queryKey: ["contract-detail", accountId] }),
        queryClient.invalidateQueries({ queryKey: ["account-history", accountId] }),
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
      ]);
    },
  });

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setSaveMessage("");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        Loading contract
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="bg-card border rounded-lg p-8 text-center">
          <Lock className="size-8 mx-auto text-muted-foreground mb-3" />
          <h1 className="text-xl font-bold">Sign in required</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Please sign in before viewing contract details.
          </p>
          <Button asChild className="mt-5">
            <Link to="/login">Go to login</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        Loading contract
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="bg-card border rounded-lg p-8 text-center">
          <FileText className="size-8 mx-auto text-muted-foreground mb-3" />
          <h1 className="text-xl font-bold">Contract not found</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {error?.message ?? "This account is not available for your current access."}
          </p>
          <Button asChild className="mt-5">
            <Link to="/contracts">Back to contracts</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <header className="bg-card border-b px-4 md:px-8 py-3 sticky top-14 md:top-0 z-10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/contracts"
              className="size-8 rounded-md border flex items-center justify-center hover:bg-muted transition-colors shrink-0"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-semibold text-base md:text-lg truncate">{contract.name}</h1>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                  {contract.tier ?? "Account"}
                </Badge>
                {!canEdit ? (
                  <Badge variant="outline" className="gap-1 text-[10px] uppercase tracking-wider">
                    <Lock className="size-3" />
                    Read-only
                  </Badge>
                ) : null}
              </div>
              <p className="text-[11px] md:text-xs text-muted-foreground truncate">
                Contract detail - {contract.shortCode ?? accountId}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            {saveMessage ? (
              <span className="text-xs font-medium text-success">{saveMessage}</span>
            ) : null}
            {saveMutation.error ? (
              <span className="text-xs font-medium text-crit">
                {saveMutation.error.message ?? "Save failed"}
              </span>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setForm(contractToForm(contract))}
              disabled={!isDirty || saveMutation.isPending}
            >
              Reset
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={!canEdit || !isDirty || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-8 max-w-7xl w-full mx-auto space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <SummaryTile
            icon={DollarSign}
            label="Contract value"
            value={formatContractValue(contract.contractValue)}
          />
          <SummaryTile
            icon={CalendarClock}
            label="Renewal"
            value={formatRenewalDate(contract.renewalDate, "--")}
          />
          <SummaryTile
            icon={ShieldCheck}
            label="Compliance"
            value={formatCompliance(contract.contractCompliance)}
          />
          <SummaryTile
            icon={CheckCircle2}
            label="Auto renew"
            value={contract.autoRenew ? "Yes" : "No"}
          />
        </div>

        <div className="space-y-5">
          <section className="bg-card border rounded-lg overflow-hidden">
            <SectionHeader title="Contract Data" subtitle={canEdit ? "Editable" : role} />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-5">
              <Field label="Contract Type">
                <select
                  value={form.contractType}
                  onChange={(event) => setField("contractType", event.target.value)}
                  disabled={!canEdit || saveMutation.isPending}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {CONTRACT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Duration">
                <Input
                  value={form.duration}
                  onChange={(event) => setField("duration", event.target.value)}
                  disabled={!canEdit || saveMutation.isPending}
                  placeholder="12 months"
                />
              </Field>
              <Field label="Contract Value">
                <Input
                  type="number"
                  min="0"
                  value={form.contractValue}
                  onChange={(event) => setField("contractValue", event.target.value)}
                  disabled={!canEdit || saveMutation.isPending}
                />
              </Field>
              <Field label="Renewal Date">
                <Input
                  type="date"
                  value={form.renewalDate}
                  onChange={(event) => setField("renewalDate", event.target.value)}
                  disabled={!canEdit || saveMutation.isPending}
                />
              </Field>
              <Field label="Process Compliance">
                <Input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  value={form.contractCompliance}
                  onChange={(event) => setField("contractCompliance", event.target.value)}
                  disabled={!canEdit || saveMutation.isPending}
                />
              </Field>
              <Field label="Price Hike">
                <Input
                  value={form.priceHike}
                  onChange={(event) => setField("priceHike", event.target.value)}
                  disabled={!canEdit || saveMutation.isPending}
                  placeholder="5% YoY"
                />
              </Field>
              <ToggleField
                label="Auto Renew"
                checked={form.autoRenew}
                disabled={!canEdit || saveMutation.isPending}
                onChange={(value) => setField("autoRenew", value)}
              />
              <ToggleField
                label="Non Terminator"
                checked={form.nonTerminator}
                disabled={!canEdit || saveMutation.isPending}
                onChange={(value) => setField("nonTerminator", value)}
              />
              <ToggleField
                label="Minimum One Year"
                checked={form.minOneYear}
                disabled={!canEdit || saveMutation.isPending}
                onChange={(value) => setField("minOneYear", value)}
              />
              <ToggleField
                label="Backup Exists"
                checked={form.backupExists}
                disabled={!canEdit || saveMutation.isPending}
                onChange={(value) => setField("backupExists", value)}
              />
              <Field label="Critical Resources">
                <Input
                  type="number"
                  min="0"
                  value={form.criticalResources}
                  onChange={(event) => setField("criticalResources", event.target.value)}
                  disabled={!canEdit || saveMutation.isPending}
                />
              </Field>
              <div className="md:col-span-2 xl:col-span-3">
                <Field label="Customer Feedback">
                  <Textarea
                    value={form.customerFeedback}
                    onChange={(event) => setField("customerFeedback", event.target.value)}
                    disabled={!canEdit || saveMutation.isPending}
                    className="min-h-24"
                  />
                </Field>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div className="px-5 py-4 border-b flex items-center justify-between gap-3">
      <h2 className="text-sm font-bold">{title}</h2>
      <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
        {subtitle}
      </span>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-2">
      <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function ToggleField({ label, checked, disabled, onChange }) {
  return (
    <div className="rounded-lg border bg-background p-4 flex items-center justify-between gap-3">
      <Label className="text-sm font-semibold">{label}</Label>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

function SummaryTile({ icon: Icon, label, value }) {
  return (
    <div className="bg-card border rounded-lg p-4 flex items-center justify-between gap-3 min-w-0">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
          {label}
        </p>
        <p className="text-lg font-bold mt-1 truncate">{value}</p>
      </div>
      <span className="size-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Icon className="size-4" />
      </span>
    </div>
  );
}

function formatContractValue(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "--";
  return formatCurrency(amount);
}

function formatCompliance(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return "--";
  return `${score.toFixed(1)}/10`;
}
