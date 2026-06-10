import { formatCurrency } from "@/data/kam-data";

const HIGH_VALUE_THRESHOLD = 100_000;
const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };
const SIGNAL_ORDER = { High: 0, Medium: 1, Low: 2 };
const RETENTION_HEALTH_THRESHOLD = 75;
const GROWTH_POTENTIAL_THRESHOLD = 75;
const DATA_STALE_DAYS = 30;

const RETENTION_SCORE_WEIGHTS = [
  {
    metric: "Overall account health",
    weight: 25,
    systemOfRecord: "accounts.health",
    rationale:
      "Carries the highest weight because retention starts with the blended account health already reviewed by the KAM team.",
    missingHandling: "Missing health is treated as 0 in the score and flagged in data quality.",
  },
  {
    metric: "Renewal proximity",
    weight: 20,
    systemOfRecord: "accounts.renewal_days",
    rationale:
      "Near-term renewals create immediate revenue-protection urgency, so renewal proximity is separated from generic health.",
    missingHandling: "Missing renewal days use a neutral 50/100 renewal score and are flagged.",
  },
  {
    metric: "Risk score",
    weight: 15,
    systemOfRecord: "health_scores + health_metrics / Risk",
    rationale:
      "Operational and competitive risk can override otherwise healthy relationship signals.",
    missingHandling: "Missing risk score is treated as 0 in the score and flagged.",
  },
  {
    metric: "Relationship score",
    weight: 15,
    systemOfRecord: "health_scores + health_metrics / Relationship",
    rationale:
      "Executive access and stakeholder cadence are leading indicators for renewal confidence.",
    missingHandling: "Missing relationship score is treated as 0 in the score and flagged.",
  },
  {
    metric: "CSAT score",
    weight: 15,
    systemOfRecord: "health_scores + health_metrics / CSAT",
    rationale:
      "Client sentiment is a direct churn-risk signal, especially when paired with renewal proximity.",
    missingHandling: "Missing CSAT is treated as 0 in the score and flagged.",
  },
  {
    metric: "Financial health",
    weight: 10,
    systemOfRecord: "health_scores + health_metrics / Financial",
    rationale:
      "Financial friction matters, but it is weighted lower than delivery, relationship, and sentiment signals.",
    missingHandling: "Missing financial score is treated as 0 in the score and flagged.",
  },
];

const GROWTH_SCORE_WEIGHTS = [
  {
    metric: "Whitespace services",
    weight: 30,
    systemOfRecord: "retention_growth.applicable + retention_growth.offered",
    rationale:
      "Whitespace gets the largest growth weight because services marked applicable-but-not-offered are the most actionable expansion path.",
    missingHandling:
      "If account white_space_count is missing, the app counts applicable-but-not-offered services.",
  },
  {
    metric: "Growth upside ratio",
    weight: 20,
    systemOfRecord: "accounts.growth_upside + accounts.arr",
    rationale:
      "Commercial upside relative to current ARR shows whether the expansion is material for the account.",
    missingHandling:
      "Missing ARR or growth upside contributes 0 and is flagged when ARR is absent.",
  },
  {
    metric: "Current service proof",
    weight: 20,
    systemOfRecord: "retention_growth.delivered/offered + tracking_note",
    rationale:
      "Live or positively tracked services prove credibility before pitching adjacent services.",
    missingHandling: "No current service footprint uses a conservative proof score.",
  },
  {
    metric: "Engagement cadence",
    weight: 15,
    systemOfRecord: "accounts.meetings_per_month",
    rationale:
      "Expansion depends on access; regular meetings indicate the KAM has a route to decision makers.",
    missingHandling: "Missing cadence contributes 0 and is flagged.",
  },
  {
    metric: "Pipeline signals",
    weight: 15,
    systemOfRecord: "opportunities + Fireflies-derived opportunities",
    rationale:
      "Explicit client interest from opportunities or meeting notes increases growth confidence without replacing whitespace.",
    missingHandling: "No opportunities is valid and contributes 0 pipeline signal.",
  },
];

const RETENTION_GROWTH_DATA_SOURCE_MAP = [
  {
    metric: "Current Revenue",
    fields: "accounts.arr, fallback accounts.contract_value",
    systemOfRecord: "accounts",
    usage: "KPI display, revenue-at-risk, commercial guardrail limits",
    missingHandling: "Show Not provided; do not estimate revenue.",
    freshness: "Account commercial data should be reviewed monthly or on contract change.",
  },
  {
    metric: "Revenue at Risk",
    fields: "accounts.arr + retention signals + escalations + renewal window",
    systemOfRecord: "accounts, escalations, opportunities",
    usage: "Retention KPI and action table revenue impact",
    missingHandling: "If ARR is missing, show 0/Not provided instead of estimating.",
    freshness: "Refresh after escalation, renewal, Fireflies sync, or score update.",
  },
  {
    metric: "Renewal Due",
    fields: "accounts.renewal_days",
    systemOfRecord: "accounts",
    usage: "Retention health score and risk classification",
    missingHandling: "Use neutral renewal score and flag missing renewal days.",
    freshness: "Should be current against contract system.",
  },
  {
    metric: "Retention Health",
    fields:
      "accounts.health, accounts.renewal_days, health_scores for Risk/Financial/Relationship/CSAT",
    systemOfRecord: "accounts, health_scores, health_metrics",
    usage: "2x2 matrix x-axis and retention status",
    missingHandling: "Missing component scores are visible in data quality.",
    freshness: "Recalculate after score marking or Fireflies risk signal.",
  },
  {
    metric: "Growth Potential",
    fields:
      "accounts.white_space_count, accounts.growth_upside, accounts.meetings_per_month, retention_growth, opportunities",
    systemOfRecord: "accounts, retention_growth, opportunities",
    usage: "2x2 matrix y-axis and growth status",
    missingHandling: "Use only known services/opportunities; do not invent whitespace.",
    freshness: "Recalculate after opportunity, meeting sync, or service map update.",
  },
  {
    metric: "Growth Pipeline",
    fields: "opportunities.potential, retention_growth applicable services, accounts.growth_upside",
    systemOfRecord: "opportunities, retention_growth, accounts",
    usage: "Growth KPI and action table revenue impact",
    missingHandling: "Only explicit known potential is shown; unknown values remain Not provided.",
    freshness: "Refresh after opportunity creation or Fireflies sync.",
  },
  {
    metric: "Current / Whitespace Services",
    fields: "retention_growth.service, applicable, offered, delivered, tracking_note",
    systemOfRecord: "retention_growth",
    usage: "Current services, applicable growth, not-applicable list, offer recommendations",
    missingHandling: "If no rows exist, service-driven growth is not generated.",
    freshness: "Service map should be reviewed during QBR or account planning.",
  },
];

const MATRIX_INTERACTION_SPEC = [
  {
    item: "X-axis",
    rule: `Retention score: left means below ${RETENTION_HEALTH_THRESHOLD}/100, right means ${RETENTION_HEALTH_THRESHOLD}/100 or higher.`,
  },
  {
    item: "Y-axis",
    rule: `Growth score: top means ${GROWTH_POTENTIAL_THRESHOLD}/100 or higher, bottom means below ${GROWTH_POTENTIAL_THRESHOLD}/100.`,
  },
  {
    item: "Bubble position",
    rule: "The bubble position is calculated from the two scores, not manually dragged.",
  },
  {
    item: "Quadrant action",
    rule: "Each quadrant drives the account action table: protect, expand, maintain, or reassess.",
  },
  {
    item: "Details",
    rule: "The calculation panel below the matrix shows weights, source fields, missing data, and stale-data warnings.",
  },
];

function getKnownPotential(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function hasKnownPotential(value) {
  return getKnownPotential(value) !== null;
}

function hasKnownNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed);
}

function getKnownNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getArrValue(account) {
  return getKnownPotential(account.arr) ?? getKnownPotential(account.contractValue);
}

function formatKnownCurrency(value) {
  const knownValue = getKnownPotential(value);
  return knownValue === null ? "Not provided" : formatCurrency(knownValue);
}

function formatDays(value) {
  const knownValue = getKnownNumber(value);
  return knownValue === null ? "Not provided" : `${Math.round(knownValue)} days`;
}

