export type AccountStatus = "healthy" | "at-risk" | "critical";

export type Stakeholder = {
  name: string;
  role: string;
  influence: "Champion" | "Decision Maker" | "Influencer" | "Blocker";
  email?: string;
  lastContact?: string;
};

export type SubScore = {
  label: string;
  value: number; // 0-10
  hint?: string;
};

export type HealthBlock = {
  score: number; // 0-10 overall
  metrics: SubScore[];
};

export type Activity = {
  id: string;
  area: "Relationship" | "Project" | "Resource" | "Financial" | "Profit";
  title: string;
  owner: string;
  due: string;
  status: "Open" | "In Progress" | "Done";
  rag: "R" | "A" | "G";
  expectedLift: string;
};

export type RetentionGrowthItem = {
  service: string;
  offered: boolean;
  delivered: boolean;
  applicable: boolean;
  trackingNote: string;
};

export type EducationItem = {
  date: string;
  topic: string;
  approach: string;
  outcome: string;
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  accountId?: string;
  time: string;
  type: "action" | "alert" | "info";
  read: boolean;
};

export type Account = {
  id: string;
  name: string;
  shortCode: string;
  industry: string;
  tier: "Enterprise" | "Growth" | "Strategic";
  health: number;
  trend: number;
  contractValue: number;
  arr: number;
  renewalDays: number;
  contractType: "Staff Augmented" | "Time Based" | "Retainer" | "Project";
  lastTouch: string;
  status: AccountStatus;
  retentionRisk: "Low" | "Medium" | "High";
  growthUpside: number;
  whiteSpaceCount: number;

  // Legacy aggregate fields (kept for portfolio rollups)
  cooperation: number;
  serviceConsumption: number;
  meetingsPerMonth: number;
  contractCompliance: number;

  // Step 1 — Know your Client (KYC)
  primaryContact: { name: string; role: string };
  founded: number;
  employees: string;
  region: string;
  description: string;
  businessInfo: string;
  clientHistory: string;
  stakeholders: Stakeholder[];
  revenue: string;
  mrrArr?: string; // for start-ups
  isStartup: boolean;
  engagementTenure: string;
  teamSize: number;
  competitors: string[];
  mainBusinessFlow: string;

  // Step 2 — Scoring blocks
  relationshipHealth: HealthBlock;
  projectHealth: HealthBlock;
  whiteSpace: HealthBlock;
  contractScoring: HealthBlock & {
    type: string;
    duration: string;
    autoRenew: boolean;
    nonTerminator: boolean;
    minOneYear: boolean;
    priceHike: string;
    swot: { s: string; w: string; o: string; t: string };
    customerFeedback: string;
  };
  csat: HealthBlock;
  riskScoring: HealthBlock;
  resourceHealth: HealthBlock & {
    backupExists: boolean;
    leavesThisMonth: number;
    criticalResources: number;
    teamSize: number;
  };
  financialHealth: HealthBlock;

  // Step 3 — Activities to increase score
  activities: Activity[];

  // Step 4 — Retention vs Growth
  retentionGrowth: RetentionGrowthItem[];

  // Step 5 — Educate client
  educationLog: EducationItem[];
};

const baseHealth = (score: number, metrics: SubScore[]): HealthBlock => ({ score, metrics });

