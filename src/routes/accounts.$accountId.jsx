import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import JSZip from "jszip";
import { formatCurrency, getRolePermissions } from "@/data/kam-data";
import {
  buildActivityTabModel,
  ACTIVITY_TAB_AREAS,
  isRetentionGrowthActivityArea,
} from "@/services/activity-tab";
import {
  removeDuplicateAiSuggestions,
  isDuplicateAiActivity,
} from "@/services/activity-ai-suggestions";
import { fetchFirefliesRequiredActionItems } from "@/services/fireflies-action-items.server";
import { fetchKamAiSuggestions } from "@/services/kam-ai-suggestions.server";
import { syncSummaryOpportunitiesServer } from "@/services/summary-opportunities.server";
import { MeetingHistoryTab } from "@/services/meeting-history-tab";
import { buildRetentionGrowthTabModel } from "@/services/retention-growth-tab";
import {
  fetchAccount,
  fetchEscalations,
  fetchOpportunities,
  fetchKamUsers,
  updateAccountKam,
  updateAccountKyc,
  syncSalesforceMappedFields,
  applySowFields,
  updateHealthBlock,
  fetchAccountHistory,
  logAccountChanges,
  fetchActivityScoreHistory,
  fetchActivityRuleThresholdOverrides,
  fetchActivityRuleActivities,
  createActivityRuleActivity,
  rejectActivityRuleSuggestion,
  markActivityRuleActivityDone,
  markLegacyActivityDone,
  fetchKamTasks,
  createAccountActionItemTask,
  fetchStagedAiRecommendations,
  stageAccountAiRecommendation,
  updateStagedAiRecommendationStatus,
  fetchMeetingInsightActionStates,
  markMeetingInsightActionItemState,
  fetchFirefliesMeetingSummaries,
  generateAccountLinkedinSummary,
  generateAccountWebsiteSummary,
  refreshAccountRetentionGrowthScoring,
} from "@/services/db";
import { upsertActivityScoreSnapshotServer } from "@/services/activity-score-snapshot.server";
import {
  fetchRetentionGrowthDraftsServer,
  upsertRetentionGrowthDraftServer,
} from "@/services/retention-growth-drafts.server";
import { lookupSalesforceAccountBundle } from "@/services/salesforce";
import { extractSowFields } from "@/services/sow-upload";
import { fetchEducationArticles } from "@/services/education";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { askAccountAi } from "@/services/ai";
import {
  ArrowLeft,
  Building2,
  Calendar,
  User,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Circle,
  Users,
  DollarSign,
  Workflow,
  Swords,
  Clock,
  AlertTriangle,
  Lock,
  Maximize2,
  X,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Sparkles,
  Lightbulb,
  Loader2,
  ChevronDown,
  ExternalLink,
  History,
  RefreshCw,
} from "lucide-react";
export const Route = createFileRoute("/accounts/$accountId")({
  head: ({ params }) => ({
    meta: [
      { title: `Account ${params.accountId} - Aether KAM` },
      { name: "description", content: "Client 360 detail view." },
    ],
  }),
  loader: async ({ params }) => {
    const account = await fetchAccount(params.accountId);
    if (!account) throw notFound();
    return { account };
  },
  notFoundComponent: () => (
    <div className="p-12 text-center">
      <p className="text-muted-foreground">Account not found.</p>
      <Link to="/accounts" className="text-accent text-sm font-semibold mt-2 inline-block">
        Back to portfolio
      </Link>
    </div>
  ),
  errorComponent: ({ error }) => <div className="p-12 text-center text-crit">{error.message}</div>,
  component: AccountDetailPage,
});
const TABS = [
  "Overview",
  "Score Marking Matrices",
  "Activity to Increase Score",
  "Opportunities",
  "Retention VS Growth",
  "Educate client",
  "Escalation",
  "Meeting History",
  "Client History",
];
const KYC_FORM_FIELDS = {
  accountStatus: {
    label: "Account Status",
    dbTarget: "accounts.status stores health only, not Key Account",
    aliases: ["Account Status"],
    canSaveToDb: false,
  },
  industry: {
    label: "Industry Info",
    dbTarget: "accounts.industry",
    aliases: ["Industry", "Industry Vertical"],
  },
  business: {
    label: "Business Info",
    dbTarget: "accounts.business_info",
    aliases: ["Business", "Business Information", "Business Domain", "Business Domain Description"],
  },
  history: {
    label: "Client History",
    dbTarget: "accounts.client_history",
    aliases: ["Client History Notes"],
  },
  stakeholdersInfo: {
    label: "Stakeholders Info",
    dbTarget: "stakeholders table",
    aliases: ["Stakeholders", "Stakeholder Info", "Stakeholder Information"],
    canSaveToDb: false,
  },
  revenue: {
    label: "Revenue Info",
    dbTarget: "accounts.revenue",
    aliases: ["Revenue", "Revenue Information"],
  },
  mrrArr: {
    label: "MRR / ARR (Startups)",
    dbTarget: "accounts.mrr_arr",
    aliases: ["MRR / ARR", "MRR", "ARR", "MRR ARR"],
  },
  primary: {
    label: "Person Info (Primary)",
    dbTarget: "accounts.primary_contact_name",
    aliases: ["Person Info Primary", "Primary Contact", "Primary Contact Name", "Contact Name"],
  },
  tenure: {
    label: "Engagement Tenure",
    dbTarget: "accounts.engagement_tenure",
    aliases: ["Engagement Duration"],
  },
  team: { label: "Team Size", dbTarget: "accounts.team_size", aliases: [] },
  competitors: {
    label: "Competitors",
    dbTarget: "accounts.competitors",
    aliases: ["Competition", "Competitor"],
  },
  flow: {
    label: "Main Business Flow",
    dbTarget: "accounts.main_business_flow",
    aliases: ["Business Flow", "Main Flow", "Project Domain"],
  },
  contractRenewalDate: {
    label: "Contract Renewal Date",
    dbTarget: "accounts.renewal_date / contract_details.renewal_date",
    aliases: ["Renewal Date", "Contract Renewal"],
  },
  contractDuration: {
    label: "Contract Duration",
    dbTarget: "accounts.contract_duration / contract_details.duration",
    aliases: ["Duration"],
  },
  linkedinUrl: {
    label: "LinkedIn URL",
    dbTarget: "accounts.linkedin_url",
    aliases: ["LinkedIn", "LinkedIn Profile", "LinkedIn Company URL"],
  },
  websiteUrl: {
    label: "Website URL",
    dbTarget: "accounts.website_url",
    aliases: ["Website", "Company Website", "Website Link"],
  },
};
const KYC_FORM_FIELD_LABELS = Object.fromEntries(
  Object.entries(KYC_FORM_FIELDS).map(([key, value]) => [key, value.label]),
);
const KYC_CHARTER_FIELD_KEYS = [
  "accountStatus",
  "industry",
  "business",
  "history",
  "stakeholdersInfo",
  "revenue",
  "mrrArr",
  "primary",
  "tenure",
  "team",
  "competitors",
  "flow",
];
const KYC_DB_FIELD_KEYS = new Set(
  Object.entries(KYC_FORM_FIELDS)
    .filter(([, field]) => field.canSaveToDb !== false)
    .map(([key]) => key),
);
const DIRECT_XLSX_FORM_FIELDS = new Set(Object.keys(KYC_FORM_FIELDS));
const XLSX_DATE_FORM_FIELDS = new Set(["contractRenewalDate"]);
const KYC_EXTRACTABLE_FIELD_KEYS = KYC_CHARTER_FIELD_KEYS;
function hasSyncValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}
function displaySyncValue(value) {
  if (!hasSyncValue(value)) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
function externalUrl(value) {
  const url = String(value ?? "").trim();
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
const SUMMARY_URL_PATTERN = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
const SUMMARY_SOURCE_PATTERN =
  /\[([^\]]+)\]\((https?:\/\/[^)\s]+|www\.[^)\s]+)\)|(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;

function splitUrlToken(token) {
  const [, urlText = token, suffix = ""] = token.match(/^(.+?)([.,;:)\]]*)$/) ?? [];
  return { urlText, suffix };
}

function normalizeSourceKey(value) {
  try {
    const url = new URL(externalUrl(value));
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return String(value ?? "")
      .replace(/\/$/, "")
      .toLowerCase();
  }
}

function isProviderSourceUrl(value) {
  try {
    const url = new URL(externalUrl(value));
    return /(^|\.)openai\.com$/i.test(url.hostname) || /(^|\.)chatgpt\.com$/i.test(url.hostname);
  } catch {
    return false;
  }
}

function formatSourceLabel(value) {
  try {
    const url = new URL(externalUrl(value));
    const host = url.hostname.replace(/^www\./i, "");
    const path = url.pathname.replace(/\/$/, "");
    if (!path || path === "/") return host;
    const shortPath = path.length > 28 ? `${path.slice(0, 25)}...` : path;
    return `${host}${shortPath}`;
  } catch {
    return "Source";
  }
}

