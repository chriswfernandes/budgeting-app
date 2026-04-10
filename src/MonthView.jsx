import { useState } from "react";
import { resolveMonthBudget, getCategorySpend, getBudgetStatus, forecastSpend } from "./utils";

export default function MonthView({ 
  year, month, data, categories, globalBudgets, 
  incomeSources, monthOverrides, incomeAdjustments, 
  getcat, onUpdateIncome, onUpdateTxn, onSaveOverride, onSaveIncomeAdjust, 
  onDelete, onImport, onAddManual 
}) {
  const [incInput, setIncInput] = useState((data.totalIncome - (data.list.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0))).toString());
  const [editInc, setEditInc]   = useState(false);
  const [editIncomeOverrides, setEditIncomeOverrides] = useState(false);
  const [showBudgetOverrides, setShowBudgetOverrides] = useState(false);
  const [showAdd, setShowAdd]   = useState(false);
  const [filterCat, setFilter]  = useState(null);
  const [editingCatId, setEditingCatId] = useState(null);
  const [editingRowId, setEditingRowId] = useState(null);
  const [editForm, setEditForm] = useState({ date:'', description:'', amount:'', category:'' });
  const [editingTargetId, setEditingTargetId] = useState(null);
  const [targetInput, setTargetInput] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ date:'', description:'', amount:'', category: categories[0]?.id || '' });
  const [collapsedIds, setCollapsedIds] = useState(new Set());
  
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const getRollupTotal = (catId) => {
    const childIds = categories.filter(c => c.parentId === catId).map(c => c.id);
    return data.list.filter(t => t.type === 'expense' && (t.category === catId || childIds.includes(t.category))).reduce((s, t) => s + t.amount, 0);
  };

  const filtered = (filterCat ? data.list.filter(t => t.category === filterCat || categories.find(c => c.id === t.category)?.parentId === filterCat) : data.list)
    .filter(t => t.description.toLowerCase().includes(search.toLowerCase()) || t.amount.toString().includes(search));
  
  const saveInc = () => { onUpdateIncome(parseFloat(incInput)||0); setEditInc(false); };
  
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

  const toggleCollapse = (e, id) => {
    e.stopPropagation();
    const next = new Set(collapsedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCollapsedIds(next);
  };

  const getTargetValue = (catId) => resolveMonthBudget(globalBudgets, monthOverrides, catId);
  const startEditTarget = (e, catId) => { e.stopPropagation(); setEditingTargetId(catId); setTargetInput(getTargetValue(catId).toString()); };
  const saveTargetOverride = () => { 
    const val = parseFloat(targetInput);
    const globalVal = globalBudgets[editingTargetId];
    const next = { ...monthOverrides };
    if (isNaN(val) || val === globalVal) {
      delete next[editingTargetId];
    } else {
      next[editingTargetId] = val;
    }
    onSaveOverride(next); 
    setEditingTargetId(null); 
  };
  
  const fmt = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Math.abs(n));
  const parents = categories.filter(c => !c.parentId && !c.isIncome);

  // PRP-03: Fourth KPI Tile logic
  const overBudgetCategories = categories.filter(c => {
    const spent = getRollupTotal(c.id);
    const limit = getTargetValue(c.id);
    return getBudgetStatus(spent, limit) === 'over';
  });

  // PRP-03: Forecast Warning Logic
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const dayOfMonth = today.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const forecastWarnings = isCurrentMonth && dayOfMonth >= 7
    ? categories.filter(c => !c.isIncome).filter(c => {
        const spent = getRollupTotal(c.id);
        const limit = getTargetValue(c.id);
        if (!limit) return false;
        const projected = forecastSpend(spent, dayOfMonth, daysInMonth);
        return projected > limit;
      }).map(c => {
        const spent = getRollupTotal(c.id);
        const limit = getTargetValue(c.id);
        const projected = forecastSpend(spent, dayOfMonth, daysInMonth);
        return { category: c, overage: projected - limit };
      })
    : [];

  const hasAnyBudgetSet = categories.some(c => getTargetValue(c.id) > 0);

  return (
    <div>
      <div style={{ marginBottom:28 }}><h1 style={{ fontSize:26, fontWeight:500, marginBottom:4 }}>{MONTHS[month]} {year}</h1></div>
      
      {/* PRP-03: Forecast Warning Banner */}
      {forecastWarnings.length > 0 && (
        <div style={{
          background: 'var(--color-background-danger)',
          border: '0.5px solid var(--color-text-danger)',
          borderRadius: 'var(--border-radius-md)',
          padding: '12px 16px',
          marginBottom: 16,
          fontSize: 13,
          color: 'var(--color-text-danger)'
        }}>
          <strong>⚠️ Spend Forecast:</strong> At your current pace, you're on track to overspend in:
          <div style={{ marginTop: 4, opacity: 0.9 }}>
            {forecastWarnings.map((w, idx) => (
              <span key={w.category.id}>
                {w.category.label} (+{fmt(w.overage)} projected over){idx < forecastWarnings.length - 1 ? ' · ' : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* KPI Row (Dynamic Grid based on PRP-03) */}
      <div style={{ display:'grid', gridTemplateColumns: `repeat(${overBudgetCategories.length > 0 ? 4 : 3}, 1fr)`, gap:12, marginBottom:28 }}>
        <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:'var(--border-radius-lg)', padding:'16px 20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
            <p style={{ fontSize:11, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Income</p>
            {incomeSources.length > 0 ? (
              <button onClick={() => setEditIncomeOverrides(!editIncomeOverrides)} style={{ background:'none', border:'none', color:'var(--color-text-secondary)', cursor:'pointer', fontSize:12 }}>
                {editIncomeOverrides ? 'Close' : 'Edit overrides ▾'}
              </button>
            ) : (
              <button onClick={() => setEditInc(!editInc)} style={{ background:'none', border:'none', color:'var(--color-text-secondary)', cursor:'pointer', fontSize:12 }}>{editInc?'X':'Edit'}</button>
            )}
          </div>
          {incomeSources.length > 0 ? (
            <div>
              {editIncomeOverrides ? (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {incomeSources.map(s => {
                    const adj = incomeAdjustments.find(a => a.sourceId === s.id);
                    const val = adj ? adj.amount.toString() : '';
                    return (
                      <div key={s.id} style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ flex:1 }}>
                          <p style={{ fontSize:12, fontWeight:500 }}>{s.label}</p>
                          <p style={{ fontSize:10, color:'var(--color-text-secondary)' }}>Global: {fmt(s.amount)}</p>
                        </div>
                        <input 
                          className="input-f" 
                          style={{ width:80, padding:'4px 8px', fontSize:12 }} 
                          placeholder={s.amount.toString()}
                          value={val}
                          onChange={e => {
                            const valStr = e.target.value;
                            const otherAdjs = incomeAdjustments.filter(a => a.sourceId !== s.id);
                            let next;
                            if (valStr === '') {
                              next = otherAdjs;
                            } else {
                              next = [...otherAdjs, { sourceId: s.id, amount: parseFloat(valStr) || 0 }];
                            }
                            onSaveIncomeAdjust(next);
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  <p style={{ fontSize:26, fontWeight:500, fontFamily:'var(--font-mono)', color:'var(--color-text-success)' }}>{fmt(data.totalIncome)}</p>
                  <div style={{ marginTop:8, paddingTop:8, borderTop:'0.5px solid var(--color-border-tertiary)' }}>
                    {incomeSources.filter(s => s.active).map(s => {
                      const adj = incomeAdjustments.find(a => a.sourceId === s.id);
                      const amount = adj ? adj.amount : s.amount;
                      return (
                        <div key={s.id} style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--color-text-secondary)', marginBottom:2 }}>
                          <span>{s.label}</span>
                          <span>{fmt(amount)}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ) : (
            editInc ? <div style={{ display:'flex', gap:6 }}><input className="input-f" value={incInput} onChange={e => setIncInput(e.target.value)} onKeyDown={e => e.key==='Enter'&&saveInc()} autoFocus /><button className="btn-p" style={{ padding:'6px 10px' }} onClick={saveInc}>V</button></div> : <p style={{ fontSize:26, fontWeight:500, fontFamily:'var(--font-mono)', color:'var(--color-text-success)' }}>{fmt(data.totalIncome)}</p>
          )}
        </div>
        <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:'var(--border-radius-lg)', padding:'16px 20px' }}><p style={{ fontSize:11, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Expenses</p><p style={{ fontSize:26, fontWeight:500, fontFamily:'var(--font-mono)', color:'var(--color-text-danger)' }}>-{fmt(data.expenses)}</p></div>
        <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:'var(--border-radius-lg)', padding:'16px 20px' }}><p style={{ fontSize:11, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Net</p><p style={{ fontSize:26, fontWeight:500, fontFamily:'var(--font-mono)', color: data.net>=0?'var(--color-text-success)':'var(--color-text-danger)' }}>{data.net>=0?'+':'-'}{fmt(data.net)}</p></div>
        
        {/* PRP-03: Over-Budget KPI Tile */}
        {overBudgetCategories.length > 0 && (
          <div style={{ background:'var(--color-background-danger)', border:'0.5px solid var(--color-text-danger)', borderRadius:'var(--border-radius-lg)', padding:'16px 20px' }}>
            <p style={{ fontSize:11, color:'var(--color-text-danger)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Over budget</p>
            <p style={{ fontSize:26, fontWeight:500, color:'var(--color-text-danger)' }}>
              {overBudgetCategories.length} {overBudgetCategories.length === 1 ? 'category' : 'categories'}
            </p>
            <p style={{ fontSize:12, color:'var(--color-text-danger)', marginTop:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {overBudgetCategories.map(c => c.label).join(', ')}
            </p>
          </div>
        )}
      </div>

      {/* PRP-02: Budget Overrides Section */}
      <div style={{ marginBottom: 24 }}>
        <div 
          onClick={() => setShowBudgetOverrides(!showBudgetOverrides)}
          style={{ 
            display:'flex', 
            alignItems:'center', 
            justifyContent:'space-between', 
            padding:'12px 16px', 
            background:'var(--color-background-primary)', 
            border:'0.5px solid var(--color-border-tertiary)', 
            borderRadius:'var(--border-radius-lg)',
            cursor: 'pointer'
          }}
        >
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:14, fontWeight:500 }}>Budget overrides for {MONTHS[month]}</span>
            {Object.keys(monthOverrides).length > 0 && (
              <span style={{ 
                fontSize:11, 
                background:'var(--color-background-info)', 
                color:'var(--color-text-info)', 
                padding:'2px 8px', 
                borderRadius:10 
              }}>
                {Object.keys(monthOverrides).length} active
              </span>
            )}
          </div>
          <span style={{ fontSize:12, color:'var(--color-text-secondary)' }}>{showBudgetOverrides ? '▴ Collapse' : '▾ Expand'}</span>
        </div>

        {showBudgetOverrides && (
          <div style={{ 
            marginTop:8, 
            background:'var(--color-background-primary)', 
            border:'0.5px solid var(--color-border-tertiary)', 
            borderRadius:'var(--border-radius-lg)',
            overflow: 'hidden'
          }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ textAlign:'left', borderBottom:'0.5px solid var(--color-border-tertiary)', background:'var(--color-background-secondary)' }}>
                  <th style={{ padding:'10px 16px', fontWeight:500 }}>Category</th>
                  <th style={{ padding:'10px 16px', fontWeight:500 }}>Global limit</th>
                  <th style={{ padding:'10px 16px', fontWeight:500 }}>This month</th>
                  <th style={{ padding:'10px 16px', fontWeight:500 }}>Status</th>
                  <th style={{ padding:'10px 16px' }}></th>
                </tr>
              </thead>
              <tbody>
                {categories.filter(c => globalBudgets[c.id] !== undefined).map(c => {
                  const globalLimit = globalBudgets[c.id];
                  const override = monthOverrides[c.id];
                  const isActive = override !== undefined;
                  
                  return (
                    <tr key={c.id} style={{ borderBottom:'0.5px solid var(--color-border-tertiary)' }}>
                      <td style={{ padding:'10px 16px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ width:8, height:8, borderRadius:'50%', background:c.color }} />
                          {c.label}
                        </div>
                      </td>
                      <td style={{ padding:'10px 16px', color:'var(--color-text-secondary)', fontFamily:'var(--font-mono)' }}>{fmt(globalLimit)}</td>
                      <td style={{ padding:'10px 16px' }}>
                        <input 
                          className="input-f" 
                          style={{ width:100, padding:'4px 8px' }}
                          type="number"
                          value={override !== undefined ? override : globalLimit}
                          onChange={e => {
                            const val = parseFloat(e.target.value);
                            const next = { ...monthOverrides };
                            if (isNaN(val) || val === globalLimit) {
                              delete next[c.id];
                            } else {
                              next[c.id] = val;
                            }
                            onSaveOverride(next);
                          }}
                        />
                      </td>
                      <td style={{ padding:'10px 16px' }}>
                        {isActive && (
                          <span style={{ fontSize:11, color:'#EF9F27', fontWeight:500 }}>Override active</span>
                        )}
                      </td>
                      <td style={{ padding:'10px 16px', textAlign:'right' }}>
                        {isActive && (
                          <button 
                            onClick={() => {
                              const next = { ...monthOverrides };
                              delete next[c.id];
                              onSaveOverride(next);
                            }}
                            title="Reset to global"
                            style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, color:'var(--color-text-secondary)' }}
                          >
                            ↩
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:20, alignItems: 'start' }}>
        <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:'var(--border-radius-lg)', padding:16, position: 'sticky', top: 76 }}>
          <p style={{ fontSize:11, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:16 }}>Budget Targets</p>
          {parents.length === 0 ? <p style={{ fontSize:13, color:'var(--color-text-secondary)', fontStyle:'italic' }}>No data yet</p> : parents.map((p) => {
            const children = categories.filter(c => c.parentId === p.id); const total = getRollupTotal(p.id); const target = getTargetValue(p.id); const isCollapsed = collapsedIds.has(p.id);
            if (total === 0 && target === 0 && children.every(c => getRollupTotal(c.id) === 0 && getTargetValue(c.id) === 0)) return null;
            
            // PRP-03: Enhanced Progress Logic
            const status = getBudgetStatus(total, target);
            const barPct = target > 0 ? Math.min((total / target) * 100, 100) : (data.expenses > 0 ? (total / data.expenses) * 100 : 0);
            const barColor = status === 'over' ? '#E24B4A' : status === 'warning' ? '#EF9F27' : p.color;
            const faded = filterCat && filterCat !== p.id;
            const diff = target - total;

            return (
              <div key={p.id} style={{ marginBottom: 16 }}>
                <div className="cat-bar-row" onClick={() => setFilter(filterCat===p.id?null:p.id)} style={{ opacity: faded ? 0.35 : 1 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:13 }}>
                      {children.length > 0 && <button onClick={(e) => toggleCollapse(e, p.id)} style={{ background:'none', border:'none', color:'var(--color-text-secondary)', cursor:'pointer', padding:0, fontSize:9, width:14 }}>{isCollapsed ? '▶' : '▼'}</button>}
                      <span style={{
                        width:8, height:8, borderRadius:'50%',
                        background: status === 'warning' ? '#EF9F27' : p.color,
                        display:'inline-block', flexShrink:0
                      }} />
                      <span style={{ fontWeight:500 }}>{p.label}</span>
                    </div>
                    <span style={{
                      fontSize:12,
                      fontFamily:'var(--font-mono)',
                      color: status === 'over' ? 'var(--color-text-danger)' : 'var(--color-text-secondary)'
                    }}>
                      {fmt(total)}{target > 0 ? ` / ${fmt(target)}` : ''}
                    </span>
                  </div>
                  
                  <div style={{ height:2, background:'var(--color-border-tertiary)', borderRadius:1, marginBottom: status === 'over' ? 4 : 8 }}>
                    <div style={{ height:'100%', width:`${barPct}%`, background:barColor, borderRadius:1, transition:'width 0.3s ease' }} />
                  </div>

                  {status === 'over' && (
                    <p style={{ fontSize:11, color:'var(--color-text-danger)', marginBottom: 8 }}>
                      +{fmt(total - target)} over budget
                    </p>
                  )}

                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    {editingTargetId === p.id ? (
                      <div style={{ display:'flex', gap:4 }} onClick={e => e.stopPropagation()}><input className="input-f" style={{ padding:'2px 4px', fontSize:10, width:50 }} value={targetInput} onChange={e => setTargetInput(e.target.value)} onKeyDown={e => e.key==='Enter' && saveTargetOverride()} autoFocus /><button className="btn-p" style={{ padding:'2px 6px', fontSize:10 }} onClick={saveTargetOverride}>Set</button></div>
                    ) : (
                      <span style={{ fontSize:10, color:'var(--color-text-secondary)', cursor:'pointer', textDecoration:'underline dotted' }} onClick={(e) => startEditTarget(e, p.id)}>Target: {target > 0 ? fmt(target) : 'None'}</span>
                    )}
                    {target > 0 && status !== 'over' && (
                      <span style={{ fontSize:10, fontWeight:500, color: status === 'warning' ? '#EF9F27' : 'var(--color-text-success)' }}>
                        {fmt(diff)} left
                      </span>
                    )}
                  </div>
                </div>
                {!isCollapsed && children.map(c => {
                  const cTotal = getRollupTotal(c.id); const cTarget = getTargetValue(c.id); if (cTotal === 0 && cTarget === 0) return null;
                  const cStatus = getBudgetStatus(cTotal, cTarget);
                  const cBarPct = cTarget > 0 ? Math.min((cTotal / cTarget) * 100, 100) : 0;
                  const cBarColor = cStatus === 'over' ? '#E24B4A' : cStatus === 'warning' ? '#EF9F27' : c.color;
                  
                  return (
                    <div key={c.id} style={{ marginLeft: 18, marginTop: 10, opacity: filterCat && filterCat !== c.id ? 0.35 : 1 }} onClick={() => setFilter(filterCat===c.id?null:c.id)}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11 }}>
                          <span style={{
                            width:6, height:6, borderRadius:'50%',
                            background: cStatus === 'warning' ? '#EF9F27' : c.color,
                            display:'inline-block'
                          }} />
                          <span>{c.label}</span>
                        </div>
                        <span style={{ fontSize:11, color: cStatus === 'over' ? 'var(--color-text-danger)' : 'var(--color-text-secondary)' }}>{fmt(cTotal)}</span>
                      </div>
                      <div style={{ height:2, background:'var(--color-border-tertiary)', borderRadius:1, marginBottom:2 }}>
                        <div style={{ height:'100%', width:`${cBarPct}%`, background: cBarColor, borderRadius:1 }} />
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:9 }}>
                        {editingTargetId === c.id ? (
                          <div style={{ display:'flex', gap:4 }} onClick={e => e.stopPropagation()}><input className="input-f" style={{ padding:'1px 2px', fontSize:9, width:40 }} value={targetInput} onChange={e => setTargetInput(e.target.value)} onKeyDown={e => e.key==='Enter' && saveTargetOverride()} autoFocus /><button className="btn-p" style={{ padding:'1px 4px', fontSize:9 }} onClick={saveTargetOverride}>Set</button></div>
                        ) : (
                          <span style={{ color:'var(--color-text-secondary)', cursor:'pointer' }} onClick={(e) => startEditTarget(e, c.id)}>T: {cTarget > 0 ? fmt(cTarget) : 'None'}</span>
                        )}
                        {cTarget > 0 && <span style={{ color: cStatus === 'over' ? 'var(--color-text-danger)' : 'var(--color-text-success)' }}>{cStatus === 'over' ? 'over' : 'left'}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* PRP-03: Sidebar Legend */}
          {hasAnyBudgetSet && (
            <div style={{ marginTop:16, paddingTop:12, borderTop:'0.5px solid var(--color-border-tertiary)', display:'flex', flexDirection:'column', gap:6 }}>
              {[
                ['var(--color-text-success)', 'On track'],
                ['#EF9F27', 'Near limit (80%+)'],
                ['var(--color-text-danger)', 'Over budget'],
              ].map(([color, label]) => (
                <div key={label} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--color-text-secondary)' }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:color, display:'inline-block' }} />
                  {label}
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, position: 'sticky', top: 76, background: 'var(--color-background-tertiary)', zIndex: 5, padding: '8px 0', gap: 16 }}><div style={{ fontSize:13, color:'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{filterCat ? <span>{getcat(filterCat).label} <button onClick={() => setFilter(null)} style={{ background:'none', border:'none', color:'var(--color-text-secondary)', cursor:'pointer', fontSize:12, textDecoration:'underline' }}>clear</button></span> : (filtered.length + ' txns')}</div><input className="input-f" style={{ flex: 1, minWidth: 150, padding: '6px 12px', fontSize: 13 }} placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} /><div style={{ display:'flex', gap:8 }}><button className="btn-g" style={{ fontSize:12, padding:'5px 12px' }} onClick={() => setShowAdd(!showAdd)}>+ Add</button><div className="dropdown"><button className="btn-g" style={{ fontSize:12, padding:'5px 12px' }}>Import</button><div className="dropdown-content"><button onClick={() => triggerImport('checking')}>Checking</button><button onClick={() => triggerImport('credit')}>Credit</button></div></div></div></div>
          {showAdd && <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-secondary)', borderRadius:'var(--border-radius-lg)', padding:16, marginBottom:12 }}><div style={{ display:'grid', gridTemplateColumns:'140px 1fr 120px', gap:8, marginBottom:8 }}><input className="input-f" placeholder="Date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} /><input className="input-f" placeholder="Description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} /><input className="input-f" placeholder="Amount" type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} /></div><div style={{ display:'flex', gap:8 }}><select className="input-f" value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={{ flex:1 }}>{categories.map(c => <option key={c.id} value={c.id}>{c.parentId ? '↳ ' + c.label : c.label}</option>)}</select><button className="btn-p" onClick={addTxn}>Add</button><button className="btn-g" onClick={() => setShowAdd(false)}>Cancel</button></div></div>}
          <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:'var(--border-radius-lg)', overflow:'hidden' }}>{filtered.map((t, i) => {
            const c = getcat(t.category); const isEditingRow = editingRowId === t.id; const isEditingCat = editingCatId === t.id;
            return (
              <div key={t.id} className="txn-row" style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom: i<filtered.length-1 ? '0.5px solid var(--color-border-tertiary)' : 'none' }}>
                <span style={{ width:9, height:9, borderRadius:'50%', background:c.color, display:'inline-block', flexShrink:0 }} /><div style={{ flex:1, minWidth:0 }}>{isEditingRow ? <div style={{ display:'grid', gridTemplateColumns:'100px 1fr 100px 1fr', gap:8, alignItems:'center' }}><input className="input-f" style={{ fontSize:12, padding:'3px 6px' }} value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} /><input className="input-f" style={{ fontSize:12, padding:'3px 6px' }} value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} /><input className="input-f" style={{ fontSize:12, padding:'3px 6px' }} type="number" value={editForm.amount} onChange={e => setEditForm({...editForm, amount: e.target.value})} /><select className="input-f" style={{ fontSize:12, padding:'3px 6px' }} value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})}>{categories.map(cat => <option key={cat.id} value={cat.id}>{cat.parentId ? '↳ ' + cat.label : cat.label}</option>)}</select></div> : <><p style={{ fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.description}</p><div style={{ display:'flex', alignItems:'center', gap:6 }}>{isEditingCat ? <div style={{ display:'flex', gap:4, marginTop:4 }}><select className="input-f" style={{ padding:'2px 6px', fontSize:11, width:'auto' }} value={t.category || ''} onChange={e => changeCatQuick(t.id, e.target.value)}><option value="" disabled>Select...</option>{categories.map(cat => <option key={cat.id} value={cat.id}>{cat.parentId ? '↳ ' + cat.label : cat.label}</option>)}</select><button className="btn-g" style={{ padding:'2px 6px', fontSize:11 }} onClick={() => setEditingCatId(null)}>✕</button></div> : <p style={{ fontSize:12, color:'var(--color-text-secondary)', cursor:'pointer' }} onClick={() => setEditingCatId(t.id)}>{(t.date ? t.date + ' - ' : '')}<span style={{ textDecoration:'underline' }}>{c.label}</span></p>}{t.account && !isEditingCat && <span style={{ fontSize:9, background:'var(--color-background-secondary)', padding:'1px 5px', borderRadius:10, color:'var(--color-text-secondary)', textTransform:'uppercase' }}>{t.account}</span>}</div></>}</div>
                {!isEditingRow && <span style={{ fontFamily:'var(--font-mono)', fontSize:15, color: t.type==='income'?'var(--color-text-success)':'var(--color-text-primary)', flexShrink:0 }}>{t.type==='income'?'+':'-'}{fmt(t.amount)}</span>}
                <div style={{ display:'flex', gap:8 }}>{isEditingRow ? <><button className="btn-p" style={{ padding:'4px 12px', fontSize:12 }} onClick={() => saveRowEdit(t.id)}>Save</button><button className="btn-g" style={{ padding:'4px 12px', fontSize:12 }} onClick={() => setEditingRowId(null)}>✕</button></> : <><button className="btn-g" style={{ padding:'4px 8px', fontSize:11 }} onClick={() => startRowEdit(t)}>Edit</button><button className="btn-g" style={{ padding:'4px 8px', fontSize:11, color:'var(--color-text-danger)' }} onClick={() => onDelete(t.id)}>✕</button></>}</div>
              </div>
            );
          })}</div>
        </div>
      </div>
    </div>
  );
}