export const accounts: Account[] = [
  {
    id: "starlight",
    name: "Starlight Systems Corp.",
    shortCode: "ST",
    industry: "Cloud Infrastructure",
    tier: "Enterprise",
    health: 84,
    trend: 3.2,
    contractValue: 2_400_000,
    arr: 2_400_000,
    renewalDays: 114,
    contractType: "Staff Augmented",
    lastTouch: "Yesterday",
    status: "healthy",
    retentionRisk: "Low",
    growthUpside: 850_000,
    whiteSpaceCount: 3,
    cooperation: 9.2,
    serviceConsumption: 6.1,
    meetingsPerMonth: 8,
    contractCompliance: 10,
    primaryContact: { name: "Sarah Jenkins", role: "CTO" },
    founded: 2008,
    employees: "1,200+",
    region: "North America",
    description: "Distributed cloud platform serving fintech and logistics workloads across NA and EMEA.",
    businessInfo: "B2B SaaS providing managed Kubernetes, edge compute, and observability to mid-market fintech.",
    clientHistory: "Onboarded Q2 2021. Expanded from 2 to 18 engineers. Renewed twice; survived one P0 escalation in 2023.",
    stakeholders: [
      { name: "Sarah Jenkins", role: "CTO", influence: "Decision Maker", email: "sarah@starlight.io", lastContact: "Yesterday" },
      { name: "Omar Patel", role: "VP Platform", influence: "Champion", lastContact: "3d ago" },
      { name: "Lena Choi", role: "Procurement Lead", influence: "Blocker", lastContact: "2w ago" },
    ],
    revenue: "$420M (FY24)",
    isStartup: false,
    engagementTenure: "4y 2m",
    teamSize: 18,
    competitors: ["Globant", "EPAM", "Persistent"],
    mainBusinessFlow: "Customer → onboarding API → managed cluster provisioning → observability dashboards → billing.",
    relationshipHealth: baseHealth(8.4, [
      { label: "CEO ↔ CEO meetups", value: 7, hint: "Last in Q2" },
      { label: "Monthly meetings", value: 9, hint: "8 / month" },
      { label: "Director meetings", value: 8 },
      { label: "Cooperation level", value: 9.2 },
    ]),
    projectHealth: baseHealth(7.9, [
      { label: "On-time deliverables", value: 8.5 },
      { label: "Client feedback", value: 8.0 },
      { label: "Quality / Defect health", value: 7.4 },
      { label: "Scope & change requests", value: 7.6 },
    ]),
    whiteSpace: baseHealth(6.8, [
      { label: "Meeting frequency", value: 8 },
      { label: "Upsell capacity", value: 7 },
      { label: "Services penetration", value: 5.5, hint: "5 of 11 services" },
      { label: "Account note count", value: 6.7 },
    ]),
    contractScoring: {
      score: 8.6,
      metrics: [
        { label: "Value to us", value: 9 },
        { label: "Duration", value: 8 },
        { label: "Auto-renew", value: 9 },
      ],
      type: "Staff Augmented",
      duration: "24 months",
      autoRenew: true,
      nonTerminator: true,
      minOneYear: true,
      priceHike: "6% YoY",
      swot: {
        s: "Embedded engineers, high switching cost",
        w: "Single-region dependency",
        o: "Expand to EMEA infra modernization",
        t: "Internal platform team scaling up",
      },
      customerFeedback: "\"The team feels like ours.\" — S. Jenkins, CTO",
    },
    csat: baseHealth(8.7, [
      { label: "NPS", value: 9 },
      { label: "Quarterly survey", value: 8.5 },
      { label: "Support tickets CSAT", value: 8.6 },
      { label: "Exec sentiment", value: 9 },
    ]),
    riskScoring: baseHealth(7.2, [
      { label: "Competitor activity", value: 7, hint: "Globant pitching cluster mgmt" },
      { label: "Geopolitical exposure", value: 8 },
      { label: "POC change risk", value: 6 },
      { label: "Payments on time", value: 9 },
      { label: "C-level changes", value: 7 },
    ]),
    resourceHealth: {
      score: 7.8,
      metrics: [
        { label: "Backup coverage", value: 8 },
        { label: "Leaves this month", value: 7 },
        { label: "Critical roles", value: 7 },
      ],
      backupExists: true,
      leavesThisMonth: 2,
      criticalResources: 3,
      teamSize: 18,
    },
    financialHealth: baseHealth(8.5, [
      { label: "Revenue generation", value: 9 },
      { label: "Resource allocation efficiency", value: 8 },
      { label: "Margin", value: 8.5 },
    ]),
    activities: [
      { id: "a1", area: "Relationship", title: "CEO-to-CEO sync in NYC", owner: "Julian Drake", due: "In 12d", status: "Open", rag: "A", expectedLift: "+4 relationship" },
      { id: "a2", area: "Project", title: "Defect-rate war-room", owner: "Maya Lin", due: "In 5d", status: "In Progress", rag: "A", expectedLift: "+1.2 project" },
      { id: "a3", area: "Financial", title: "Negotiate 8% price hike on renewal", owner: "Julian Drake", due: "60d", status: "Open", rag: "G", expectedLift: "+$190k ARR" },
      { id: "a4", area: "Resource", title: "Add backup SRE for cluster", owner: "Maya Lin", due: "30d", status: "Open", rag: "R", expectedLift: "+1.5 resource" },
    ],
    retentionGrowth: [
      { service: "Managed Kubernetes", offered: true, delivered: true, applicable: true, trackingNote: "Steady — 99.97% SLA YTD." },
      { service: "Cloud Managed Security", offered: true, delivered: false, applicable: true, trackingNote: "Proposal sent, CTO reviewing." },
      { service: "Edge Observability", offered: false, delivered: false, applicable: true, trackingNote: "Discovery call scheduled." },
      { service: "Data Warehousing", offered: false, delivered: false, applicable: false, trackingNote: "Client uses in-house Snowflake stack." },
    ],
    educationLog: [
      { date: "OCT 12, 2024", topic: "Digital Infrastructure Roadmap", approach: "Workshop + 3-year capacity model", outcome: "Aligned on EMEA expansion phase 1" },
      { date: "SEP 05, 2024", topic: "Cloud Migration Efficiency Audit", approach: "Data-driven audit, then exec readout", outcome: "Identified $310k/yr saving" },
    ],
  },
  {
    id: "axiom",
    name: "Axiom Logistics",
    shortCode: "AX",
    industry: "Logistics & Supply Chain",
    tier: "Enterprise",
    health: 88,
    trend: 4.2,
    contractValue: 4_820_000,
    arr: 4_820_000,
    renewalDays: 14,
    contractType: "Retainer",
    lastTouch: "2 hours ago",
    status: "healthy",
    retentionRisk: "Low",
    growthUpside: 1_200_000,
    whiteSpaceCount: 5,
    cooperation: 9.5,
    serviceConsumption: 9.4,
    meetingsPerMonth: 12,
    contractCompliance: 10,
    primaryContact: { name: "Marcus Hale", role: "VP Engineering" },
    founded: 1994,
    employees: "5,400+",
    region: "Global",
    description: "Global freight network rebuilding their data backbone for predictive routing.",
    businessInfo: "Global freight + last-mile delivery. Modernizing dispatch & telemetry on our platform.",
    clientHistory: "Strategic since 2019. Survived 2 leadership changes. NPS 72.",
    stakeholders: [
      { name: "Marcus Hale", role: "VP Engineering", influence: "Champion", lastContact: "2h ago" },
      { name: "Renata Souza", role: "COO", influence: "Decision Maker", lastContact: "1w ago" },
    ],
    revenue: "$2.1B (FY24)",
    isStartup: false,
    engagementTenure: "5y 8m",
    teamSize: 34,
    competitors: ["Accenture", "IBM iX"],
    mainBusinessFlow: "Shipment intake → routing engine → driver app → POD → invoicing.",
    relationshipHealth: baseHealth(9.1, [
      { label: "CEO ↔ CEO meetups", value: 9 },
      { label: "Monthly meetings", value: 9.5, hint: "12 / month" },
      { label: "Director meetings", value: 9 },
      { label: "Cooperation level", value: 9.5 },
    ]),
    projectHealth: baseHealth(8.9, [
      { label: "On-time deliverables", value: 9 },
      { label: "Client feedback", value: 9 },
      { label: "Quality / Defect health", value: 8.7 },
      { label: "Scope & change requests", value: 8.8 },
    ]),
    whiteSpace: baseHealth(8.2, [
      { label: "Meeting frequency", value: 9 },
      { label: "Upsell capacity", value: 8.5 },
      { label: "Services penetration", value: 7.5 },
      { label: "Account note count", value: 7.8 },
    ]),
    contractScoring: {
      score: 9.2,
      metrics: [
        { label: "Value to us", value: 9.5 },
        { label: "Duration", value: 9 },
        { label: "Auto-renew", value: 9 },
      ],
      type: "Retainer",
      duration: "36 months",
      autoRenew: true,
      nonTerminator: true,
      minOneYear: true,
      priceHike: "8% YoY",
      swot: {
        s: "Deep workflow embedment",
        w: "Heavy dependency on COO sponsorship",
        o: "EMEA fulfillment node expansion",
        t: "In-house build initiative being scoped",
      },
      customerFeedback: "\"Our routing accuracy is up 14%.\" — R. Souza, COO",
    },
    csat: baseHealth(9.0, [
      { label: "NPS", value: 9 },
      { label: "Quarterly survey", value: 9.1 },
      { label: "Support tickets CSAT", value: 8.9 },
      { label: "Exec sentiment", value: 9 },
    ]),
    riskScoring: baseHealth(8.2, [
      { label: "Competitor activity", value: 8 },
      { label: "Geopolitical exposure", value: 7, hint: "Red Sea routes" },
      { label: "POC change risk", value: 8 },
      { label: "Payments on time", value: 10 },
      { label: "C-level changes", value: 8 },
    ]),
    resourceHealth: {
      score: 8.6,
      metrics: [
        { label: "Backup coverage", value: 9 },
        { label: "Leaves this month", value: 8 },
        { label: "Critical roles", value: 8.5 },
      ],
      backupExists: true,
      leavesThisMonth: 3,
      criticalResources: 5,
      teamSize: 34,
    },
    financialHealth: baseHealth(9.0, [
      { label: "Revenue generation", value: 9.5 },
      { label: "Resource allocation efficiency", value: 8.7 },
      { label: "Margin", value: 8.9 },
    ]),
    activities: [
      { id: "a1", area: "Relationship", title: "Quarterly Business Review prep", owner: "Julian Drake", due: "In 4d", status: "In Progress", rag: "G", expectedLift: "+0.5 relationship" },
      { id: "a2", area: "Project", title: "Resolve DB indexing post-mortem", owner: "Maya Lin", due: "Today", status: "In Progress", rag: "R", expectedLift: "Recover trust" },
      { id: "a3", area: "Profit", title: "Pitch EMEA fulfillment node", owner: "Julian Drake", due: "30d", status: "Open", rag: "G", expectedLift: "+$1.2M ARR" },
    ],
    retentionGrowth: [
      { service: "Routing Engine", offered: true, delivered: true, applicable: true, trackingNote: "+14% accuracy YoY." },
      { service: "Driver Mobile App", offered: true, delivered: true, applicable: true, trackingNote: "Adoption 92%." },
      { service: "Fleet Telemetry", offered: true, delivered: false, applicable: true, trackingNote: "Pilot starting next month." },
      { service: "Predictive ETA AI", offered: false, delivered: false, applicable: true, trackingNote: "White-space — pitch in QBR." },
      { service: "Driver HR module", offered: false, delivered: false, applicable: false, trackingNote: "Out of scope; handled internally." },
    ],
    educationLog: [
      { date: "AUG 21, 2024", topic: "Security Posture Review", approach: "External pen-test + workshop", outcome: "Closed 14 of 17 findings in 60 days" },
    ],
  },
  {
    id: "vertex",
    name: "Vertex Industrial",
    shortCode: "VX",
    industry: "Heavy Manufacturing",
    tier: "Growth",
    health: 42,
    trend: -8.1,
    contractValue: 950_000,
    arr: 950_000,
    renewalDays: 38,
    contractType: "Time Based",
    lastTouch: "Just now",
    status: "critical",
    retentionRisk: "High",
    growthUpside: 200_000,
    whiteSpaceCount: 1,
    cooperation: 5.4,
    serviceConsumption: 4.1,
    meetingsPerMonth: 2,
    contractCompliance: 7.2,
    primaryContact: { name: "Diane Okafor", role: "Director of IT" },
    founded: 1972,
    employees: "8,000+",
    region: "EMEA",
    description: "Legacy industrial conglomerate modernizing factory telemetry systems.",
    businessInfo: "Industrial manufacturing; modernizing SCADA + factory telemetry across 22 plants.",
    clientHistory: "Won in 2022 after RFP. Two POC changes in 18 months. Currently strained.",
    stakeholders: [
      { name: "Diane Okafor", role: "Director of IT", influence: "Decision Maker", lastContact: "Just now" },
      { name: "Hans Becker", role: "Plant Ops Lead", influence: "Blocker", lastContact: "1m ago" },
    ],
    revenue: "$1.4B (FY23)",
    isStartup: false,
    engagementTenure: "1y 9m",
    teamSize: 8,
    competitors: ["Capgemini", "Cognizant", "Internal IT"],
    mainBusinessFlow: "Sensor → SCADA → analytics → MES → ERP.",
    relationshipHealth: baseHealth(4.4, [
      { label: "CEO ↔ CEO meetups", value: 2 },
      { label: "Monthly meetings", value: 4, hint: "2 / month — low" },
      { label: "Director meetings", value: 5 },
      { label: "Cooperation level", value: 5.4 },
    ]),
    projectHealth: baseHealth(5.1, [
      { label: "On-time deliverables", value: 5 },
      { label: "Client feedback", value: 4.5 },
      { label: "Quality / Defect health", value: 5.8 },
      { label: "Scope & change requests", value: 5 },
    ]),
    whiteSpace: baseHealth(3.5, [
      { label: "Meeting frequency", value: 3 },
      { label: "Upsell capacity", value: 4 },
      { label: "Services penetration", value: 3 },
      { label: "Account note count", value: 4 },
    ]),
    contractScoring: {
      score: 5.4,
      metrics: [
        { label: "Value to us", value: 5 },
        { label: "Duration", value: 5 },
        { label: "Auto-renew", value: 4 },
      ],
      type: "Time Based",
      duration: "12 months",
      autoRenew: false,
      nonTerminator: false,
      minOneYear: true,
      priceHike: "0%",
      swot: {
        s: "Domain experience in SCADA",
        w: "Thin contract margin",
        o: "Convert to retainer in renewal",
        t: "Capgemini actively pitching replacement",
      },
      customerFeedback: "\"Quality acceptable but communication is slow.\" — D. Okafor",
    },
    csat: baseHealth(5.2, [
      { label: "NPS", value: 4 },
      { label: "Quarterly survey", value: 5 },
      { label: "Support tickets CSAT", value: 6 },
      { label: "Exec sentiment", value: 5 },
    ]),
    riskScoring: baseHealth(3.8, [
      { label: "Competitor activity", value: 3, hint: "Capgemini pitching" },
      { label: "Geopolitical exposure", value: 5 },
      { label: "POC change risk", value: 3 },
      { label: "Payments on time", value: 6 },
      { label: "C-level changes", value: 3 },
    ]),
    resourceHealth: {
      score: 5.0,
      metrics: [
        { label: "Backup coverage", value: 3 },
        { label: "Leaves this month", value: 6 },
        { label: "Critical roles", value: 5 },
      ],
      backupExists: false,
      leavesThisMonth: 1,
      criticalResources: 2,
      teamSize: 8,
    },
    financialHealth: baseHealth(5.3, [
      { label: "Revenue generation", value: 5 },
      { label: "Resource allocation efficiency", value: 5.5 },
      { label: "Margin", value: 5.5 },
    ]),
    activities: [
      { id: "a1", area: "Relationship", title: "Schedule director-level reset call", owner: "Julian Drake", due: "48h", status: "Open", rag: "R", expectedLift: "+1.0 relationship" },
      { id: "a2", area: "Project", title: "RCA review with Plant Ops", owner: "Maya Lin", due: "5d", status: "Open", rag: "R", expectedLift: "+0.8 project" },
      { id: "a3", area: "Resource", title: "Onboard backup SCADA engineer", owner: "Hiring", due: "21d", status: "Open", rag: "R", expectedLift: "+1.5 resource" },
    ],
    retentionGrowth: [
      { service: "SCADA Modernization", offered: true, delivered: true, applicable: true, trackingNote: "Slowed — Plant 7 rollout paused." },
      { service: "Predictive Maintenance", offered: true, delivered: false, applicable: true, trackingNote: "Demo pending re-schedule." },
      { service: "Worker Safety AI", offered: false, delivered: false, applicable: true, trackingNote: "Future opportunity post-renewal." },
    ],
    educationLog: [
      { date: "JUN 10, 2024", topic: "SCADA Best Practices", approach: "On-site workshop", outcome: "Buy-in from 2 of 5 plant managers" },
    ],
  },
  {
    id: "cloudpeak",
    name: "CloudPeak Systems",
    shortCode: "CP",
    industry: "SaaS Platforms",
    tier: "Strategic",
    health: 76,
    trend: 0.4,
    contractValue: 4_100_000,
    arr: 4_100_000,
    renewalDays: 220,
    contractType: "Staff Augmented",
    lastTouch: "1 week ago",
    status: "healthy",
    retentionRisk: "Low",
    growthUpside: 600_000,
    whiteSpaceCount: 4,
    cooperation: 8.4,
    serviceConsumption: 7.8,
    meetingsPerMonth: 6,
    contractCompliance: 9.6,
    primaryContact: { name: "Anika Roy", role: "Chief Product Officer" },
    founded: 2014,
    employees: "750+",
    region: "APAC",
    description: "Mid-market collaboration suite scaling internationally.",
    businessInfo: "Collaboration SaaS — chat, video, docs. Series D, scaling APAC + LATAM.",
    clientHistory: "Onboarded 2022 post Series C. ARR doubled with us in 18 months.",
    stakeholders: [
      { name: "Anika Roy", role: "CPO", influence: "Champion", lastContact: "1w ago" },
      { name: "Felix Tang", role: "Head of Engineering", influence: "Decision Maker", lastContact: "3d ago" },
    ],
    revenue: "$92M ARR",
    isStartup: true,
    mrrArr: "MRR $7.6M · ARR $92M",
    engagementTenure: "2y 4m",
    teamSize: 22,
    competitors: ["ThoughtWorks", "BCG Platinion"],
    mainBusinessFlow: "Sign-up → workspace provisioning → realtime sync → billing → enterprise SSO.",
    relationshipHealth: baseHealth(8.0, [
      { label: "CEO ↔ CEO meetups", value: 7 },
      { label: "Monthly meetings", value: 8, hint: "6 / month" },
      { label: "Director meetings", value: 8 },
      { label: "Cooperation level", value: 8.4 },
    ]),
    projectHealth: baseHealth(8.2, [
      { label: "On-time deliverables", value: 8.5 },
      { label: "Client feedback", value: 8 },
      { label: "Quality / Defect health", value: 8.0 },
      { label: "Scope & change requests", value: 8.2 },
    ]),
    whiteSpace: baseHealth(7.0, [
      { label: "Meeting frequency", value: 7 },
      { label: "Upsell capacity", value: 7.5 },
      { label: "Services penetration", value: 6.5 },
      { label: "Account note count", value: 7 },
    ]),
    contractScoring: {
      score: 8.0,
      metrics: [
        { label: "Value to us", value: 8 },
        { label: "Duration", value: 8 },
        { label: "Auto-renew", value: 8 },
      ],
      type: "Staff Augmented",
      duration: "24 months",
      autoRenew: true,
      nonTerminator: true,
      minOneYear: true,
      priceHike: "5% YoY",
      swot: {
        s: "Mutual cultural fit, strong CPO sponsor",
        w: "Limited C-suite reach beyond product",
        o: "AI features wave — observability + insights",
        t: "Series E might trigger in-house build",
      },
      customerFeedback: "\"Reliable partner for scale-up phase.\" — A. Roy",
    },
    csat: baseHealth(8.4, [
      { label: "NPS", value: 8 },
      { label: "Quarterly survey", value: 8.5 },
      { label: "Support tickets CSAT", value: 8.4 },
      { label: "Exec sentiment", value: 8.5 },
    ]),
    riskScoring: baseHealth(7.5, [
      { label: "Competitor activity", value: 7 },
      { label: "Geopolitical exposure", value: 8 },
      { label: "POC change risk", value: 7 },
      { label: "Payments on time", value: 9 },
      { label: "C-level changes", value: 7 },
    ]),
    resourceHealth: {
      score: 7.6,
      metrics: [
        { label: "Backup coverage", value: 8 },
        { label: "Leaves this month", value: 7 },
        { label: "Critical roles", value: 7.5 },
      ],
      backupExists: true,
      leavesThisMonth: 2,
      criticalResources: 4,
      teamSize: 22,
    },
    financialHealth: baseHealth(8.0, [
      { label: "Revenue generation", value: 8 },
      { label: "Resource allocation efficiency", value: 8 },
      { label: "Margin", value: 8 },
    ]),
    activities: [
      { id: "a1", area: "Profit", title: "AI feature pack proposal", owner: "Julian Drake", due: "21d", status: "Open", rag: "G", expectedLift: "+$300k ARR" },
      { id: "a2", area: "Relationship", title: "Re-engage CEO Anika monthly", owner: "Julian Drake", due: "ongoing", status: "Open", rag: "A", expectedLift: "+0.7 relationship" },
    ],
    retentionGrowth: [
      { service: "Realtime Sync Platform", offered: true, delivered: true, applicable: true, trackingNote: "Core dep — stable." },
      { service: "Observability", offered: true, delivered: true, applicable: true, trackingNote: "Scaling with APAC region." },
      { service: "AI Insights", offered: false, delivered: false, applicable: true, trackingNote: "Pitch in upcoming QBR." },
      { service: "On-prem deployment", offered: false, delivered: false, applicable: false, trackingNote: "Not relevant; SaaS-only product." },
    ],
    educationLog: [
      { date: "AUG 02, 2024", topic: "APAC Expansion Workshop", approach: "Strategy sprint", outcome: "Roadmap agreed for SG + Tokyo POPs" },
    ],
  },
  {
    id: "northwind",
    name: "Northwind Finance",
    shortCode: "NW",
    industry: "Financial Services",
    tier: "Enterprise",
    health: 61,
    trend: -2.1,
    contractValue: 3_300_000,
    arr: 3_300_000,
    renewalDays: 67,
    contractType: "Retainer",
    lastTouch: "3 days ago",
    status: "at-risk",
    retentionRisk: "Medium",
    growthUpside: 420_000,
    whiteSpaceCount: 2,
    cooperation: 7.1,
    serviceConsumption: 6.8,
    meetingsPerMonth: 4,
    contractCompliance: 8.4,
    primaryContact: { name: "Theo Lambert", role: "Head of Platform" },
    founded: 1987,
    employees: "12,000+",
    region: "EMEA",
    description: "Tier-1 European bank running compliance-grade data workloads.",
    businessInfo: "European retail + commercial bank. Regulated workloads, strict change management.",
    clientHistory: "Onboarded 2020. Compliance-heavy. Recent CTO change risks scope re-evaluation.",
    stakeholders: [
      { name: "Theo Lambert", role: "Head of Platform", influence: "Decision Maker", lastContact: "3d ago" },
      { name: "Inès Müller", role: "CTO (new)", influence: "Influencer", lastContact: "n/a" },
    ],
    revenue: "$11.4B (FY24)",
    isStartup: false,
    engagementTenure: "3y 11m",
    teamSize: 26,
    competitors: ["Accenture", "Deloitte"],
    mainBusinessFlow: "Core banking → data lake → reg-reporting → BI → audit.",
    relationshipHealth: baseHealth(6.8, [
      { label: "CEO ↔ CEO meetups", value: 5 },
      { label: "Monthly meetings", value: 7 },
      { label: "Director meetings", value: 7 },
      { label: "Cooperation level", value: 7.1 },
    ]),
    projectHealth: baseHealth(7.2, [
      { label: "On-time deliverables", value: 7.5 },
      { label: "Client feedback", value: 6.8 },
      { label: "Quality / Defect health", value: 7.5 },
      { label: "Scope & change requests", value: 7 },
    ]),
    whiteSpace: baseHealth(5.6, [
      { label: "Meeting frequency", value: 6 },
      { label: "Upsell capacity", value: 5.5 },
      { label: "Services penetration", value: 5.5 },
      { label: "Account note count", value: 5.5 },
    ]),
    contractScoring: {
      score: 7.4,
      metrics: [
        { label: "Value to us", value: 8 },
        { label: "Duration", value: 7 },
        { label: "Auto-renew", value: 7 },
      ],
      type: "Retainer",
      duration: "24 months",
      autoRenew: true,
      nonTerminator: true,
      minOneYear: true,
      priceHike: "4% YoY",
      swot: {
        s: "Reg-compliance moat",
        w: "Dependency on platform team",
        o: "Reg-reporting AI co-pilot",
        t: "New CTO favors big-4 consultancies",
      },
      customerFeedback: "\"Solid execution; need stronger executive presence.\" — T. Lambert",
    },
    csat: baseHealth(7.1, [
      { label: "NPS", value: 7 },
      { label: "Quarterly survey", value: 7.2 },
      { label: "Support tickets CSAT", value: 7 },
      { label: "Exec sentiment", value: 7 },
    ]),
    riskScoring: baseHealth(5.6, [
      { label: "Competitor activity", value: 5 },
      { label: "Geopolitical exposure", value: 6 },
      { label: "POC change risk", value: 4, hint: "New CTO" },
      { label: "Payments on time", value: 8 },
      { label: "C-level changes", value: 5 },
    ]),
    resourceHealth: {
      score: 7.0,
      metrics: [
        { label: "Backup coverage", value: 7 },
        { label: "Leaves this month", value: 7 },
        { label: "Critical roles", value: 7 },
      ],
      backupExists: true,
      leavesThisMonth: 4,
      criticalResources: 3,
      teamSize: 26,
    },
    financialHealth: baseHealth(7.5, [
      { label: "Revenue generation", value: 7.5 },
      { label: "Resource allocation efficiency", value: 7.5 },
      { label: "Margin", value: 7.5 },
    ]),
    activities: [
      { id: "a1", area: "Relationship", title: "Exec intro to new CTO", owner: "Julian Drake", due: "10d", status: "Open", rag: "R", expectedLift: "+1.5 relationship" },
      { id: "a2", area: "Profit", title: "Reg-reporting AI pilot", owner: "Maya Lin", due: "45d", status: "Open", rag: "G", expectedLift: "+$220k ARR" },
    ],
    retentionGrowth: [
      { service: "Data Lake", offered: true, delivered: true, applicable: true, trackingNote: "Stable." },
      { service: "Reg-Reporting", offered: true, delivered: true, applicable: true, trackingNote: "Quarterly cadence." },
      { service: "AI Co-pilot", offered: false, delivered: false, applicable: true, trackingNote: "Pilot proposed." },
      { service: "Retail mobile banking", offered: false, delivered: false, applicable: false, trackingNote: "Owned by separate vendor." },
    ],
    educationLog: [
      { date: "MAY 16, 2024", topic: "Reg-Reporting Modernization", approach: "Whitepaper + exec workshop", outcome: "Pilot scoped for Q3" },
    ],
  },
];

