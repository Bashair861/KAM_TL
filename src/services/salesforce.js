import { createServerFn } from "@tanstack/react-start";

const DEFAULT_SALESFORCE_ORG_ALIAS = "kamDummy";
const DEFAULT_SALESFORCE_API_VERSION = "v66.0";

const ACCOUNT_FIELDS = [
  "Id",
  "Name",
  "Website",
  "Industry",
  "AnnualRevenue",
  "NumberOfEmployees",
  "Contract_Value__c",
  "ARR__c",
  "Contract_Renewal_Date__c",
  "Contract_Duration__c",
  "Contract_Type__c",
  "Last_Touch__c",
  "Primary_Contact_Name__c",
  "Primary_Contact_Role__c",
  "Auto_Renew__c",
  "Non_Terminator__c",
  "Min_One_Year__c",
  "Price_Hike__c",
  "Backup_Exists__c",
  "Critical_Resources__c",
  "Customer_Feedback__c",
  "Retention_Service__c",
  "Retention_Service_Offered__c",
  "Retention_Service_Delivered__c",
  "BillingCity",
  "BillingStateCode",
  "BillingCountryCode",
  "Description",
  "Company_Type_ICP__c",
  "Company_Stage__c",
  "ICP_Bucket__c",
  "Need_Type__c",
  "SDR_Name__c",
  "Company_LinkedIn__c",
  "Services_Offered__c",
  "Target_Audience__c",
  "Revenue_Generation_Model__c",
  "Funding_Stage__c",
  "Funding_Amount__c",
  "Intersection_Areas__c",
  "Previous_Communication_Needs__c",
  "Salesforce_Usage_Summary__c",
  "Salesforce_Years_Used__c",
  "Current_Salesforce_Platform__c",
  "Previous_Salesforce_Platform__c",
  "Requested_Solution__c",
  "Initial_Engagement_Type__c",
  "Trial_Hours_Offered__c",
  "Partnership_Program__c",
  "Technical_Resources_Available__c",
  "Technical_Resources_Location__c",
  "Tech_Stack_Notes__c",
  "SaaS_Platforms_Used__c",
  "Outsourcing_Status__c",
  "Tech_Job_Openings__c",
  "Executive_Location__c",
  "Discovery_Call_DateTime__c",
  "Discovery_Call_Timezone__c",
  "KYC_Research_Notes__c",
];

const CONTACT_FIELDS = [
  "Id",
  "AccountId",
  "FirstName",
  "LastName",
  "Name",
  "Email",
  "Title",
  "MailingCity",
  "MailingStateCode",
  "MailingCountryCode",
  "LinkedIn_Profile__c",
  "Prospect_Persona__c",
  "Technical_Background__c",
  "Relevance_To_Tkxel__c",
  "Decision_Maker__c",
  "Primary_KYC_Contact__c",
  "Primary_Interest__c",
  "Contact_Need_Summary__c",
  "Previous_Communication_Summary__c",
  "Additional_Role_Context__c",
  "Discovery_Call_DateTime__c",
  "Discovery_Call_Timezone__c",
];