const SERVICE_CATALOGUE = {
  "Managed Kubernetes": {
    description:
      "Managed Kubernetes operations, reliability, and SRE coverage for production clusters.",
    keywords: ["kubernetes", "cluster", "platform", "sre"],
    offerType: "Upsell",
    valueMultiplier: 1.05,
    pitchReason: (account) =>
      `${account.name} already depends on cloud infrastructure, so deeper platform coverage is a natural expansion path.`,
    nextStep: "Package a platform expansion option for the next sponsor review",
  },
  "Cloud Managed Security": {
    description:
      "Cloud posture hardening, threat monitoring, and managed security operations support.",
    keywords: ["security", "compliance", "risk", "threat"],
    offerType: "Cross-sell",
    valueMultiplier: 0.95,
    pitchReason: () =>
      "Security and compliance support can reduce renewal friction while expanding account coverage.",
    nextStep: "Turn the current proposal into a decision-ready scope and pricing view",
  },
  "Edge Observability": {
    description: "Monitoring, alerting, and visibility for distributed workloads and edge systems.",
    keywords: ["observability", "monitoring", "visibility", "dashboard", "edge"],
    offerType: "POC",
    valueMultiplier: 0.85,
    pitchReason: () =>
      "Observability is a strong fit when client teams need better visibility into distributed workloads.",
    nextStep: "Schedule a discovery call focused on monitoring pain points",
  },
  "Data Warehousing": {
    description: "Centralized data warehouse delivery for analytics, BI, and reporting use cases.",
    keywords: ["warehouse", "snowflake", "analytics", "data"],
    offerType: "Cross-sell",
    valueMultiplier: 1.1,
    pitchReason: () =>
      "Warehouse expansion is relevant only when the client lacks a mature in-house analytics stack.",
    nextStep: "Validate ownership of analytics modernization before pitching",
  },
  "Routing Engine": {
    description: "Routing logic and optimization services for logistics and dispatch platforms.",
    keywords: ["routing", "dispatch", "logistics", "route"],
    offerType: "Upsell",
    valueMultiplier: 1.1,
    pitchReason: () =>
      "Strong routing outcomes create a credible path into adjacent logistics optimization services.",
    nextStep: "Use routing performance results to open a wider operations conversation",
  },
  "Driver Mobile App": {
    description: "Mobile workflow support for drivers, field teams, and operational staff.",
    keywords: ["driver", "mobile", "workflow", "field"],
    offerType: "Upsell",
    valueMultiplier: 0.8,
    pitchReason: () =>
      "High adoption in mobile workflows supports a broader operational tooling pitch.",
    nextStep: "Turn adoption results into an executive proof point for expansion",
  },
  "Fleet Telemetry": {
    description:
      "Telemetry and live operational data services for fleet, device, and route tracking.",
    keywords: ["telemetry", "fleet", "sensor", "tracking"],
    offerType: "POC",
    valueMultiplier: 0.9,
    pitchReason: () =>
      "Telemetry signals are a strong bridge into optimization and predictive analytics services.",
    nextStep: "Frame the pilot outcomes and define the next commercial milestone",
  },
  "Predictive ETA AI": {
    description:
      "Predictive ETA and machine-learning support for logistics performance forecasting.",
    keywords: ["predictive", "eta", "ai", "forecast"],
    offerType: "POC",
    valueMultiplier: 1.2,
    pitchReason: () =>
      "AI-based ETA improvement is a clear whitespace opportunity when routing and telemetry are already in place.",
    nextStep: "Pitch a focused AI pilot tied to measurable route-performance outcomes",
  },
  "Driver HR module": {
    description: "HR and workforce administration tooling for driver operations.",
    keywords: ["hr", "workforce", "driver", "people"],
    offerType: "Cross-sell",
    valueMultiplier: 0.7,
    pitchReason: () =>
      "This service is only relevant when workforce administration is inside the current delivery scope.",
    nextStep: "Confirm ownership before discussing HR-related scope",
  },
  "SCADA Modernization": {
    description:
      "Factory telemetry and SCADA modernization for operational manufacturing environments.",
    keywords: ["scada", "factory", "telemetry", "plant"],
    offerType: "Upsell",
    valueMultiplier: 1.1,
    pitchReason: () =>
      "Modernization work can expand into resilience, analytics, and safety use cases once delivery stabilizes.",
    nextStep: "Use current rollout blockers to reframe the next modernization milestone",
  },
  "Predictive Maintenance": {
    description:
      "Predictive maintenance services for plant, asset, and equipment performance teams.",
    keywords: ["predictive", "maintenance", "asset", "plant"],
    offerType: "POC",
    valueMultiplier: 1.0,
    pitchReason: () =>
      "Maintenance use cases fit well when the client is already investing in plant telemetry and reliability.",
    nextStep: "Package a scoped plant pilot with a measurable asset-uptime outcome",
  },
  "Worker Safety AI": {
    description:
      "AI-powered safety monitoring and operational risk reduction for industrial teams.",
    keywords: ["safety", "worker", "ai", "risk"],
    offerType: "POC",
    valueMultiplier: 0.95,
    pitchReason: () =>
      "Safety use cases become more relevant when operations teams are already discussing risk and reliability gaps.",
    nextStep: "Align the pilot around one measurable safety KPI",
  },
  "Realtime Sync Platform": {
    description: "Real-time data synchronization across systems, teams, and operating regions.",
    keywords: ["realtime", "sync", "platform", "integration"],
    offerType: "Cross-sell",
    valueMultiplier: 1.0,
    pitchReason: () =>
      "Real-time integration demand is a good cross-sell signal when distributed workflows keep expanding.",
    nextStep: "Confirm the highest-friction integration point before proposing scope",
  },
  Observability: {
    description:
      "Operational observability, alerting, and reporting coverage for live service environments.",
    keywords: ["observability", "monitoring", "alerts", "visibility"],
    offerType: "POC",
    valueMultiplier: 0.85,
    pitchReason: () =>
      "Observability expansion is a strong fit when current operations need better visibility and faster incident response.",
    nextStep: "Frame a visibility-focused discovery session with the technical sponsor",
  },
  "AI Insights": {
    description:
      "AI-based insights, analysis, and decision-support for operational and leadership teams.",
    keywords: ["ai", "insights", "copilot", "assistant"],
    offerType: "POC",
    valueMultiplier: 1.15,
    pitchReason: () =>
      "AI insight offerings work best when stakeholders are already asking for faster decision support or automation.",
    nextStep: "Draft a short paid pilot tied to one measurable business outcome",
  },
  "On-prem deployment": {
    description:
      "On-premise deployment and controlled hosting options for regulated client environments.",
    keywords: ["onprem", "on-prem", "deployment", "regulated"],
    offerType: "Cross-sell",
    valueMultiplier: 0.9,
    pitchReason: () =>
      "On-prem deployment fits clients with strict hosting or residency requirements.",
    nextStep: "Validate residency or security constraints before creating the proposal",
  },
  "Data Lake": {
    description:
      "Data lake architecture, ingestion, and governance support for enterprise analytics.",
    keywords: ["data", "lake", "analytics", "governance"],
    offerType: "Upsell",
    valueMultiplier: 1.0,
    pitchReason: () =>
      "A live data platform can unlock adjacent AI, reporting, and automation pitches.",
    nextStep: "Use current adoption results to open the next-value conversation",
  },
  "Reg-Reporting": {
    description:
      "Regulatory reporting services with cadence, automation, and audit-readiness support.",
    keywords: ["reg", "reporting", "compliance", "audit"],
    offerType: "Upsell",
    valueMultiplier: 0.9,
    pitchReason: () =>
      "Regulatory work can expand into AI and workflow automation once trust is established.",
    nextStep: "Package the next outcome around speed, coverage, or audit effort reduction",
  },
  "AI Co-pilot": {
    description: "AI co-pilot assistance for operational teams and internal decision support.",
    keywords: ["ai", "copilot", "co-pilot", "assistant", "operations"],
    offerType: "POC",
    valueMultiplier: 1.2,
    pitchReason: () =>
      "AI co-pilot pilots are a strong next offer when operations teams are already discussing manual workload or visibility pain.",
    nextStep: "Pitch a 6-week paid pilot with one target team and one measurable outcome",
  },
  "Retail mobile banking": {
    description: "Retail mobile banking experience support for consumer-facing finance products.",
    keywords: ["retail", "mobile", "banking", "consumer"],
    offerType: "Cross-sell",
    valueMultiplier: 1.0,
    pitchReason: () =>
      "This service only fits clients that own a consumer banking product and roadmap.",
    nextStep: "Confirm product ownership before positioning the service",
  },
};

