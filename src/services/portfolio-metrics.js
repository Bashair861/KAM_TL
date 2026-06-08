const PORTFOLIO_SCORING_STALE_DAYS = 7;
function getKnownAmount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getKnownFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function getRiskLevel(account) {
  return account.calculatedRetentionRisk ?? account.retentionRisk ?? "Low";
}

function getRiskRank(risk) {
  if (risk === "High") return 3;
  if (risk === "Medium") return 2;
  return 1;
}

function getPortfolioOwnerLabel(ownerId, owner) {
  if (owner?.name) return owner.name;
  if (!ownerId || ownerId === "unassigned") return "Unassigned";
  return "Unknown assigned user";
}

function getPortfolioRetentionHealthValue(account) {
  return getKnownFiniteNumber(account.retentionHealthScore ?? account.health);
}

function hasBadAccountStatus(account) {
  return Boolean(account.status) && account.status !== "healthy";
}

function getDaysSince(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

export function buildPortfolioDataQuality(accounts = []) {
  const total = accounts.length;
  const missingRevenue = accounts.filter((account) => getKnownAmount(account.arr) === 0);
  const missingRetentionScore = accounts.filter(
    (account) => getPortfolioRetentionHealthValue(account) === null,
  );
  const missingGrowthScore = accounts.filter(
    (account) => getKnownFiniteNumber(account.growthPotentialScore) === null,
  );
  const missingSnapshot = accounts.filter((account) => !account.retentionGrowthCalculatedAt);
  const staleSnapshot = accounts.filter((account) => {
    const age = getDaysSince(account.retentionGrowthCalculatedAt);
    return age !== null && age > PORTFOLIO_SCORING_STALE_DAYS;
  });
  const missingCount =
    missingRevenue.length +
    missingRetentionScore.length +
    missingGrowthScore.length +
    missingSnapshot.length;
  const staleCount = staleSnapshot.length;
  const confidenceScore = total
    ? clamp(Math.round(100 - ((missingCount + staleCount) / (total * 4)) * 100))
    : 0;
  const status =
    total === 0
      ? "No accounts"
      : missingCount
        ? "Needs data"
        : staleCount
          ? "Stale review"
          : "Ready";

  return {
    status,
    confidenceScore,
    summary:
      status === "Ready"
        ? "Portfolio scoring inputs are present and fresh."
        : status === "Stale review"
          ? `${staleCount} account${staleCount === 1 ? "" : "s"} need fresh scoring.`
          : status === "Needs data"
            ? `${missingCount} portfolio input${missingCount === 1 ? "" : "s"} missing.`
            : "No accounts available for portfolio scoring.",
    checks: [
      {
        label: "ARR coverage",
        status: missingRevenue.length ? "Needs data" : "Ready",
        affectedAccounts: missingRevenue.length,
        totalAccounts: total,
      },
      {
        label: "Retention score coverage",
        status: missingRetentionScore.length ? "Needs data" : "Ready",
        affectedAccounts: missingRetentionScore.length,
        totalAccounts: total,
      },
      {
        label: "Growth score coverage",
        status: missingGrowthScore.length ? "Needs data" : "Ready",
        affectedAccounts: missingGrowthScore.length,
        totalAccounts: total,
      },
      {
        label: "Scoring freshness",
        status: missingSnapshot.length ? "Needs data" : staleCount ? "Stale review" : "Ready",
        affectedAccounts: missingSnapshot.length + staleCount,
        totalAccounts: total,
      },
    ],
    missingCount,
    staleCount,
  };
}

export function getPortfolioGrowthValue(account) {
  return Math.max(
    getKnownAmount(account.growthPipelineValue),
    getKnownAmount(account.growthUpside),
  );
}

export function getPortfolioUrgentAccounts(accounts = []) {
  return [...accounts]
    .filter((account) => {
      const retentionHealthValue = getPortfolioRetentionHealthValue(account);
      return (
        getKnownAmount(account.revenueAtRisk) > 0 ||
        getRiskLevel(account) !== "Low" ||
        (retentionHealthValue !== null && retentionHealthValue < 75)
      );
    })
    .sort(
      (left, right) =>
        getKnownAmount(right.revenueAtRisk) - getKnownAmount(left.revenueAtRisk) ||
        getRiskRank(getRiskLevel(right)) - getRiskRank(getRiskLevel(left)) ||
        (left.renewalDays ?? Infinity) - (right.renewalDays ?? Infinity),
    );
}

export function getPortfolioGrowthAccounts(accounts = []) {
  return [...accounts]
    .filter((account) => getPortfolioGrowthValue(account) > 0)
    .sort((left, right) => getPortfolioGrowthValue(right) - getPortfolioGrowthValue(left));
}

export function getAccountPortfolioQuadrant(account) {
  if (account.retentionGrowthQuadrant) return account.retentionGrowthQuadrant;

  const retentionHealthValue = getPortfolioRetentionHealthValue(account);
  const retentionHealthy = retentionHealthValue !== null && retentionHealthValue >= 75;
  const growthHigh = getKnownAmount(account.growthPotentialScore) >= 75;

  if (retentionHealthy && growthHigh) return "Expand Aggressively";
  if (!retentionHealthy && growthHigh) return "Protect & Recover";
  if (retentionHealthy && !growthHigh) return "Maintain & Nurture";
  return "Reassess / Monitor";
}

export function buildPortfolioRevenueMetrics(accounts = []) {
  const totalARR = accounts.reduce((total, account) => total + getKnownAmount(account.arr), 0);
  const revenueAtRisk = accounts.reduce(
    (total, account) => total + getKnownAmount(account.revenueAtRisk),
    0,
  );
  const growthPipeline = accounts.reduce(
    (total, account) => total + getPortfolioGrowthValue(account),
    0,
  );
  const retainedARR = Math.max(totalARR - revenueAtRisk, 0);
  const forecastGRR = totalARR ? Math.round((retainedARR / totalARR) * 100) : 0;
  const forecastNRR = totalARR ? Math.round(((retainedARR + growthPipeline) / totalARR) * 100) : 0;
  const atRiskAccounts = accounts.filter(
    (account) =>
      getRiskLevel(account) !== "Low" ||
      getKnownAmount(account.revenueAtRisk) > 0 ||
      hasBadAccountStatus(account),
  );

  return {
    totalARR,
    retainedARR,
    revenueAtRisk,
    growthPipeline,
    forecastGRR,
    forecastNRR,
    atRiskAccounts,
    atRiskAccountCount: atRiskAccounts.length,
    expansionAccountCount: getPortfolioGrowthAccounts(accounts).length,
  };
}

export function buildPortfolioStrategyMetrics(accounts = [], kamUsers = []) {
  const revenue = buildPortfolioRevenueMetrics(accounts);
  const dataQuality = buildPortfolioDataQuality(accounts);
  const quadrantCounts = accounts.reduce((counts, account) => {
    const quadrant = getAccountPortfolioQuadrant(account);
    counts[quadrant] = (counts[quadrant] ?? 0) + 1;
    return counts;
  }, {});
  const kamById = new Map(kamUsers.map((kam) => [kam.id, kam]));
  const kamBreakdown = accounts.reduce((rows, account) => {
    const ownerId = account.assignedKamId ?? "unassigned";
    const owner = kamById.get(ownerId);
    const row = rows.get(ownerId) ?? {
      id: ownerId,
      name: getPortfolioOwnerLabel(ownerId, owner),
      accounts: 0,
      arr: 0,
      revenueAtRisk: 0,
      growthPipeline: 0,
      strugglingAccounts: 0,
    };

    row.accounts += 1;
    row.arr += getKnownAmount(account.arr);
    row.revenueAtRisk += getKnownAmount(account.revenueAtRisk);
    row.growthPipeline += getPortfolioGrowthValue(account);

    const quadrant = getAccountPortfolioQuadrant(account);
    if (
      getRiskLevel(account) !== "Low" ||
      quadrant === "Protect & Recover" ||
      quadrant === "Reassess / Monitor"
    ) {
      row.strugglingAccounts += 1;
    }

    rows.set(ownerId, row);
    return rows;
  }, new Map());

  return {
    ...revenue,
    dataQuality,
    quadrantCounts,
    quadrantRows: [
      "Protect & Recover",
      "Expand Aggressively",
      "Reassess / Monitor",
      "Maintain & Nurture",
    ].map((quadrant) => ({
      quadrant,
      count: quadrantCounts[quadrant] ?? 0,
      accounts: accounts.filter((account) => getAccountPortfolioQuadrant(account) === quadrant),
    })),
    kamBreakdown: [...kamBreakdown.values()].sort(
      (left, right) =>
        right.revenueAtRisk - left.revenueAtRisk ||
        right.strugglingAccounts - left.strugglingAccounts ||
        right.arr - left.arr,
    ),
  };
}
