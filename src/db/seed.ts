import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// Use service_role key to bypass RLS during seeding
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(process.env.VITE_SUPABASE_URL!, supabaseKey);

// ─── helpers ────────────────────────────────────────────────────────────────

async function upsert(table: string, rows: object | object[], conflictKey = "id") {
  const data = Array.isArray(rows) ? rows : [rows];
  const { error } = await supabase
    .from(table)
    .upsert(data, { onConflict: conflictKey });
  if (error) {
    console.error(`  ✗ ${table}:`, error.message);
    throw error;
  }
  console.log(`  ✓ ${table} (${data.length} row${data.length !== 1 ? "s" : ""})`);
}

// ─── profiles ───────────────────────────────────────────────────────────────

async function seedProfiles() {
  await upsert("profiles", [
    { id: "00000000-0000-0000-0000-000000000001", name: "Julian Drake",  initials: "JD", role: "Head of KAM", email: "julian@aether.io"  },
    { id: "00000000-0000-0000-0000-000000000002", name: "Maya Lin",      initials: "ML", role: "KAM",         email: "maya@aether.io"    },
    { id: "00000000-0000-0000-0000-000000000003", name: "Bashair Ahmad", initials: "BA", role: "KAM",         email: "bashair@aether.io" },
  ]);
}

// ─── accounts ───────────────────────────────────────────────────────────────

async function seedAccounts() {
  await upsert("accounts", [
    {
      id: "starlight",
      name: "Starlight Systems Corp.",
      assigned_kam_id: "00000000-0000-0000-0000-000000000002",
      short_code: "ST",
      industry: "Cloud Infrastructure",
      tier: "Enterprise",
      health: 84,
      trend: 3.2,
      contract_value: 2400000,
      arr: 2400000,
      renewal_days: 114,
      contract_type: "Staff Augmented",
      last_touch: "Yesterday",
      status: "healthy",
      retention_risk: "Low",
      growth_upside: 850000,
      white_space_count: 3,
      cooperation: 9.2,
      service_consumption: 6.1,
      meetings_per_month: 8,
      contract_compliance: 10,
      primary_contact_name: "Sarah Jenkins",
      primary_contact_role: "CTO",
      founded: 2008,
      employees: "1,200+",
      region: "North America",
      description: "Distributed cloud platform serving fintech and logistics workloads across NA and EMEA.",
      business_info: "B2B SaaS providing managed Kubernetes, edge compute, and observability to mid-market fintech.",
      client_history: "Onboarded Q2 2021. Expanded from 2 to 18 engineers. Renewed twice; survived one P0 escalation in 2023.",
      revenue: "$420M (FY24)",
      mrr_arr: null,
      is_startup: false,
      engagement_tenure: "4y 2m",
      team_size: 18,
      competitors: ["Globant", "EPAM", "Persistent"],
      main_business_flow: "Customer → onboarding API → managed cluster provisioning → observability dashboards → billing.",
    },
    {
      id: "axiom",
      name: "Axiom Logistics",
      assigned_kam_id: "00000000-0000-0000-0000-000000000001",
      short_code: "AX",
      industry: "Logistics & Supply Chain",
      tier: "Enterprise",
      health: 88,
      trend: 4.2,
      contract_value: 4820000,
      arr: 4820000,
      renewal_days: 14,
      contract_type: "Retainer",
      last_touch: "2 hours ago",
      status: "healthy",
      retention_risk: "Low",
      growth_upside: 1200000,
      white_space_count: 5,
      cooperation: 9.5,
      service_consumption: 9.4,
      meetings_per_month: 12,
      contract_compliance: 10,
      primary_contact_name: "Marcus Hale",
      primary_contact_role: "VP Engineering",
      founded: 1994,
      employees: "5,400+",
      region: "Global",
      description: "Global freight network rebuilding their data backbone for predictive routing.",
      business_info: "Global freight + last-mile delivery. Modernizing dispatch & telemetry on our platform.",
      client_history: "Strategic since 2019. Survived 2 leadership changes. NPS 72.",
      revenue: "$2.1B (FY24)",
      mrr_arr: null,
      is_startup: false,
      engagement_tenure: "5y 8m",
      team_size: 34,
      competitors: ["Accenture", "IBM iX"],
      main_business_flow: "Shipment intake → routing engine → driver app → POD → invoicing.",
    },
    {
      id: "vertex",
      name: "Vertex Industrial",
      assigned_kam_id: "00000000-0000-0000-0000-000000000002",
      short_code: "VX",
      industry: "Heavy Manufacturing",
      tier: "Growth",
      health: 42,
      trend: -8.1,
      contract_value: 950000,
      arr: 950000,
      renewal_days: 38,
      contract_type: "Time Based",
      last_touch: "Just now",
      status: "critical",
      retention_risk: "High",
      growth_upside: 200000,
      white_space_count: 1,
      cooperation: 5.4,
      service_consumption: 4.1,
      meetings_per_month: 2,
      contract_compliance: 7.2,
      primary_contact_name: "Diane Okafor",
      primary_contact_role: "Director of IT",
      founded: 1972,
      employees: "8,000+",
      region: "EMEA",
      description: "Legacy industrial conglomerate modernizing factory telemetry systems.",
      business_info: "Industrial manufacturing; modernizing SCADA + factory telemetry across 22 plants.",
      client_history: "Won in 2022 after RFP. Two POC changes in 18 months. Currently strained.",
      revenue: "$1.4B (FY23)",
      mrr_arr: null,
      is_startup: false,
      engagement_tenure: "1y 9m",
      team_size: 8,
      competitors: ["Capgemini", "Cognizant", "Internal IT"],
      main_business_flow: "Sensor → SCADA → analytics → MES → ERP.",
    },
    {
      id: "cloudpeak",
      name: "CloudPeak Systems",
      assigned_kam_id: "00000000-0000-0000-0000-000000000001",
      short_code: "CP",
      industry: "SaaS Platforms",
      tier: "Strategic",
      health: 76,
      trend: 0.4,
      contract_value: 4100000,
      arr: 4100000,
      renewal_days: 220,
      contract_type: "Staff Augmented",
      last_touch: "1 week ago",
      status: "healthy",
      retention_risk: "Low",
      growth_upside: 600000,
      white_space_count: 4,
      cooperation: 8.4,
      service_consumption: 7.8,
      meetings_per_month: 6,
      contract_compliance: 9.6,
      primary_contact_name: "Anika Roy",
      primary_contact_role: "Chief Product Officer",
      founded: 2014,
      employees: "750+",
      region: "APAC",
      description: "Mid-market collaboration suite scaling internationally.",
      business_info: "Collaboration SaaS — chat, video, docs. Series D, scaling APAC + LATAM.",
      client_history: "Onboarded 2022 post Series C. ARR doubled with us in 18 months.",
      revenue: "$92M ARR",
      mrr_arr: "MRR $7.6M · ARR $92M",
      is_startup: true,
      engagement_tenure: "2y 4m",
      team_size: 22,
      competitors: ["ThoughtWorks", "BCG Platinion"],
      main_business_flow: "Sign-up → workspace provisioning → realtime sync → billing → enterprise SSO.",
    },
    {
      id: "northwind",
      name: "Northwind Finance",
      assigned_kam_id: "00000000-0000-0000-0000-000000000001",
      short_code: "NW",
      industry: "Financial Services",
      tier: "Enterprise",
      health: 61,
      trend: -2.1,
      contract_value: 3300000,
      arr: 3300000,
      renewal_days: 67,
      contract_type: "Retainer",
      last_touch: "3 days ago",
      status: "at-risk",
      retention_risk: "Medium",
      growth_upside: 420000,
      white_space_count: 2,
      cooperation: 7.1,
      service_consumption: 6.8,
      meetings_per_month: 4,
      contract_compliance: 8.4,
      primary_contact_name: "Theo Lambert",
      primary_contact_role: "Head of Platform",
      founded: 1987,
      employees: "12,000+",
      region: "EMEA",
      description: "Tier-1 European bank running compliance-grade data workloads.",
      business_info: "European retail + commercial bank. Regulated workloads, strict change management.",
      client_history: "Onboarded 2020. Compliance-heavy. Recent CTO change risks scope re-evaluation.",
      revenue: "$11.4B (FY24)",
      mrr_arr: null,
      is_startup: false,
      engagement_tenure: "3y 11m",
      team_size: 26,
      competitors: ["Accenture", "Deloitte"],
      main_business_flow: "Core banking → data lake → reg-reporting → BI → audit.",
    },
  ]);
}