function toId(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function normalize(value = "") {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenize(value = "") {
  return normalize(value).split(/\s+/).filter(Boolean);
}

function buildEvidence({ source, sourceType, date, excerpt, reason }) {
  return { source, sourceType, date, excerpt, reason };
}

function resolveMetaText(value, ...args) {
  return typeof value === "function" ? value(...args) : value;
}

function isMeetingSource(source = "") {
  return /transcript|meeting|qbr|call/i.test(source);
}

function isEscalationSource(source = "") {
  return /escalation|incident|p1|p2/i.test(source);
}

function isPositiveTracking(note = "") {
  return /steady|stable|sla|adoption|accuracy|aligned|saving|closed|pilot scoped/i.test(note);
}

function hasBudgetSignal(text = "") {
  return /budget|funded|approved|saving|value|arr/i.test(text);
}

function getServiceMeta(service) {
  const fallbackKeywords = tokenize(service);
  return (
    SERVICE_CATALOGUE[service] || {
      description: `${service} packaged for the client's current operating model.`,
      keywords: fallbackKeywords,
      offerType: "Cross-sell",
      valueMultiplier: 1,
      pitchReason: () =>
        `${service} appears relevant based on the client's current environment and whitespace data.`,
      nextStep: `Validate ${service} fit with the sponsor before pitching`,
    }
  );
}

function buildThresholds(account, retentionRisk = account.retentionRisk) {
  const arr = getArrValue(account) ?? 0;
  const pocLimit = Math.min(Math.max(Math.round(arr * 0.015), 20_000), 80_000);
  const serviceCreditLimit = Math.min(Math.max(Math.round(arr * 0.008), 8_000), 40_000);
  const renewalDays = getKnownNumber(account.renewalDays) ?? Infinity;
  const discountLimitPct = retentionRisk === "High" || renewalDays <= 90 ? 5 : 3;
  const discountLimitValue = Math.round(arr * (discountLimitPct / 100));
  const kamDraftLimit = Math.min(Math.max(Math.round(arr * 0.03), 50_000), 125_000);
  const commercialLimit = Math.min(Math.max(Math.round(arr * 0.05), 75_000), 250_000);
  const pocWeeks = account.contractType === "Retainer" ? 6 : 4;

  return {
    pocLimit,
    pocWeeks,
    serviceCreditLimit,
    discountLimitPct,
    discountLimitValue,
    kamDraftLimit,
    commercialLimit,
  };
}

function findServiceOpportunity(serviceName, meta, opportunities = []) {
  const keywords = [serviceName, ...meta.keywords].map(normalize).filter(Boolean);
  return opportunities.find((opportunity) => {
    const haystack = normalize(
      `${opportunity.title} ${opportunity.source} ${opportunity.nextStep}`,
    );
    return keywords.some((keyword) => haystack.includes(keyword));
  });
}

function findMeetingRecord(account, meta) {
  const records = account.educationLog ?? [];
  const keywords = meta.keywords.map(normalize).filter(Boolean);
  return records.find((record) => {
    const haystack = normalize(`${record.topic} ${record.outcome} ${record.approach}`);
    return keywords.some((keyword) => haystack.includes(keyword));
  });
}

function mentionsBlockedService(text, blockedServices) {
  const haystack = normalize(text);
  return blockedServices.some((serviceName) => haystack.includes(normalize(serviceName)));
}

function buildCurrentServiceEvidence(
  account,
  serviceRecord,
  meta,
  status,
  relatedOpportunity,
  meetingRecord,
) {
  const evidence = [
    buildEvidence({
      source: serviceRecord.service,
      sourceType: "Current services",
      date: "Current delivery snapshot",
      excerpt:
        serviceRecord.trackingNote ||
        `${serviceRecord.service} is ${status.toLowerCase()} for the client.`,
      reason: `This service is already ${status.toLowerCase()} and should shape the next retention or growth move.`,
    }),
    buildEvidence({
      source: "Service catalogue",
      sourceType: "Service catalogue",
      date: "Configured offer context",
      excerpt: meta.description,
      reason: "Use the current service footprint as the baseline for adjacent offers.",
    }),
  ];

  if (relatedOpportunity) {
    evidence.push(
      buildEvidence({
        source: relatedOpportunity.source,
        sourceType: isMeetingSource(relatedOpportunity.source)
          ? "Fireflies meeting notes"
          : "Current services",
        date: relatedOpportunity.signalDate || "Recent",
        excerpt: relatedOpportunity.title,
        reason: relatedOpportunity.nextStep,
      }),
    );
  } else if (meetingRecord) {
    evidence.push(
      buildEvidence({
        source: `Fireflies ${meetingRecord.topic}`,
        sourceType: "Fireflies meeting notes",
        date: meetingRecord.date,
        excerpt: meetingRecord.outcome || meetingRecord.approach || meetingRecord.topic,
        reason: "Meeting notes can help expand or protect the current delivery footprint.",
      }),
    );
  }

  return evidence;
}

function buildCurrentServices(account, opportunities) {
  return (account.retentionGrowth ?? [])
    .filter((serviceRecord) => serviceRecord.offered || serviceRecord.delivered)
    .map((serviceRecord) => {
      const meta = getServiceMeta(serviceRecord.service);
      const relatedOpportunity = findServiceOpportunity(serviceRecord.service, meta, opportunities);
      const meetingRecord = findMeetingRecord(account, meta);
      const status =
        serviceRecord.delivered && serviceRecord.offered
          ? "Live"
          : serviceRecord.offered && !serviceRecord.delivered
            ? "In Flight"
            : serviceRecord.delivered
              ? "Delivered"
              : "Offered";

      return {
        id: `current-${toId(serviceRecord.service)}`,
        service: serviceRecord.service,
        status,
        description: meta.description,
        trackingNote: serviceRecord.trackingNote || "Tracked in account delivery context.",
        evidence: buildCurrentServiceEvidence(
          account,
          serviceRecord,
          meta,
          status,
          relatedOpportunity,
          meetingRecord,
        ),
      };
    });
}

function buildNotApplicable(account) {
  return (account.retentionGrowth ?? [])
    .filter((serviceRecord) => !serviceRecord.applicable)
    .map((serviceRecord) => {
      const meta = getServiceMeta(serviceRecord.service);
      const reason =
        serviceRecord.trackingNote ||
        `The current client context does not support pitching ${serviceRecord.service}.`;

      return {
        id: `blocked-${toId(serviceRecord.service)}`,
        service: serviceRecord.service,
        reason,
        evidence: [
          buildEvidence({
            source: serviceRecord.service,
            sourceType: "White-space data",
            date: "Current account state",
            excerpt: reason,
            reason:
              "Services marked not applicable should stay out of growth and recommended-offer flows.",
          }),
          buildEvidence({
            source: "Service catalogue",
            sourceType: "Service catalogue",
            date: "Configured offer context",
            excerpt: meta.description,
            reason: `Do not pitch ${serviceRecord.service} unless the account context changes materially.`,
          }),
        ],
      };
    });
}

function buildApplicableGrowth(account, opportunities, blockedServices) {
  return (account.retentionGrowth ?? [])
    .filter((serviceRecord) => serviceRecord.applicable && !serviceRecord.offered)
    .filter((serviceRecord) => !blockedServices.has(serviceRecord.service))
    .map((serviceRecord, index) => {
      const meta = getServiceMeta(serviceRecord.service);
      const relatedOpportunity = findServiceOpportunity(serviceRecord.service, meta, opportunities);
      const meetingRecord = findMeetingRecord(account, meta);
      const potentialValue = getKnownPotential(relatedOpportunity?.potential);
      const confidence =
        relatedOpportunity?.confidence ??
        (/scheduled|pilot|reviewing|scoped|proposal/i.test(serviceRecord.trackingNote)
          ? "High"
          : "Medium");
      const reason = relatedOpportunity
        ? `Client signal already exists for ${serviceRecord.service}: ${relatedOpportunity.title}.`
        : resolveMetaText(meta.pitchReason, account, serviceRecord);
      const nextStep =
        relatedOpportunity?.nextStep ||
        resolveMetaText(meta.nextStep, account, serviceRecord) ||
        `Validate ${serviceRecord.service} fit with the sponsor`;

      const evidence = [
        buildEvidence({
          source: serviceRecord.service,
          sourceType: "White-space data",
          date: "Current account state",
          excerpt:
            serviceRecord.trackingNote ||
            `${serviceRecord.service} is applicable but has not been offered yet.`,
          reason: "Applicable whitespace should be translated into a concrete growth plan.",
        }),
        buildEvidence({
          source: "Service catalogue",
          sourceType: "Service catalogue",
          date: "Configured offer context",
          excerpt: meta.description,
          reason,
        }),
      ];

      if (relatedOpportunity) {
        evidence.push(
          buildEvidence({
            source: relatedOpportunity.source,
            sourceType: isMeetingSource(relatedOpportunity.source)
              ? "Fireflies meeting notes"
              : isEscalationSource(relatedOpportunity.source)
                ? "Escalation"
                : "Current services",
            date: relatedOpportunity.signalDate || "Recent",
            excerpt: relatedOpportunity.title,
            reason: relatedOpportunity.nextStep,
          }),
        );
      } else if (meetingRecord) {
        evidence.push(
          buildEvidence({
            source: `Fireflies ${meetingRecord.topic}`,
            sourceType: "Fireflies meeting notes",
            date: meetingRecord.date,
            excerpt: meetingRecord.outcome || meetingRecord.approach || meetingRecord.topic,
            reason: "Meeting notes suggest there is room to explore this service.",
          }),
        );
      }

      return {
        id: `growth-${toId(serviceRecord.service)}`,
        service: serviceRecord.service,
        reason,
        potentialValue,
        confidence,
        nextStep,
        offerType: meta.offerType,
        approvalRequired:
          hasKnownPotential(potentialValue) && potentialValue >= HIGH_VALUE_THRESHOLD,
        approverRole:
          hasKnownPotential(potentialValue) && potentialValue >= HIGH_VALUE_THRESHOLD
            ? "Head of KAM"
            : null,
        evidence,
      };
    })
    .sort((left, right) => (right.potentialValue ?? 0) - (left.potentialValue ?? 0));
}

function buildRetentionSignals(account, escalations) {
  const signals = [];
  const openEscalation = (escalations ?? [])[0];
  const renewalDays = getKnownNumber(account.renewalDays) ?? Infinity;
  const accountHealth = getKnownNumber(account.health);
  const competitorMetric = (account.riskScoring?.metrics ?? []).find((metric) =>
    /competitor/i.test(metric.label),
  );

  if (renewalDays <= 120) {
    signals.push({
      id: `retention-renewal-${account.id}`,
      level:
        renewalDays <= 60 || (accountHealth !== null && accountHealth < 60) ? "High" : "Medium",
      title: "Renewal window is tightening",
      reason: `Renewal is in ${Math.round(renewalDays)} days and account health is ${accountHealth ?? "not provided"}.`,
      recommendedAction: "Prepare a recovery and renewal plan before the next sponsor conversation",
      evidence: [
        buildEvidence({
          source: "Overview",
          sourceType: "Overview",
          date: "Today",
          excerpt: `Renewal in ${Math.round(renewalDays)} days and health ${accountHealth ?? "not provided"}.`,
          reason: "Renewal timing and current health should shape the next retention move.",
        }),
      ],
    });
  }

  if (openEscalation) {
    signals.push({
      id: `retention-escalation-${account.id}`,
      level: openEscalation.priority === "P1" ? "High" : "Medium",
      title: "Open escalation is still influencing client confidence",
      reason: `${openEscalation.title} remains active and can affect renewal confidence.`,
      recommendedAction:
        "Convert escalation work into a sponsor-safe recovery plan with explicit owners",
      evidence: [
        buildEvidence({
          source: openEscalation.title,
          sourceType: "Escalation",
          date: openEscalation.openedAt || "Open",
          excerpt:
            openEscalation.description || openEscalation.recommendation || openEscalation.title,
          reason: "Escalation context should be visible inside retention planning.",
        }),
      ],
    });
  }

  if ((accountHealth !== null && accountHealth <= 70) || (account.csat?.score ?? 10) < 8) {
    signals.push({
      id: `retention-health-${account.id}`,
      level:
        (accountHealth !== null && accountHealth <= 55) || (account.csat?.score ?? 10) < 7
          ? "High"
          : "Medium",
      title: "Health and sentiment need active recovery",
      reason: `Account health is ${accountHealth ?? "not provided"} and CSAT is ${account.csat?.score ?? "n/a"}/10.`,
      recommendedAction:
        "Align a recovery story that addresses delivery sentiment and sponsor confidence",
      evidence: [
        buildEvidence({
          source: "Score Marking Metrics",
          sourceType: "Score Marking Metrics",
          date: "Current score snapshot",
          excerpt: `CSAT is ${account.csat?.score ?? "n/a"}/10 and risk score is ${account.riskScoring?.score ?? "n/a"}/10.`,
          reason:
            "Low sentiment and risk signals often show up before renewal pain escalates further.",
        }),
      ],
    });
  }

  if (competitorMetric && competitorMetric.value <= 6) {
    signals.push({
      id: `retention-competitor-${account.id}`,
      level: competitorMetric.value <= 4 ? "High" : "Medium",
      title: "Competitor pressure is visible in the risk profile",
      reason:
        competitorMetric.hint ||
        `${competitorMetric.label} is a weaker signal at ${competitorMetric.value}/10.`,
      recommendedAction:
        "Prepare a value and differentiation brief before competitive pressure grows",
      evidence: [
        buildEvidence({
          source: "Score Marking Metrics",
          sourceType: "Score Marking Metrics",
          date: "Current score snapshot",
          excerpt: `${competitorMetric.label} is at ${competitorMetric.value}/10${competitorMetric.hint ? ` (${competitorMetric.hint})` : ""}.`,
          reason:
            "Competitive pressure should inform both renewal planning and commercial guardrails.",
        }),
      ],
    });
  }

  return signals.sort(
    (left, right) => (SIGNAL_ORDER[left.level] ?? 9) - (SIGNAL_ORDER[right.level] ?? 9),
  );
}

function buildGrowthSignals(account, applicableGrowth, opportunities, currentServices) {
  const signals = [];
  const meetingOpportunity = (opportunities ?? []).find((opportunity) =>
    isMeetingSource(opportunity.source),
  );
  const strongCurrentService = currentServices.find(
    (service) => service.status === "Live" && isPositiveTracking(service.trackingNote),
  );
  const latestEducationRecord = (account.educationLog ?? [])[0];

  if (applicableGrowth.length) {
    signals.push({
      id: `growth-whitespace-${account.id}`,
      level: account.whiteSpaceCount >= 3 ? "High" : "Medium",
      title: "Applicable whitespace exists and is not yet offered",
      reason: `${applicableGrowth.length} relevant services are applicable but not yet positioned for this client.`,
      recommendedAction: `Prioritize ${applicableGrowth[0].service} as the next planned pitch`,
      evidence: applicableGrowth[0].evidence,
    });
  }

  if (meetingOpportunity) {
    signals.push({
      id: `growth-meeting-${meetingOpportunity.id}`,
      level: hasBudgetSignal(`${meetingOpportunity.title} ${meetingOpportunity.nextStep}`)
        ? "High"
        : "Medium",
      title: "Meeting notes surfaced a client-growth signal",
      reason: `${meetingOpportunity.title} came from ${meetingOpportunity.source}.`,
      recommendedAction: meetingOpportunity.nextStep,
      evidence: [
        buildEvidence({
          source: meetingOpportunity.source,
          sourceType: "Fireflies meeting notes",
          date: meetingOpportunity.signalDate || "Recent",
          excerpt: meetingOpportunity.title,
          reason: meetingOpportunity.nextStep,
        }),
      ],
    });
  }

  if (strongCurrentService) {
    signals.push({
      id: `growth-proof-${strongCurrentService.id}`,
      level: "Medium",
      title: "Current service success can support expansion",
      reason: `${strongCurrentService.service} is performing well and can be used as proof for the next offer.`,
      recommendedAction: "Use delivery outcomes as evidence in the next expansion pitch",
      evidence: strongCurrentService.evidence,
    });
  }

  if (latestEducationRecord) {
    signals.push({
      id: `growth-education-${account.id}`,
      level: hasBudgetSignal(
        `${latestEducationRecord.topic} ${latestEducationRecord.outcome} ${latestEducationRecord.approach}`,
      )
        ? "High"
        : "Medium",
      title: "Recent meeting context can support a next-step pitch",
      reason:
        latestEducationRecord.outcome ||
        latestEducationRecord.approach ||
        latestEducationRecord.topic,
      recommendedAction: "Turn the latest meeting context into one concrete sponsor follow-up",
      evidence: [
        buildEvidence({
          source: `Fireflies ${latestEducationRecord.topic}`,
          sourceType: "Fireflies meeting notes",
          date: latestEducationRecord.date,
          excerpt:
            latestEducationRecord.outcome ||
            latestEducationRecord.approach ||
            latestEducationRecord.topic,
          reason: "Meeting-note follow-ups should feed directly into growth planning.",
        }),
      ],
    });
  }

  return signals.sort(
    (left, right) => (SIGNAL_ORDER[left.level] ?? 9) - (SIGNAL_ORDER[right.level] ?? 9),
  );
}

function derivePriority(item) {
  if ((item.potentialValue ?? 0) >= HIGH_VALUE_THRESHOLD * 1.5 || item.confidence === "High") {
    return "High";
  }
  if ((item.potentialValue ?? 0) >= 60_000 || item.confidence === "Medium") {
    return "Medium";
  }
  return "Low";
}

function findRelatedGrowthItem(title, applicableGrowth) {
  return applicableGrowth.find((item) => {
    const serviceText = normalize(item.service);
    return normalize(title).includes(serviceText);
  });
}

function buildOpportunityEvidence(account, opportunity, relatedGrowthItem, escalations) {
  const evidence = [
    buildEvidence({
      source: opportunity.source,
      sourceType: isMeetingSource(opportunity.source)
        ? "Fireflies meeting notes"
        : isEscalationSource(opportunity.source)
          ? "Escalation"
          : "Current services",
      date: opportunity.signalDate || "Recent",
      excerpt: opportunity.title,
      reason: opportunity.nextStep,
    }),
  ];

  if (relatedGrowthItem?.evidence?.length) {
    evidence.push(relatedGrowthItem.evidence[0]);
  }

  if (isEscalationSource(opportunity.source) && (escalations ?? []).length) {
    evidence.push(
      buildEvidence({
        source: "Escalation",
        sourceType: "Escalation",
        date: escalations[0].openedAt || "Open",
        excerpt: escalations[0].description || escalations[0].title,
        reason: "Escalation signals can shape both recovery and commercial opportunity timing.",
      }),
    );
  }

  if (!relatedGrowthItem) {
    evidence.push(
      buildEvidence({
        source: "Overview",
        sourceType: "Overview",
        date: "Today",
        excerpt: `${account.whiteSpaceCount ?? 0} whitespace signals and ${formatKnownCurrency(account.growthUpside)} growth upside are already tracked for this account.`,
        reason: "Account context supports prioritizing relevant growth opportunities.",
      }),
    );
  }

  return evidence;
}

function buildClientOpportunities(
  account,
  opportunities,
  applicableGrowth,
  retentionSignals,
  blockedServices,
  escalations,
) {
  const items = [];
  const seen = new Set();

  for (const opportunity of opportunities ?? []) {
    if (mentionsBlockedService(opportunity.title, [...blockedServices])) continue;

    const relatedGrowthItem = findRelatedGrowthItem(opportunity.title, applicableGrowth);
    const category =
      isEscalationSource(opportunity.source) ||
      /renewal|retention|recovery/i.test(opportunity.title)
        ? "Retention"
        : "Growth";
    const item = {
      id: `client-opp-${opportunity.id}`,
      title: opportunity.title,
      source: isMeetingSource(opportunity.source) ? "Fireflies meeting notes" : opportunity.source,
      priority: "Medium",
      potentialValue: getKnownPotential(opportunity.potential),
      confidence: opportunity.confidence ?? "Medium",
      nextStep: opportunity.nextStep || "Validate fit with the sponsor",
      category,
      actionLabel: relatedGrowthItem || category === "Growth" ? "Plan Pitch" : "Pursue",
      linkedService: relatedGrowthItem?.service ?? null,
      approvalRequired:
        (hasKnownPotential(opportunity.potential) &&
          getKnownPotential(opportunity.potential) >= HIGH_VALUE_THRESHOLD) ||
        category === "Retention",
      approverRole:
        (hasKnownPotential(opportunity.potential) &&
          getKnownPotential(opportunity.potential) >= HIGH_VALUE_THRESHOLD) ||
        category === "Retention"
          ? "Head of KAM"
          : null,
    };
    item.priority = derivePriority(item);
    item.evidence = buildOpportunityEvidence(account, opportunity, relatedGrowthItem, escalations);

    seen.add(normalize(item.title));
    items.push(item);
  }

  if (applicableGrowth[0]) {
    const whitespaceItem = applicableGrowth[0];
    const title = `${whitespaceItem.service} is applicable but not yet offered`;
    if (!seen.has(normalize(title))) {
      items.push({
        id: `client-opp-whitespace-${toId(whitespaceItem.service)}`,
        title,
        source: "White-space data",
        priority: account.whiteSpaceCount >= 3 ? "High" : "Medium",
        potentialValue: whitespaceItem.potentialValue,
        confidence: whitespaceItem.confidence,
        nextStep: whitespaceItem.nextStep,
        category: "Growth",
        actionLabel: "Plan Pitch",
        linkedService: whitespaceItem.service,
        approvalRequired: whitespaceItem.approvalRequired,
        approverRole: whitespaceItem.approverRole,
        evidence: whitespaceItem.evidence,
      });
    }
  }

  if (retentionSignals[0]) {
    const signal = retentionSignals[0];
    const title = `Retention recovery plan for ${account.name}`;
    const arrValue = getArrValue(account);
    if (!seen.has(normalize(title))) {
      items.push({
        id: `client-opp-retention-${account.id}`,
        title,
        source: "Retention signals",
        priority: signal.level === "High" ? "High" : "Medium",
        potentialValue: arrValue,
        potentialValueLabel: arrValue ? `Protect ${formatCurrency(arrValue)} ARR` : "Not provided",
        confidence: signal.level === "High" ? "High" : "Medium",
        nextStep: signal.recommendedAction,
        category: "Retention",
        actionLabel: "Pursue",
        linkedService: null,
        approvalRequired: true,
        approverRole: "Head of KAM",
        evidence: signal.evidence,
      });
    }
  }

  return items.sort((left, right) => {
    const leftOrder = PRIORITY_ORDER[left.priority] ?? 9;
    const rightOrder = PRIORITY_ORDER[right.priority] ?? 9;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return (right.potentialValue ?? 0) - (left.potentialValue ?? 0);
  });
}

function buildOfferFromGrowthItem(account, growthItem, thresholds) {
  const meta = getServiceMeta(growthItem.service);
  const offerType = meta.offerType || "Cross-sell";
  const title =
    offerType === "POC"
      ? `${thresholds.pocWeeks}-week ${growthItem.service} POC`
      : `${growthItem.service} expansion offer`;
  const approvalRequired =
    hasKnownPotential(growthItem.potentialValue) &&
    (growthItem.potentialValue > thresholds.kamDraftLimit ||
      growthItem.potentialValue > thresholds.pocLimit);

  return {
    id: `offer-${growthItem.id}`,
    title,
    offerType,
    reason: growthItem.reason,
    potentialValue: growthItem.potentialValue,
    confidence: growthItem.confidence,
    nextStep: growthItem.nextStep,
    allowedValue:
      offerType === "POC"
        ? `Up to ${formatCurrency(thresholds.pocLimit)} / ${thresholds.pocWeeks} weeks`
        : `Up to ${formatCurrency(thresholds.commercialLimit)}`,
    approvalRequired,
    approverRole: approvalRequired ? "Head of KAM" : null,
    evidence: growthItem.evidence,
  };
}

function buildOfferFromOpportunity(account, opportunity, thresholds) {
  const renewalDays = getKnownNumber(account.renewalDays) ?? Infinity;
  const offerType =
    opportunity.category === "Retention"
      ? renewalDays <= 90
        ? "Renewal"
        : "Service Credit"
      : /poc|pilot|ai/i.test(opportunity.title)
        ? "POC"
        : "Cross-sell";
  const approvalRequired =
    opportunity.approvalRequired ||
    offerType === "Renewal" ||
    offerType === "Service Credit" ||
    (hasKnownPotential(opportunity.potentialValue) &&
      opportunity.potentialValue > thresholds.kamDraftLimit);
  const title =
    offerType === "POC"
      ? `${thresholds.pocWeeks}-week ${opportunity.linkedService || "targeted"} POC`
      : offerType === "Renewal"
        ? `Renewal protection package for ${account.name}`
        : offerType === "Service Credit"
          ? `Recovery credit plan for ${account.name}`
          : opportunity.title;

  return {
    id: `offer-${opportunity.id}`,
    title,
    offerType,
    reason: opportunity.category === "Retention" ? opportunity.nextStep : opportunity.title,
    potentialValue: opportunity.potentialValue,
    potentialValueLabel:
      offerType === "Service Credit"
        ? (opportunity.potentialValueLabel ?? "Not provided")
        : opportunity.potentialValueLabel,
    confidence: opportunity.confidence,
    nextStep: opportunity.nextStep,
    allowedValue:
      offerType === "Renewal"
        ? `Discount up to ${thresholds.discountLimitPct}% (${formatCurrency(thresholds.discountLimitValue)})`
        : offerType === "Service Credit"
          ? `Up to ${formatCurrency(thresholds.serviceCreditLimit)}`
          : offerType === "POC"
            ? `Up to ${formatCurrency(thresholds.pocLimit)} / ${thresholds.pocWeeks} weeks`
            : `Up to ${formatCurrency(thresholds.commercialLimit)}`,
    approvalRequired,
    approverRole: approvalRequired ? "Head of KAM" : null,
    evidence: opportunity.evidence,
  };
}

function buildRecommendedOffers(
  account,
  applicableGrowth,
  clientOpportunities,
  retentionSignals,
  thresholds,
) {
  const offers = [];
  const seen = new Set();

  if (applicableGrowth[0]) {
    const offer = buildOfferFromGrowthItem(account, applicableGrowth[0], thresholds);
    seen.add(normalize(offer.title));
    offers.push(offer);
  }

  const meetingOpportunity = clientOpportunities.find(
    (item) => item.source === "Fireflies meeting notes",
  );
  if (meetingOpportunity) {
    const offer = buildOfferFromOpportunity(account, meetingOpportunity, thresholds);
    if (!seen.has(normalize(offer.title))) {
      seen.add(normalize(offer.title));
      offers.push(offer);
    }
  }

  const retentionOpportunity = clientOpportunities.find((item) => item.category === "Retention");
  if (retentionOpportunity) {
    const offer = buildOfferFromOpportunity(account, retentionOpportunity, thresholds);
    if (!seen.has(normalize(offer.title))) {
      seen.add(normalize(offer.title));
      offers.push(offer);
    }
  } else if (retentionSignals[0]) {
    const signal = retentionSignals[0];
    const arrValue = getArrValue(account);
    const renewalDays = getKnownNumber(account.renewalDays) ?? Infinity;
    const offer = {
      id: `offer-retention-${account.id}`,
      title: `Retention protection package for ${account.name}`,
      offerType: renewalDays <= 90 ? "Renewal" : "Service Credit",
      reason: signal.reason,
      potentialValue: renewalDays <= 90 ? arrValue : null,
      potentialValueLabel:
        renewalDays <= 90 && arrValue ? `Protect ${formatCurrency(arrValue)} ARR` : "Not provided",
      confidence: signal.level === "High" ? "High" : "Medium",
      nextStep: signal.recommendedAction,
      allowedValue:
        renewalDays <= 90
          ? `Discount up to ${thresholds.discountLimitPct}% (${formatCurrency(thresholds.discountLimitValue)})`
          : `Up to ${formatCurrency(thresholds.serviceCreditLimit)}`,
      approvalRequired: true,
      approverRole: "Head of KAM",
      evidence: signal.evidence,
    };
    if (!seen.has(normalize(offer.title))) {
      offers.push(offer);
    }
  }

  return offers.slice(0, 4);
}

function buildCommercialGuardrails(account, thresholds, retentionRisk = account.retentionRisk) {
  const renewalDays = getKnownNumber(account.renewalDays) ?? Infinity;

  return {
    limits: {
      ...thresholds,
    },
    summary: {
      discountLimit: `${thresholds.discountLimitPct}% (${formatCurrency(thresholds.discountLimitValue)})`,
      serviceCreditLimit: formatCurrency(thresholds.serviceCreditLimit),
      pocLimit: `${thresholds.pocWeeks} weeks / ${formatCurrency(thresholds.pocLimit)}`,
      proposalLimit: formatCurrency(thresholds.kamDraftLimit),
    },
    rules: [
      {
        id: "guardrail-poc",
        offer: "POC",
        allowedOffer: `${thresholds.pocWeeks}-week POC`,
        allowedValue: `Up to ${formatCurrency(thresholds.pocLimit)}`,
        discountLimit: "None by default",
        serviceCreditLimit: "N/A",
        pocLimit: `${thresholds.pocWeeks} weeks`,
        approvalRequired: "Yes above POC limit",
        approverRole: "Head of KAM",
        reason: "Use POCs to validate fit before committing to a full expansion offer.",
      },
      {
        id: "guardrail-growth",
        offer: "Upsell / Cross-sell",
        allowedOffer: "Expansion proposal",
        allowedValue: `Up to ${formatCurrency(thresholds.commercialLimit)}`,
        discountLimit: `${thresholds.discountLimitPct}% if needed`,
        serviceCreditLimit: "N/A",
        pocLimit: "Optional",
        approvalRequired: `Yes above ${formatCurrency(thresholds.kamDraftLimit)}`,
        approverRole: "Head of KAM",
        reason: "Larger commercial moves or bundled pricing need Head of KAM review.",
      },
      {
        id: "guardrail-credit",
        offer: "Service Credit",
        allowedOffer: "Goodwill or recovery credit",
        allowedValue: `Up to ${formatCurrency(thresholds.serviceCreditLimit)}`,
        discountLimit: "N/A",
        serviceCreditLimit: formatCurrency(thresholds.serviceCreditLimit),
        pocLimit: "N/A",
        approvalRequired: "Yes",
        approverRole: "Head of KAM",
        reason: "Credits should be tied to concrete escalation or retention recovery signals.",
      },
      {
        id: "guardrail-discount",
        offer: "Discount / Renewal",
        allowedOffer: "Renewal-protection discount",
        allowedValue: `Up to ${formatCurrency(thresholds.discountLimitValue)}`,
        discountLimit: `${thresholds.discountLimitPct}%`,
        serviceCreditLimit: "N/A",
        pocLimit: "N/A",
        approvalRequired: "Yes",
        approverRole: "Head of KAM",
        reason:
          "Discounting is reserved for documented renewal pressure, risk, or competitive context.",
      },
    ],
    narrative:
      renewalDays <= 90 || retentionRisk !== "Low"
        ? "Renewal pressure is active, so any discount, service credit, or larger commercial move should be reviewed by Head of KAM."
        : "Growth offers can be drafted by the KAM, but larger value changes still need Head of KAM review.",
  };
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function toScore100(value) {
  const score = Number(value ?? 0);
  if (!Number.isFinite(score)) return 0;
  return score <= 10 ? score * 10 : score;
}

function getRenewalScore(renewalDays) {
  const days = getKnownNumber(renewalDays);
  if (days === null) return 50;
  if (days <= 30) return 25;
  if (days <= 60) return 45;
  if (days <= 90) return 60;
  return 85;
}

function getRetentionHealthScore(account) {
  const healthScore = toScore100(account.health);
  const csatScore = toScore100(account.csat?.score);
  const riskScore = toScore100(account.riskScoring?.score);
  const relationshipScore = toScore100(account.relationshipHealth?.score);
  const renewalScore = getRenewalScore(account.renewalDays);

  return clamp(
    Math.round(
      healthScore * 0.25 +
        renewalScore * 0.2 +
        riskScore * 0.15 +
        toScore100(account.financialHealth?.score) * 0.1 +
        relationshipScore * 0.15 +
        csatScore * 0.15,
    ),
  );
}

function getRetentionStatus(score) {
  if (score >= 75) return "Healthy";
  if (score >= 50) return "Watchlist";
  return "At Risk";
}

function getGrowthPotentialScore(account, applicableGrowth, opportunities, currentServices) {
  const whitespaceScore = clamp((account.whiteSpaceCount ?? applicableGrowth.length) * 18, 0, 100);
  const arr = getArrValue(account) ?? 0;
  const upsideRatio = arr > 0 ? clamp(((account.growthUpside ?? 0) / arr) * 100, 0, 100) : 0;
  const pipelineScore = clamp((opportunities ?? []).length * 20, 0, 100);
  const serviceProofScore = currentServices.some((service) =>
    isPositiveTracking(service.trackingNote),
  )
    ? 85
    : currentServices.length
      ? 60
      : 35;
  const engagementScore = clamp((account.meetingsPerMonth ?? 0) * 18, 0, 100);

  return clamp(
    Math.round(
      whitespaceScore * 0.3 +
        upsideRatio * 0.2 +
        serviceProofScore * 0.2 +
        engagementScore * 0.15 +
        pipelineScore * 0.15,
    ),
  );
}

function buildScoringWeights() {
  return {
    retention: RETENTION_SCORE_WEIGHTS,
    growth: GROWTH_SCORE_WEIGHTS,
  };
}

function getDataCheckStatus(isAvailable, isStale = false) {
  if (!isAvailable) return "Missing";
  if (isStale) return "Stale";
  return "Ready";
}

function getDaysSince(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function buildDataQuality({ account, opportunities, escalations, currentServices }) {
  const lastTouchAge = getDaysSince(account.lastTouch);
  const calculatedAge = getDaysSince(account.retentionGrowthCalculatedAt);
  const serviceCount = account.retentionGrowth?.length ?? 0;
  const checks = [
    {
      label: "Revenue / ARR",
      source: "accounts.arr",
      available: getArrValue(account) !== null,
      stale: false,
      handling: "Revenue is never estimated; missing value displays as Not provided.",
    },
    {
      label: "Renewal date window",
      source: "accounts.renewal_days",
      available: hasKnownNumber(account.renewalDays),
      stale: false,
      handling: "Missing renewal days use neutral score impact and are flagged.",
    },
    {
      label: "Health score set",
      source: "accounts.health + health_scores",
      available:
        hasKnownNumber(account.health) &&
        hasKnownNumber(account.csat?.score) &&
        hasKnownNumber(account.riskScoring?.score) &&
        hasKnownNumber(account.relationshipHealth?.score) &&
        hasKnownNumber(account.financialHealth?.score),
      stale: false,
      handling: "Missing score components reduce confidence and appear in this checklist.",
    },
    {
      label: "Service / whitespace map",
      source: "retention_growth",
      available: serviceCount > 0,
      stale: false,
      handling: "No service map means no service-driven growth recommendations are generated.",
    },
    {
      label: "Opportunity pipeline",
      source: "opportunities",
      available: (opportunities ?? []).length > 0,
      stale: false,
      handling: "No opportunities is valid; pipeline score contributes 0 instead of guessing.",
    },
    {
      label: "Escalation feed",
      source: "escalations",
      available: Array.isArray(escalations),
      stale: false,
      handling: "Open escalations influence retention risk when present.",
    },
    {
      label: "Engagement cadence",
      source: "accounts.meetings_per_month",
      available: hasKnownNumber(account.meetingsPerMonth),
      stale: lastTouchAge !== null && lastTouchAge > DATA_STALE_DAYS,
      handling: `Last touch older than ${DATA_STALE_DAYS} days is treated as stale context.`,
    },
    {
      label: "Calculated scoring snapshot",
      source: "accounts.retention_growth_calculated_at",
      available: Boolean(account.retentionGrowthCalculatedAt),
      stale: calculatedAge !== null && calculatedAge > 7,
      handling:
        "The UI recalculates live; persisted account scoring should refresh after key events.",
    },
  ];

  const missing = checks.filter((check) => !check.available);
  const stale = checks.filter((check) => check.available && check.stale);
  const status = missing.length ? "Needs data" : stale.length ? "Stale review" : "Ready";

  return {
    status,
    summary:
      status === "Ready"
        ? "All critical Retention vs Growth inputs are present."
        : status === "Stale review"
          ? `${stale.length} input${stale.length === 1 ? "" : "s"} should be refreshed.`
          : `${missing.length} input${missing.length === 1 ? "" : "s"} missing; calculations remain conservative.`,
    checks: checks.map((check) => ({
      ...check,
      status: getDataCheckStatus(check.available, check.stale),
    })),
    missing,
    stale,
    currentServiceCount: currentServices.length,
  };
}

function getGrowthStatus(score) {
  if (score >= 75) return "High Growth Potential";
  if (score >= 50) return "Medium Growth Potential";
  return "Low Growth Potential";
}

function getGrowthLevel(score) {
  if (score >= 75) return "High";
  if (score >= 50) return "Medium";
  return "Low";
}

function getCalculatedRetentionRisk({ account, retentionSignals, opportunities, retentionScore }) {
  const hasEscalationSignal = retentionSignals.some((signal) => /escalation/i.test(signal.id));
  const hasCriticalMeetingSignal = (opportunities ?? []).some((opportunity) =>
    /churn|renewal doubt|renewal risk|contract risk|not renew|cancel|terminate/i.test(
      `${opportunity.title} ${opportunity.nextStep} ${opportunity.source}`,
    ),
  );
  const renewalDays = getKnownNumber(account.renewalDays) ?? Infinity;
  const accountHealth = getKnownNumber(account.health) ?? 0;
  const csatScore = Number(account.csat?.score ?? 10);
  const riskScore = Number(account.riskScoring?.score ?? 10);
  const projectScore = Number(account.projectHealth?.score ?? 10);
  const relationshipScore = Number(account.relationshipHealth?.score ?? 10);
  const competitorMetric = (account.riskScoring?.metrics ?? []).find((metric) =>
    /competitor/i.test(metric.label),
  );

  const criticalSignals = [
    renewalDays <= 60 && accountHealth < 75,
    csatScore < 7,
    riskScore < 6,
    projectScore < 6,
    hasEscalationSignal,
    hasCriticalMeetingSignal,
  ].filter(Boolean);

  const warningSignals = [
    renewalDays <= 120,
    accountHealth < 75,
    csatScore < 8,
    riskScore < 7.5,
    projectScore < 7.5,
    relationshipScore < 7.5,
    (account.meetingsPerMonth ?? 0) < 1,
    competitorMetric && competitorMetric.value <= 6,
  ].filter(Boolean);

  if (retentionScore < 50 || criticalSignals.length) return "High";
  if (retentionScore < 75 || warningSignals.length >= 2) return "Medium";
  return "Low";
}

function getRevenueAtRisk(account, retentionSignals, retentionRisk) {
  if (!retentionSignals.length) return 0;
  const arr = getArrValue(account) ?? 0;
  const renewalDays = getKnownNumber(account.renewalDays) ?? Infinity;
  if (retentionRisk === "High" || renewalDays <= 60) return arr;
  return 0;
}

function getGrowthPipelineValue(account, applicableGrowth, recommendedOffers) {
  const offerValue = recommendedOffers.reduce(
    (total, offer) => total + (offer.potentialValue ?? 0),
    0,
  );
  const whitespaceValue = applicableGrowth.reduce(
    (total, item) => total + (item.potentialValue ?? 0),
    0,
  );
  return Math.max(offerValue, whitespaceValue, account.growthUpside ?? 0);
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function getGrowthPipelineHint(account, applicableGrowth, recommendedOffers, growthPipeline) {
  const offerValue = recommendedOffers.reduce(
    (total, offer) => total + (offer.potentialValue ?? 0),
    0,
  );
  const whitespaceValue = applicableGrowth.reduce(
    (total, item) => total + (item.potentialValue ?? 0),
    0,
  );
  const accountUpside = getKnownPotential(account.growthUpside) ?? 0;

  if (growthPipeline > 0 && offerValue >= whitespaceValue && offerValue >= accountUpside) {
    return `From ${pluralize(recommendedOffers.length, "recommended offer")}`;
  }
  if (growthPipeline > 0 && whitespaceValue >= accountUpside) {
    return `From ${pluralize(applicableGrowth.length, "open whitespace service")}`;
  }
  if (accountUpside > 0) return `Account upside ${formatCurrency(accountUpside)}`;
  return `${pluralize(applicableGrowth.length, "open whitespace service")}`;
}

function getMatrixAxisPosition(score, threshold) {
  const value = clamp(score);
  const lowMin = 18;
  const lowMax = 48;
  const highMin = 52;
  const highMax = 82;

  if (value < threshold) {
    return Math.round(lowMin + (value / threshold) * (lowMax - lowMin));
  }

  return Math.round(
    highMin + ((value - threshold) / (100 - threshold)) * (highMax - highMin),
  );
}

function buildMatrixPosition(retentionScore, growthScore) {
  const retentionRiskHigh = retentionScore < RETENTION_HEALTH_THRESHOLD;
  const growthHigh = growthScore >= GROWTH_POTENTIAL_THRESHOLD;
  const x = getMatrixAxisPosition(retentionScore, RETENTION_HEALTH_THRESHOLD);
  const y = 100 - getMatrixAxisPosition(growthScore, GROWTH_POTENTIAL_THRESHOLD);

  if (!retentionRiskHigh && growthHigh) {
    return {
      quadrant: "Expand Aggressively",
      description: "Healthy account with strong expansion potential.",
      recommendedAction: "Prioritize upsell/cross-sell and create an expansion plan.",
      x,
      y,
    };
  }
  if (retentionRiskHigh && growthHigh) {
    return {
      quadrant: "Protect & Recover",
      description: "At-risk account with meaningful growth value.",
      recommendedAction: "Fix retention blockers first, then reopen the growth motion.",
      x,
      y,
    };
  }
  if (!retentionRiskHigh && !growthHigh) {
    return {
      quadrant: "Maintain & Nurture",
      description: "Stable account with limited near-term expansion signal.",
      recommendedAction: "Keep engagement healthy and monitor for new whitespace.",
      x,
      y,
    };
  }
  return {
    quadrant: "Reassess / Monitor",
    description: "At-risk account with limited growth upside.",
    recommendedAction: "Resolve critical issues and reassess account strategy.",
    x,
    y,
  };
}

function formatPotentialValue(item) {
  if (item.potentialValueLabel) return item.potentialValueLabel;
  const knownPotential = getKnownPotential(item.potentialValue);
  return knownPotential === null ? "Not provided" : `+${formatCurrency(knownPotential)}`;
}

function buildDashboardActionRows({
  account,
  retentionSignals,
  growthSignals,
  applicableGrowth,
  recommendedOffers,
  dashboard,
}) {
  const rows = [];

  if (retentionSignals[0]) {
    rows.push({
      id: `action-retention-${account.id}`,
      focus: "Retention",
      score: dashboard.retentionScore,
      risk: dashboard.riskLevel,
      revenueImpact: dashboard.revenueAtRiskLabel,
      recommendedAction: retentionSignals[0].recommendedAction,
      status: "Open",
    });
  }

  if (applicableGrowth[0]) {
    rows.push({
      id: `action-growth-${applicableGrowth[0].id}`,
      focus: "Growth",
      score: dashboard.growthScore,
      risk: dashboard.growthLevel,
      revenueImpact: formatPotentialValue(applicableGrowth[0]),
      recommendedAction: applicableGrowth[0].nextStep,
      status: "Open",
    });
  }

  if (recommendedOffers[0]) {
    rows.push({
      id: `action-offer-${recommendedOffers[0].id}`,
      focus: "Offer",
      score: dashboard.growthScore,
      risk: recommendedOffers[0].approvalRequired ? "Approval Needed" : "Ready",
      revenueImpact: formatPotentialValue(recommendedOffers[0]),
      recommendedAction: recommendedOffers[0].nextStep,
      status: "Draft Ready",
    });
  }

  if (growthSignals[0] && !rows.some((row) => row.focus === "Growth")) {
    rows.push({
      id: `action-growth-signal-${growthSignals[0].id}`,
      focus: "Growth",
      score: dashboard.growthScore,
      risk: growthSignals[0].level,
      revenueImpact: dashboard.growthPipelineLabel,
      recommendedAction: growthSignals[0].recommendedAction,
      status: "Open",
    });
  }

  if (!rows.length) {
    rows.push({
      id: `action-maintain-${account.id}`,
      focus: "Maintain",
      score: dashboard.retentionScore,
      risk: dashboard.riskLevel,
      revenueImpact: formatKnownCurrency(account.arr ?? account.contractValue),
      recommendedAction: "Maintain quarterly engagement and monitor for new signals.",
      status: "Monitor",
    });
  }

  return rows.slice(0, 5);
}

function buildDashboardSummary({
  account,
  opportunities,
  escalations,
  currentServices,
  applicableGrowth,
  retentionSignals,
  growthSignals,
  recommendedOffers,
}) {
  const retentionScore = getRetentionHealthScore(account);
  const growthScore = getGrowthPotentialScore(
    account,
    applicableGrowth,
    opportunities,
    currentServices,
  );
  const riskLevel = getCalculatedRetentionRisk({
    account,
    retentionSignals,
    opportunities,
    retentionScore,
  });
  const revenueAtRisk = getRevenueAtRisk(account, retentionSignals, riskLevel);
  const growthPipeline = getGrowthPipelineValue(account, applicableGrowth, recommendedOffers);
  const growthPipelineHint = getGrowthPipelineHint(
    account,
    applicableGrowth,
    recommendedOffers,
    growthPipeline,
  );
  const matrix = buildMatrixPosition(retentionScore, growthScore);
  const growthLevel = getGrowthLevel(growthScore);
  const scoringWeights = buildScoringWeights();
  const dataQuality = buildDataQuality({ account, opportunities, escalations, currentServices });
  const renewalDays = getKnownNumber(account.renewalDays);

  const dashboard = {
    retentionScore,
    retentionStatus: getRetentionStatus(retentionScore),
    growthScore,
    growthStatus: getGrowthStatus(growthScore),
    riskLevel,
    growthLevel,
    revenueAtRisk,
    revenueAtRiskLabel: formatCurrency(revenueAtRisk),
    growthPipeline,
    growthPipelineLabel: formatCurrency(growthPipeline),
    matrix,
    scoringWeights,
    dataSourceMap: RETENTION_GROWTH_DATA_SOURCE_MAP,
    matrixSpec: MATRIX_INTERACTION_SPEC,
    dataQuality,
    calculationNotes: [
      "Retention and growth are calculated separately; high health does not automatically mean growth unless whitespace, engagement, service proof, or pipeline signals exist.",
      "Revenue and opportunity potential are not estimated by the system; only known ARR, contract value, growth upside, or explicit opportunity potential are shown.",
      "Missing inputs are surfaced in the data quality checklist so the KAM can fix source data before relying on the recommendation.",
    ],
    kpis: [
      {
        label: "Current Revenue",
        value: formatKnownCurrency(account.arr ?? account.contractValue),
        hint: "Existing ARR under management",
      },
      {
        label: "Revenue at Risk",
        value: formatCurrency(revenueAtRisk),
        hint: retentionSignals[0]?.title ?? "No material risk signal",
      },
      {
        label: "Renewal Due",
        value: formatDays(account.renewalDays),
        hint:
          renewalDays === null
            ? "Missing renewal date"
            : renewalDays <= 90
              ? "Needs retention focus"
              : "Outside urgent window",
      },
      {
        label: "Growth Pipeline",
        value: formatCurrency(growthPipeline),
        hint: growthPipelineHint,
      },
      {
        label: "Retention Health",
        value: `${retentionScore}/100`,
        hint: getRetentionStatus(retentionScore),
      },
      {
        label: "Growth Potential",
        value: `${growthScore}/100`,
        hint: getGrowthStatus(growthScore),
      },
    ],
    retentionInsights: [
      {
        label: "Main risk",
        value: retentionSignals[0]?.title ?? "No active retention alarm",
      },
      {
        label: "Recommended action",
        value: retentionSignals[0]?.recommendedAction ?? matrix.recommendedAction,
      },
      {
        label: "CSAT",
        value: `${account.csat?.score ?? "n/a"}/10`,
      },
      {
        label: "Open escalations",
        value: `${retentionSignals.filter((signal) => /escalation/i.test(signal.id)).length}`,
      },
    ],
    growthInsights: [
      {
        label: "Top growth move",
        value: applicableGrowth[0]?.service ?? growthSignals[0]?.title ?? "Monitor whitespace",
      },
      {
        label: "Recommended action",
        value:
          applicableGrowth[0]?.nextStep ??
          growthSignals[0]?.recommendedAction ??
          matrix.recommendedAction,
      },
      {
        label: "Whitespace",
        value: `${applicableGrowth.length} services ready`,
      },
      {
        label: "Recommended offers",
        value: `${recommendedOffers.length} active`,
      },
    ],
  };

  dashboard.actionRows = buildDashboardActionRows({
    account,
    retentionSignals,
    growthSignals,
    applicableGrowth,
    recommendedOffers,
    dashboard,
  });

  return dashboard;
}

export function buildRetentionGrowthTabModel({ account, opportunities, escalations }) {
  const blockedItems = buildNotApplicable(account);
  const blockedServices = new Set(blockedItems.map((item) => item.service));
  const currentServices = buildCurrentServices(account, opportunities);
  const applicableGrowth = buildApplicableGrowth(account, opportunities, blockedServices);
  const retentionSignals = buildRetentionSignals(account, escalations);
  const growthSignals = buildGrowthSignals(
    account,
    applicableGrowth,
    opportunities,
    currentServices,
  );
  const opportunityItems = buildClientOpportunities(
    account,
    opportunities,
    applicableGrowth,
    retentionSignals,
    blockedServices,
    escalations,
  );
  const calculatedRetentionRisk = getCalculatedRetentionRisk({
    account,
    retentionSignals,
    opportunities,
    retentionScore: getRetentionHealthScore(account),
  });
  const thresholds = buildThresholds(account, calculatedRetentionRisk);
  const recommendedOffers = buildRecommendedOffers(
    account,
    applicableGrowth,
    opportunityItems,
    retentionSignals,
    thresholds,
  );
  const guardrails = buildCommercialGuardrails(account, thresholds, calculatedRetentionRisk);
  const dashboard = buildDashboardSummary({
    account,
    opportunities,
    escalations,
    currentServices,
    applicableGrowth,
    retentionSignals,
    growthSignals,
    recommendedOffers,
  });

  return {
    dashboard,
    currentServices,
    applicableGrowth,
    opportunities: opportunityItems,
    notApplicable: blockedItems,
    recommendedOffers,
    guardrails,
    retentionSignals,
    growthSignals,
  };
}