function dedupeSummaryUrls(value) {
  const seen = new Set();
  return String(value ?? "")
    .replace(SUMMARY_SOURCE_PATTERN, (match, _label, markdownUrl, rawUrl) => {
      const { urlText, suffix } = splitUrlToken(markdownUrl || rawUrl || match);
      const key = normalizeSourceKey(urlText);
      if (isProviderSourceUrl(urlText) || seen.has(key)) {
        const sentenceSuffix = suffix.match(/[.,;:]$/)?.[0] ?? "";
        return sentenceSuffix;
      }
      seen.add(key);
      return `${urlText}${suffix}`;
    })
    .replace(/\(\s*(https?:\/\/[^)\s]+|www\.[^)\s]+)\s*\)/gi, "$1")
    .replace(/\(\s*\)/g, "")
    .replace(/\[\s*\]/g, "")
    .replace(/\(\s*([.,;:])\s*\)/g, "$1")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function SummaryParagraph({ text }) {
  const chunks = String(text ?? "").split(SUMMARY_URL_PATTERN);
  return chunks.map((chunk, index) => {
    if (!/^(https?:\/\/|www\.)/i.test(chunk)) return <span key={index}>{chunk}</span>;
    const { urlText, suffix } = splitUrlToken(chunk);
    return (
      <span key={index}>
        <a
          href={externalUrl(urlText)}
          target="_blank"
          rel="noreferrer"
          className="text-accent hover:underline break-all"
        >
          {formatSourceLabel(urlText)}
        </a>
        {suffix}
      </span>
    );
  });
}
function SummaryBody({ summary, emptyText }) {
  if (!summary) return <p className="text-sm text-muted-foreground italic">{emptyText}</p>;
  return (
    <div className="space-y-3">
      {dedupeSummaryUrls(summary)
        .split(/\n{2,}/)
        .filter(Boolean)
        .map((paragraph, index) => (
          <p key={index} className="text-sm leading-6 text-foreground whitespace-pre-wrap">
            <SummaryParagraph text={paragraph} />
          </p>
        ))}
    </div>
  );
}
function formatSummaryUpdatedAt(value) {
  if (!value) return "Last updated: Not generated yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Last updated: Not recorded";
  return `Last updated: ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)}`;
}
function joinSyncParts(parts) {
  return parts
    .filter(([, value]) => hasSyncValue(value))
    .map(([label, value]) => `${label}: ${displaySyncValue(value)}`)
    .join("\n");
}
function formatSalesforceMoney(value) {
  if (!hasSyncValue(value)) return "";
  const amount = Number(value);
  if (Number.isNaN(amount)) return String(value);
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
function normalizeDateValue(value) {
  if (!hasSyncValue(value)) return "";
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toISOString().slice(0, 10);
}
function normalizeMoneySyncValue(value) {
  if (!hasSyncValue(value)) return "";
  const amount = Number(String(value).replace(/[$,\s]/g, ""));
  return Number.isFinite(amount) ? Math.round(amount) : "";
}
function normalizeIntegerSyncValue(value) {
  if (!hasSyncValue(value)) return "";
  const amount = Number(String(value).replace(/[,\s]/g, ""));
  return Number.isFinite(amount) ? Math.round(amount) : "";
}
function normalizeBooleanSyncValue(value) {
  if (typeof value === "boolean") return value;
  if (!hasSyncValue(value)) return "";
  const text = String(value).trim().toLowerCase();
  if (["true", "yes", "y", "1"].includes(text)) return true;
  if (["false", "no", "n", "0"].includes(text)) return false;
  return "";
}
function normalizeContractTypeValue(value) {
  if (!hasSyncValue(value)) return "";
  const text = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const contractTypeMap = new Map([
    ["staff augmented", "Staff Augmented"],
    ["staff augmentation", "Staff Augmented"],
    ["time based", "Time Based"],
    ["time basis", "Time Based"],
    ["time material", "Time Based"],
    ["time and material", "Time Based"],
    ["retainer", "Retainer"],
    ["project", "Project"],
  ]);
  return contractTypeMap.get(text) ?? "";
}
function isXlsxFile(file) {
  if (!file) return false;
  return (
    /\.xlsx$/i.test(file.name) ||
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}
function parseXmlString(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  const parserError = doc.getElementsByTagName("parsererror")[0];
  if (parserError) throw new Error("The selected workbook contains invalid XML.");
  return doc;
}
function normalizeXlsxLabel(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}
function getKycFieldAliases(formKey) {
  const field = KYC_FORM_FIELDS[formKey];
  if (!field) return [];
  return [field.label, ...(field.aliases ?? [])].filter(Boolean);
}
function xlsxLabelsMatch(candidateValue, label) {
  const candidate = normalizeXlsxLabel(candidateValue);
  const target = normalizeXlsxLabel(label);
  if (!candidate || !target) return false;
  return candidate === target;
}
function getInlineLabelValue(cellValue, label) {
  const text = String(cellValue ?? "").trim();
  const labelText = String(label ?? "").trim();
  if (!text || !labelText) return "";
  if (!text.toLowerCase().startsWith(labelText.toLowerCase())) return "";
  const suffix = text.slice(labelText.length);
  if (!/^\s*[:-]\s*/.test(suffix)) return "";
  const value = suffix.replace(/^\s*[:-]\s*/, "").trim();
  if (value) return value;
  return "";
}
function isKnownKycFieldLabel(value) {
  const normalized = normalizeXlsxLabel(value);
  return KYC_EXTRACTABLE_FIELD_KEYS.some((formKey) =>
    getKycFieldAliases(formKey).some((label) => normalizeXlsxLabel(label) === normalized),
  );
}
const GENERIC_XLSX_VALUE_LABELS = new Set(
  [
    "No",
    "Name",
    "Information",
    "Info",
    "Vertical",
    "Domain",
    "Date",
    "Allocation Date",
    "Time Overlap",
    "Project Charter",
    "Project",
    "Charter",
    "Description",
    "Value",
    "Values",
    "Field",
    "Fields",
    "Section",
    "Details",
    "Detail",
    "Status",
    "Type",
    "Owner",
    "Number",
    "Email",
    "Phone",
    "Contact",
    "Notes",
    "Business",
    "Industry",
    "Revenue",
    "Engagement",
    "Team",
    "Competition",
    "Competitors",
    "Link",
    "URL",
    "Website",
    "LinkedIn",
    "Primary",
    "Secondary",
    "Version",
    "Page",
    "Title",
    "Overview",
  ].map(normalizeXlsxLabel),
);
const INSTRUCTIONAL_XLSX_VALUE_PATTERNS = [
  /\bdescribe\b/i,
  /\boverall business\b/i,
  /\bproject objectives\b/i,
  /\bbusiness terms\b/i,
  /\ballocation date\b/i,
  /\btime overlap\b/i,
  /\bproject charter\b/i,
  /\btemplate\b/i,
  /\bversion\b/i,
  /\bsample\b/i,
  /\bplaceholder\b/i,
  /\benter\b/i,
  /\bselect\b/i,
  /\bchoose\b/i,
];
function isGenericXlsxValue(value) {
  const text = String(value ?? "").trim();
  const normalized = normalizeXlsxLabel(text);
  if (!normalized) return true;
  if (GENERIC_XLSX_VALUE_LABELS.has(normalized)) return true;
  if (isKnownKycFieldLabel(text)) return true;
  return INSTRUCTIONAL_XLSX_VALUE_PATTERNS.some((pattern) => pattern.test(text));
}
function hasUrlLikeValue(value) {
  const text = String(value ?? "").trim();
  return /^(https?:\/\/)?(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+([/?#].*)?$/i.test(text);
}
function hasEmailLikeValue(value) {
  return /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(String(value ?? ""));
}
function hasPhoneLikeValue(value) {
  return /\+?\d[\d\s().-]{6,}\d/.test(String(value ?? ""));
}
function hasMoneyLikeValue(value) {
  const text = String(value ?? "").trim();
  if (/^(n\/a|na|not applicable)$/i.test(text)) return true;
  return /([$]|usd|aed|sar|pkr|inr|eur|gbp|\d[\d,]*(\.\d+)?\s*(k|m|mn|mm|million|billion|bn)?)/i.test(
    text,
  );
}
function hasDurationLikeValue(value) {
  const text = String(value ?? "").trim();
  return (
    /\b\d+\s*(day|days|week|weeks|month|months|year|years|yr|yrs|quarter|quarters|q)\b/i.test(
      text,
    ) ||
    /\b(since|ongoing|annual|annually|monthly|quarterly)\b/i.test(text) ||
    /\b\d{4}\s*[-/]\s*\d{4}\b/.test(text)
  );
}
function hasDateLikeValue(value) {
  const text = String(value ?? "").trim();
  if (excelSerialDateToIso(text)) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return true;
  if (!/(\d|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(text)) return false;
  return !Number.isNaN(Date.parse(text));
}
function hasPersonLikeValue(value) {
  const text = String(value ?? "").trim();
  if (hasEmailLikeValue(text) || hasPhoneLikeValue(text)) return true;
  if (hasDateLikeValue(text) || hasUrlLikeValue(text)) return false;
  if (/\b(date|allocation|time|overlap|sales|project|charter|domain|vertical|information)\b/i.test(text)) {
    return false;
  }
  const words = text.split(/\s+/).filter((word) => /^[A-Za-z][A-Za-z'.-]*$/.test(word));
  return words.length >= 2 && text.length <= 80;
}
function hasMeaningfulTextValue(value, minLength = 4) {
  const text = String(value ?? "").trim();
  if (isGenericXlsxValue(text)) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 1 && text.length < minLength) return false;
  return true;
}
function isValidExtractedValueForField(formKey, value) {
  if (!hasSyncValue(value)) return false;
  const text = String(value).trim();
  if (isGenericXlsxValue(text)) return false;
  switch (formKey) {
    case "accountStatus":
      return hasMeaningfulTextValue(text, 4);
    case "industry":
      return hasMeaningfulTextValue(text, 3) && !/\b(vertical|domain|information)\b/i.test(text);
    case "business":
      return hasMeaningfulTextValue(text, 6) && !/\bdomain describe\b/i.test(text);
    case "history":
      return hasMeaningfulTextValue(text, 12) && text.split(/\s+/).length > 1;
    case "stakeholdersInfo":
      return hasMeaningfulTextValue(text, 3);
    case "revenue":
    case "mrrArr":
      return hasMoneyLikeValue(text);
    case "primary":
      return hasPersonLikeValue(text);
    case "tenure":
    case "contractDuration":
      return hasDurationLikeValue(text);
    case "team": {
      const teamSize = normalizeIntegerSyncValue(text);
      return teamSize !== "" && teamSize > 0 && teamSize <= 100000;
    }
    case "contractRenewalDate":
      return hasDateLikeValue(text);
    case "linkedinUrl":
      return hasUrlLikeValue(text) && /linkedin/i.test(text);
    case "websiteUrl":
      return hasUrlLikeValue(text);
    case "competitors":
      return hasMeaningfulTextValue(text, 3) && !/^(competition|competitors)$/i.test(text);
    case "flow":
      return hasMeaningfulTextValue(text, 8) && !/\bproject objectives\b/i.test(text);
    default:
      return hasMeaningfulTextValue(text);
  }
}
function parseXlsxCellRef(ref) {
  const match = String(ref ?? "")
    .trim()
    .match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;
  const [, letters, rowText] = match;
  let col = 0;
  for (const letter of letters.toUpperCase()) {
    col = col * 26 + (letter.charCodeAt(0) - 64);
  }
  return { row: Number(rowText), col };
}
function getXlsxCellText(cell, sharedStrings) {
  const type = cell.getAttribute("t");
  if (type === "inlineStr") {
    return Array.from(cell.getElementsByTagName("t"))
      .map((node) => node.textContent ?? "")
      .join("");
  }
  const value = cell.getElementsByTagName("v")[0]?.textContent ?? "";
  if (type === "s") return sharedStrings[Number(value)] ?? "";
  if (type === "b") return value === "1" ? "Yes" : "No";
  return value;
}
async function readXlsxSharedStrings(zip) {
  const sharedStringsFile = zip.file("xl/sharedStrings.xml");
  if (!sharedStringsFile) return [];
  const doc = parseXmlString(await sharedStringsFile.async("string"));
  return Array.from(doc.getElementsByTagName("si")).map((item) =>
    Array.from(item.getElementsByTagName("t"))
      .map((node) => node.textContent ?? "")
      .join(""),
  );
}
function parseXlsxWorksheet(xmlText, sharedStrings) {
  const doc = parseXmlString(xmlText);
  const cells = [];
  const byPosition = new Map();
  let maxRow = 0;
  let maxCol = 0;
  Array.from(doc.getElementsByTagName("c")).forEach((cell) => {
    const ref = parseXlsxCellRef(cell.getAttribute("r"));
    if (!ref) return;
    const value = getXlsxCellText(cell, sharedStrings).trim();
    if (!hasSyncValue(value)) return;
    const parsedCell = { ...ref, value };
    cells.push(parsedCell);
    byPosition.set(`${ref.row}:${ref.col}`, parsedCell);
    maxRow = Math.max(maxRow, ref.row);
    maxCol = Math.max(maxCol, ref.col);
  });
  return { cells, byPosition, maxRow, maxCol };
}
function getNearbyXlsxValue(sheet, labelCell, formKey) {
  const candidates = [];
  for (let col = labelCell.col + 1; col <= sheet.maxCol; col += 1) {
    candidates.push(sheet.byPosition.get(`${labelCell.row}:${col}`));
  }
  for (let row = labelCell.row + 1; row <= sheet.maxRow; row += 1) {
    candidates.push(sheet.byPosition.get(`${row}:${labelCell.col}`));
  }
  for (let rowOffset = 1; rowOffset <= 3; rowOffset += 1) {
    for (let colOffset = 1; colOffset <= 4; colOffset += 1) {
      candidates.push(
        sheet.byPosition.get(`${labelCell.row + rowOffset}:${labelCell.col + colOffset}`),
      );
    }
  }
  const match = candidates.find((candidate) => {
    if (!candidate || !hasSyncValue(candidate.value)) return false;
    return isValidExtractedValueForField(formKey, candidate.value);
  });
  return match?.value ?? "";
}
function excelSerialDateToIso(value) {
  const serial = Number(String(value).trim());
  if (!Number.isFinite(serial) || serial < 20_000 || serial > 80_000) return "";
  const utcMs = Math.round((serial - 25569) * 86_400_000);
  const date = new Date(utcMs);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}
function normalizeExtractedXlsxValue(formKey, value) {
  if (!hasSyncValue(value)) return null;
  if (!XLSX_DATE_FORM_FIELDS.has(formKey)) return value;
  return excelSerialDateToIso(value) || value;
}
function findXlsxFieldMatch(sheets, formKey) {
  const aliases = getKycFieldAliases(formKey);
  for (const sheet of sheets) {
    for (const cell of sheet.cells) {
      for (const alias of aliases) {
        const inlineValue = getInlineLabelValue(cell.value, alias);
        if (isValidExtractedValueForField(formKey, inlineValue)) {
          return {
            formKey,
            matchedLabel: alias,
            workbookLabel: cell.value,
            value: normalizeExtractedXlsxValue(formKey, inlineValue),
          };
        }
        if (hasSyncValue(inlineValue) && xlsxLabelsMatch(cell.value.slice(0, alias.length), alias)) {
          return {
            formKey,
            matchedLabel: alias,
            workbookLabel: cell.value,
            value: null,
          };
        }
        if (xlsxLabelsMatch(cell.value, alias)) {
          const nearbyValue = getNearbyXlsxValue(sheet, cell, formKey);
          return {
            formKey,
            matchedLabel: alias,
            workbookLabel: cell.value,
            value: normalizeExtractedXlsxValue(formKey, nearbyValue),
          };
        }
      }
    }
  }
  return null;
}
async function extractKycFieldMatchesFromXlsx(file) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const sharedStrings = await readXlsxSharedStrings(zip);
  const worksheetFiles = zip
    .file(/^xl\/worksheets\/sheet\d+\.xml$/)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (worksheetFiles.length === 0) {
    throw new Error("No worksheets were found in the selected .xlsx file.");
  }
  const sheets = await Promise.all(
    worksheetFiles.map(async (worksheetFile) =>
      parseXlsxWorksheet(await worksheetFile.async("string"), sharedStrings),
    ),
  );
  return KYC_EXTRACTABLE_FIELD_KEYS.map((formKey) => {
    const match = findXlsxFieldMatch(sheets, formKey);
    const field = KYC_FORM_FIELDS[formKey];
    const value = match?.value ?? null;
    const hasValue = hasSyncValue(value);
    const canSaveToDb = field.canSaveToDb !== false && hasValue;
    return {
      id: formKey,
      formKey,
      xlsxLabel: match?.workbookLabel ?? null,
      matchedLabel: match?.matchedLabel ?? field.label,
      formLabel: field.label,
      dbTarget: field.dbTarget,
      isMatched: Boolean(match),
      canAutofill: hasValue,
      canSaveToDb,
      value,
    };
  });
}
function normalizeCharterFieldValue(formKey, value) {
  if (!hasSyncValue(value)) return "";
  if (Array.isArray(value)) {
    return value.filter(hasSyncValue).map(String).join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  if (formKey === "contractRenewalDate") return normalizeDateValue(value);
  if (formKey === "team") {
    const normalized = normalizeIntegerSyncValue(value);
    return Number.isFinite(normalized) ? String(normalized) : String(value).trim();
  }
  return String(value).trim();
}
function formatStakeholdersInfo(stakeholders) {
  const rows = stakeholders ?? [];
  if (rows.length === 0) return "";
  return [
    `${rows.length} stakeholder${rows.length === 1 ? "" : "s"}`,
    ...rows.map((stakeholder) =>
      [stakeholder.name, stakeholder.role, stakeholder.influence]
        .filter(hasSyncValue)
        .join(" - "),
    ),
  ].join("\n");
}
function buildXlsxFieldPatch(currentFields, matches, selectedIds) {
  const selected = new Set(selectedIds);
  const fieldPatch = {};
  (matches ?? []).forEach((match) => {
    if (!selected.has(match.id)) return;
    const { formKey, value } = match;
    if (!formKey || !Object.prototype.hasOwnProperty.call(currentFields, formKey)) {
      return;
    }
    const normalized = normalizeCharterFieldValue(formKey, value);
    if (!hasSyncValue(normalized)) return;
    fieldPatch[formKey] = normalized;
  });
  const nextFields = { ...currentFields };
  const updatedKeys = [];
  Object.entries(fieldPatch).forEach(([formKey, value]) => {
    if (nextFields[formKey] !== value) {
      nextFields[formKey] = value;
      updatedKeys.push(formKey);
    }
  });
  return { fieldPatch, nextFields, selectedKeys: Object.keys(fieldPatch), updatedKeys };
}
function formatDisplayDate(value) {
  const dateText = normalizeDateValue(value);
  if (!dateText) return "—";
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateText;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
function formatSalesforceRegion(account) {
  return [account?.BillingCity, account?.BillingStateCode, account?.BillingCountryCode]
    .filter(hasSyncValue)
    .join(", ");
}
function getPrimarySalesforceContact(contacts) {
  return contacts.find((contact) => contact.Primary_KYC_Contact__c) ?? contacts[0] ?? null;
}
function deriveStakeholderInfluence(contact) {
  if (contact?.Decision_Maker__c) return "Decision Maker";
  if (contact?.Primary_KYC_Contact__c) return "Champion";
  return "Influencer";
}
function findStakeholderForContact(stakeholders, contact) {
  const email = String(contact?.Email ?? "")
    .trim()
    .toLowerCase();
  const name = String(contact?.Name ?? "")
    .trim()
    .toLowerCase();
  return (
    stakeholders.find(
      (stakeholder) =>
        String(stakeholder.email ?? "")
          .trim()
          .toLowerCase() === email && email,
    ) ||
    stakeholders.find(
      (stakeholder) =>
        String(stakeholder.name ?? "")
          .trim()
          .toLowerCase() === name && name,
    ) ||
    null
  );
}
function retentionServiceKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}
function findRetentionGrowthService(retentionGrowth, serviceName) {
  const key = retentionServiceKey(serviceName);
  if (!key) return null;
  return retentionGrowth.find((service) => retentionServiceKey(service.service) === key) ?? null;
}
function finalizeSalesforceRows(rows) {
  return rows.map((row) => {
    const dbValue = row.dbValue ?? row.nextValue;
    const missingRetentionService =
      row.kind === "retentionGrowth" &&
      row.dbColumn !== "service" &&
      !hasSyncValue(row.serviceValue);
    const canSync = hasSyncValue(dbValue) && !missingRetentionService;
    const changed = displaySyncValue(row.destinationValue) !== displaySyncValue(row.nextValue);
    return {
      ...row,
      dbValue,
      canSync,
      defaultSelected: canSync && changed,
    };
  });
}
function buildSalesforceMappingRows(bundle, account, fields) {
  if (!bundle?.found || !bundle.account) return [];
  const sfAccount = bundle.account;
  const contacts = bundle.contacts ?? [];
  const primaryContact = getPrimarySalesforceContact(contacts);
  const primaryContactName = sfAccount.Primary_Contact_Name__c || primaryContact?.Name;
  const primaryContactRole = sfAccount.Primary_Contact_Role__c || primaryContact?.Title;
  const contractType = normalizeContractTypeValue(sfAccount.Contract_Type__c);
  const retentionService = String(sfAccount.Retention_Service__c ?? "").trim();
  const existingRetentionService = findRetentionGrowthService(
    account.retentionGrowth ?? [],
    retentionService,
  );
  const rows = [
    {
      id: "account.industry",
      kind: "account",
      group: "Account / KYC",
      destinationLabel: "Industry Info",
      destinationValue: fields.industry,
      sourceLabel: "Account.Industry",
      sourceValue: sfAccount.Industry,
      nextValue: sfAccount.Industry,
      dbColumn: "industry",
      fieldKey: "industry",
    },
    {
      id: "account.business",
      kind: "account",
      group: "Account / KYC",
      destinationLabel: "Business Info",
      destinationValue: fields.business,
      sourceLabel: "Account business profile",
      sourceValue: joinSyncParts([
        ["Description", sfAccount.Description],
        ["Services Offered", sfAccount.Services_Offered__c],
        ["Target Audience", sfAccount.Target_Audience__c],
        ["Revenue Model", sfAccount.Revenue_Generation_Model__c],
        ["Requested Solution", sfAccount.Requested_Solution__c],
      ]),
      nextValue: joinSyncParts([
        ["Description", sfAccount.Description],
        ["Services Offered", sfAccount.Services_Offered__c],
        ["Target Audience", sfAccount.Target_Audience__c],
        ["Revenue Model", sfAccount.Revenue_Generation_Model__c],
        ["Requested Solution", sfAccount.Requested_Solution__c],
      ]),
      dbColumn: "business_info",
      fieldKey: "business",
    },
    {
      id: "account.linkedinUrl",
      kind: "account",
      group: "Account Details",
      destinationLabel: "LinkedIn URL",
      destinationValue: fields.linkedinUrl,
      sourceLabel: "Account.Company_LinkedIn__c",
      sourceValue: sfAccount.Company_LinkedIn__c,
      nextValue: sfAccount.Company_LinkedIn__c,
      dbColumn: "linkedin_url",
      fieldKey: "linkedinUrl",
    },
    {
      id: "account.websiteUrl",
      kind: "account",
      group: "Account Details",
      destinationLabel: "Website URL",
      destinationValue: fields.websiteUrl,
      sourceLabel: "Account.Website",
      sourceValue: sfAccount.Website,
      nextValue: sfAccount.Website,
      dbColumn: "website_url",
      fieldKey: "websiteUrl",
    },
    {
      id: "account.contractValue",
      kind: "account",
      group: "Contract Details",
      destinationLabel: "Contract Value",
      destinationValue: formatCurrency(account.contractValue),
      sourceLabel: "Account.Contract_Value__c",
      sourceValue: formatSalesforceMoney(sfAccount.Contract_Value__c),
      nextValue: formatSalesforceMoney(sfAccount.Contract_Value__c),
      dbColumn: "contract_value",
      dbValue: normalizeMoneySyncValue(sfAccount.Contract_Value__c),
    },
    {
      id: "account.arr",
      kind: "account",
      group: "Account Details",
      destinationLabel: "ARR",
      destinationValue: formatCurrency(account.arr),
      sourceLabel: "Account.ARR__c",
      sourceValue: formatSalesforceMoney(sfAccount.ARR__c),
      nextValue: formatSalesforceMoney(sfAccount.ARR__c),
      dbColumn: "arr",
      dbValue: normalizeMoneySyncValue(sfAccount.ARR__c),
    },
    {
      id: "account.contractRenewalDate",
      kind: "account",
      group: "Contract Details",
      destinationLabel: "Contract Renewal Date",
      destinationValue: fields.contractRenewalDate,
      sourceLabel: "Account.Contract_Renewal_Date__c",
      sourceValue: normalizeDateValue(sfAccount.Contract_Renewal_Date__c),
      nextValue: normalizeDateValue(sfAccount.Contract_Renewal_Date__c),
      dbColumn: "renewal_date",
      fieldKey: "contractRenewalDate",
    },
    {
      id: "account.contractDuration",
      kind: "account",
      group: "Contract Details",
      destinationLabel: "Contract Duration",
      destinationValue: fields.contractDuration,
      sourceLabel: "Account.Contract_Duration__c",
      sourceValue: sfAccount.Contract_Duration__c,
      nextValue: sfAccount.Contract_Duration__c,
      dbColumn: "contract_duration",
      fieldKey: "contractDuration",
    },
    {
      id: "account.contractType",
      kind: "account",
      group: "Contract Details",
      destinationLabel: "Contract Type",
      destinationValue: account.contractType,
      sourceLabel: "Account.Contract_Type__c",
      sourceValue: sfAccount.Contract_Type__c,
      nextValue: contractType,
      dbColumn: "contract_type",
      dbValue: contractType,
    },
    {
      id: "account.lastTouch",
      kind: "account",
      group: "Account Details",
      destinationLabel: "Last Touch",
      destinationValue: account.lastTouch,
      sourceLabel: "Account.Last_Touch__c",
      sourceValue: sfAccount.Last_Touch__c,
      nextValue: sfAccount.Last_Touch__c,
      dbColumn: "last_touch",
    },
    {
      id: "account.history",
      kind: "account",
      group: "Account / KYC",
      destinationLabel: "Client History Notes",
      destinationValue: fields.history,
      sourceLabel: "Account history notes",
      sourceValue: joinSyncParts([
        ["Previous Communication", sfAccount.Previous_Communication_Needs__c],
        ["Salesforce Usage", sfAccount.Salesforce_Usage_Summary__c],
        ["KYC Research", sfAccount.KYC_Research_Notes__c],
      ]),
      nextValue: joinSyncParts([
        ["Previous Communication", sfAccount.Previous_Communication_Needs__c],
        ["Salesforce Usage", sfAccount.Salesforce_Usage_Summary__c],
        ["KYC Research", sfAccount.KYC_Research_Notes__c],
      ]),
      dbColumn: "client_history",
      fieldKey: "history",
    },
    {
      id: "account.revenue",
      kind: "account",
      group: "Account / KYC",
      destinationLabel: "Revenue Info",
      destinationValue: fields.revenue,
      sourceLabel: "Account.AnnualRevenue / Funding",
      sourceValue: joinSyncParts([
        ["Annual Revenue", formatSalesforceMoney(sfAccount.AnnualRevenue)],
        ["Funding Stage", sfAccount.Funding_Stage__c],
        ["Funding Amount", formatSalesforceMoney(sfAccount.Funding_Amount__c)],
      ]),
      nextValue: joinSyncParts([
        ["Annual Revenue", formatSalesforceMoney(sfAccount.AnnualRevenue)],
        ["Funding Stage", sfAccount.Funding_Stage__c],
        ["Funding Amount", formatSalesforceMoney(sfAccount.Funding_Amount__c)],
      ]),
      dbColumn: "revenue",
      fieldKey: "revenue",
    },
    {
      id: "account.primaryName",
      kind: "account",
      group: "Account / KYC",
      destinationLabel: "Primary Contact",
      destinationValue: fields.primary,
      sourceLabel: "Account.Primary_Contact_Name__c / Primary Contact.Name",
      sourceValue: primaryContactName,
      nextValue: primaryContactName,
      dbColumn: "primary_contact_name",
      fieldKey: "primary",
    },
    {
      id: "account.primaryRole",
      kind: "account",
      group: "Account / KYC",
      destinationLabel: "Primary Contact Role",
      destinationValue: account.primaryContact.role,
      sourceLabel: "Account.Primary_Contact_Role__c / Primary Contact.Title",
      sourceValue: primaryContactRole,
      nextValue: primaryContactRole,
      dbColumn: "primary_contact_role",
    },
    {
      id: "account.region",
      kind: "account",
      group: "Account / KYC",
      destinationLabel: "Region",
      destinationValue: account.region,
      sourceLabel: "Account Billing Location",
      sourceValue: formatSalesforceRegion(sfAccount),
      nextValue: formatSalesforceRegion(sfAccount),
      dbColumn: "region",
    },
    {
      id: "account.employees",
      kind: "account",
      group: "Account / KYC",
      destinationLabel: "Employees",
      destinationValue: account.employees,
      sourceLabel: "Account.NumberOfEmployees",
      sourceValue: sfAccount.NumberOfEmployees,
      nextValue: sfAccount.NumberOfEmployees,
      dbColumn: "employees",
      dbValue: hasSyncValue(sfAccount.NumberOfEmployees) ? String(sfAccount.NumberOfEmployees) : "",
    },
    {
      id: "account.flow",
      kind: "account",
      group: "Account / KYC",
      destinationLabel: "Main Business Flow",
      destinationValue: fields.flow,
      sourceLabel: "Account platform and tech notes",
      sourceValue: joinSyncParts([
        ["Current Salesforce Platform", sfAccount.Current_Salesforce_Platform__c],
        ["Previous Salesforce Platform", sfAccount.Previous_Salesforce_Platform__c],
        ["SaaS Platforms", sfAccount.SaaS_Platforms_Used__c],
        ["Tech Stack Notes", sfAccount.Tech_Stack_Notes__c],
      ]),
      nextValue: joinSyncParts([
        ["Current Salesforce Platform", sfAccount.Current_Salesforce_Platform__c],
        ["Previous Salesforce Platform", sfAccount.Previous_Salesforce_Platform__c],
        ["SaaS Platforms", sfAccount.SaaS_Platforms_Used__c],
        ["Tech Stack Notes", sfAccount.Tech_Stack_Notes__c],
      ]),
      dbColumn: "main_business_flow",
      fieldKey: "flow",
    },
    {
      id: "contract.autoRenew",
      kind: "contract",
      group: "Contract Details",
      destinationLabel: "Auto Renew",
      destinationValue: account.contractScoring?.autoRenew,
      sourceLabel: "Account.Auto_Renew__c",
      sourceValue: sfAccount.Auto_Renew__c,
      nextValue: normalizeBooleanSyncValue(sfAccount.Auto_Renew__c),
      dbColumn: "auto_renew",
      dbValue: normalizeBooleanSyncValue(sfAccount.Auto_Renew__c),
    },
    {
      id: "contract.nonTerminator",
      kind: "contract",
      group: "Contract Details",
      destinationLabel: "Non Terminator",
      destinationValue: account.contractScoring?.nonTerminator,
      sourceLabel: "Account.Non_Terminator__c",
      sourceValue: sfAccount.Non_Terminator__c,
      nextValue: normalizeBooleanSyncValue(sfAccount.Non_Terminator__c),
      dbColumn: "non_terminator",
      dbValue: normalizeBooleanSyncValue(sfAccount.Non_Terminator__c),
    },
    {
      id: "contract.minOneYear",
      kind: "contract",
      group: "Contract Details",
      destinationLabel: "Minimum One Year",
      destinationValue: account.contractScoring?.minOneYear,
      sourceLabel: "Account.Min_One_Year__c",
      sourceValue: sfAccount.Min_One_Year__c,
      nextValue: normalizeBooleanSyncValue(sfAccount.Min_One_Year__c),
      dbColumn: "min_one_year",
      dbValue: normalizeBooleanSyncValue(sfAccount.Min_One_Year__c),
    },
    {
      id: "contract.priceHike",
      kind: "contract",
      group: "Contract Details",
      destinationLabel: "Price Hike",
      destinationValue: account.contractScoring?.priceHike,
      sourceLabel: "Account.Price_Hike__c",
      sourceValue: sfAccount.Price_Hike__c,
      nextValue: sfAccount.Price_Hike__c,
      dbColumn: "price_hike",
    },
    {
      id: "contract.customerFeedback",
      kind: "contract",
      group: "Contract Details",
      destinationLabel: "Customer Feedback",
      destinationValue: account.contractScoring?.customerFeedback,
      sourceLabel: "Account.Customer_Feedback__c",
      sourceValue: sfAccount.Customer_Feedback__c,
      nextValue: sfAccount.Customer_Feedback__c,
      dbColumn: "customer_feedback",
    },
    {
      id: "contract.backupExists",
      kind: "contract",
      group: "Contract Details",
      destinationLabel: "Backup Exists",
      destinationValue: account.resourceHealth?.backupExists,
      sourceLabel: "Account.Backup_Exists__c",
      sourceValue: sfAccount.Backup_Exists__c,
      nextValue: normalizeBooleanSyncValue(sfAccount.Backup_Exists__c),
      dbColumn: "backup_exists",
      dbValue: normalizeBooleanSyncValue(sfAccount.Backup_Exists__c),
    },
    {
      id: "contract.criticalResources",
      kind: "contract",
      group: "Contract Details",
      destinationLabel: "Critical Resources",
      destinationValue: account.resourceHealth?.criticalResources,
      sourceLabel: "Account.Critical_Resources__c",
      sourceValue: sfAccount.Critical_Resources__c,
      nextValue: normalizeIntegerSyncValue(sfAccount.Critical_Resources__c),
      dbColumn: "critical_resources",
      dbValue: normalizeIntegerSyncValue(sfAccount.Critical_Resources__c),
    },
    {
      id: "retention.service",
      kind: "retentionGrowth",
      group: "Retention / Growth",
      destinationLabel: "Service",
      destinationValue: existingRetentionService?.service ?? "",
      sourceLabel: "Account.Retention_Service__c",
      sourceValue: retentionService,
      nextValue: retentionService,
      dbColumn: "service",
      serviceValue: retentionService,
    },
    {
      id: "retention.offered",
      kind: "retentionGrowth",
      group: "Retention / Growth",
      destinationLabel: "Offered",
      destinationValue: existingRetentionService?.offered,
      sourceLabel: "Account.Retention_Service_Offered__c",
      sourceValue: sfAccount.Retention_Service_Offered__c,
      nextValue: normalizeBooleanSyncValue(sfAccount.Retention_Service_Offered__c),
      dbColumn: "offered",
      dbValue: normalizeBooleanSyncValue(sfAccount.Retention_Service_Offered__c),
      serviceValue: retentionService,
    },
    {
      id: "retention.delivered",
      kind: "retentionGrowth",
      group: "Retention / Growth",
      destinationLabel: "Delivered",
      destinationValue: existingRetentionService?.delivered,
      sourceLabel: "Account.Retention_Service_Delivered__c",
      sourceValue: sfAccount.Retention_Service_Delivered__c,
      nextValue: normalizeBooleanSyncValue(sfAccount.Retention_Service_Delivered__c),
      dbColumn: "delivered",
      dbValue: normalizeBooleanSyncValue(sfAccount.Retention_Service_Delivered__c),
      serviceValue: retentionService,
    },
  ];

  contacts.forEach((contact, index) => {
    const existing = findStakeholderForContact(account.stakeholders, contact);
    const contactKey = contact.Id ?? `${index}-${contact.Name}`;
    const group = `Stakeholder: ${contact.Name ?? `Contact ${index + 1}`}`;
    rows.push(
      {
        id: `stakeholder.${contactKey}.name`,
        kind: "stakeholder",
        group,
        destinationLabel: "Stakeholder Name",
        destinationValue: existing?.name ?? "",
        sourceLabel: "Contact.Name",
        sourceValue: contact.Name,
        nextValue: contact.Name,
        contactKey,
        sourceName: contact.Name,
        sourceEmail: contact.Email,
        stakeholderField: "name",
      },
      {
        id: `stakeholder.${contactKey}.role`,
        kind: "stakeholder",
        group,
        destinationLabel: "Stakeholder Role",
        destinationValue: existing?.role ?? "",
        sourceLabel: "Contact.Title",
        sourceValue: contact.Title,
        nextValue: contact.Title,
        contactKey,
        sourceName: contact.Name,
        sourceEmail: contact.Email,
        stakeholderField: "role",
      },
      {
        id: `stakeholder.${contactKey}.email`,
        kind: "stakeholder",
        group,
        destinationLabel: "Stakeholder Email",
        destinationValue: existing?.email ?? "",
        sourceLabel: "Contact.Email",
        sourceValue: contact.Email,
        nextValue: contact.Email,
        contactKey,
        sourceName: contact.Name,
        sourceEmail: contact.Email,
        stakeholderField: "email",
      },
      {
        id: `stakeholder.${contactKey}.influence`,
        kind: "stakeholder",
        group,
        destinationLabel: "Stakeholder Influence",
        destinationValue: existing?.influence ?? "",
        sourceLabel: "Contact.Decision_Maker / Primary_KYC_Contact",
        sourceValue: joinSyncParts([
          ["Decision Maker", contact.Decision_Maker__c],
          ["Primary KYC Contact", contact.Primary_KYC_Contact__c],
          ["Persona", contact.Prospect_Persona__c],
        ]),
        nextValue: deriveStakeholderInfluence(contact),
        contactKey,
        sourceName: contact.Name,
        sourceEmail: contact.Email,
        stakeholderField: "influence",
      },
    );
  });

  return finalizeSalesforceRows(rows);
}
function defaultSalesforceSelection(rows) {
  return Object.fromEntries(rows.map((row) => [row.id, row.defaultSelected]));
}
function buildSalesforceSyncPayload(rows) {
  const accountUpdates = {};
  const contractUpdates = {};
  const retentionGrowthMap = new Map();
  const stakeholderMap = new Map();
  rows.forEach((row) => {
    if (row.kind === "account") {
      accountUpdates[row.dbColumn] = row.dbValue;
      return;
    }
    if (row.kind === "contract") {
      contractUpdates[row.dbColumn] = row.dbValue;
      return;
    }
    if (row.kind === "retentionGrowth") {
      const serviceValue = row.dbColumn === "service" ? row.dbValue : row.serviceValue;
      if (!hasSyncValue(serviceValue)) return;
      const update = retentionGrowthMap.get(serviceValue) ?? {
        service: serviceValue,
        fields: {},
      };
      if (row.dbColumn === "service") {
        update.service = row.dbValue;
      } else {
        update.fields[row.dbColumn] = row.dbValue;
      }
      retentionGrowthMap.set(update.service, update);
      return;
    }
    const existing = stakeholderMap.get(row.contactKey) ?? {
      sourceName: row.sourceName,
      sourceEmail: row.sourceEmail,
      fields: {},
    };
    existing.fields[row.stakeholderField] = row.dbValue;
    stakeholderMap.set(row.contactKey, existing);
  });
  return {
    accountUpdates,
    contractUpdates,
    retentionGrowthUpdates: Array.from(retentionGrowthMap.values()),
    stakeholderUpdates: Array.from(stakeholderMap.values()),
  };
}
function buildSalesforceHistoryRows(rows) {
  return rows.map((row) => ({
    field: `Salesforce sync - ${row.group} / ${row.destinationLabel}`,
    oldValue: displaySyncValue(row.destinationValue),
    newValue: displaySyncValue(row.nextValue),
  }));
}

async function getFreshAccessTokenForSalesforceLookup() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const expiresAtMs = session?.expires_at ? session.expires_at * 1000 : 0;
  const shouldRefresh =
    !session?.access_token || (expiresAtMs > 0 && expiresAtMs - Date.now() < 60_000);

  if (!shouldRefresh) return session.access_token;

  const {
    data: { session: refreshedSession },
    error,
  } = await supabase.auth.refreshSession();
  if (error || !refreshedSession?.access_token) {
    throw new Error("Please sign in again before searching Salesforce.");
  }
  return refreshedSession.access_token;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",").pop() : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read SOW file."));
    reader.readAsDataURL(file);
  });
}

function moneyLabel(value) {
  return Number.isFinite(value) ? formatCurrency(value) : "";
}

function buildSowChanges(account, fields) {
  const changes = [];
  if (fields.accountName && fields.accountName !== account.name) {
    changes.push({
      field: "SOW Account Name",
      oldValue: account.name,
      newValue: fields.accountName,
    });
  }
  if (Number.isFinite(fields.arr) && fields.arr !== account.arr) {
    changes.push({
      field: "SOW ARR",
      oldValue: moneyLabel(account.arr),
      newValue: moneyLabel(fields.arr),
    });
  }
  if (Number.isFinite(fields.contractValue) && fields.contractValue !== account.contractValue) {
    changes.push({
      field: "SOW Contract Value",
      oldValue: moneyLabel(account.contractValue),
      newValue: moneyLabel(fields.contractValue),
    });
  }
  if (fields.renewalDate && fields.renewalDate !== account.contractRenewalDate) {
    changes.push({
      field: "SOW Contract Renewal Date",
      oldValue: formatDisplayDate(account.contractRenewalDate),
      newValue: formatDisplayDate(fields.renewalDate),
    });
  }
  if (fields.contractType && fields.contractType !== account.contractType) {
    changes.push({
      field: "SOW Contract Type",
      oldValue: account.contractType,
      newValue: fields.contractType,
    });
  }
  if (
    fields.contractDuration &&
    fields.contractDuration !== (account.contractDuration || account.contractScoring?.duration)
  ) {
    changes.push({
      field: "SOW Contract Duration",
      oldValue: account.contractDuration || account.contractScoring?.duration || "",
      newValue: fields.contractDuration,
    });
  }
  return changes;
}

function sowSummary(fields) {
  const labels = [];
  if (fields.accountName) labels.push("Account name");
  if (Number.isFinite(fields.arr)) labels.push("ARR");
  if (Number.isFinite(fields.contractValue)) labels.push("Contract value");
  if (fields.renewalDate) labels.push("Renewal date");
  if (fields.contractType) labels.push("Contract type");
  if (fields.contractDuration) labels.push("Duration");
  return labels.length ? labels.join(", ") : "No supported fields";
}

function AccountDetailPage() {
  const { account } = Route.useLoaderData();
  const { profile, session } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const sowInputRef = useRef(null);
  const [tab, setTab] = useState("Overview");
  const [sowMessage, setSowMessage] = useState("");
  const [sowError, setSowError] = useState("");
  const [askAiOpen, setAskAiOpen] = useState(false);
  const { data: accountEscalations = [] } = useQuery({
    queryKey: ["escalations", account.id],
    queryFn: () => fetchEscalations(account.id),
  });
  const { data: accountOpportunities = [] } = useQuery({
    queryKey: ["opportunities", account.id],
    queryFn: () => fetchOpportunities(account.id),
  });
  const role = profile?.role ?? "KAM";
  const perms = getRolePermissions(role);
  const editable = perms.write && (perms.scope === "all" || account.id !== undefined);
  const openWhitespaceCount = (account.retentionGrowth ?? []).filter(
    (service) => service.applicable && !service.offered,
  ).length;
  const { mutate: uploadSow, isPending: uploadingSow } = useMutation({
    mutationFn: async (file) => {
      const contentBase64 = await fileToBase64(file);
      const extracted = await extractSowFields({
        data: {
          fileName: file.name,
          mimeType: file.type,
          contentBase64,
        },
      });
      await applySowFields(account.id, extracted);
      const changes = buildSowChanges(account, extracted);
      if (changes.length > 0) {
        await logAccountChanges(account.id, changes, profile?.name ?? "Unknown");
      }
      return extracted;
    },
    onMutate: () => {
      setSowMessage("");
      setSowError("");
    },
    onSuccess: async (fields) => {
      setSowMessage(`SOW uploaded. Updated: ${sowSummary(fields)}.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["contracts"] }),
        queryClient.invalidateQueries({ queryKey: ["account-history", account.id] }),
      ]);
      await router.invalidate();
    },
    onError: (error) => {
      setSowError(error?.message ?? "Could not upload SOW.");
    },
  });
  function handleSowFile(file) {
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) {
      setSowMessage("");
      setSowError("SOW file must be 12 MB or smaller.");
      return;
    }
    uploadSow(file);
  }
  return (
    <div className="flex flex-col">
      <header className="bg-card border-b flex flex-col md:flex-row md:items-center md:justify-between px-4 md:px-8 py-3 gap-3 sticky top-14 md:top-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/accounts"
            className="size-8 rounded-md border flex items-center justify-center hover:bg-muted transition-colors shrink-0"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-semibold text-base md:text-lg truncate">{account.name}</h1>
              <span className="px-2 py-0.5 rounded bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-wider border border-accent/20">
                {account.tier}
              </span>
              <span className="px-2 py-0.5 rounded bg-muted text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Key Account
              </span>
            </div>
            <p className="text-[11px] md:text-xs text-muted-foreground truncate">
              {account.industry} - {account.region} - {account.engagementTenure} tenure
            </p>
          </div>
        </div>
        <div className="flex gap-3 items-center justify-end">
          {!editable && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
              <Lock className="size-3" /> Read-only ({role})
            </span>
          )}
          <button
            onClick={() => setAskAiOpen(true)}
            className="px-3 py-2 bg-accent text-white text-xs font-bold rounded-md hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <Sparkles className="size-3.5" />
            Ask AI
          </button>
          <div className="flex flex-col items-end gap-1">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <input
                ref={sowInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.txt,.md,.rtf"
                onChange={(event) => {
                  handleSowFile(event.target.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => sowInputRef.current?.click()}
                disabled={!editable || uploadingSow}
                className="hidden px-3 py-2 border text-xs font-semibold rounded-md hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed items-center gap-2"
              >
                {uploadingSow ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Upload className="size-3" />
                )}
                {uploadingSow ? "Uploading SOW" : "Upload SOW"}
              </button>
              <button
                disabled={!editable}
                className="px-3 py-2 border text-xs font-semibold rounded-md hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Log Activity
              </button>
            </div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Last sync with Jira - 4m ago
            </p>
            {(sowMessage || sowError) && (
              <p
                className={`text-[11px] max-w-[28rem] text-right ${
                  sowError ? "text-crit" : "text-success"
                }`}
              >
                {sowError || sowMessage}
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="px-4 md:px-8 max-w-7xl w-full mx-auto">
        {/* Snapshot */}
        <section className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-8">
          <div className="bg-card p-6 rounded-xl border shadow-sm lg:col-span-1 flex flex-col items-center text-center">
            <div className="relative size-32 flex items-center justify-center mb-3">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="oklch(0.929 0.013 255)"
                  strokeWidth="10"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="oklch(0.7 0.17 152)"
                  strokeWidth="10"
                  strokeDasharray={`${(account.health / 100) * 264} 264`}
                  strokeLinecap="round"
                />
              </svg>
              <div>
                <div className="text-3xl font-bold">{account.health}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                  Health
                </div>
              </div>
            </div>
            <span
              className={`text-xs font-medium ${account.trend >= 0 ? "text-success" : "text-crit"} flex items-center gap-1`}
            >
              {account.trend >= 0 ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              {account.trend >= 0 ? "+" : ""}
              {account.trend}% this quarter
            </span>
          </div>

          <div className="bg-card p-6 rounded-xl border shadow-sm">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">
              Contract Value
            </p>
            <span className="text-3xl font-bold">{formatCurrency(account.contractValue)}</span>
            <p className="text-xs text-muted-foreground mt-2">
              {account.contractRenewalDate
                ? `Renews ${formatDisplayDate(account.contractRenewalDate)}`
                : "Renewal date not set"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">{account.contractType}</p>
          </div>

          <div className="bg-card p-6 rounded-xl border shadow-sm">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">
              Retention Risk
            </p>
            <span
              className={`text-3xl font-bold uppercase ${
                account.retentionRisk === "Low"
                  ? "text-success"
                  : account.retentionRisk === "Medium"
                    ? "text-warn"
                    : "text-crit"
              }`}
            >
              {account.retentionRisk}
            </span>
            <p className="text-xs text-muted-foreground mt-2">
              CSAT {account.csat.score.toFixed(1)}/10
            </p>
          </div>

          <div className="bg-card p-6 rounded-xl border shadow-sm">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">
              Growth Upside
            </p>
            <span className="text-3xl font-bold text-accent">
              {formatCurrency(account.growthPipelineValue)}
            </span>
            <p className="text-xs text-muted-foreground mt-2">
              {openWhitespaceCount} open white-space{" "}
              {openWhitespaceCount === 1 ? "service" : "services"}
            </p>
          </div>
        </section>

        {/* Tabs */}
        <nav className="flex border-b mt-8 gap-6 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 text-sm font-medium whitespace-nowrap transition-colors ${tab === t ? "text-accent border-b-2 border-accent" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t}
            </button>
          ))}
        </nav>

        <div className="py-8 pb-16">
          {tab === "Overview" && <OverviewTab account={account} />}
          {tab === "Score Marking Matrices" && <ScoreMatricsTab account={account} />}
          {tab === "Activity to Increase Score" && (
            <ActivityTab
              account={account}
              opportunities={accountOpportunities}
              escalations={accountEscalations}
              session={session}
            />
          )}
          {tab === "Opportunities" && (
            <OpportunitiesTab
              account={account}
              opportunities={accountOpportunities}
              escalations={accountEscalations}
            />
          )}
          {tab === "Retention VS Growth" && (
            <RetentionGrowthTab
              account={account}
              opportunities={accountOpportunities}
              escalations={accountEscalations}
            />
          )}
          {tab === "Educate client" && <EducateTab account={account} />}
          {tab === "Escalation" && <EscalationsTab list={accountEscalations} />}
          {tab === "Meeting History" && (
            <MeetingHistoryTab account={account} profile={profile} session={session} />
          )}
          {tab === "Client History" && (
            <ClientHistoryTab accountId={account.id} accountName={account.name} />
          )}
        </div>
      </div>
      <AskAiDrawer
        account={account}
        open={askAiOpen}
        onClose={() => setAskAiOpen(false)}
        profile={profile}
      />
    </div>
  );
}
function AskAiDrawer({ account, open, onClose, profile }) {
  const askAi = useServerFn(askAccountAi);
  const [question, setQuestion] = useState("Draft a 30-day roadmap for this account.");
  const [result, setResult] = useState(null);
  const prompts = [
    "What is the biggest retention risk for this client?",
    "Draft a 30-day roadmap for this account.",
    "What should I do before renewal?",
    "Which growth opportunities should I prioritize?",
    "Summarize this account for leadership.",
  ];
  const {
    mutate: runAi,
    isPending,
    error,
  } = useMutation({
    mutationFn: async () =>
      askAi({
        data: {
          scope: "account",
          accountId: account.id,
          question,
          user: {
            id: profile?.id,
            name: profile?.name,
            role: profile?.role,
          },
        },
      }),
    onSuccess: setResult,
  });

  useEffect(() => {
    if (!open) return;
    setResult(null);
  }, [open, account.id]);

  if (!open) return null;

  return (
    <>
      <button
        aria-label="Close Ask AI"
        className="fixed inset-0 z-40 bg-black/45"
        onClick={onClose}
      />
      <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-xl bg-card border-l shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="size-8 rounded-md bg-accent/10 text-accent flex items-center justify-center">
                <Sparkles className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold">Ask AI</h2>
                <p className="text-[11px] text-muted-foreground">{account.name}</p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-md border flex items-center justify-center hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Suggested prompts
            </p>
            <div className="flex flex-wrap gap-2">
              {prompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setQuestion(prompt)}
                  className="px-2.5 py-1.5 text-[11px] border rounded-md hover:bg-muted transition-colors text-left"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <label className="space-y-2 block">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Question
            </span>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={4}
              className="w-full rounded-lg border bg-background p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Ask about risk, renewal, growth, stakeholders, or next actions..."
            />
          </label>

          <button
            onClick={() => runAi()}
            disabled={isPending || !question.trim()}
            className="w-full h-10 rounded-md bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {isPending ? "Analyzing account" : "Generate recommendations"}
          </button>

          {error && (
            <div className="border border-crit/30 bg-crit/10 text-crit rounded-lg p-3 text-xs">
              {error.message}
            </div>
          )}

          {result && <AiAnswer result={result} />}
        </div>
      </aside>
    </>
  );
}
function AiAnswer({ result }) {
  const riskColor =
    result.riskLevel === "critical"
      ? "text-crit bg-crit/10 border-crit/20"
      : result.riskLevel === "high"
        ? "text-crit bg-crit/10 border-crit/20"
        : result.riskLevel === "medium"
          ? "text-warn bg-warn/10 border-warn/20"
          : "text-success bg-success/10 border-success/20";

  return (
    <div className="space-y-4">
      <div className="border rounded-xl p-4 bg-background">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              AI summary
            </p>
            <p className="text-sm mt-1 leading-relaxed">{result.summary}</p>
          </div>
          <span
            className={`px-2 py-1 rounded border text-[10px] uppercase font-bold shrink-0 ${riskColor}`}
          >
            {result.riskLevel}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
          <span className="font-mono uppercase">Source: {result.source}</span>
          <span className="font-mono uppercase">
            Confidence: {Math.round((result.confidence ?? 0) * 100)}%
          </span>
        </div>
      </div>

      <AiList title="Risks" items={result.risks} empty="No major risks returned." />
      <AiList
        title="Opportunities"
        items={result.opportunities}
        empty="No opportunities returned."
      />
      <AiList
        title="Recommendations"
        items={result.recommendations}
        empty="No recommendations returned."
      />

      <div className="border rounded-xl p-4 bg-background">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
          Roadmap
        </h3>
        <div className="space-y-3">
          {result.roadmap?.map((phase) => (
            <div key={phase.phase} className="border rounded-lg p-3">
              <p className="text-sm font-bold">{phase.phase}</p>
              <ul className="mt-2 space-y-1.5">
                {(phase.actions ?? []).map((action) => (
                  <li key={action} className="text-xs flex gap-2">
                    <CheckCircle2 className="size-3.5 text-success shrink-0 mt-0.5" />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {result.followUpQuestions?.length > 0 && (
        <div className="border rounded-xl p-4 bg-background">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Follow-up questions
          </h3>
          <ul className="space-y-1.5">
            {result.followUpQuestions.map((q) => (
              <li key={q} className="text-xs flex gap-2">
                <Lightbulb className="size-3.5 text-accent shrink-0 mt-0.5" />
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
function AiList({ title, items, empty }) {
  return (
    <div className="border rounded-xl p-4 bg-background">
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
        {title}
      </h3>
      {items?.length ? (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={`${item.title}-${item.evidence}`}
              className="border-l-2 border-accent/40 pl-3"
            >
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {item.evidence ?? item.potential ?? item.timeframe ?? ""}
              </p>
              {(item.owner || item.timeframe || item.severity || item.potential) && (
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mt-1">
                  {[item.severity, item.potential, item.owner, item.timeframe]
                    .filter(Boolean)
                    .join(" / ")}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}
function RetentionGrowthTabPlanner({ account, opportunities, escalations, profile }) {
  const role = profile?.role ?? "KAM";
  const isAssignedKam = role === "KAM" ? account.assignedKamId === profile?.id : false;
  const canAct = role === "Head of KAM" || (role === "KAM" && isAssignedKam);
  const canApproveCommercial = role === "Head of KAM";
  const isViewOnly = role === "CEO" || (role === "KAM" && !isAssignedKam);
  const model = useMemo(
    () => buildRetentionGrowthTabModel({ account, opportunities, escalations }),
    [account, escalations, opportunities],
  );
  const queryClient = useQueryClient();
  const loadRetentionGrowthDrafts = useServerFn(fetchRetentionGrowthDraftsServer);
  const saveRetentionGrowthDraftServer = useServerFn(upsertRetentionGrowthDraftServer);
  const { mutate: refreshRetentionGrowthScoring } = useMutation({
    mutationFn: () => refreshAccountRetentionGrowthScoring(account.id, profile?.name ?? "System"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account-history", account.id] });
    },
  });
  const { data: savedDrafts = [] } = useQuery({
    queryKey: ["retention-growth-drafts", account.id],
    queryFn: () => loadRetentionGrowthDrafts({ data: { accountId: account.id } }),
  });
  const [resolvedItems, setResolvedItems] = useState({});
  const [localDrafts, setLocalDrafts] = useState([]);
  const [draftSaveStatus, setDraftSaveStatus] = useState("");
  const [planTarget, setPlanTarget] = useState(null);
  const [planForm, setPlanForm] = useState(createInitialReviewForm(null, profile?.name));
  const [offerTarget, setOfferTarget] = useState(null);
  const [offerForm, setOfferForm] = useState(createInitialReviewForm(null, profile?.name));
  const [evidenceTarget, setEvidenceTarget] = useState(null);
  const [draftActionId, setDraftActionId] = useState("");
  const scoringTriggeredForAccountRef = useRef(null);

  function storeRetentionGrowthDraftInCache(draft) {
    if (!draft?.id) return;
    setLocalDrafts((current) => current.filter((item) => item.id !== draft.id));
    queryClient.setQueryData(["retention-growth-drafts", account.id], (current = []) =>
      dedupeRetentionDrafts([draft, ...current]),
    );
  }

  const { mutate: saveRetentionGrowthDraft, isPending: savingRetentionGrowthDraft } = useMutation({
    mutationFn: (draft) =>
      saveRetentionGrowthDraftServer({
        data: {
          accountId: account.id,
          draft,
          createdBy: profile?.name,
        },
      }),
    onMutate: () => {
      setDraftSaveStatus("Submitting draft for Head of KAM approval...");
    },
    onSuccess: (savedDraft) => {
      storeRetentionGrowthDraftInCache(savedDraft);
      setDraftSaveStatus("Draft submitted to Head of KAM for approval.");
      queryClient.invalidateQueries({ queryKey: ["retention-growth-drafts", account.id] });
      queryClient.invalidateQueries({ queryKey: ["account-history", account.id] });
    },
    onError: (error, draft) => {
      setLocalDrafts((current) => dedupeRetentionDrafts([draft, ...current]));
      setDraftSaveStatus(
        `Draft kept for this session only. Run add-retention-growth-drafts.sql to persist it. ${error.message}`,
      );
    },
  });
  const { mutate: convertRetentionGrowthDraftToAction, isPending: convertingRetentionGrowthDraft } =
    useMutation({
      mutationFn: async ({ draft, sourceItemId }) => {
        let duplicateAction = false;
        try {
          await createAccountActionItemTask(buildRetentionGrowthActionItemInput(account, draft));
        } catch (error) {
          if (!/already exists/i.test(error?.message ?? "")) throw error;
          duplicateAction = true;
        }

        const convertedDraft = {
          ...draft,
          approvalState: RETENTION_DRAFT_STATE_CONVERTED,
        };
        let savedDraft = convertedDraft;
        let persistenceError = "";

        try {
          savedDraft = await saveRetentionGrowthDraftServer({
            data: {
              accountId: account.id,
              draft: convertedDraft,
              createdBy: profile?.name,
            },
          });
        } catch (error) {
          persistenceError = error?.message ?? "Draft state could not be persisted.";
        }

        return { draft: savedDraft, duplicateAction, persistenceError, sourceItemId };
      },
      onMutate: ({ draft }) => {
        setDraftActionId(draft.id);
        setDraftSaveStatus("Adding this plan to My Open Action Items...");
      },
      onSuccess: ({ draft, duplicateAction, persistenceError, sourceItemId }) => {
        storeRetentionGrowthDraftInCache(draft);
        const resolvedId = sourceItemId ?? getRetentionDraftSourceId(draft);
        if (resolvedId) {
          setResolvedItems((current) => ({
            ...current,
            [resolvedId]: {
              status: "saved",
              reviewedAt: new Date().toISOString(),
            },
          }));
        }
        setDraftSaveStatus(
          duplicateAction
            ? `"${draft.title}" already exists in My Open Action Items, so the draft was removed.`
            : `Added "${draft.title}" to My Open Action Items on the dashboard.`,
        );
        if (persistenceError) {
          setDraftSaveStatus((current) => `${current} Draft state was kept locally only.`);
        } else {
          queryClient.invalidateQueries({ queryKey: ["retention-growth-drafts", account.id] });
        }
        queryClient.invalidateQueries({ queryKey: ["dashboard-action-items"] });
        queryClient.invalidateQueries({ queryKey: ["account-open-action-items", account.id] });
      },
      onError: (error) => {
        setDraftSaveStatus(error?.message ?? "Could not add this draft to action items.");
      },
      onSettled: () => {
        setDraftActionId("");
      },
    });
  const { mutate: rejectRetentionGrowthDraft, isPending: rejectingRetentionGrowthDraft } =
    useMutation({
      mutationFn: async (draft) => {
        const rejectedDraft = {
          ...draft,
          approvalState: RETENTION_DRAFT_STATE_REJECTED,
        };
        let savedDraft = rejectedDraft;
        let persistenceError = "";

        try {
          savedDraft = await saveRetentionGrowthDraftServer({
            data: {
              accountId: account.id,
              draft: rejectedDraft,
              createdBy: profile?.name,
            },
          });
        } catch (error) {
          persistenceError = error?.message ?? "Draft rejection could not be persisted.";
        }

        return { draft: savedDraft, persistenceError };
      },
      onMutate: (draft) => {
        setDraftActionId(draft.id);
        setDraftSaveStatus("");
      },
      onSuccess: ({ draft, persistenceError }) => {
        storeRetentionGrowthDraftInCache(draft);
        const resolvedId = getRetentionDraftSourceId(draft);
        if (resolvedId) {
          setResolvedItems((current) => ({
            ...current,
            [resolvedId]: {
              status: "rejected",
              reviewedAt: new Date().toISOString(),
            },
          }));
        }
        setDraftSaveStatus(`Rejected "${draft.title}" and removed it from Draft Plans & Offers.`);
        if (persistenceError) {
          setDraftSaveStatus((current) => `${current} Rejection was kept locally only.`);
        } else {
          queryClient.invalidateQueries({ queryKey: ["retention-growth-drafts", account.id] });
        }
      },
      onError: (error) => {
        setDraftSaveStatus(error?.message ?? "Could not reject this draft.");
      },
      onSettled: () => {
        setDraftActionId("");
      },
    });

  useEffect(() => {
    setResolvedItems({});
    setLocalDrafts([]);
    setDraftSaveStatus("");
    setPlanTarget(null);
    setPlanForm(createInitialReviewForm(null, profile?.name));
    setOfferTarget(null);
    setOfferForm(createInitialReviewForm(null, profile?.name));
    setEvidenceTarget(null);
    setDraftActionId("");
  }, [account.id, profile?.name]);

  useEffect(() => {
    if (scoringTriggeredForAccountRef.current === account.id) return;
    scoringTriggeredForAccountRef.current = account.id;
    refreshRetentionGrowthScoring();
  }, [account.id, refreshRetentionGrowthScoring]);

  const allRetentionGrowthDrafts = useMemo(
    () => sortRetentionDrafts(dedupeRetentionDrafts([...localDrafts, ...savedDrafts])),
    [localDrafts, savedDrafts],
  );
  const draftQueue = useMemo(
    () => allRetentionGrowthDrafts.filter((draft) => !isTerminalRetentionDraft(draft)),
    [allRetentionGrowthDrafts],
  );
  const draftedItemIds = useMemo(
    () => new Set(allRetentionGrowthDrafts.map(getRetentionDraftSourceId).filter(Boolean)),
    [allRetentionGrowthDrafts],
  );
  const activeApplicableGrowth = model.applicableGrowth.filter(
    (item) => !resolvedItems[item.id] && !draftedItemIds.has(item.id),
  );
  const activeOffers = model.recommendedOffers.filter(
    (item) => !resolvedItems[item.id] && !draftedItemIds.has(item.id),
  );
  const dashboard = model.dashboard;
  const actionOwner =
    role === "KAM" && isAssignedKam ? (profile?.name ?? "Assigned KAM") : "Assigned KAM";

  function openPlanReview(kind, item) {
    setPlanTarget({ kind, item });
    setPlanForm(createInitialReviewForm(item, profile?.name));
  }

  function closePlanReview() {
    setPlanTarget(null);
    setPlanForm(createInitialReviewForm(null, profile?.name));
  }

  function confirmPlanReview() {
    if (!planTarget) return;
    const draft = buildRetentionPlanDraft(planTarget, planForm, canApproveCommercial);
    if (canApproveCommercial) {
      convertRetentionGrowthDraftToAction({ draft, sourceItemId: planTarget.item.id });
      closePlanReview();
      return;
    }
    setLocalDrafts((current) => dedupeRetentionDrafts([draft, ...current]));
    saveRetentionGrowthDraft(draft);
    setResolvedItems((current) => ({
      ...current,
      [planTarget.item.id]: {
        status: "pending-approval",
        reviewedAt: new Date().toISOString(),
      },
    }));
    closePlanReview();
  }

  function openOfferReview(item) {
    setOfferTarget(item);
    setOfferForm(createInitialReviewForm(item, profile?.name));
  }

  function closeOfferReview() {
    setOfferTarget(null);
    setOfferForm(createInitialReviewForm(null, profile?.name));
  }

  function confirmOfferReview() {
    if (!offerTarget) return;
    const draft = buildRetentionOfferDraft(offerTarget, offerForm, canApproveCommercial);
    if (canApproveCommercial) {
      convertRetentionGrowthDraftToAction({ draft, sourceItemId: offerTarget.id });
      closeOfferReview();
      return;
    }
    setLocalDrafts((current) => dedupeRetentionDrafts([draft, ...current]));
    saveRetentionGrowthDraft(draft);
    setResolvedItems((current) => ({
      ...current,
      [offerTarget.id]: {
        status: "pending-approval",
        reviewedAt: new Date().toISOString(),
      },
    }));
    closeOfferReview();
  }

  return (
    <div className="space-y-6">
      {isViewOnly && (
        <div className="rounded-xl border border-warn/30 bg-warn/5 px-4 py-3 text-sm">
          <p className="font-semibold text-warn">View-only planning surface</p>
          <p className="text-[12px] text-muted-foreground mt-1">
            {role === "CEO"
              ? "CEO can inspect services, opportunities, signals, and evidence here but cannot plan or draft offers."
              : "Only the assigned KAM can plan pitches or create draft offers for this account."}
          </p>
        </div>
      )}

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b">
          <p className="text-[10px] font-bold uppercase tracking-widest text-accent">
            Retention vs Growth Dashboard
          </p>
          <h3 className="text-base font-bold mt-1">
            Protect existing revenue and prioritize expansion for {account.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            This view separates revenue-protection signals from expansion signals, then converts
            them into the next best account action.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3 p-6">
          {dashboard.kpis.map((kpi) => (
            <DashboardKpiCard key={kpi.label} label={kpi.label} value={kpi.value} hint={kpi.hint} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr,0.85fr] gap-6">
        <RetentionGrowthDisclosure
          title="Retention vs Growth Matrix"
          description="Bubble placement shows whether this account should be protected, expanded, maintained, or monitored."
          defaultOpen
        >
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <p className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                High Growth Potential
              </p>
              <div className="grid grid-cols-[24px_minmax(0,1fr)_24px] items-center gap-3">
                <div
                  className="flex h-[320px] items-center justify-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground sm:h-[360px]"
                  style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                >
                  Retention Risk High
                </div>
                <div className="relative h-[320px] min-w-0 overflow-hidden rounded-xl border bg-muted/10 sm:h-[360px]">
                  <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 text-xs">
                    <div className="border-r border-b bg-warn/5 p-4 sm:p-5">
                      <p className="font-bold">Protect & Recover</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        High risk, high growth value
                      </p>
                    </div>
                    <div className="border-b bg-success/5 p-4 sm:p-5">
                      <p className="font-bold">Expand Aggressively</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Healthy and high potential
                      </p>
                    </div>
                    <div className="border-r bg-muted/20 p-4 sm:p-5">
                      <p className="font-bold">Reassess / Monitor</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        High risk, low growth
                      </p>
                    </div>
                    <div className="bg-accent/5 p-4 sm:p-5">
                      <p className="font-bold">Maintain & Nurture</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Stable but low expansion
                      </p>
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-1/2 top-0 w-px bg-border" />
                  <div className="absolute left-0 right-0 top-1/2 h-px bg-border" />
                  <div
                    className="absolute z-20 min-w-[150px] max-w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-background bg-primary px-4 py-3 text-center text-primary-foreground shadow-lg"
                    style={{
                      left: `${dashboard.matrix.x}%`,
                      top: `${dashboard.matrix.y}%`,
                    }}
                  >
                    <p className="text-xs font-bold leading-tight">{account.name}</p>
                    <p className="mt-1 text-[10px] opacity-80">
                      {dashboard.retentionScore}/100 retention - {dashboard.growthScore}/100 growth
                    </p>
                  </div>
                </div>
                <div
                  className="flex h-[320px] items-center justify-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground sm:h-[360px]"
                  style={{ writingMode: "vertical-rl" }}
                >
                  Retention Risk Low
                </div>
              </div>
              <p className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Low Growth Potential
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-3 text-xs">
              <MiniStat label="Quadrant" value={dashboard.matrix.quadrant} />
              <MiniStat label="Why" value={dashboard.matrix.description} />
              <MiniStat label="Next move" value={dashboard.matrix.recommendedAction} />
            </div>
          </div>
        </RetentionGrowthDisclosure>

        <div className="grid gap-6">
          <RetentionGrowthDisclosure
            title="Retention Insights"
            description="Renewal, churn, sentiment, escalation, and revenue-at-risk view."
            defaultOpen
          >
            <div className="p-6 grid gap-3">
              {dashboard.retentionInsights.map((item) => (
                <MiniStat key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
          </RetentionGrowthDisclosure>

          <RetentionGrowthDisclosure
            title="Growth Insights"
            description="Whitespace, offer, stakeholder, and expansion-readiness view."
          >
            <div className="p-6 grid gap-3">
              {dashboard.growthInsights.map((item) => (
                <MiniStat key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
          </RetentionGrowthDisclosure>
        </div>
      </div>

      <RetentionGrowthDisclosure
        title="Account Action Table"
        description="Data becomes useful here: each row links the account signal to owner, revenue impact, and next action."
        meta={`${dashboard.actionRows.length} actions`}
        defaultOpen
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b">
                <th className="px-6 py-3">Focus</th>
                <th className="px-6 py-3">Account</th>
                <th className="px-6 py-3">Owner</th>
                <th className="px-6 py-3">Score</th>
                <th className="px-6 py-3">Risk / Potential</th>
                <th className="px-6 py-3">Revenue Impact</th>
                <th className="px-6 py-3">Recommended Action</th>
                <th className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {dashboard.actionRows.map((row) => (
                <tr key={row.id} className="align-top hover:bg-muted/20">
                  <td className="px-6 py-4 text-xs font-semibold">{row.focus}</td>
                  <td className="px-6 py-4 text-xs">
                    <p className="font-semibold">{account.name}</p>
                    <p className="text-[11px] text-muted-foreground">{account.tier}</p>
                  </td>
                  <td className="px-6 py-4 text-xs text-muted-foreground">{actionOwner}</td>
                  <td className="px-6 py-4 text-xs font-semibold">{row.score}/100</td>
                  <td className="px-6 py-4 text-xs">{row.risk}</td>
                  <td className="px-6 py-4 text-xs font-semibold">{row.revenueImpact}</td>
                  <td className="px-6 py-4 text-xs min-w-[260px]">{row.recommendedAction}</td>
                  <td className="px-6 py-4 text-xs">
                    <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </RetentionGrowthDisclosure>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RetentionGrowthDisclosure
          title="What we are offering & giving"
          description={`Services already live, in flight, offered, or actively delivered for ${account.name}.`}
          meta={`${model.currentServices.length} tracked`}
          className="h-full"
        >
          {model.currentServices.length ? (
            <div className="divide-y">
              {model.currentServices.map((service) => (
                <div key={service.id} className="px-6 py-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{service.service}</p>
                    <ServiceStatusBadge status={service.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">{service.description}</p>
                  <MiniStat label="Tracking note" value={service.trackingNote} />
                  <EvidencePreview
                    evidence={service.evidence}
                    onView={() =>
                      setEvidenceTarget({
                        title: service.service,
                        subtitle: `${service.status} service context`,
                        evidence: service.evidence,
                      })
                    }
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="px-6 py-6 text-xs text-muted-foreground">
              No current services are mapped for this account.
            </p>
          )}
        </RetentionGrowthDisclosure>

        <RetentionGrowthDisclosure
          title="Growth - applicable but not offered"
          description="Relevant services and whitespace opportunities that fit this client now."
          meta={`${activeApplicableGrowth.length} open`}
          defaultOpen={activeApplicableGrowth.length > 0}
          className="h-full"
        >
          {activeApplicableGrowth.length ? (
            <div className="divide-y">
              {activeApplicableGrowth.map((item) => (
                <div key={item.id} className="px-6 py-4 space-y-3">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{item.service}</p>
                        <OfferTypeBadge type={item.offerType} />
                        <ConfidenceBadge confidence={item.confidence} />
                      </div>
                      <p className="text-xs text-muted-foreground">{item.reason}</p>
                      <div className="grid sm:grid-cols-2 gap-3 text-xs">
                        <MiniStat label="Potential value" value={getPotentialValueLabel(item)} />
                        <MiniStat label="Next step" value={item.nextStep} />
                      </div>
                      <EvidencePreview
                        evidence={item.evidence}
                        onView={() =>
                          setEvidenceTarget({
                            title: item.service,
                            subtitle: "Applicable but not offered",
                            evidence: item.evidence,
                          })
                        }
                      />
                    </div>
                    <div className="shrink-0">
                      <Button
                        size="sm"
                        disabled={!canAct}
                        onClick={() => openPlanReview("growth", item)}
                      >
                        Plan Pitch
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-6 py-6 text-xs text-muted-foreground">
              No applicable whitespace services are active for this account right now.
            </p>
          )}
        </RetentionGrowthDisclosure>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <RetentionGrowthDisclosure
          title="Retention signals"
          description="Signals that can affect renewal confidence, recovery planning, or client risk."
          meta={`${model.retentionSignals.length} signals`}
          defaultOpen={model.retentionSignals.length > 0}
          className="h-full"
        >
          {model.retentionSignals.length ? (
            <div className="divide-y">
              {model.retentionSignals.map((signal) => (
                <div key={signal.id} className="px-6 py-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{signal.title}</p>
                    <SignalLevelBadge level={signal.level} tone="risk" />
                  </div>
                  <p className="text-xs text-muted-foreground">{signal.reason}</p>
                  <MiniStat label="Recommended action" value={signal.recommendedAction} />
                  <EvidencePreview
                    evidence={signal.evidence}
                    onView={() =>
                      setEvidenceTarget({
                        title: signal.title,
                        subtitle: "Retention signal",
                        evidence: signal.evidence,
                      })
                    }
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="px-6 py-6 text-xs text-muted-foreground">
              No material retention signals are active right now.
            </p>
          )}
        </RetentionGrowthDisclosure>

        <RetentionGrowthDisclosure
          title="Growth signals"
          description="Signals that point to expansion, whitespace, budget, or stakeholder interest."
          meta={`${model.growthSignals.length} signals`}
          defaultOpen={model.growthSignals.length > 0}
          className="h-full"
        >
          {model.growthSignals.length ? (
            <div className="divide-y">
              {model.growthSignals.map((signal) => (
                <div key={signal.id} className="px-6 py-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{signal.title}</p>
                    <SignalLevelBadge level={signal.level} tone="growth" />
                  </div>
                  <p className="text-xs text-muted-foreground">{signal.reason}</p>
                  <MiniStat label="Recommended action" value={signal.recommendedAction} />
                  <EvidencePreview
                    evidence={signal.evidence}
                    onView={() =>
                      setEvidenceTarget({
                        title: signal.title,
                        subtitle: "Growth signal",
                        evidence: signal.evidence,
                      })
                    }
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="px-6 py-6 text-xs text-muted-foreground">
              No material growth signals are active right now.
            </p>
          )}
        </RetentionGrowthDisclosure>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <RetentionGrowthDisclosure
          title="Recommended Offers"
          description="Offers built from whitespace, client interest, retention signals, and current service context."
          meta={`${activeOffers.length} active`}
          defaultOpen={activeOffers.length > 0}
          className="h-full"
        >
          {activeOffers.length ? (
            <div className="divide-y">
              {activeOffers.map((offer) => (
                <div key={offer.id} className="px-6 py-4 space-y-3">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{offer.title}</p>
                        <OfferTypeBadge type={offer.offerType} />
                        <ConfidenceBadge confidence={offer.confidence} />
                        <ApprovalPill
                          required={offer.approvalRequired}
                          approverRole={offer.approverRole}
                          viewerRole={role}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{offer.reason}</p>
                      <div className="grid sm:grid-cols-3 gap-3 text-xs">
                        <MiniStat label="Potential value" value={getPotentialValueLabel(offer)} />
                        <MiniStat label="Allowed offer" value={offer.allowedValue} />
                        <MiniStat label="Next step" value={offer.nextStep} />
                      </div>
                      <EvidencePreview
                        evidence={offer.evidence}
                        onView={() =>
                          setEvidenceTarget({
                            title: offer.title,
                            subtitle: `${offer.offerType} offer`,
                            evidence: offer.evidence,
                          })
                        }
                      />
                    </div>
                    <div className="shrink-0">
                      <Button size="sm" disabled={!canAct} onClick={() => openOfferReview(offer)}>
                        {canApproveCommercial ? "Add Action Item" : "Create Draft Offer"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-6 py-6 text-xs text-muted-foreground">
              No recommended offers are active for this account right now.
            </p>
          )}
        </RetentionGrowthDisclosure>

      </div>

      <RetentionGrowthDisclosure
        title="Draft Plans & Offers"
        description="Review-ready drafts created from whitespace, opportunities, and recommended offers."
        meta={`${draftQueue.length} drafts`}
        defaultOpen={draftQueue.length > 0}
      >
        {draftSaveStatus && (
          <div className="border-b px-6 py-3 text-[11px] font-medium text-muted-foreground">
            {draftSaveStatus}
          </div>
        )}
        {draftQueue.length ? (
          <div className="divide-y">
            {draftQueue.map((draft) => {
              const isDraftWorking = draftActionId === draft.id;
              return (
                <div key={draft.id} className="px-6 py-4 space-y-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{draft.title}</p>
                        <DraftKindBadge kind={draft.kind} />
                        {draft.offerType ? <OfferTypeBadge type={draft.offerType} /> : null}
                      </div>
                      <div className="grid sm:grid-cols-3 gap-3 text-xs">
                        <MiniStat label="Owner" value={draft.owner} />
                        <MiniStat label="Due date" value={draft.dueDate} />
                        <MiniStat label="Potential value" value={draft.potentialValueLabel} />
                      </div>
                    </div>
                    {canApproveCommercial && isPendingRetentionDraft(draft) ? (
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button
                          size="sm"
                          disabled={
                            isDraftWorking ||
                            convertingRetentionGrowthDraft ||
                            rejectingRetentionGrowthDraft
                          }
                          onClick={() => convertRetentionGrowthDraftToAction({ draft })}
                        >
                          {isDraftWorking && convertingRetentionGrowthDraft ? (
                            <Loader2 className="mr-2 size-3 animate-spin" />
                          ) : null}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-crit/30 text-crit hover:bg-crit/10"
                          disabled={
                            isDraftWorking ||
                            convertingRetentionGrowthDraft ||
                            rejectingRetentionGrowthDraft
                          }
                          onClick={() => rejectRetentionGrowthDraft(draft)}
                        >
                          {isDraftWorking && rejectingRetentionGrowthDraft ? (
                            <Loader2 className="mr-2 size-3 animate-spin" />
                          ) : null}
                          Reject
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  <MiniStat label="Next step" value={draft.nextStep} />
                  <p className="text-xs text-muted-foreground">{draft.reason}</p>
                  <p className="text-[11px] font-medium text-accent">{draft.approvalState}</p>
                  <EvidencePreview
                    evidence={draft.evidence}
                    onView={() =>
                      setEvidenceTarget({
                        title: draft.title,
                        subtitle: draft.kind === "offer" ? "Draft offer" : "Draft plan",
                        evidence: draft.evidence,
                      })
                    }
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <p className="px-6 py-6 text-xs text-muted-foreground">
            No draft pitches or offers have been created yet.
          </p>
        )}
      </RetentionGrowthDisclosure>

      <RetentionPlanReviewSheet
        target={planTarget}
        form={planForm}
        onChange={setPlanForm}
        onClose={closePlanReview}
        onConfirm={confirmPlanReview}
        viewerRole={role}
        canApproveCommercial={canApproveCommercial}
        isSaving={savingRetentionGrowthDraft || convertingRetentionGrowthDraft}
      />

      <RetentionOfferReviewSheet
        target={offerTarget}
        form={offerForm}
        onChange={setOfferForm}
        onClose={closeOfferReview}
        onConfirm={confirmOfferReview}
        viewerRole={role}
        canApproveCommercial={canApproveCommercial}
        isSaving={savingRetentionGrowthDraft || convertingRetentionGrowthDraft}
      />

      <EvidenceDetailSheet target={evidenceTarget} onClose={() => setEvidenceTarget(null)} />
    </div>
  );
}

function RetentionGrowthDisclosure({
  title,
  description,
  meta,
  defaultOpen = false,
  className = "",
  children,
}) {
  return (
    <details
      className={`group rounded-xl border bg-card overflow-hidden ${className}`}
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-6 py-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <h3 className="text-sm font-bold">{title}</h3>
          {description ? (
            <p className="text-[11px] text-muted-foreground mt-1">{description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {meta ? (
            <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
              {meta}
            </span>
          ) : null}
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </div>
      </summary>
      <div className="border-t">{children}</div>
    </details>
  );
}

function ServiceStatusBadge({ status }) {
  const styles = {
    Live: "bg-success/10 text-success",
    Delivered: "bg-accent/10 text-accent",
    "In Flight": "bg-warn/10 text-warn",
    Offered: "bg-muted text-muted-foreground",
  };

  return (
    <span
      className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${styles[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}

function OfferTypeBadge({ type }) {
  const styles = {
    POC: "bg-accent/10 text-accent",
    Upsell: "bg-success/10 text-success",
    "Cross-sell": "bg-success/10 text-success",
    Renewal: "bg-warn/10 text-warn",
    "Service Credit": "bg-warn/10 text-warn",
    Discount: "bg-warn/10 text-warn",
  };

  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-1 ${styles[type] ?? "bg-muted text-muted-foreground"}`}
    >
      {type}
    </span>
  );
}

function ApprovalPill({ required, approverRole, viewerRole }) {
  const approver = approverRole ?? "Head of KAM";
  if (required && viewerRole === approver) return null;

  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-1 ${
        required ? "bg-warn/10 text-warn" : "bg-success/10 text-success"
      }`}
    >
      {required ? `Approval - ${approver}` : "No approval"}
    </span>
  );
}

function SignalLevelBadge({ level, tone }) {
  const styles =
    tone === "risk"
      ? {
          High: "bg-crit/10 text-crit",
          Medium: "bg-warn/10 text-warn",
          Low: "bg-success/10 text-success",
        }
      : {
          High: "bg-success/10 text-success",
          Medium: "bg-accent/10 text-accent",
          Low: "bg-muted text-muted-foreground",
        };

  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-1 ${styles[level] ?? "bg-muted text-muted-foreground"}`}
    >
      {level}
    </span>
  );
}

function DraftKindBadge({ kind }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-accent/10 text-accent px-2 py-1">
      {kind === "offer" ? "Draft Offer" : "Draft Plan"}
    </span>
  );
}

const RETENTION_DRAFT_STATE_PENDING = "Pending Head of KAM approval";
const RETENTION_DRAFT_STATE_CONVERTED = "Converted to action item";
const RETENTION_DRAFT_STATE_REJECTED = "Rejected by Head of KAM";

function getPotentialValueLabel(item) {
  if (item.potentialValueLabel) return item.potentialValueLabel;
  const parsed = Number(item.potentialValue);
  return Number.isFinite(parsed) && parsed > 0 ? `+${formatCurrency(parsed)}` : "Not provided";
}

function formatOpportunityPotential(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? `+${formatCurrency(parsed)}` : "Not provided";
}

function getDraftApprovalState(canApproveCommercial) {
  if (canApproveCommercial) return "Within Head of KAM authority";
  return RETENTION_DRAFT_STATE_PENDING;
}

function getRetentionDraftSourceId(draft) {
  return draft?.id?.replace(/^draft-(plan|offer)-/, "") ?? "";
}

function isPendingRetentionDraft(draft) {
  const state = String(draft?.approvalState ?? "");
  return !state || /^pending\b/i.test(state) || /within kam authority/i.test(state);
}

function isTerminalRetentionDraft(draft) {
  const state = String(draft?.approvalState ?? "").toLowerCase();
  return state.includes("converted") || state.startsWith("rejected");
}

function buildRetentionGrowthActionItemInput(account, draft) {
  const potentialValue =
    draft.potentialValueLabel && draft.potentialValueLabel !== "Not provided"
      ? draft.potentialValueLabel
      : "";
  const reason = [
    draft.reason,
    draft.offerType ? `Offer type: ${draft.offerType}` : "",
    potentialValue ? `Potential value: ${potentialValue}` : "",
    draft.owner ? `Owner: ${draft.owner}` : "",
    draft.dueDate ? `Due date: ${draft.dueDate}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    accountId: account.id,
    title: draft.title,
    description: draft.nextStep,
    reason,
    source:
      draft.kind === "offer"
        ? "Retention vs Growth: draft offer"
        : "Retention vs Growth: pitch plan",
    healthArea: draft.kind === "offer" ? "Growth" : "Retention / Growth",
    expectedLift: potentialValue,
  };
}

function buildRetentionPlanDraft(target, form, canApproveCommercial) {
  const item = target.item;

  return {
    id: `draft-plan-${item.id}`,
    kind: "plan",
    title: form.title.trim(),
    owner: form.owner.trim(),
    dueDate: formatDraftDate(form.dueDate),
    nextStep: form.nextStep.trim(),
    potentialValueLabel: getPotentialValueLabel(item),
    reason: item.reason ?? item.title,
    evidence: item.evidence ?? [],
    approvalState: getDraftApprovalState(canApproveCommercial),
    offerType: item.offerType ?? null,
    createdAt: new Date().toISOString(),
  };
}

function buildRetentionOfferDraft(item, form, canApproveCommercial) {
  return {
    id: `draft-offer-${item.id}`,
    kind: "offer",
    title: form.title.trim(),
    owner: form.owner.trim(),
    dueDate: formatDraftDate(form.dueDate),
    nextStep: form.nextStep.trim(),
    potentialValueLabel: getPotentialValueLabel(item),
    reason: item.reason ?? item.title,
    evidence: item.evidence ?? [],
    offerType: item.offerType,
    approvalState: getDraftApprovalState(canApproveCommercial),
    createdAt: new Date().toISOString(),
  };
}

function sortRetentionDrafts(drafts) {
  return [...drafts].sort((left, right) => {
    const leftDate = new Date(left.createdAt || 0).getTime();
    const rightDate = new Date(right.createdAt || 0).getTime();
    return rightDate - leftDate;
  });
}

function dedupeRetentionDrafts(drafts) {
  const seen = new Set();
  return drafts.filter((draft) => {
    if (!draft?.id || seen.has(draft.id)) return false;
    seen.add(draft.id);
    return true;
  });
}

function RetentionPlanReviewSheet({
  target,
  form,
  onChange,
  onClose,
  onConfirm,
  viewerRole,
  canApproveCommercial,
  isSaving,
}) {
  const item = target?.item ?? null;
  const actionLabel =
    target?.kind === "opportunity"
      ? (item?.actionLabel ?? "Pursue")
      : target?.kind === "growth"
        ? "Plan Pitch"
        : "Review";
  const confirmLabel = canApproveCommercial ? "Add action item" : "Submit for approval";

  return (
    <Sheet open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        {item && (
          <>
            <SheetHeader>
              <SheetTitle>
                {actionLabel} {canApproveCommercial ? "action item" : "approval draft"}
              </SheetTitle>
              <SheetDescription>
                {canApproveCommercial
                  ? "Review the recommendation and add it directly to the account action items."
                  : "Review the recommendation and submit it to Head of KAM for approval."}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 py-5">
              <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {item.category ? <AreaBadge area={item.category} /> : null}
                  {item.priority ? <PriorityBadge priority={item.priority} /> : null}
                  {item.offerType ? <OfferTypeBadge type={item.offerType} /> : null}
                  {item.confidence ? <ConfidenceBadge confidence={item.confidence} /> : null}
                  <ApprovalPill
                    required={Boolean(item.approvalRequired)}
                    approverRole={item.approverRole}
                    viewerRole={viewerRole}
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold">{item.title ?? item.service}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.reason ?? item.nextStep}
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 text-xs">
                  <MiniStat label="Potential value" value={getPotentialValueLabel(item)} />
                  <MiniStat label="Next step" value={item.nextStep} />
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="retention-plan-title">Title</Label>
                  <Input
                    id="retention-plan-title"
                    value={form.title}
                    onChange={(event) =>
                      onChange((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="retention-plan-owner">Owner</Label>
                    <Input
                      id="retention-plan-owner"
                      value={form.owner}
                      onChange={(event) =>
                        onChange((current) => ({ ...current, owner: event.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="retention-plan-due-date">Due date</Label>
                    <Input
                      id="retention-plan-due-date"
                      type="date"
                      value={form.dueDate}
                      onChange={(event) =>
                        onChange((current) => ({ ...current, dueDate: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="retention-plan-next-step">Next step</Label>
                  <Textarea
                    id="retention-plan-next-step"
                    rows={4}
                    value={form.nextStep}
                    onChange={(event) =>
                      onChange((current) => ({ ...current, nextStep: event.target.value }))
                    }
                  />
                </div>

                {!canApproveCommercial && (
                  <div className="rounded-xl border border-warn/30 bg-warn/5 p-4">
                    <p className="text-sm font-semibold text-warn">Pending Head of KAM approval</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      This will be saved as a draft first. Once Head of KAM approves it, it becomes
                      an action item for the assigned KAM.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Evidence
                </p>
                <div className="space-y-3">
                  {(item.evidence ?? []).map((entry, index) => (
                    <div
                      key={`${entry.source}-${index}`}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          {entry.sourceType}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{entry.date}</span>
                      </div>
                      <p className="text-sm font-medium">{entry.source}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {entry.excerpt}
                      </p>
                      <p className="text-[11px] text-foreground">{entry.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <SheetFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={onConfirm}
                disabled={
                  isSaving || !form.title.trim() || !form.owner.trim() || !form.nextStep.trim()
                }
              >
                {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {confirmLabel}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function RetentionOfferReviewSheet({
  target,
  form,
  onChange,
  onClose,
  onConfirm,
  viewerRole,
  canApproveCommercial,
  isSaving,
}) {
  const confirmLabel = canApproveCommercial ? "Add action item" : "Submit for approval";

  return (
    <Sheet open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        {target && (
          <>
            <SheetHeader>
              <SheetTitle>
                {canApproveCommercial ? "Add offer action item" : "Create draft offer"}
              </SheetTitle>
              <SheetDescription>
                {canApproveCommercial
                  ? "Review the recommended offer and add it directly to the account action items."
                  : "Review the recommended offer and submit it to Head of KAM for approval."}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 py-5">
              <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <OfferTypeBadge type={target.offerType} />
                  <ConfidenceBadge confidence={target.confidence} />
                  <ApprovalPill
                    required={Boolean(target.approvalRequired)}
                    approverRole={target.approverRole}
                    viewerRole={viewerRole}
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold">{target.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{target.reason}</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 text-xs">
                  <MiniStat label="Potential value" value={getPotentialValueLabel(target)} />
                  <MiniStat label="Allowed offer" value={target.allowedValue} />
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="retention-offer-title">Offer title</Label>
                  <Input
                    id="retention-offer-title"
                    value={form.title}
                    onChange={(event) =>
                      onChange((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="retention-offer-owner">Owner</Label>
                    <Input
                      id="retention-offer-owner"
                      value={form.owner}
                      onChange={(event) =>
                        onChange((current) => ({ ...current, owner: event.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="retention-offer-due-date">Due date</Label>
                    <Input
                      id="retention-offer-due-date"
                      type="date"
                      value={form.dueDate}
                      onChange={(event) =>
                        onChange((current) => ({ ...current, dueDate: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="retention-offer-next-step">Next step</Label>
                  <Textarea
                    id="retention-offer-next-step"
                    rows={4}
                    value={form.nextStep}
                    onChange={(event) =>
                      onChange((current) => ({ ...current, nextStep: event.target.value }))
                    }
                  />
                </div>

                {!canApproveCommercial && (
                  <div className="rounded-xl border border-warn/30 bg-warn/5 p-4">
                    <p className="text-sm font-semibold text-warn">Pending Head of KAM approval</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      This draft can be created by the KAM. After Head of KAM approves it, it
                      becomes an action item for the assigned KAM.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Evidence
                </p>
                <div className="space-y-3">
                  {(target.evidence ?? []).map((entry, index) => (
                    <div
                      key={`${entry.source}-${index}`}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          {entry.sourceType}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{entry.date}</span>
                      </div>
                      <p className="text-sm font-medium">{entry.source}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {entry.excerpt}
                      </p>
                      <p className="text-[11px] text-foreground">{entry.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <SheetFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={onConfirm}
                disabled={
                  isSaving || !form.title.trim() || !form.owner.trim() || !form.nextStep.trim()
                }
              >
                {isSaving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {confirmLabel}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
/* ============================== TAB 1: Overview (KYC) ============================== */
function OverviewTab({ account }) {
  const { profile, session } = useAuth();
  const role = profile?.role ?? "KAM";
  const isHead = role === "Head of KAM" || role === "CEO";
  const editable = getRolePermissions(role).write;
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: kamUsers = [] } = useQuery({
    queryKey: ["kamUsers"],
    queryFn: fetchKamUsers,
    enabled: isHead,
  });
  const [assignedKamId, setAssignedKamId] = useState(account.assignedKamId ?? null);
  const { mutate: assignKam } = useMutation({
    mutationFn: async (kamId) => {
      const oldName = kamUsers.find((u) => u.id === assignedKamId)?.name ?? "Unassigned";
      const newName = kamUsers.find((u) => u.id === kamId)?.name ?? kamId;
      await updateAccountKam(account.id, kamId);
      await logAccountChanges(
        account.id,
        [{ field: "Assigned KAM", oldValue: oldName, newValue: newName }],
        profile?.name ?? "Unknown",
      );
    },
    onSuccess: (_, kamId) => {
      setAssignedKamId(kamId);
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account-history", account.id] });
    },
  });
  const initialFields = useMemo(
    () => ({
      accountStatus: "Key Account - all accounts in our system are key accounts",
      industry: account.industry,
      business: account.businessInfo,
      history: account.clientHistory,
      stakeholdersInfo: formatStakeholdersInfo(account.stakeholders),
      revenue: account.revenue,
      mrrArr: account.isStartup && account.mrrArr ? account.mrrArr : "N/A - not a startup client",
      tenure: account.engagementTenure,
      team: String(account.teamSize),
      competitors: account.competitors.join(", "),
      flow: account.mainBusinessFlow,
      contractRenewalDate: normalizeDateValue(account.contractRenewalDate),
      contractDuration: account.contractDuration || account.contractScoring?.duration || "",
      linkedinUrl: account.linkedinUrl ?? "",
      websiteUrl: account.websiteUrl ?? "",
      primary: account.primaryContact?.name ?? "",
    }),
    [
      account.businessInfo,
      account.clientHistory,
      account.competitors,
      account.engagementTenure,
      account.industry,
      account.isStartup,
      account.stakeholders,
      account.contractRenewalDate,
      account.contractDuration,
      account.contractScoring?.duration,
      account.linkedinUrl,
      account.mainBusinessFlow,
      account.mrrArr,
      account.revenue,
      account.teamSize,
      account.websiteUrl,
      account.primaryContact?.name,
    ],
  );
  const [fields, setFields] = useState(initialFields);
  const [savedSnapshot, setSavedSnapshot] = useState(initialFields);
  const [showSaved, setShowSaved] = useState(false);
  const [kycSaveError, setKycSaveError] = useState("");
  const [autofilledFieldKeys, setAutofilledFieldKeys] = useState([]);
  const savedTimerRef = useRef(null);
  const isDirty = JSON.stringify(fields) !== JSON.stringify(savedSnapshot);
  // Auto-hide the "saved" confirmation after 3 s
  useEffect(() => {
    if (showSaved) {
      savedTimerRef.current = setTimeout(() => setShowSaved(false), 3000);
    }
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, [showSaved]);
  useEffect(() => {
    if (autofilledFieldKeys.length === 0) return undefined;
    const timer = setTimeout(() => setAutofilledFieldKeys([]), 4000);
    return () => clearTimeout(timer);
  }, [autofilledFieldKeys]);
  const KYC_LABELS = KYC_FORM_FIELD_LABELS;
  const dirtyFieldKeys = Object.keys(fields).filter((key) => fields[key] !== savedSnapshot[key]);
  const unsupportedDirtyFieldKeys = dirtyFieldKeys.filter((key) => !KYC_DB_FIELD_KEYS.has(key));
  const { mutate: saveKyc, isPending: savingKyc } = useMutation({
    mutationFn: async () => {
      const unsupportedKeys = Object.keys(fields).filter(
        (key) => fields[key] !== savedSnapshot[key] && !KYC_DB_FIELD_KEYS.has(key),
      );
      if (unsupportedKeys.length > 0) {
        throw new Error(
          `These changed fields are not mapped to the database: ${unsupportedKeys
            .map((key) => KYC_LABELS[key] ?? key)
            .join(", ")}.`,
        );
      }
      const teamNum = parseInt(fields.team);
      await updateAccountKyc(account.id, {
        industry: fields.industry,
        business_info: fields.business,
        client_history: fields.history,
        revenue: fields.revenue,
        mrr_arr: fields.mrrArr.startsWith("N/A") ? null : fields.mrrArr,
        primary_contact_name: fields.primary,
        engagement_tenure: fields.tenure,
        ...(isNaN(teamNum) ? {} : { team_size: teamNum }),
        competitors: fields.competitors
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        main_business_flow: fields.flow,
        renewal_date: fields.contractRenewalDate || null,
        contract_duration: fields.contractDuration || null,
        linkedin_url: fields.linkedinUrl || null,
        website_url: fields.websiteUrl || null,
      });
      const diffs = Object.keys(fields)
        .filter((k) => fields[k] !== savedSnapshot[k])
        .map((k) => ({
          field: KYC_LABELS[k] ?? k,
          oldValue: savedSnapshot[k],
          newValue: fields[k],
        }));
      await logAccountChanges(account.id, diffs, profile?.name ?? "Unknown");
    },
    onMutate: () => {
      setKycSaveError("");
    },
    onSuccess: () => {
      setSavedSnapshot({ ...fields });
      setShowSaved(true);
      setKycSaveError("");
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["account-history", account.id] });
    },
    onError: (error) => {
      setKycSaveError(error?.message ?? "Could not save KYC fields to the database.");
    },
  });
  const charterInputRef = useRef(null);
  const [charterFile, setCharterFile] = useState(null);
  const [charterMatches, setCharterMatches] = useState([]);
  const [charterMappingOpen, setCharterMappingOpen] = useState(false);
  const [checkedCharterFields, setCheckedCharterFields] = useState([]);
  const [charterMessage, setCharterMessage] = useState("");
  const [charterError, setCharterError] = useState("");
  const [salesforceLookup, setSalesforceLookup] = useState({
    status: "idle",
    text: "",
    error: "",
    bundle: null,
  });
  const [salesforceMappingOpen, setSalesforceMappingOpen] = useState(false);
  const [selectedSalesforceRows, setSelectedSalesforceRows] = useState({});
  const [salesforceSyncError, setSalesforceSyncError] = useState("");
  const [linkedinSummary, setLinkedinSummary] = useState(account.linkedinSummary ?? "");
  const [linkedinSummaryUpdatedAt, setLinkedinSummaryUpdatedAt] = useState(
    account.linkedinSummaryUpdatedAt ?? null,
  );
  const [linkedinSummaryError, setLinkedinSummaryError] = useState("");
  const [websiteSummary, setWebsiteSummary] = useState(account.websiteSummary ?? "");
  const [websiteSummaryUpdatedAt, setWebsiteSummaryUpdatedAt] = useState(
    account.websiteSummaryUpdatedAt ?? null,
  );
  const [websiteSummaryError, setWebsiteSummaryError] = useState("");
  const salesforceMappingRows = useMemo(
    () => buildSalesforceMappingRows(salesforceLookup.bundle, account, fields),
    [salesforceLookup.bundle, account, fields],
  );
  const { mutate: checkSalesforceAccount, isPending: checkingSalesforce } = useMutation({
    mutationFn: async () => {
      const accessToken = await getFreshAccessTokenForSalesforceLookup();
      return lookupSalesforceAccountBundle({
        data: {
          accountName: account.name,
          accessToken,
        },
      });
    },
    onSuccess: (result) => {
      const rows = buildSalesforceMappingRows(result, account, fields);
      setSalesforceLookup({
        status: result.found ? "found" : "not-found",
        text: result.formattedText,
        error: "",
        bundle: result.found ? result : null,
      });
      setSelectedSalesforceRows(defaultSalesforceSelection(rows));
      setSalesforceSyncError("");
      if (result.found && rows.length > 0) setSalesforceMappingOpen(true);
    },
    onError: (error) => {
      setSalesforceLookup({
        status: "error",
        text: "",
        error: error.message ?? "Unable to check Salesforce for this account.",
        bundle: null,
      });
    },
  });
  const selectedRowsForSync = salesforceMappingRows.filter(
    (row) => row.canSync && selectedSalesforceRows[row.id],
  );
  const { mutate: syncSelectedSalesforceRows, isPending: syncingSalesforceRows } = useMutation({
    mutationFn: async () => {
      if (selectedRowsForSync.length === 0) {
        throw new Error("Select at least one Salesforce field to sync.");
      }
      await syncSalesforceMappedFields(account.id, buildSalesforceSyncPayload(selectedRowsForSync));
      await logAccountChanges(
        account.id,
        buildSalesforceHistoryRows(selectedRowsForSync),
        profile?.name ?? "Unknown",
      );
      return selectedRowsForSync;
    },
    onSuccess: (syncedRows) => {
      setFields((current) => {
        const next = { ...current };
        syncedRows.forEach((row) => {
          if (row.kind === "account" && row.fieldKey)
            next[row.fieldKey] = displaySyncValue(row.dbValue);
        });
        return next;
      });
      setSavedSnapshot((current) => {
        const next = { ...current };
        syncedRows.forEach((row) => {
          if (row.kind === "account" && row.fieldKey)
            next[row.fieldKey] = displaySyncValue(row.dbValue);
        });
        return next;
      });
      setSalesforceSyncError("");
      setSalesforceMappingOpen(false);
      setSalesforceLookup((current) => ({
        ...current,
        text: `${current.text}\n\nSynced ${syncedRows.length} selected field(s) into this account.`,
      }));
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["account-history", account.id] });
      router.invalidate();
    },
    onError: (error) => {
      setSalesforceSyncError(error.message ?? "Salesforce sync failed. Please try again.");
    },
  });
  const { mutate: generateLinkedinSummary, isPending: generatingLinkedinSummary } = useMutation({
    mutationFn: async () => {
      if (!fields.linkedinUrl.trim()) {
        throw new Error("Add a LinkedIn URL before generating the account summary.");
      }
      if (fields.linkedinUrl !== savedSnapshot.linkedinUrl) {
        await updateAccountKyc(account.id, { linkedin_url: fields.linkedinUrl });
      }
      const result = await generateAccountLinkedinSummary(account.id);
      await logAccountChanges(
        account.id,
        [
          {
            field: "Account's Linkedin Summary",
            oldValue: linkedinSummary,
            newValue: result.summary,
          },
        ],
        profile?.name ?? "Unknown",
      );
      return result;
    },
    onSuccess: (result) => {
      setLinkedinSummary(result.summary);
      setLinkedinSummaryUpdatedAt(result.updatedAt ?? new Date().toISOString());
      setLinkedinSummaryError("");
      setSavedSnapshot((current) => ({ ...current, linkedinUrl: fields.linkedinUrl }));
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account-history", account.id] });
      router.invalidate();
    },
    onError: (error) => {
      setLinkedinSummaryError(
        error.message ?? "Unable to generate the LinkedIn summary. Please try again.",
      );
    },
  });
  const { mutate: generateWebsiteSummary, isPending: generatingWebsiteSummary } = useMutation({
    mutationFn: async () => {
      if (!fields.websiteUrl.trim()) {
        throw new Error("Add a Website URL before generating the account website summary.");
      }
      if (fields.websiteUrl !== savedSnapshot.websiteUrl) {
        await updateAccountKyc(account.id, { website_url: fields.websiteUrl });
      }
      const result = await generateAccountWebsiteSummary(account.id);
      await logAccountChanges(
        account.id,
        [
          {
            field: "Account's Website Summary",
            oldValue: websiteSummary,
            newValue: result.summary,
          },
        ],
        profile?.name ?? "Unknown",
      );
      return result;
    },
    onSuccess: (result) => {
      setWebsiteSummary(result.summary);
      setWebsiteSummaryUpdatedAt(result.updatedAt ?? new Date().toISOString());
      setWebsiteSummaryError("");
      setSavedSnapshot((current) => ({ ...current, websiteUrl: fields.websiteUrl }));
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account-history", account.id] });
      router.invalidate();
    },
    onError: (error) => {
      setWebsiteSummaryError(
        error.message ?? "Unable to generate the website summary. Please try again.",
      );
    },
  });
  const { mutate: extractCharterMatches, isPending: readingCharter } = useMutation({
    mutationFn: async (file) => extractKycFieldMatchesFromXlsx(file),
    onMutate: (file) => {
      setCharterFile(file);
      setCharterMatches([]);
      setCheckedCharterFields([]);
      setCharterMappingOpen(false);
      setCharterMessage("");
      setCharterError("");
    },
    onSuccess: (matches) => {
      setCharterMatches(matches);
      setCheckedCharterFields(matches.filter((match) => match.canAutofill).map((match) => match.id));
      setCharterMappingOpen(true);
    },
    onError: (error) => {
      setCharterError(error?.message ?? "Could not read the project charter. Please try again.");
      setCharterFile(null);
      setCharterMatches([]);
      setCheckedCharterFields([]);
      if (charterInputRef.current) charterInputRef.current.value = "";
    },
  });
  function clearCharterSelection() {
    setCharterMappingOpen(false);
    setCharterFile(null);
    setCharterMatches([]);
    setCheckedCharterFields([]);
    setCharterMessage("");
    if (charterInputRef.current) charterInputRef.current.value = "";
  }
  function handleCharterFile(file) {
    setCharterMessage("");
    setCharterError("");
    if (!file) {
      clearCharterSelection();
      return;
    }
    if (!isXlsxFile(file)) {
      clearCharterSelection();
      setCharterError("Choose a valid .xlsx project charter file.");
      return;
    }
    extractCharterMatches(file);
  }
  function handleAutofillSelectedCharterFields() {
    const selectedIds = charterMatches
      .filter((match) => checkedCharterFields.includes(match.id) && match.canAutofill)
      .map((match) => match.id);
    if (selectedIds.length === 0) {
      setCharterError("Select at least one field with an extracted value to autofill.");
      return;
    }
    const { fieldPatch, nextFields, selectedKeys, updatedKeys } = buildXlsxFieldPatch(
      fields,
      charterMatches,
      selectedIds,
    );
    if (selectedKeys.length === 0) {
      setCharterError("No selected extracted values could be mapped to the KYC form.");
      return;
    }
    setFields((current) => ({ ...current, ...fieldPatch }));
    setSavedSnapshot((current) => {
      const localOnlyUpdates = Object.fromEntries(
        selectedKeys
          .filter((key) => !KYC_DB_FIELD_KEYS.has(key))
          .map((key) => [key, nextFields[key]]),
      );
      return Object.keys(localOnlyUpdates).length > 0
        ? { ...current, ...localOnlyUpdates }
        : current;
    });
    setAutofilledFieldKeys(selectedKeys);
    setCharterMessage(
      updatedKeys.length > 0
        ? `Project charter autofilled ${selectedKeys
            .map((key) => KYC_LABELS[key] ?? key)
            .join(", ")}. Click Save KYC to write DB-backed changes.`
        : `Project charter reapplied ${selectedKeys
            .map((key) => KYC_LABELS[key] ?? key)
            .join(", ")}. The selected value is already shown in the form.`,
    );
  }
  return (
    <div className="space-y-6">
      {/* KYC Header */}
      <div className="bg-gradient-to-br from-primary/5 to-accent/5 border rounded-xl p-6 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-accent mb-1">
            Step 1 of 6
          </p>
          <h2 className="text-xl font-bold">Know Your Client (KYC)</h2>
          <p className="text-xs text-muted-foreground mt-1">
            All 12 mandatory KYC fields for this key account. Every field is editable.
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-md bg-success/10 text-success text-[11px] font-bold uppercase tracking-wider border border-success/20 w-fit">
          Key Account
        </span>
      </div>

      {/* Project Charter Auto-fill upload */}
      <div className="border rounded-xl p-5 bg-card">
        <div className="flex items-start gap-3 mb-3">
          <span className="size-9 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <Sparkles className="size-4" />
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold">Project Charter Auto-fill</h3>
            <p className="text-[11px] text-muted-foreground">
              Upload a .xlsx project charter, confirm the fields to include, and autofill the
              matching KYC inputs.
            </p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <label
            className={`flex-1 flex items-center gap-2 border-2 border-dashed rounded-md px-3 py-2.5 hover:bg-muted/40 transition-colors ${
              !editable || readingCharter
                ? "opacity-50 cursor-not-allowed"
                : "cursor-pointer"
            }`}
          >
            <Upload className="size-4 text-muted-foreground" />
            <span className="text-xs truncate">
              {charterFile ? charterFile.name : "Choose a project charter (.xlsx)..."}
            </span>
            <input
              ref={charterInputRef}
              type="file"
              className="hidden"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={!editable || readingCharter}
              onChange={(e) => {
                handleCharterFile(e.target.files?.[0] ?? null);
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => charterInputRef.current?.click()}
            disabled={!editable || readingCharter}
            className="px-4 py-2.5 bg-accent text-white text-xs font-bold rounded-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {readingCharter ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Sparkles className="size-3.5" />
            )}
            {readingCharter ? "Reading..." : "Upload Charter"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSalesforceLookup({ status: "loading", text: "", error: "", bundle: null });
              setSalesforceMappingOpen(false);
              setSalesforceSyncError("");
              checkSalesforceAccount();
            }}
            disabled={checkingSalesforce || !session}
            className="px-4 py-2.5 border text-xs font-bold rounded-md hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {checkingSalesforce ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Building2 className="size-3.5" />
            )}
            {checkingSalesforce ? "Checking Salesforce..." : "Sync from Salesforce"}
          </button>
        </div>
        {(charterError || charterMessage) && (
          <p
            className={`text-[11px] mt-2 flex items-center gap-1 ${
              charterError ? "text-crit" : "text-success"
            }`}
          >
            {charterError ? (
              <AlertTriangle className="size-3" />
            ) : (
              <CheckCircle2 className="size-3" />
            )}
            {charterError || charterMessage}
          </p>
        )}
        {salesforceLookup.status !== "idle" && (
          <div
            className={`mt-4 rounded-lg border p-4 ${
              salesforceLookup.status === "error"
                ? "border-crit/30 bg-crit/5"
                : salesforceLookup.status === "not-found"
                  ? "border-warn/30 bg-warn/5"
                  : "bg-muted/30"
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 mb-2">
              <p className="text-xs font-bold uppercase tracking-wider">Salesforce lookup</p>
              <span className="text-[10px] font-mono text-muted-foreground">
                Search name: {account.name}
              </span>
            </div>
            {salesforceLookup.status === "loading" ? (
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin" />
                Checking Salesforce account and related contacts...
              </p>
            ) : salesforceLookup.status === "error" ? (
              <p className="text-xs text-crit">{salesforceLookup.error}</p>
            ) : salesforceLookup.status === "not-found" ? (
              <p className="text-xs text-warn">
                Account or company <span className="font-semibold">"{account.name}"</span> was not
                found in Salesforce.
              </p>
            ) : salesforceLookup.status === "found" && salesforceMappingRows.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedSalesforceRows((current) =>
                    Object.keys(current).length > 0
                      ? current
                      : defaultSalesforceSelection(salesforceMappingRows),
                  );
                  setSalesforceMappingOpen(true);
                }}
                className="px-3 py-1.5 border text-[11px] font-bold rounded-md hover:bg-muted transition-colors"
              >
                Review field mapping
              </button>
            ) : null}
          </div>
        )}
      </div>

      {/* Assigned KAM */}
      <div className="border rounded-xl p-5 bg-card flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="size-9 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <User className="size-4" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Assigned KAM
            </p>
            {isHead ? (
              <select
                value={assignedKamId ?? ""}
                onChange={(e) => assignKam(e.target.value)}
                className="mt-1 text-sm font-semibold bg-transparent border-b border-muted focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="" disabled>
                  Unassigned KAM
                </option>
                {kamUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm font-semibold mt-0.5">
                {kamUsers.find((u) => u.id === assignedKamId)?.name ?? profile?.name ?? "-"}
              </p>
            )}
          </div>
        </div>
        {isHead && (
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
            Head of KAM can reassign
          </span>
        )}
      </div>

      {/* 12-field KYC grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <KycField
          n={1}
          label="Account Status"
          icon={<CheckCircle2 className="size-4" />}
          editable={false}
          value={fields.accountStatus}
          highlighted={autofilledFieldKeys.includes("accountStatus")}
        />

        <KycField
          n={2}
          label="Industry Info"
          icon={<Building2 className="size-4" />}
          editable={editable}
          value={fields.industry}
          onChange={(v) => setFields((f) => ({ ...f, industry: v }))}
          highlighted={autofilledFieldKeys.includes("industry")}
        />

        <KycField
          n={3}
          label="Business Info"
          icon={<Workflow className="size-4" />}
          editable={editable}
          value={fields.business}
          onChange={(v) => setFields((f) => ({ ...f, business: v }))}
          multiline
          highlighted={autofilledFieldKeys.includes("business")}
        />

        <KycField
          n={4}
          label="Client History"
          icon={<Clock className="size-4" />}
          editable={editable}
          value={fields.history}
          onChange={(v) => setFields((f) => ({ ...f, history: v }))}
          multiline
          highlighted={autofilledFieldKeys.includes("history")}
        />

        <KycField
          n={5}
          label="Stakeholders Info"
          icon={<Users className="size-4" />}
          editable={false}
          value={fields.stakeholdersInfo}
          multiline
          highlighted={autofilledFieldKeys.includes("stakeholdersInfo")}
        />

        <KycField
          n={6}
          label="Revenue Info"
          icon={<DollarSign className="size-4" />}
          editable={editable}
          value={fields.revenue}
          onChange={(v) => setFields((f) => ({ ...f, revenue: v }))}
          highlighted={autofilledFieldKeys.includes("revenue")}
        />

        <KycField
          n={7}
          label="MRR / ARR (Startups)"
          icon={<TrendingUp className="size-4" />}
          editable={editable}
          value={fields.mrrArr}
          onChange={(v) => setFields((f) => ({ ...f, mrrArr: v }))}
          highlighted={autofilledFieldKeys.includes("mrrArr")}
        />

        <KycField
          n={8}
          label="Person Info (Primary)"
          icon={<User className="size-4" />}
          editable={editable}
          value={fields.primary}
          onChange={(v) => setFields((f) => ({ ...f, primary: v }))}
          highlighted={autofilledFieldKeys.includes("primary")}
        />

        <KycField
          n={9}
          label="Engagement Tenure"
          icon={<Calendar className="size-4" />}
          editable={editable}
          value={fields.tenure}
          onChange={(v) => setFields((f) => ({ ...f, tenure: v }))}
          highlighted={autofilledFieldKeys.includes("tenure")}
        />

        <KycField
          n={10}
          label="Team Size"
          icon={<Users className="size-4" />}
          editable={editable}
          value={fields.team}
          onChange={(v) => setFields((f) => ({ ...f, team: v }))}
          highlighted={autofilledFieldKeys.includes("team")}
        />

        <KycField
          n={11}
          label="Competitors"
          icon={<Swords className="size-4" />}
          editable={editable}
          value={fields.competitors}
          onChange={(v) => setFields((f) => ({ ...f, competitors: v }))}
          highlighted={autofilledFieldKeys.includes("competitors")}
        />

        <KycField
          n={12}
          label="Main Business Flow"
          icon={<Workflow className="size-4" />}
          editable={editable}
          wide
          value={fields.flow}
          onChange={(v) => setFields((f) => ({ ...f, flow: v }))}
          multiline
          highlighted={autofilledFieldKeys.includes("flow")}
        />
      </div>

      <Card title="Account Details">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="size-7 rounded-md bg-accent/10 text-accent flex items-center justify-center">
                <Calendar className="size-3.5" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Contract Renewal Date
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Account field also referenced by Contract details.
                </p>
              </div>
            </div>
            {editable ? (
              <input
                type="date"
                value={fields.contractRenewalDate}
                onChange={(event) =>
                  setFields((current) => ({
                    ...current,
                    contractRenewalDate: event.target.value,
                  }))
                }
                className="w-full bg-background border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
              />
            ) : fields.contractRenewalDate ? (
              <p className="text-xs font-semibold">
                {formatDisplayDate(fields.contractRenewalDate)}
              </p>
            ) : (
              <p className="text-xs italic text-muted-foreground">No renewal date saved.</p>
            )}
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="size-7 rounded-md bg-accent/10 text-accent flex items-center justify-center">
                <Clock className="size-3.5" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Contract Duration
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Account field also referenced by Contract details.
                </p>
              </div>
            </div>
            {editable ? (
              <input
                value={fields.contractDuration}
                onChange={(event) =>
                  setFields((current) => ({ ...current, contractDuration: event.target.value }))
                }
                placeholder="e.g. 24 months"
                className="w-full bg-background border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
              />
            ) : fields.contractDuration ? (
              <p className="text-xs font-semibold">{fields.contractDuration}</p>
            ) : (
              <p className="text-xs italic text-muted-foreground">No contract duration saved.</p>
            )}
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="size-7 rounded-md bg-accent/10 text-accent flex items-center justify-center">
                <ExternalLink className="size-3.5" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  LinkedIn URL
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Account object field synced from Salesforce.
                </p>
              </div>
            </div>
            {editable ? (
              <div className="flex items-center gap-2">
                <input
                  value={fields.linkedinUrl}
                  onChange={(event) =>
                    setFields((current) => ({ ...current, linkedinUrl: event.target.value }))
                  }
                  placeholder="https://www.linkedin.com/company/example"
                  className="flex-1 min-w-0 bg-background border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                />
                {fields.linkedinUrl && (
                  <a
                    href={externalUrl(fields.linkedinUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="size-9 border rounded-md flex items-center justify-center text-muted-foreground hover:text-accent hover:bg-muted transition-colors shrink-0"
                    aria-label="Open LinkedIn URL"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </div>
            ) : fields.linkedinUrl ? (
              <a
                href={externalUrl(fields.linkedinUrl)}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-accent hover:underline break-all"
              >
                {fields.linkedinUrl}
              </a>
            ) : (
              <p className="text-xs italic text-muted-foreground">No LinkedIn URL saved.</p>
            )}
          </div>
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="size-7 rounded-md bg-accent/10 text-accent flex items-center justify-center">
                <ExternalLink className="size-3.5" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Website URL
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Company website used as the source for website summary.
                </p>
              </div>
            </div>
            {editable ? (
              <div className="flex items-center gap-2">
                <input
                  value={fields.websiteUrl}
                  onChange={(event) =>
                    setFields((current) => ({ ...current, websiteUrl: event.target.value }))
                  }
                  placeholder="https://www.example.com"
                  className="flex-1 min-w-0 bg-background border rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                />
                {fields.websiteUrl && (
                  <a
                    href={externalUrl(fields.websiteUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="size-9 border rounded-md flex items-center justify-center text-muted-foreground hover:text-accent hover:bg-muted transition-colors shrink-0"
                    aria-label="Open Website URL"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </div>
            ) : fields.websiteUrl ? (
              <a
                href={externalUrl(fields.websiteUrl)}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-accent hover:underline break-all"
              >
                {fields.websiteUrl}
              </a>
            ) : (
              <p className="text-xs italic text-muted-foreground">No Website URL saved.</p>
            )}
          </div>
        </div>
      </Card>

      <Card title="Account's Linkedin Summary">
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {["New job postings", "Major activities", "Competitors", "CEO updates"].map(
                (metric) => (
                  <span
                    key={metric}
                    className="px-2 py-1 rounded-md bg-muted text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    {metric}
                  </span>
                ),
              )}
            </div>
            <div className="flex flex-col items-start md:items-end gap-2">
              <p className="text-[11px] font-semibold text-muted-foreground">
                {generatingLinkedinSummary
                  ? "Last updated: Updating now..."
                  : formatSummaryUpdatedAt(linkedinSummaryUpdatedAt)}
              </p>
              <button
                type="button"
                onClick={() => {
                  setLinkedinSummaryError("");
                  generateLinkedinSummary();
                }}
                disabled={!editable || generatingLinkedinSummary || !fields.linkedinUrl.trim()}
                className="px-4 py-2 bg-accent text-white text-xs font-bold rounded-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                {generatingLinkedinSummary ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                {generatingLinkedinSummary ? "Generating..." : "Generate Summary"}
              </button>
            </div>
          </div>

          {linkedinSummaryError && (
            <p className="text-xs text-crit bg-crit/10 border border-crit/20 rounded-md px-3 py-2">
              {linkedinSummaryError}
            </p>
          )}

          <div className="border rounded-lg bg-muted/20 p-4 min-h-32">
            <SummaryBody summary={linkedinSummary} emptyText="No LinkedIn summary generated yet." />
          </div>
        </div>
      </Card>

      <Card title="Account's Website Summary">
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {["New job postings", "Major activities", "Competitors", "CEO updates"].map(
                (metric) => (
                  <span
                    key={metric}
                    className="px-2 py-1 rounded-md bg-muted text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    {metric}
                  </span>
                ),
              )}
            </div>
            <div className="flex flex-col items-start md:items-end gap-2">
              <p className="text-[11px] font-semibold text-muted-foreground">
                {generatingWebsiteSummary
                  ? "Last updated: Updating now..."
                  : formatSummaryUpdatedAt(websiteSummaryUpdatedAt)}
              </p>
              <button
                type="button"
                onClick={() => {
                  setWebsiteSummaryError("");
                  generateWebsiteSummary();
                }}
                disabled={!editable || generatingWebsiteSummary || !fields.websiteUrl.trim()}
                className="px-4 py-2 bg-accent text-white text-xs font-bold rounded-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                {generatingWebsiteSummary ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                {generatingWebsiteSummary ? "Generating..." : "Generate Summary"}
              </button>
            </div>
          </div>

          {websiteSummaryError && (
            <p className="text-xs text-crit bg-crit/10 border border-crit/20 rounded-md px-3 py-2">
              {websiteSummaryError}
            </p>
          )}

          <div className="border rounded-lg bg-muted/20 p-4 min-h-32">
            <SummaryBody summary={websiteSummary} emptyText="No website summary generated yet." />
          </div>
        </div>
      </Card>

      {/* Fixed save bar - visible while dirty or briefly after save */}
      {editable && (isDirty || showSaved) && (
        <div className="fixed bottom-0 left-0 md:left-64 right-0 z-50 border-t bg-card px-6 py-3 flex items-center justify-between shadow-lg">
          <p
            className={`text-xs font-medium ${
              kycSaveError
                ? "text-crit"
                : showSaved && !isDirty
                  ? "text-success"
                  : unsupportedDirtyFieldKeys.length > 0
                    ? "text-warn"
                    : "text-muted-foreground"
            }`}
          >
            {kycSaveError
              ? kycSaveError
              : showSaved && !isDirty
                ? "KYC fields saved successfully to the database"
                : unsupportedDirtyFieldKeys.length > 0
                  ? `Some changes are not DB-backed: ${unsupportedDirtyFieldKeys
                      .map((key) => KYC_LABELS[key] ?? key)
                      .join(", ")}`
                  : `${dirtyFieldKeys.length} DB-backed field${
                      dirtyFieldKeys.length === 1 ? "" : "s"
                    } ready to save`}
          </p>
          <div className="flex gap-2">
            {isDirty && (
              <button
                onClick={() => {
                  setFields(savedSnapshot);
                  setShowSaved(false);
                  setKycSaveError("");
                }}
                className="px-3 py-1.5 text-xs border rounded-md hover:bg-muted transition-colors"
              >
                Discard
              </button>
            )}
            {isDirty && (
              <button
                onClick={() => saveKyc()}
                disabled={savingKyc || unsupportedDirtyFieldKeys.length > 0}
                className="px-3 py-1.5 text-xs bg-accent text-white rounded-md disabled:opacity-50 flex items-center gap-1.5 transition-opacity"
              >
                {savingKyc ? (
                  <>
                    <Loader2 className="size-3 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3" /> Save KYC
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Full stakeholders detail */}
      <Card title="Stakeholders - full detail">
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b">
                <th className="pb-2">Name</th>
                <th className="pb-2">Role</th>
                <th className="pb-2">Influence</th>
                <th className="pb-2 text-right">Last contact</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {account.stakeholders.map((s) => (
                <tr key={s.name}>
                  <td className="py-3 flex items-center gap-2">
                    <div className="size-7 rounded-full bg-primary/5 border flex items-center justify-center font-bold text-[10px]">
                      {s.name
                        .split(" ")
                        .map((p) => p[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                    <span className="font-semibold text-xs">{s.name}</span>
                  </td>
                  <td className="py-3 text-xs text-muted-foreground">{s.role}</td>
                  <td className="py-3">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        s.influence === "Champion"
                          ? "bg-success/10 text-success"
                          : s.influence === "Decision Maker"
                            ? "bg-accent/10 text-accent"
                            : s.influence === "Blocker"
                              ? "bg-crit/10 text-crit"
                              : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {s.influence}
                    </span>
                  </td>
                  <td className="py-3 text-right text-[11px] text-muted-foreground">
                    {s.lastContact ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <CharterMappingDialog
        open={charterMappingOpen}
        fileName={charterFile?.name ?? ""}
        matches={charterMatches}
        checkedFields={checkedCharterFields}
        uploading={readingCharter}
        error={charterError}
        onCancel={clearCharterSelection}
        message={charterMessage}
        onToggle={(fieldKey, checked) =>
          setCheckedCharterFields((current) =>
            checked
              ? Array.from(new Set([...current, fieldKey]))
              : current.filter((key) => key !== fieldKey),
          )
        }
        onSelectAll={() =>
          setCheckedCharterFields(
            charterMatches.filter((match) => match.canAutofill).map((match) => match.id),
          )
        }
        onDeselectAll={() => setCheckedCharterFields([])}
        onConfirm={handleAutofillSelectedCharterFields}
      />
      {salesforceMappingOpen && (
        <SalesforceMappingModal
          rows={salesforceMappingRows}
          selectedRows={selectedSalesforceRows}
          syncing={syncingSalesforceRows}
          error={salesforceSyncError}
          onClose={() => setSalesforceMappingOpen(false)}
          onToggle={(rowId) =>
            setSelectedSalesforceRows((current) => ({ ...current, [rowId]: !current[rowId] }))
          }
          onSelectAll={() =>
            setSelectedSalesforceRows(
              Object.fromEntries(salesforceMappingRows.map((row) => [row.id, row.canSync])),
            )
          }
          onClear={() =>
            setSelectedSalesforceRows(
              Object.fromEntries(salesforceMappingRows.map((row) => [row.id, false])),
            )
          }
          onSync={() => syncSelectedSalesforceRows()}
        />
      )}
    </div>
  );
}
function CharterMappingDialog({
  open,
  fileName,
  matches,
  checkedFields,
  uploading,
  error,
  message,
  onCancel,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onConfirm,
}) {
  const matchedCount = matches.filter((match) => match.isMatched).length;
  const selectableMatches = matches.filter((match) => match.canAutofill);
  const selectedCount = checkedFields.filter((fieldKey) =>
    selectableMatches.some((match) => match.id === fieldKey),
  ).length;
  const selectedNoValueCount = matches.filter(
    (match) => checkedFields.includes(match.id) && !match.canAutofill,
  ).length;
  const selectedLocalOnlyCount = matches.filter(
    (match) => checkedFields.includes(match.id) && match.canAutofill && !match.canSaveToDb,
  ).length;
  const allSelected = selectableMatches.length > 0 && selectedCount === selectableMatches.length;
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && !uploading && onCancel()}>
      <DialogContent className="sm:max-w-5xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirm Extracted Field Mapping</DialogTitle>
          <DialogDescription>
            {fileName
              ? `${fileName} - ${matchedCount}/${matches.length} charter field(s) matched. DB-backed rows save when you click Save KYC.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <p className="text-[11px] font-mono text-muted-foreground">
            {selectedCount}/{matches.length} selected
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={allSelected ? onDeselectAll : onSelectAll}
            disabled={uploading || selectableMatches.length === 0}
          >
            {allSelected ? "Deselect All" : "Select All"}
          </Button>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[960px]">
              <div className="grid grid-cols-[2.5rem_minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(12rem,1.2fr)_minmax(10rem,1fr)_7rem] gap-3 px-3 py-2 bg-muted/40 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <span />
                <span>Matched Excel label</span>
                <span>Main form field</span>
                <span>Extracted value</span>
                <span>DB target</span>
                <span>Will save?</span>
              </div>
              <div className="divide-y max-h-[46vh] overflow-y-auto">
                {matches.map((match) => {
                  const checked = checkedFields.includes(match.id);
                  const canAutofill = match.canAutofill;
                  return (
                    <label
                      key={match.id}
                      className={`grid grid-cols-[2.5rem_minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(12rem,1.2fr)_minmax(10rem,1fr)_7rem] gap-3 px-3 py-3 items-center hover:bg-muted/30 ${
                        canAutofill ? "cursor-pointer" : "cursor-not-allowed opacity-70"
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={uploading || !canAutofill}
                        onCheckedChange={(nextChecked) =>
                          onToggle(match.id, Boolean(nextChecked))
                        }
                        aria-label={`Include ${match.formLabel}`}
                      />
                      <span className="text-sm font-medium min-w-0 truncate">
                        {hasSyncValue(match.xlsxLabel) ? match.xlsxLabel : "null"}
                      </span>
                      <span className="text-xs font-semibold min-w-0 truncate">
                        {match.formLabel}
                      </span>
                      <span className="text-xs min-w-0 truncate">
                        {hasSyncValue(match.value) ? match.value : "null"}
                      </span>
                      <code className="text-[11px] bg-muted rounded px-2 py-1 truncate">
                        {match.dbTarget || "Not mapped"}
                      </code>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          match.canSaveToDb
                            ? "text-success"
                            : match.canAutofill
                              ? "text-warn"
                              : "text-muted-foreground"
                        }`}
                      >
                        {match.canSaveToDb
                          ? "Yes"
                          : match.canAutofill
                            ? "Local"
                            : match.isMatched
                              ? "No value"
                              : "No match"}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {selectedNoValueCount > 0 && (
          <p className="text-xs text-warn bg-warn/10 border border-warn/20 rounded-md px-3 py-2">
            {selectedNoValueCount} selected field(s) have no extracted value.
          </p>
        )}
        {selectedLocalOnlyCount > 0 && (
          <p className="text-xs text-warn bg-warn/10 border border-warn/20 rounded-md px-3 py-2">
            {selectedLocalOnlyCount} selected field(s) can be shown in the KYC cards but are not
            written by Save KYC.
          </p>
        )}

        {error && (
          <p className="text-xs text-crit bg-crit/10 border border-crit/20 rounded-md px-3 py-2">
            {error}
          </p>
        )}
        {message && !error && (
          <p className="text-xs text-success bg-success/10 border border-success/20 rounded-md px-3 py-2">
            {message}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={uploading}>
            Close
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={uploading || selectedCount === 0 || selectedNoValueCount > 0}
          >
            {uploading && <Loader2 className="size-3.5 animate-spin" />}
            Apply Selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function SalesforceMappingModal({
  rows,
  selectedRows,
  syncing,
  error,
  onClose,
  onToggle,
  onSelectAll,
  onClear,
  onSync,
}) {
  const groupedRows = useMemo(
    () =>
      rows.reduce((groups, row) => {
        if (!groups[row.group]) groups[row.group] = [];
        groups[row.group].push(row);
        return groups;
      }, {}),
    [rows],
  );
  const selectedCount = rows.filter((row) => row.canSync && selectedRows[row.id]).length;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-stretch md:items-center justify-center md:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-background w-full md:max-w-6xl md:rounded-xl border shadow-2xl flex flex-col max-h-screen md:max-h-[90vh]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-5 py-4 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-accent">
              Salesforce Sync
            </p>
            <h3 className="text-lg font-bold">Review Field Mapping</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground font-mono">
              {selectedCount} selected
            </span>
            <button
              type="button"
              onClick={onSelectAll}
              disabled={syncing}
              className="px-3 py-1.5 border rounded-md text-[11px] font-bold hover:bg-muted disabled:opacity-40"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={syncing}
              className="px-3 py-1.5 border rounded-md text-[11px] font-bold hover:bg-muted disabled:opacity-40"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={syncing}
              className="size-8 border rounded-md flex items-center justify-center hover:bg-muted disabled:opacity-40"
              aria-label="Close Salesforce mapping"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left border-collapse">
              {/* Single thead — columns align across all sections */}
              <thead className="sticky top-0 z-10 bg-background">
                <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b">
                  <th className="w-12 px-5 py-2">Sync</th>
                  <th className="w-44 px-3 py-2">Our field</th>
                  <th className="w-64 px-3 py-2">Current value</th>
                  <th className="w-48 px-3 py-2">Salesforce field</th>
                  <th className="px-3 py-2">Salesforce value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedRows).map(([group, groupRows]) => (
                  <>
                    {/* Section header row spanning all columns */}
                    <tr key={`header-${group}`}>
                      <td colSpan={5} className="px-5 py-2 bg-muted/40 border-y">
                        <p className="text-[11px] font-bold uppercase tracking-wider">{group}</p>
                      </td>
                    </tr>
                    {groupRows.map((row) => (
                      <tr key={row.id} className={`border-b ${!row.canSync ? "opacity-50" : ""}`}>
                        <td className="px-5 py-3 align-top">
                          <input
                            type="checkbox"
                            checked={Boolean(selectedRows[row.id])}
                            disabled={!row.canSync || syncing}
                            onChange={() => onToggle(row.id)}
                            className="size-4"
                            aria-label={`Sync ${row.destinationLabel}`}
                          />
                        </td>
                        <td className="px-3 py-3 align-top">
                          <p className="text-xs font-bold">{row.destinationLabel}</p>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <pre className="whitespace-pre-wrap text-[11px] leading-relaxed font-mono text-muted-foreground">
                            {displaySyncValue(row.destinationValue)}
                          </pre>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <p className="text-xs font-semibold">{row.sourceLabel}</p>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <pre className="whitespace-pre-wrap text-[11px] leading-relaxed font-mono">
                            {displaySyncValue(row.sourceValue)}
                          </pre>
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-5 py-4 border-t flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <p className={`text-xs ${error ? "text-crit" : "text-muted-foreground"}`}>
            {error || "Unchecked fields will stay unchanged."}
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={syncing}
              className="px-4 py-2 border rounded-md text-xs font-bold hover:bg-muted disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSync}
              disabled={syncing || selectedCount === 0}
              className="px-4 py-2 bg-accent text-white rounded-md text-xs font-bold disabled:opacity-40 flex items-center gap-2"
            >
              {syncing && <Loader2 className="size-3.5 animate-spin" />}
              Sync selected fields
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
function KycField({
  n,
  label,
  icon,
  children,
  wide,
  editable,
  value,
  onChange,
  multiline,
  highlighted,
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div
      className={`bg-card border rounded-xl p-4 hover:border-accent/40 transition-colors group ${
        highlighted ? "border-accent ring-2 ring-accent/25 bg-accent/5" : ""
      } ${wide ? "md:col-span-2 lg:col-span-3" : ""}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="size-6 rounded-md bg-accent/10 text-accent flex items-center justify-center text-[10px] font-bold font-mono">
          {String(n).padStart(2, "0")}
        </span>
        <span className="text-muted-foreground">{icon}</span>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex-1">
          {label}
        </p>
        {editable && onChange && (
          <button
            onClick={() => setEditing((e) => !e)}
            className="size-6 rounded hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-accent transition-colors"
            aria-label={editing ? "Save" : "Edit"}
          >
            {editing ? <CheckCircle2 className="size-3.5" /> : <Pencil className="size-3" />}
          </button>
        )}
      </div>
      <div className="text-xs">
        {value !== undefined ? (
          editing && onChange ? (
            multiline ? (
              <textarea
                autoFocus
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={() => setEditing(false)}
                rows={3}
                className="w-full bg-background border rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
              />
            ) : (
              <input
                autoFocus
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={() => setEditing(false)}
                className="w-full bg-background border rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
              />
            )
          ) : (
            <p className="leading-relaxed whitespace-pre-wrap">
              {value || (
                <span className="italic text-muted-foreground">- empty - click edit to add</span>
              )}
            </p>
          )
        ) : (
          children
        )}
      </div>
    </div>
  );
}
/* ============================== TAB 2: Score Marking Matrices ============================== */
function ScoreMatricsTab({ account }) {
  const [expanded, setExpanded] = useState(null);
  const open = (title, hint, block, area) => setExpanded({ title, hint, block, area });
  const areaScores = [
    account.relationshipHealth.score,
    account.projectHealth.score,
    account.whiteSpace.score,
    account.contractScoring.score,
    account.csat.score,
    account.riskScoring.score,
    account.resourceHealth.score,
    account.financialHealth.score,
  ];
  const overallScore = parseFloat(
    (areaScores.reduce((a, b) => a + b, 0) / areaScores.length).toFixed(1),
  );
  return (
    <div className="space-y-6">
      {/* All 8 health areas + overall at a glance */}
      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
        <ScoreCard
          title="Overall"
          score={overallScore}
          subtitle={`${account.trend >= 0 ? "+" : ""}${account.trend}%`}
          bold
        />
        <ScoreCard title="Relationship" score={account.relationshipHealth.score} />
        <ScoreCard title="Project" score={account.projectHealth.score} />
        <ScoreCard title="White Space" score={account.whiteSpace.score} />
        <ScoreCard title="Contract" score={account.contractScoring.score} />
        <ScoreCard title="CSAT" score={account.csat.score} />
        <ScoreCard title="Risk" score={account.riskScoring.score} inverse />
        <ScoreCard title="Resources" score={account.resourceHealth.score} />
        <ScoreCard title="Financial" score={account.financialHealth.score} />
      </div>

      <ScoreBlock
        title="Relationship Health"
        hint="Meetups, monthly meetings, director meetings, cooperation"
        block={account.relationshipHealth}
        onExpand={() =>
          open(
            "Relationship Health",
            "Meetups, monthly meetings, director meetings, cooperation",
            account.relationshipHealth,
            "relationship",
          )
        }
      />
      <ScoreBlock
        title="Project Health"
        hint="Deliverables, feedback, quality/defects, scope & change"
        block={account.projectHealth}
        onExpand={() =>
          open(
            "Project Health",
            "Deliverables, feedback, quality/defects, scope & change",
            account.projectHealth,
            "project",
          )
        }
      />
      <ScoreBlock
        title="White Space Analysis"
        hint="Meeting cadence, upsell capacity, services penetration"
        block={account.whiteSpace}
        onExpand={() =>
          open(
            "White Space Analysis",
            "Meeting cadence, upsell capacity, services penetration",
            account.whiteSpace,
            "white_space",
          )
        }
      />
      <ContractScoringBlock
        account={account}
        onExpand={() =>
          open(
            "Contract Scoring",
            "Type, duration, terms, compliance, SWOT, customer feedback",
            account.contractScoring,
            "contract",
          )
        }
      />
      <ScoreBlock
        title="Customer Satisfaction Score"
        hint="NPS, surveys, ticket CSAT, exec sentiment"
        block={account.csat}
        onExpand={() =>
          open(
            "Customer Satisfaction Score",
            "NPS, surveys, ticket CSAT, exec sentiment",
            account.csat,
            "csat",
          )
        }
      />
      <ScoreBlock
        title="Risk Scoring"
        hint="Competitors, geopolitical, POC churn, payments, C-level changes"
        block={account.riskScoring}
        onExpand={() =>
          open(
            "Risk Scoring",
            "Competitors, geopolitical, POC churn, payments, C-level changes",
            account.riskScoring,
            "risk",
          )
        }
      />
      <ResourceHealthBlock
        account={account}
        onExpand={() =>
          open(
            "Resources Health",
            "Backup coverage, leaves, critical roles, team size",
            account.resourceHealth,
            "resource",
          )
        }
      />
      <ScoreBlock
        title="Financial Health"
        hint="Revenue generation & resource allocation efficiency"
        block={account.financialHealth}
        onExpand={() =>
          open(
            "Financial Health",
            "Revenue generation & resource allocation efficiency",
            account.financialHealth,
            "financial",
          )
        }
      />

      {expanded && (
        <KpiEditorModal
          title={expanded.title}
          hint={expanded.hint}
          block={expanded.block}
          area={expanded.area}
          accountId={account.id}
          onClose={() => setExpanded(null)}
        />
      )}
    </div>
  );
}
function ScoreCard({ title, score, subtitle, inverse, bold }) {
  const good = inverse ? score >= 7 : score >= 8;
  const ok = inverse ? score >= 5 : score >= 6;
  const color = good ? "text-success" : ok ? "text-warn" : "text-crit";
  return (
    <div className={`bg-card border rounded-xl p-3 ${bold ? "ring-2 ring-primary" : ""}`}>
      <p
        className={`uppercase tracking-widest text-muted-foreground font-bold truncate ${bold ? "text-[10px]" : "text-[9px]"}`}
      >
        {title}
      </p>
      <p className={`font-bold mt-0.5 ${bold ? "text-2xl" : "text-xl"} ${color}`}>
        {score.toFixed(1)}
        <span className="text-[10px] text-muted-foreground">/10</span>
      </p>
      {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}
function ScoreBlock({ title, hint, block, onExpand }) {
  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="px-4 md:px-6 py-4 border-b flex justify-between items-start gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold">{title}</h3>
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <p className="text-2xl font-bold">
            {block.score.toFixed(1)}
            <span className="text-xs text-muted-foreground">/10</span>
          </p>
          {onExpand && (
            <button
              onClick={onExpand}
              className="size-8 rounded-md border flex items-center justify-center hover:bg-accent hover:text-white transition-colors"
              aria-label={`Expand ${title}`}
              title="Open KPI editor"
            >
              <Maximize2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4">
        {block.metrics.map((m) => (
          <Metric key={m.label} m={m} />
        ))}
      </div>
    </div>
  );
}
// Area-specific KPI section templates - minimum 2 meaningful subtasks each, weights sum to 100
const AREA_KPI_DEFAULTS = {
  relationship: [
    {
      name: "CEO & Executive Engagement",
      fields: [
        { label: "CEO-to-CEO meeting held this quarter", weight: 40 },
        { label: "Director-level meeting completed on schedule", weight: 35 },
        { label: "Executive sponsor actively engaged", weight: 25 },
      ],
    },
    {
      name: "Meeting Cadence",
      fields: [
        { label: "Monthly cadence meetings held on schedule", weight: 50 },
        { label: "Action items closed before next cycle", weight: 30 },
        { label: "Meeting notes shared within 24 hours", weight: 20 },
      ],
    },
    {
      name: "Cooperation & Trust",
      fields: [
        { label: "Client responsive to requests within 48 hours", weight: 60 },
        { label: "Joint planning or roadmap session completed", weight: 40 },
      ],
    },
  ],
  project: [
    {
      name: "Delivery Performance",
      fields: [
        { label: "Sprint or milestone delivered on time", weight: 50 },
        { label: "Defect rate within agreed threshold", weight: 30 },
        { label: "No critical production incidents this cycle", weight: 20 },
      ],
    },
    {
      name: "Quality & Feedback",
      fields: [
        { label: "Client feedback positive this cycle", weight: 55 },
        { label: "Feedback actioned and communicated back to client", weight: 45 },
      ],
    },
    {
      name: "Scope & Change Control",
      fields: [
        { label: "Change requests formally reviewed and documented", weight: 50 },
        { label: "No unmanaged scope creep this cycle", weight: 50 },
      ],
    },
  ],
  white_space: [
    {
      name: "Service Penetration",
      fields: [
        { label: "More than 3 active services currently delivered", weight: 50 },
        { label: "At least 1 new service proposed this quarter", weight: 50 },
      ],
    },
    {
      name: "Upsell & Growth Signals",
      fields: [
        { label: "Upsell opportunity identified and logged in CRM", weight: 50 },
        { label: "White-space pitch scheduled with decision maker", weight: 50 },
      ],
    },
    {
      name: "Account Intelligence",
      fields: [
        { label: "Account notes updated this month", weight: 40 },
        { label: "Competitive landscape reviewed", weight: 30 },
        { label: "Stakeholder map current and verified", weight: 30 },
      ],
    },
  ],
  contract: [
    {
      name: "Contract Terms",
      fields: [
        { label: "Auto-renew clause in place", weight: 35 },
        { label: "Non-terminator clause signed", weight: 35 },
        { label: "Minimum one-year lock confirmed", weight: 30 },
      ],
    },
    {
      name: "Compliance & Renewal",
      fields: [
        { label: "Process compliance score above 7 out of 10", weight: 50 },
        { label: "Renewal conversation initiated 90 days before expiry", weight: 50 },
      ],
    },
    {
      name: "Commercial Terms",
      fields: [
        { label: "Annual price-hike clause agreed and documented", weight: 55 },
        { label: "Annual contract review meeting scheduled", weight: 45 },
      ],
    },
  ],
  csat: [
    {
      name: "NPS & Surveys",
      fields: [
        { label: "NPS score collected and above 7 this quarter", weight: 45 },
        { label: "Quarterly satisfaction survey completed", weight: 35 },
        { label: "Low-score responses addressed within 2 weeks", weight: 20 },
      ],
    },
    {
      name: "Support Quality",
      fields: [
        { label: "Support tickets resolved within SLA", weight: 55 },
        { label: "CSAT rating of 4 or above on closed tickets", weight: 45 },
      ],
    },
    {
      name: "Executive Sentiment",
      fields: [
        { label: "Executive sponsor expressed positive sentiment", weight: 55 },
        { label: "No major complaints or unresolved escalations", weight: 45 },
      ],
    },
  ],
  risk: [
    {
      name: "Competitive Risk",
      fields: [
        { label: "Competitor activity monitored and documented", weight: 45 },
        { label: "Defense strategy or counter-proposal ready", weight: 55 },
      ],
    },
    {
      name: "Relationship & POC Risk",
      fields: [
        {
          label: "Key POC stable - no resignation or transfer risk",
          weight: 50,
        },
        { label: "C-level sponsor accessible and engaged", weight: 50 },
      ],
    },
    {
      name: "Financial Risk",
      fields: [
        { label: "Invoice paid within agreed payment terms", weight: 55 },
        { label: "No overdue balance outstanding", weight: 45 },
      ],
    },
    {
      name: "Operational Risk",
      fields: [
        { label: "Compliance and regulatory requirements met", weight: 50 },
        { label: "No geopolitical disruptions impacting delivery", weight: 50 },
      ],
    },
  ],
  resource: [
    {
      name: "Backup & Continuity",
      fields: [
        { label: "Backup engineer assigned for every critical role", weight: 55 },
        { label: "Knowledge transfer documentation up to date", weight: 45 },
      ],
    },
    {
      name: "Staffing Stability",
      fields: [
        { label: "No unplanned attrition on account this month", weight: 50 },
        { label: "Planned leaves managed without delivery impact", weight: 50 },
      ],
    },
    {
      name: "Critical Resource Retention",
      fields: [
        { label: "Critical resources engaged and retained", weight: 55 },
        { label: "Succession plan in place for key technical roles", weight: 45 },
      ],
    },
  ],
  financial: [
    {
      name: "Revenue Performance",
      fields: [
        { label: "Monthly billing target met", weight: 50 },
        { label: "ARR growth on track versus annual plan", weight: 50 },
      ],
    },
    {
      name: "Margin & Efficiency",
      fields: [
        { label: "Resource utilization above 80 percent", weight: 50 },
        { label: "Cost overruns within 5 percent of budget", weight: 50 },
      ],
    },
    {
      name: "Commercial Growth",
      fields: [
        { label: "Upsell or expansion proposal submitted this quarter", weight: 55 },
        { label: "Renewal pipeline initiated before 90-day mark", weight: 45 },
      ],
    },
  ],
};
function buildDefaultSections(area, existingMetrics) {
  const templates = AREA_KPI_DEFAULTS[area] ?? AREA_KPI_DEFAULTS.relationship;
  return templates.map((tmpl, i) => ({
    id: `kpi-${area}-${i}`,
    metricId: existingMetrics[i]?.id ?? null,
    name: existingMetrics[i]?.label ?? tmpl.name,
    fields: tmpl.fields.map((f, j) => ({
      id: `${area}-${i}-${j}`,
      label: f.label,
      weight: f.weight,
      checked: false,
    })),
  }));
}

function getKpiBaseSections(area, block) {
  return block.kpiData ?? buildDefaultSections(area, block.metrics);
}

function mapKpiSectionsById(sections) {
  return new Map((sections ?? []).map((section) => [section.id, section]));
}

function mapKpiFieldsById(section) {
  return new Map((section?.fields ?? []).map((field) => [field.id, field]));
}

function kpiSectionValue(section = {}) {
  return compactHistoryParts([
    section.name ? `Section: ${section.name}` : null,
    Array.isArray(section.fields) ? `Fields: ${section.fields.length}` : null,
  ]);
}

function kpiFieldValue(field = {}) {
  return compactHistoryParts([
    field.label ? `Criterion: ${field.label}` : null,
    field.weight !== undefined ? `Weight: ${field.weight}%` : null,
    `Status: ${field.checked ? "Checked" : "Open"}`,
  ]);
}

function buildScoreMatrixHistoryChanges({
  title,
  oldScore,
  newScore,
  beforeSections,
  afterSections,
}) {
  const changes = [
    {
      field: `Score: ${title}`,
      oldValue: oldScore,
      newValue: newScore,
    },
  ];
  const beforeById = mapKpiSectionsById(beforeSections);
  const afterById = mapKpiSectionsById(afterSections);

  for (const [sectionId, section] of beforeById.entries()) {
    if (!afterById.has(sectionId)) {
      changes.push({
        field: `Score matrix section removed: ${title}`,
        oldValue: kpiSectionValue(section),
        newValue: null,
      });
    }
  }

  for (const [sectionId, section] of afterById.entries()) {
    const previousSection = beforeById.get(sectionId);
    if (!previousSection) {
      changes.push({
        field: `Score matrix section added: ${title}`,
        oldValue: null,
        newValue: kpiSectionValue(section),
      });
      for (const field of section.fields ?? []) {
        changes.push({
          field: `Score matrix criterion added: ${section.name}`,
          oldValue: null,
          newValue: kpiFieldValue(field),
        });
      }
      continue;
    }

    changes.push({
      field: `Score matrix section name: ${title}`,
      oldValue: previousSection.name,
      newValue: section.name,
    });

    const previousFields = mapKpiFieldsById(previousSection);
    const currentFields = mapKpiFieldsById(section);

    for (const [fieldId, field] of previousFields.entries()) {
      if (!currentFields.has(fieldId)) {
        changes.push({
          field: `Score matrix criterion removed: ${previousSection.name}`,
          oldValue: kpiFieldValue(field),
          newValue: null,
        });
      }
    }

    for (const [fieldId, field] of currentFields.entries()) {
      const previousField = previousFields.get(fieldId);
      if (!previousField) {
        changes.push({
          field: `Score matrix criterion added: ${section.name}`,
          oldValue: null,
          newValue: kpiFieldValue(field),
        });
        continue;
      }
      changes.push(
        {
          field: `Score matrix criterion label: ${section.name}`,
          oldValue: previousField.label,
          newValue: field.label,
        },
        {
          field: `Score matrix criterion weight: ${section.name} / ${field.label}`,
          oldValue: `${previousField.weight}%`,
          newValue: `${field.weight}%`,
        },
        {
          field: `Score matrix criterion status: ${section.name} / ${field.label}`,
          oldValue: previousField.checked ? "Checked" : "Open",
          newValue: field.checked ? "Checked" : "Open",
        },
      );
    }
  }

  return changes;
}

function KpiEditorModal({ title, hint, block, area, accountId, onClose }) {
  const { profile, session } = useAuth();
  const editable = getRolePermissions(profile?.role).write;
  const editorUser = profile?.name ?? "Unknown";
  const router = useRouter();
  const queryClient = useQueryClient();
  const saveActivityScoreSnapshot = useServerFn(upsertActivityScoreSnapshotServer);

  const [sections, setSections] = useState(() => {
    return getKpiBaseSections(area, block);
  });

  function addSection() {
    if (!editable) return;
    const idx = Date.now();
    setSections((prev) => [
      ...prev,
      { id: `kpi-${idx}`, name: `KPI Section ${prev.length + 1}`, fields: [] },
    ]);
  }
  function updateSection(id, fn) {
    setSections((prev) => prev.map((s) => (s.id === id ? fn(s) : s)));
  }
  function addField(sectionId) {
    if (!editable) return;
    updateSection(sectionId, (s) => ({
      ...s,
      fields: [
        ...s.fields,
        { id: `${sectionId}-${Date.now()}`, label: "New field", weight: 0, checked: false },
      ],
    }));
  }
  function removeField(sectionId, fieldId) {
    if (!editable) return;
    updateSection(sectionId, (s) => ({ ...s, fields: s.fields.filter((f) => f.id !== fieldId) }));
  }
  function updateField(sectionId, fieldId, patch) {
    if (!editable) return;
    updateSection(sectionId, (s) => ({
      ...s,
      fields: s.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)),
    }));
  }
  // dynamic scoring per section - /10 scale, consistent with ScoreBlock display
  const sectionScores = useMemo(
    () =>
      sections.map((s) => {
        const totalWeight = s.fields.reduce((acc, f) => acc + (Number(f.weight) || 0), 0);
        const earned = s.fields.reduce(
          (acc, f) => acc + (f.checked ? Number(f.weight) || 0 : 0),
          0,
        );
        const pct = totalWeight > 0 ? (earned / totalWeight) * 100 : 0;
        const scoreOutOfTen = (pct / 100) * 10;
        return { id: s.id, totalWeight, earned, pct, scoreOutOfTen };
      }),
    [sections],
  );
  const overallOutOfTen =
    sectionScores.length > 0
      ? sectionScores.reduce((acc, s) => acc + s.scoreOutOfTen, 0) / sectionScores.length
      : 0;
  const [saveError, setSaveError] = useState("");
  const { mutate: saveKpi, isPending: savingKpi } = useMutation({
    mutationFn: async () => {
      // Validate that every section's weights sum to 100 before saving
      const invalid = sections.filter((s) => {
        const total = s.fields.reduce((a, f) => a + (Number(f.weight) || 0), 0);
        return total !== 100;
      });
      if (invalid.length > 0) {
        const names = invalid.map((s) => {
          const total = s.fields.reduce((a, f) => a + (Number(f.weight) || 0), 0);
          return `"${s.name}" (Sum ${total}%)`;
        });
        throw new Error(
          `Fix weights before saving - each section must sum to 100%: ${names.join(", ")}`,
        );
      }
      const newScore = parseFloat(overallOutOfTen.toFixed(1));
      const metricUpdates = sections
        .map((s, idx) =>
          s.metricId
            ? {
                id: s.metricId,
                label: s.name,
                value: parseFloat(sectionScores[idx].scoreOutOfTen.toFixed(1)),
              }
            : null,
        )
        .filter(Boolean);
      await updateHealthBlock(accountId, area, newScore, metricUpdates, sections);
      await saveActivityScoreSnapshot({
        data: {
          authAccessToken: session?.access_token ?? "",
          accountId,
          parameter: scoreAreaToParameter(area),
          metric: title,
          score: newScore,
          source: "kpi_editor",
          notes: `Snapshot captured from KPI editor by ${editorUser}.`,
        },
      });
      await logAccountChanges(
        accountId,
        buildScoreMatrixHistoryChanges({
          title,
          oldScore: block.score.toFixed(1),
          newScore: newScore.toFixed(1),
          beforeSections: getKpiBaseSections(area, block),
          afterSections: sections,
        }),
        editorUser,
      );
      await refreshAccountRetentionGrowthScoring(accountId, editorUser).catch(() => null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account-history", accountId] });
      router.invalidate();
      onClose();
    },
    onError: (err) => setSaveError(err.message ?? "Save failed. Please try again."),
  });
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-stretch md:items-center justify-center md:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-background w-full md:max-w-5xl md:rounded-xl border shadow-2xl flex flex-col max-h-screen md:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="px-4 md:px-6 py-4 border-b flex items-start justify-between gap-3 sticky top-0 bg-background z-10">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-accent">
              KPI Editor - Dynamic Scoring
            </p>
            <h2 className="text-base md:text-lg font-bold truncate">{title}</h2>
            <p className="text-[11px] text-muted-foreground">{hint}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                Avg score
              </p>
              <p
                className={`text-2xl font-bold ${overallOutOfTen >= 8 ? "text-success" : overallOutOfTen >= 5 ? "text-warn" : "text-crit"}`}
              >
                {overallOutOfTen.toFixed(1)}
                <span className="text-xs text-muted-foreground">/10</span>
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={savingKpi}
              className="size-9 rounded-md border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* sections */}
        <div className="p-4 md:p-6 space-y-5 overflow-y-auto">
          {sections.map((section, idx) => {
            const ss = sectionScores[idx];
            const weightOk = ss.totalWeight === 100;
            return (
              <div key={section.id} className="border rounded-lg overflow-hidden">
                {/* section header */}
                <div className="px-4 py-3 bg-muted/30 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="size-6 rounded-md bg-accent/10 text-accent flex items-center justify-center text-[10px] font-bold font-mono shrink-0">
                      KPI
                    </span>
                    <input
                      value={section.name}
                      onChange={(e) =>
                        updateSection(section.id, (s) => ({ ...s, name: e.target.value }))
                      }
                      disabled={!editable}
                      className="font-semibold text-sm bg-transparent border-b border-transparent hover:border-muted-foreground/30 focus:border-accent focus:outline-none flex-1 min-w-0 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded ${weightOk ? "bg-success/10 text-success" : "bg-warn/10 text-warn"}`}
                      title={weightOk ? "Weights sum to 100" : "Weights should sum to 100"}
                    >
                      Sum {ss.totalWeight}%
                    </span>
                    <span
                      className={`text-sm font-bold ${ss.scoreOutOfTen >= 8 ? "text-success" : ss.scoreOutOfTen >= 5 ? "text-warn" : "text-crit"}`}
                    >
                      {ss.scoreOutOfTen.toFixed(1)}
                      <span className="text-[10px] text-muted-foreground">/10</span>
                    </span>
                    <button
                      onClick={() =>
                        editable && setSections((prev) => prev.filter((s) => s.id !== section.id))
                      }
                      disabled={!editable}
                      className="size-7 rounded hover:bg-crit/10 hover:text-crit flex items-center justify-center text-muted-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                      aria-label="Delete section"
                      title="Delete this KPI section"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                {/* dependent fields */}
                <ul className="divide-y">
                  {section.fields.map((f) => (
                    <li key={f.id} className="px-4 py-2.5 flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={f.checked}
                        disabled={!editable}
                        onChange={(e) =>
                          updateField(section.id, f.id, { checked: e.target.checked })
                        }
                        className="size-4 accent-accent shrink-0"
                      />
                      <input
                        value={f.label}
                        disabled={!editable}
                        onChange={(e) => updateField(section.id, f.id, { label: e.target.value })}
                        className="flex-1 min-w-0 text-xs bg-transparent border-b border-transparent hover:border-muted-foreground/30 focus:border-accent focus:outline-none px-1 py-0.5 disabled:cursor-not-allowed"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={f.weight}
                          disabled={!editable}
                          onChange={(e) =>
                            updateField(section.id, f.id, {
                              weight: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                            })
                          }
                          className="w-16 text-xs font-mono bg-background border rounded px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed"
                        />
                        <span className="text-[10px] font-mono text-muted-foreground">%</span>
                      </div>
                      <button
                        onClick={() => removeField(section.id, f.id)}
                        disabled={!editable}
                        className="size-7 rounded hover:bg-crit/10 hover:text-crit flex items-center justify-center text-muted-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                        aria-label="Remove field"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>

                {/* add field button */}
                <div className="px-4 py-2 border-t bg-muted/10">
                  <button
                    onClick={() => addField(section.id)}
                    disabled={!editable}
                    className="text-[11px] font-bold uppercase tracking-wider text-accent flex items-center gap-1 hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus className="size-3" /> Add dependent field
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* footer */}
        <div className="px-4 md:px-6 py-3 border-t flex flex-col gap-2 bg-muted/20 sticky bottom-0">
          {saveError && (
            <p className="text-xs text-crit bg-crit/10 border border-crit/20 rounded px-3 py-1.5">
              {saveError}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Scoring is dynamic - checked weights / total weight x 10
              </p>
              <button
                onClick={addSection}
                disabled={!editable}
                className="text-[11px] font-bold uppercase tracking-wider text-accent flex items-center gap-1 hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="size-3" /> Add KPI section
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                disabled={savingKpi}
                className="px-4 py-2 text-xs border rounded-md hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={() => saveKpi()}
                disabled={savingKpi || !editable}
                className="px-4 py-2 bg-accent text-white text-xs font-bold rounded-md disabled:opacity-50 flex items-center gap-1.5 hover:opacity-90 transition-opacity"
              >
                {savingKpi ? (
                  <>
                    <Loader2 className="size-3 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3" /> Save & Close
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
function Metric({ m }) {
  const ok = m.value >= 8;
  const warn = m.value >= 6 && m.value < 8;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-semibold">{m.label}</span>
        <span className="font-mono">{m.value.toFixed(1)}</span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${ok ? "bg-success" : warn ? "bg-warn" : "bg-crit"}`}
          style={{ width: `${(m.value / 10) * 100}%` }}
        />
      </div>
      {m.hint && <p className="text-[10px] text-muted-foreground mt-1">{m.hint}</p>}
    </div>
  );
}
function ContractScoringBlock({ account, onExpand }) {
  const c = account.contractScoring;
  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b flex justify-between items-start gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold">Contract Scoring</h3>
          <p className="text-[11px] text-muted-foreground">
            Type, duration, value to us, SWOT, feedback, auto-renew & price hike
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <p className="text-2xl font-bold">
            {c.score.toFixed(1)}
            <span className="text-xs text-muted-foreground">/10</span>
          </p>
          {onExpand && (
            <button
              onClick={onExpand}
              className="size-8 rounded-md border flex items-center justify-center hover:bg-accent hover:text-white transition-colors"
              aria-label="Edit Contract KPIs"
              title="Open KPI editor"
            >
              <Maximize2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      {c.metrics.length > 0 && (
        <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4">
          {c.metrics.map((m) => (
            <Metric key={m.label} m={m} />
          ))}
        </div>
      )}
    </div>
  );
}
function ContractFact({ label, value }) {
  const displayValue = hasSyncValue(value) && value !== "—" ? value : "—";
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-semibold">{displayValue}</p>
    </div>
  );
}
function ResourceHealthBlock({ account, onExpand }) {
  const r = account.resourceHealth;
  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b flex justify-between items-start gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold">Resources Health</h3>
          <p className="text-[11px] text-muted-foreground">
            Backup, leaves, critical roles, team size
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <p className="text-2xl font-bold">
            {r.score.toFixed(1)}
            <span className="text-xs text-muted-foreground">/10</span>
          </p>
          {onExpand && (
            <button
              onClick={onExpand}
              className="size-8 rounded-md border flex items-center justify-center hover:bg-accent hover:text-white transition-colors"
              aria-label="Edit Resources KPIs"
              title="Open KPI editor"
            >
              <Maximize2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4">
        {r.metrics.map((m) => (
          <Metric key={m.label} m={m} />
        ))}
      </div>
    </div>
  );
}
/* ============================== TAB 3: Activity to Increase Score ============================== */
function ActivityTab({ account, opportunities, escalations, session }) {
  const { profile } = useAuth();
  if (account) {
    return (
      <ActivityTabPlanner
        account={account}
        opportunities={opportunities}
        escalations={escalations}
        profile={profile}
        session={session}
      />
    );
  }
  const editable = getRolePermissions(profile?.role).write;
  const ragColor = { R: "bg-crit", A: "bg-warn", G: "bg-success" };
  const areas = ["Profit", "Project", "Resource", "Financial", "Relationship"];
  const accountOpportunities = opportunities;
  return (
    <div className="space-y-6">
      {/* Opportunities - new signals KAM can crack */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex items-start gap-3">
            <span className="size-9 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <Lightbulb className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold">Opportunities for {account.name}</h3>
              <p className="text-[11px] text-muted-foreground">
                New signals surfaced from calls, filings and procurement events - pick one to crack.
              </p>
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground self-start md:self-auto">
            {accountOpportunities.length} open
          </span>
        </div>
        {accountOpportunities.length ? (
          <ul className="divide-y">
            {accountOpportunities.map((o) => (
              <li
                key={o.id}
                className="px-4 md:px-6 py-3 flex flex-col md:flex-row md:items-center gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug">{o.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {o.source} - signal {o.signalDate} -{" "}
                    <span className="text-accent font-semibold">Next: {o.nextStep}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      o.confidence === "High"
                        ? "bg-success/10 text-success"
                        : o.confidence === "Medium"
                          ? "bg-warn/10 text-warn"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {o.confidence}
                  </span>
                  <span className="text-sm font-bold text-success whitespace-nowrap">
                    {formatOpportunityPotential(o.potential)}
                  </span>
                  <button
                    disabled={!editable}
                    className="text-[10px] font-bold uppercase tracking-wider text-accent disabled:opacity-40 whitespace-nowrap"
                  >
                    Pursue -&gt;
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-6 py-6 text-xs text-muted-foreground">
            No open opportunities surfaced right now.
          </p>
        )}
      </div>

      <div className="bg-card border rounded-xl p-6">
        <h3 className="text-sm font-bold mb-2">RAG Analysis</h3>
        <p className="text-[11px] text-muted-foreground mb-4">
          Each activity is rated Red / Amber / Green by urgency.
        </p>
        <div className="grid grid-cols-3 gap-4">
          {["R", "A", "G"].map((rag) => {
            const items = account.activities.filter((a) => a.rag === rag);
            return (
              <div key={rag} className="border rounded-lg overflow-hidden">
                <div
                  className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white ${ragColor[rag]}`}
                >
                  {rag === "R" ? "Red - Act now" : rag === "A" ? "Amber - Plan" : "Green - Monitor"}
                  <span className="ml-2 opacity-80">({items.length})</span>
                </div>
                <ul className="p-3 space-y-2 text-xs">
                  {items.length ? (
                    items.map((a) => (
                      <li key={a.id} className="border-b last:border-0 pb-2 last:pb-0">
                        <p className="font-semibold">{a.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {a.area} - {a.owner} - {a.due}
                        </p>
                      </li>
                    ))
                  ) : (
                    <li className="text-muted-foreground text-[11px]">None</li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action items extracted from meeting notes */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold">Meeting Insights to Improve Account Score</h3>
            <p className="text-[11px] text-muted-foreground">
              Auto-extracted from the last 5 meeting transcripts - accept to push into the
              activities backlog.
            </p>
          </div>
          <button
            disabled={!editable}
            className="text-[10px] font-bold text-accent uppercase tracking-wider disabled:opacity-40"
          >
            Re-run extraction
          </button>
        </div>
        <ul className="divide-y">
          {[
            {
              src: "QBR - 18 May",
              text: "Share 2026 product roadmap deck with sponsor by Friday.",
              lift: "+2 Relationship",
            },
            {
              src: "Weekly Sync - 15 May",
              text: "Schedule architecture review with their new CTO.",
              lift: "+3 Project",
            },
            {
              src: "Escalation Call - 13 May",
              text: "Send written RCA + service-credit memo within 48h.",
              lift: "+4 CSAT",
            },
            {
              src: "Discovery - 09 May",
              text: "Pitch EMEA fulfillment node - confirmed budget exists.",
              lift: "+$120k Growth",
            },
          ].map((it, i) => (
            <li key={i} className="px-6 py-3 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug">{it.text}</p>
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-1">
                  Source: {it.src}
                </p>
              </div>
              <span className="text-[10px] font-bold text-success bg-success/10 px-2 py-0.5 rounded whitespace-nowrap">
                {it.lift}
              </span>
              <button
                disabled={!editable}
                className="text-[10px] font-bold text-accent uppercase tracking-wider disabled:opacity-40 whitespace-nowrap"
              >
                + Add
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold">Activities Across Health Areas</h3>
            <p className="text-[11px] text-muted-foreground">
              Improvement actions for profit, project, resource, financial & relationship health
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              disabled={!editable}
              className="text-[10px] font-bold text-accent uppercase tracking-wider disabled:opacity-40"
            >
              + Add Activity
            </button>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Last sync with Jira - 4m ago
            </p>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b">
              <th className="px-6 py-3">Area</th>
              <th className="px-6 py-3">Activity</th>
              <th className="px-6 py-3">Owner</th>
              <th className="px-6 py-3">Due</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">RAG</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {areas.flatMap((area) =>
              account.activities
                .filter((a) => a.area === area)
                .map((a) => (
                  <tr key={a.id} className="hover:bg-muted/30">
                    <td className="px-6 py-3 text-xs font-semibold">{a.area}</td>
                    <td className="px-6 py-3 text-xs">{a.title}</td>
                    <td className="px-6 py-3 text-xs text-muted-foreground">{a.owner}</td>
                    <td className="px-6 py-3 text-xs">{a.due}</td>
                    <td className="px-6 py-3 text-xs">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          a.status === "Done"
                            ? "bg-success/10 text-success"
                            : a.status === "In Progress"
                              ? "bg-accent/10 text-accent"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-block size-2.5 rounded-full ${ragColor[a.rag]}`} />
                    </td>
                  </tr>
                )),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OpportunitiesTab({ account, opportunities, escalations }) {
  const { profile } = useAuth();
  const role = profile?.role ?? "KAM";
  const isAssignedKam = role === "KAM" ? account.assignedKamId === profile?.id : false;
  const canAct = role === "Head of KAM" || (role === "KAM" && isAssignedKam);
  const queryClient = useQueryClient();
  const syncSummaryOpportunities = useServerFn(syncSummaryOpportunitiesServer);
  const { data: scoreHistory = [] } = useQuery({
    queryKey: ["activity-score-history", account.id],
    queryFn: () => fetchActivityScoreHistory(account.id),
    enabled: Boolean(account.id),
  });
  const { data: thresholdOverrides = [] } = useQuery({
    queryKey: ["activity-threshold-overrides", account.id],
    queryFn: () => fetchActivityRuleThresholdOverrides(account.id),
    enabled: Boolean(account.id),
  });
  const { data: savedRuleActivities = [] } = useQuery({
    queryKey: ["activity-rule-activities", account.id],
    queryFn: () => fetchActivityRuleActivities(account.id),
    enabled: Boolean(account.id),
  });
  const { data: accountOpenTasks = [] } = useQuery({
    queryKey: ["account-open-action-items", account.id],
    queryFn: () => fetchKamTasks({ accountId: account.id }),
    enabled: Boolean(account.id),
  });
  const hasSummarySources = Boolean(
    account.linkedinSummary?.trim() || account.websiteSummary?.trim(),
  );
  const summarySourceKey = [
    account.linkedinSummaryUpdatedAt ?? "",
    account.websiteSummaryUpdatedAt ?? "",
    account.linkedinSummary?.length ?? 0,
    account.websiteSummary?.length ?? 0,
  ].join("|");
  const {
    data: summaryOpportunitySync,
    isFetching: syncingSummaryOpportunities,
    error: summaryOpportunityError,
  } = useQuery({
    queryKey: ["summary-opportunity-sync", account.id, summarySourceKey],
    queryFn: () => syncSummaryOpportunities({ data: { accountId: account.id } }),
    enabled: Boolean(account.id && hasSummarySources),
    staleTime: 60 * 60 * 1000,
  });
  const model = useMemo(
    () =>
      buildActivityTabModel({
        account,
        opportunities,
        escalations,
        scoreHistory,
        thresholdOverrides,
      }),
    [account, escalations, opportunities, scoreHistory, thresholdOverrides],
  );

  const [resolvedItems, setResolvedItems] = useState({});
  const [confirmActionTarget, setConfirmActionTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [opportunityStatus, setOpportunityStatus] = useState("");
  const [pursuingOpportunityId, setPursuingOpportunityId] = useState("");
  const [opportunityPage, setOpportunityPage] = useState(1);

  useEffect(() => {
    setResolvedItems({});
    setConfirmActionTarget(null);
    setRejectTarget(null);
    setRejectReason("");
    setOpportunityStatus("");
    setPursuingOpportunityId("");
    setOpportunityPage(1);
  }, [account.id]);

  useEffect(() => {
    if (!summaryOpportunitySync?.syncedAt) return;
    queryClient.invalidateQueries({ queryKey: ["opportunities", account.id] });
  }, [account.id, queryClient, summaryOpportunitySync?.syncedAt]);

  const persistedOpportunityRefs = useMemo(
    () =>
      new Set(
        savedRuleActivities
          .filter((activity) => activity.sourceType === "opportunity")
          .map((activity) => activity.sourceRef)
          .filter((sourceRef) => sourceRef && sourceRef !== "manual"),
      ),
    [savedRuleActivities],
  );
  const isResolved = useCallback(
    (item) =>
      Boolean(
        resolvedItems[item.id] ||
        resolvedItems[getSuggestionSourceRef(item)] ||
        persistedOpportunityRefs.has(getSuggestionSourceRef(item)),
      ),
    [persistedOpportunityRefs, resolvedItems],
  );
  const openTaskTitleKeys = useMemo(
    () => new Set((accountOpenTasks ?? []).map((task) => normalizeActivityText(task.title))),
    [accountOpenTasks],
  );
  const activeOpportunities = model.opportunities.filter(
    (item) => !isResolved(item) && !openTaskTitleKeys.has(normalizeActivityText(item.title)),
  );
  const rejectedOpportunityHistory = useMemo(
    () =>
      savedRuleActivities
        .filter(
          (activity) => activity.status === "Rejected" && activity.sourceType === "opportunity",
        )
        .map(mapRejectedHistoryItem),
    [savedRuleActivities],
  );
  const opportunityPageSize = 5;
  const opportunityPageCount = Math.max(
    1,
    Math.ceil(activeOpportunities.length / opportunityPageSize),
  );
  const safeOpportunityPage = Math.min(opportunityPage, opportunityPageCount);
  const opportunityPageStart = activeOpportunities.length
    ? (safeOpportunityPage - 1) * opportunityPageSize
    : 0;
  const pagedOpportunities = activeOpportunities.slice(
    opportunityPageStart,
    opportunityPageStart + opportunityPageSize,
  );

  useEffect(() => {
    setOpportunityPage(1);
  }, [account.id, activeOpportunities.length]);

  const { mutate: pursueOpportunityActionItem } = useMutation({
    mutationFn: (opportunity) =>
      createAccountActionItemTask({
        accountId: account.id,
        title: opportunity.title,
        description: opportunity.nextStep,
        reason: opportunity.reason ?? opportunity.nextStep,
        source: `Opportunity: ${opportunity.source}`,
        healthArea: opportunity.healthArea,
        expectedLift:
          opportunity.expectedLift ??
          `+${formatCurrency(opportunity.potentialValue ?? 0)} potential`,
        editedBy: profile?.name ?? "Unknown",
      }),
    onMutate: (opportunity) => {
      setPursuingOpportunityId(opportunity.id);
      setOpportunityStatus("");
    },
    onSuccess: (_, opportunity) => {
      setResolvedItems((current) => ({
        ...current,
        [opportunity.id]: {
          status: "saved",
          reviewedAt: new Date().toISOString(),
        },
        [getSuggestionSourceRef(opportunity)]: {
          status: "saved",
          reviewedAt: new Date().toISOString(),
        },
      }));
      setOpportunityStatus(
        `Added "${opportunity.title}" to My Open Action Items on the dashboard and removed it from Opportunities.`,
      );
      queryClient.invalidateQueries({ queryKey: ["dashboard-action-items"] });
      queryClient.invalidateQueries({ queryKey: ["account-open-action-items", account.id] });
      queryClient.invalidateQueries({ queryKey: ["account-history", account.id] });
    },
    onError: (error) => {
      setOpportunityStatus(error?.message ?? "Could not add this opportunity to action items.");
    },
    onSettled: () => {
      setPursuingOpportunityId("");
    },
  });

  const { mutate: rejectRuleActivity, isPending: rejectingRuleActivity } = useMutation({
    mutationFn: async ({ target, reason }) => {
      const rejectedActivity = await rejectActivityRuleSuggestion(
        buildRejectedRuleActivityInput({
          accountId: account.id,
          target,
          reason,
          reviewer: profile?.name ?? "Unknown",
        }),
      );
      await logActivityHistoryChange({
        accountId: account.id,
        profile,
        changes: [
          {
            field: "Activity rejected",
            oldValue: buildActivityHistoryValue(target),
            newValue: buildRejectedActivityHistoryValue(target, reason, rejectedActivity),
          },
        ],
      });

      if (target.sourceKind === "meeting") {
        await markMeetingInsightActionItemState({
          accountId: account.id,
          requestedBy: profile?.id,
          item: target,
          sourceRef: getSuggestionSourceRef(target),
          status: "dismissed",
        });
      }
      return rejectedActivity;
    },
    onSuccess: (_, { target, reason }) => {
      setResolvedItems((current) => ({
        ...current,
        [target.id]: {
          status: "rejected",
          reason,
          reviewedAt: new Date().toISOString(),
        },
        [getSuggestionSourceRef(target)]: {
          status: "rejected",
          reason,
          reviewedAt: new Date().toISOString(),
        },
      }));
      queryClient.invalidateQueries({ queryKey: ["activity-rule-activities", account.id] });
      queryClient.invalidateQueries({ queryKey: ["account-history", account.id] });
      setOpportunityStatus(`Rejected "${target.title}".`);
      setRejectTarget(null);
      setRejectReason("");
    },
  });

  function confirmReject() {
    if (!rejectTarget || !rejectReason.trim()) return;
    rejectRuleActivity({ target: rejectTarget, reason: rejectReason.trim() });
  }

  function requestPursueOpportunity(opportunity) {
    setConfirmActionTarget({
      kind: "opportunity-pursue",
      item: opportunity,
      title: "Pursue this opportunity?",
      description:
        "This will create a My Open Action Items task on the dashboard and remove this opportunity from the active planning list.",
      confirmLabel: "Pursue opportunity",
    });
  }

  function confirmActionTargetChange() {
    if (!confirmActionTarget) return;
    if (confirmActionTarget.kind === "opportunity-pursue") {
      pursueOpportunityActionItem(confirmActionTarget.item);
    }
    setConfirmActionTarget(null);
  }

  return (
    <div className="space-y-6">
      {role === "KAM" && !isAssignedKam && (
        <div className="rounded-xl border border-warn/30 bg-warn/5 px-4 py-3 text-sm">
          <p className="font-semibold text-warn">View-only opportunities for this account</p>
          <p className="text-[12px] text-muted-foreground mt-1">
            Only the assigned KAM can pursue or reject opportunity suggestions here.
          </p>
        </div>
      )}

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex items-start gap-3">
            <span className="size-9 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <Lightbulb className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold">Opportunities related to {account.name}</h3>
              <p className="text-[11px] text-muted-foreground">
                Client-specific opportunities sourced from LinkedIn summary, website summary,
                account context, escalation signals, retention/growth context, and meeting notes.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start md:items-end gap-1 self-start md:self-auto">
            <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
              {activeOpportunities.length} open
            </span>
            {syncingSummaryOpportunities && (
              <span className="text-[10px] font-semibold text-accent">Scanning summaries...</span>
            )}
          </div>
        </div>

        {(opportunityStatus || summaryOpportunityError) && (
          <div className="px-4 md:px-6 py-2 border-b">
            <p
              className={`text-[11px] font-medium ${
                summaryOpportunityError ? "text-crit" : "text-success"
              }`}
            >
              {summaryOpportunityError?.message ?? opportunityStatus}
            </p>
          </div>
        )}

        {activeOpportunities.length ? (
          <ul className="divide-y">
            {pagedOpportunities.map((opportunity) => (
              <li key={opportunity.id} className="px-4 md:px-6 py-4 space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold leading-snug">{opportunity.title}</p>
                      <PriorityBadge priority={opportunity.priority} />
                      <ConfidenceBadge confidence={opportunity.confidence} />
                      <AreaBadge area={opportunity.healthArea} />
                      {opportunity.approvalRequired && (
                        <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-warn/10 text-warn px-2 py-1">
                          Approval required
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {opportunity.source} - {opportunity.signalDate}
                    </p>
                    <ScoreRuleDetails item={opportunity} />
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button
                      size="sm"
                      disabled={!canAct || pursuingOpportunityId === opportunity.id}
                      onClick={() => requestPursueOpportunity(opportunity)}
                    >
                      {pursuingOpportunityId === opportunity.id && (
                        <Loader2 className="size-3.5 animate-spin mr-1" />
                      )}
                      Pursue
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!canAct || pursuingOpportunityId === opportunity.id}
                      onClick={() => setRejectTarget({ ...opportunity, sourceKind: "opportunity" })}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-6 py-6 text-xs text-muted-foreground">
            No open opportunities are active in this planning cycle.
          </p>
        )}
        {activeOpportunities.length > opportunityPageSize && (
          <PaginatedListFooter
            page={safeOpportunityPage}
            pageSize={opportunityPageSize}
            total={activeOpportunities.length}
            onPageChange={setOpportunityPage}
            itemLabel="opportunities"
          />
        )}
        <RejectedHistoryDisclosure
          title="Rejected Opportunities"
          items={rejectedOpportunityHistory}
          emptyText="No rejected opportunities yet."
        />
      </div>

      <ConfirmActionDialog
        target={confirmActionTarget}
        onClose={() => setConfirmActionTarget(null)}
        onConfirm={confirmActionTargetChange}
        isSaving={Boolean(pursuingOpportunityId)}
      />

      <RejectRecommendationDialog
        target={rejectTarget}
        value={rejectReason}
        onChange={setRejectReason}
        onClose={() => {
          setRejectTarget(null);
          setRejectReason("");
        }}
        onConfirm={confirmReject}
        isSaving={rejectingRuleActivity}
      />
    </div>
  );
}

function PaginatedListFooter({ page, pageSize, total, onPageChange, itemLabel = "items" }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = total ? (safePage - 1) * pageSize + 1 : 0;
  const end = Math.min(safePage * pageSize, total);

  return (
    <div className="px-4 md:px-6 py-3 border-t bg-muted/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <p className="text-[11px] text-muted-foreground">
        Showing {start}-{end} of {total} {itemLabel}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={safePage <= 1}
          onClick={() => onPageChange((current) => Math.max(1, current - 1))}
        >
          Previous
        </Button>
        <span className="text-[11px] font-semibold text-muted-foreground">
          Page {safePage} of {pageCount}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={safePage >= pageCount}
          onClick={() => onPageChange((current) => Math.min(pageCount, current + 1))}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function RejectedHistoryDisclosure({ title, items, emptyText }) {
  return (
    <details className="border-t bg-muted/10 group">
      <summary className="list-none cursor-pointer px-4 md:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="size-8 rounded-md bg-crit/10 text-crit flex items-center justify-center shrink-0">
            <History className="size-4" />
          </span>
          <span>
            <span className="block text-xs font-bold">{title}</span>
            <span className="block text-[11px] text-muted-foreground">
              {items.length
                ? `${items.length} rejected item${items.length === 1 ? "" : "s"} saved for review`
                : emptyText}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {items.length} rejected
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </span>
      </summary>

      <div className="border-t bg-background/70">
        {items.length ? (
          <div className="max-h-72 overflow-y-auto divide-y">
            {items.map((item) => (
              <div key={item.id} className="px-4 md:px-6 py-3 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-snug">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {item.sourceLabel}
                      {item.area ? ` - ${item.area}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide rounded-full bg-crit/10 text-crit px-2 py-1">
                    Rejected
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">Reason:</span> {item.reason}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Rejected by {item.reviewer} - {item.date}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-4 md:px-6 py-4 text-xs text-muted-foreground">{emptyText}</p>
        )}
      </div>
    </details>
  );
}

function ActivityTabPlanner({ account, opportunities, escalations, profile, session }) {
  const role = profile?.role ?? "KAM";
  const isAssignedKam = role === "KAM" ? account.assignedKamId === profile?.id : false;
  const canAct = role === "Head of KAM" || (role === "KAM" && isAssignedKam);
  const queryClient = useQueryClient();
  const router = useRouter();
  const saveActivityScoreSnapshot = useServerFn(upsertActivityScoreSnapshotServer);
  const { data: scoreHistory = [] } = useQuery({
    queryKey: ["activity-score-history", account.id],
    queryFn: () => fetchActivityScoreHistory(account.id),
    enabled: Boolean(account.id),
  });
  const { data: thresholdOverrides = [] } = useQuery({
    queryKey: ["activity-threshold-overrides", account.id],
    queryFn: () => fetchActivityRuleThresholdOverrides(account.id),
    enabled: Boolean(account.id),
  });
  const { data: savedRuleActivities = [] } = useQuery({
    queryKey: ["activity-rule-activities", account.id],
    queryFn: () => fetchActivityRuleActivities(account.id),
    enabled: Boolean(account.id),
  });
  const { data: stagedAiRecommendationRows } = useQuery({
    queryKey: ["staged-ai-recommendations", account.id],
    queryFn: () =>
      fetchStagedAiRecommendations({
        accountId: account.id,
      }),
    enabled: Boolean(account.id),
  });
  const { data: meetingInsightActionStates } = useQuery({
    queryKey: ["meeting-insight-action-states", account.id],
    queryFn: () => fetchMeetingInsightActionStates({ accountId: account.id }),
    enabled: Boolean(account.id),
  });
  const { data: accountOpenTasks } = useQuery({
    queryKey: ["account-open-action-items", account.id],
    queryFn: () => fetchKamTasks({ accountId: account.id }),
    enabled: Boolean(account.id),
  });
  const model = useMemo(
    () =>
      buildActivityTabModel({
        account,
        opportunities,
        escalations,
        scoreHistory,
        thresholdOverrides,
      }),
    [account, escalations, opportunities, scoreHistory, thresholdOverrides],
  );

  const [resolvedItems, setResolvedItems] = useState({});
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewForm, setReviewForm] = useState(createInitialReviewForm(null, profile?.name));
  const [confirmActionTarget, setConfirmActionTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [firefliesActions, setFirefliesActions] = useState([]);
  const [firefliesStatus, setFirefliesStatus] = useState("");
  const [activityAreaFilter, setActivityAreaFilter] = useState("All");
  const [expectedLiftSort, setExpectedLiftSort] = useState("desc");
  const [activitySortMode, setActivitySortMode] = useState("score");
  const [activityPage, setActivityPage] = useState(1);
  const [activityPageSize, setActivityPageSize] = useState(10);
  const [meetingInsightPage, setMeetingInsightPage] = useState(1);
  const [activityStatus, setActivityStatus] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [selectedAiRecommendations, setSelectedAiRecommendations] = useState([]);
  const [aiSuggestionRequested, setAiSuggestionRequested] = useState(false);
  const [addingAiSuggestionId, setAddingAiSuggestionId] = useState("");
  const [aiSuggestionStatus, setAiSuggestionStatus] = useState("");
  const [aiSuggestionWarning, setAiSuggestionWarning] = useState("");
  const [aiSuggestionError, setAiSuggestionError] = useState("");
  const [aiRecommendationSheetOpen, setAiRecommendationSheetOpen] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState(null);
  const [scheduleForm, setScheduleForm] = useState(null);

  const { mutate: rerunFirefliesExtraction, isPending: extractingFireflies } = useMutation({
    mutationFn: () =>
      fetchFirefliesRequiredActionItems({
        data: {
          accountId: account.id,
          limit: 5,
          daysBack: 60,
          actorAccessToken: session?.access_token,
        },
      }),
    onSuccess: (result) => {
      setFirefliesActions([]);
      setFirefliesStatus(result.status ?? "Fireflies extraction completed.");
      queryClient.invalidateQueries({ queryKey: ["fireflies-meeting-summaries", account.id] });
      queryClient.invalidateQueries({ queryKey: ["activity-rule-activities", account.id] });
      queryClient.invalidateQueries({ queryKey: ["opportunities", account.id] });
      queryClient.invalidateQueries({ queryKey: ["account-history", account.id] });
    },
    onError: (error) => {
      setFirefliesStatus(error?.message ?? "Fireflies extraction failed.");
    },
  });

  const { mutate: requestAiSuggestions, isPending: generatingAiSuggestions } = useMutation({
    mutationFn: () => fetchKamAiSuggestions({ data: { accountId: account.id } }),
    onMutate: () => {
      setAiSuggestionRequested(true);
      setAiSuggestionError("");
      setAiSuggestionWarning("");
      setAiSuggestionStatus("");
    },
    onSuccess: (result) => {
      const uniqueSuggestions = removeDuplicateAiSuggestions(
        result?.suggestions ?? [],
        activityRows,
      )
        .filter(
          (suggestion) =>
            !selectedAiRecommendations.some(
              (selected) =>
                normalizeActivityText(selected.title) === normalizeActivityText(suggestion.title),
            ),
        )
        .slice(0, 6);
      setAiSuggestions(uniqueSuggestions);

      if (result?.fallback) {
        setAiSuggestionWarning(
          result.status || "OpenAI was unavailable; showing local fallback suggestions.",
        );
        return;
      }

      setAiSuggestionStatus(
        result?.status ??
          (uniqueSuggestions.length
            ? `${uniqueSuggestions.length} best AI recommendation${uniqueSuggestions.length === 1 ? "" : "s"} generated for ${account.name}.`
            : "No strong AI recommendations found for this account."),
      );
    },
    onError: (error) => {
      setAiSuggestions([]);
      setAiSuggestionError(error?.message ?? "AI suggestions could not be generated.");
    },
  });

  const { mutate: saveRuleActivity, isPending: savingRuleActivity } = useMutation({
    mutationFn: async ({ target, form }) => {
      const createdActivity = await createActivityRuleActivity(
        buildActivityRuleActivityInput({
          accountId: account.id,
          target,
          form,
        }),
      );
      await logActivityHistoryChange({
        accountId: account.id,
        profile,
        changes: [
          {
            field: "Activity created",
            oldValue: null,
            newValue: buildSavedActivityHistoryValue(target, form, createdActivity),
          },
        ],
      });
      return createdActivity;
    },
    onSuccess: (_, { target }) => {
      setResolvedItems((current) => ({
        ...current,
        [target.item.id]: {
          status: "saved",
          reviewedAt: new Date().toISOString(),
        },
      }));
      queryClient.invalidateQueries({ queryKey: ["activity-rule-activities", account.id] });
      queryClient.invalidateQueries({ queryKey: ["account-history", account.id] });
      router.invalidate();
      closeReview();
    },
  });

  const { mutate: rejectRuleActivity, isPending: rejectingRuleActivity } = useMutation({
    mutationFn: async ({ target, reason }) => {
      const rejectedActivity = await rejectActivityRuleSuggestion(
        buildRejectedRuleActivityInput({
          accountId: account.id,
          target,
          reason,
          reviewer: profile?.name ?? "Unknown",
        }),
      );
      await logActivityHistoryChange({
        accountId: account.id,
        profile,
        changes: [
          {
            field: "Activity rejected",
            oldValue: buildActivityHistoryValue(target),
            newValue: buildRejectedActivityHistoryValue(target, reason, rejectedActivity),
          },
        ],
      });

      if (target.sourceKind === "meeting") {
        await markMeetingInsightActionItemState({
          accountId: account.id,
          requestedBy: profile?.id,
          item: target,
          sourceRef: getSuggestionSourceRef(target),
          status: "dismissed",
        });
      }
      return rejectedActivity;
    },
    onSuccess: (_, { target, reason }) => {
      setResolvedItems((current) => ({
        ...current,
        [target.id]: {
          status: "rejected",
          reason,
          reviewedAt: new Date().toISOString(),
        },
        [getSuggestionSourceRef(target)]: {
          status: "rejected",
          reason,
          reviewedAt: new Date().toISOString(),
        },
      }));
      queryClient.invalidateQueries({ queryKey: ["activity-rule-activities", account.id] });
      queryClient.invalidateQueries({ queryKey: ["account-history", account.id] });
      queryClient.invalidateQueries({ queryKey: ["meeting-insight-action-states", account.id] });
      if (target.sourceKind === "meeting") {
        setFirefliesStatus(
          `Rejected "${target.title}". The reason was saved and the insight was removed.`,
        );
      }
      setRejectTarget(null);
      setRejectReason("");
    },
  });

  const { mutate: markActivityDone, isPending: completingActivity } = useMutation({
    mutationFn: (payload) => completeActivityRow(payload),
    onSuccess: (result) => {
      setActivityStatus(result?.message ?? "Activity marked done.");
      queryClient.invalidateQueries({ queryKey: ["activity-rule-activities", account.id] });
      queryClient.invalidateQueries({ queryKey: ["account-history", account.id] });
      router.invalidate();
    },
    onError: (error) => {
      setActivityStatus(error?.message ?? "Could not mark this activity done.");
    },
  });

  const { mutate: addAiRecommendationActionItem } = useMutation({
    mutationFn: async (suggestion) => {
      const task = await createAccountActionItemTask({
        accountId: account.id,
        title: suggestion.title,
        description: suggestion.description,
        reason: suggestion.reason,
        source: suggestion.sourceSummary,
        healthArea: suggestion.healthArea,
        expectedLift: suggestion.expectedLift,
        editedBy: profile?.name ?? "Unknown",
      });
      await updateStagedAiRecommendationStatus({
        id: suggestion.id,
        status: "converted_to_action",
      });
      return task;
    },
    onMutate: (suggestion) => {
      setAddingAiSuggestionId(suggestion.id);
      setAiSuggestionError("");
      setAiSuggestionStatus("");
    },
    onSuccess: (_, suggestion) => {
      setSelectedAiRecommendations((current) =>
        current.filter((item) => item.id !== suggestion.id),
      );
      setAiSuggestionStatus(`Added "${suggestion.title}" to My Open Action Items.`);
      setAiSuggestionWarning("");
      setAiSuggestionError("");
      queryClient.invalidateQueries({ queryKey: ["dashboard-action-items"] });
      if (!suggestion.localOnly) {
        queryClient.invalidateQueries({
          queryKey: ["staged-ai-recommendations", account.id],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["account-open-action-items", account.id] });
      queryClient.invalidateQueries({ queryKey: ["account-history", account.id] });
    },
    onError: (error) => {
      setAiSuggestionError(error?.message ?? "AI recommendation could not be added.");
    },
    onSettled: () => {
      setAddingAiSuggestionId("");
    },
  });

  const { mutate: stageAiRecommendation } = useMutation({
    mutationFn: async (suggestion) => {
      const stagedRecommendation = await stageAccountAiRecommendation({
        accountId: account.id,
        requestedBy: profile?.id,
        suggestion,
      });
      await logActivityHistoryChange({
        accountId: account.id,
        profile,
        changes: [
          {
            field: "AI activity recommendation selected",
            oldValue: null,
            newValue: buildAiRecommendationHistoryValue(stagedRecommendation),
          },
        ],
      });
      return stagedRecommendation;
    },
    onMutate: (suggestion) => {
      setAddingAiSuggestionId(suggestion.id);
      setAiSuggestionError("");
      setAiSuggestionWarning("");
      setAiSuggestionStatus("");
    },
    onSuccess: (stagedRecommendation, suggestion) => {
      setAiSuggestions((current) => current.filter((item) => item.id !== suggestion.id));
      setSelectedAiRecommendations((current) => {
        if (
          current.some(
            (item) =>
              item.id === stagedRecommendation.id ||
              normalizeActivityText(item.title) ===
                normalizeActivityText(stagedRecommendation.title),
          )
        ) {
          return current;
        }
        return [...current, stagedRecommendation];
      });
      setAiSuggestionStatus(
        `Selected "${stagedRecommendation.title}". Add it to action items when ready.`,
      );
      if (!stagedRecommendation.localOnly) {
        queryClient.invalidateQueries({
          queryKey: ["staged-ai-recommendations", account.id],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["account-history", account.id] });
    },
    onError: (error) => {
      setAiSuggestionError(error?.message ?? "AI recommendation could not be staged.");
    },
    onSettled: () => {
      setAddingAiSuggestionId("");
    },
  });

  const { mutate: dismissStagedAiRecommendation } = useMutation({
    mutationFn: async (suggestion) => {
      const result = await updateStagedAiRecommendationStatus({
        id: suggestion.id,
        status: "dismissed",
      });
      await logActivityHistoryChange({
        accountId: account.id,
        profile,
        changes: [
          {
            field: "AI activity recommendation removed",
            oldValue: buildAiRecommendationHistoryValue(suggestion),
            newValue: "Dismissed",
          },
        ],
      });
      return result;
    },
    onMutate: (suggestion) => {
      setAddingAiSuggestionId(suggestion.id);
      setAiSuggestionError("");
      setAiSuggestionStatus("");
    },
    onSuccess: (_, suggestion) => {
      setSelectedAiRecommendations((current) =>
        current.filter((item) => item.id !== suggestion.id),
      );
      setAiSuggestionStatus(`Removed "${suggestion.title}" from selected recommendations.`);
      if (!suggestion.localOnly) {
        queryClient.invalidateQueries({
          queryKey: ["staged-ai-recommendations", account.id],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["account-history", account.id] });
    },
    onError: (error) => {
      setAiSuggestionError(error?.message ?? "AI recommendation could not be removed.");
    },
    onSettled: () => {
      setAddingAiSuggestionId("");
    },
  });

  const { mutate: addMeetingInsightActionItem, isPending: addingMeetingInsight } = useMutation({
    mutationFn: async (item) => {
      const task = await createAccountActionItemTask({
        accountId: account.id,
        title: item.title,
        description: item.reason ?? item.nextStep ?? "",
        reason: item.nextStep,
        source: item.meetingTitle ? `Meeting Insight: ${item.meetingTitle}` : "Meeting Insight",
        healthArea: item.healthArea,
        expectedLift: item.expectedLift,
        editedBy: profile?.name ?? "Unknown",
      });
      await markMeetingInsightActionItemState({
        accountId: account.id,
        requestedBy: profile?.id,
        item,
        sourceRef: getSuggestionSourceRef(item),
        status: "converted_to_action",
      });
      return task;
    },
    onMutate: () => {
      setFirefliesStatus("");
    },
    onSuccess: (_, item) => {
      setResolvedItems((current) => ({
        ...current,
        [item.id]: {
          status: "saved",
          reviewedAt: new Date().toISOString(),
        },
        [getSuggestionSourceRef(item)]: {
          status: "saved",
          reviewedAt: new Date().toISOString(),
        },
      }));
      setFirefliesStatus(
        `Added "${item.title}" to My Open Action Items on the dashboard and removed it from Meeting Insights.`,
      );
      queryClient.invalidateQueries({ queryKey: ["dashboard-action-items"] });
      queryClient.invalidateQueries({ queryKey: ["meeting-insight-action-states", account.id] });
      queryClient.invalidateQueries({ queryKey: ["account-open-action-items", account.id] });
      queryClient.invalidateQueries({ queryKey: ["account-history", account.id] });
    },
    onError: (error) => {
      setFirefliesStatus(error?.message ?? "Meeting insight could not be added.");
    },
  });

  useEffect(() => {
    setResolvedItems({});
    setReviewTarget(null);
    setReviewForm(createInitialReviewForm(null, profile?.name));
    setConfirmActionTarget(null);
    setRejectTarget(null);
    setRejectReason("");
    setFirefliesActions([]);
    setFirefliesStatus("");
    setActivityAreaFilter("All");
    setExpectedLiftSort("desc");
    setActivitySortMode("score");
    setActivityPage(1);
    setActivityPageSize(10);
    setMeetingInsightPage(1);
    setActivityStatus("");
    setAiSuggestions([]);
    setSelectedAiRecommendations([]);
    setAiSuggestionRequested(false);
    setAddingAiSuggestionId("");
    setAiSuggestionStatus("");
    setAiSuggestionWarning("");
    setAiSuggestionError("");
    setScheduleTarget(null);
    setScheduleForm(null);
  }, [account.id, profile?.name]);

  useEffect(() => {
    if (!stagedAiRecommendationRows) return;
    setSelectedAiRecommendations((current) => {
      const persistedRows = stagedAiRecommendationRows;
      const persistedTitleKeys = new Set(
        persistedRows.map((item) => normalizeActivityText(item.title)),
      );
      const localRows = current.filter(
        (item) => item.localOnly && !persistedTitleKeys.has(normalizeActivityText(item.title)),
      );
      const nextRows = [...persistedRows, ...localRows];
      const currentKey = current.map((item) => `${item.id}:${item.status ?? ""}`).join("|");
      const nextKey = nextRows.map((item) => `${item.id}:${item.status ?? ""}`).join("|");
      return currentKey === nextKey ? current : nextRows;
    });
  }, [stagedAiRecommendationRows]);

  const activeScoreMetricRefs = useMemo(
    () => new Set(model.scoreMetricActivities.map((item) => getSuggestionSourceRef(item))),
    [model.scoreMetricActivities],
  );
  const activeSavedRuleActivities = useMemo(
    () =>
      savedRuleActivities.filter((activity) => {
        if (activity.status === "Rejected" || activity.status === "Closed") return false;
        if (activity.sourceType === "opportunity") return false;
        if (isRetentionGrowthActivityArea(activity.parameter)) return false;
        if (activity.sourceType === "score_metric") {
          return activeScoreMetricRefs.has(activity.sourceRef);
        }
        return true;
      }),
    [activeScoreMetricRefs, savedRuleActivities],
  );
  const persistedSourceRefs = useMemo(
    () =>
      new Set(
        activeSavedRuleActivities
          .map((activity) => activity.sourceRef)
          .filter((sourceRef) => sourceRef && sourceRef !== "manual"),
      ),
    [activeSavedRuleActivities],
  );
  const isResolved = useCallback(
    (item) =>
      Boolean(
        resolvedItems[item.id] ||
        resolvedItems[getSuggestionSourceRef(item)] ||
        persistedSourceRefs.has(getSuggestionSourceRef(item)),
      ),
    [persistedSourceRefs, resolvedItems],
  );
  const activeOpportunities = [];
  const activeRagRecommendations = [];
  const showLegacyActivityPanels = Boolean(account.__legacyActivityPanels);
  const savedMeetingActions = useMemo(
    () =>
      activeSavedRuleActivities
        .filter((activity) => activity.sourceType === "fireflies_meeting")
        .map(mapPersistedMeetingActivityToCard),
    [activeSavedRuleActivities],
  );
  const scoreFirefliesActions = useMemo(
    () => firefliesActions.filter((item) => !isRetentionGrowthActivityArea(item.healthArea)),
    [firefliesActions],
  );
  const mergedMeetingActions = useMemo(() => {
    const actionsById = new Map();
    [...scoreFirefliesActions, ...savedMeetingActions].forEach((item) => {
      actionsById.set(getSuggestionSourceRef(item), item);
    });
    return [...actionsById.values()];
  }, [savedMeetingActions, scoreFirefliesActions]);
  const hiddenMeetingInsightRefs = useMemo(
    () =>
      new Set(
        (meetingInsightActionStates ?? [])
          .map((state) => state.sourceRef)
          .filter((sourceRef) => Boolean(sourceRef)),
      ),
    [meetingInsightActionStates],
  );
  const openTaskTitleKeys = useMemo(
    () => new Set((accountOpenTasks ?? []).map((task) => normalizeActivityText(task.title))),
    [accountOpenTasks],
  );
  const activeMeetingActions = mergedMeetingActions.filter((item) => {
    if (hiddenMeetingInsightRefs.has(getSuggestionSourceRef(item))) return false;
    if (openTaskTitleKeys.has(normalizeActivityText(item.title))) return false;
    return item.persisted || !isResolved(item);
  });
  const rejectedMeetingHistory = useMemo(
    () =>
      savedRuleActivities
        .filter(
          (activity) =>
            activity.status === "Rejected" &&
            (activity.sourceType === "meeting" || activity.sourceType === "fireflies_meeting"),
        )
        .map(mapRejectedHistoryItem),
    [savedRuleActivities],
  );
  const meetingInsightPageSize = 5;
  const meetingInsightPageCount = Math.max(
    1,
    Math.ceil(activeMeetingActions.length / meetingInsightPageSize),
  );
  const safeMeetingInsightPage = Math.min(meetingInsightPage, meetingInsightPageCount);
  const meetingInsightPageStart = activeMeetingActions.length
    ? (safeMeetingInsightPage - 1) * meetingInsightPageSize
    : 0;
  const pagedMeetingActions = activeMeetingActions.slice(
    meetingInsightPageStart,
    meetingInsightPageStart + meetingInsightPageSize,
  );

  useEffect(() => {
    setMeetingInsightPage(1);
  }, [account.id, activeMeetingActions.length]);

  const rawActivityRows = useMemo(() => {
    const savedRows = activeSavedRuleActivities.map(mapPersistedRuleActivityToRow);
    const visibleRows = model.activityRows.filter(
      (row) => row.rowType === "existing" || !isResolved(row),
    );
    const firefliesRows = scoreFirefliesActions
      .filter((item) => !isResolved(item))
      .map((item) => mapMeetingActionToActivityRow(item, "meeting"));
    return sortActivityRows([...savedRows, ...visibleRows, ...firefliesRows]);
  }, [activeSavedRuleActivities, isResolved, model.activityRows, scoreFirefliesActions]);
  const activityRows = useMemo(
    () => groupDuplicateActivityRows(rawActivityRows),
    [rawActivityRows],
  );
  const activityAreaOptions = useMemo(
    () =>
      ACTIVITY_TAB_AREAS.map((area) => {
        const rows = activityRows.filter((row) => row.area === area);
        return {
          area,
          count: rows.length,
        };
      }),
    [activityRows],
  );
  const visibleActivityRows = useMemo(() => {
    const filteredRows =
      activityAreaFilter === "All"
        ? activityRows
        : activityRows.filter((row) => row.area === activityAreaFilter);
    if (activitySortMode === "expectedLift") {
      return sortActivityRowsByExpectedLift(filteredRows, expectedLiftSort);
    }
    return sortActivityRowsByLowestScore(filteredRows, account);
  }, [account, activityAreaFilter, activityRows, activitySortMode, expectedLiftSort]);
  const activityPageCount = Math.max(1, Math.ceil(visibleActivityRows.length / activityPageSize));
  const safeActivityPage = Math.min(activityPage, activityPageCount);
  const activityPageStart = visibleActivityRows.length
    ? (safeActivityPage - 1) * activityPageSize
    : 0;
  const pagedActivityRows = visibleActivityRows.slice(
    activityPageStart,
    activityPageStart + activityPageSize,
  );
  const activityShowingStart = visibleActivityRows.length ? activityPageStart + 1 : 0;
  const activityShowingEnd = Math.min(
    activityPageStart + activityPageSize,
    visibleActivityRows.length,
  );

  useEffect(() => {
    setActivityPage(1);
  }, [activityAreaFilter, activitySortMode, expectedLiftSort, activityPageSize, account.id]);

  function generateAiSuggestions() {
    setAiRecommendationSheetOpen(true);
    requestAiSuggestions();
  }

  function acceptAiSuggestion(suggestion) {
    if (!canAct) return;
    stageAiRecommendation(suggestion);
  }

  function openReview(kind, item) {
    setReviewTarget({ kind, item });
    setReviewForm(createInitialReviewForm(item, profile?.name));
  }

  function closeReview() {
    setReviewTarget(null);
    setReviewForm(createInitialReviewForm(null, profile?.name));
  }

  function confirmReview() {
    if (!reviewTarget) return;
    saveRuleActivity({ target: reviewTarget, form: reviewForm });
  }

  function confirmReject() {
    if (!rejectTarget || !rejectReason.trim()) return;
    rejectRuleActivity({ target: rejectTarget, reason: rejectReason.trim() });
  }

  function requestAddMeetingInsight(item) {
    setConfirmActionTarget({
      kind: "meeting-add",
      item,
      title: "Add this meeting insight to action items?",
      description:
        "This will create a My Open Action Items task on the dashboard and remove this insight from the meeting suggestions list.",
      confirmLabel: "Add action item",
    });
  }

  function confirmActionTargetChange() {
    if (!confirmActionTarget) return;
    if (confirmActionTarget.kind === "meeting-add") {
      addMeetingInsightActionItem(confirmActionTarget.item);
    }
    setConfirmActionTarget(null);
  }

  function toggleExpectedLiftSort() {
    setActivitySortMode("expectedLift");
    setExpectedLiftSort((current) => (current === "asc" ? "desc" : "asc"));
  }

  function openScheduleMeeting(row) {
    const form = createMeetingScheduleForm(account, row, profile);
    setScheduleTarget(row);
    setScheduleForm(form);
    setActivityStatus("");
  }

  function confirmScheduleMeeting() {
    if (!scheduleTarget || !scheduleForm) return;
    if (!scheduleForm.subject.trim() || !scheduleForm.date || !scheduleForm.time) {
      setActivityStatus(
        "Meeting details are incomplete or invalid. Please check date, time, attendee, and try again.",
      );
      return;
    }
    if (!scheduleForm.contactEmail.trim()) {
      setActivityStatus("Contact email is required before scheduling.");
      return;
    }
    if (!isValidEmailAddress(scheduleForm.contactEmail)) {
      setActivityStatus(
        "Meeting details are incomplete or invalid. Please check date, time, attendees, and try again.",
      );
      return;
    }
    const calendarUrl = buildGoogleCalendarTemplateUrl(scheduleForm);
    if (typeof window !== "undefined") {
      window.open(calendarUrl, "_blank", "noopener,noreferrer");
    }
    setActivityStatus("Google Calendar opened in a new tab with this meeting pre-filled.");
    setScheduleTarget(null);
    setScheduleForm(null);
  }

  async function completeActivityRow(row) {
    const rowsToComplete = row.selectedRows ?? row.groupedRows ?? [row];
    const scoreRows = rowsToComplete.filter((entry) => entry.sourceKind === "score_metric");

    if (scoreRows.length) {
      await completeScoreMetricRows({
        account,
        rows: scoreRows,
        profile,
        authAccessToken: session?.access_token ?? "",
        saveActivityScoreSnapshot,
        queryClient,
        router,
      });
      setResolvedItems((current) => ({
        ...current,
        ...Object.fromEntries(scoreRows.map((entry) => [getSuggestionSourceRef(entry), true])),
      }));
    }

    const savedRows = rowsToComplete.filter((entry) => entry.dbId);
    await Promise.all(savedRows.map((entry) => markActivityRuleActivityDone(entry.dbId)));

    const existingRows = rowsToComplete.filter(
      (entry) => entry.sourceKind === "existing" && entry.sourceId,
    );
    await Promise.all(existingRows.map((entry) => markLegacyActivityDone(entry.sourceId)));

    const transientRows = rowsToComplete.filter(
      (entry) =>
        !entry.dbId && entry.sourceKind !== "score_metric" && entry.sourceKind !== "existing",
    );
    await Promise.all(
      transientRows.map(async (entry) => {
        const created = await createActivityRuleActivity(
          buildActivityRuleActivityInput({
            accountId: account.id,
            target: { kind: entry.sourceKind ?? "activity", item: entry },
            form: {
              title: entry.title,
              owner: profile?.name ?? "KAM Person",
              dueDate: getFutureDateInput(0),
              nextStep: entry.nextStep ?? entry.reason ?? entry.title,
            },
          }),
        );
        await markActivityRuleActivityDone(created.id);
      }),
    );

    await logActivityHistoryChange({
      accountId: account.id,
      profile,
      changes: rowsToComplete.map((entry) => ({
        field: `Activity status: ${getActivityHistoryTitle(entry)}`,
        oldValue: entry.status ?? "Open",
        newValue: "Done",
      })),
    });

    setResolvedItems((current) => ({
      ...current,
      ...Object.fromEntries(rowsToComplete.map((entry) => [entry.id, true])),
      ...Object.fromEntries(rowsToComplete.map((entry) => [getSuggestionSourceRef(entry), true])),
    }));

    return {
      message:
        scoreRows.length > 1
          ? `Marked ${scoreRows.length} related Score Marking Matrics items checked.`
          : "Activity marked done.",
    };
  }

  return (
    <div className="space-y-6">
      {role === "KAM" && !isAssignedKam && (
        <div className="rounded-xl border border-warn/30 bg-warn/5 px-4 py-3 text-sm">
          <p className="font-semibold text-warn">View-only planning surface for this account</p>
          <p className="text-[12px] text-muted-foreground mt-1">
            Only the assigned KAM can add, reject, or pursue score-improvement suggestions here.
          </p>
        </div>
      )}

      {showLegacyActivityPanels && (
        <>
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="px-4 md:px-6 py-4 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="flex items-start gap-3">
                <span className="size-9 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
                  <Lightbulb className="size-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold">Opportunities related to {account.name}</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Client-specific opportunities sourced from account context, score gaps,
                    escalation signals, and Fireflies-derived meeting notes.
                  </p>
                </div>
              </div>
              <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground self-start md:self-auto">
                {activeOpportunities.length} open
              </span>
            </div>

            {activeOpportunities.length ? (
              <ul className="divide-y">
                {activeOpportunities.map((opportunity) => (
                  <li key={opportunity.id} className="px-4 md:px-6 py-4 space-y-3">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                      <div className="space-y-2 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold leading-snug">{opportunity.title}</p>
                          <PriorityBadge priority={opportunity.priority} />
                          <ConfidenceBadge confidence={opportunity.confidence} />
                          <AreaBadge area={opportunity.healthArea} />
                          {opportunity.approvalRequired && (
                            <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-warn/10 text-warn px-2 py-1">
                              Approval required
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {opportunity.source} · {opportunity.signalDate}
                        </p>
                        <ScoreRuleDetails item={opportunity} />
                      </div>
                      <div className="flex items-start lg:items-center shrink-0">
                        <Button
                          size="sm"
                          disabled={!canAct}
                          onClick={() => openReview("opportunity", opportunity)}
                        >
                          Pursue
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-6 py-6 text-xs text-muted-foreground">
                No open opportunities are active in this planning cycle.
              </p>
            )}
          </div>

          <div className="bg-card border rounded-xl p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-bold">Global Activity Rule Matrix</h3>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Standard rules that generate account-specific activities and define validation
                  criteria.
                </p>
              </div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                {activeRagRecommendations.length} active recommendations
              </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              {["R", "A", "G"].map((urgency) => {
                const items = activeRagRecommendations.filter((item) => item.urgency === urgency);
                return (
                  <div key={urgency} className="border rounded-lg overflow-hidden">
                    <div
                      className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white ${
                        urgency === "R" ? "bg-crit" : urgency === "A" ? "bg-warn" : "bg-success"
                      }`}
                    >
                      {urgency === "R"
                        ? "RED — Act Now"
                        : urgency === "A"
                          ? "AMBER — Plan"
                          : "GREEN — Monitor"}
                      <span className="ml-2 opacity-80">({items.length})</span>
                    </div>
                    <div className="p-3 space-y-3">
                      {items.length ? (
                        items.map((item) => (
                          <div key={item.id} className="rounded-lg border p-3 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold leading-snug">{item.title}</p>
                              <AreaBadge area={item.healthArea} />
                              <RuleBadge ruleId={item.ruleId} />
                              <ConfidenceBadge confidence={item.confidence} />
                            </div>
                            <p className="text-xs text-muted-foreground">{item.reason}</p>
                            <ScoreRuleDetails item={item} />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                disabled={!canAct}
                                onClick={() => openReview("rag", item)}
                              >
                                Add
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!canAct}
                                onClick={() => setRejectTarget({ ...item, sourceKind: "rag" })}
                              >
                                Reject
                              </Button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          No items in this urgency band.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold">Meeting Insights to Improve Account Score</h3>
            <p className="text-[11px] text-muted-foreground mt-1">
              Meeting summaries are saved to Meeting History, and guarded action items are saved to
              the dashboard action item list.
            </p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={!canAct || !session?.access_token || extractingFireflies}
              onClick={() => rerunFirefliesExtraction()}
            >
              {extractingFireflies && <Loader2 className="size-3.5 animate-spin mr-1" />}
              Extract action items
            </Button>
            <p
              className={`text-[10px] ${
                firefliesStatus.includes("failed") || firefliesStatus.includes("Missing")
                  ? "text-crit"
                  : "text-muted-foreground"
              }`}
            >
              {firefliesStatus ||
                "Fetches summaries, derives required actions, and avoids duplicate action items."}
            </p>
          </div>
        </div>

        {activeMeetingActions.length ? (
          <ul className="divide-y">
            {pagedMeetingActions.map((item) => (
              <li key={item.id} className="px-6 py-4 space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold leading-snug">{item.title}</p>
                      <AreaBadge area={item.healthArea} />
                      <ConfidenceBadge confidence={item.confidence} />
                      {item.persisted && <ActivityStatusBadge row={item} />}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {item.meetingTitle} · {item.meetingDate}
                    </p>
                    <ScoreRuleDetails item={item} />
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button
                      size="sm"
                      disabled={!canAct || addingMeetingInsight}
                      onClick={() => requestAddMeetingInsight(item)}
                    >
                      {addingMeetingInsight && <Loader2 className="size-3.5 animate-spin mr-1" />}
                      Add
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!canAct || rejectingRuleActivity}
                      onClick={() => setRejectTarget({ ...item, sourceKind: "meeting" })}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-6 py-6 text-xs text-muted-foreground">
            No meeting-note actions are active right now.
          </p>
        )}
        {activeMeetingActions.length > meetingInsightPageSize && (
          <PaginatedListFooter
            page={safeMeetingInsightPage}
            pageSize={meetingInsightPageSize}
            total={activeMeetingActions.length}
            onPageChange={setMeetingInsightPage}
            itemLabel="meeting insights"
          />
        )}
        <RejectedHistoryDisclosure
          title="Rejected Meeting Insights"
          items={rejectedMeetingHistory}
          emptyText="No rejected meeting insights yet."
        />
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold">Activities Across Health Areas</h3>
            <p className="text-[11px] text-muted-foreground mt-1">
              Unchecked Score Marking Matrics items, meeting actions, and accepted drafts live in
              one review queue.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="grid gap-1">
              <Label
                htmlFor="activity-health-area-filter"
                className="text-[10px] uppercase tracking-widest text-muted-foreground"
              >
                Health area
              </Label>
              <select
                id="activity-health-area-filter"
                value={activityAreaFilter}
                onChange={(event) => setActivityAreaFilter(event.target.value)}
                className="h-8 min-w-[220px] rounded-md border bg-background px-3 text-xs font-medium"
              >
                <option value="All">All Health Areas ({activityRows.length})</option>
                {activityAreaOptions.map((option) => (
                  <option key={option.area} value={option.area}>
                    {option.area} ({option.count})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <Label
                htmlFor="activity-page-size"
                className="text-[10px] uppercase tracking-widest text-muted-foreground"
              >
                Rows
              </Label>
              <select
                id="activity-page-size"
                value={activityPageSize}
                onChange={(event) => setActivityPageSize(Number(event.target.value))}
                className="h-8 rounded-md border bg-background px-3 text-xs font-medium"
              >
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
              </select>
            </div>
          </div>
        </div>
        <div className="px-4 py-2 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
            Showing {activityShowingStart}-{activityShowingEnd} of {visibleActivityRows.length}{" "}
            items
          </p>
          {activityStatus && (
            <p
              className={`text-[11px] font-medium ${
                /failed|could not|required|unavailable|not configured/i.test(activityStatus)
                  ? "text-crit"
                  : "text-success"
              }`}
            >
              {activityStatus}
            </p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-xs">
            <thead className="bg-card">
              <tr className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b">
                <th className="px-4 py-2.5">Area</th>
                <th className="px-4 py-2.5">Activity</th>
                <th className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={toggleExpectedLiftSort}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    Expected Lift
                    <ChevronDown
                      className={`size-3 transition-transform ${
                        activitySortMode === "expectedLift" && expectedLiftSort === "asc"
                          ? "rotate-180"
                          : ""
                      }`}
                    />
                  </button>
                </th>
                <th className="px-4 py-2.5">Owner</th>
                <th className="px-4 py-2.5">RAG</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pagedActivityRows.map((row) => (
                <tr key={row.id} className="align-top hover:bg-muted/20">
                  <td className="px-4 py-3 text-[11px] font-semibold whitespace-nowrap">
                    <AreaBadge area={row.area} />
                  </td>
                  <td className="px-4 py-3 text-xs min-w-[260px]">
                    <div className="space-y-1">
                      <p className="font-semibold text-foreground">{row.title}</p>
                      <p className="text-muted-foreground leading-relaxed line-clamp-2">
                        {row.reason}
                      </p>
                      {row.relatedScoreGaps?.length ? (
                        <div className="mt-2 rounded-md border bg-muted/20 px-3 py-2">
                          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                            Related score gaps
                          </p>
                          <ul className="mt-1 space-y-1 text-[11px] text-muted-foreground">
                            {row.relatedScoreGaps.map((gap) => (
                              <li key={gap}>{gap}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap">
                    {row.expectedLift || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {row.owner}
                  </td>
                  <td className="px-4 py-3">
                    <RagBadge code={row.rag} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      {isMeetingRelatedActivity(row) && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canAct}
                          onClick={() => openScheduleMeeting(row)}
                        >
                          <Calendar className="size-3.5 mr-1" />
                          Schedule Meeting
                        </Button>
                      )}
                      <Button
                        size="sm"
                        disabled={!canAct || completingActivity}
                        onClick={() => markActivityDone(row)}
                      >
                        Done
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleActivityRows.length && (
            <p className="px-4 py-6 text-xs text-muted-foreground">
              No activities are active for this health area.
            </p>
          )}
        </div>
        {visibleActivityRows.length > activityPageSize && (
          <div className="px-4 py-3 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">
              Page {safeActivityPage} of {activityPageCount}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={safeActivityPage <= 1}
                onClick={() => setActivityPage((page) => Math.max(1, page - 1))}
              >
                Previous
              </Button>
              {Array.from({ length: Math.min(activityPageCount, 5) }, (_, index) => {
                const page = index + 1;
                return (
                  <Button
                    key={page}
                    size="sm"
                    variant={page === safeActivityPage ? "default" : "outline"}
                    onClick={() => setActivityPage(page)}
                  >
                    {page}
                  </Button>
                );
              })}
              <Button
                size="sm"
                variant="outline"
                disabled={safeActivityPage >= activityPageCount}
                onClick={() => setActivityPage((page) => Math.min(activityPageCount, page + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-accent/10 via-card to-card">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="size-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                <Sparkles className="size-5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-bold">AI Suggestions to Increase Score</h4>
                  <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-accent/10 text-accent px-2 py-1">
                    AI-generated
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-3xl">
                  Generate AI-powered strategic recommendations for this account.
                </p>
                {aiSuggestions.length ? (
                  <p className="mt-2 text-[11px] font-medium text-muted-foreground">
                    {aiSuggestions.length} recommendation{aiSuggestions.length === 1 ? "" : "s"}{" "}
                    ready to review.
                  </p>
                ) : null}
              </div>
            </div>
            <Button
              size="sm"
              disabled={generatingAiSuggestions}
              onClick={generateAiSuggestions}
              className="shadow-sm"
            >
              {generatingAiSuggestions && <Loader2 className="size-3.5 animate-spin mr-1" />}
              Ask AI for Suggestions
            </Button>
          </div>
        </div>
      </div>

      {selectedAiRecommendations.length ? (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold">Selected AI Recommendations</h4>
              <p className="text-[11px] text-muted-foreground mt-1">
                Review selected recommendations before adding them to dashboard action items.
              </p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-accent/10 text-accent px-2 py-1">
              {selectedAiRecommendations.length} selected
            </span>
          </div>
          <div className="divide-y">
            {selectedAiRecommendations.map((suggestion) => (
              <div
                key={suggestion.id}
                className="px-5 py-4 flex flex-col xl:flex-row xl:items-center gap-4"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <AreaBadge area={suggestion.healthArea} />
                    <span className="text-[10px] font-bold uppercase rounded-full bg-accent/10 text-accent px-2 py-1">
                      {suggestion.expectedLift}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-snug">{suggestion.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {suggestion.description}
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">Source:</span>{" "}
                    {suggestion.sourceSummary}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 xl:self-center">
                  <Button
                    size="sm"
                    disabled={!canAct || addingAiSuggestionId === suggestion.id}
                    onClick={() => addAiRecommendationActionItem(suggestion)}
                  >
                    {addingAiSuggestionId === suggestion.id && (
                      <Loader2 className="size-3.5 animate-spin mr-1" />
                    )}
                    Add To Action Items
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!canAct || addingAiSuggestionId === suggestion.id}
                    onClick={() => dismissStagedAiRecommendation(suggestion)}
                  >
                    Remove/Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <ActivityReviewSheet
        target={reviewTarget}
        form={reviewForm}
        onChange={setReviewForm}
        onClose={closeReview}
        onConfirm={confirmReview}
        isSaving={savingRuleActivity}
      />

      <AiRecommendationsSheet
        open={aiRecommendationSheetOpen}
        onClose={() => setAiRecommendationSheetOpen(false)}
        suggestions={aiSuggestions}
        requested={aiSuggestionRequested}
        isLoading={generatingAiSuggestions}
        status={aiSuggestionStatus}
        warning={aiSuggestionWarning}
        error={aiSuggestionError}
        canAct={canAct}
        addingId={addingAiSuggestionId}
        activityRows={activityRows}
        onAccept={acceptAiSuggestion}
        onRefresh={generateAiSuggestions}
      />

      <ConfirmActionDialog
        target={confirmActionTarget}
        onClose={() => setConfirmActionTarget(null)}
        onConfirm={confirmActionTargetChange}
        isSaving={addingMeetingInsight}
      />

      <ScheduleMeetingDialog
        target={scheduleTarget}
        form={scheduleForm}
        onChange={setScheduleForm}
        onClose={() => {
          setScheduleTarget(null);
          setScheduleForm(null);
        }}
        onConfirm={confirmScheduleMeeting}
        isSaving={false}
      />

      <RejectRecommendationDialog
        target={rejectTarget}
        value={rejectReason}
        onChange={setRejectReason}
        onClose={() => {
          setRejectTarget(null);
          setRejectReason("");
        }}
        onConfirm={confirmReject}
        isSaving={rejectingRuleActivity}
      />
    </div>
  );
}

function AiRecommendationsSheet({
  open,
  onClose,
  suggestions,
  requested,
  isLoading,
  status,
  warning,
  error,
  canAct,
  addingId,
  activityRows,
  onAccept,
  onRefresh,
}) {
  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <div className="min-h-full bg-background">
          <div className="border-b bg-gradient-to-r from-accent/15 via-background to-background px-6 py-5">
            <SheetHeader className="text-left space-y-3">
              <div className="flex items-start gap-3 pr-8">
                <span className="size-11 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                  <Sparkles className="size-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <SheetTitle>AI Recommendations to Increase Score</SheetTitle>
                    <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-accent/10 text-accent px-2 py-1">
                      AI-generated
                    </span>
                  </div>
                  <SheetDescription className="mt-1">
                    Generated from account context, tasks, opportunities, risks, existing
                    activities, and score logic.
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] text-muted-foreground">
                Select recommendations to stage them for dashboard action items.
                {!canAct
                  ? " You can review recommendations, but adding requires activity permissions."
                  : ""}
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={isLoading} onClick={onRefresh}>
                  {isLoading && <Loader2 className="size-3.5 animate-spin mr-1" />}
                  Refresh
                </Button>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            {status && (
              <p
                className={`rounded-lg border px-3 py-2 text-[11px] font-medium ${
                  status.startsWith("Added")
                    ? "border-success/20 bg-success/5 text-success"
                    : "border-border bg-muted/20 text-muted-foreground"
                }`}
              >
                {status}
              </p>
            )}
            {warning && (
              <p className="rounded-lg border border-warn/20 bg-warn/5 px-3 py-2 text-[11px] font-medium text-warn">
                {warning}
              </p>
            )}
            {error && (
              <p className="rounded-lg border border-crit/20 bg-crit/5 px-3 py-2 text-[11px] font-medium text-crit">
                {error}
              </p>
            )}

            {isLoading ? <AiRecommendationSkeleton /> : null}

            {!isLoading && requested && !error && !suggestions.length ? (
              <div className="rounded-xl border bg-muted/20 px-5 py-8 text-center">
                <Sparkles className="mx-auto size-5 text-muted-foreground" />
                <p className="mt-3 text-sm font-semibold">No strong AI recommendations found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  The agent did not find useful, account-specific recommendations that are not
                  already covered by current activities.
                </p>
              </div>
            ) : null}

            {!isLoading && suggestions.length ? (
              <div className="space-y-3">
                {suggestions.map((suggestion) => (
                  <AiRecommendationCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    duplicate={isDuplicateAiActivity(suggestion, activityRows)}
                    isAdding={addingId === suggestion.id}
                    canAct={canAct}
                    onAccept={onAccept}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AiRecommendationSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-xl border bg-card p-4 animate-pulse">
          <div className="flex gap-3">
            <div className="mt-1 size-4 rounded border bg-muted" />
            <div className="flex-1 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-2/3 rounded bg-muted" />
                  <div className="h-3 w-full rounded bg-muted" />
                  <div className="h-3 w-4/5 rounded bg-muted" />
                </div>
                <div className="h-6 w-24 rounded-full bg-muted" />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="h-16 rounded-lg bg-muted" />
                <div className="h-16 rounded-lg bg-muted" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AiRecommendationCard({ suggestion, duplicate, isAdding, canAct, onAccept }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex gap-3">
        <input
          type="checkbox"
          className="mt-1 size-4 shrink-0 accent-[hsl(var(--accent))]"
          checked={isAdding}
          disabled={!canAct || isAdding || duplicate}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            event.stopPropagation();
            if (event.target.checked) onAccept(suggestion);
          }}
          aria-label={`Select ${suggestion.title} as an AI recommendation`}
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-accent/10 text-accent px-2 py-1">
                  AI-generated
                </span>
                {duplicate && (
                  <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-crit/10 text-crit px-2 py-1">
                    Duplicate
                  </span>
                )}
                {isAdding && (
                  <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-success/10 text-success px-2 py-1">
                    Adding
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold leading-snug">{suggestion.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {suggestion.description}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <AreaBadge area={suggestion.healthArea} />
              <span className="text-[10px] font-bold uppercase rounded-full bg-accent/10 text-accent px-2 py-1">
                {suggestion.expectedLift}
              </span>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border bg-muted/10 p-3">
              <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                Why this may increase score
              </p>
              <p className="mt-1 text-xs text-foreground leading-relaxed">{suggestion.reason}</p>
            </div>
            <div className="rounded-lg border bg-muted/10 p-3">
              <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                Source
              </p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                {suggestion.sourceSummary}
              </p>
            </div>
          </div>

          {duplicate && (
            <p className="text-[11px] font-semibold text-crit">This activity already exists.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityReviewSheet({ target, form, onChange, onClose, onConfirm, isSaving = false }) {
  const item = target?.item ?? null;
  const title = target?.kind === "opportunity" ? "Review pursuit draft" : "Review activity draft";

  return (
    <Sheet open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        {item && (
          <>
            <SheetHeader>
              <SheetTitle>{title}</SheetTitle>
              <SheetDescription>
                Review the suggestion, adjust the details, and add it to the governed activity plan.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 py-5">
              <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <AreaBadge area={item.healthArea ?? item.area} />
                  <RuleBadge ruleId={item.ruleId} />
                  {item.priority ? <PriorityBadge priority={item.priority} /> : null}
                  {item.confidence ? <ConfidenceBadge confidence={item.confidence} /> : null}
                  {item.approvalRequired && (
                    <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-warn/10 text-warn px-2 py-1">
                      {item.approverRole ?? "Head of KAM"} approval required
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.reason ?? item.sourceExcerpt ?? item.nextStep}
                  </p>
                </div>
                <ScoreRuleDetails item={item} />
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="activity-review-title">Title</Label>
                  <Input
                    id="activity-review-title"
                    value={form.title}
                    onChange={(event) =>
                      onChange((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="activity-review-owner">Owner</Label>
                    <Input
                      id="activity-review-owner"
                      value={form.owner}
                      onChange={(event) =>
                        onChange((current) => ({ ...current, owner: event.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="activity-review-due-date">Due date</Label>
                    <Input
                      id="activity-review-due-date"
                      type="date"
                      value={form.dueDate}
                      onChange={(event) =>
                        onChange((current) => ({ ...current, dueDate: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="activity-review-next-step">Next step</Label>
                  <Textarea
                    id="activity-review-next-step"
                    rows={4}
                    value={form.nextStep}
                    onChange={(event) =>
                      onChange((current) => ({ ...current, nextStep: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Evidence
                </p>
                <div className="space-y-3">
                  {(item.evidence ?? []).map((entry, index) => (
                    <div
                      key={`${entry.source}-${index}`}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          {entry.sourceType}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{entry.date}</span>
                      </div>
                      <p className="text-sm font-medium">{entry.source}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {entry.excerpt}
                      </p>
                      <p className="text-[11px] text-foreground">{entry.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <SheetFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={onConfirm}
                disabled={
                  isSaving || !form.title.trim() || !form.owner.trim() || !form.nextStep.trim()
                }
              >
                {isSaving ? "Adding..." : "Add to plan"}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function EvidenceDetailSheet({ target, onClose }) {
  return (
    <Sheet open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        {target && (
          <>
            <SheetHeader>
              <SheetTitle>{target.title}</SheetTitle>
              <SheetDescription>{target.subtitle}</SheetDescription>
            </SheetHeader>

            <div className="space-y-4 py-5">
              {(target.evidence ?? []).map((entry, index) => (
                <div key={`${entry.source}-${index}`} className="rounded-xl border p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {entry.sourceType}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{entry.date}</span>
                  </div>
                  <p className="text-sm font-semibold">{entry.source}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{entry.excerpt}</p>
                  <p className="text-xs text-foreground">{entry.reason}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

const MEETING_TIME_OPTIONS = [
  ["08:00", "8:00 AM"],
  ["08:30", "8:30 AM"],
  ["09:00", "9:00 AM"],
  ["09:30", "9:30 AM"],
  ["10:00", "10:00 AM"],
  ["10:30", "10:30 AM"],
  ["11:00", "11:00 AM"],
  ["11:30", "11:30 AM"],
  ["12:00", "12:00 PM"],
  ["12:30", "12:30 PM"],
  ["13:00", "1:00 PM"],
  ["13:30", "1:30 PM"],
  ["14:00", "2:00 PM"],
  ["14:30", "2:30 PM"],
  ["15:00", "3:00 PM"],
  ["15:30", "3:30 PM"],
  ["16:00", "4:00 PM"],
  ["16:30", "4:30 PM"],
  ["17:00", "5:00 PM"],
];

function ScheduleMeetingDialog({ target, form, onChange, onClose, onConfirm, isSaving }) {
  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule meeting</DialogTitle>
          <DialogDescription>
            Open a pre-filled Google Calendar event from this activity using account context.
          </DialogDescription>
        </DialogHeader>

        {target && form && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Activity
              </p>
              <p className="mt-1 text-sm font-semibold">{target.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{target.reason}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="meeting-account">Account</Label>
                <Input id="meeting-account" value={form.accountName} readOnly />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="meeting-contact">Contact/person</Label>
                <Input
                  id="meeting-contact"
                  value={form.contactName}
                  onChange={(event) =>
                    onChange((current) => ({ ...current, contactName: event.target.value }))
                  }
                  placeholder="Client contact"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="meeting-contact-email">
                  Contact email <span className="text-crit">*</span>
                </Label>
                <Input
                  id="meeting-contact-email"
                  type="email"
                  value={form.contactEmail}
                  onChange={(event) =>
                    onChange((current) => ({ ...current, contactEmail: event.target.value }))
                  }
                  placeholder="client@example.com"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="meeting-subject">Meeting subject</Label>
              <Input
                id="meeting-subject"
                value={form.subject}
                onChange={(event) =>
                  onChange((current) => ({ ...current, subject: event.target.value }))
                }
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="meeting-date">Date</Label>
                <Input
                  id="meeting-date"
                  type="date"
                  value={form.date}
                  onChange={(event) =>
                    onChange((current) => ({ ...current, date: event.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="meeting-time">Time</Label>
                <select
                  id="meeting-time"
                  value={form.time}
                  onChange={(event) =>
                    onChange((current) => ({ ...current, time: event.target.value }))
                  }
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                >
                  {MEETING_TIME_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="meeting-duration">Duration</Label>
                <select
                  id="meeting-duration"
                  value={form.durationMinutes}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      durationMinutes: Number(event.target.value),
                    }))
                  }
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                >
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                  <option value={90}>90 minutes</option>
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="meeting-description">Agenda and notes</Label>
              <Textarea
                id="meeting-description"
                rows={5}
                value={form.description}
                onChange={(event) =>
                  onChange((current) => ({ ...current, description: event.target.value }))
                }
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={
              isSaving ||
              !form?.subject?.trim() ||
              !form?.contactEmail?.trim() ||
              !form?.date ||
              !form?.time
            }
            onClick={onConfirm}
          >
            {isSaving ? "Opening..." : "Open Google Calendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmActionDialog({ target, onClose, onConfirm, isSaving = false }) {
  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{target?.title ?? "Confirm action"}</DialogTitle>
          <DialogDescription>
            {target?.description ??
              "Please confirm before this recommendation is moved into action items."}
          </DialogDescription>
        </DialogHeader>

        {target?.item && (
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-sm font-semibold">{target.item.title}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              It will appear in My Open Action Items and disappear from this suggestion list.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={isSaving} onClick={onConfirm}>
            {isSaving ? "Adding..." : (target?.confirmLabel ?? "Confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectRecommendationDialog({
  target,
  value,
  onChange,
  onClose,
  onConfirm,
  isSaving = false,
}) {
  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reject recommendation</DialogTitle>
          <DialogDescription>
            Add a reason before removing this recommendation. The rejection is saved for audit and
            the item is removed from the active list.
          </DialogDescription>
        </DialogHeader>

        {target && (
          <div className="space-y-4">
            <div className="rounded-lg border p-3 bg-muted/20">
              <p className="text-sm font-semibold">{target.title}</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Capture why this suggestion should not stay active.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reject-reason">Rejection reason</Label>
              <Textarea
                id="reject-reason"
                rows={4}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder="Example: already covered by an open action plan, not relevant for this client, or timing is wrong."
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={isSaving || !value.trim()} onClick={onConfirm}>
            {isSaving ? "Rejecting..." : "Reject recommendation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

function formatEvidenceRequired(evidenceRequired) {
  if (!evidenceRequired) return "Activity evidence";
  if (Array.isArray(evidenceRequired)) return evidenceRequired.join(", ");
  return evidenceRequired;
}

function formatTriggerLogic(triggerLogic) {
  if (!triggerLogic) return null;
  return [
    triggerLogic.primary ? `Primary: ${triggerLogic.primary}` : null,
    triggerLogic.threshold ? `Threshold: ${triggerLogic.threshold}` : null,
    triggerLogic.scoreBand ? `Band: ${triggerLogic.scoreBand}` : null,
    triggerLogic.overrideReason ? `Reason: ${triggerLogic.overrideReason}` : null,
    triggerLogic.trend ? `Trend: ${triggerLogic.trend}` : null,
    triggerLogic.velocity ? `Velocity: ${triggerLogic.velocity}` : null,
    triggerLogic.compound ? `Compound: ${triggerLogic.compound}` : null,
    triggerLogic.optimization ? `Target logic: ${triggerLogic.optimization}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

function formatEvidenceLiftPolicy(policy) {
  if (!policy?.length) return null;
  return policy.map((entry) => `${entry.quality}: ${entry.lift}`).join(" | ");
}

function formatActivityScoreLogic(logic) {
  if (!logic?.length) return null;
  return logic.join(" | ");
}

function formatApprovalSla(approvalSla) {
  if (!approvalSla?.reviewWindow) return null;
  return `Review: ${approvalSla.reviewWindow}; approver: ${approvalSla.primaryApprover}; fallback: ${approvalSla.fallbackApprover}; ${approvalSla.rejectionRule}`;
}

function formatReviewCadence(reviewCadence) {
  if (!reviewCadence?.cadence) return null;
  return `${reviewCadence.cadence}; ${reviewCadence.autoCloseRule}`;
}

function ScoreRuleDetails({ item }) {
  if (
    !item?.ruleId &&
    !item?.successCriteria &&
    !item?.expectedLift &&
    !item?.nextStep &&
    !item?.sourceExcerpt &&
    !item?.potentialValue
  ) {
    return null;
  }

  const triggerLogic = formatTriggerLogic(item.triggerLogic);
  const evidenceLiftPolicy = formatEvidenceLiftPolicy(item.evidenceLiftPolicy);
  const activityScoreLogic = formatActivityScoreLogic(item.activityScoreLogic);
  const approvalSla = formatApprovalSla(item.approvalSla);
  const reviewCadence = formatReviewCadence(item.reviewCadence);
  const knownPotential = Number(item.potentialValue);
  const potentialLabel =
    item.potentialValueLabel && item.potentialValueLabel !== "Not provided"
      ? item.potentialValueLabel
      : Number.isFinite(knownPotential) && knownPotential > 0
        ? `+${formatCurrency(knownPotential)}`
        : null;
  const summaryParts = [
    item.scoreBand,
    potentialLabel,
    item.currentValue && item.targetValue ? `${item.currentValue} to ${item.targetValue}` : null,
    item.threshold || item.targetScore
      ? `${item.thresholdSource ?? "Global default"} threshold`
      : null,
    item.nextStep ? "Next step" : null,
  ].filter(Boolean);

  return (
    <details className="group rounded-lg border bg-muted/20 text-xs">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {item.ruleId ? "Rule details" : "Details"}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {summaryParts.length ? summaryParts.join(" | ") : "Evidence and next step"}
          </p>
        </div>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-2 border-t p-3">
        <RuleDetailDisclosure
          label="Rule and metric"
          value={
            item.ruleId
              ? `${item.ruleId} / ${item.impactedMetric ?? item.parameter ?? item.healthArea}`
              : null
          }
        />
        <RuleDetailDisclosure label="Potential value" value={potentialLabel} />
        <RuleDetailDisclosure
          label="Priority"
          value={
            item.priority
              ? `${item.priority}${item.confidence ? ` / ${item.confidence} confidence` : ""}`
              : null
          }
        />
        <RuleDetailDisclosure label="Expected lift" value={item.expectedLift} />
        <RuleDetailDisclosure label="Next step" value={item.nextStep} />
        <RuleDetailDisclosure label="Source excerpt" value={item.sourceExcerpt} />
        <RuleDetailDisclosure
          label="Current to target"
          value={
            item.currentValue || item.targetValue
              ? `${item.currentValue ?? "Current"} to ${item.targetValue ?? "Target"}`
              : null
          }
        />
        <RuleDetailDisclosure label="Score band" value={item.scoreBand} />
        <RuleDetailDisclosure
          label="Threshold / target"
          value={
            item.threshold || item.targetScore
              ? `${item.thresholdSource ?? "Global default"}: ${item.threshold ?? "n/a"} to ${item.targetScore ?? "n/a"}`
              : null
          }
        />
        <RuleDetailDisclosure label="Threshold reason" value={item.thresholdReason} />
        <RuleDetailDisclosure label="Success criteria" value={item.successCriteria} />
        <RuleDetailDisclosure
          label="Evidence required"
          value={item.evidenceRequired ? formatEvidenceRequired(item.evidenceRequired) : null}
        />
        <RuleDetailDisclosure label="Trigger logic" value={triggerLogic} />
        <RuleDetailDisclosure label="Evidence quality lift" value={evidenceLiftPolicy} />
        <RuleDetailDisclosure label="Activity score logic" value={activityScoreLogic} />
        <RuleDetailDisclosure label="Approval SLA" value={approvalSla} />
        <RuleDetailDisclosure label="Review cadence" value={reviewCadence} />
      </div>
    </details>
  );
}

function RuleDetailDisclosure({ label, value }) {
  if (!value) return null;

  return (
    <details className="group/detail rounded-md border bg-background">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{value}</p>
        </div>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open/detail:rotate-180" />
      </summary>
      <p className="border-t px-3 py-2 text-xs leading-relaxed text-foreground">{value}</p>
    </details>
  );
}

function ActivityRuleCell({ row }) {
  if (!row.ruleId) {
    return (
      <div className="space-y-1">
        <p className="font-semibold text-muted-foreground">{row.impactedMetric ?? "Tracked"}</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Existing activity context
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <RuleBadge ruleId={row.ruleId} />
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {row.parameter}
        </span>
      </div>
      <p className="font-semibold text-foreground">{row.impactedMetric}</p>
      {row.scoreBand && <p className="text-[11px] font-medium text-accent">{row.scoreBand}</p>}
      {(row.currentValue || row.targetValue) && (
        <p className="text-[11px] text-muted-foreground">
          {row.currentValue ?? "Current"} to {row.targetValue ?? "Target"}
        </p>
      )}
    </div>
  );
}

function EvidencePreview({ evidence, onView, compact = false }) {
  const primary = evidence?.[0];
  if (!primary) {
    return <p className="text-[11px] text-muted-foreground">Evidence unavailable.</p>;
  }

  return (
    <div
      className={`rounded-lg border bg-muted/20 ${compact ? "p-2.5" : "p-3"} flex items-start justify-between gap-3`}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {primary.sourceType} · {primary.date}
        </p>
        <p
          className={`${compact ? "text-[11px]" : "text-xs"} text-foreground leading-relaxed mt-1 line-clamp-2`}
        >
          {primary.excerpt}
        </p>
      </div>
      <Button variant="ghost" size="sm" className="shrink-0" onClick={onView}>
        View evidence
      </Button>
    </div>
  );
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

function DashboardKpiCard({ label, value, hint }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4 min-h-[120px] flex flex-col justify-between">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <div>
        <p className="text-xl font-bold leading-tight">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{hint}</p>}
      </div>
    </div>
  );
}

function CalculationGovernancePanel({ dashboard }) {
  const dataQuality = dashboard.dataQuality ?? {};
  const notes = dashboard.calculationNotes ?? [];

  return (
    <details className="group rounded-xl border bg-card overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <h3 className="text-sm font-bold">Calculation & Data Sources</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Data source map, score-weight rationale, matrix rules, and missing/stale data handling.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <DataQualityBadge status={dataQuality.status} />
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </div>
      </summary>

      <div className="border-t">
        <div className="grid gap-6 p-6 xl:grid-cols-[0.9fr,1.1fr]">
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Data Readiness
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{dataQuality.summary}</p>
            </div>
            <div className="space-y-2">
              {(dataQuality.checks ?? []).map((check) => (
                <div
                  key={check.label}
                  className="flex items-start justify-between gap-3 rounded-lg border bg-muted/20 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">{check.label}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{check.source}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      {check.handling}
                    </p>
                  </div>
                  <DataQualityBadge status={check.status} compact />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Calculation Notes
              </p>
              <div className="mt-2 space-y-2">
                {notes.map((note) => (
                  <p key={note} className="rounded-lg border bg-muted/20 p-3 text-xs">
                    {note}
                  </p>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Matrix Rules
              </p>
              <div className="mt-2 grid gap-2">
                {(dashboard.matrixSpec ?? []).map((entry) => (
                  <div key={entry.item} className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-xs font-semibold">{entry.item}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      {entry.rule}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t p-6">
          <ScoreWeightTable
            title="Retention Score Weights"
            rows={dashboard.scoringWeights?.retention}
          />
        </div>
        <div className="border-t p-6">
          <ScoreWeightTable title="Growth Score Weights" rows={dashboard.scoringWeights?.growth} />
        </div>
        <div className="border-t p-6">
          <DataSourceTable rows={dashboard.dataSourceMap} />
        </div>
      </div>
    </details>
  );
}

function DataQualityBadge({ status = "Ready", compact = false }) {
  const styles = {
    Ready: "bg-success/10 text-success",
    "Needs data": "bg-crit/10 text-crit",
    "Stale review": "bg-warn/10 text-warn",
    Missing: "bg-crit/10 text-crit",
    Stale: "bg-warn/10 text-warn",
  };

  return (
    <span
      className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
        compact ? "whitespace-nowrap" : ""
      } ${styles[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}

function ScoreWeightTable({ title, rows = [] }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold">{title}</h4>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Each weight has a business rationale so the scoring model is explainable.
          </p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {rows.reduce((total, row) => total + row.weight, 0)}%
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead>
            <tr className="border-b bg-muted/30 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <th className="px-4 py-3">Metric</th>
              <th className="px-4 py-3">Weight</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Why this weight</th>
              <th className="px-4 py-3">Missing rule</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.metric} className="align-top">
                <td className="px-4 py-3 font-semibold">{row.metric}</td>
                <td className="px-4 py-3 font-semibold">{row.weight}%</td>
                <td className="px-4 py-3 text-muted-foreground">{row.systemOfRecord}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.rationale}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.missingHandling}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DataSourceTable({ rows = [] }) {
  return (
    <div>
      <div className="mb-3">
        <h4 className="text-sm font-bold">Metric Source Map</h4>
        <p className="mt-1 text-[11px] text-muted-foreground">
          This is the build-level answer to where every visible KPI comes from.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[920px] text-left text-xs">
          <thead>
            <tr className="border-b bg-muted/30 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <th className="px-4 py-3">Metric</th>
              <th className="px-4 py-3">Object / Fields</th>
              <th className="px-4 py-3">Usage</th>
              <th className="px-4 py-3">Missing Handling</th>
              <th className="px-4 py-3">Freshness Rule</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.metric} className="align-top">
                <td className="px-4 py-3 font-semibold">{row.metric}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  <p className="font-medium text-foreground">{row.systemOfRecord}</p>
                  <p className="mt-1">{row.fields}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.usage}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.missingHandling}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.freshness}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }) {
  const styles = {
    High: "bg-crit/10 text-crit",
    Medium: "bg-warn/10 text-warn",
    Low: "bg-success/10 text-success",
  };

  return (
    <span
      className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${styles[priority] ?? "bg-muted text-muted-foreground"}`}
    >
      {priority}
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
      className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${styles[confidence] ?? "bg-muted text-muted-foreground"}`}
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

function RagBadge({ code }) {
  const styles = {
    R: "bg-crit",
    A: "bg-warn",
    G: "bg-success",
  };

  return (
    <span
      className={`inline-flex items-center justify-center size-6 rounded-full text-[10px] font-bold text-white ${styles[code] ?? "bg-muted-foreground"}`}
      title={code === "R" ? "Red" : code === "A" ? "Amber" : "Green"}
    >
      {code}
    </span>
  );
}

function ActivityStatusBadge({ row }) {
  if (row.rowType === "suggested") {
    return (
      <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-warn/10 text-warn">
        Suggested
      </span>
    );
  }

  const statusStyles = {
    Validated: "bg-success/10 text-success",
    "Evidence Submitted": "bg-warn/10 text-warn",
    Completed: "bg-accent/10 text-accent",
    Planned: "bg-accent/10 text-accent",
    Accepted: "bg-accent/10 text-accent",
    Generated: "bg-muted text-muted-foreground",
    Rejected: "bg-crit/10 text-crit",
    Closed: "bg-muted text-muted-foreground",
    Done: "bg-success/10 text-success",
    "In Progress": "bg-accent/10 text-accent",
  };
  const styles = statusStyles[row.status] ?? "bg-muted text-muted-foreground";

  return (
    <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${styles}`}>
      {row.status}
    </span>
  );
}

function createInitialReviewForm(item, ownerName) {
  if (!item) {
    return {
      title: "",
      owner: ownerName ?? "KAM Person",
      dueDate: getFutureDateInput(7),
      nextStep: "",
    };
  }

  const title = item.title ?? item.service ?? "";

  return {
    title,
    owner: ownerName ?? "KAM Person",
    dueDate: getFutureDateInput(getSuggestedReviewDays(item)),
    nextStep: item.nextStep ?? title,
  };
}

function getSuggestedReviewDays(item) {
  if (item.urgency === "R" || item.priority === "High") return 3;
  if (item.urgency === "G" || item.priority === "Low") return 14;
  return 7;
}

function getFutureDateInput(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDraftDate(dateValue) {
  if (!dateValue) return "Needs scheduling";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function mapPriorityToRag(priority) {
  return priority === "High" ? "R" : priority === "Low" ? "G" : "A";
}

function getRejectedHistorySourceLabel(sourceType) {
  if (sourceType === "opportunity") return "Opportunity";
  if (sourceType === "meeting" || sourceType === "fireflies_meeting") return "Meeting Insight";
  if (sourceType === "rag") return "Activity Rule";
  if (sourceType === "score_metric") return "Score Marking Matrics";
  return sourceType ? sourceType.replace(/_/g, " ") : "Suggestion";
}

function mapRejectedHistoryItem(activity) {
  return {
    id: activity.id,
    title: activity.title,
    reason:
      activity.nextStep || activity.weakSignal || activity.successCriteria || "No reason saved.",
    reviewer: activity.owner || "Unknown",
    date: formatDraftDate(activity.updatedAt || activity.generatedAt),
    sourceLabel: getRejectedHistorySourceLabel(activity.sourceType),
    area: activity.parameter || activity.impactedMetric || "",
  };
}

function mapMeetingActionToActivityRow(item, sourceKind) {
  return {
    id: item.id,
    rowType: "suggested",
    sourceId: item.id,
    sourceKind,
    area: item.healthArea,
    title: item.title,
    owner: "KAM Person",
    dueDate: "In 7d",
    status: "Suggested",
    rag: item.confidence === "High" ? "R" : "A",
    expectedLift: item.expectedLift,
    confidence: item.confidence,
    ruleId: item.ruleId ?? null,
    parameter: item.parameter ?? item.healthArea,
    impactedMetric: item.impactedMetric ?? item.healthArea,
    weakSignal: item.weakSignal ?? item.reason ?? item.sourceExcerpt,
    currentValue: item.currentValue ?? null,
    targetValue: item.targetValue ?? null,
    triggerLogic: item.triggerLogic ?? null,
    evidenceLiftPolicy: item.evidenceLiftPolicy ?? null,
    activityScoreLogic: item.activityScoreLogic ?? null,
    approvalSla: item.approvalSla ?? null,
    reviewCadence: item.reviewCadence ?? null,
    scoreBand: item.scoreBand ?? null,
    threshold: item.threshold ?? null,
    targetScore: item.targetScore ?? null,
    thresholdSource: item.thresholdSource ?? null,
    thresholdReason: item.thresholdReason ?? null,
    successCriteria: item.successCriteria ?? "Complete the activity and review score impact.",
    evidenceRequired: item.evidenceRequired ?? ["Activity evidence"],
    reason: item.reason ?? item.sourceExcerpt ?? item.nextStep,
    evidence: item.evidence ?? [],
    nextStep: item.nextStep,
  };
}

function mapPersistedRuleActivityToRow(activity) {
  const pendingEvidence = activity.evidenceReviews.find(
    (evidence) => evidence.reviewStatus === "Pending" || evidence.reviewStatus === "Partial",
  );
  const evidence = activity.evidenceReviews.length
    ? activity.evidenceReviews.map((entry) => ({
        source: entry.title,
        sourceType: `${entry.evidenceQuality} / ${entry.reviewStatus}`,
        date: formatDraftDate(entry.submittedAt),
        excerpt: entry.notes || entry.artifactUrl || "Evidence submitted for reviewer validation.",
        reason:
          entry.reviewStatus === "Approved"
            ? `Approved by ${entry.reviewer || "reviewer"} for ${entry.approvedLift || activity.expectedLift}.`
            : entry.reviewStatus === "Rejected"
              ? entry.rejectionReason
              : "Awaiting reviewer validation.",
      }))
    : [
        {
          source: "Evidence pending",
          sourceType: "Governance workflow",
          date: activity.generatedAt ? formatDraftDate(activity.generatedAt) : "Current cycle",
          excerpt: activity.successCriteria || activity.weakSignal,
          reason: "Submit evidence before any parameter score lift can be validated.",
        },
      ];

  return {
    id: `saved-${activity.id}`,
    dbId: activity.id,
    rowType: "saved",
    sourceId: activity.sourceRef || activity.id,
    sourceKind: activity.sourceType || "saved",
    area: activity.parameter,
    title: activity.title,
    owner: activity.owner || "Unassigned",
    dueDate: formatDraftDate(activity.dueDate),
    status: activity.status,
    rag: activity.rag,
    expectedLift: activity.expectedLift || "Governed lift",
    confidence: "Saved",
    ruleId: activity.ruleId,
    parameter: activity.parameter,
    impactedMetric: activity.impactedMetric,
    weakSignal: activity.weakSignal,
    currentValue: activity.currentValue,
    targetValue: activity.targetValue,
    triggerLogic: activity.triggerLogic,
    evidenceLiftPolicy: activity.evidenceLiftPolicy,
    activityScoreLogic: activity.activityScoreLogic,
    approvalSla: activity.approvalSla,
    reviewCadence: activity.reviewCadence,
    scoreBand: activity.triggerLogic?.scoreBand?.replace(" band is active.", "") ?? null,
    threshold: extractThresholdNumber(activity.triggerLogic?.threshold),
    targetScore: extractTargetNumber(activity.triggerLogic?.threshold),
    thresholdSource: activity.triggerLogic?.threshold?.split(":")[0] ?? null,
    thresholdReason: activity.triggerLogic?.overrideReason ?? null,
    successCriteria: activity.successCriteria,
    evidenceRequired: activity.evidenceRequired,
    reason: activity.weakSignal || activity.successCriteria,
    evidence,
    evidenceReviews: activity.evidenceReviews,
    latestPendingEvidence: pendingEvidence,
    nextStep: activity.nextStep,
    activityScorePct: activity.activityScorePct,
    reviewState: `Activity score stage: ${activity.activityScorePct}%`,
  };
}

function mapPersistedMeetingActivityToCard(activity) {
  const row = mapPersistedRuleActivityToRow(activity);
  const sourceLabel =
    activity.triggerLogic?.source === "llm_fallback"
      ? "Fireflies meeting (LLM fallback)"
      : activity.triggerLogic?.source === "summary_derived"
        ? "Fireflies meeting (summary derived)"
        : "Fireflies meeting action";

  return {
    ...row,
    id: `meeting-saved-${activity.id}`,
    persisted: true,
    sourceId: activity.sourceRef || activity.id,
    sourceKind: "fireflies_meeting",
    healthArea: row.area,
    meetingTitle: sourceLabel,
    meetingDate: formatDraftDate(activity.generatedAt),
    sourceExcerpt: activity.weakSignal,
    confidence: activity.rag === "R" ? "High" : activity.rag === "G" ? "Low" : "Medium",
    urgency: activity.rag,
  };
}

function getSuggestionSourceRef(item) {
  return item.sourceId ?? item.id;
}

function extractThresholdNumber(summary = "") {
  const match = summary.match(/threshold\s+([0-9.]+)/i);
  return match ? Number(match[1]) : null;
}

function extractTargetNumber(summary = "") {
  const match = summary.match(/target\s+([0-9.]+)/i);
  return match ? Number(match[1]) : null;
}

function getFallbackRuleId(sourceKind) {
  if (sourceKind === "opportunity") return "OPP-01";
  if (sourceKind === "meeting") return "MEET-01";
  return "MANUAL-01";
}

function buildActivityRuleActivityInput({ accountId, target, form }) {
  const { kind, item } = target;
  const sourceRef = getSuggestionSourceRef(item);
  const parameter = item.parameter ?? item.healthArea ?? item.area ?? "Relationship";
  return {
    accountId,
    ruleId: item.ruleId ?? getFallbackRuleId(kind),
    parameter,
    impactedMetric: item.impactedMetric ?? parameter,
    title: form.title.trim(),
    nextStep: form.nextStep.trim(),
    owner: form.owner.trim(),
    dueDate: form.dueDate,
    rag: item.urgency ?? item.rag ?? mapPriorityToRag(item.priority),
    weakSignal: item.weakSignal ?? item.reason ?? item.sourceExcerpt ?? form.nextStep.trim(),
    currentValue: item.currentValue ?? null,
    targetValue: item.targetValue ?? null,
    expectedLift: item.expectedLift ?? getPotentialValueLabel(item),
    successCriteria: item.successCriteria ?? "Complete the activity and review score impact.",
    evidenceRequired: item.evidenceRequired ?? ["Activity evidence"],
    triggerLogic: item.triggerLogic ?? null,
    evidenceLiftPolicy: item.evidenceLiftPolicy ?? null,
    activityScoreLogic: item.activityScoreLogic ?? null,
    approvalSla: item.approvalSla ?? null,
    reviewCadence: item.reviewCadence ?? null,
    scoreBand: item.scoreBand ?? null,
    threshold: item.threshold ?? null,
    targetScore: item.targetScore ?? null,
    thresholdSource: item.thresholdSource ?? null,
    thresholdReason: item.thresholdReason ?? null,
    sourceType: kind,
    sourceRef,
  };
}

function buildRejectedRuleActivityInput({ accountId, target, reason, reviewer }) {
  const sourceKind = target.sourceKind ?? target.healthArea ?? "suggestion";
  const parameter = target.parameter ?? target.healthArea ?? target.area ?? "Relationship";
  return {
    accountId,
    ruleId: target.ruleId ?? getFallbackRuleId(sourceKind),
    parameter,
    impactedMetric: target.impactedMetric ?? parameter,
    title: target.title,
    reason,
    reviewer,
    rag: target.urgency ?? target.rag ?? mapPriorityToRag(target.priority),
    weakSignal: target.weakSignal ?? target.reason ?? target.sourceExcerpt ?? reason,
    currentValue: target.currentValue ?? null,
    targetValue: target.targetValue ?? null,
    expectedLift: target.expectedLift ?? "",
    successCriteria: target.successCriteria ?? "Rejected by reviewer.",
    evidenceRequired: target.evidenceRequired ?? ["Rejection reason"],
    triggerLogic: target.triggerLogic ?? null,
    evidenceLiftPolicy: target.evidenceLiftPolicy ?? null,
    activityScoreLogic: target.activityScoreLogic ?? null,
    approvalSla: target.approvalSla ?? null,
    reviewCadence: target.reviewCadence ?? null,
    sourceType: sourceKind,
    sourceRef: getSuggestionSourceRef(target),
  };
}

function normalizeHistoryText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function compactHistoryParts(parts) {
  return parts.map(normalizeHistoryText).filter(Boolean).join(" | ");
}

function getActivityHistoryTitle(row = {}) {
  return (
    normalizeHistoryText(row.title) ??
    normalizeHistoryText(row.nextStep) ??
    normalizeHistoryText(row.reason) ??
    normalizeHistoryText(row.weakSignal) ??
    "Untitled activity"
  );
}

function buildActivityHistoryValue(row = {}) {
  const area = row.area ?? row.healthArea ?? row.parameter;
  const dueDate = row.dueDate ?? row.due ?? row.due_date;
  const rag = row.rag ?? row.urgency;
  const expectedLift = row.expectedLift ?? row.expected_lift;
  const nextStep = row.nextStep ?? row.next_step ?? row.reason;

  return compactHistoryParts([
    `Title: ${getActivityHistoryTitle(row)}`,
    area ? `Area: ${area}` : null,
    row.status ? `Status: ${row.status}` : null,
    row.owner ? `Owner: ${row.owner}` : null,
    dueDate ? `Due: ${dueDate}` : null,
    rag ? `RAG: ${rag}` : null,
    expectedLift ? `Expected lift: ${expectedLift}` : null,
    nextStep ? `Next step: ${nextStep}` : null,
  ]);
}

function buildSavedActivityHistoryValue(target, form, createdActivity) {
  const item = target?.item ?? target ?? {};
  return buildActivityHistoryValue({
    ...item,
    ...createdActivity,
    title: form?.title ?? createdActivity?.title ?? item.title,
    owner: form?.owner ?? createdActivity?.owner ?? item.owner,
    dueDate: form?.dueDate ?? createdActivity?.dueDate ?? item.dueDate,
    nextStep: form?.nextStep ?? createdActivity?.nextStep ?? item.nextStep,
    area: createdActivity?.parameter ?? item.area ?? item.healthArea ?? item.parameter,
    parameter: createdActivity?.parameter ?? item.parameter,
    status: createdActivity?.status ?? "Planned",
    rag: createdActivity?.rag ?? item.rag ?? item.urgency,
    expectedLift: createdActivity?.expectedLift ?? item.expectedLift,
  });
}

function buildRejectedActivityHistoryValue(target, reason, rejectedActivity) {
  return compactHistoryParts([
    buildActivityHistoryValue({
      ...target,
      ...rejectedActivity,
      area: rejectedActivity?.parameter ?? target?.area ?? target?.healthArea ?? target?.parameter,
      status: "Rejected",
      nextStep: null,
    }),
    reason ? `Rejection reason: ${reason}` : null,
  ]);
}

function buildAiRecommendationHistoryValue(suggestion = {}) {
  return compactHistoryParts([
    suggestion.title ? `Title: ${suggestion.title}` : null,
    suggestion.healthArea ? `Area: ${suggestion.healthArea}` : null,
    suggestion.expectedLift ? `Expected lift: ${suggestion.expectedLift}` : null,
    suggestion.reason ? `Reason: ${suggestion.reason}` : null,
    suggestion.description ? `Description: ${suggestion.description}` : null,
    suggestion.sourceSummary ? `Source: ${suggestion.sourceSummary}` : null,
  ]);
}

async function logActivityHistoryChange({ accountId, profile, changes }) {
  const seen = new Set();
  const normalizedChanges = changes
    .map((change) => ({
      field: normalizeHistoryText(change.field),
      oldValue: normalizeHistoryText(change.oldValue),
      newValue: normalizeHistoryText(change.newValue),
    }))
    .filter((change) => {
      if (!change.field || change.oldValue === change.newValue) return false;
      const key = `${change.field}|${change.oldValue ?? ""}|${change.newValue ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  if (!normalizedChanges.length) return;
  await logAccountChanges(accountId, normalizedChanges, profile?.name ?? "Unknown");
}

function scoreAreaToParameter(area) {
  const map = {
    relationship: "Relationship",
    project: "Project",
    resource: "Resource",
    financial: "Financial",
    risk: "Risk",
    csat: "CSAT",
    contract: "Financial",
    white_space: "Growth",
  };
  return map[area] ?? area;
}

function getExpectedLiftSortValue(value) {
  const match = String(value ?? "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatLiftNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function summarizeExpectedLift(rows) {
  const percentValues = rows
    .filter((row) => String(row.expectedLift ?? "").includes("%"))
    .map((row) => getExpectedLiftSortValue(row.expectedLift))
    .filter((value) => value !== null);

  if (percentValues.length) {
    const total = percentValues.reduce((sum, value) => sum + value, 0);
    return `${formatLiftNumber(total)}% expected lift`;
  }

  const numericValues = rows
    .map((row) => getExpectedLiftSortValue(row.expectedLift))
    .filter((value) => value !== null);

  if (!numericValues.length) return "0 expected lift";
  return `Max ${formatLiftNumber(Math.max(...numericValues))} expected lift`;
}

function sortActivityRowsByExpectedLift(rows, direction) {
  const baseRows = sortActivityRows(rows);

  return [...baseRows].sort((left, right) => {
    const leftValue = getExpectedLiftSortValue(left.expectedLift);
    const rightValue = getExpectedLiftSortValue(right.expectedLift);

    if (leftValue === null && rightValue === null) return 0;
    if (leftValue === null) return 1;
    if (rightValue === null) return -1;

    return direction === "asc" ? leftValue - rightValue : rightValue - leftValue;
  });
}

function sortActivityRows(rows) {
  const rowTypeOrder = {
    saved: 0,
    suggested: 1,
    existing: 2,
  };
  const ragOrder = { R: 0, A: 1, G: 2 };

  return [...rows].sort((left, right) => {
    const leftArea = ACTIVITY_TAB_AREAS.indexOf(left.area);
    const rightArea = ACTIVITY_TAB_AREAS.indexOf(right.area);
    if (leftArea !== rightArea) return leftArea - rightArea;

    const leftType = rowTypeOrder[left.rowType] ?? 99;
    const rightType = rowTypeOrder[right.rowType] ?? 99;
    if (leftType !== rightType) return leftType - rightType;

    return (ragOrder[left.rag] ?? 99) - (ragOrder[right.rag] ?? 99);
  });
}

function createAiSuggestionActivityForm(suggestion, ownerName) {
  return {
    title: suggestion.title ?? "",
    owner: ownerName ?? "KAM Person",
    dueDate: getFutureDateInput(getSuggestedReviewDays(suggestion)),
    nextStep: suggestion.nextStep ?? suggestion.description ?? suggestion.reason ?? "",
  };
}

const SCORE_AREA_CONFIG = {
  Relationship: {
    key: "relationship",
    blockKey: "relationshipHealth",
    title: "Relationship Health",
  },
  Project: {
    key: "project",
    blockKey: "projectHealth",
    title: "Project Health",
  },
  Resource: {
    key: "resource",
    blockKey: "resourceHealth",
    title: "Resources Health",
  },
  Financial: {
    key: "financial",
    blockKey: "financialHealth",
    title: "Financial Health",
  },
  Risk: {
    key: "risk",
    blockKey: "riskScoring",
    title: "Risk Scoring",
  },
  CSAT: {
    key: "csat",
    blockKey: "csat",
    title: "Customer Satisfaction Score",
  },
};

function normalizeActivityText(value = "") {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getRelatedScoreGap(row) {
  if (row.scoreAreaTitle && row.scoreSection) {
    return `${row.scoreAreaTitle} > ${row.scoreSection}`;
  }
  if (row.impactedMetric && row.sourceKind === "score_metric") {
    const areaTitle = SCORE_AREA_CONFIG[row.area]?.title ?? `${row.area} Health`;
    return `${areaTitle} > ${row.impactedMetric}`;
  }
  return null;
}

function groupDuplicateActivityRows(rows) {
  const grouped = new Map();

  rows.forEach((row) => {
    const key = [
      normalizeActivityText(row.area),
      normalizeActivityText(row.title),
      normalizeActivityText(row.nextStep || row.description || ""),
    ].join("|");
    const existing = grouped.get(key);
    const relatedScoreGap = getRelatedScoreGap(row);

    if (!existing) {
      grouped.set(key, {
        ...row,
        groupedRows: [row],
        relatedScoreGaps: relatedScoreGap ? [relatedScoreGap] : [],
      });
      return;
    }

    const relatedScoreGaps = Array.from(
      new Set([...existing.relatedScoreGaps, relatedScoreGap].filter(Boolean)),
    );
    const groupedRows = [...existing.groupedRows, row];
    grouped.set(key, {
      ...existing,
      id: `group-${key}`,
      groupedRows,
      relatedScoreGaps,
      expectedLift: summarizeExpectedLift(groupedRows),
      reason:
        relatedScoreGaps.length > 1
          ? `Same activity is linked to ${relatedScoreGaps.length} score gaps.`
          : existing.reason,
    });
  });

  return [...grouped.values()];
}

function getAreaScoreValue(account, area) {
  if (area === "Health") return Number(account.health ?? 100) / 10;
  const config = SCORE_AREA_CONFIG[area];
  if (!config) return 10;
  return Number(account[config.blockKey]?.score ?? 10);
}

function getRowScoreValue(row, account) {
  const rows = row.groupedRows ?? [row];
  const values = rows.map((entry) => {
    const explicit = Number(entry.scoreSortValue);
    return Number.isFinite(explicit) ? explicit : getAreaScoreValue(account, entry.area);
  });
  return Math.min(...values);
}

function sortActivityRowsByLowestScore(rows, account) {
  return [...rows].sort((left, right) => {
    const leftScore = getRowScoreValue(left, account);
    const rightScore = getRowScoreValue(right, account);
    if (leftScore !== rightScore) return leftScore - rightScore;

    const leftLift = getExpectedLiftSortValue(left.expectedLift);
    const rightLift = getExpectedLiftSortValue(right.expectedLift);
    if (leftLift !== null || rightLift !== null) return (rightLift ?? -1) - (leftLift ?? -1);

    return sortActivityRows([left, right])[0] === left ? -1 : 1;
  });
}

function findScoreMetricRef(account, row) {
  if (row.scoreAreaKey && row.scoreSectionId && row.scoreCriterionId) {
    return {
      areaKey: row.scoreAreaKey,
      sectionId: row.scoreSectionId,
      fieldId: row.scoreCriterionId,
    };
  }

  const sourceRef = getSuggestionSourceRef(row);
  for (const config of Object.values(SCORE_AREA_CONFIG)) {
    const block = account[config.blockKey];
    for (const section of block?.kpiData ?? []) {
      for (const field of section.fields ?? []) {
        if (`score-metric-${config.key}-${section.id}-${field.id}` === sourceRef) {
          return { areaKey: config.key, sectionId: section.id, fieldId: field.id };
        }
      }
    }
  }

  return null;
}

function calculateKpiScore(sections) {
  const sectionScores = sections.map((section) => {
    const totalWeight = (section.fields ?? []).reduce(
      (sum, field) => sum + (Number(field.weight) || 0),
      0,
    );
    const earned = (section.fields ?? []).reduce(
      (sum, field) => sum + (field.checked ? Number(field.weight) || 0 : 0),
      0,
    );
    return totalWeight > 0 ? (earned / totalWeight) * 10 : 0;
  });

  if (!sectionScores.length) return 0;
  return parseFloat(
    (sectionScores.reduce((sum, score) => sum + score, 0) / sectionScores.length).toFixed(1),
  );
}

async function completeScoreMetricRows({
  account,
  rows,
  profile,
  authAccessToken,
  saveActivityScoreSnapshot,
}) {
  const rowsByArea = new Map();

  rows.forEach((row) => {
    const ref = findScoreMetricRef(account, row);
    if (!ref) return;
    const current = rowsByArea.get(ref.areaKey) ?? [];
    current.push(ref);
    rowsByArea.set(ref.areaKey, current);
  });

  if (!rowsByArea.size) {
    throw new Error("This activity is not linked to a Score Marking Matrics criterion.");
  }

  for (const [areaKey, refs] of rowsByArea.entries()) {
    const areaEntry = Object.values(SCORE_AREA_CONFIG).find((entry) => entry.key === areaKey);
    if (!areaEntry) continue;
    const block = account[areaEntry.blockKey];
    const refKeys = new Set(refs.map((ref) => `${ref.sectionId}|${ref.fieldId}`));
    const baseSections =
      Array.isArray(block?.kpiData) && block.kpiData.length
        ? block.kpiData
        : buildDefaultSections(areaKey, block?.metrics ?? []);
    const sections = baseSections.map((section) => ({
      ...section,
      fields: (section.fields ?? []).map((field) => ({
        ...field,
        checked: refKeys.has(`${section.id}|${field.id}`) ? true : field.checked,
      })),
    }));
    const newScore = calculateKpiScore(sections);
    const metricUpdates = sections
      .map((section) => {
        if (!section.metricId) return null;
        const sectionScore = calculateKpiScore([section]);
        return {
          id: section.metricId,
          label: section.name,
          value: parseFloat(sectionScore.toFixed(1)),
        };
      })
      .filter(Boolean);

    await updateHealthBlock(account.id, areaKey, newScore, metricUpdates, sections);
    await saveActivityScoreSnapshot({
      data: {
        authAccessToken,
        accountId: account.id,
        parameter: scoreAreaToParameter(areaKey),
        metric: areaEntry.title,
        score: newScore,
        source: "activity_done",
        notes: `Activity marked done by ${profile?.name ?? "Unknown"}.`,
      },
    });
    await logAccountChanges(
      account.id,
      [
        {
          field: `Score: ${areaEntry.title}`,
          oldValue: String(block?.score ?? ""),
          newValue: newScore.toFixed(1),
        },
      ],
      profile?.name ?? "Unknown",
    );
  }
}

function isMeetingRelatedActivity(row) {
  const text = [row.title, row.reason, row.nextStep, row.area, row.impactedMetric]
    .filter(Boolean)
    .join(" ");
  return /meeting|meetup|sync|workshop|call|session|discussion|review|follow[-\s]?up|qbr/i.test(
    text,
  );
}

function findPrimaryMeetingContact(account) {
  const stakeholder =
    (account.stakeholders ?? []).find((person) => person.email) ?? account.stakeholders?.[0];
  return {
    name: stakeholder?.name ?? account.primaryContact?.name ?? "",
    role: stakeholder?.role ?? account.primaryContact?.role ?? "",
    email: stakeholder?.email ?? account.primaryContact?.email ?? "",
  };
}

function createMeetingSubject(account, row) {
  if (/director/i.test(row.title + row.reason)) {
    return `Director-Level Relationship Review - ${account.name}`;
  }
  if (/ceo|executive/i.test(row.title + row.reason)) {
    return `Executive Relationship Review - ${account.name}`;
  }
  if (/architecture|technical|delivery|project/i.test(row.title + row.reason)) {
    return `Project Health Review - ${account.name}`;
  }
  return `${row.title} - ${account.name}`;
}

function createMeetingScheduleForm(account, row, profile) {
  const contact = findPrimaryMeetingContact(account);
  const agenda = [
    `Account: ${account.name}`,
    `Activity: ${row.title}`,
    "",
    "Agenda:",
    "- Review current score gap and account context",
    "- Identify missing stakeholders, blockers, or owners",
    "- Align on next steps and due dates",
    "- Confirm follow-up actions",
  ].join("\n");

  return {
    accountName: account.name,
    contactName: [contact.name, contact.role].filter(Boolean).join(" - "),
    contactEmail: contact.email,
    subject: createMeetingSubject(account, row),
    date: getFutureDateInput(2),
    time: "10:00",
    durationMinutes: 45,
    description: `${agenda}\n\nScheduled by ${profile?.name ?? "KAM"}.`,
  };
}

function combineDateAndTime(date, time) {
  return new Date(`${date}T${time || "10:00"}`).toISOString();
}

function formatGoogleCalendarDateTime(date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function buildGoogleCalendarTemplateUrl(form) {
  const start = new Date(`${form.date}T${form.time || "10:00"}`);
  const durationMinutes = Math.max(15, Number(form.durationMinutes) || 45);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: form.subject.trim(),
    dates: `${formatGoogleCalendarDateTime(start)}/${formatGoogleCalendarDateTime(end)}`,
    details: form.description ?? "",
  });
  const attendee = form.contactEmail?.trim();
  if (attendee) params.set("add", attendee);
  if (typeof Intl !== "undefined") {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timeZone) params.set("ctz", timeZone);
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function isValidEmailAddress(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}
/* ============================== TAB 4: Retention VS Growth ============================== */
function RetentionGrowthTab({ account, opportunities, escalations }) {
  const { profile } = useAuth();
  if (account) {
    return (
      <RetentionGrowthTabPlanner
        account={account}
        opportunities={opportunities}
        escalations={escalations}
        profile={profile}
      />
    );
  }
  const editable = getRolePermissions(profile?.role).write;
  const delivered = account.retentionGrowth.filter((s) => s.delivered);
  const offeredNotDelivered = account.retentionGrowth.filter((s) => s.offered && !s.delivered);
  const whiteSpace = account.retentionGrowth.filter((s) => !s.offered && s.applicable);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="What we are offering & giving">
          <p className="text-[11px] text-muted-foreground mb-3">
            Active services delivered to {account.name}.
          </p>
          <ul className="divide-y">
            {delivered.map((s) => (
              <li key={s.service} className="py-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 text-success" /> {s.service}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{s.trackingNote}</p>
                </div>
                <span className="text-[10px] font-bold uppercase bg-success/10 text-success px-2 py-0.5 rounded">
                  Live
                </span>
              </li>
            ))}
            {offeredNotDelivered.map((s) => (
              <li key={s.service} className="py-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <Circle className="size-3.5 text-warn" /> {s.service}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{s.trackingNote}</p>
                </div>
                <span className="text-[10px] font-bold uppercase bg-warn/10 text-warn px-2 py-0.5 rounded">
                  In flight
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Growth - applicable but not offered">
          <p className="text-[11px] text-muted-foreground mb-3">
            White-space services we could expand into.
          </p>
          <ul className="divide-y">
            {whiteSpace.length ? (
              whiteSpace.map((s) => (
                <li key={s.service} className="py-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{s.service}</p>
                    <p className="text-[11px] text-muted-foreground">{s.trackingNote}</p>
                  </div>
                  <button
                    disabled={!editable}
                    className="text-[10px] font-bold text-accent uppercase tracking-wider disabled:opacity-40"
                  >
                    Plan pitch -&gt;
                  </button>
                </li>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">
                No open white-space services right now.
              </p>
            )}
          </ul>
        </Card>
      </div>

      <Card title="Project Tracking & Client Updates">
        <p className="text-[11px] text-muted-foreground mb-3">
          Cadence of progress updates sent to the client.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="border rounded-lg p-4">
            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
              Weekly status
            </p>
            <p className="text-sm font-semibold mt-1">Sent every Friday</p>
            <p className="text-[11px] text-muted-foreground">Last: 2d ago</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
              Monthly review
            </p>
            <p className="text-sm font-semibold mt-1">2nd Tuesday</p>
            <p className="text-[11px] text-muted-foreground">Next: in 9 days</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
              QBR
            </p>
            <p className="text-sm font-semibold mt-1">Quarterly</p>
            <p className="text-[11px] text-muted-foreground">Next: in 38 days</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
/* ============================== TAB 5: Educate client ============================== */
function EducateTab({ account }) {
  const { profile } = useAuth();
  const editable = getRolePermissions(profile?.role).write;

  const articlesMutation = useMutation({
    mutationFn: () =>
      fetchEducationArticles({
        data: {
          services: account.retentionGrowth ?? [],
          industry: account.industry ?? "",
          accountName: account.name ?? "",
        },
      }),
  });

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        <Card title="How to build & improve current relationship">
          <ul className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="text-accent font-bold">1.</span> Re-engage{" "}
              {account.primaryContact.name} ({account.primaryContact.role}) with a short sync every
              two weeks.
            </li>
            <li className="flex gap-3">
              <span className="text-accent font-bold">2.</span> Map 1 new stakeholder per quarter to
              widen the relationship beyond a single sponsor.
            </li>
            <li className="flex gap-3">
              <span className="text-accent font-bold">3.</span> Share one industry insight piece per
              month tailored to {account.industry}.
            </li>
            <li className="flex gap-3">
              <span className="text-accent font-bold">4.</span> Translate every project update into
              business outcomes, not features.
            </li>
          </ul>
        </Card>

        <Card title="Education History">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b">
                <th className="pb-2">Date</th>
                <th className="pb-2">Topic</th>
                <th className="pb-2">Approach</th>
                <th className="pb-2">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {account.educationLog.map((e) => (
                <tr key={e.date + e.topic}>
                  <td className="py-3 text-[11px] font-mono text-muted-foreground whitespace-nowrap pr-3">
                    {e.date}
                  </td>
                  <td className="py-3 text-xs font-semibold pr-3">{e.topic}</td>
                  <td className="py-3 text-xs text-muted-foreground pr-3">{e.approach}</td>
                  <td className="py-3 text-xs">{e.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Recommended Reading — web articles based on active services */}
        <Card title="Recommended Reading">
          <p className="text-[11px] text-muted-foreground mb-3">
            Web articles relevant to {account.name}'s active services — sourced live.
          </p>
          {!articlesMutation.data && !articlesMutation.isPending && !articlesMutation.isError && (
            <button
              onClick={() => articlesMutation.mutate()}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold border rounded-md hover:bg-muted"
            >
              <Sparkles className="size-3 text-accent" />
              Find Articles for {account.name}
            </button>
          )}
          {articlesMutation.isPending && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Searching web for {account.industry} articles…
            </div>
          )}
          {articlesMutation.isError && (
            <p className="text-xs text-destructive">{articlesMutation.error?.message}</p>
          )}
          {articlesMutation.data?.length > 0 && (
            <div className="space-y-3">
              {articlesMutation.data.map((a) => (
                <div key={a.id} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-accent">
                      {a.source}
                    </span>
                    {a.service && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold shrink-0">
                        {a.service}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold leading-snug">{a.title}</p>
                  <p className="text-[11px] text-muted-foreground">{a.summary}</p>
                  <div className="flex items-center justify-between mt-1">
                    <div className="flex flex-wrap gap-1">
                      {a.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-semibold"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    {a.url && a.url !== "#" && (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold text-accent uppercase tracking-wider flex items-center gap-1 hover:underline shrink-0"
                      >
                        Read <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
              <button
                onClick={() => articlesMutation.mutate()}
                disabled={articlesMutation.isPending}
                className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 hover:text-foreground"
              >
                <RefreshCw className="size-3" /> Refresh articles
              </button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
/* ============================== TAB 6: Escalation ============================== */
function EscalationsTab({ list }) {
  if (!list.length) {
    return (
      <div className="bg-card border rounded-xl p-12 text-center">
        <AlertTriangle className="size-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No active escalations for this account.</p>
        <p className="text-[11px] text-muted-foreground mt-1">
          When opened, a 48h SLA timer will appear here with RCA, action items, recommendation, and
          a realistic-requirement check.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {list.map((e) => (
        <div key={e.id} className="bg-crit/5 border border-crit/20 rounded-xl p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-crit text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                  {e.priority}
                </span>
                <h3 className="text-sm font-bold">{e.title}</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Opened {e.openedAt} - 48h SLA</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="bg-primary text-primary-foreground px-3 py-1.5 rounded text-[11px] font-mono flex items-center gap-1">
                <Clock className="size-3" /> {e.slaRemainingHours.toFixed(1)}h left
              </div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Last synced with Jira - 3m ago
              </p>
            </div>
          </div>
          <p className="text-sm mb-4">{e.description}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card p-3 rounded border">
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">RCA</p>
              <p className="text-xs">{e.rca}</p>
            </div>
            <div className="bg-card p-3 rounded border">
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">
                Action Items
              </p>
              <ul className="space-y-1.5">
                {e.actionItems.map((a) => (
                  <li key={a.label} className="flex items-center gap-2 text-xs">
                    {a.done ? (
                      <CheckCircle2 className="size-3.5 text-success" />
                    ) : (
                      <Circle className="size-3.5 text-muted-foreground" />
                    )}
                    <span className={a.done ? "line-through text-muted-foreground" : ""}>
                      {a.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-card p-3 rounded border">
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
                Our Recommendation
              </p>
              <p className="text-xs">{e.recommendation ?? "-"}</p>
            </div>
            <div className="bg-card p-3 rounded border">
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
                Realistic / Achievable?
              </p>
              <p className="text-xs">{e.realisticCheck ?? "-"}</p>
            </div>
            <div className="bg-card p-3 rounded border md:col-span-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">
                Client Feedback
              </p>
              <p className="text-xs italic">
                {e.clientFeedback ?? "Pending - schedule meeting within 48h."}
              </p>
            </div>
            <div className="bg-card p-3 rounded border md:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                  <span className="inline-block size-1.5 rounded-full bg-accent" />
                  Jira Conversation Summary
                </p>
                <span className="text-[10px] font-mono text-muted-foreground">
                  3 tickets - 12 comments
                </span>
              </div>
              <ul className="space-y-2 text-xs">
                <li className="border-l-2 border-accent/40 pl-3">
                  <p className="font-semibold">
                    [ESC-{e.id.toUpperCase()}-1] On-call engineer acknowledged at 14:02 GMT
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    Hot-patch staged in pre-prod; awaiting QA sign-off before client window.
                  </p>
                </li>
                <li className="border-l-2 border-warn/40 pl-3">
                  <p className="font-semibold">
                    [ESC-{e.id.toUpperCase()}-2] Client requested hourly status updates
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    Set up Slack-Jira bridge to auto-post comments to the client channel.
                  </p>
                </li>
                <li className="border-l-2 border-success/40 pl-3">
                  <p className="font-semibold">
                    [ESC-{e.id.toUpperCase()}-3] RCA draft uploaded by SRE lead
                  </p>
                  <p className="text-muted-foreground text-[11px]">
                    Pending KAM review before sharing externally - flagged for 48h SLA.
                  </p>
                </li>
              </ul>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================== TAB 7: Client History ============================== */
function ClientHistoryTab({ accountId, accountName }) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["account-history", accountId],
    queryFn: () => fetchAccountHistory(accountId),
  });
  const touchedFieldCount = useMemo(
    () => new Set(history.map((entry) => entry.fieldName)).size,
    [history],
  );
  const latestEntry = history[0] ?? null;
  const latestEditor = latestEntry?.editedBy ?? "-";

  if (isLoading) {
    return (
      <div className="py-16 text-center text-xs text-muted-foreground">Loading history...</div>
    );
  }
  if (history.length === 0) {
    return (
      <div className="bg-card border rounded-lg p-12 text-center">
        <Clock className="size-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Account field updates will appear here after they are saved.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <HistoryMetric
          icon={History}
          label="Total changes"
          value={history.length}
          detail={`${touchedFieldCount} fields touched`}
          tone="accent"
        />
        <HistoryMetric
          icon={Clock}
          label="Latest update"
          value={latestEntry ? formatHistoryTime(latestEntry.editedAt) : "-"}
          detail={latestEntry?.fieldName ?? "No dated records"}
          tone="warn"
        />
        <HistoryMetric
          icon={User}
          label="Last edited by"
          value={latestEditor}
          detail={accountName}
          tone="primary"
        />
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="px-4 md:px-5 py-4 border-b flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-bold">Change History</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Field-level updates for {accountName} - newest first.
            </p>
          </div>
          <span className="w-fit rounded-md border bg-muted/40 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {history.length} audit entries
          </span>
        </div>

        <div className="divide-y">
          {history.map((entry) => (
            <HistoryChangeItem key={entry.id} entry={entry} />
          ))}
        </div>
      </div>
    </div>
  );
}
function HistoryMetric({ icon: Icon, label, value, detail, tone }) {
  const tones = {
    accent: "bg-accent/10 text-accent",
    success: "bg-success/10 text-success",
    primary: "bg-primary/10 text-primary",
    warn: "bg-warn/10 text-warn",
  };
  return (
    <div className="bg-card border rounded-lg p-4 flex items-start justify-between gap-3 min-w-0">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
          {label}
        </p>
        <p className="text-xl font-bold mt-1 truncate">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-1 truncate">{detail}</p>
      </div>
      <span
        className={`size-9 rounded-md flex items-center justify-center shrink-0 ${tones[tone] ?? tones.accent}`}
      >
        <Icon className="size-4" />
      </span>
    </div>
  );
}
function HistoryChangeItem({ entry }) {
  return (
    <article className="px-4 md:px-5 py-4 hover:bg-muted/20 transition-colors">
      <div className="grid grid-cols-[2.25rem_1fr] gap-3">
        <span className="size-9 rounded-md bg-accent/10 text-accent flex items-center justify-center">
          <History className="size-4" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="border rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-accent/10 text-accent border-accent/20">
                  Change
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Edited by {entry.editedBy}
                </span>
              </div>
              <h4 className="text-sm font-bold mt-2 leading-snug">{entry.fieldName}</h4>
            </div>
            <div className="text-left lg:text-right shrink-0">
              <p className="text-xs font-bold whitespace-nowrap">
                {formatHistoryTime(entry.editedAt)}
              </p>
              {entry.editedAt && (
                <p className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">
                  {formatHistoryDate(entry.editedAt)}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
            <HistoryValue label="Previous" value={entry.oldValue} />
            <HistoryValue label="Updated" value={entry.newValue} emphasize />
          </div>
        </div>
      </div>
    </article>
  );
}
function HistoryValue({ label, value, emphasize }) {
  return (
    <div
      className={`rounded-md border px-3 py-2 min-w-0 ${
        emphasize ? "bg-accent/5 border-accent/20" : "bg-muted/20"
      }`}
    >
      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
        {label}
      </p>
      <p className="text-xs font-semibold mt-1 line-clamp-3 break-words">{toHistoryValue(value)}</p>
    </div>
  );
}
function toHistoryValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "-";
  return String(value);
}
function formatHistoryDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
function ClientHistoryLegacyTab({ accountId }) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["account-history", accountId],
    queryFn: () => fetchAccountHistory(accountId),
  });
  if (isLoading) {
    return (
      <div className="py-16 text-center text-xs text-muted-foreground">Loading history...</div>
    );
  }
  if (history.length === 0) {
    return (
      <div className="bg-card border rounded-xl p-12 text-center">
        <Clock className="size-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Every time a KYC field, KAM assignment, or score is updated, it will appear here.
        </p>
      </div>
    );
  }
  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b">
        <h3 className="text-sm font-bold">Change Log</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          All edits to this account - most recent first.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left min-w-[640px]">
          <thead>
            <tr className="bg-muted/30 border-b text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
              <th className="px-6 py-3">Field</th>
              <th className="px-6 py-3">Old Value</th>
              <th className="px-6 py-3">New Value</th>
              <th className="px-6 py-3">Edited By</th>
              <th className="px-6 py-3 text-right">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {history.map((entry) => (
              <HistoryRow key={entry.id} entry={entry} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function HistoryRow({ entry }) {
  return (
    <tr className="hover:bg-muted/20 transition-colors align-top">
      <td className="px-6 py-3 text-xs font-semibold whitespace-nowrap">{entry.fieldName}</td>
      <td className="px-6 py-3 text-xs text-muted-foreground max-w-[200px]">
        <span className="line-clamp-2 block">
          {entry.oldValue ?? <span className="italic">-</span>}
        </span>
      </td>
      <td className="px-6 py-3 text-xs text-foreground max-w-[200px]">
        <span className="line-clamp-2 block">
          {entry.newValue ?? <span className="italic">-</span>}
        </span>
      </td>
      <td className="px-6 py-3 text-xs font-medium whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <div className="size-5 rounded-full bg-accent/10 text-accent flex items-center justify-center text-[9px] font-bold shrink-0">
            {entry.editedBy
              .split(" ")
              .map((p) => p[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          {entry.editedBy}
        </div>
      </td>
      <td className="px-6 py-3 text-right text-[11px] text-muted-foreground whitespace-nowrap">
        {formatHistoryTime(entry.editedAt)}
      </td>
    </tr>
  );
}
function formatHistoryTime(iso) {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  const hours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(diffMs / 86_400_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
/* ============================== Shared atoms ============================== */
function Card({ title, children }) {
  return (
    <div className="bg-card border rounded-xl p-6">
      <h3 className="text-sm font-bold mb-4">{title}</h3>
      <div className="space-y-3 text-sm">{children}</div>
    </div>
  );
}
function KV({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
function Field({ label, value, ok }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
        {label}
      </p>
      <p
        className={`font-semibold mt-1 ${ok === true ? "text-success" : ok === false ? "text-crit" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