// ─── stakeholders ────────────────────────────────────────────────────────────

async function seedStakeholders() {
  await upsert("stakeholders", [
    { id: "10000001-0000-0000-0000-000000000001", account_id: "starlight", name: "Sarah Jenkins", role: "CTO",               influence: "Decision Maker", email: "sarah@starlight.io", last_contact: "Yesterday" },
    { id: "10000001-0000-0000-0000-000000000002", account_id: "starlight", name: "Omar Patel",    role: "VP Platform",       influence: "Champion",       email: null,                last_contact: "3d ago"    },
    { id: "10000001-0000-0000-0000-000000000003", account_id: "starlight", name: "Lena Choi",     role: "Procurement Lead",  influence: "Blocker",        email: null,                last_contact: "2w ago"    },
    { id: "10000002-0000-0000-0000-000000000001", account_id: "axiom",     name: "Marcus Hale",   role: "VP Engineering",    influence: "Champion",       email: null,                last_contact: "2h ago"    },
    { id: "10000002-0000-0000-0000-000000000002", account_id: "axiom",     name: "Renata Souza",  role: "COO",               influence: "Decision Maker", email: null,                last_contact: "1w ago"    },
    { id: "10000003-0000-0000-0000-000000000001", account_id: "vertex",    name: "Diane Okafor",  role: "Director of IT",    influence: "Decision Maker", email: null,                last_contact: "Just now"  },
    { id: "10000003-0000-0000-0000-000000000002", account_id: "vertex",    name: "Hans Becker",   role: "Plant Ops Lead",    influence: "Blocker",        email: null,                last_contact: "1m ago"    },
    { id: "10000004-0000-0000-0000-000000000001", account_id: "cloudpeak", name: "Anika Roy",     role: "CPO",               influence: "Champion",       email: null,                last_contact: "1w ago"    },
    { id: "10000004-0000-0000-0000-000000000002", account_id: "cloudpeak", name: "Felix Tang",    role: "Head of Engineering", influence: "Decision Maker", email: null,              last_contact: "3d ago"    },
    { id: "10000005-0000-0000-0000-000000000001", account_id: "northwind", name: "Theo Lambert",  role: "Head of Platform",  influence: "Decision Maker", email: null,                last_contact: "3d ago"    },
    { id: "10000005-0000-0000-0000-000000000002", account_id: "northwind", name: "Ines Muller",   role: "CTO (new)",         influence: "Influencer",     email: null,                last_contact: "n/a"       },
  ]);
}