export function getAccount(id: string) {
  return accounts.find((a) => a.id === id);
}

export const portfolioTotals = {
  totalARR: accounts.reduce((s, a) => s + a.arr, 0),
  atRiskARR: accounts.filter((a) => a.status !== "healthy").reduce((s, a) => s + a.arr, 0),
  growthUpside: accounts.reduce((s, a) => s + a.growthUpside, 0),
  avgHealth: Math.round(accounts.reduce((s, a) => s + a.health, 0) / accounts.length),
  activeEscalations: 3,
};

export type Escalation = {
  id: string;
  accountId: string;
  title: string;
  priority: "P1" | "P2" | "P3";
  slaRemainingHours: number;
  openedAt: string;
  rca: string;
  description: string;
  actionItems: { label: string; done: boolean }[];
  stakeholders: string[];
  recommendation?: string;
  realisticCheck?: string;
  clientFeedback?: string;
};

export const escalations: Escalation[] = [
  {
    id: "esc-001",
    accountId: "starlight",
    title: "API Latency — West-2 Cluster",
    priority: "P1",
    slaRemainingHours: 18.7,
    openedAt: "Today 09:14",
    rca: "API latency spike in West-2 regional nodes impacting dashboard performance for 4% of users.",
    description: "Customer reports degraded dashboard responsiveness during peak hours. Performance budget exceeded on three endpoints.",
    actionItems: [
      { label: "Rollback deployment v4.2", done: false },
      { label: "Notify CTO Jenkins (48h SLA call)", done: false },
      { label: "Internal incident brief", done: true },
    ],
    stakeholders: ["Sarah Jenkins (CTO)", "On-call SRE", "Julian Drake (KAM)"],
    recommendation: "Roll back v4.2 and move West-2 to multi-AZ before next peak window.",
    realisticCheck: "Achievable in 24h with current on-call rotation.",
    clientFeedback: "\"Need a written RCA within 48 hours.\"",
  },
  {
    id: "esc-002",
    accountId: "axiom",
    title: "Latent DB Indexing Failure",
    priority: "P1",
    slaRemainingHours: 28.2,
    openedAt: "Yesterday 16:40",
    rca: "Cache layer mismatch following the v4.12.0 deploy.",
    description: "Primary stakeholder at Axiom requesting a 1:1 call within 48 hours. ERP sync delayed.",
    actionItems: [
      { label: "Engage on-call SRE lead", done: true },
      { label: "Client update call (14:00 GMT)", done: false },
      { label: "Draft post-mortem outline", done: false },
    ],
    stakeholders: ["Marcus Hale", "Platform Eng", "Julian Drake"],
    recommendation: "Hot-patch cache layer; offer 1-month service credit as goodwill.",
    realisticCheck: "Patch ready in 12h; credit needs Finance approval.",
    clientFeedback: "Appreciate the speed — keep us in the loop hourly.",
  },
  {
    id: "esc-003",
    accountId: "vertex",
    title: "Unrealistic SLA Renegotiation",
    priority: "P2",
    slaRemainingHours: 41.0,
    openedAt: "2 days ago",
    rca: "Client requesting 99.999% uptime guarantee outside contractual envelope.",
    description: "Director of IT pushing for SLA changes that cannot be met under current pricing. Recommend tiered package.",
    actionItems: [
      { label: "Prepare counter-proposal deck", done: false },
      { label: "Loop in Legal", done: false },
    ],
    stakeholders: ["Diane Okafor", "Legal", "Julian Drake"],
    recommendation: "Offer 99.95% tier as standard; 99.99% as paid premium add-on.",
    realisticCheck: "99.999% is not achievable under current single-region architecture.",
    clientFeedback: "We expected this is included by default.",
  },
];

