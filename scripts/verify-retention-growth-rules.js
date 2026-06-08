import assert from "node:assert/strict";

import { buildRetentionGrowthTabModel } from "../src/services/retention-growth-tab.js";
import {
  buildPortfolioRevenueMetrics,
  buildPortfolioStrategyMetrics,
  getAccountPortfolioQuadrant,
  getPortfolioGrowthAccounts,
  getPortfolioUrgentAccounts,
} from "../src/services/portfolio-metrics.js";

const now = "2026-06-07T00:00:00.000Z";

function createAccount(overrides = {}) {
  const base = {
    id: "rule-account",
    name: "Rule Account",
    arr: 1_000_000,
    contractValue: null,
    growthUpside: 0,
    health: 100,
    renewalDays: 180,
    csat: { score: 10 },
    riskScoring: { score: 10, metrics: [] },
    projectHealth: { score: 10 },
    financialHealth: { score: 10 },
    relationshipHealth: { score: 10 },
    meetingsPerMonth: 2,
    whiteSpaceCount: 0,
    contractType: "Project",
    retentionGrowth: [],
    educationLog: [],
    lastTouch: now,
    retentionGrowthCalculatedAt: now,
  };

  return {
    ...base,
    ...overrides,
    csat: { ...base.csat, ...(overrides.csat ?? {}) },
    riskScoring: { ...base.riskScoring, ...(overrides.riskScoring ?? {}) },
    projectHealth: { ...base.projectHealth, ...(overrides.projectHealth ?? {}) },
    financialHealth: { ...base.financialHealth, ...(overrides.financialHealth ?? {}) },
    relationshipHealth: {
      ...base.relationshipHealth,
      ...(overrides.relationshipHealth ?? {}),
    },
  };
}

function buildModel({ account = createAccount(), opportunities = [], escalations = [] } = {}) {
  return buildRetentionGrowthTabModel({ account, opportunities, escalations });
}

function getKpi(model, label) {
  return model.dashboard.kpis.find((kpi) => kpi.label === label);
}