// ─── health_scores + health_metrics ─────────────────────────────────────────

type HealthRow = { id: string; account_id: string; area: string; score: number };
type MetricRow = { id: string; health_score_id: string; label: string; value: number; hint: string | null };

async function seedHealth() {
  const scores: HealthRow[] = [];
  const metrics: MetricRow[] = [];

  // area abbrev → uuid prefix digit
  const areaData: Array<{ area: string; pfx: string; account: string; score: number; mets: Array<{ label: string; value: number; hint?: string }> }> = [
    // starlight
    { area: "relationship", pfx: "20", account: "starlight", score: 8.4, mets: [
      { label: "CEO to CEO meetups",   value: 7,   hint: "Last in Q2" },
      { label: "Monthly meetings",     value: 9,   hint: "8 / month"  },
      { label: "Director meetings",    value: 8                        },
      { label: "Cooperation level",    value: 9.2                      },
    ]},
    { area: "project",      pfx: "21", account: "starlight", score: 7.9, mets: [
      { label: "On-time deliverables", value: 8.5 },
      { label: "Client feedback",      value: 8.0 },
      { label: "Quality / Defect health", value: 7.4 },
      { label: "Scope & change requests", value: 7.6 },
    ]},
    { area: "white_space",  pfx: "22", account: "starlight", score: 6.8, mets: [
      { label: "Meeting frequency",    value: 8   },
      { label: "Upsell capacity",      value: 7   },
      { label: "Services penetration", value: 5.5, hint: "5 of 11 services" },
      { label: "Account note count",   value: 6.7 },
    ]},
    { area: "contract",     pfx: "23", account: "starlight", score: 8.6, mets: [
      { label: "Value to us", value: 9 },
      { label: "Duration",    value: 8 },
      { label: "Auto-renew",  value: 9 },
    ]},
    { area: "csat",         pfx: "24", account: "starlight", score: 8.7, mets: [
      { label: "NPS",                  value: 9   },
      { label: "Quarterly survey",     value: 8.5 },
      { label: "Support tickets CSAT", value: 8.6 },
      { label: "Exec sentiment",       value: 9   },
    ]},
    { area: "risk",         pfx: "25", account: "starlight", score: 7.2, mets: [
      { label: "Competitor activity",  value: 7, hint: "Globant pitching cluster mgmt" },
      { label: "Geopolitical exposure", value: 8 },
      { label: "POC change risk",      value: 6 },
      { label: "Payments on time",     value: 9 },
      { label: "C-level changes",      value: 7 },
    ]},
    { area: "resource",     pfx: "26", account: "starlight", score: 7.8, mets: [
      { label: "Backup coverage",  value: 8 },
      { label: "Leaves this month", value: 7 },
      { label: "Critical roles",   value: 7 },
    ]},
    { area: "financial",    pfx: "27", account: "starlight", score: 8.5, mets: [
      { label: "Revenue generation",            value: 9   },
      { label: "Resource allocation efficiency", value: 8   },
      { label: "Margin",                        value: 8.5 },
    ]},
    // axiom
    { area: "relationship", pfx: "30", account: "axiom", score: 9.1, mets: [
      { label: "CEO to CEO meetups",   value: 9   },
      { label: "Monthly meetings",     value: 9.5, hint: "12 / month" },
      { label: "Director meetings",    value: 9   },
      { label: "Cooperation level",    value: 9.5 },
    ]},
    { area: "project",      pfx: "31", account: "axiom", score: 8.9, mets: [
      { label: "On-time deliverables", value: 9   },
      { label: "Client feedback",      value: 9   },
      { label: "Quality / Defect health", value: 8.7 },
      { label: "Scope & change requests", value: 8.8 },
    ]},
    { area: "white_space",  pfx: "32", account: "axiom", score: 8.2, mets: [
      { label: "Meeting frequency",    value: 9   },
      { label: "Upsell capacity",      value: 8.5 },
      { label: "Services penetration", value: 7.5 },
      { label: "Account note count",   value: 7.8 },
    ]},
    { area: "contract",     pfx: "33", account: "axiom", score: 9.2, mets: [
      { label: "Value to us", value: 9.5 },
      { label: "Duration",    value: 9   },
      { label: "Auto-renew",  value: 9   },
    ]},
    { area: "csat",         pfx: "34", account: "axiom", score: 9.0, mets: [
      { label: "NPS",                  value: 9   },
      { label: "Quarterly survey",     value: 9.1 },
      { label: "Support tickets CSAT", value: 8.9 },
      { label: "Exec sentiment",       value: 9   },
    ]},
    { area: "risk",         pfx: "35", account: "axiom", score: 8.2, mets: [
      { label: "Competitor activity",   value: 8              },
      { label: "Geopolitical exposure", value: 7, hint: "Red Sea routes" },
      { label: "POC change risk",       value: 8              },
      { label: "Payments on time",      value: 10             },
      { label: "C-level changes",       value: 8              },
    ]},
    { area: "resource",     pfx: "36", account: "axiom", score: 8.6, mets: [
      { label: "Backup coverage",   value: 9   },
      { label: "Leaves this month", value: 8   },
      { label: "Critical roles",    value: 8.5 },
    ]},
    { area: "financial",    pfx: "37", account: "axiom", score: 9.0, mets: [
      { label: "Revenue generation",            value: 9.5 },
      { label: "Resource allocation efficiency", value: 8.7 },
      { label: "Margin",                        value: 8.9 },
    ]},
    // vertex
    { area: "relationship", pfx: "40", account: "vertex", score: 4.4, mets: [
      { label: "CEO to CEO meetups",   value: 2              },
      { label: "Monthly meetings",     value: 4, hint: "2 / month — low" },
      { label: "Director meetings",    value: 5              },
      { label: "Cooperation level",    value: 5.4            },
    ]},
    { area: "project",      pfx: "41", account: "vertex", score: 5.1, mets: [
      { label: "On-time deliverables",    value: 5   },
      { label: "Client feedback",         value: 4.5 },
      { label: "Quality / Defect health", value: 5.8 },
      { label: "Scope & change requests", value: 5   },
    ]},
    { area: "white_space",  pfx: "42", account: "vertex", score: 3.5, mets: [
      { label: "Meeting frequency",    value: 3 },
      { label: "Upsell capacity",      value: 4 },
      { label: "Services penetration", value: 3 },
      { label: "Account note count",   value: 4 },
    ]},
    { area: "contract",     pfx: "43", account: "vertex", score: 5.4, mets: [
      { label: "Value to us", value: 5 },
      { label: "Duration",    value: 5 },
      { label: "Auto-renew",  value: 4 },
    ]},
    { area: "csat",         pfx: "44", account: "vertex", score: 5.2, mets: [
      { label: "NPS",                  value: 4 },
      { label: "Quarterly survey",     value: 5 },
      { label: "Support tickets CSAT", value: 6 },
      { label: "Exec sentiment",       value: 5 },
    ]},
    { area: "risk",         pfx: "45", account: "vertex", score: 3.8, mets: [
      { label: "Competitor activity",   value: 3, hint: "Capgemini pitching" },
      { label: "Geopolitical exposure", value: 5 },
      { label: "POC change risk",       value: 3 },
      { label: "Payments on time",      value: 6 },
      { label: "C-level changes",       value: 3 },
    ]},
    { area: "resource",     pfx: "46", account: "vertex", score: 5.0, mets: [
      { label: "Backup coverage",   value: 3 },
      { label: "Leaves this month", value: 6 },
      { label: "Critical roles",    value: 5 },
    ]},
    { area: "financial",    pfx: "47", account: "vertex", score: 5.3, mets: [
      { label: "Revenue generation",            value: 5   },
      { label: "Resource allocation efficiency", value: 5.5 },
      { label: "Margin",                        value: 5.5 },
    ]},
    // cloudpeak
    { area: "relationship", pfx: "50", account: "cloudpeak", score: 8.0, mets: [
      { label: "CEO to CEO meetups",   value: 7             },
      { label: "Monthly meetings",     value: 8, hint: "6 / month" },
      { label: "Director meetings",    value: 8             },
      { label: "Cooperation level",    value: 8.4           },
    ]},
    { area: "project",      pfx: "51", account: "cloudpeak", score: 8.2, mets: [
      { label: "On-time deliverables",    value: 8.5 },
      { label: "Client feedback",         value: 8   },
      { label: "Quality / Defect health", value: 8.0 },
      { label: "Scope & change requests", value: 8.2 },
    ]},
    { area: "white_space",  pfx: "52", account: "cloudpeak", score: 7.0, mets: [
      { label: "Meeting frequency",    value: 7   },
      { label: "Upsell capacity",      value: 7.5 },
      { label: "Services penetration", value: 6.5 },
      { label: "Account note count",   value: 7   },
    ]},
    { area: "contract",     pfx: "53", account: "cloudpeak", score: 8.0, mets: [
      { label: "Value to us", value: 8 },
      { label: "Duration",    value: 8 },
      { label: "Auto-renew",  value: 8 },
    ]},
    { area: "csat",         pfx: "54", account: "cloudpeak", score: 8.4, mets: [
      { label: "NPS",                  value: 8   },
      { label: "Quarterly survey",     value: 8.5 },
      { label: "Support tickets CSAT", value: 8.4 },
      { label: "Exec sentiment",       value: 8.5 },
    ]},
    { area: "risk",         pfx: "55", account: "cloudpeak", score: 7.5, mets: [
      { label: "Competitor activity",   value: 7 },
      { label: "Geopolitical exposure", value: 8 },
      { label: "POC change risk",       value: 7 },
      { label: "Payments on time",      value: 9 },
      { label: "C-level changes",       value: 7 },
    ]},
    { area: "resource",     pfx: "56", account: "cloudpeak", score: 7.6, mets: [
      { label: "Backup coverage",   value: 8   },
      { label: "Leaves this month", value: 7   },
      { label: "Critical roles",    value: 7.5 },
    ]},
    { area: "financial",    pfx: "57", account: "cloudpeak", score: 8.0, mets: [
      { label: "Revenue generation",            value: 8 },
      { label: "Resource allocation efficiency", value: 8 },
      { label: "Margin",                        value: 8 },
    ]},
    // northwind
    { area: "relationship", pfx: "60", account: "northwind", score: 6.8, mets: [
      { label: "CEO to CEO meetups",   value: 5   },
      { label: "Monthly meetings",     value: 7   },
      { label: "Director meetings",    value: 7   },
      { label: "Cooperation level",    value: 7.1 },
    ]},
    { area: "project",      pfx: "61", account: "northwind", score: 7.2, mets: [
      { label: "On-time deliverables",    value: 7.5 },
      { label: "Client feedback",         value: 6.8 },
      { label: "Quality / Defect health", value: 7.5 },
      { label: "Scope & change requests", value: 7   },
    ]},
    { area: "white_space",  pfx: "62", account: "northwind", score: 5.6, mets: [
      { label: "Meeting frequency",    value: 6   },
      { label: "Upsell capacity",      value: 5.5 },
      { label: "Services penetration", value: 5.5 },
      { label: "Account note count",   value: 5.5 },
    ]},
    { area: "contract",     pfx: "63", account: "northwind", score: 7.4, mets: [
      { label: "Value to us", value: 8 },
      { label: "Duration",    value: 7 },
      { label: "Auto-renew",  value: 7 },
    ]},
    { area: "csat",         pfx: "64", account: "northwind", score: 7.1, mets: [
      { label: "NPS",                  value: 7   },
      { label: "Quarterly survey",     value: 7.2 },
      { label: "Support tickets CSAT", value: 7   },
      { label: "Exec sentiment",       value: 7   },
    ]},
    { area: "risk",         pfx: "65", account: "northwind", score: 5.6, mets: [
      { label: "Competitor activity",   value: 5              },
      { label: "Geopolitical exposure", value: 6              },
      { label: "POC change risk",       value: 4, hint: "New CTO" },
      { label: "Payments on time",      value: 8              },
      { label: "C-level changes",       value: 5              },
    ]},
    { area: "resource",     pfx: "66", account: "northwind", score: 7.0, mets: [
      { label: "Backup coverage",   value: 7 },
      { label: "Leaves this month", value: 7 },
      { label: "Critical roles",    value: 7 },
    ]},
    { area: "financial",    pfx: "67", account: "northwind", score: 7.5, mets: [
      { label: "Revenue generation",            value: 7.5 },
      { label: "Resource allocation efficiency", value: 7.5 },
      { label: "Margin",                        value: 7.5 },
    ]},
  ];

  let metIdx = 0;
  for (const d of areaData) {
    const scoreId = `${d.pfx}000000-0000-0000-0000-000000000000`;
    scores.push({ id: scoreId, account_id: d.account, area: d.area, score: d.score });
    for (let i = 0; i < d.mets.length; i++) {
      const m = d.mets[i];
      metIdx++;
      metrics.push({
        id: `${d.pfx}${String(i + 1).padStart(6, "0")}-0000-0000-0000-${String(metIdx).padStart(12, "0")}`,
        health_score_id: scoreId,
        label: m.label,
        value: m.value,
        hint: m.hint ?? null,
      });
    }
  }

  await upsert("health_scores", scores);
  await upsert("health_metrics", metrics);
}