const ACCOUNT_LABELS = {
  Id: "Salesforce Account ID",
  Name: "Account Name",
  Website: "Website",
  Industry: "Industry",
  AnnualRevenue: "Annual Revenue",
  NumberOfEmployees: "Number of Employees",
  Contract_Value__c: "Contract Value",
  ARR__c: "ARR",
  Contract_Renewal_Date__c: "Contract Renewal Date",
  Contract_Duration__c: "Contract Duration",
  Contract_Type__c: "Contract Type",
  Last_Touch__c: "Last Touch",
  Primary_Contact_Name__c: "Primary Contact Name",
  Primary_Contact_Role__c: "Primary Contact Role",
  Auto_Renew__c: "Auto Renew",
  Non_Terminator__c: "Non Terminator",
  Min_One_Year__c: "Minimum One Year",
  Price_Hike__c: "Price Hike",
  Backup_Exists__c: "Backup Exists",
  Critical_Resources__c: "Critical Resources",
  Customer_Feedback__c: "Customer Feedback",
  Retention_Service__c: "Retention/Growth Service",
  Retention_Service_Offered__c: "Retention/Growth Offered",
  Retention_Service_Delivered__c: "Retention/Growth Delivered",
  BillingCity: "Billing City",
  BillingStateCode: "Billing State Code",
  BillingCountryCode: "Billing Country Code",
  Description: "Description",
  Company_Type_ICP__c: "Company Type ICP",
  Company_Stage__c: "Company Stage",
  ICP_Bucket__c: "ICP Bucket",
  Need_Type__c: "Need Type",
  SDR_Name__c: "SDR Name",
  Company_LinkedIn__c: "Company LinkedIn",
  Services_Offered__c: "Services Offered",
  Target_Audience__c: "Target Audience",
  Revenue_Generation_Model__c: "Revenue Generation Model",
  Funding_Stage__c: "Funding Stage",
  Funding_Amount__c: "Funding Amount",
  Intersection_Areas__c: "Intersection Areas",
  Previous_Communication_Needs__c: "Previous Communication / Needs",
  Salesforce_Usage_Summary__c: "Salesforce Usage Summary",
  Salesforce_Years_Used__c: "Salesforce Years Used",
  Current_Salesforce_Platform__c: "Current Salesforce Platform",
  Previous_Salesforce_Platform__c: "Previous Salesforce Platform",
  Requested_Solution__c: "Requested Solution",
  Initial_Engagement_Type__c: "Initial Engagement Type",
  Trial_Hours_Offered__c: "Trial Hours Offered",
  Partnership_Program__c: "Partnership Program",
  Technical_Resources_Available__c: "Technical Resources Available",
  Technical_Resources_Location__c: "Technical Resources Location",
  Tech_Stack_Notes__c: "Tech Stack Notes",
  SaaS_Platforms_Used__c: "SaaS Platforms Used",
  Outsourcing_Status__c: "Outsourcing Status",
  Tech_Job_Openings__c: "Tech Job Openings",
  Executive_Location__c: "Executive Location",
  Discovery_Call_DateTime__c: "Discovery Call Date/Time",
  Discovery_Call_Timezone__c: "Discovery Call Timezone",
  KYC_Research_Notes__c: "KYC Research Notes",
};

const CONTACT_LABELS = {
  Id: "Salesforce Contact ID",
  AccountId: "Related Account ID",
  FirstName: "First Name",
  LastName: "Last Name",
  Name: "Full Name",
  Email: "Email",
  Title: "Title",
  MailingCity: "Mailing City",
  MailingStateCode: "Mailing State Code",
  MailingCountryCode: "Mailing Country Code",
  LinkedIn_Profile__c: "LinkedIn Profile",
  Prospect_Persona__c: "Prospect Persona",
  Technical_Background__c: "Technical Background",
  Relevance_To_Tkxel__c: "Relevance To Tkxel",
  Decision_Maker__c: "Decision Maker",
  Primary_KYC_Contact__c: "Primary KYC Contact",
  Primary_Interest__c: "Primary Interest",
  Contact_Need_Summary__c: "Contact Need Summary",
  Previous_Communication_Summary__c: "Previous Communication Summary",
  Additional_Role_Context__c: "Additional Role Context",
  Discovery_Call_DateTime__c: "Discovery Call Date/Time",
  Discovery_Call_Timezone__c: "Discovery Call Timezone",
};

function readEnv(name) {
  if (typeof process !== "undefined" && process.env?.[name]) return process.env[name];
  return undefined;
}

function validateLookupInput(input) {
  if (!input || typeof input !== "object") throw new Error("Invalid Salesforce lookup payload.");
  const accountName = String(input.accountName ?? "").trim();
  const accessToken = String(input.accessToken ?? "");
  if (!accountName) throw new Error("Account name is required for Salesforce lookup.");
  if (!accessToken) throw new Error("Please sign in again before searching Salesforce.");
  return { accountName, accessToken };
}

async function assertSignedIn(accessToken) {
  const supabaseUrl = readEnv("VITE_SUPABASE_URL");
  const supabaseAnonKey = readEnv("VITE_SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are required before searching Salesforce.");
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data?.user) throw new Error("Please sign in again before searching Salesforce.");
}

