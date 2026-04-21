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

  // Income tile state
  const [incInput, setIncInput] = useState((data.totalIncome - (data.list.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0))).toString());
  const [editInc, setEditInc] = useState(false);
  const [editIncomeOverrides, setEditIncomeOverrides] = useState(false);
  const [txnViewMode, setTxnViewMode] = useState('actual'); // 'actual' | 'projected' | 'combined'

  // Projected income transactions for this month from recurrence-enabled entries
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

  // Fulfillment suppression: projected entry is fulfilled when an actual income
  // transaction exists on the same date within ±$1 of the projected amount
  const unfulfilledProjected = useMemo(() => {
    return projectedIncomeTxns.filter(p =>
      !data.list.some(t =>
        t.date === p.date &&
        (t.type === 'income' || t.category === 'income') &&
        Math.abs(t.amount - p.amount) <= 1
      )
    );
  }, [projectedIncomeTxns, data.list]);

  // Projected transactions from budget category entries with recurrence (income + expense)
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

  // Category table state
  const [collapsedIds, setCollapsedIds] = useState(new Set());
  const [editingTargetId, setEditingTargetId] = useState(null);
  const [targetInput, setTargetInput] = useState('');
  const [filterCat, setFilterCat] = useState(null);

  // Transactions section state
  const hasUncategorised = data.list.some(t => !t.category);
  const [txnsExpanded, setTxnsExpanded] = useState(hasUncategorised);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [editingRowId, setEditingRowId] = useState(null);
  const [editForm, setEditForm] = useState({ date:'', description:'', amount:'', category:'' });
  const [editingCatId, setEditingCatId] = useState(null);
  const [form, setForm] = useState({ date:'', description:'', amount:'', category: categories[0]?.id || '' });

  // Budget overrides section state
  const [overridesExpanded, setOverridesExpanded] = useState(false);

  // Clear month state
  const [confirmClear, setConfirmClear] = useState(false);

  // ── Helpers ──────────────────────────────────────────────────────────────

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

  // ── Derived values ────────────────────────────────────────────────────────

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

  // Build the base transaction list based on view mode
  const baseTxnList = useMemo(() => {
    if (txnViewMode === 'projected') {
      return [...projectedIncomeTxns, ...projectedCatTxns];
    }
    if (txnViewMode === 'combined') {
      return [...data.list, ...unfulfilledProjected, ...unfulfilledCatProjected];
    }
    return data.list;
  }, [txnViewMode, data.list, projectedIncomeTxns, projectedCatTxns, unfulfilledProjected, unfulfilledCatProjected]);

  const filteredTxns = (filterCat
    ? baseTxnList.filter(t => t.category === filterCat || categories.find(c => c.id === t.category)?.parentId === filterCat)
    : baseTxnList
  ).filter(t => {
    const desc = t.description || t.label || '';
    return desc.toLowerCase().includes(search.toLowerCase()) || t.amount.toString().includes(search);
  });

  // Category table totals
  const totalBudget = parents.reduce((s, p) => s + (getTargetValue(p.id) ?? 0), 0);
  const totalActual = parents.reduce((s, p) => s + getRollupTotal(p.id), 0);
  const uncatTotal = data.list.filter(t => !t.category && t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const ccPaymentTotal = data.list.filter(t => t.category === 'cc-payment' || categories.find(c => c.id === t.category)?.isCCPayment).reduce((s, t) => s + t.amount, 0);

  // ── Status dot component ──────────────────────────────────────────────────

  const StatusDot = ({ status }) => {
    const dotColor = status === 'over' ? 'var(--color-text-danger)'
      : status === 'warning' ? '#EF9F27'
      : status === 'under' ? 'var(--color-text-success)'
      : 'var(--color-border-secondary)';
    return <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, display: 'inline-block', flexShrink: 0 }} />;
  };

  // ── Shared styles ─────────────────────────────────────────────────────────

  const cardStyle = { background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-lg)' };
  const sectionHeaderStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', cursor: 'pointer', userSelect: 'none',
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 4 }}>{MONTHS[month]} {year}</h1>
      </div>

      {/* Forecast warning banner */}
      {forecastWarnings.length > 0 && (
        <div style={{ background: 'var(--color-background-danger)', border: '0.5px solid var(--color-text-danger)', borderRadius: 'var(--border-radius-md)', padding: '12px 16px', marginBottom: 16, fontSize: 13, color: 'var(--color-text-danger)' }}>
          <strong>Spend Forecast:</strong> At your current pace, you're on track to overspend in:{' '}
          {forecastWarnings.map((w, i) => (
            <span key={w.category.id}>
              {w.category.label} (+{fmt(w.overage)} projected over){i < forecastWarnings.length - 1 ? ' · ' : ''}
            </span>
          ))}
        </div>
      )}

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${overBudgetCategories.length > 0 ? 4 : 3}, 1fr)`, gap: 12, marginBottom: 28 }}>
        {/* Income tile */}
        <div style={{ ...cardStyle, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Income</p>
            {incomeSources.length > 0 ? (
              <button onClick={() => setEditIncomeOverrides(!editIncomeOverrides)} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 12 }}>
                {editIncomeOverrides ? 'Close' : 'Edit overrides ▾'}
              </button>
            ) : (
              <button onClick={() => setEditInc(!editInc)} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 12 }}>{editInc ? 'X' : 'Edit'}</button>
            )}
          </div>
          {incomeSources.length > 0 ? (
            editIncomeOverrides ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {incomeSources.map(s => {
                  const adj = incomeAdjustments.find(a => a.sourceId === s.id);
                  return (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 12, fontWeight: 500 }}>{s.label}</p>
                        <p style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>Planned: {fmt(getSourceAmount(s))}</p>
                      </div>
                      <input className="input-f" style={{ width: 80, padding: '4px 8px', fontSize: 12 }} placeholder={getSourceAmount(s).toString()} value={adj ? adj.amount.toString() : ''}
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
                <p style={{ fontSize: 26, fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--color-text-success)' }}>{fmt(data.totalIncome)}</p>
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '0.5px solid var(--color-border-tertiary)' }}>
                  {incomeSources.filter(s => s.active).map(s => {
                    const adj = incomeAdjustments.find(a => a.sourceId === s.id);
                    return (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 2 }}>
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
              ? <div style={{ display: 'flex', gap: 6 }}><input className="input-f" value={incInput} onChange={e => setIncInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveInc()} autoFocus /><button className="btn-p" style={{ padding: '6px 10px' }} onClick={saveInc}>Save</button></div>
              : <p style={{ fontSize: 26, fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--color-text-success)' }}>{fmt(data.totalIncome)}</p>
          )}
        </div>

        {/* Expenses tile */}
        <div style={{ ...cardStyle, padding: '16px 20px' }}>
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Expenses</p>
          <p style={{ fontSize: 26, fontWeight: 500, fontFamily: 'var(--font-mono)', color: 'var(--color-text-danger)' }}>-{fmt(data.expenses)}</p>
        </div>

        {/* Net tile */}
        <div style={{ ...cardStyle, padding: '16px 20px' }}>
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Net</p>
          <p style={{ fontSize: 26, fontWeight: 500, fontFamily: 'var(--font-mono)', color: data.net >= 0 ? 'var(--color-text-success)' : 'var(--color-text-danger)' }}>
            {data.net >= 0 ? '+' : '-'}{fmt(data.net)}
          </p>
        </div>

        {/* Over-budget tile */}
        {overBudgetCategories.length > 0 && (
          <div style={{ background: 'var(--color-background-danger)', border: '0.5px solid var(--color-text-danger)', borderRadius: 'var(--border-radius-lg)', padding: '16px 20px' }}>
            <p style={{ fontSize: 11, color: 'var(--color-text-danger)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Over budget</p>
            <p style={{ fontSize: 26, fontWeight: 500, color: 'var(--color-text-danger)' }}>{overBudgetCategories.length} {overBudgetCategories.length === 1 ? 'category' : 'categories'}</p>
            <p style={{ fontSize: 12, color: 'var(--color-text-danger)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {overBudgetCategories.map(c => c.label).join(', ')}
            </p>
          </div>
        )}
      </div>

      {/* ── Income plan vs actual row ── */}
      {(plannedIncome > 0 || projectedIncomeTxns.length > 0) && (
        <div style={{ ...cardStyle, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500, minWidth: 60 }}>Income</span>
          {plannedIncome > 0 && <>
            <span style={{ color: 'var(--color-text-secondary)' }}>Planned: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>{fmt(plannedIncome)}</span></span>
            <span style={{ color: 'var(--color-text-secondary)' }}>Actual: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-success)' }}>{fmt(actualIncome)}</span></span>
            <span style={{ fontSize: 12, color: incomeOnTrack ? 'var(--color-text-success)' : 'var(--color-text-danger)', fontWeight: 500 }}>
              {incomeOnTrack ? '✓ On track' : `✗ ${fmt(plannedIncome - actualIncome)} short`}
            </span>
          </>}
          {hasAnyProjected && (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              {['actual','projected','combined'].map(mode => (
                <button key={mode} onClick={() => setTxnViewMode(mode)}
                  style={{
                    padding: '3px 10px', fontSize: 11, borderRadius: 6, cursor: 'pointer', border: 'none',
                    fontFamily: 'var(--font-sans)', textTransform: 'capitalize',
                    background: txnViewMode === mode ? 'var(--color-text-primary)' : 'var(--color-background-secondary)',
                    color: txnViewMode === mode ? 'var(--color-background-primary)' : 'var(--color-text-secondary)',
                  }}>
                  {mode}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Account balance row ── */}
      {(accountBalance || lastKnownBalance) && (() => {
        const rec = accountBalance || lastKnownBalance;
        const isThisMonth = !!accountBalance;
        const fmtDate = s => { const d = new Date(s); return isNaN(d) ? s : d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }); };
        return (
          <div style={{ ...cardStyle, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, fontSize: 13 }}>
            <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>
              {isThisMonth ? 'Account balance' : 'Last recorded balance'}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: isThisMonth ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
              {fmt(rec.balance)}
            </span>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              from CSV · {fmtDate(rec.date)}
              {!isThisMonth && ` · ${MONTHS[new Date(rec.date).getMonth()]}`}
            </span>
          </div>
        );
      })()}

      {/* ── Category Budget Summary Table ── */}
      <div style={{ ...cardStyle, marginBottom: 16, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--color-background-secondary)', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
              <th style={{ padding: '10px 16px', fontWeight: 500, textAlign: 'left', color: 'var(--color-text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</th>
              <th style={{ padding: '10px 16px', fontWeight: 500, textAlign: 'right', color: 'var(--color-text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Budget</th>
              <th style={{ padding: '10px 16px', fontWeight: 500, textAlign: 'right', color: 'var(--color-text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actual</th>
              <th style={{ padding: '10px 16px', fontWeight: 500, textAlign: 'right', color: 'var(--color-text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Remaining</th>
              <th style={{ padding: '10px 16px', width: 32 }}></th>
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
                // Parent row
                <tr
                  key={p.id}
                  onClick={() => setFilterCat(filterCat === p.id ? null : p.id)}
                  style={{
                    borderBottom: '0.5px solid var(--color-border-tertiary)',
                    cursor: 'pointer',
                    background: isFiltered ? 'var(--color-background-secondary)' : 'transparent',
                    borderLeft: isFiltered ? '2px solid var(--color-border-primary)' : '2px solid transparent',
                  }}
                >
                  <td style={{ padding: '11px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {children.length > 0 && (
                        <button onClick={e => toggleCollapse(e, p.id)} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', padding: 0, fontSize: 9, width: 14, flexShrink: 0 }}>
                          {isCollapsed ? '▶' : '▼'}
                        </button>
                      )}
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontWeight: 500 }}>{p.label}</span>
                      {monthOverrides[p.id] !== undefined && (
                        <span style={{ fontSize: 10, color: '#EF9F27', marginLeft: 4 }}>override</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                    {editingTargetId === p.id ? (
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                        <input className="input-f" style={{ padding: '2px 6px', fontSize: 12, width: 80, textAlign: 'right' }} value={targetInput} onChange={e => setTargetInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveTargetOverride(); if (e.key === 'Escape') setEditingTargetId(null); }} autoFocus />
                        <button className="btn-p" style={{ padding: '2px 8px', fontSize: 11 }} onClick={e => { e.stopPropagation(); saveTargetOverride(); }}>Set</button>
                      </div>
                    ) : (
                      <span onClick={e => startEditTarget(e, p.id)} style={{ cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 }} title="Click to set budget">
                        {target != null ? fmt(target) : <span style={{ color: 'var(--color-border-secondary)' }}>—</span>}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: total > 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                    {total > 0 ? fmt(total) : <span style={{ color: 'var(--color-border-secondary)' }}>—</span>}
                  </td>
                  <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    {diff != null ? (
                      <span style={{ color: diff < 0 ? 'var(--color-text-danger)' : diff === 0 ? 'var(--color-text-secondary)' : 'var(--color-text-success)', fontWeight: diff < 0 ? 500 : 400 }}>
                        {diff < 0 ? `${fmt(diff)} over` : diff === 0 ? 'At limit' : `${fmt(diff)} left`}
                      </span>
                    ) : <span style={{ color: 'var(--color-border-secondary)' }}>—</span>}
                  </td>
                  <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                    <StatusDot status={status} />
                  </td>
                </tr>,

                // Child rows
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
                      style={{
                        borderBottom: '0.5px solid var(--color-border-tertiary)',
                        cursor: 'pointer',
                        background: filterCat === c.id ? 'var(--color-background-secondary)' : 'var(--color-background-secondary)',
                        opacity: filterCat && filterCat !== c.id && filterCat !== p.id ? 0.5 : 1,
                      }}
                    >
                      <td style={{ padding: '8px 16px 8px 38px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color, display: 'inline-block', flexShrink: 0 }} />
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>{c.label}</span>
                        </div>
                      </td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                        {editingTargetId === c.id ? (
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                            <input className="input-f" style={{ padding: '2px 6px', fontSize: 11, width: 70, textAlign: 'right' }} value={targetInput} onChange={e => setTargetInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveTargetOverride(); if (e.key === 'Escape') setEditingTargetId(null); }} autoFocus />
                            <button className="btn-p" style={{ padding: '2px 6px', fontSize: 10 }} onClick={e => { e.stopPropagation(); saveTargetOverride(); }}>Set</button>
                          </div>
                        ) : (
                          <span onClick={e => startEditTarget(e, c.id)} style={{ cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
                            {cTarget != null ? fmt(cTarget) : <span style={{ color: 'var(--color-border-secondary)' }}>—</span>}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: cTotal > 0 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                        {cTotal > 0 ? fmt(cTotal) : <span style={{ color: 'var(--color-border-secondary)' }}>—</span>}
                      </td>
                      <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {cDiff != null ? (
                          <span style={{ color: cDiff < 0 ? 'var(--color-text-danger)' : 'var(--color-text-success)' }}>
                            {cDiff < 0 ? `${fmt(cDiff)} over` : `${fmt(cDiff)} left`}
                          </span>
                        ) : <span style={{ color: 'var(--color-border-secondary)' }}>—</span>}
                      </td>
                      <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                        <StatusDot status={cStatus} />
                      </td>
                    </tr>
                  );
                }).filter(Boolean) : [])
              ];
            })}

            {/* Uncategorised row */}
            {uncatTotal > 0 && (
              <tr style={{ borderBottom: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)' }}>
                <td style={{ padding: '11px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#888', display: 'inline-block' }} />
                    <span style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Uncategorised</span>
                    <button
                      onClick={() => { /* navigate to classify — parent handles this via setView */ }}
                      style={{ background: 'none', border: 'none', color: 'var(--color-text-info)', cursor: 'pointer', fontSize: 11, textDecoration: 'underline', padding: 0 }}
                    >
                      Classify →
                    </button>
                  </div>
                </td>
                <td style={{ padding: '11px 16px', textAlign: 'right', color: 'var(--color-border-secondary)' }}>—</td>
                <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{fmt(uncatTotal)}</td>
                <td style={{ padding: '11px 16px', textAlign: 'right', color: 'var(--color-border-secondary)' }}>—</td>
                <td style={{ padding: '11px 16px' }}></td>
              </tr>
            )}
            {/* CC Payment neutral row */}
            {ccPaymentTotal > 0 && (
              <tr style={{ background: 'var(--color-background-secondary)' }}>
                <td style={{ padding: '11px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#5F7A9E', display: 'inline-block' }} />
                    <span style={{ color: 'var(--color-text-secondary)' }}>CC Payments</span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>excluded from totals</span>
                  </div>
                </td>
                <td style={{ padding: '11px 16px', textAlign: 'right', color: 'var(--color-border-secondary)' }}>—</td>
                <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{fmt(ccPaymentTotal)}</td>
                <td style={{ padding: '11px 16px', textAlign: 'right', color: 'var(--color-border-secondary)' }}>—</td>
                <td style={{ padding: '11px 16px' }}></td>
              </tr>
            )}

            {/* Income categories section */}
            {incomeParents.some(p => {
              const children = categories.filter(c => c.parentId === p.id);
              return getIncomeCatActual(p.id) > 0 || getTargetValue(p.id) != null ||
                children.some(c => getIncomeCatActual(c.id) > 0 || getTargetValue(c.id) != null);
            }) && (
              <>
                <tr style={{ background: 'var(--color-background-tertiary)', borderTop: '0.5px solid var(--color-border-secondary)' }}>
                  <td colSpan={5} style={{ padding: '6px 16px', fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
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
                  const pStatusColor = pTarget == null ? 'var(--color-border-secondary)'
                    : pActual >= pTarget ? 'var(--color-text-success)'
                    : 'var(--color-text-danger)';
                  const isFiltered = filterCat === p.id;

                  const parentRow = (
                    <tr key={p.id} onClick={() => setFilterCat(filterCat === p.id ? null : p.id)}
                      style={{ borderBottom: '0.5px solid var(--color-border-tertiary)', cursor: 'pointer',
                        background: isFiltered ? 'var(--color-background-secondary)' : 'transparent',
                        borderLeft: isFiltered ? '2px solid var(--color-border-primary)' : '2px solid transparent' }}>
                      <td style={{ padding: '11px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block', flexShrink: 0 }} />
                          <span style={{ fontWeight: 500 }}>{p.label}</span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                        {pTarget != null ? fmt(pTarget) : <span style={{ color: 'var(--color-border-secondary)' }}>—</span>}
                      </td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: pActual > 0 ? 'var(--color-text-success)' : 'var(--color-text-secondary)' }}>
                        {pActual > 0 ? fmt(pActual) : <span style={{ color: 'var(--color-border-secondary)' }}>—</span>}
                      </td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {pDiff != null ? (
                          <span style={{ color: pDiff >= 0 ? 'var(--color-text-success)' : 'var(--color-text-danger)', fontWeight: pDiff < 0 ? 500 : 400 }}>
                            {pDiff >= 0 ? `+${fmt(pDiff)}` : `${fmt(pDiff)} short`}
                          </span>
                        ) : <span style={{ color: 'var(--color-border-secondary)' }}>—</span>}
                      </td>
                      <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: pStatusColor, display: 'inline-block' }} />
                      </td>
                    </tr>
                  );

                  const childRows = children.map(c => {
                    const cActual = getIncomeCatActual(c.id);
                    const cTarget = getTargetValue(c.id);
                    if (cActual === 0 && cTarget == null) return null;
                    const cDiff = cTarget != null ? cActual - cTarget : null;
                    const cStatusColor = cTarget == null ? 'var(--color-border-secondary)'
                      : cActual >= cTarget ? 'var(--color-text-success)'
                      : 'var(--color-text-danger)';
                    return (
                      <tr key={c.id} onClick={() => setFilterCat(filterCat === c.id ? null : c.id)}
                        style={{ borderBottom: '0.5px solid var(--color-border-tertiary)', cursor: 'pointer',
                          background: 'var(--color-background-secondary)',
                          opacity: filterCat && filterCat !== c.id && filterCat !== p.id ? 0.5 : 1 }}>
                        <td style={{ padding: '8px 16px 8px 38px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.color, display: 'inline-block', flexShrink: 0 }} />
                            <span style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>{c.label}</span>
                          </div>
                        </td>
                        <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                          {cTarget != null ? fmt(cTarget) : <span style={{ color: 'var(--color-border-secondary)' }}>—</span>}
                        </td>
                        <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: cActual > 0 ? 'var(--color-text-success)' : 'var(--color-text-secondary)' }}>
                          {cActual > 0 ? fmt(cActual) : <span style={{ color: 'var(--color-border-secondary)' }}>—</span>}
                        </td>
                        <td style={{ padding: '8px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                          {cDiff != null ? (
                            <span style={{ color: cDiff >= 0 ? 'var(--color-text-success)' : 'var(--color-text-danger)' }}>
                              {cDiff >= 0 ? `+${fmt(cDiff)}` : `${fmt(cDiff)} short`}
                            </span>
                          ) : <span style={{ color: 'var(--color-border-secondary)' }}>—</span>}
                        </td>
                        <td style={{ padding: '8px 16px', textAlign: 'center' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: cStatusColor, display: 'inline-block' }} />
                        </td>
                      </tr>
                    );
                  }).filter(Boolean);

                  return [parentRow, ...childRows];
                })}
              </>
            )}
          </tbody>

          {/* Total row */}
          <tfoot>
            <tr style={{ borderTop: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)' }}>
              <td style={{ padding: '11px 16px', fontWeight: 500, fontSize: 13 }}>Total</td>
              <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                {totalBudget > 0 ? fmt(totalBudget) : <span style={{ color: 'var(--color-border-secondary)' }}>—</span>}
              </td>
              <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--color-text-danger)' }}>
                {fmt(totalActual + uncatTotal)}
              </td>
              <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                {totalBudget > 0 ? (
                  <span style={{ color: totalBudget - totalActual < 0 ? 'var(--color-text-danger)' : 'var(--color-text-success)' }}>
                    {totalBudget - totalActual < 0 ? `${fmt(totalBudget - totalActual)} over` : `${fmt(totalBudget - totalActual)} left`}
                  </span>
                ) : <span style={{ color: 'var(--color-border-secondary)' }}>—</span>}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Transactions section (collapsible) ── */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div
          onClick={() => setTxnsExpanded(!txnsExpanded)}
          style={{ ...sectionHeaderStyle, borderBottom: txnsExpanded ? '0.5px solid var(--color-border-tertiary)' : 'none' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', transition: 'transform 0.15s', display: 'inline-block', transform: txnsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▾</span>
            <span style={{ fontSize: 14, fontWeight: 500 }}>Transactions</span>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>({data.list.length})</span>
            {hasUncategorised && (
              <span style={{ fontSize: 11, background: 'var(--color-background-danger)', color: 'var(--color-text-danger)', padding: '2px 8px', borderRadius: 10, border: '0.5px solid var(--color-text-danger)' }}>
                {data.list.filter(t => !t.category).length} unclassified
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
            <button className="btn-g" style={{ fontSize: 12, padding: '5px 12px' }} onClick={() => { setShowAdd(!showAdd); setTxnsExpanded(true); }}>+ Add</button>
            <div className="dropdown">
              <button className="btn-g" style={{ fontSize: 12, padding: '5px 12px' }}>Import CSV</button>
              <div className="dropdown-content">
                <button onClick={() => onImport('checking')}>Checking Account</button>
                <button onClick={() => onImport('credit')}>Credit Card</button>
              </div>
            </div>
            {confirmClear ? (
              <>
                <span style={{ fontSize: 12, color: 'var(--color-text-danger)', display: 'flex', alignItems: 'center' }}>Clear all transactions?</span>
                <button className="btn-g" style={{ fontSize: 12, padding: '5px 12px', color: 'var(--color-text-danger)' }} onClick={() => { onClearMonth(); setConfirmClear(false); }}>Confirm</button>
                <button className="btn-g" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => setConfirmClear(false)}>Cancel</button>
              </>
            ) : (
              data.list.length > 0 && <button className="btn-g" style={{ fontSize: 12, padding: '5px 12px', color: 'var(--color-text-danger)' }} onClick={() => setConfirmClear(true)}>Clear data</button>
            )}
          </div>
        </div>

        {txnsExpanded && (
          <div style={{ padding: '12px 16px' }}>
            {/* Add transaction form */}
            {showAdd && (
              <div style={{ background: 'var(--color-background-secondary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-md)', padding: 12, marginBottom: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 120px', gap: 8, marginBottom: 8 }}>
                  <input className="input-f" placeholder="Date (YYYY-MM-DD)" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                  <input className="input-f" placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                  <input className="input-f" placeholder="Amount" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select className="input-f" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ flex: 1 }}>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.parentId ? '↳ ' + c.label : c.label}</option>)}
                  </select>
                  <button className="btn-p" onClick={addTxn}>Add</button>
                  <button className="btn-g" onClick={() => setShowAdd(false)}>Cancel</button>
                </div>
              </div>
            )}

            {/* Search + filter bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <input className="input-f" style={{ flex: 1, padding: '6px 12px', fontSize: 13 }} placeholder="Search transactions..." value={search} onChange={e => setSearch(e.target.value)} />
              {filterCat && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  <span>Filtered: {getcat(filterCat).label}</span>
                  <button onClick={() => setFilterCat(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 12, textDecoration: 'underline', padding: 0 }}>clear</button>
                </div>
              )}
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{filteredTxns.length} txns</span>
            </div>

            {/* Transaction list */}
            {filteredTxns.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontStyle: 'italic', padding: '8px 0' }}>No transactions{search ? ' matching search' : ''}.</p>
            ) : (
              <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-md)', overflow: 'hidden' }}>
                {[...filteredTxns].sort((a, b) => (a.date || '').localeCompare(b.date || '')).map((t, i, arr) => {
                  const isProjected = !!t.isProjected;
                  const c = getcat(t.category);
                  const isEditingRow = editingRowId === t.id;
                  const isEditingCat = editingCatId === t.id;
                  const rowBorder = i < arr.length - 1
                    ? (isProjected ? '1px dashed var(--color-border-secondary)' : '0.5px solid var(--color-border-tertiary)')
                    : 'none';
                  return (
                    <div key={t.id || `proj-${t.periodId}-${t.date}`} className={isProjected ? '' : 'txn-row'}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                        borderBottom: rowBorder,
                        opacity: isProjected ? 0.72 : 1,
                        background: isProjected ? 'var(--color-background-secondary)' : undefined,
                      }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.color, display: 'inline-block', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {isEditingRow ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 100px 1fr', gap: 8, alignItems: 'center' }}>
                            <input className="input-f" style={{ fontSize: 12, padding: '3px 6px' }} value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} />
                            <input className="input-f" style={{ fontSize: 12, padding: '3px 6px' }} value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
                            <input className="input-f" style={{ fontSize: 12, padding: '3px 6px' }} type="number" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })} />
                            <select className="input-f" style={{ fontSize: 12, padding: '3px 6px' }} value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}>
                              {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.parentId ? '↳ ' + cat.label : cat.label}</option>)}
                            </select>
                          </div>
                        ) : (
                          <>
                            <p style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: isProjected ? 'italic' : 'normal', color: isProjected ? 'var(--color-text-secondary)' : 'var(--color-text-primary)' }}>
                              {isProjected ? t.label : t.description}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {isEditingCat && !isProjected ? (
                                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                                  <select className="input-f" style={{ padding: '2px 6px', fontSize: 11, width: 'auto' }} value={t.category || ''} onChange={e => changeCatQuick(t.id, e.target.value)}>
                                    <option value="" disabled>Select...</option>
                                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.parentId ? '↳ ' + cat.label : cat.label}</option>)}
                                  </select>
                                  <button className="btn-g" style={{ padding: '2px 6px', fontSize: 11 }} onClick={() => setEditingCatId(null)}>✕</button>
                                </div>
                              ) : (
                                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', cursor: isProjected ? 'default' : 'pointer' }}
                                  onClick={() => !isProjected && setEditingCatId(t.id)}>
                                  {t.date ? t.date + ' · ' : ''}<span style={{ textDecoration: isProjected ? 'none' : 'underline' }}>{c.label}</span>
                                </p>
                              )}
                              {!isProjected && t.account && !isEditingCat && (
                                <span style={{ fontSize: 9, background: 'var(--color-background-secondary)', padding: '1px 5px', borderRadius: 10, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>{t.account}</span>
                              )}
                              {isProjected && (
                                <span style={{ fontSize: 9, background: 'var(--color-background-info)', color: 'var(--color-text-info)', padding: '1px 6px', borderRadius: 8, border: '0.5px solid var(--color-text-info)' }}>projected</span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                      {!isEditingRow && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, color: t.type === 'income' ? 'var(--color-text-success)' : 'var(--color-text-primary)', flexShrink: 0 }}>
                          {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                        </span>
                      )}
                      {!isProjected && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          {isEditingRow ? (
                            <>
                              <button className="btn-p" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => saveRowEdit(t.id)}>Save</button>
                              <button className="btn-g" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => setEditingRowId(null)}>✕</button>
                            </>
                          ) : (
                            <>
                              <button className="btn-g" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => startRowEdit(t)}>Edit</button>
                              <button className="btn-g" style={{ padding: '4px 8px', fontSize: 11, color: 'var(--color-text-danger)' }} onClick={() => onDelete(t.id)}>✕</button>
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

      {/* ── Budget overrides (collapsible) ── */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div
          onClick={() => setOverridesExpanded(!overridesExpanded)}
          style={{ ...sectionHeaderStyle, borderBottom: overridesExpanded ? '0.5px solid var(--color-border-tertiary)' : 'none' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', transition: 'transform 0.15s', display: 'inline-block', transform: overridesExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▾</span>
            <span style={{ fontSize: 14, fontWeight: 500 }}>Budget overrides for {MONTHS[month]}</span>
            {Object.keys(monthOverrides).length > 0 && (
              <span style={{ fontSize: 11, background: 'var(--color-background-info)', color: 'var(--color-text-info)', padding: '2px 8px', borderRadius: 10 }}>
                {Object.keys(monthOverrides).length} active
              </span>
            )}
          </div>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{overridesExpanded ? 'Collapse' : 'Expand'}</span>
        </div>

        {overridesExpanded && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)' }}>
                <th style={{ padding: '10px 16px', fontWeight: 500 }}>Category</th>
                <th style={{ padding: '10px 16px', fontWeight: 500 }}>Global limit</th>
                <th style={{ padding: '10px 16px', fontWeight: 500 }}>This month</th>
                <th style={{ padding: '10px 16px', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '10px 16px' }}></th>
              </tr>
            </thead>
            <tbody>
              {categories.filter(c => resolveMonthBudget(budgetEntries, {}, c.id, year, month) !== null).map(c => {
                const globalLimit = resolveMonthBudget(budgetEntries, {}, c.id, year, month);
                const override = monthOverrides[c.id];
                return (
                  <tr key={c.id} style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />
                        {c.label}
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>{fmt(globalLimit)}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <input className="input-f" style={{ width: 100, padding: '4px 8px' }} type="number"
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
                    <td style={{ padding: '10px 16px' }}>
                      {override !== undefined && <span style={{ fontSize: 11, color: '#EF9F27', fontWeight: 500 }}>Override active</span>}
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      {override !== undefined && (
                        <button onClick={() => { const next = { ...monthOverrides }; delete next[c.id]; onSaveOverride(next); }}
                          title="Reset to global" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--color-text-secondary)' }}>↩</button>
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