// ─── contract_details ────────────────────────────────────────────────────────

async function seedContractDetails() {
  await upsert("contract_details", [
    {
      id: "cd000001-0000-0000-0000-000000000000",
      account_id: "starlight",
      type: "Staff Augmented",
      duration: "24 months",
      auto_renew: true,
      non_terminator: true,
      min_one_year: true,
      price_hike: "6% YoY",
      swot_s: "Embedded engineers, high switching cost",
      swot_w: "Single-region dependency",
      swot_o: "Expand to EMEA infra modernization",
      swot_t: "Internal platform team scaling up",
      customer_feedback: "\"The team feels like ours.\" — S. Jenkins, CTO",
      backup_exists: true,
      leaves_this_month: 2,
      critical_resources: 3,
    },
    {
      id: "cd000002-0000-0000-0000-000000000000",
      account_id: "axiom",
      type: "Retainer",
      duration: "36 months",
      auto_renew: true,
      non_terminator: true,
      min_one_year: true,
      price_hike: "8% YoY",
      swot_s: "Deep workflow embedment",
      swot_w: "Heavy dependency on COO sponsorship",
      swot_o: "EMEA fulfillment node expansion",
      swot_t: "In-house build initiative being scoped",
      customer_feedback: "\"Our routing accuracy is up 14%.\" — R. Souza, COO",
      backup_exists: true,
      leaves_this_month: 3,
      critical_resources: 5,
    },
    {
      id: "cd000003-0000-0000-0000-000000000000",
      account_id: "vertex",
      type: "Time Based",
      duration: "12 months",
      auto_renew: false,
      non_terminator: false,
      min_one_year: true,
      price_hike: "0%",
      swot_s: "Domain experience in SCADA",
      swot_w: "Thin contract margin",
      swot_o: "Convert to retainer in renewal",
      swot_t: "Capgemini actively pitching replacement",
      customer_feedback: "\"Quality acceptable but communication is slow.\" — D. Okafor",
      backup_exists: false,
      leaves_this_month: 1,
      critical_resources: 2,
    },
    {
      id: "cd000004-0000-0000-0000-000000000000",
      account_id: "cloudpeak",
      type: "Staff Augmented",
      duration: "24 months",
      auto_renew: true,
      non_terminator: true,
      min_one_year: true,
      price_hike: "5% YoY",
      swot_s: "Mutual cultural fit, strong CPO sponsor",
      swot_w: "Limited C-suite reach beyond product",
      swot_o: "AI features wave — observability + insights",
      swot_t: "Series E might trigger in-house build",
      customer_feedback: "\"Reliable partner for scale-up phase.\" — A. Roy",
      backup_exists: true,
      leaves_this_month: 2,
      critical_resources: 4,
    },
    {
      id: "cd000005-0000-0000-0000-000000000000",
      account_id: "northwind",
      type: "Retainer",
      duration: "24 months",
      auto_renew: true,
      non_terminator: true,
      min_one_year: true,
      price_hike: "4% YoY",
      swot_s: "Reg-compliance moat",
      swot_w: "Dependency on platform team",
      swot_o: "Reg-reporting AI co-pilot",
      swot_t: "New CTO favors big-4 consultancies",
      customer_feedback: "\"Solid execution; need stronger executive presence.\" — T. Lambert",
      backup_exists: true,
      leaves_this_month: 4,
      critical_resources: 3,
    },
  ]);
}