export const recommendations = [
  { id: "r1", accountId: "starlight", title: "Schedule QBR Transition", body: "Shift from tactical to strategic review to address health score drop.", level: "accent" as const, impact: "+6 score" },
  { id: "r2", accountId: "starlight", title: "Exec Sponsor Re-connect", body: "Sarah Jenkins (CTO) has been quiet for 14 days. Suggest brief sync.", level: "warn" as const, impact: "+3 score" },
  { id: "r3", accountId: "axiom", title: "Propose EMEA Fulfillment Node", body: "Whitespace opportunity to expand into European logistics nodes.", level: "accent" as const, impact: "+$120k ARR" },
];

export const advisoryHistory = [
  { date: "OCT 12, 2024", title: "Digital Infrastructure Roadmap Presentation", accountId: "starlight" },
  { date: "SEP 05, 2024", title: "Efficiency Audit Report: Cloud Migration", accountId: "starlight" },
  { date: "AUG 21, 2024", title: "Security Posture Review", accountId: "axiom" },
  { date: "AUG 02, 2024", title: "APAC Expansion Workshop", accountId: "cloudpeak" },
];

// Notifications (in-app)
export const notifications: Notification[] = [
  { id: "n1", title: "Action: 48h meeting with Axiom", body: "Marcus Hale (VP Eng) requested a sync. SLA 28h.", accountId: "axiom", time: "12m ago", type: "action", read: false },
  { id: "n2", title: "P1 Escalation opened — Starlight", body: "API latency on West-2 cluster.", accountId: "starlight", time: "1h ago", type: "alert", read: false },
  { id: "n3", title: "Renewal in 14 days — Axiom", body: "Prepare auto-renew + 8% price hike doc.", accountId: "axiom", time: "Today 09:00", type: "action", read: false },
  { id: "n4", title: "New CTO joined Northwind", body: "Plan an exec intro within 10 days.", accountId: "northwind", time: "Yesterday", type: "info", read: true },
  { id: "n5", title: "Vertex risk score dropped to 3.8", body: "Competitor activity flag triggered.", accountId: "vertex", time: "Yesterday", type: "alert", read: true },
];

