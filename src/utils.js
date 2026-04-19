export function resolveMonthBudget(budgetEntries, monthOverrides, categoryId, year, month) {
  if (monthOverrides && monthOverrides[categoryId] !== undefined) return monthOverrides[categoryId];
  const entries = budgetEntries?.[categoryId] || [];
  if (!entries.length) return null;
  const key = `${year}-${String(month + 1).padStart(2, '0')}`;
  const entry = entries.find(e =>
    e.startDate <= key && (e.endDate === null || e.endDate >= key)
  );
  return entry ? entry.amount : null;
}

export function isIncomeCat(categories, catId) {
  if (!catId) return false;
  const cat = categories.find(c => c.id === catId);
  if (!cat) return false;
  if (cat.isIncome) return true;
  if (cat.parentId) {
    const parent = categories.find(p => p.id === cat.parentId);
    return parent?.isIncome || false;
  }
  return false;
}

export function isCCPaymentCat(categories, catId) {
  if (!catId) return false;
  const cat = categories.find(c => c.id === catId);
  return !!(cat?.isCCPayment);
}

export function resolveMonthIncome(incomeSources, manualLegacy, monthAdjustments, year, month) {
  if (!incomeSources || incomeSources.length === 0) return manualLegacy;
  return incomeSources
    .filter(s => s.active)
    .reduce((sum, source) => {
      const adj = (monthAdjustments || []).find(a => a.sourceId === source.id);
      if (adj) return sum + adj.amount;
      if (source.entries && year !== undefined) {
        const key = `${year}-${String(month + 1).padStart(2, '0')}`;
        const entry = source.entries.find(e =>
          e.startDate <= key && (e.endDate === null || e.endDate >= key)
        );
        return sum + (entry ? entry.amount : 0);
      }
      return sum + (source.amount || 0);
    }, 0);
}

export function getCategorySpend(transactions, categoryId) {
  return (transactions || [])
    .filter(t => t.type === 'expense' && t.category === categoryId)
    .reduce((s, t) => s + t.amount, 0);
}

export function getBudgetStatus(spent, limit) {
  if (limit === null || limit <= 0) return 'none';
  const pct = spent / limit;
  if (pct >= 1) return 'over';
  if (pct >= 0.8) return 'warning';
  return 'under';
}

export function forecastSpend(spent, dayOfMonth, daysInMonth) {
  if (dayOfMonth === 0) return 0;
  return (spent / dayOfMonth) * daysInMonth;
}

