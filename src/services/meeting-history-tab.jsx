import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/data/kam-data";
import { fetchFirefliesRequiredActionItems } from "@/services/fireflies-action-items.server";
import {
  deleteFirefliesMeetingHistory,
  fetchFirefliesMeetingSummaries,
  refreshAccountRetentionGrowthScoring,
} from "@/services/db";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ChevronDown, Clock, Loader2, Trash2 } from "lucide-react";

const MEETING_HISTORY_PAGE_SIZE_OPTIONS = [5, 10, 20];

function formatOpportunityPotential(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? `+${formatCurrency(parsed)}` : "Not provided";
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </p>
      <p className="text-sm font-medium leading-snug">{value}</p>
    </div>
  );
}

function RuleBadge({ ruleId }) {
  if (!ruleId) return null;

  return (
    <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-muted text-muted-foreground px-2 py-1">
      {ruleId}
    </span>
  );
}

function ConfidenceBadge({ confidence }) {
  const styles = {
    High: "bg-success/10 text-success",
    Medium: "bg-warn/10 text-warn",
    Low: "bg-muted text-muted-foreground",
  };

  return (
    <span
      className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
        styles[confidence] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {confidence}
    </span>
  );
}

function AreaBadge({ area }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-accent/10 text-accent px-2 py-1 whitespace-nowrap">
      {area}
    </span>
  );
}

