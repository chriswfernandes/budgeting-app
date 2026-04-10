export function resolveMonthBudget(globalBudgets, monthOverrides, categoryId) {
  if (monthOverrides && monthOverrides[categoryId] !== undefined) return monthOverrides[categoryId];
  if (globalBudgets && globalBudgets[categoryId] !== undefined) return globalBudgets[categoryId];
  return null;
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

export function resolveMonthIncome(incomeSources, manualLegacy, monthAdjustments) {
  if (!incomeSources || incomeSources.length === 0) return manualLegacy;
  return incomeSources
    .filter(s => s.active)
    .reduce((sum, source) => {
      const adj = (monthAdjustments || []).find(a => a.sourceId === source.id);
      return sum + (adj ? adj.amount : source.amount);
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

export function projectScenario(
  scenario,
  incomeSources,
  globalBudgets,
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
    const resolvedSources = activeSources.map(s => {
      const scenarioChange = scenario.incomeChanges.find(c => c.sourceId === s.id);
      if (scenarioChange) {
        return { ...s, amount: scenarioChange.monthlyAmount };
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
        .filter(t => !isIncomeCat(categories, t.category) && t.type !== 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      
      // Also add transaction income (not from sources) to projected income
      const txnIncome = txns
        .filter(t => isIncomeCat(categories, t.category) || t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      monthlyIncome += txnIncome;
    } else {
      // Future month: sum of category budget limits
      // categories that have a global budget set
      const budgetedCategories = categories.filter(c => !isIncomeCat(categories, c.id));
      budgetedCategories.forEach(cat => {
        let limit = resolveMonthBudget(globalBudgets, allOverrides[key] || {}, cat.id);
        
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