async function getSalesforceAuth() {
  const configuredApiVersion = readEnv("SALESFORCE_API_VERSION") ?? DEFAULT_SALESFORCE_API_VERSION;
  const instanceUrl = readEnv("SALESFORCE_INSTANCE_URL");

  // Primary path: OAuth Username-Password flow.
  // Requires SALESFORCE_CLIENT_ID, SALESFORCE_CLIENT_SECRET, SALESFORCE_USERNAME,
  // SALESFORCE_PASSWORD (password + security token concatenated, no space).
  // Works on every machine — no Salesforce CLI needed.
  const clientId = readEnv("SALESFORCE_CLIENT_ID");
  const clientSecret = readEnv("SALESFORCE_CLIENT_SECRET");
  const username = readEnv("SALESFORCE_USERNAME");
  const password = readEnv("SALESFORCE_PASSWORD");

  if (instanceUrl && clientId && clientSecret) {
    // OAuth 2.0 Client Credentials flow — server-to-server, no username/password needed.
    // Works on all machines and hosting platforms (Cloudflare Pages, Vercel, etc.).
    // Requires "Enable Client Credentials Flow" checked on the Connected App in Salesforce Setup,
    // with a "Run As" user assigned under Manage → Edit Policies.
    const loginUrl = (readEnv("SALESFORCE_LOGIN_URL") ?? instanceUrl).replace(/\/$/, "");
    const tokenRes = await fetch(`${loginUrl}/services/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      throw new Error(`Salesforce authentication failed (${tokenRes.status}): ${body}`);
    }

    const tokenData = await tokenRes.json();
    return {
      instanceUrl: (tokenData.instance_url ?? instanceUrl).replace(/\/$/, ""),
      accessToken: tokenData.access_token,
      apiVersion: normalizeApiVersion(configuredApiVersion),
      source: "oauth-client-credentials",
    };
  }

  // Secondary fallback: static access token env var (expires — not recommended for teams).
  const configuredAccessToken = readEnv("SALESFORCE_ACCESS_TOKEN");
  if (instanceUrl && configuredAccessToken) {
    return {
      instanceUrl: instanceUrl.replace(/\/$/, ""),
      accessToken: configuredAccessToken,
      apiVersion: normalizeApiVersion(configuredApiVersion),
      source: "env",
    };
  }

  // Last resort: local sf CLI (only works on machines with Salesforce CLI installed).
  return getSalesforceAuthFromCli();
}

function normalizeApiVersion(version) {
  const value = String(version || DEFAULT_SALESFORCE_API_VERSION).trim();
  return value.startsWith("v") ? value : `v${value}`;
}

async function getSalesforceAuthFromCli() {
  const orgAlias = readEnv("SALESFORCE_ORG_ALIAS") ?? DEFAULT_SALESFORCE_ORG_ALIAS;
  if (!/^[\w@.-]+$/.test(orgAlias)) {
    throw new Error("SALESFORCE_ORG_ALIAS contains unsupported characters.");
  }
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  const execOptions = { timeout: 30_000, maxBuffer: 1024 * 1024 };
  const { stdout } =
    process.platform === "win32"
      ? await execFileAsync(
          process.env.ComSpec ?? "cmd.exe",
          ["/d", "/s", "/c", `sf org display -o ${orgAlias} --verbose --json`],
          execOptions,
        )
      : await execFileAsync(
          "sf",
          ["org", "display", "-o", orgAlias, "--verbose", "--json"],
          execOptions,
        );
  const parsed = JSON.parse(stdout);
  const result = parsed.result ?? {};
  if (!result.instanceUrl || !result.accessToken) {
    throw new Error(
      `Salesforce org '${orgAlias}' is not authenticated. Run: sf org login web -a ${orgAlias}`,
    );
  }
  return {
    instanceUrl: result.instanceUrl.replace(/\/$/, ""),
    accessToken: result.accessToken,
    apiVersion: normalizeApiVersion(result.apiVersion ?? DEFAULT_SALESFORCE_API_VERSION),
    source: `sf:${orgAlias}`,
  };
}

function escapeSoqlString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function salesforceRequest(auth, path) {
  const response = await fetch(`${auth.instanceUrl}/services/data/${auth.apiVersion}/${path}`, {
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Salesforce request failed (${response.status}): ${body}`);
  }

  return response.json();
}