export function iterateMonths(startYear, startMonth, endYear, endMonth) {
  const months = [];
  let y = startYear, m = startMonth;
  while (y < endYear || (y === endYear && m <= endMonth)) {
    months.push({ year: y, month: m });
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return months;
}

export function buildForecast(
  year,
  startingBalance,
  incomeSources,
  budgetEntries,
  allTxns,
  allIncomeAdjusts,
  allOverrides,
  categories
) {
  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const forecast = [];
  let cumulativeNet = 0;

  for (let m = 0; m < 12; m++) {
    const key = `${year}-${m}`;
    const txns = allTxns[key] || [];
    const isActual = txns.length > 0;
    const overrides = allOverrides[key] || {};
    const adjustments = allIncomeAdjusts[key] || [];

    const actualIncome = txns
      .filter(t => (t.type === 'income' || isIncomeCat(categories, t.category)) && !isCCPaymentCat(categories, t.category))
      .reduce((s, t) => s + t.amount, 0);
    const actualExpenses = txns
      .filter(t => t.type === 'expense' && !isIncomeCat(categories, t.category) && !isCCPaymentCat(categories, t.category))
      .reduce((s, t) => s + t.amount, 0);

    const plannedIncome = resolveMonthIncome(incomeSources, 0, adjustments, year, m);
    // Sum only top-level (non-child) non-income categories to avoid double-counting
    const plannedExpenses = categories
      .filter(c => !c.parentId && !isIncomeCat(categories, c.id))
      .reduce((s, c) => {
        const limit = resolveMonthBudget(budgetEntries, overrides, c.id, year, m);
        return s + (limit ?? 0);
      }, 0);

    const net = isActual ? actualIncome - actualExpenses : plannedIncome - plannedExpenses;
    cumulativeNet += net;

    forecast.push({
      year,
      month: m,
      label: `${MONTHS_SHORT[m]} ${year}`,
      plannedIncome,
      plannedExpenses,
      actualIncome,
      actualExpenses,
      isActual,
      net,
      runningBalance: startingBalance + cumulativeNet,
    });
  }

  return forecast;
}

export function projectScenario(
  scenario,
  incomeSources,
  budgetEntries,
  allTxns,
  allIncomeAdjusts,
  allOverrides,
  categories
) {
  const months = iterateMonths(scenario.startYear, scenario.startMonth, scenario.endYear, scenario.endMonth);
  const projection = [];
  let cumulativeNet = 0;

  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  months.forEach(({ year, month }, index) => {
    const key = `${year}-${month}`;
    const txns = allTxns[key] || [];
    const isActual = txns.length > 0;

    // 1. Income
    let monthlyIncome = 0;
    // Start with real income sources
    const activeSources = incomeSources.filter(s => s.active);
    const baseKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const resolvedSources = activeSources.map(s => {
      const scenarioChange = scenario.incomeChanges.find(c => c.sourceId === s.id);
      if (scenarioChange) return { ...s, amount: scenarioChange.monthlyAmount };
      if (s.entries) {
        const entry = s.entries.find(e =>
          e.startDate <= baseKey && (e.endDate === null || e.endDate >= baseKey)
        );
        return { ...s, amount: entry ? entry.amount : 0 };
      }
      return s;
    });
    // Add new sources from scenario
    scenario.incomeChanges.filter(c => c.isNew).forEach(c => {
      resolvedSources.push({ id: c.sourceId, label: c.label, amount: c.monthlyAmount });
    });
    monthlyIncome = resolvedSources.reduce((sum, s) => sum + s.amount, 0);

    // 2. Expenses
    let monthlyExpenses = 0;
    if (isActual) {
      monthlyExpenses = txns
        .filter(t => !isIncomeCat(categories, t.category) && !isCCPaymentCat(categories, t.category) && t.type !== 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      // Also add transaction income (not from sources) to projected income
      const txnIncome = txns
        .filter(t => (isIncomeCat(categories, t.category) || t.type === 'income') && !isCCPaymentCat(categories, t.category))
        .reduce((sum, t) => sum + t.amount, 0);
      monthlyIncome += txnIncome;
    } else {
      // Future month: sum of category budget limits
      // categories that have a global budget set
      const budgetedCategories = categories.filter(c => !isIncomeCat(categories, c.id));
      budgetedCategories.forEach(cat => {
        let limit = resolveMonthBudget(budgetEntries, allOverrides[key] || {}, cat.id, year, month);
        
        // Apply scenario categoryChanges
        const scenarioChange = (scenario.categoryChanges || []).find(c => c.categoryId === cat.id);
        if (scenarioChange) {
          limit = scenarioChange.monthlyLimit;
        }

        if (limit !== null) {
          monthlyExpenses += limit;
        }
      });
    }

    // 3. One-off costs
    const oneOffCosts = (scenario.oneOffCosts || [])
      .filter(c => c.month === index)
      .reduce((sum, c) => sum + c.amount, 0);

    // 4. Net
    const net = monthlyIncome - monthlyExpenses - oneOffCosts;

    // 5. CumulativeNet
    cumulativeNet += net;

    // 6. isBelowFloor
    const isBelowFloor = scenario.floorAmount !== undefined && cumulativeNet < scenario.floorAmount;

    projection.push({
      year,
      month,
      label: `${MONTHS_SHORT[month]} ${year}`,
      income: monthlyIncome,
      expenses: monthlyExpenses,
      oneOffCosts,
      net,
      cumulativeNet,
      isBelowFloor,
      isActual
    });
  });

  return projection;
}