function getMeetingHistoryTimestamp(meeting) {
  const timestamp = new Date(
    meeting.meetingDate ?? meeting.syncedAt ?? meeting.createdAt,
  ).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function sortMeetingHistory(meetings, sortDirection) {
  return [...meetings].sort((left, right) => {
    const diff = getMeetingHistoryTimestamp(right) - getMeetingHistoryTimestamp(left);
    return sortDirection === "asc" ? -diff : diff;
  });
}

function getMeetingDeleteCounts(meetings) {
  return meetings.reduce(
    (counts, meeting) => ({
      meetings: counts.meetings + 1,
      actionItems: counts.actionItems + (meeting.derivedActionItems?.length ?? 0),
      opportunities: counts.opportunities + (meeting.derivedOpportunities?.length ?? 0),
    }),
    { meetings: 0, actionItems: 0, opportunities: 0 },
  );
}

function createMeetingDeleteTarget(scope, meeting = null) {
  return {
    scope,
    meeting,
    deleteActionItems: true,
    deleteOpportunities: true,
  };
}

export function MeetingHistoryTab({ account, profile, session }) {
  const queryClient = useQueryClient();
  const role = profile?.role ?? "KAM";
  const isAssignedKam = role === "KAM" ? account.assignedKamId === profile?.id : false;
  const canSync = role === "Head of KAM" || (role === "KAM" && isAssignedKam);
  const canDeleteHistory = canSync;
  const [syncStatus, setSyncStatus] = useState("");
  const [sortDirection, setSortDirection] = useState("desc");
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(1);
  const [expandedMeetingId, setExpandedMeetingId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["fireflies-meeting-summaries", account.id],
    queryFn: () => fetchFirefliesMeetingSummaries(account.id),
    enabled: Boolean(account.id),
  });
  const { mutate: syncFirefliesMeetings, isPending: syncingMeetings } = useMutation({
    mutationFn: () =>
      fetchFirefliesRequiredActionItems({
        data: {
          accountId: account.id,
          limit: 10,
          daysBack: 60,
          actorAccessToken: session?.access_token,
        },
      }),
    onSuccess: (result) => {
      setSyncStatus(result.status ?? "Fireflies meetings synced.");
      queryClient.invalidateQueries({ queryKey: ["fireflies-meeting-summaries", account.id] });
      queryClient.invalidateQueries({ queryKey: ["activity-rule-activities", account.id] });
      queryClient.invalidateQueries({ queryKey: ["opportunities", account.id] });
    },
    onError: (error) => {
      setSyncStatus(error?.message ?? "Fireflies meeting sync failed.");
    },
  });
  const { mutate: deleteMeetingHistory, isPending: deletingHistory } = useMutation({
    mutationFn: async (target) => {
      const result = await deleteFirefliesMeetingHistory({
        accountId: account.id,
        meetingIds: target.scope === "single" ? [target.meeting.id] : undefined,
        deleteActionItems: target.deleteActionItems,
        deleteOpportunities: target.deleteOpportunities,
      });
      if (target.deleteOpportunities) {
        await refreshAccountRetentionGrowthScoring(account.id).catch(() => null);
      }
      return result;
    },
    onSuccess: (result) => {
      setSyncStatus(
        `Deleted ${result.meetingsDeleted} meeting${result.meetingsDeleted === 1 ? "" : "s"}, ${result.actionItemsDeleted} action item${result.actionItemsDeleted === 1 ? "" : "s"}, and ${result.opportunitiesDeleted} opportunit${result.opportunitiesDeleted === 1 ? "y" : "ies"}.`,
      );
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["fireflies-meeting-summaries", account.id] });
      queryClient.invalidateQueries({ queryKey: ["activity-rule-activities", account.id] });
      queryClient.invalidateQueries({ queryKey: ["opportunities", account.id] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (error) => {
      setSyncStatus(error?.message ?? "Meeting history delete failed.");
    },
  });

  const sortedMeetings = useMemo(
    () => sortMeetingHistory(meetings, sortDirection),
    [meetings, sortDirection],
  );
  const totalPages = Math.max(Math.ceil(sortedMeetings.length / pageSize), 1);
  const pageStart = (page - 1) * pageSize;
  const pagedMeetings = useMemo(
    () => sortedMeetings.slice(pageStart, pageStart + pageSize),
    [pageStart, pageSize, sortedMeetings],
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!pagedMeetings.length) {
      setExpandedMeetingId("");
      return;
    }
    if (!pagedMeetings.some((meeting) => meeting.id === expandedMeetingId)) {
      setExpandedMeetingId(pagedMeetings[0].id);
    }
  }, [expandedMeetingId, pagedMeetings]);

  const openDeleteDialog = (scope, meeting = null) => {
    setDeleteTarget(createMeetingDeleteTarget(scope, meeting));
  };

  const actionCount = meetings.reduce(
    (total, meeting) => total + (meeting.derivedActionItems?.length ?? 0),
    0,
  );
  const opportunityCount = meetings.reduce(
    (total, meeting) => total + (meeting.derivedOpportunities?.length ?? 0),
    0,
  );
  const summaryDerivedCount = meetings.reduce(
    (total, meeting) =>
      total +
      (meeting.derivedActionItems ?? []).filter((item) => item.actionSource === "summary_derived")
        .length,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="bg-card border rounded-xl p-6 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="space-y-2">
          <h3 className="text-sm font-bold">Fireflies Meeting History</h3>
          <p className="text-xs text-muted-foreground max-w-3xl">
            Each synced meeting stores its Fireflies summary, raw action items, agent-derived action
            items, and guardrail diagnostics for {account.name}.
          </p>
          <p
            className={`text-[11px] ${
              syncStatus.includes("failed") || syncStatus.includes("Missing")
                ? "text-crit"
                : "text-muted-foreground"
            }`}
          >
            {syncStatus || "Latest saved meetings appear below after Fireflies sync runs."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!canSync || !session?.access_token || syncingMeetings}
            onClick={() => syncFirefliesMeetings()}
          >
            {syncingMeetings && <Loader2 className="size-3.5 animate-spin mr-1" />}
            Sync Fireflies
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={!canDeleteHistory || !meetings.length || deletingHistory}
            onClick={() => openDeleteDialog("all")}
          >
            <Trash2 className="size-3.5 mr-1" />
            Delete history
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MiniStat label="Meetings saved" value={isLoading ? "Loading" : `${meetings.length}`} />
        <MiniStat label="Action items detected" value={`${actionCount}`} />
        <MiniStat label="Opportunities detected" value={`${opportunityCount}`} />
        <MiniStat label="Summary-derived actions" value={`${summaryDerivedCount}`} />
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-xs text-muted-foreground">
          Loading meeting history...
        </div>
      ) : meetings.length ? (
        <div className="space-y-4">
          <div className="bg-card border rounded-xl p-4 space-y-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Meeting Browser
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click a meeting row to open its summary, agent actions, opportunities, and
                  diagnostics.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Sort by date
                  </Label>
                  <div className="inline-flex rounded-lg border bg-muted/20 p-1">
                    {[
                      { value: "desc", label: "Newest" },
                      { value: "asc", label: "Oldest" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setSortDirection(option.value);
                          setPage(1);
                        }}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                          sortDirection === option.value
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Page size
                  </Label>
                  <div className="inline-flex rounded-lg border bg-muted/20 p-1">
                    {MEETING_HISTORY_PAGE_SIZE_OPTIONS.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => {
                          setPageSize(size);
                          setPage(1);
                        }}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                          pageSize === size
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t pt-3">
              <p className="text-[11px] text-muted-foreground">
                Showing {pageStart + 1}-{Math.min(pageStart + pageSize, sortedMeetings.length)} of{" "}
                {sortedMeetings.length} meetings
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(value - 1, 1))}
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((value) => Math.min(value + 1, totalPages))}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {pagedMeetings.map((meeting) => (
              <MeetingHistoryDisclosureCard
                key={meeting.id}
                meeting={meeting}
                isOpen={expandedMeetingId === meeting.id}
                canDeleteHistory={canDeleteHistory}
                deletingHistory={deletingHistory}
                onToggle={() =>
                  setExpandedMeetingId((current) => (current === meeting.id ? "" : meeting.id))
                }
                onDelete={() => openDeleteDialog("single", meeting)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-card border rounded-xl p-12 text-center">
          <Clock className="size-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No Fireflies meetings saved yet.</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Sync Fireflies to save meeting summaries and auto-create guarded activity items.
          </p>
        </div>
      )}
      <DeleteMeetingHistoryDialog
        target={deleteTarget}
        meetings={
          deleteTarget?.scope === "all"
            ? meetings
            : deleteTarget?.meeting
              ? [deleteTarget.meeting]
              : []
        }
        onClose={() => setDeleteTarget(null)}
        onChange={(patch) =>
          setDeleteTarget((target) => (target ? { ...target, ...patch } : target))
        }
        onConfirm={() => deleteTarget && deleteMeetingHistory(deleteTarget)}
        isDeleting={deletingHistory}
      />
    </div>
  );
}

