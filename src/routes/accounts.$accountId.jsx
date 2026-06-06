import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatCurrency, getRolePermissions } from "@/data/kam-data";
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
  generateAccountLinkedinSummary,
  generateAccountWebsiteSummary,
} from "@/services/db";
import { lookupSalesforceAccountBundle } from "@/services/salesforce";
import { extractSowFields } from "@/services/sow-upload";
import { fetchEducationArticles } from "@/services/education";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
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
  "Retention VS Growth",
  "Educate client",
  "Escalation",
  "Client History",
];
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
  const text = String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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
  return String(value ?? "").trim().toLowerCase();
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
      row.kind === "retentionGrowth" && row.dbColumn !== "service" && !hasSyncValue(row.serviceValue);
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
  const existingRetentionService = findRetentionGrowthService(account.retentionGrowth ?? [], retentionService);
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
  const { profile } = useAuth();
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
              {formatCurrency(account.growthUpside)}
            </span>
            <p className="text-xs text-muted-foreground mt-2">
              {account.whiteSpaceCount} white-space items
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
            <ActivityTab account={account} opportunities={accountOpportunities} />
          )}
          {tab === "Retention VS Growth" && <RetentionGrowthTab account={account} escalations={accountEscalations} />}
          {tab === "Educate client" && <EducateTab account={account} />}
          {tab === "Escalation" && <EscalationsTab list={accountEscalations} />}
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
      industry: account.industry,
      business: account.businessInfo,
      history: account.clientHistory,
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
    }),
    [
      account.businessInfo,
      account.clientHistory,
      account.competitors,
      account.engagementTenure,
      account.industry,
      account.isStartup,
      account.contractRenewalDate,
      account.contractDuration,
      account.contractScoring?.duration,
      account.linkedinUrl,
      account.mainBusinessFlow,
      account.mrrArr,
      account.revenue,
      account.teamSize,
      account.websiteUrl,
    ],
  );
  const [fields, setFields] = useState(initialFields);
  const [savedSnapshot, setSavedSnapshot] = useState(initialFields);
  const [showSaved, setShowSaved] = useState(false);
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
  const KYC_LABELS = {
    industry: "Industry Info",
    business: "Business Info",
    history: "Client History Notes",
    revenue: "Revenue Info",
    mrrArr: "MRR / ARR",
    primary: "Primary Contact",
    tenure: "Engagement Tenure",
    team: "Team Size",
    competitors: "Competitors",
    flow: "Main Business Flow",
    contractRenewalDate: "Contract Renewal Date",
    contractDuration: "Contract Duration",
    linkedinUrl: "LinkedIn URL",
    websiteUrl: "Website URL",
  };
  const { mutate: saveKyc, isPending: savingKyc } = useMutation({
    mutationFn: async () => {
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
    onSuccess: () => {
      setSavedSnapshot({ ...fields });
      setShowSaved(true);
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["account-history", account.id] });
    },
  });
  // OCR file state
  const [ocrFile, setOcrFile] = useState(null);
  const [ocrStatus, setOcrStatus] = useState("idle");
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
  function runOcrSimulation() {
    if (!ocrFile) return;
    setOcrStatus("processing");
    // Front-end simulation only - real OCR will be wired later
    setTimeout(() => {
      setFields((f) => ({
        ...f,
        industry: `${account.industry} - ${account.region} (auto-filled from "${ocrFile.name}")`,
        business: `${account.businessInfo} - extracted from uploaded document.`,
      }));
      setOcrStatus("done");
    }, 1200);
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

      {/* OCR Auto-fill upload */}
      <div className="border rounded-xl p-5 bg-card">
        <div className="flex items-start gap-3 mb-3">
          <span className="size-9 rounded-md bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <Sparkles className="size-4" />
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold">OCR Auto-fill from Document</h3>
            <p className="text-[11px] text-muted-foreground">
              Upload a brief, RFP, NDA, deck or scanned card. We'll extract industry, business,
              stakeholders, revenue and auto-populate any KYC field that's empty or unverified.
              (Front-end preview - OCR engine wires up later.)
            </p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <label className="flex-1 flex items-center gap-2 border-2 border-dashed rounded-md px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
            <Upload className="size-4 text-muted-foreground" />
            <span className="text-xs truncate">
              {ocrFile ? ocrFile.name : "Choose a file (PDF, PNG, JPG, DOCX)..."}
            </span>
            <input
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.docx"
              onChange={(e) => {
                setOcrFile(e.target.files?.[0] ?? null);
                setOcrStatus("idle");
              }}
            />
          </label>
          <button
            onClick={runOcrSimulation}
            disabled={!ocrFile || !editable || ocrStatus === "processing"}
            className="px-4 py-2.5 bg-accent text-white text-xs font-bold rounded-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Sparkles className="size-3.5" />
            {ocrStatus === "processing"
              ? "Extracting..."
              : ocrStatus === "done"
                ? "Re-extract"
                : "Extract & Auto-fill"}
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
        {ocrStatus === "done" && (
          <p className="text-[11px] text-success mt-2 flex items-center gap-1">
            <CheckCircle2 className="size-3" />
            Extraction complete - 2 KYC fields updated. Review highlighted fields below.
          </p>
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
        >
          <span className="text-success font-semibold">Key Account</span>
          <span className="text-muted-foreground">
            {" "}
            - all accounts in our system are key accounts
          </span>
        </KycField>

        <KycField
          n={2}
          label="Industry Info"
          icon={<Building2 className="size-4" />}
          editable={editable}
          value={fields.industry}
          onChange={(v) => setFields((f) => ({ ...f, industry: v }))}
        />

        <KycField
          n={3}
          label="Business Info"
          icon={<Workflow className="size-4" />}
          editable={editable}
          value={fields.business}
          onChange={(v) => setFields((f) => ({ ...f, business: v }))}
          multiline
        />

        <KycField
          n={4}
          label="Client History"
          icon={<Clock className="size-4" />}
          editable={editable}
          value={fields.history}
          onChange={(v) => setFields((f) => ({ ...f, history: v }))}
          multiline
        />

        <KycField
          n={5}
          label="Stakeholders Info"
          icon={<Users className="size-4" />}
          editable={false}
        >
          <p className="font-semibold">{account.stakeholders.length} stakeholders</p>
          <ul className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
            {account.stakeholders.slice(0, 3).map((s) => (
              <li key={s.name}>
                - {s.name} - {s.role} <span className="text-accent">({s.influence})</span>
              </li>
            ))}
          </ul>
        </KycField>

        <KycField
          n={6}
          label="Revenue Info"
          icon={<DollarSign className="size-4" />}
          editable={editable}
          value={fields.revenue}
          onChange={(v) => setFields((f) => ({ ...f, revenue: v }))}
        />

        <KycField
          n={7}
          label="MRR / ARR (Startups)"
          icon={<TrendingUp className="size-4" />}
          editable={editable}
          value={fields.mrrArr}
          onChange={(v) => setFields((f) => ({ ...f, mrrArr: v }))}
        />

        <KycField
          n={8}
          label="Person Info (Primary)"
          icon={<User className="size-4" />}
          editable={editable}
          value={fields.primary}
          onChange={(v) => setFields((f) => ({ ...f, primary: v }))}
        />

        <KycField
          n={9}
          label="Engagement Tenure"
          icon={<Calendar className="size-4" />}
          editable={editable}
          value={fields.tenure}
          onChange={(v) => setFields((f) => ({ ...f, tenure: v }))}
        />

        <KycField
          n={10}
          label="Team Size"
          icon={<Users className="size-4" />}
          editable={editable}
          value={fields.team}
          onChange={(v) => setFields((f) => ({ ...f, team: v }))}
        />

        <KycField
          n={11}
          label="Competitors"
          icon={<Swords className="size-4" />}
          editable={editable}
          value={fields.competitors}
          onChange={(v) => setFields((f) => ({ ...f, competitors: v }))}
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
              <p className="text-xs font-semibold">{formatDisplayDate(fields.contractRenewalDate)}</p>
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
            className={`text-xs font-medium ${showSaved && !isDirty ? "text-success" : "text-muted-foreground"}`}
          >
            {showSaved && !isDirty
              ? "KYC fields saved successfully"
              : "You have unsaved changes in KYC fields"}
          </p>
          <div className="flex gap-2">
            {isDirty && (
              <button
                onClick={() => {
                  setFields(savedSnapshot);
                  setShowSaved(false);
                }}
                className="px-3 py-1.5 text-xs border rounded-md hover:bg-muted transition-colors"
              >
                Discard
              </button>
            )}
            {isDirty && (
              <button
                onClick={() => saveKyc()}
                disabled={savingKyc}
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
function KycField({ n, label, icon, children, wide, editable, value, onChange, multiline }) {
  const [editing, setEditing] = useState(false);
  return (
    <div
      className={`bg-card border rounded-xl p-4 hover:border-accent/40 transition-colors group ${wide ? "md:col-span-2 lg:col-span-3" : ""}`}
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
        {value !== undefined && onChange ? (
          editing ? (
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
  return (
    <div className="space-y-6">
      {/* All 8 health areas + overall at a glance */}
      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
        <ScoreCard
          title="Overall"
          score={account.health / 10}
          subtitle={`${account.trend >= 0 ? "+" : ""}${account.trend}%`}
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
function ScoreCard({ title, score, subtitle, inverse }) {
  const good = inverse ? score >= 7 : score >= 8;
  const ok = inverse ? score >= 5 : score >= 6;
  const color = good ? "text-success" : ok ? "text-warn" : "text-crit";
  return (
    <div className="bg-card border rounded-xl p-3">
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold truncate">
        {title}
      </p>
      <p className={`text-xl font-bold mt-0.5 ${color}`}>
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
function KpiEditorModal({ title, hint, block, area, accountId, onClose }) {
  const { profile } = useAuth();
  const editable = getRolePermissions(profile?.role).write;
  const editorUser = profile?.name ?? "Unknown";
  const router = useRouter();
  const queryClient = useQueryClient();

  const [sections, setSections] = useState(() => {
    if (block.kpiData) return block.kpiData;
    return buildDefaultSections(area, block.metrics);
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
      await logAccountChanges(
        accountId,
        [
          {
            field: `Score: ${title}`,
            oldValue: block.score.toFixed(1),
            newValue: newScore.toFixed(1),
          },
        ],
        editorUser,
      );
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
      <div className="px-4 md:px-6 py-4 border-b grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <ContractFact label="Type" value={c.type || account.contractType} />
        <ContractFact label="Duration" value={c.duration} />
        <ContractFact label="Renewal Date" value={formatDisplayDate(c.renewalDate)} />
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
function ActivityTab({ account, opportunities }) {
  const { profile } = useAuth();
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
                    +{formatCurrency(o.potential)}
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
            <h3 className="text-sm font-bold">
              Extract Action Items from Meeting Notes to Increase Score
            </h3>
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
              <th className="px-6 py-3 text-right">Expected Lift</th>
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
                    <td className="px-6 py-3 text-xs text-right font-semibold text-success">
                      {a.expectedLift}
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
/* ============================== TAB 4: Retention VS Growth ============================== */
function RetentionGrowthTab({ account, escalations = [] }) {
  const { profile } = useAuth();
  const editable = getRolePermissions(profile?.role).write;
  const delivered = account.retentionGrowth.filter((s) => s.delivered);
  const offeredNotDelivered = account.retentionGrowth.filter((s) => s.offered && !s.delivered);
  const whiteSpace = account.retentionGrowth.filter((s) => !s.offered && s.applicable);
  const notApplicable = account.retentionGrowth.filter((s) => !s.applicable);
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

      <Card title="Not applicable to this client">
        <p className="text-[11px] text-muted-foreground mb-3">
          Track explicitly so the team doesn't pitch the wrong thing.
        </p>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          {notApplicable.map((s) => (
            <li key={s.service} className="border rounded-lg p-3">
              <p className="font-semibold">{s.service}</p>
              <p className="text-[11px] text-muted-foreground">{s.trackingNote}</p>
            </li>
          ))}
        </ul>
      </Card>

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
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-semibold">
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