// Portfolio news feed (auto-generated from account events)
export type NewsItem = {
  id: string;
  type: "new_account" | "management_change" | "renewal" | "escalation" | "milestone" | "risk";
  title: string;
  body: string;
  accountId?: string;
  time: string;
};

export const portfolioNews: NewsItem[] = [
  { id: "nw1", type: "new_account", title: "New key account onboarded — Helios Robotics", body: "Added to portfolio under Head of KAM oversight. KYC due in 7 days.", time: "2h ago" },
  { id: "nw2", type: "management_change", title: "Northwind appointed new CTO", body: "Priya Anand replaces previous CTO. Plan an exec intro within 10 days.", accountId: "northwind", time: "Yesterday" },
  { id: "nw3", type: "renewal", title: "Axiom renewal window opens", body: "14 days to renewal — prepare auto-renew + 8% price hike memo.", accountId: "axiom", time: "Today 09:00" },
  { id: "nw4", type: "risk", title: "Vertex risk score dropped to 3.8", body: "Competitor activity flag triggered — review white-space pitch.", accountId: "vertex", time: "Yesterday" },
  { id: "nw5", type: "milestone", title: "Starlight crossed $1.2M ARR", body: "Expansion deal closed by KAM team. CSAT bumped to 8.6.", accountId: "starlight", time: "2 days ago" },
];