function MeetingHistoryDisclosureCard({
  meeting,
  isOpen,
  canDeleteHistory,
  deletingHistory,
  onToggle,
  onDelete,
}) {
  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="px-5 py-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <ChevronDown
            className={`mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold leading-snug">{meeting.title}</span>
              {meeting.agentDiagnostics?.summaryFallbackUsed && (
                <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-accent/10 text-accent px-2 py-1">
                  Summary derived
                </span>
              )}
            </span>
            <span className="mt-1 block text-[11px] text-muted-foreground">
              {formatMeetingHistoryDate(meeting.meetingDate)} | synced{" "}
              {formatMeetingHistoryDate(meeting.syncedAt)}
            </span>
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase rounded-full bg-muted text-muted-foreground px-2 py-1">
            {(meeting.derivedActionItems ?? []).length} actions
          </span>
          <span className="text-[10px] font-bold uppercase rounded-full bg-success/10 text-success px-2 py-1">
            {(meeting.derivedOpportunities ?? []).length} opportunities
          </span>
          {meeting.transcriptUrl && (
            <a
              href={meeting.transcriptUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] font-bold uppercase tracking-wide text-accent"
            >
              Transcript
            </a>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={!canDeleteHistory || deletingHistory}
            onClick={onDelete}
          >
            <Trash2 className="size-3.5 mr-1" />
            Delete
          </Button>
        </div>
      </div>

      {isOpen && (
        <div className="border-t p-6 space-y-4">
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Summary
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {meeting.overview || meeting.shortSummary || "No summary text available."}
            </p>
          </div>

          {(meeting.derivedActionItems ?? []).length ? (
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Agent action items
              </p>
              <div className="grid gap-3">
                {meeting.derivedActionItems.map((item) => (
                  <div key={item.id} className="rounded-lg border bg-muted/20 p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <AreaBadge area={item.healthArea} />
                      <RuleBadge ruleId={item.ruleId} />
                      <ConfidenceBadge confidence={item.confidence} />
                      <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-muted text-muted-foreground px-2 py-1">
                        {formatMeetingActionSource(item.actionSource)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.expectedLift}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No action item passed the guarded activity rules for this meeting.
            </p>
          )}

          {(meeting.derivedOpportunities ?? []).length ? (
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Agent opportunities
              </p>
              <div className="grid gap-3">
                {meeting.derivedOpportunities.map((opportunity) => (
                  <div
                    key={opportunity.id}
                    className="rounded-lg border bg-success/5 p-3 space-y-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <AreaBadge area={opportunity.category} />
                      <ConfidenceBadge confidence={opportunity.confidence} />
                      <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-muted text-muted-foreground px-2 py-1">
                        {formatMeetingActionSource(opportunity.sourceType)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold">{opportunity.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatOpportunityPotential(opportunity.potential)} | {opportunity.nextStep}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No commercial or retention opportunity passed the guarded opportunity rules.
            </p>
          )}

          <details className="group rounded-lg border bg-muted/20 text-xs">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
              <span className="font-bold uppercase tracking-widest text-muted-foreground">
                Meeting details
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t p-3 space-y-3">
              <MiniStat
                label="Participants"
                value={
                  meeting.participants?.length ? meeting.participants.join(", ") : "Not available"
                }
              />
              <MiniStat
                label="Raw Fireflies action items"
                value={meeting.actionItems || "No explicit action items from Fireflies."}
              />
              <MiniStat
                label="Agent diagnostics"
                value={`Source: ${formatMeetingActionSource(
                  meeting.agentDiagnostics?.actionSource,
                )}; candidates: ${meeting.agentDiagnostics?.candidateCount ?? 0}; accepted: ${
                  meeting.agentDiagnostics?.acceptedCount ?? 0
                }; opportunity candidates: ${
                  meeting.agentDiagnostics?.opportunity?.candidateCount ?? 0
                }; opportunities: ${meeting.agentDiagnostics?.opportunity?.acceptedCount ?? 0}`}
              />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function DeleteMeetingHistoryDialog({
  target,
  meetings,
  onClose,
  onChange,
  onConfirm,
  isDeleting,
}) {
  const counts = getMeetingDeleteCounts(meetings);
  const title =
    target?.scope === "all"
      ? `Delete all ${counts.meetings} saved meetings?`
      : `Delete ${target?.meeting?.title ?? "this meeting"}?`;

  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Meeting summaries will be deleted from Meeting History. Choose whether linked activity
            items and opportunities should be removed too.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 rounded-lg border bg-muted/20 p-3 text-sm">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={Boolean(target?.deleteActionItems)}
              onChange={(event) => onChange({ deleteActionItems: event.target.checked })}
            />
            <span>
              <span className="font-medium">Delete linked action items</span>
              <span className="block text-xs text-muted-foreground">
                {counts.actionItems} Fireflies-generated activity item
                {counts.actionItems === 1 ? "" : "s"} will be removed.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={Boolean(target?.deleteOpportunities)}
              onChange={(event) => onChange({ deleteOpportunities: event.target.checked })}
            />
            <span>
              <span className="font-medium">Delete linked opportunities</span>
              <span className="block text-xs text-muted-foreground">
                {counts.opportunities} Fireflies-generated opportunit
                {counts.opportunities === 1 ? "y" : "ies"} will be removed.
              </span>
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={isDeleting} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={isDeleting} onClick={onConfirm}>
            {isDeleting && <Loader2 className="size-3.5 animate-spin mr-1" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatMeetingHistoryDate(value) {
  if (!value) return "Recent";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMeetingActionSource(source) {
  if (source === "llm_fallback") return "LLM fallback";
  if (source === "summary_derived") return "Summary derived";
  if (source === "explicit_action_items") return "Fireflies action item";
  return "Meeting agent";
}
