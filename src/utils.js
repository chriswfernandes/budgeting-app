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
  if (catId === 'cc-payment') return true; // hardcoded system ID — always excluded regardless of state
  const cat = categories.find(c => c.id === catId);
  return !!(cat?.isCCPayment);
}

// Compare an entry's date range against a "YYYY-MM" key.
// Handles both legacy "YYYY-MM" dates and full "YYYY-MM-DD" dates by
// comparing only the first 7 characters (the month part).
function _entryCoversMonth(entry, key) {
  const start = entry.startDate.substring(0, 7);
  const end   = entry.endDate ? entry.endDate.substring(0, 7) : null;
  return start <= key && (end === null || end >= key);
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
        const entry = source.entries.find(e => _entryCoversMonth(e, key));
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

// ── Recurrence engine ─────────────────────────────────────────────────────

function _addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function _fmtDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// First occurrence of dayOfWeek (0=Sun…6=Sat) on or after `date`
function _firstDowOnOrAfter(date, dow) {
  const d = new Date(date);
  const diff = (dow - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

function _lastWeekdayOfMonth(year, month0, weekday) {
  const last = new Date(year, month0 + 1, 0);
  const diff = (last.getDay() - weekday + 7) % 7;
  last.setDate(last.getDate() - diff);
  return last;
}

// ordinalIdx: 0=first, 1=second, 2=third, 3=fourth
function _nthWeekdayOfMonth(year, month0, ordinalIdx, weekday) {
  const first = new Date(year, month0, 1);
  const diff = (weekday - first.getDay() + 7) % 7;
  const result = new Date(year, month0, 1 + diff + ordinalIdx * 7);
  return result.getMonth() === month0 ? result : null;
}

const _ORDINAL_IDX = { first: 0, second: 1, third: 2, fourth: 3 };

// Compute the average monthly equivalent of one occurrence at amountPerOcc
export function computeDerivedMonthlyAmount(rec, amountPerOcc) {
  if (!rec || !rec.enabled) return amountPerOcc;
  const interval = rec.interval || 1;
  switch (rec.type) {
    case 'weekly': return (amountPerOcc * 52 * (rec.daysOfWeek || [5]).length) / (interval * 12);
    case 'daily':  return (amountPerOcc * 365) / (interval * 12);
    case 'monthly': return amountPerOcc / interval;
    case 'yearly':  return amountPerOcc / (interval * 12);
    default: return amountPerOcc;
  }
}

/**
 * Expand an income source entry into projected transactions for a view window.
 *
 * If entry.recurrence is null/disabled → one lump-sum per month (legacy behaviour).
 * If enabled → one entry per occurrence date anchored to period start.
 *
 * Biweekly anchor: first occurrence of the day-of-week on or after period.startDate;
 * subsequent dates are exactly interval×7 days apart (no calendar drift).
 * This ensures adjacent periods never duplicate or gap beyond the expected interval.
 *
 * @param {object} source   Income source object (needs .id, .label)
 * @param {object} entry    Income source entry (startDate, endDate, amount, recurrence)
 * @param {string} viewStart  "YYYY-MM"
 * @param {string} viewEnd    "YYYY-MM"
 * @returns {ProjectedTransaction[]}
 */
export function expandIncomePeriod(source, entry, viewStart, viewEnd) {
  const rec = entry.recurrence;
  const periodStart = entry.startDate;
  const periodEnd = entry.endDate;

  // Clamp period to view window
  const effStart = periodStart > viewStart ? periodStart : viewStart;
  const effEnd = periodEnd
    ? (periodEnd < viewEnd ? periodEnd : viewEnd)
    : viewEnd;

  if (effStart > effEnd) return [];

  // Parse a "YYYY-MM" or "YYYY-MM-DD" string into a local Date safely
  const _parseDate = (s) => {
    const p = s.split('-').map(Number);
    return p.length >= 3 ? new Date(p[0], p[1] - 1, p[2]) : new Date(p[0], p[1] - 1, 1);
  };

  const [esY, esM] = effStart.split('-').map(Number);
  const [eeY, eeM] = effEnd.split('-').map(Number);
  // rangeStart: exact start date (if full date given) or first of start month
  const rangeStart = _parseDate(effStart);
  // rangeEnd: exact end date (if full date given) or last day of end month
  const rangeEnd = effEnd.length >= 10 ? _parseDate(effEnd) : new Date(eeY, eeM, 0);

  // No recurrence: one lump-sum per month
  if (!rec || !rec.enabled) {
    const results = [];
    let y = esY, m = esM;
    while (y < eeY || (y === eeY && m <= eeM)) {
      results.push({
        date: `${y}-${String(m).padStart(2, '0')}-01`,
        amount: entry.amount,
        label: source.label,
        category: 'income',
        isProjected: true,
        isLumpSum: true,
        periodId: entry.id,
        sourceId: source.id,
      });
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return results;
  }

  const amountPerOcc = rec.amountPerOccurrence ?? entry.amount;
  const interval = rec.interval || 1;
  const [psY, psM] = periodStart.split('-').map(Number);
  const dates = [];

  if (rec.type === 'weekly') {
    const dows = rec.daysOfWeek || [5];
    // Anchor from the exact period start date (or first of month for legacy "YYYY-MM" entries)
    const periodFirstDay = _parseDate(periodStart);

    for (const dow of dows) {
      // Anchor: first occurrence of this weekday on or after the period's first day.
      // Advance in interval*7-day steps — maintains exact rhythm, no drift.
      const anchor = _firstDowOnOrAfter(periodFirstDay, dow);
      let cur = new Date(anchor);
      while (cur < rangeStart) cur = _addDays(cur, interval * 7);
      while (cur <= rangeEnd) {
        dates.push(_fmtDate(cur));
        cur = _addDays(cur, interval * 7);
      }
    }

  } else if (rec.type === 'daily') {
    if (rec.isBusinessDay) {
      // Every business day (interval ignored)
      let cur = new Date(rangeStart);
      while (cur <= rangeEnd) {
        if (cur.getDay() !== 0 && cur.getDay() !== 6) dates.push(_fmtDate(cur));
        cur = _addDays(cur, 1);
      }
    } else {
      let cur = new Date(rangeStart);
      while (cur <= rangeEnd) {
        dates.push(_fmtDate(cur));
        cur = _addDays(cur, interval);
      }
    }

  } else if (rec.type === 'monthly') {
    // Anchor to period start month, step by interval months
    let y = psY, m = psM;
    while (y < eeY + 2) {
      if (y > esY || (y === esY && m >= esM)) {
        const month0 = m - 1;
        let occDate = null;
        if (rec.dayOfMonth != null) {
          const cap = new Date(y, month0 + 1, 0).getDate();
          occDate = new Date(y, month0, Math.min(rec.dayOfMonth, cap));
        } else if (rec.ordinalWeekday) {
          const { ordinal, weekday } = rec.ordinalWeekday;
          occDate = ordinal === 'last'
            ? _lastWeekdayOfMonth(y, month0, weekday)
            : _nthWeekdayOfMonth(y, month0, _ORDINAL_IDX[ordinal] ?? 0, weekday);
        } else {
          occDate = new Date(y, month0, 1);
        }
        if (occDate && occDate >= rangeStart && occDate <= rangeEnd) {
          dates.push(_fmtDate(occDate));
        }
        if (y > eeY || (y === eeY && m > eeM)) break;
      }
      m += interval;
      while (m > 12) { m -= 12; y++; }
    }

  } else if (rec.type === 'yearly') {
    for (let y = psY; y <= eeY; y += interval) {
      const month0 = (rec.monthOfYear ?? 1) - 1;
      const occDate = new Date(y, month0, rec.dayOfMonth ?? 1);
      if (occDate >= rangeStart && occDate <= rangeEnd) dates.push(_fmtDate(occDate));
    }
  }

  dates.sort();

  return dates.map(date => ({
    date,
    amount: amountPerOcc,
    label: source.label,
    category: 'income',
    isProjected: true,
    isLumpSum: false,
    periodId: entry.id,
    sourceId: source.id,
  }));
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
        const entry = s.entries.find(e => _entryCoversMonth(e, baseKey));
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