// Open action items assigned to current user
export type OpenActionItem = {
  id: string;
  title: string;
  accountId?: string;
  due: string;
  priority: "P1" | "P2" | "P3";
  source: "Escalation" | "Meeting" | "QBR" | "Renewal";
};

export const openActionItems: OpenActionItem[] = [
  { id: "ai1", title: "Client update call with Marcus Hale", accountId: "axiom", due: "Today 14:00", priority: "P1", source: "Escalation" },
  { id: "ai2", title: "Draft post-mortem outline for DB indexing", accountId: "axiom", due: "Tomorrow", priority: "P1", source: "Escalation" },
  { id: "ai3", title: "Prepare counter-proposal deck for Vertex", accountId: "vertex", due: "In 2 days", priority: "P2", source: "Meeting" },
  { id: "ai4", title: "Schedule QBR with Starlight CTO", accountId: "starlight", due: "This week", priority: "P2", source: "QBR" },
  { id: "ai5", title: "Prepare auto-renew + price-hike memo (Axiom)", accountId: "axiom", due: "In 5 days", priority: "P2", source: "Renewal" },
];

// Unified Global Calendar — aggregates Google Workspace + multiple Outlook/Gmail mailboxes
export type CalendarSource = {
  id: string;
  label: string;
  email: string;
  provider: "Google Workspace" | "Outlook" | "Gmail" | "iCloud";
  color: string; // tailwind bg-* class for dot
  connected: boolean;
};

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;        // human friendly "Today 14:00"
  durationMin: number;
  source: string;       // CalendarSource.id
  type: "meeting" | "task" | "call" | "qbr";
  accountId?: string;
  attendees?: number;
};

