import { useState, useEffect } from "react";
import { resolveMonthBudget } from "./utils";

const COLORS = [
  { label: 'Blue', value: '#378ADD' },
  { label: 'Amber', value: '#EF9F27' },
  { label: 'Teal', value: '#1D9E75' },
  { label: 'Coral', value: '#D85A30' },
  { label: 'Green', value: '#3B6D11' },
  { label: 'Purple', value: '#7F77DD' },
];

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function ScenarioBuilder({ existing, incomeSources, budgetEntries, categories, onSave, onCancel }) {
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(existing || {
    id: `sc-${Date.now()}`,
    name: '',
    description: '',
    color: COLORS[0].value,
    startYear: new Date().getFullYear(),
    startMonth: new Date().getMonth(),
    endYear: new Date().getFullYear(),
    endMonth: (new Date().getMonth() + 11) % 12, // Default 12 months
    incomeChanges: [],
    categoryChanges: [],
    oneOffCosts: [],
    savingsTarget: undefined,
    floorAmount: undefined,
    createdAt: new Date().toISOString(),
    status: 'active'
  });

  // Correct endYear if endMonth wrapped
  useEffect(() => {
    if (!existing && form.endMonth < form.startMonth && form.endYear === form.startYear) {
      setForm(f => ({ ...f, endYear: f.startYear + 1 }));
    }
  }, []);

  const duration = ((form.endYear - form.startYear) * 12) + (form.endMonth - form.startMonth) + 1;
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + i - 1);

  const next = () => setStep(s => s + 1);
  const back = () => setStep(s => s - 1);

  const validateStep1 = () => {
    if (!form.name.trim()) return "Name is required";
    if (duration <= 0) return "End date must be after start date";
    if (duration > 36) return "Scenario cannot exceed 36 months";
    return null;
  };

  const fmt = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Math.abs(n));

  // --- Step 2: Income Logic ---
  const handleIncomeChange = (sourceId, amount, isNew = false, label = '') => {
    const existingIdx = form.incomeChanges.findIndex(c => c.sourceId === sourceId);
    let nextChanges = [...form.incomeChanges];
    
    if (amount === null) {
      // "Keep as-is" - remove from changes
      nextChanges = nextChanges.filter(c => c.sourceId !== sourceId);
    } else {
      const change = { sourceId, monthlyAmount: amount, isNew, label: label || incomeSources.find(s => s.id === sourceId)?.label };
      if (existingIdx !== -1) {
        nextChanges[existingIdx] = change;
      } else {
        nextChanges.push(change);
      }
    }
    setForm({ ...form, incomeChanges: nextChanges });
  };

  const baselineIncome = incomeSources.filter(s => s.active).reduce((sum, s) => sum + s.amount, 0);
  const scenarioIncome = incomeSources.filter(s => s.active).reduce((sum, s) => {
    const change = form.incomeChanges.find(c => c.sourceId === s.id);
    return sum + (change ? change.monthlyAmount : s.amount);
  }, 0) + form.incomeChanges.filter(c => c.isNew).reduce((sum, c) => sum + c.monthlyAmount, 0);

  // --- Step 3: Expense Logic ---
  const handleCategoryChange = (categoryId, amount) => {
    let nextChanges = [...form.categoryChanges];
    if (amount === null) {
      nextChanges = nextChanges.filter(c => c.categoryId !== categoryId);
    } else {
      const idx = nextChanges.findIndex(c => c.categoryId === categoryId);
      if (idx !== -1) nextChanges[idx] = { categoryId, monthlyLimit: amount };
      else nextChanges.push({ categoryId, monthlyLimit: amount });
    }
    setForm({ ...form, categoryChanges: nextChanges });
  };

  const addOneOff = () => {
    const id = `oc-${Date.now()}`;
    setForm({ ...form, oneOffCosts: [...form.oneOffCosts, { id, label: '', amount: 0, month: 0 }] });
  };

  const updateOneOff = (id, updates) => {
    setForm({ ...form, oneOffCosts: form.oneOffCosts.map(c => c.id === id ? { ...c, ...updates } : c) });
  };

  const removeOneOff = (id) => {
    setForm({ ...form, oneOffCosts: form.oneOffCosts.filter(c => c.id !== id) });
  };

  return (
    <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-lg)', padding: 32, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 500 }}>{existing ? 'Edit Scenario' : 'New Scenario'}</h2>
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Step {step} of 4</span>
      </div>

      <div style={{ marginBottom: 40 }}>
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Scenario Name</label>
              <input className="input-f" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Maternity Leave 2026" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Description (optional)</label>
              <textarea className="input-f" style={{ height: 80, resize: 'none' }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Add notes about this projection..." />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Theme Color</label>
              <div style={{ display: 'flex', gap: 12 }}>
                {COLORS.map(c => (
                  <button 
                    key={c.value} 
                    onClick={() => setForm({ ...form, color: c.value })}
                    style={{ width: 32, height: 32, borderRadius: '50%', background: c.value, border: form.color === c.value ? '2px solid var(--color-text-primary)' : '2px solid transparent', cursor: 'pointer', padding: 0 }}
                  />
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Start Date</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select className="input-f" value={form.startMonth} onChange={e => setForm({ ...form, startMonth: parseInt(e.target.value) })}>
                    {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                  <select className="input-f" value={form.startYear} onChange={e => setForm({ ...form, startYear: parseInt(e.target.value) })}>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>End Date (inclusive)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select className="input-f" value={form.endMonth} onChange={e => setForm({ ...form, endMonth: parseInt(e.target.value) })}>
                    {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                  <select className="input-f" value={form.endYear} onChange={e => setForm({ ...form, endYear: parseInt(e.target.value) })}>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 16px', background: 'var(--color-background-secondary)', borderRadius: 8, fontSize: 13, color: duration > 36 || duration <= 0 ? 'var(--color-text-danger)' : 'var(--color-text-secondary)' }}>
              {duration <= 0 ? 'End date must be after start date' : `Duration: ${duration} months ${duration > 36 ? '(Max 36 months)' : ''}`}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 24 }}>How does income change during this period?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
              {incomeSources.map(s => {
                const change = form.incomeChanges.find(c => c.sourceId === s.id);
                const mode = change === undefined ? 'keep' : (change.monthlyAmount === 0 ? 'remove' : 'reduce');
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8 }}>
                    <div>
                      <p style={{ fontWeight: 500, fontSize: 14 }}>{s.label}</p>
                      <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Current: {fmt(s.amount)}/mo</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <select 
                        className="input-f" 
                        style={{ width: 140, fontSize: 13 }}
                        value={mode}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === 'keep') handleIncomeChange(s.id, null);
                          else if (val === 'remove') handleIncomeChange(s.id, 0);
                          else handleIncomeChange(s.id, s.amount);
                        }}
                      >
                        <option value="keep">Keep as-is</option>
                        <option value="reduce">Change amount</option>
                        <option value="remove">Removed</option>
                      </select>
                      {mode === 'reduce' && (
                        <input 
                          className="input-f" 
                          style={{ width: 100 }} 
                          type="number" 
                          value={change.monthlyAmount} 
                          onChange={e => handleIncomeChange(s.id, parseFloat(e.target.value) || 0)} 
                        />
                      )}
                    </div>
                  </div>
                );
              })}
              {form.incomeChanges.filter(c => c.isNew).map(c => (
                <div key={c.sourceId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8, background: 'var(--color-background-secondary)' }}>
                  <input className="input-f" value={c.label} onChange={e => handleIncomeChange(c.sourceId, c.monthlyAmount, true, e.target.value)} placeholder="Income Label" />
                  <input className="input-f" type="number" value={c.monthlyAmount} onChange={e => handleIncomeChange(c.sourceId, parseFloat(e.target.value) || 0, true, c.label)} placeholder="Amount" />
                  <button className="btn-g" onClick={() => setForm({ ...form, incomeChanges: form.incomeChanges.filter(ic => ic.sourceId !== c.sourceId) })}>✕</button>
                </div>
              ))}
              <button className="btn-g" style={{ alignSelf: 'flex-start', fontSize: 12 }} onClick={() => handleIncomeChange(`new-${Date.now()}`, 0, true, 'New Income')}>+ Add temporary income source</button>
            </div>
            
            <div style={{ padding: 20, background: 'var(--color-background-secondary)', borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                <span>Baseline monthly income:</span>
                <span>{fmt(baselineIncome)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 12, fontWeight: 500 }}>
                <span>Scenario monthly income:</span>
                <span>{fmt(scenarioIncome)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, color: scenarioIncome >= baselineIncome ? 'var(--color-text-success)' : 'var(--color-text-danger)', borderTop: '0.5px solid var(--color-border-tertiary)', paddingTop: 12 }}>
                <span>Monthly difference:</span>
                <span>{scenarioIncome >= baselineIncome ? '+' : '-'}{fmt(Math.abs(scenarioIncome - baselineIncome))}</span>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 24 }}>Do any spending patterns change during this period?</p>
            
            <h4 style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>Category Budget Adjustments</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
              {categories.filter(c => !c.isIncome && !c.parentId && resolveMonthBudget(budgetEntries, {}, c.id, curYear, curMonth) !== null).map(cat => {
                const change = form.categoryChanges.find(cc => cc.categoryId === cat.id);
                const baseAmount = resolveMonthBudget(budgetEntries, {}, cat.id, curYear, curMonth);
                return (
                  <div key={cat.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 30px 120px', alignItems: 'center', gap: 12, padding: '8px 12px', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color }} />
                      <span style={{ fontSize: 14 }}>{cat.label}</span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{fmt(baseAmount)}/mo</span>
                    <span style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>→</span>
                    <input 
                      className="input-f" 
                      type="number" 
                      placeholder="As-is"
                      value={change?.monthlyLimit ?? ''} 
                      onChange={e => handleCategoryChange(cat.id, e.target.value === '' ? null : parseFloat(e.target.value))} 
                    />
                  </div>
                );
              })}
            </div>

            <h4 style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>One-off Costs</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              {form.oneOffCosts.map(oc => (
                <div key={oc.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 140px 40px', gap: 8 }}>
                  <input className="input-f" placeholder="Label (e.g. Vacation)" value={oc.label} onChange={e => updateOneOff(oc.id, { label: e.target.value })} />
                  <input className="input-f" type="number" placeholder="Amount" value={oc.amount || ''} onChange={e => updateOneOff(oc.id, { amount: parseFloat(e.target.value) || 0 })} />
                  <select className="input-f" value={oc.month} onChange={e => updateOneOff(oc.id, { month: parseInt(e.target.value) })}>
                    {Array.from({ length: duration }).map((_, i) => {
                      const m = (form.startMonth + i) % 12;
                      const y = form.startYear + Math.floor((form.startMonth + i) / 12);
                      const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                      return <option key={i} value={i}>{labels[m]} {y}</option>;
                    })}
                  </select>
                  <button className="btn-g" onClick={() => removeOneOff(oc.id)}>✕</button>
                </div>
              ))}
              <button className="btn-g" style={{ alignSelf: 'flex-start', fontSize: 12 }} onClick={addOneOff}>+ Add one-time expense</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 24 }}>Set targets to track against the projection.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 40 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Savings Floor (Optional)</label>
                <input className="input-f" type="number" placeholder="e.g. 5000" value={form.floorAmount ?? ''} onChange={e => setForm({ ...form, floorAmount: e.target.value === '' ? undefined : parseFloat(e.target.value) })} />
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 8 }}>Alert me if projected cumulative balance drops below this amount.</p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Savings Target (Optional)</label>
                <input className="input-f" type="number" placeholder="e.g. 10000" value={form.savingsTarget ?? ''} onChange={e => setForm({ ...form, savingsTarget: e.target.value === '' ? undefined : parseFloat(e.target.value) })} />
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 8 }}>The total amount I want to have saved by the end of this scenario.</p>
              </div>
            </div>

            <div style={{ background: 'var(--color-background-secondary)', borderRadius: 12, padding: 24 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Review Summary</h4>
              <ul style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 20 }}>
                <li>Covers {duration} months: {MONTHS[form.startMonth]} {form.startYear} → {MONTHS[form.endMonth]} {form.endYear}</li>
                {form.incomeChanges.map(c => (
                  <li key={c.sourceId}>{c.label}: {c.monthlyAmount === 0 ? 'Removed' : `Changed to ${fmt(c.monthlyAmount)}/mo`}</li>
                ))}
                {form.categoryChanges.map(c => (
                  <li key={c.categoryId}>{categories.find(cat => cat.id === c.categoryId)?.label} budget: {fmt(c.monthlyLimit)}/mo</li>
                ))}
                {form.oneOffCosts.length > 0 && <li>{form.oneOffCosts.length} one-off costs totaling {fmt(form.oneOffCosts.reduce((s, c) => s + c.amount, 0))}</li>}
                {form.floorAmount !== undefined && <li>Warning if balance drops below {fmt(form.floorAmount)}</li>}
                {form.savingsTarget !== undefined && <li>Target savings: {fmt(form.savingsTarget)}</li>}
              </ul>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button className="btn-g" onClick={step === 1 ? onCancel : back}>{step === 1 ? 'Cancel' : 'Back'}</button>
        <button className="btn-p" onClick={() => {
          const err = step === 1 ? validateStep1() : null;
          if (err) alert(err);
          else step === 4 ? onSave(form) : next();
        }}>
          {step === 4 ? 'Save Scenario' : 'Next'}
        </button>
      </div>
    </div>
  );
}