async function runSoql(auth, soql) {
  const query = new URLSearchParams({ q: soql }).toString();
  return salesforceRequest(auth, `query?${query}`);
}

async function getAvailableSalesforceFields(auth, objectName, requestedFields) {
  const describe = await salesforceRequest(auth, `sobjects/${objectName}/describe`);
  const availableFields = new Set((describe.fields ?? []).map((field) => field.name));
  return requestedFields.filter((field) => availableFields.has(field));
}

async function findSalesforceAccount(auth, accountName, accountFields) {
  const fields = accountFields.join(", ");
  const escapedName = escapeSoqlString(accountName);
  const exact = await runSoql(
    auth,
    `SELECT ${fields} FROM Account WHERE Name = '${escapedName}' ORDER BY LastModifiedDate DESC LIMIT 1`,
  );
  if (exact.records?.length) return { account: exact.records[0], matchType: "Exact name match" };

  return { account: null, matchType: "No match" };
}

async function fetchContactsForAccount(auth, accountId, contactFields) {
  const fields = contactFields.join(", ");
  const escapedAccountId = escapeSoqlString(accountId);
  const orderFields = [];
  if (contactFields.includes("Primary_KYC_Contact__c")) orderFields.push("Primary_KYC_Contact__c DESC");
  orderFields.push(contactFields.includes("LastName") ? "LastName ASC" : "Name ASC");
  const result = await runSoql(
    auth,
    `SELECT ${fields} FROM Contact WHERE AccountId = '${escapedAccountId}' ORDER BY ${orderFields.join(", ")} LIMIT 20`,
  );
  return result.records ?? [];
}

function stripAttributes(record) {
  const { attributes: _attributes, ...rest } = record ?? {};
  return rest;
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  return String(value);
}

function formatRecordLines(record, fields, labels) {
  return fields.map((field) => `${labels[field] ?? field}: ${formatValue(record?.[field])}`);
}

function formatSalesforceResult({
  searchedName,
  matchType,
  account,
  contacts,
  authSource,
  accountFields,
  contactFields,
}) {
  const lines = [
    "Salesforce Account Lookup Result",
    "================================",
    `Searched company name: ${searchedName}`,
    `Match type: ${matchType}`,
    `Auth source: ${authSource}`,
    "",
    "Account",
    "-------",
    ...formatRecordLines(account, accountFields, ACCOUNT_LABELS),
    "",
    `Related Contacts (${contacts.length})`,
    "-------------------",
  ];

  if (contacts.length === 0) {
    lines.push("No related contacts found.");
  } else {
    contacts.forEach((contact, index) => {
      lines.push("", `Contact ${index + 1}`, "---------");
      lines.push(...formatRecordLines(contact, contactFields, CONTACT_LABELS));
    });
  }

  return lines.join("\n");
}

export const lookupSalesforceAccountBundle = createServerFn({ method: "POST" })
  .inputValidator(validateLookupInput)
  .handler(async ({ data }) => {
    await assertSignedIn(data.accessToken);
    const auth = await getSalesforceAuth();
    const accountFields = await getAvailableSalesforceFields(auth, "Account", ACCOUNT_FIELDS);
    const contactFields = await getAvailableSalesforceFields(auth, "Contact", CONTACT_FIELDS);
    const { account, matchType } = await findSalesforceAccount(auth, data.accountName, accountFields);

    if (!account) {
      return {
        found: false,
        message: `Account or company '${data.accountName}' was not found in Salesforce.`,
        formattedText: `Account or company '${data.accountName}' was not found in Salesforce.`,
      };
    }

    const contacts = await fetchContactsForAccount(auth, account.Id, contactFields);
    const cleanedAccount = stripAttributes(account);
    const cleanedContacts = contacts.map(stripAttributes);

    return {
      found: true,
      matchType,
      account: cleanedAccount,
      contacts: cleanedContacts,
      formattedText: formatSalesforceResult({
        searchedName: data.accountName,
        matchType,
        account: cleanedAccount,
        contacts: cleanedContacts,
        authSource: auth.source,
        accountFields,
        contactFields,
      }),
    };
  });