// ─── activities ──────────────────────────────────────────────────────────────

async function seedActivities() {
  await upsert("activities", [
    { id: "starlight-a1", account_id: "starlight", area: "Relationship", title: "CEO-to-CEO sync in NYC",          owner: "Julian Drake", due: "In 12d",  status: "Open",        rag: "A", expected_lift: "+4 relationship" },
    { id: "starlight-a2", account_id: "starlight", area: "Project",      title: "Defect-rate war-room",            owner: "Maya Lin",     due: "In 5d",   status: "In Progress", rag: "A", expected_lift: "+1.2 project"    },
    { id: "starlight-a3", account_id: "starlight", area: "Financial",    title: "Negotiate 8% price hike on renewal", owner: "Julian Drake", due: "60d",  status: "Open",        rag: "G", expected_lift: "+$190k ARR"      },
    { id: "starlight-a4", account_id: "starlight", area: "Resource",     title: "Add backup SRE for cluster",      owner: "Maya Lin",     due: "30d",     status: "Open",        rag: "R", expected_lift: "+1.5 resource"   },
    { id: "axiom-a1",     account_id: "axiom",     area: "Relationship", title: "Quarterly Business Review prep",  owner: "Julian Drake", due: "In 4d",   status: "In Progress", rag: "G", expected_lift: "+0.5 relationship" },
    { id: "axiom-a2",     account_id: "axiom",     area: "Project",      title: "Resolve DB indexing post-mortem", owner: "Maya Lin",     due: "Today",   status: "In Progress", rag: "R", expected_lift: "Recover trust"   },
    { id: "axiom-a3",     account_id: "axiom",     area: "Profit",       title: "Pitch EMEA fulfillment node",     owner: "Julian Drake", due: "30d",     status: "Open",        rag: "G", expected_lift: "+$1.2M ARR"      },
    { id: "vertex-a1",    account_id: "vertex",    area: "Relationship", title: "Schedule director-level reset call", owner: "Julian Drake", due: "48h",  status: "Open",        rag: "R", expected_lift: "+1.0 relationship" },
    { id: "vertex-a2",    account_id: "vertex",    area: "Project",      title: "RCA review with Plant Ops",       owner: "Maya Lin",     due: "5d",      status: "Open",        rag: "R", expected_lift: "+0.8 project"    },
    { id: "vertex-a3",    account_id: "vertex",    area: "Resource",     title: "Onboard backup SCADA engineer",   owner: "Hiring",       due: "21d",     status: "Open",        rag: "R", expected_lift: "+1.5 resource"   },
    { id: "cloudpeak-a1", account_id: "cloudpeak", area: "Profit",       title: "AI feature pack proposal",        owner: "Julian Drake", due: "21d",     status: "Open",        rag: "G", expected_lift: "+$300k ARR"      },
    { id: "cloudpeak-a2", account_id: "cloudpeak", area: "Relationship", title: "Re-engage CEO Anika monthly",     owner: "Julian Drake", due: "ongoing", status: "Open",        rag: "A", expected_lift: "+0.7 relationship" },
    { id: "northwind-a1", account_id: "northwind", area: "Relationship", title: "Exec intro to new CTO",           owner: "Julian Drake", due: "10d",     status: "Open",        rag: "R", expected_lift: "+1.5 relationship" },
    { id: "northwind-a2", account_id: "northwind", area: "Profit",       title: "Reg-reporting AI pilot",          owner: "Maya Lin",     due: "45d",     status: "Open",        rag: "G", expected_lift: "+$220k ARR"      },
  ]);
}