export const calendarSources: CalendarSource[] = [
  { id: "gw-aether",    label: "Aether (Workspace)",    email: "kam@aether.io",         provider: "Google Workspace", color: "bg-accent",  connected: true  },
  { id: "ol-julian",    label: "Julian · Outlook",      email: "julian@aether.io",      provider: "Outlook",          color: "bg-success", connected: true  },
  { id: "gm-shared",    label: "Renewals Inbox",        email: "renewals@aether.io",    provider: "Gmail",            color: "bg-warn",    connected: true  },
  { id: "gm-escal",     label: "Escalations Desk",      email: "escalations@aether.io", provider: "Gmail",            color: "bg-crit",    connected: true  },
  { id: "ic-personal",  label: "Personal (iCloud)",     email: "julian@me.com",         provider: "iCloud",           color: "bg-muted-foreground", connected: false },
];

export const globalCalendar: CalendarEvent[] = [
  { id: "ev1", title: "Axiom — Post-mortem call with Marcus Hale",      start: "Today 14:00", durationMin: 45, source: "ol-julian", type: "call",    accountId: "axiom",     attendees: 4 },
  { id: "ev2", title: "Starlight QBR prep (internal)",                  start: "Today 16:30", durationMin: 30, source: "gw-aether", type: "meeting", accountId: "starlight", attendees: 6 },
  { id: "ev3", title: "Renewal review — Vertex auto-renew clauses",     start: "Tomorrow 09:00", durationMin: 60, source: "gm-shared", type: "qbr",  accountId: "vertex",    attendees: 3 },
  { id: "ev4", title: "Escalation triage — P1 backlog walk-through",    start: "Tomorrow 11:00", durationMin: 30, source: "gm-escal",  type: "task",  attendees: 5 },
  { id: "ev5", title: "Starlight CTO sync — roadmap alignment",         start: "Wed 10:30",      durationMin: 60, source: "ol-julian", type: "meeting", accountId: "starlight", attendees: 4 },
  { id: "ev6", title: "Send price-hike memo (Axiom)",                   start: "Wed 17:00",      durationMin: 15, source: "gw-aether", type: "task",  accountId: "axiom" },
  { id: "ev7", title: "Aether weekly KAM standup",                      start: "Thu 09:00",      durationMin: 30, source: "gw-aether", type: "meeting", attendees: 12 },
  { id: "ev8", title: "Vertex — exec sponsor lunch",                    start: "Fri 12:30",      durationMin: 90, source: "ol-julian", type: "meeting", accountId: "vertex",    attendees: 5 },
];

