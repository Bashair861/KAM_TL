import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import {
  createActionItemNotifications,
  createEscalationNotifications,
} from "@/services/notifications";

function readEnv(name) {
  if (typeof process !== "undefined" && process.env?.[name]) return process.env[name];
  return undefined;
}

function mapPriority(jiraPriority) {
  const name = (jiraPriority?.name ?? "").toLowerCase();
  if (name === "highest" || name === "high") return "P1";
  if (name === "medium") return "P2";
  return "P3";
}

function slaHours(priority) {
  if (priority === "P1") return 48;
  if (priority === "P2") return 72;
  return 120;
}

function randomId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function compactHistoryParts(parts) {
  return parts
    .map((part) => (part === null || part === undefined ? "" : String(part).trim()))
    .filter(Boolean)
    .join(" | ");
}

function summarizeEscalationHistory(issue = {}) {
  return compactHistoryParts([
    issue.title ? `Title: ${issue.title}` : null,
    issue.priority ? `Priority: ${issue.priority}` : null,
    issue.slaRemainingHours !== undefined ? `SLA remaining: ${issue.slaRemainingHours}h` : null,
    issue.openedAt ? `Opened: ${String(issue.openedAt).slice(0, 10)}` : null,
    issue.description ? `Description: ${issue.description}` : null,
    issue.actionItems?.length ? `Action items: ${issue.actionItems.length}` : null,
  ]);
}

function extractText(doc) {
  if (!doc) return "";
  if (typeof doc === "string") return doc;
  const lines = [];
  function walk(node) {
    if (!node) return;
    if (node.type === "text") lines.push(node.text ?? "");
    if (Array.isArray(node.content)) node.content.forEach(walk);
  }
  walk(doc);
  return lines.join(" ").trim();
}

export const fetchJiraIssues = createServerFn({ method: "GET" }).handler(async () => {
  const baseUrl = readEnv("JIRA_BASE_URL");
  const email = readEnv("JIRA_EMAIL");
  const token = readEnv("JIRA_API_TOKEN");
  const projectKey = readEnv("JIRA_PROJECT_KEY");

  if (!baseUrl || !email || !token || !projectKey) {
    throw new Error(
      "Jira credentials not configured. Check JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY in .env",
    );
  }

  const credentials =
    typeof Buffer !== "undefined"
      ? Buffer.from(`${email}:${token}`).toString("base64")
      : btoa(`${email}:${token}`);

  const url = `${baseUrl}/rest/api/3/search/jql`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jql: `project=${projectKey} AND statusCategory != Done ORDER BY created DESC`,
      fields: ["summary", "description", "priority", "status", "created", "subtasks"],
      maxResults: 50,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jira API error ${res.status}: ${body}`);
  }

  const json = await res.json();
  return (json.issues ?? []).map((issue) => {
    const priority = mapPriority(issue.fields?.priority);
    return {
      id: issue.key,
      title: issue.fields?.summary ?? issue.key,
      description: extractText(issue.fields?.description),
      priority,
      slaRemainingHours: slaHours(priority),
      openedAt: issue.fields?.created ?? new Date().toISOString(),
      actionItems: (issue.fields?.subtasks ?? []).map((s) => ({
        label: s.fields?.summary ?? s.key,
        done: false,
      })),
    };
  });
});

export const saveJiraEscalations = createServerFn({ method: "POST" })
  .inputValidator((data) => data)
  .handler(async ({ data }) => {
    const { issues, accountId, editedBy = "Unknown" } = data;

    if (!issues?.length) throw new Error("No issues to save.");
    if (!accountId) throw new Error("Account is required.");

    const supabaseUrl = readEnv("VITE_SUPABASE_URL");
    const supabaseKey = readEnv("SUPABASE_SERVICE_ROLE_KEY") ?? readEnv("VITE_SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("Supabase credentials not configured.");

    const supabase = createClient(supabaseUrl, supabaseKey);

    for (const issue of issues) {
      const escalId = issue.key ?? issue.id;
      if (!escalId) throw new Error("Issue is missing an id/key field.");

      const { data: existingEscalation, error: existingEscalationError } = await supabase
        .from("escalations")
        .select("id")
        .eq("id", escalId)
        .maybeSingle();
      if (existingEscalationError) throw existingEscalationError;
      const isNewEscalation = !existingEscalation;

      const { error: escalErr } = await supabase.from("escalations").upsert({
        id: escalId,
        account_id: accountId,
        title: issue.title,
        description: issue.description,
        priority: issue.priority,
        sla_remaining_hours: issue.slaRemainingHours,
        opened_at: issue.openedAt,
      });
      if (escalErr) throw escalErr;

      if (isNewEscalation) {
        await createEscalationNotifications(supabase, {
          accountId,
          escalationId: escalId,
          title: issue.title,
        }).catch(() => null);
      }

      if (issue.actionItems?.length) {
        await supabase.from("escalation_action_items").delete().eq("escalation_id", escalId);
        const { error: aiErr } = await supabase.from("escalation_action_items").insert(
          issue.actionItems.map((a) => ({
            escalation_id: escalId,
            label: a.label,
            done: a.done,
          })),
        );
        if (aiErr) throw aiErr;

        // Save each action item as a task
        await supabase.from("tasks").delete().eq("escalation_id", escalId);
        const taskRows = issue.actionItems.map((a) => ({
          id: randomId(),
          name: a.label,
          type: "Action Item",
          account_id: accountId,
          escalation_id: escalId,
          Complete: a.done,
        }));
        const { error: taskErr } = await supabase.from("tasks").insert(taskRows);
        if (taskErr) throw taskErr;

        if (isNewEscalation) {
          await Promise.all(
            taskRows.map((task) =>
              createActionItemNotifications(supabase, {
                accountId,
                actionItemId: task.id,
                title: task.name,
              }).catch(() => null),
            ),
          );
        }
      }

      const { error: historyError } = await supabase.from("account_history").insert({
        account_id: accountId,
        field_name: "Escalation saved from Jira",
        old_value: null,
        new_value: summarizeEscalationHistory(issue),
        edited_by: editedBy,
      });
      if (historyError) throw historyError;
    }

    return { saved: issues.length };
  });