// ─── retention_growth ────────────────────────────────────────────────────────

async function seedRetentionGrowth() {
  await upsert("retention_growth", [
    { id: "f1000001-0000-0000-0000-000000000001", account_id: "starlight", service: "Managed Kubernetes",       offered: true,  delivered: true,  applicable: true,  tracking_note: "Steady — 99.97% SLA YTD." },
    { id: "f1000001-0000-0000-0000-000000000002", account_id: "starlight", service: "Cloud Managed Security",  offered: true,  delivered: false, applicable: true,  tracking_note: "Proposal sent, CTO reviewing." },
    { id: "f1000001-0000-0000-0000-000000000003", account_id: "starlight", service: "Edge Observability",      offered: false, delivered: false, applicable: true,  tracking_note: "Discovery call scheduled." },
    { id: "f1000001-0000-0000-0000-000000000004", account_id: "starlight", service: "Data Warehousing",        offered: false, delivered: false, applicable: false, tracking_note: "Client uses in-house Snowflake stack." },
    { id: "f2000001-0000-0000-0000-000000000001", account_id: "axiom",     service: "Routing Engine",          offered: true,  delivered: true,  applicable: true,  tracking_note: "+14% accuracy YoY." },
    { id: "f2000001-0000-0000-0000-000000000002", account_id: "axiom",     service: "Driver Mobile App",       offered: true,  delivered: true,  applicable: true,  tracking_note: "Adoption 92%." },
    { id: "f2000001-0000-0000-0000-000000000003", account_id: "axiom",     service: "Fleet Telemetry",         offered: true,  delivered: false, applicable: true,  tracking_note: "Pilot starting next month." },
    { id: "f2000001-0000-0000-0000-000000000004", account_id: "axiom",     service: "Predictive ETA AI",       offered: false, delivered: false, applicable: true,  tracking_note: "White-space — pitch in QBR." },
    { id: "f2000001-0000-0000-0000-000000000005", account_id: "axiom",     service: "Driver HR module",        offered: false, delivered: false, applicable: false, tracking_note: "Out of scope; handled internally." },
    { id: "f3000001-0000-0000-0000-000000000001", account_id: "vertex",    service: "SCADA Modernization",     offered: true,  delivered: true,  applicable: true,  tracking_note: "Slowed — Plant 7 rollout paused." },
    { id: "f3000001-0000-0000-0000-000000000002", account_id: "vertex",    service: "Predictive Maintenance",  offered: true,  delivered: false, applicable: true,  tracking_note: "Demo pending re-schedule." },
    { id: "f3000001-0000-0000-0000-000000000003", account_id: "vertex",    service: "Worker Safety AI",        offered: false, delivered: false, applicable: true,  tracking_note: "Future opportunity post-renewal." },
    { id: "f4000001-0000-0000-0000-000000000001", account_id: "cloudpeak", service: "Realtime Sync Platform",  offered: true,  delivered: true,  applicable: true,  tracking_note: "Core dep — stable." },
    { id: "f4000001-0000-0000-0000-000000000002", account_id: "cloudpeak", service: "Observability",           offered: true,  delivered: true,  applicable: true,  tracking_note: "Scaling with APAC region." },
    { id: "f4000001-0000-0000-0000-000000000003", account_id: "cloudpeak", service: "AI Insights",             offered: false, delivered: false, applicable: true,  tracking_note: "Pitch in upcoming QBR." },
    { id: "f4000001-0000-0000-0000-000000000004", account_id: "cloudpeak", service: "On-prem deployment",      offered: false, delivered: false, applicable: false, tracking_note: "Not relevant; SaaS-only product." },
    { id: "f5000001-0000-0000-0000-000000000001", account_id: "northwind", service: "Data Lake",               offered: true,  delivered: true,  applicable: true,  tracking_note: "Stable." },
    { id: "f5000001-0000-0000-0000-000000000002", account_id: "northwind", service: "Reg-Reporting",           offered: true,  delivered: true,  applicable: true,  tracking_note: "Quarterly cadence." },
    { id: "f5000001-0000-0000-0000-000000000003", account_id: "northwind", service: "AI Co-pilot",             offered: false, delivered: false, applicable: true,  tracking_note: "Pilot proposed." },
    { id: "f5000001-0000-0000-0000-000000000004", account_id: "northwind", service: "Retail mobile banking",   offered: false, delivered: false, applicable: false, tracking_note: "Owned by separate vendor." },
  ]);
}