// Account-level opportunities surfaced for KAMs to crack
export type Opportunity = {
  id: string;
  accountId: string;
  title: string;
  source: string;       // where the signal came from
  signalDate: string;
  potential: number;    // USD
  confidence: "Low" | "Medium" | "High";
  nextStep: string;
};

export const opportunities: Opportunity[] = [
  { id: "op1", accountId: "starlight", title: "EMEA fulfillment node — confirmed budget exists",   source: "Discovery call · 09 May", signalDate: "09 May", potential: 120000, confidence: "High",   nextStep: "Draft 1-pager + scope by Friday" },
  { id: "op2", accountId: "starlight", title: "AI co-pilot pilot for ops team (heard on call)",    source: "QBR transcript",          signalDate: "18 May", potential: 80000,  confidence: "Medium", nextStep: "Pitch 6-week paid POC" },
  { id: "op3", accountId: "starlight", title: "Compliance automation — competitor contract expiring", source: "Public 10-K filing",   signalDate: "12 May", potential: 240000, confidence: "Medium", nextStep: "Schedule exec brief with sponsor" },
  { id: "op4", accountId: "axiom",     title: "Disaster-recovery retainer after the P1 incident",  source: "Escalation call",         signalDate: "13 May", potential: 90000,  confidence: "High",   nextStep: "Bundle into renewal package" },
  { id: "op5", accountId: "vertex",    title: "Data-residency add-on (EU)",                        source: "Procurement RFI",         signalDate: "07 May", potential: 60000,  confidence: "Medium", nextStep: "Confirm scope with sponsor" },
];

export function getOpportunities(accountId: string) {
  return opportunities.filter((o) => o.accountId === accountId);
}


// Modern industry articles for client education
export type IndustryArticle = {
  id: string;
  title: string;
  source: string;
  date: string;
  summary: string;
  tags: string[];
  url?: string;
};

export const industryArticles: IndustryArticle[] = [
  { id: "ia1", title: "How Agentic AI Is Reshaping Key Account Management in 2026", source: "Harvard Business Review", date: "May 2026", summary: "Agentic AI assistants are now embedded in CRM workflows, surfacing churn signals and white-space opportunities 3x faster than manual review.", tags: ["Agentic AI", "KAM", "CRM"] },
  { id: "ia2", title: "From Dashboards to Decisions: The Rise of LLM-Powered Account 360", source: "McKinsey Digital", date: "Apr 2026", summary: "Enterprises adopting LLM-summarised Account 360 views report 22% lift in stakeholder coverage and 14% shorter renewal cycles.", tags: ["LLM", "Account 360", "Renewals"] },
  { id: "ia3", title: "Vector Search Is Eating Customer Support Backlogs", source: "a16z Enterprise", date: "Mar 2026", summary: "Embedding-based search over Jira + meeting notes lets KAMs auto-extract action items, cutting follow-up time by 40%.", tags: ["Vector Search", "Jira", "Support"] },
  { id: "ia4", title: "The 48-Hour Rule: Closed-Loop Escalation Playbooks That Work", source: "Gainsight Pulse", date: "Mar 2026", summary: "Top-quartile CSMs resolve P1 escalations under 48h by combining live SLA timers, automated RCAs, and exec-sponsored callbacks.", tags: ["Escalation", "SLA", "RCA"] },
  { id: "ia5", title: "WhatsApp Business + AI: A New Default for Client Touchpoints", source: "TechCrunch", date: "Feb 2026", summary: "B2B teams are replacing low-engagement email nudges with AI-drafted WhatsApp messages — open rates above 90% in pilot accounts.", tags: ["WhatsApp", "AI", "Engagement"] },
  { id: "ia6", title: "Contract Intelligence: Spotting Auto-Renew Traps with AI", source: "Gartner", date: "Feb 2026", summary: "AI contract analyzers flag missing auto-renew, non-terminator and price-hike clauses in seconds — material risk reduced 35%.", tags: ["Contracts", "AI", "Compliance"] },
];

// Role hierarchy
export type Role = "CEO" | "Head of KAM" | "KAM";

export type RolePermissions = { read: boolean; write: boolean; scope: "all" | "assigned" };

export const ROLE_PERMISSIONS: Record<Role, RolePermissions> = {
  CEO: { read: true, write: false, scope: "all" },
  "Head of KAM": { read: true, write: true, scope: "all" },
  KAM: { read: true, write: true, scope: "assigned" },
};

// Current logged-in user (mock — replace when auth is wired)
export const currentUser = {
  name: "Julian Drake",
  initials: "JD",
  role: "Head of KAM" as Role,
  assignedAccountIds: ["starlight", "axiom", "vertex"],
};

export function canEdit(accountId?: string) {
  const perms = ROLE_PERMISSIONS[currentUser.role];
  if (!perms.write) return false;
  if (perms.scope === "all") return true;
  return accountId ? currentUser.assignedAccountIds.includes(accountId) : true;
}

export function formatCurrency(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}
