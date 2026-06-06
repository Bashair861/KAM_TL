function getKnownAmount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getRiskLevel(account) {
  return account.calculatedRetentionRisk ?? account.retentionRisk ?? "Low";
}

export function getAccountPortfolioQuadrant(account) {
  if (account.retentionGrowthQuadrant) return account.retentionGrowthQuadrant;

  const retentionHealthy = getKnownAmount(account.retentionHealthScore || account.health) >= 75;
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
    (total, account) =>
      total +
      Math.max(getKnownAmount(account.growthPipelineValue), getKnownAmount(account.growthUpside)),
    0,
  );
  const retainedARR = Math.max(totalARR - revenueAtRisk, 0);
  const forecastGRR = totalARR ? Math.round((retainedARR / totalARR) * 100) : 0;
  const forecastNRR = totalARR ? Math.round(((retainedARR + growthPipeline) / totalARR) * 100) : 0;
  const atRiskAccounts = accounts.filter(
    (account) =>
      getRiskLevel(account) !== "Low" ||
      getKnownAmount(account.revenueAtRisk) > 0 ||
      account.status !== "healthy",
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
    expansionAccountCount: accounts.filter(
      (account) => getKnownAmount(account.growthPipelineValue || account.growthUpside) > 0,
    ).length,
  };
}

export function buildPortfolioStrategyMetrics(accounts = [], kamUsers = []) {
  const revenue = buildPortfolioRevenueMetrics(accounts);
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
      name: owner?.name ?? "Unassigned",
      accounts: 0,
      arr: 0,
      revenueAtRisk: 0,
      growthPipeline: 0,
      strugglingAccounts: 0,
    };

    row.accounts += 1;
    row.arr += getKnownAmount(account.arr);
    row.revenueAtRisk += getKnownAmount(account.revenueAtRisk);
    row.growthPipeline += Math.max(
      getKnownAmount(account.growthPipelineValue),
      getKnownAmount(account.growthUpside),
    );

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
    quadrantCounts,
    quadrantRows: [
      "Protect & Recover",
      "Expand Aggressively",
      "Maintain & Nurture",
      "Reassess / Monitor",
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