// ─── education_log ───────────────────────────────────────────────────────────

async function seedEducationLog() {
  await upsert("education_log", [
    { id: "e1000001-0000-0000-0000-000000000001", account_id: "starlight", date: "OCT 12, 2024", topic: "Digital Infrastructure Roadmap",          approach: "Workshop + 3-year capacity model",       outcome: "Aligned on EMEA expansion phase 1" },
    { id: "e1000001-0000-0000-0000-000000000002", account_id: "starlight", date: "SEP 05, 2024", topic: "Cloud Migration Efficiency Audit",         approach: "Data-driven audit, then exec readout",    outcome: "Identified $310k/yr saving" },
    { id: "e2000001-0000-0000-0000-000000000001", account_id: "axiom",     date: "AUG 21, 2024", topic: "Security Posture Review",                  approach: "External pen-test + workshop",             outcome: "Closed 14 of 17 findings in 60 days" },
    { id: "e3000001-0000-0000-0000-000000000001", account_id: "vertex",    date: "JUN 10, 2024", topic: "SCADA Best Practices",                     approach: "On-site workshop",                        outcome: "Buy-in from 2 of 5 plant managers" },
    { id: "e4000001-0000-0000-0000-000000000001", account_id: "cloudpeak", date: "AUG 02, 2024", topic: "APAC Expansion Workshop",                  approach: "Strategy sprint",                         outcome: "Roadmap agreed for SG + Tokyo POPs" },
    { id: "e5000001-0000-0000-0000-000000000001", account_id: "northwind", date: "MAY 16, 2024", topic: "Reg-Reporting Modernization",              approach: "Whitepaper + exec workshop",               outcome: "Pilot scoped for Q3" },
  ]);
}

// ─── escalations + action items ──────────────────────────────────────────────