function assertRule(name, fn) {
  try {
    fn();
    return { name, passed: true };
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}

const checks = [
  () =>
    assertRule("Rule 1 - Model Inputs", () => {
      const model = buildModel();
      assert.ok(model.dashboard);
      assert.ok(Array.isArray(model.currentServices));
      assert.ok(Array.isArray(model.applicableGrowth));
      assert.ok(Array.isArray(model.opportunities));
      assert.ok(Array.isArray(model.notApplicable));
      assert.ok(Array.isArray(model.recommendedOffers));
      assert.ok(Array.isArray(model.retentionSignals));
      assert.ok(Array.isArray(model.growthSignals));
      assert.ok(model.guardrails);
    }),

  () =>
    assertRule("Rule 2 - No Revenue Guessing", () => {
      const model = buildModel({ account: createAccount({ arr: null, contractValue: null }) });
      assert.equal(getKpi(model, "Current Revenue").value, "Not provided");
      assert.equal(model.dashboard.revenueAtRisk, 0);
    }),

  () =>
    assertRule("Rule 3 - Current Revenue", () => {
      const fallbackModel = buildModel({
        account: createAccount({ arr: null, contractValue: 900_000 }),
      });
      const arrModel = buildModel({
        account: createAccount({ arr: 3_600_000, contractValue: 900_000 }),
      });
      assert.equal(getKpi(fallbackModel, "Current Revenue").value, "$900k");
      assert.equal(getKpi(arrModel, "Current Revenue").value, "$3.6M");
    }),

  () =>
    assertRule("Rule 4 - Revenue At Risk", () => {
      const highRiskNoSignal = buildModel({
        account: createAccount({ riskScoring: { score: 5, metrics: [] } }),
      });
      assert.equal(highRiskNoSignal.dashboard.riskLevel, "High");
      assert.equal(highRiskNoSignal.retentionSignals.length, 0);
      assert.equal(highRiskNoSignal.dashboard.revenueAtRisk, 0);

      const highRiskWithSignal = buildModel({
        account: createAccount({ riskScoring: { score: 5, metrics: [] } }),
        escalations: [{ id: "esc-1", priority: "P1", title: "P1 outage" }],
      });
      assert.equal(highRiskWithSignal.dashboard.revenueAtRisk, 1_000_000);

      const mediumRiskWithSignal = buildModel({
        account: createAccount({
          arr: 5_000_000,
          renewalDays: 90,
          relationshipHealth: { score: 7 },
        }),
      });
      assert.equal(mediumRiskWithSignal.dashboard.riskLevel, "Medium");
      assert.ok(mediumRiskWithSignal.retentionSignals.length > 0);
      assert.equal(mediumRiskWithSignal.dashboard.revenueAtRisk, 0);
    }),

  () =>
    assertRule("Rule 5 - Renewal Due", () => {
      const model = buildModel({ account: createAccount({ renewalDays: 42 }) });
      assert.equal(getKpi(model, "Renewal Due").value, "42 days");
      assert.equal(model.dashboard.revenueAtRisk, 1_000_000);
    }),

  () =>
    assertRule("Rule 6 - Retention Health Score", () => {
      const model = buildModel();
      assert.equal(model.dashboard.retentionScore, 97);
      assert.equal(model.dashboard.retentionStatus, "Healthy");
    }),

  () =>
    assertRule("Rule 7 - Retention Risk", () => {
      const oneWarning = buildModel({ account: createAccount({ meetingsPerMonth: 0 }) });
      assert.equal(oneWarning.dashboard.riskLevel, "Low");

      const twoWarnings = buildModel({
        account: createAccount({
          meetingsPerMonth: 0,
          relationshipHealth: { score: 7 },
        }),
      });
      assert.equal(twoWarnings.dashboard.riskLevel, "Medium");

      const critical = buildModel({ account: createAccount({ projectHealth: { score: 5 } }) });
      assert.equal(critical.dashboard.riskLevel, "High");
    }),

  () =>
    assertRule("Rule 8 - Growth Potential Score", () => {
      const model = buildModel({
        account: createAccount({
          whiteSpaceCount: 6,
          growthUpside: 1_000_000,
          meetingsPerMonth: 6,
          retentionGrowth: [
            {
              service: "Managed Kubernetes",
              applicable: true,
              offered: true,
              delivered: true,
              trackingNote: "Stable SLA adoption and savings.",
            },
          ],
        }),
        opportunities: Array.from({ length: 5 }, (_, index) => ({
          id: `opp-${index}`,
          title: `Growth signal ${index}`,
          source: "Pipeline",
          potential: 10_000,
          confidence: "Medium",
          nextStep: "Validate scope",
        })),
      });
      assert.equal(model.dashboard.growthStatus, "High Growth Potential");
      assert.ok(model.dashboard.growthScore >= 75);
    }),

  () =>
    assertRule("Rule 9 - Growth Pipeline", () => {
      const model = buildModel({
        account: createAccount({
          retentionGrowth: [
            { service: "AI Insights", applicable: true, offered: false, delivered: false },
            { service: "Observability", applicable: true, offered: false, delivered: false },
          ],
        }),
        opportunities: [
          {
            id: "ai",
            title: "AI Insights proposal",
            source: "Pipeline",
            potential: 20_000,
            confidence: "Medium",
            nextStep: "Scope pilot",
          },
          {
            id: "obs",
            title: "Observability proposal",
            source: "Pipeline",
            potential: 20_000,
            confidence: "Medium",
            nextStep: "Scope pilot",
          },
        ],
      });
      assert.equal(model.dashboard.growthPipeline, 40_000);
    }),

  () =>
    assertRule("Rule 10 - Retention vs Growth Matrix", () => {
      const model = buildModel({
        account: createAccount({
          health: 0,
          whiteSpaceCount: 6,
          growthUpside: 1_000_000,
          meetingsPerMonth: 6,
        }),
        opportunities: Array.from({ length: 5 }, (_, index) => ({
          id: `opp-${index}`,
          title: `Growth signal ${index}`,
          source: "Pipeline",
          potential: 10_000,
          confidence: "Medium",
          nextStep: "Validate scope",
        })),
      });
      assert.equal(model.dashboard.matrix.quadrant, "Protect & Recover");
    }),

  () =>
    assertRule("Rule 11 - Retention Signals", () => {
      const model = buildModel({
        account: createAccount({ renewalDays: 90 }),
        escalations: [{ id: "esc-1", priority: "P1", title: "P1 incident" }],
      });
      assert.equal(model.retentionSignals[0].level, "High");
      assert.ok(model.retentionSignals.some((signal) => /renewal/i.test(signal.id)));
      assert.ok(model.retentionSignals.some((signal) => /escalation/i.test(signal.id)));
    }),

  () =>
    assertRule("Rule 12 - Growth Signals", () => {
      const model = buildModel({
        opportunities: [
          {
            id: "meeting-1",
            title: "Budget approved for expansion",
            source: "QBR meeting",
            potential: 50_000,
            confidence: "Medium",
            nextStep: "Draft funded proposal",
          },
        ],
      });
      const meetingSignal = model.growthSignals.find(
        (signal) => signal.id === "growth-meeting-meeting-1",
      );
      assert.equal(meetingSignal?.level, "High");
    }),

  () =>
    assertRule("Rule 13 - Applicable Growth", () => {
      const model = buildModel({
        account: createAccount({
          retentionGrowth: [
            { service: "AI Insights", applicable: false, offered: false, delivered: false },
            { service: "AI Insights", applicable: true, offered: false, delivered: false },
            { service: "Observability", applicable: true, offered: true, delivered: false },
          ],
        }),
      });
      assert.equal(model.applicableGrowth.length, 0);
    }),

  () =>
    assertRule("Rule 14 - Current Services", () => {
      const model = buildModel({
        account: createAccount({
          retentionGrowth: [
            { service: "AI Insights", applicable: true, offered: true, delivered: false },
            { service: "Observability", applicable: true, offered: false, delivered: false },
          ],
        }),
      });
      assert.equal(model.currentServices.length, 1);
      assert.equal(model.currentServices[0].status, "In Flight");
    }),

  () =>
    assertRule("Rule 15 - Not Applicable Services", () => {
      const model = buildModel({
        account: createAccount({
          retentionGrowth: [
            { service: "Driver HR module", applicable: false, offered: false, delivered: false },
          ],
        }),
        opportunities: [
          {
            id: "blocked",
            title: "Driver HR module expansion",
            source: "Pipeline",
            potential: 100_000,
            confidence: "High",
            nextStep: "Pitch",
          },
        ],
      });
      assert.equal(model.notApplicable[0].service, "Driver HR module");
      assert.equal(
        model.opportunities.some((item) => /Driver HR module/.test(item.title)),
        false,
      );
    }),

  () =>
    assertRule("Rule 16 - Client Opportunities", () => {
      const retentionModel = buildModel({
        opportunities: [
          {
            id: "retention",
            title: "Renewal recovery plan",
            source: "Pipeline",
            potential: null,
            confidence: "Medium",
            nextStep: "Prepare recovery plan",
          },
        ],
      });
      const retentionOpportunity = retentionModel.opportunities.find(
        (item) => item.id === "client-opp-retention",
      );
      assert.equal(retentionOpportunity?.approvalRequired, true);

      const growthModel = buildModel({
        opportunities: [
          {
            id: "growth",
            title: "Data Lake expansion",
            source: "Pipeline",
            potential: 120_000,
            confidence: "Medium",
            nextStep: "Prepare proposal",
          },
        ],
      });
      assert.equal(growthModel.opportunities[0].approvalRequired, true);
    }),

  () =>
    assertRule("Rule 17 - Recommended Offers", () => {
      const model = buildModel({
        account: createAccount({
          contractType: "Retainer",
          retentionGrowth: [
            { service: "AI Insights", applicable: true, offered: false, delivered: false },
          ],
        }),
        opportunities: [
          {
            id: "meeting-ai",
            title: "AI Insights pilot POC",
            source: "QBR meeting",
            potential: 50_000,
            confidence: "High",
            nextStep: "Scope pilot",
          },
        ],
      });
      const matchingOffers = model.recommendedOffers.filter(
        (offer) => offer.title === "6-week AI Insights POC",
      );
      assert.equal(matchingOffers.length, 1);
    }),

  () =>
    assertRule("Rule 18 - Commercial Guardrails", () => {
      const model = buildModel({
        account: createAccount({
          arr: 3_600_000,
          renewalDays: 45,
          contractType: "Retainer",
        }),
      });
      assert.deepEqual(model.guardrails.limits, {
        pocLimit: 54_000,
        pocWeeks: 6,
        serviceCreditLimit: 28_800,
        discountLimitPct: 5,
        discountLimitValue: 180_000,
        kamDraftLimit: 108_000,
        commercialLimit: 180_000,
      });
      const growthRule = model.guardrails.rules.find((rule) => rule.id === "guardrail-growth");
      assert.equal(growthRule.approverRole, "Head of KAM");
    }),

  () =>
    assertRule("Rule 19 - Dashboard Action Rows", () => {
      const model = buildModel();
      assert.equal(model.dashboard.actionRows.length, 1);
      assert.equal(model.dashboard.actionRows[0].focus, "Maintain");
    }),

  () =>
    assertRule("Rule 20 - Data Quality", () => {
      const model = buildModel({ account: createAccount({ arr: null, contractValue: null }) });
      const arrCheck = model.dashboard.dataQuality.checks.find(
        (check) => check.label === "Revenue / ARR",
      );
      const renewalCheck = model.dashboard.dataQuality.checks.find(
        (check) => check.label === "Renewal date window",
      );
      assert.equal(model.dashboard.dataQuality.status, "Needs data");
      assert.equal(arrCheck.status, "Missing");
      assert.equal(renewalCheck.status, "Ready");

      const freshPortfolio = buildPortfolioStrategyMetrics(
        [
          {
            id: "fresh",
            arr: 1_000_000,
            retentionHealthScore: 80,
            growthPotentialScore: 70,
            retentionGrowthCalculatedAt: new Date().toISOString(),
            status: "healthy",
          },
        ],
        [],
      );
      assert.equal(freshPortfolio.dataQuality.status, "Ready");
      assert.equal(freshPortfolio.dataQuality.confidenceScore, 100);

      const missingPortfolio = buildPortfolioStrategyMetrics(
        [{ id: "missing", retentionGrowthCalculatedAt: null }],
        [],
      );
      assert.equal(missingPortfolio.dataQuality.status, "Needs data");
      assert.ok(missingPortfolio.dataQuality.confidenceScore < 100);
    }),

  () =>
    assertRule("Rule 21 - Forecast GRR", () => {
      const metrics = buildPortfolioRevenueMetrics([
        { arr: 10_000_000, revenueAtRisk: 1_000_000, growthPipelineValue: 0, status: "healthy" },
      ]);
      assert.equal(metrics.forecastGRR, 90);
    }),

  () =>
    assertRule("Rule 22 - Forecast NRR", () => {
      const metrics = buildPortfolioRevenueMetrics([
        {
          arr: 10_000_000,
          revenueAtRisk: 1_000_000,
          growthPipelineValue: 1_500_000,
          status: "healthy",
        },
      ]);
      assert.equal(metrics.forecastNRR, 105);
    }),

  () =>
    assertRule("Rule 23 - Portfolio At Risk", () => {
      const metrics = buildPortfolioRevenueMetrics([
        {
          id: "a",
          arr: 1_000_000,
          revenueAtRisk: 100_000,
          retentionRisk: "Low",
          status: "healthy",
        },
        { id: "b", arr: 1_000_000, revenueAtRisk: 0, retentionRisk: "Medium", status: "healthy" },
        { id: "c", arr: 1_000_000, revenueAtRisk: 50_000, retentionRisk: "Low", status: "healthy" },
        { id: "d", arr: 1_000_000, revenueAtRisk: 0, retentionRisk: "Low" },
      ]);
      assert.equal(metrics.revenueAtRisk, 150_000);
      assert.equal(metrics.atRiskAccountCount, 3);
    }),

  () =>
    assertRule("Rule 24 - Portfolio Growth Pipeline", () => {
      const metrics = buildPortfolioRevenueMetrics([
        {
          arr: 1,
          revenueAtRisk: 0,
          growthPipelineValue: 100_000,
          growthUpside: 80_000,
          status: "healthy",
        },
        {
          arr: 1,
          revenueAtRisk: 0,
          growthPipelineValue: 0,
          growthUpside: 50_000,
          status: "healthy",
        },
      ]);
      assert.equal(metrics.growthPipeline, 150_000);
    }),

  () =>
    assertRule("Rule 25 - Portfolio Quadrants", () => {
      assert.equal(
        getAccountPortfolioQuadrant({
          retentionGrowthQuadrant: "Protect & Recover",
          retentionHealthScore: 100,
          growthPotentialScore: 0,
        }),
        "Protect & Recover",
      );
      assert.equal(
        getAccountPortfolioQuadrant({
          retentionHealthScore: 0,
          health: 100,
          growthPotentialScore: 80,
        }),
        "Protect & Recover",
      );
    }),

  () =>
    assertRule("Rule 26 - Protection Focus", () => {
      const urgent = getPortfolioUrgentAccounts([
        { id: "low", revenueAtRisk: 100_000, retentionRisk: "Low", health: 100, renewalDays: 10 },
        { id: "high", revenueAtRisk: 500_000, retentionRisk: "Low", health: 100, renewalDays: 90 },
        { id: "calculated-low", revenueAtRisk: 0, retentionHealthScore: 40, health: 100 },
        { id: "missing-status-ok", revenueAtRisk: 0, retentionRisk: "Low" },
      ]);
      assert.equal(urgent[0].id, "high");
      assert.ok(urgent.some((account) => account.id === "calculated-low"));
      assert.equal(
        urgent.some((account) => account.id === "missing-status-ok"),
        false,
      );
    }),

  () =>
    assertRule("Rule 27 - Expansion Focus", () => {
      const growth = getPortfolioGrowthAccounts([
        { id: "none", growthPipelineValue: 0, growthUpside: 0 },
        { id: "upside", growthPipelineValue: 0, growthUpside: 75_000 },
      ]);
      assert.equal(growth.length, 1);
      assert.equal(growth[0].id, "upside");
    }),

  () =>
    assertRule("Rule 28 - KAM Pressure", () => {
      const metrics = buildPortfolioStrategyMetrics(
        [
          {
            id: "a",
            assignedKamId: "kam-a",
            arr: 1_000_000,
            revenueAtRisk: 500_000,
            retentionRisk: "Low",
            status: "healthy",
          },
          {
            id: "b",
            assignedKamId: "kam-b",
            arr: 5_000_000,
            revenueAtRisk: 100_000,
            retentionRisk: "High",
            status: "healthy",
          },
        ],
        [
          { id: "kam-a", name: "KAM A" },
          { id: "kam-b", name: "KAM B" },
        ],
      );
      assert.equal(metrics.kamBreakdown[0].id, "kam-a");
    }),

  () =>
    assertRule("Rule 29 - Priority Account Lanes", () => {
      const accounts = [
        {
          id: "retain",
          revenueAtRisk: 500_000,
          retentionRisk: "Low",
          health: 100,
          renewalDays: 90,
        },
        { id: "expand", growthPipelineValue: 100_000, growthUpside: 0 },
      ];
      assert.equal(getPortfolioUrgentAccounts(accounts)[0].id, "retain");
      assert.equal(getPortfolioGrowthAccounts(accounts)[0].id, "expand");
    }),
];

const results = checks.map((check) => check());
console.log(`Retention/Growth rules verified: ${results.length}/${checks.length} passed.`);
