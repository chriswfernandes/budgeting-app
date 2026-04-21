import { useState, useMemo } from "react";
import { resolveMonthBudget, getBudgetStatus, forecastSpend, resolveMonthIncome, expandIncomePeriod, expandRecurringEntry } from "./utils";

export default function MonthView({
  year, month, data, categories, budgetEntries,
  incomeSources, monthOverrides, incomeAdjustments,
  getcat, onUpdateIncome, onUpdateTxn, onSaveOverride, onSaveIncomeAdjust,
  onDelete, onClearMonth, onImport, onAddManual,
  accountBalance, lastKnownBalance,
}) {
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const [incInput, setIncInput] = useState((data.totalIncome - (data.list.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0))).toString());
  const [editInc, setEditInc] = useState(false);
  const [editIncomeOverrides, setEditIncomeOverrides] = useState(false);
  const [txnViewMode, setTxnViewMode] = useState('actual');

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const projectedIncomeTxns = useMemo(() => {
    const result = [];
    for (const source of (incomeSources || []).filter(s => s.active)) {
      for (const entry of (source.entries || [])) {
        if (entry.recurrence?.enabled) {
          result.push(...expandIncomePeriod(source, entry, monthKey, monthKey));
        }
      }
    }
    return result;
  }, [incomeSources, monthKey]);

  const unfulfilledProjected = useMemo(() => {
    return projectedIncomeTxns.filter(p =>
      !data.list.some(t =>
        t.date === p.date &&
        (t.type === 'income' || t.category === 'income') &&
        Math.abs(t.amount - p.amount) <= 1
      )
    );
  }, [projectedIncomeTxns, data.list]);

  const projectedCatTxns = useMemo(() => {
    const result = [];
    for (const [catId, entries] of Object.entries(budgetEntries)) {
      const cat = categories.find(c => c.id === catId);
      if (!cat) continue;
      const type = cat.isIncome ? 'income' : 'expense';
      for (const entry of (entries || [])) {
        if (entry.recurrence?.enabled) {
          result.push(...expandRecurringEntry(
            { id: catId, label: cat.label, category: catId, type },
            entry, monthKey, monthKey
          ));
        }
      }
    }
    return result;
  }, [budgetEntries, categories, monthKey]);

  const unfulfilledCatProjected = useMemo(() => {
    return projectedCatTxns.filter(p =>
      !data.list.some(t =>
        t.date === p.date &&
        t.category === p.category &&
        Math.abs(t.amount - p.amount) <= 1
      )
    );
  }, [projectedCatTxns, data.list]);

  const [collapsedIds, setCollapsedIds] = useState(new Set());
  const [editingTargetId, setEditingTargetId] = useState(null);
  const [targetInput, setTargetInput] = useState('');
  const [filterCat, setFilterCat] = useState(null);

  const hasUncategorised = data.list.some(t => !t.category);
  const [txnsExpanded, setTxnsExpanded] = useState(hasUncategorised);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [editingRowId, setEditingRowId] = useState(null);
  const [editForm, setEditForm] = useState({ date:'', description:'', amount:'', category:'' });
  const [editingCatId, setEditingCatId] = useState(null);
  const [form, setForm] = useState({ date:'', description:'', amount:'', category: categories[0]?.id || '' });

  const [overridesExpanded, setOverridesExpanded] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const fmt = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Math.abs(n));

  const getRollupTotal = (catId) => {
    const childIds = categories.filter(c => c.parentId === catId).map(c => c.id);
    return data.list.filter(t => t.type === 'expense' && (t.category === catId || childIds.includes(t.category))).reduce((s, t) => s + t.amount, 0);
  };

  const getIncomeCatActual = (catId) => {
    const childIds = categories.filter(c => c.parentId === catId).map(c => c.id);
    return data.list
      .filter(t => t.type === 'income' && (t.category === catId || childIds.includes(t.category)))
      .reduce((s, t) => s + t.amount, 0);
  };

  const getTargetValue = (catId) => resolveMonthBudget(budgetEntries, monthOverrides, catId, year, month);

  const saveInc = () => { onUpdateIncome(parseFloat(incInput) || 0); setEditInc(false); };

  const startEditTarget = (e, catId) => {
    e.stopPropagation();
    setEditingTargetId(catId);
    setTargetInput((getTargetValue(catId) ?? '').toString());
  };

  const saveTargetOverride = () => {
    const val = parseFloat(targetInput);
    const globalVal = resolveMonthBudget(budgetEntries, {}, editingTargetId, year, month);
    const next = { ...monthOverrides };
    if (isNaN(val) || val === globalVal) { delete next[editingTargetId]; }
    else { next[editingTargetId] = val; }
    onSaveOverride(next);
    setEditingTargetId(null);
  };

  const toggleCollapse = (e, id) => {
    e.stopPropagation();
    const next = new Set(collapsedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setCollapsedIds(next);
  };

  const addTxn = () => {
    if (!form.description || !form.amount) return;
    const cat = categories.find(c => c.id === form.category);
    onAddManual({ ...form, amount: parseFloat(form.amount), type: cat?.isIncome ? 'income' : 'expense' });
    setForm({ date:'', description:'', amount:'', category: categories[0]?.id || '' });
    setShowAdd(false);
  };

  const startRowEdit = (t) => {
    setEditingRowId(t.id);
    setEditForm({ date: t.date || '', description: t.description, amount: t.amount.toString(), category: t.category || '' });
  };

  const saveRowEdit = (id) => {
    const cat = categories.find(c => c.id === editForm.category);
    onUpdateTxn(id, { ...editForm, amount: parseFloat(editForm.amount) || 0, type: cat?.isIncome ? 'income' : 'expense' });
    setEditingRowId(null);
  };

  const changeCatQuick = (txnId, newCatId) => {
    const cat = categories.find(c => c.id === newCatId);
    onUpdateTxn(txnId, { category: newCatId, type: cat?.isIncome ? 'income' : 'expense' });
    setEditingCatId(null);
  };

  const parents = categories.filter(c => !c.parentId && !c.isIncome && !c.isCCPayment);
  const incomeParents = categories.filter(c => !c.parentId && c.isIncome && !c.isCCPayment);

  const overBudgetCategories = categories.filter(c => {
    const spent = getRollupTotal(c.id);
    const limit = getTargetValue(c.id);
    return getBudgetStatus(spent, limit) === 'over';
  });

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const dayOfMonth = today.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const forecastWarnings = isCurrentMonth && dayOfMonth >= 7
    ? categories.filter(c => !c.isIncome).filter(c => {
        const spent = getRollupTotal(c.id);
        const limit = getTargetValue(c.id);
        if (!limit) return false;
        return forecastSpend(spent, dayOfMonth, daysInMonth) > limit;
      }).map(c => {
        const spent = getRollupTotal(c.id);
        const limit = getTargetValue(c.id);
        return { category: c, overage: forecastSpend(spent, dayOfMonth, daysInMonth) - limit };
      })
    : [];

  const getSourceAmount = (source) => {
    if (!source.entries) return source.amount || 0;
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    const entry = source.entries.find(e => {
      const start = e.startDate.substring(0, 7);
      const end   = e.endDate ? e.endDate.substring(0, 7) : null;
      return start <= key && (end === null || end >= key);
    });
    return entry ? entry.amount : 0;
  };

  const plannedIncome = resolveMonthIncome(incomeSources, 0, incomeAdjustments, year, month);
  const actualIncome = data.totalIncome;
  const incomeOnTrack = actualIncome >= plannedIncome;
  const hasAnyProjected = projectedIncomeTxns.length > 0 || projectedCatTxns.length > 0;

  const baseTxnList = useMemo(() => {
    if (txnViewMode === 'projected') return [...projectedIncomeTxns, ...projectedCatTxns];
    if (txnViewMode === 'combined') return [...data.list, ...unfulfilledProjected, ...unfulfilledCatProjected];
    return data.list;
  }, [txnViewMode, data.list, projectedIncomeTxns, projectedCatTxns, unfulfilledProjected, unfulfilledCatProjected]);

  const filteredTxns = (filterCat
    ? baseTxnList.filter(t => t.category === filterCat || categories.find(c => c.id === t.category)?.parentId === filterCat)
    : baseTxnList
  ).filter(t => {
    const desc = t.description || t.label || '';
    return desc.toLowerCase().includes(search.toLowerCase()) || t.amount.toString().includes(search);
  });

  const totalBudget = parents.reduce((s, p) => s + (getTargetValue(p.id) ?? 0), 0);
  const totalActual = parents.reduce((s, p) => s + getRollupTotal(p.id), 0);
  const uncatTotal = data.list.filter(t => !t.category && t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const ccPaymentTotal = data.list.filter(t => t.category === 'cc-payment' || categories.find(c => c.id === t.category)?.isCCPayment).reduce((s, t) => s + t.amount, 0);

  const StatusDot = ({ status }) => {
    const dotColor = status === 'over' ? 'var(--color-danger)'
      : status === 'warning' ? 'var(--color-warning)'
      : status === 'under' ? 'var(--color-success)'
      : 'var(--color-border)';
    return <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: dotColor }} />;
  };

  const dash = <span className="opacity-30">—</span>;

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-[26px] font-medium mb-1">{MONTHS[month]} {year}</h1>
      </div>

      {forecastWarnings.length > 0 && (
        <div className="bg-danger-bg border-[0.5px] border-danger rounded-md px-4 py-3 mb-4 text-[13px] text-danger">
          <strong>Spend Forecast:</strong> At your current pace, you're on track to overspend in:{' '}
          {forecastWarnings.map((w, i) => (
            <span key={w.category.id}>
              {w.category.label} (+{fmt(w.overage)} projected over){i < forecastWarnings.length - 1 ? ' · ' : ''}
            </span>
          ))}
        </div>
      )}

      <div className={`grid ${overBudgetCategories.length > 0 ? 'grid-cols-4' : 'grid-cols-3'} gap-3 mb-7`}>
        <div className="card px-5 py-4">
          <div className="flex justify-between mb-2.5">
            <p className="text-[11px] text-muted uppercase tracking-[0.06em]">Income</p>
            {incomeSources.length > 0 ? (
              <button onClick={() => setEditIncomeOverrides(!editIncomeOverrides)} className="bg-transparent border-0 text-muted cursor-pointer text-xs">
                {editIncomeOverrides ? 'Close' : 'Edit overrides ▾'}
              </button>
            ) : (
              <button onClick={() => setEditInc(!editInc)} className="bg-transparent border-0 text-muted cursor-pointer text-xs">{editInc ? 'X' : 'Edit'}</button>
            )}
          </div>
          {incomeSources.length > 0 ? (
            editIncomeOverrides ? (
              <div className="flex flex-col gap-2">
                {incomeSources.map(s => {
                  const adj = incomeAdjustments.find(a => a.sourceId === s.id);
                  return (
                    <div key={s.id} className="flex items-center gap-2">
                      <div className="flex-1">
                        <p className="text-xs font-medium">{s.label}</p>
                        <p className="text-[10px] text-muted">Planned: {fmt(getSourceAmount(s))}</p>
                      </div>
                      <input className="input-field !w-[80px] !py-1 !px-2 !text-xs" placeholder={getSourceAmount(s).toString()} value={adj ? adj.amount.toString() : ''}
                        onChange={e => {
                          const valStr = e.target.value;
                          const otherAdjs = incomeAdjustments.filter(a => a.sourceId !== s.id);
                          onSaveIncomeAdjust(valStr === '' ? otherAdjs : [...otherAdjs, { sourceId: s.id, amount: parseFloat(valStr) || 0 }]);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                <p className="text-[26px] font-medium font-mono text-success">{fmt(data.totalIncome)}</p>
                <div className="mt-2 pt-2 border-t-[0.5px] border-border-subtle">
                  {incomeSources.filter(s => s.active).map(s => {
                    const adj = incomeAdjustments.find(a => a.sourceId === s.id);
                    return (
                      <div key={s.id} className="flex justify-between text-[11px] text-muted mb-0.5">
                        <span>{s.label}</span>
                        <span>{fmt(adj ? adj.amount : getSourceAmount(s))}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )
          ) : (
            editInc
              ? <div className="flex gap-1.5"><input className="input-field" value={incInput} onChange={e => setIncInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveInc()} autoFocus /><button className="btn-primary py-1.5 px-2.5" onClick={saveInc}>Save</button></div>
              : <p className="text-[26px] font-medium font-mono text-success">{fmt(data.totalIncome)}</p>
          )}
        </div>

        <div className="card px-5 py-4">
          <p className="text-[11px] text-muted uppercase tracking-[0.06em] mb-2.5">Expenses</p>
          <p className="text-[26px] font-medium font-mono text-danger">-{fmt(data.expenses)}</p>
        </div>

        <div className="card px-5 py-4">
          <p className="text-[11px] text-muted uppercase tracking-[0.06em] mb-2.5">Net</p>
          <p className={`text-[26px] font-medium font-mono ${data.net >= 0 ? 'text-success' : 'text-danger'}`}>
            {data.net >= 0 ? '+' : '-'}{fmt(data.net)}
          </p>
        </div>

        {overBudgetCategories.length > 0 && (
          <div className="bg-danger-bg border-[0.5px] border-danger rounded-lg px-5 py-4">
            <p className="text-[11px] text-danger uppercase tracking-[0.06em] mb-2.5">Over budget</p>
            <p className="text-[26px] font-medium text-danger">{overBudgetCategories.length} {overBudgetCategories.length === 1 ? 'category' : 'categories'}</p>
            <p className="text-xs text-danger mt-1 overflow-hidden text-ellipsis whitespace-nowrap">
              {overBudgetCategories.map(c => c.label).join(', ')}
            </p>
          </div>
        )}
      </div>

      {(plannedIncome > 0 || projectedIncomeTxns.length > 0) && (
        <div className="card px-4 py-2.5 mb-4 flex items-center gap-4 text-[13px] flex-wrap">
          <span className="text-muted font-medium min-w-[60px]">Income</span>
          {plannedIncome > 0 && <>
            <span className="text-muted">Planned: <span className="font-mono text-text">{fmt(plannedIncome)}</span></span>
            <span className="text-muted">Actual: <span className="font-mono text-success">{fmt(actualIncome)}</span></span>
            <span className={`text-xs font-medium ${incomeOnTrack ? 'text-success' : 'text-danger'}`}>
              {incomeOnTrack ? '✓ On track' : `✗ ${fmt(plannedIncome - actualIncome)} short`}
            </span>
          </>}
          {hasAnyProjected && (
            <div className="ml-auto flex gap-1">
              {['actual','projected','combined'].map(mode => (
                <button key={mode} onClick={() => setTxnViewMode(mode)}
                  className={`px-2.5 py-[3px] text-[11px] rounded-md cursor-pointer border-0 font-sans capitalize ${txnViewMode === mode ? 'bg-text text-surface' : 'bg-raised text-muted'}`}>
                  {mode}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {(accountBalance || lastKnownBalance) && (() => {
        const rec = accountBalance || lastKnownBalance;
        const isThisMonth = !!accountBalance;
        const fmtD = s => { const d = new Date(s); return isNaN(d) ? s : d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }); };
        return (
          <div className="card px-4 py-2.5 mb-4 flex items-center gap-4 text-[13px]">
            <span className={`font-medium ${isThisMonth ? 'text-text' : 'text-muted'}`}>
              {isThisMonth ? 'Account balance' : 'Last recorded balance'}
            </span>
            <span className={`font-mono font-medium ${isThisMonth ? 'text-text' : 'text-muted'}`}>{fmt(rec.balance)}</span>
            <span className="text-xs text-muted">
              from CSV · {fmtD(rec.date)}
              {!isThisMonth && ` · ${MONTHS[new Date(rec.date).getMonth()]}`}
            </span>
          </div>
        );
      })()}

      <div className="card mb-4 overflow-hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-raised border-b-[0.5px] border-border-subtle">
              {['Category','Budget','Actual','Remaining',''].map((h, i) => (
                <th key={i} className={`px-4 py-2.5 font-medium text-[11px] text-muted uppercase tracking-[0.05em] ${h === 'Category' || h === '' ? 'text-left' : 'text-right'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parents.map((p) => {
              const children = categories.filter(c => c.parentId === p.id);
              const total = getRollupTotal(p.id);
              const target = getTargetValue(p.id);
              const status = getBudgetStatus(total, target);
              const diff = target != null ? target - total : null;
              const isCollapsed = collapsedIds.has(p.id);
              const isFiltered = filterCat === p.id;
              const hasData = total > 0 || (target != null && target > 0) || children.some(c => getRollupTotal(c.id) > 0);
              if (!hasData) return null;

              return [
                <tr
                  key={p.id}
                  onClick={() => setFilterCat(filterCat === p.id ? null : p.id)}
                  className={`border-b-[0.5px] border-border-subtle cursor-pointer border-l-2 ${isFiltered ? 'bg-raised border-l-border' : 'border-l-transparent'}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {children.length > 0 && (
                        <button onClick={e => toggleCollapse(e, p.id)} className="bg-transparent border-0 text-muted cursor-pointer p-0 text-[9px] w-3.5 shrink-0">
                          {isCollapsed ? '▶' : '▼'}
                        </button>
                      )}
                      <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: p.color }} />
                      <span className="font-medium">{p.label}</span>
                      {monthOverrides[p.id] !== undefined && (
                        <span className="text-[10px] text-warning ml-1">override</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted">
                    {editingTargetId === p.id ? (
                      <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
                        <input className="input-field !py-[2px] !px-1.5 !text-xs !w-[80px] text-right" value={targetInput} onChange={e => setTargetInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveTargetOverride(); if (e.key === 'Escape') setEditingTargetId(null); }} autoFocus />
                        <button className="btn-primary py-[2px] px-2 text-[11px]" onClick={e => { e.stopPropagation(); saveTargetOverride(); }}>Set</button>
                      </div>
                    ) : (
                      <span onClick={e => startEditTarget(e, p.id)} className="cursor-pointer underline decoration-dotted underline-offset-[3px]" title="Click to set budget">
                        {target != null ? fmt(target) : dash}
                      </span>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${total > 0 ? 'text-text' : 'text-muted'}`}>
                    {total > 0 ? fmt(total) : dash}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {diff != null ? (
                      <span className={`${diff < 0 ? 'text-danger font-medium' : diff === 0 ? 'text-muted' : 'text-success'}`}>
                        {diff < 0 ? `${fmt(diff)} over` : diff === 0 ? 'At limit' : `${fmt(diff)} left`}
                      </span>
                    ) : dash}
                  </td>
                  <td className="px-4 py-3 text-center"><StatusDot status={status} /></td>
                </tr>,

                ...(!isCollapsed ? children.map(c => {
                  const cTotal = getRollupTotal(c.id);
                  const cTarget = getTargetValue(c.id);
                  const cStatus = getBudgetStatus(cTotal, cTarget);
                  const cDiff = cTarget != null ? cTarget - cTotal : null;
                  if (cTotal === 0 && cTarget == null) return null;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setFilterCat(filterCat === c.id ? null : c.id)}
                      className={`border-b-[0.5px] border-border-subtle cursor-pointer bg-raised ${filterCat && filterCat !== c.id && filterCat !== p.id ? 'opacity-50' : ''}`}
                    >
                      <td className="px-4 py-2 pl-[38px]">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0" style={{ background: c.color }} />
                          <span className="text-muted text-xs">{c.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-muted">
                        {editingTargetId === c.id ? (
                          <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
                            <input className="input-field !py-[2px] !px-1.5 !text-[11px] !w-[70px] text-right" value={targetInput} onChange={e => setTargetInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveTargetOverride(); if (e.key === 'Escape') setEditingTargetId(null); }} autoFocus />
                            <button className="btn-primary py-[2px] px-1.5 text-[10px]" onClick={e => { e.stopPropagation(); saveTargetOverride(); }}>Set</button>
                          </div>
                        ) : (
                          <span onClick={e => startEditTarget(e, c.id)} className="cursor-pointer underline decoration-dotted underline-offset-[3px]">
                            {cTarget != null ? fmt(cTarget) : dash}
                          </span>
                        )}
                      </td>
                      <td className={`px-4 py-2 text-right font-mono text-xs ${cTotal > 0 ? 'text-text' : 'text-muted'}`}>
                        {cTotal > 0 ? fmt(cTotal) : dash}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs">
                        {cDiff != null ? (
                          <span className={cDiff < 0 ? 'text-danger' : 'text-success'}>
                            {cDiff < 0 ? `${fmt(cDiff)} over` : `${fmt(cDiff)} left`}
                          </span>
                        ) : dash}
                      </td>
                      <td className="px-4 py-2 text-center"><StatusDot status={cStatus} /></td>
                    </tr>
                  );
                }).filter(Boolean) : [])
              ];
            })}

            {uncatTotal > 0 && (
              <tr className="border-b-[0.5px] border-border-subtle bg-raised">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full inline-block bg-muted" />
                    <span className="text-muted italic">Uncategorised</span>
                    <button onClick={() => {}} className="bg-transparent border-0 text-info cursor-pointer text-[11px] underline p-0">
                      Classify →
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-muted opacity-30">—</td>
                <td className="px-4 py-3 text-right font-mono text-muted">{fmt(uncatTotal)}</td>
                <td className="px-4 py-3 text-right text-muted opacity-30">—</td>
                <td className="px-4 py-3"></td>
              </tr>
            )}

            {ccPaymentTotal > 0 && (
              <tr className="bg-raised">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#5F7A9E' }} />
                    <span className="text-muted">CC Payments</span>
                    <span className="text-[11px] text-muted italic">excluded from totals</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-muted opacity-30">—</td>
                <td className="px-4 py-3 text-right font-mono text-muted">{fmt(ccPaymentTotal)}</td>
                <td className="px-4 py-3 text-right text-muted opacity-30">—</td>
                <td className="px-4 py-3"></td>
              </tr>
            )}

            {incomeParents.some(p => {
              const children = categories.filter(c => c.parentId === p.id);
              return getIncomeCatActual(p.id) > 0 || getTargetValue(p.id) != null ||
                children.some(c => getIncomeCatActual(c.id) > 0 || getTargetValue(c.id) != null);
            }) && (
              <>
                <tr className="bg-bg border-t-[0.5px] border-border">
                  <td colSpan={5} className="px-4 py-1.5 text-[11px] text-muted uppercase tracking-[0.06em] font-medium">
                    Income
                  </td>
                </tr>
                {incomeParents.flatMap(p => {
                  const children = categories.filter(c => c.parentId === p.id);
                  const pActual = getIncomeCatActual(p.id);
                  const pTarget = getTargetValue(p.id);
                  const childrenHaveData = children.some(c => getIncomeCatActual(c.id) > 0 || getTargetValue(c.id) != null);
                  if (pActual === 0 && pTarget == null && !childrenHaveData) return [];

                  const pDiff = pTarget != null ? pActual - pTarget : null;
                  const pStatusColor = pTarget == null ? 'var(--color-border)'
                    : pActual >= pTarget ? 'var(--color-success)'
                    : 'var(--color-danger)';
                  const isFiltered = filterCat === p.id;

                  const parentRow = (
                    <tr key={p.id} onClick={() => setFilterCat(filterCat === p.id ? null : p.id)}
                      className={`border-b-[0.5px] border-border-subtle cursor-pointer border-l-2 ${isFiltered ? 'bg-raised border-l-border' : 'border-l-transparent'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: p.color }} />
                          <span className="font-medium">{p.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted">
                        {pTarget != null ? fmt(pTarget) : dash}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono ${pActual > 0 ? 'text-success' : 'text-muted'}`}>
                        {pActual > 0 ? fmt(pActual) : dash}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        {pDiff != null ? (
                          <span className={`${pDiff >= 0 ? 'text-success' : 'text-danger font-medium'}`}>
                            {pDiff >= 0 ? `+${fmt(pDiff)}` : `${fmt(pDiff)} short`}
                          </span>
                        ) : dash}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: pStatusColor }} />
                      </td>
                    </tr>
                  );

                  const childRows = children.map(c => {
                    const cActual = getIncomeCatActual(c.id);
                    const cTarget = getTargetValue(c.id);
                    if (cActual === 0 && cTarget == null) return null;
                    const cDiff = cTarget != null ? cActual - cTarget : null;
                    const cStatusColor = cTarget == null ? 'var(--color-border)'
                      : cActual >= cTarget ? 'var(--color-success)'
                      : 'var(--color-danger)';
                    return (
                      <tr key={c.id} onClick={() => setFilterCat(filterCat === c.id ? null : c.id)}
                        className={`border-b-[0.5px] border-border-subtle cursor-pointer bg-raised ${filterCat && filterCat !== c.id && filterCat !== p.id ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-2 pl-[38px]">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0" style={{ background: c.color }} />
                            <span className="text-muted text-xs">{c.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-muted">
                          {cTarget != null ? fmt(cTarget) : dash}
                        </td>
                        <td className={`px-4 py-2 text-right font-mono text-xs ${cActual > 0 ? 'text-success' : 'text-muted'}`}>
                          {cActual > 0 ? fmt(cActual) : dash}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs">
                          {cDiff != null ? (
                            <span className={cDiff >= 0 ? 'text-success' : 'text-danger'}>
                              {cDiff >= 0 ? `+${fmt(cDiff)}` : `${fmt(cDiff)} short`}
                            </span>
                          ) : dash}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: cStatusColor }} />
                        </td>
                      </tr>
                    );
                  }).filter(Boolean);

                  return [parentRow, ...childRows];
                })}
              </>
            )}
          </tbody>

          <tfoot>
            <tr className="border-t-[0.5px] border-border bg-raised">
              <td className="px-4 py-3 font-medium text-[13px]">Total</td>
              <td className="px-4 py-3 text-right font-mono font-medium">
                {totalBudget > 0 ? fmt(totalBudget) : dash}
              </td>
              <td className="px-4 py-3 text-right font-mono font-medium text-danger">
                {fmt(totalActual + uncatTotal)}
              </td>
              <td className="px-4 py-3 text-right font-mono font-medium">
                {totalBudget > 0 ? (
                  <span className={totalBudget - totalActual < 0 ? 'text-danger' : 'text-success'}>
                    {totalBudget - totalActual < 0 ? `${fmt(totalBudget - totalActual)} over` : `${fmt(totalBudget - totalActual)} left`}
                  </span>
                ) : dash}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="card mb-4">
        <div
          onClick={() => setTxnsExpanded(!txnsExpanded)}
          className={`flex items-center justify-between px-4 py-3 cursor-pointer select-none ${txnsExpanded ? 'border-b-[0.5px] border-border-subtle' : ''}`}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-[13px] text-muted inline-block transition-transform duration-150" style={{ transform: txnsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▾</span>
            <span className="text-sm font-medium">Transactions</span>
            <span className="text-xs text-muted">({data.list.length})</span>
            {hasUncategorised && (
              <span className="text-[11px] bg-danger-bg text-danger px-2 py-[2px] rounded-[10px] border-[0.5px] border-danger">
                {data.list.filter(t => !t.category).length} unclassified
              </span>
            )}
          </div>
          <div className="flex gap-2" onClick={e => e.stopPropagation()}>
            <button className="btn-ghost text-xs py-[5px] px-3" onClick={() => { setShowAdd(!showAdd); setTxnsExpanded(true); }}>+ Add</button>
            <div className="dropdown">
              <button className="btn-ghost text-xs py-[5px] px-3">Import CSV</button>
              <div className="dropdown-content">
                <button onClick={() => onImport('checking')}>Checking Account</button>
                <button onClick={() => onImport('credit')}>Credit Card</button>
              </div>
            </div>
            {confirmClear ? (
              <>
                <span className="text-xs text-danger flex items-center">Clear all transactions?</span>
                <button className="btn-ghost text-xs py-[5px] px-3 text-danger" onClick={() => { onClearMonth(); setConfirmClear(false); }}>Confirm</button>
                <button className="btn-ghost text-xs py-[5px] px-2.5" onClick={() => setConfirmClear(false)}>Cancel</button>
              </>
            ) : (
              data.list.length > 0 && <button className="btn-ghost text-xs py-[5px] px-3 text-danger" onClick={() => setConfirmClear(true)}>Clear data</button>
            )}
          </div>
        </div>

        {txnsExpanded && (
          <div className="px-4 py-3">
            {showAdd && (
              <div className="bg-raised border-[0.5px] border-border-subtle rounded-md p-3 mb-3">
                <div className="grid gap-2 mb-2" style={{ gridTemplateColumns: '140px 1fr 120px' }}>
                  <input className="input-field" placeholder="Date (YYYY-MM-DD)" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                  <input className="input-field" placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                  <input className="input-field" placeholder="Amount" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div className="flex gap-2">
                  <select className="input-field flex-1" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.parentId ? '↳ ' + c.label : c.label}</option>)}
                  </select>
                  <button className="btn-primary" onClick={addTxn}>Add</button>
                  <button className="btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mb-3">
              <input className="input-field flex-1 !py-1.5 !text-[13px]" placeholder="Search transactions..." value={search} onChange={e => setSearch(e.target.value)} />
              {filterCat && (
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <span>Filtered: {getcat(filterCat).label}</span>
                  <button onClick={() => setFilterCat(null)} className="bg-transparent border-0 text-muted cursor-pointer text-xs underline p-0">clear</button>
                </div>
              )}
              <span className="text-xs text-muted whitespace-nowrap">{filteredTxns.length} txns</span>
            </div>

            {filteredTxns.length === 0 ? (
              <p className="text-[13px] text-muted italic py-2">No transactions{search ? ' matching search' : ''}.</p>
            ) : (
              <div className="card overflow-hidden">
                {[...filteredTxns].sort((a, b) => (a.date || '').localeCompare(b.date || '')).map((t, i, arr) => {
                  const isProjected = !!t.isProjected;
                  const c = getcat(t.category);
                  const isEditingRow = editingRowId === t.id;
                  const isEditingCat = editingCatId === t.id;
                  return (
                    <div
                      key={t.id || `proj-${t.periodId}-${t.date}`}
                      className={`flex items-center gap-3 px-4 py-3 ${isProjected ? 'bg-raised opacity-[0.72]' : 'txn-row'}`}
                      style={{ borderBottom: i < arr.length - 1 ? (isProjected ? '1px dashed var(--color-border)' : '0.5px solid var(--color-border-subtle)') : 'none' }}
                    >
                      <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ background: c.color }} />
                      <div className="flex-1 min-w-0">
                        {isEditingRow ? (
                          <div className="grid gap-2 items-center" style={{ gridTemplateColumns: '100px 1fr 100px 1fr' }}>
                            <input className="input-field !text-xs !py-[3px] !px-1.5" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} />
                            <input className="input-field !text-xs !py-[3px] !px-1.5" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
                            <input className="input-field !text-xs !py-[3px] !px-1.5" type="number" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })} />
                            <select className="input-field !text-xs !py-[3px] !px-1.5" value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}>
                              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.parentId ? '↳ ' + cat.label : cat.label}</option>)}
                            </select>
                          </div>
                        ) : (
                          <>
                            <p className={`text-sm overflow-hidden text-ellipsis whitespace-nowrap ${isProjected ? 'italic text-muted' : 'text-text'}`}>
                              {isProjected ? t.label : t.description}
                            </p>
                            <div className="flex items-center gap-1.5">
                              {isEditingCat && !isProjected ? (
                                <div className="flex gap-1 mt-1">
                                  <select className="input-field !py-[2px] !px-1.5 !text-[11px] !w-auto" value={t.category || ''} onChange={e => changeCatQuick(t.id, e.target.value)}>
                                    <option value="" disabled>Select...</option>
                                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.parentId ? '↳ ' + cat.label : cat.label}</option>)}
                                  </select>
                                  <button className="btn-ghost py-[2px] px-1.5 text-[11px]" onClick={() => setEditingCatId(null)}>✕</button>
                                </div>
                              ) : (
                                <p className={`text-xs text-muted ${isProjected ? 'cursor-default' : 'cursor-pointer'}`}
                                  onClick={() => !isProjected && setEditingCatId(t.id)}>
                                  {t.date ? t.date + ' · ' : ''}<span className={isProjected ? '' : 'underline'}>{c.label}</span>
                                </p>
                              )}
                              {!isProjected && t.account && !isEditingCat && (
                                <span className="text-[9px] bg-raised px-[5px] py-[1px] rounded-[10px] text-muted uppercase">{t.account}</span>
                              )}
                              {isProjected && (
                                <span className="text-[9px] bg-info-bg text-info px-1.5 py-[1px] rounded-lg border-[0.5px] border-info">projected</span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                      {!isEditingRow && (
                        <span className={`font-mono text-[15px] shrink-0 ${t.type === 'income' ? 'text-success' : 'text-text'}`}>
                          {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                        </span>
                      )}
                      {!isProjected && (
                        <div className="flex gap-2">
                          {isEditingRow ? (
                            <>
                              <button className="btn-primary py-1 px-3 text-xs" onClick={() => saveRowEdit(t.id)}>Save</button>
                              <button className="btn-ghost py-1 px-3 text-xs" onClick={() => setEditingRowId(null)}>✕</button>
                            </>
                          ) : (
                            <>
                              <button className="btn-ghost py-1 px-2 text-[11px]" onClick={() => startRowEdit(t)}>Edit</button>
                              <button className="btn-ghost py-1 px-2 text-[11px] text-danger" onClick={() => onDelete(t.id)}>✕</button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card mb-4">
        <div
          onClick={() => setOverridesExpanded(!overridesExpanded)}
          className={`flex items-center justify-between px-4 py-3 cursor-pointer select-none ${overridesExpanded ? 'border-b-[0.5px] border-border-subtle' : ''}`}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-[13px] text-muted inline-block transition-transform duration-150" style={{ transform: overridesExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▾</span>
            <span className="text-sm font-medium">Budget overrides for {MONTHS[month]}</span>
            {Object.keys(monthOverrides).length > 0 && (
              <span className="text-[11px] bg-info-bg text-info px-2 py-[2px] rounded-[10px]">
                {Object.keys(monthOverrides).length} active
              </span>
            )}
          </div>
          <span className="text-xs text-muted">{overridesExpanded ? 'Collapse' : 'Expand'}</span>
        </div>

        {overridesExpanded && (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left border-b-[0.5px] border-border-subtle bg-raised">
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Global limit</th>
                <th className="px-4 py-2.5 font-medium">This month</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {categories.filter(c => resolveMonthBudget(budgetEntries, {}, c.id, year, month) !== null).map(c => {
                const globalLimit = resolveMonthBudget(budgetEntries, {}, c.id, year, month);
                const override = monthOverrides[c.id];
                return (
                  <tr key={c.id} className="border-b-[0.5px] border-border-subtle last:border-b-0">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: c.color }} />
                        {c.label}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted font-mono">{fmt(globalLimit)}</td>
                    <td className="px-4 py-2.5">
                      <input className="input-field !w-[100px] !py-1 !px-2" type="number"
                        value={override !== undefined ? override : globalLimit}
                        onChange={e => {
                          const val = parseFloat(e.target.value);
                          const next = { ...monthOverrides };
                          if (isNaN(val) || val === globalLimit) { delete next[c.id]; }
                          else { next[c.id] = val; }
                          onSaveOverride(next);
                        }}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      {override !== undefined && <span className="text-[11px] text-warning font-medium">Override active</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {override !== undefined && (
                        <button onClick={() => { const next = { ...monthOverrides }; delete next[c.id]; onSaveOverride(next); }}
                          title="Reset to global" className="bg-transparent border-0 cursor-pointer text-base text-muted">↩</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