async function seedEscalations() {
  await upsert("escalations", [
    {
      id: "esc-001",
      account_id: "starlight",
      title: "API Latency — West-2 Cluster",
      priority: "P1",
      sla_remaining_hours: 18.7,
      opened_at: "Today 09:14",
      rca: "API latency spike in West-2 regional nodes impacting dashboard performance for 4% of users.",
      description: "Customer reports degraded dashboard responsiveness during peak hours. Performance budget exceeded on three endpoints.",
      recommendation: "Roll back v4.2 and move West-2 to multi-AZ before next peak window.",
      realistic_check: "Achievable in 24h with current on-call rotation.",
      client_feedback: "\"Need a written RCA within 48 hours.\"",
      stakeholders: ["Sarah Jenkins (CTO)", "On-call SRE", "Julian Drake (KAM)"],
    },
    {
      id: "esc-002",
      account_id: "axiom",
      title: "Latent DB Indexing Failure",
      priority: "P1",
      sla_remaining_hours: 28.2,
      opened_at: "Yesterday 16:40",
      rca: "Cache layer mismatch following the v4.12.0 deploy.",
      description: "Primary stakeholder at Axiom requesting a 1:1 call within 48 hours. ERP sync delayed.",
      recommendation: "Hot-patch cache layer; offer 1-month service credit as goodwill.",
      realistic_check: "Patch ready in 12h; credit needs Finance approval.",
      client_feedback: "Appreciate the speed — keep us in the loop hourly.",
      stakeholders: ["Marcus Hale", "Platform Eng", "Julian Drake"],
    },
    {
      id: "esc-003",
      account_id: "vertex",
      title: "Unrealistic SLA Renegotiation",
      priority: "P2",
      sla_remaining_hours: 41.0,
      opened_at: "2 days ago",
      rca: "Client requesting 99.999% uptime guarantee outside contractual envelope.",
      description: "Director of IT pushing for SLA changes that cannot be met under current pricing. Recommend tiered package.",
      recommendation: "Offer 99.95% tier as standard; 99.99% as paid premium add-on.",
      realistic_check: "99.999% is not achievable under current single-region architecture.",
      client_feedback: "We expected this is included by default.",
      stakeholders: ["Diane Okafor", "Legal", "Julian Drake"],
    },
  ]);

  await upsert("escalation_action_items", [
    { id: "ea000001-0000-0000-0000-000000000001", escalation_id: "esc-001", label: "Rollback deployment v4.2",               done: false },
    { id: "ea000001-0000-0000-0000-000000000002", escalation_id: "esc-001", label: "Notify CTO Jenkins (48h SLA call)",      done: false },
    { id: "ea000001-0000-0000-0000-000000000003", escalation_id: "esc-001", label: "Internal incident brief",                done: true  },
    { id: "ea000002-0000-0000-0000-000000000001", escalation_id: "esc-002", label: "Engage on-call SRE lead",                done: true  },
    { id: "ea000002-0000-0000-0000-000000000002", escalation_id: "esc-002", label: "Client update call (14:00 GMT)",         done: false },
    { id: "ea000002-0000-0000-0000-000000000003", escalation_id: "esc-002", label: "Draft post-mortem outline",              done: false },
    { id: "ea000003-0000-0000-0000-000000000001", escalation_id: "esc-003", label: "Prepare counter-proposal deck",          done: false },
    { id: "ea000003-0000-0000-0000-000000000002", escalation_id: "esc-003", label: "Loop in Legal",                         done: false },
  ]);
}

// ─── opportunities ───────────────────────────────────────────────────────────

async function seedOpportunities() {
  await upsert("opportunities", [
    { id: "op1", account_id: "starlight", title: "EMEA fulfillment node — confirmed budget exists",      source: "Discovery call · 09 May", signal_date: "09 May", potential: 120000, confidence: "High",   next_step: "Draft 1-pager + scope by Friday" },
    { id: "op2", account_id: "starlight", title: "AI co-pilot pilot for ops team (heard on call)",       source: "QBR transcript",          signal_date: "18 May", potential: 80000,  confidence: "Medium", next_step: "Pitch 6-week paid POC" },
    { id: "op3", account_id: "starlight", title: "Compliance automation — competitor contract expiring", source: "Public 10-K filing",       signal_date: "12 May", potential: 240000, confidence: "Medium", next_step: "Schedule exec brief with sponsor" },
    { id: "op4", account_id: "axiom",     title: "Disaster-recovery retainer after the P1 incident",    source: "Escalation call",          signal_date: "13 May", potential: 90000,  confidence: "High",   next_step: "Bundle into renewal package" },
    { id: "op5", account_id: "vertex",    title: "Data-residency add-on (EU)",                          source: "Procurement RFI",          signal_date: "07 May", potential: 60000,  confidence: "Medium", next_step: "Confirm scope with sponsor" },
  ]);
}

// ─── notifications ───────────────────────────────────────────────────────────

async function seedNotifications() {
  await upsert("notifications", [
    { id: "n1", title: "Action: 48h meeting with Axiom",       body: "Marcus Hale (VP Eng) requested a sync. SLA 28h.",       account_id: "axiom",     time: "12m ago",    type: "action", read: false },
    { id: "n2", title: "P1 Escalation opened — Starlight",     body: "API latency on West-2 cluster.",                        account_id: "starlight", time: "1h ago",     type: "alert",  read: false },
    { id: "n3", title: "Renewal in 14 days — Axiom",           body: "Prepare auto-renew + 8% price hike doc.",               account_id: "axiom",     time: "Today 09:00", type: "action", read: false },
    { id: "n4", title: "New CTO joined Northwind",              body: "Plan an exec intro within 10 days.",                    account_id: "northwind", time: "Yesterday",  type: "info",   read: true  },
    { id: "n5", title: "Vertex risk score dropped to 3.8",      body: "Competitor activity flag triggered.",                   account_id: "vertex",    time: "Yesterday",  type: "alert",  read: true  },
  ]);
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding Supabase...\n");

  await seedProfiles();
  await seedAccounts();
  await seedStakeholders();
  await seedHealth();
  await seedContractDetails();
  await seedActivities();
  await seedRetentionGrowth();
  await seedEducationLog();
  await seedEscalations();
  await seedOpportunities();
  await seedNotifications();

  console.log("\nDone.");
}

main().catch((e) => { console.error(e); process.exit(1); });
