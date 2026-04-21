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
    endMonth: (new Date().getMonth() + 11) % 12,
    incomeChanges: [],
    categoryChanges: [],
    oneOffCosts: [],
    savingsTarget: undefined,
    floorAmount: undefined,
    createdAt: new Date().toISOString(),
    status: 'active'
  });

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

  const handleIncomeChange = (sourceId, amount, isNew = false, label = '') => {
    const existingIdx = form.incomeChanges.findIndex(c => c.sourceId === sourceId);
    let nextChanges = [...form.incomeChanges];
    if (amount === null) {
      nextChanges = nextChanges.filter(c => c.sourceId !== sourceId);
    } else {
      const change = { sourceId, monthlyAmount: amount, isNew, label: label || incomeSources.find(s => s.id === sourceId)?.label };
      if (existingIdx !== -1) nextChanges[existingIdx] = change;
      else nextChanges.push(change);
    }
    setForm({ ...form, incomeChanges: nextChanges });
  };

  const baselineIncome = incomeSources.filter(s => s.active).reduce((sum, s) => sum + s.amount, 0);
  const scenarioIncome = incomeSources.filter(s => s.active).reduce((sum, s) => {
    const change = form.incomeChanges.find(c => c.sourceId === s.id);
    return sum + (change ? change.monthlyAmount : s.amount);
  }, 0) + form.incomeChanges.filter(c => c.isNew).reduce((sum, c) => sum + c.monthlyAmount, 0);

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
    <div className="card p-8 max-w-[800px] mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-xl font-medium">{existing ? 'Edit Scenario' : 'New Scenario'}</h2>
        <span className="text-xs text-muted uppercase tracking-[0.05em]">Step {step} of 4</span>
      </div>

      <div className="mb-10">
        {step === 1 && (
          <div className="flex flex-col gap-6">
            <div>
              <label className="block text-[13px] font-medium mb-2">Scenario Name</label>
              <input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Maternity Leave 2026" />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-2">Description (optional)</label>
              <textarea className="input-field !h-20 resize-none" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Add notes about this projection..." />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-2">Theme Color</label>
              <div className="flex gap-3">
                {COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setForm({ ...form, color: c.value })}
                    className="w-8 h-8 rounded-full cursor-pointer p-0 border-2"
                    style={{ background: c.value, borderColor: form.color === c.value ? 'var(--color-text)' : 'transparent' }}
                  />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-[13px] font-medium mb-2">Start Date</label>
                <div className="flex gap-2">
                  <select className="input-field" value={form.startMonth} onChange={e => setForm({ ...form, startMonth: parseInt(e.target.value) })}>
                    {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                  <select className="input-field" value={form.startYear} onChange={e => setForm({ ...form, startYear: parseInt(e.target.value) })}>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium mb-2">End Date (inclusive)</label>
                <div className="flex gap-2">
                  <select className="input-field" value={form.endMonth} onChange={e => setForm({ ...form, endMonth: parseInt(e.target.value) })}>
                    {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                  <select className="input-field" value={form.endYear} onChange={e => setForm({ ...form, endYear: parseInt(e.target.value) })}>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className={`px-4 py-3 bg-raised rounded-lg text-[13px] ${duration > 36 || duration <= 0 ? 'text-danger' : 'text-muted'}`}>
              {duration <= 0 ? 'End date must be after start date' : `Duration: ${duration} months ${duration > 36 ? '(Max 36 months)' : ''}`}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="text-sm text-muted mb-6">How does income change during this period?</p>
            <div className="flex flex-col gap-4 mb-8">
              {incomeSources.map(s => {
                const change = form.incomeChanges.find(c => c.sourceId === s.id);
                const mode = change === undefined ? 'keep' : (change.monthlyAmount === 0 ? 'remove' : 'reduce');
                return (
                  <div key={s.id} className="flex items-center justify-between px-4 py-3 border-[0.5px] border-border-subtle rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{s.label}</p>
                      <p className="text-xs text-muted">Current: {fmt(s.amount)}/mo</p>
                    </div>
                    <div className="flex gap-2 items-center">
                      <select
                        className="input-field !w-[140px] !text-[13px]"
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
                          className="input-field !w-[100px]"
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
                <div key={c.sourceId} className="flex items-center gap-3 px-4 py-3 border-[0.5px] border-border-subtle rounded-lg bg-raised">
                  <input className="input-field" value={c.label} onChange={e => handleIncomeChange(c.sourceId, c.monthlyAmount, true, e.target.value)} placeholder="Income Label" />
                  <input className="input-field" type="number" value={c.monthlyAmount} onChange={e => handleIncomeChange(c.sourceId, parseFloat(e.target.value) || 0, true, c.label)} placeholder="Amount" />
                  <button className="btn-ghost" onClick={() => setForm({ ...form, incomeChanges: form.incomeChanges.filter(ic => ic.sourceId !== c.sourceId) })}>✕</button>
                </div>
              ))}
              <button className="btn-ghost self-start text-xs" onClick={() => handleIncomeChange(`new-${Date.now()}`, 0, true, 'New Income')}>+ Add temporary income source</button>
            </div>

            <div className="bg-raised rounded-xl p-5">
              <div className="flex justify-between text-[13px] mb-2">
                <span>Baseline monthly income:</span>
                <span>{fmt(baselineIncome)}</span>
              </div>
              <div className="flex justify-between text-[13px] mb-3 font-medium">
                <span>Scenario monthly income:</span>
                <span>{fmt(scenarioIncome)}</span>
              </div>
              <div className={`flex justify-between text-sm font-semibold border-t-[0.5px] border-border-subtle pt-3 ${scenarioIncome >= baselineIncome ? 'text-success' : 'text-danger'}`}>
                <span>Monthly difference:</span>
                <span>{scenarioIncome >= baselineIncome ? '+' : '-'}{fmt(Math.abs(scenarioIncome - baselineIncome))}</span>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="text-sm text-muted mb-6">Do any spending patterns change during this period?</p>

            <h4 className="text-[13px] font-semibold uppercase tracking-[0.05em] mb-4">Category Budget Adjustments</h4>
            <div className="flex flex-col gap-2 mb-8">
              {categories.filter(c => !c.isIncome && !c.parentId && resolveMonthBudget(budgetEntries, {}, c.id, curYear, curMonth) !== null).map(cat => {
                const change = form.categoryChanges.find(cc => cc.categoryId === cat.id);
                const baseAmount = resolveMonthBudget(budgetEntries, {}, cat.id, curYear, curMonth);
                return (
                  <div key={cat.id} className="grid items-center gap-3 px-3 py-2 border-[0.5px] border-border-subtle rounded-lg" style={{ gridTemplateColumns: '1fr 100px 30px 120px' }}>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: cat.color }} />
                      <span className="text-sm">{cat.label}</span>
                    </div>
                    <span className="text-xs text-muted">{fmt(baseAmount)}/mo</span>
                    <span className="text-center text-muted">→</span>
                    <input
                      className="input-field"
                      type="number"
                      placeholder="As-is"
                      value={change?.monthlyLimit ?? ''}
                      onChange={e => handleCategoryChange(cat.id, e.target.value === '' ? null : parseFloat(e.target.value))}
                    />
                  </div>
                );
              })}
            </div>

            <h4 className="text-[13px] font-semibold uppercase tracking-[0.05em] mb-4">One-off Costs</h4>
            <div className="flex flex-col gap-3 mb-4">
              {form.oneOffCosts.map(oc => (
                <div key={oc.id} className="grid gap-2" style={{ gridTemplateColumns: '1fr 120px 140px 40px' }}>
                  <input className="input-field" placeholder="Label (e.g. Vacation)" value={oc.label} onChange={e => updateOneOff(oc.id, { label: e.target.value })} />
                  <input className="input-field" type="number" placeholder="Amount" value={oc.amount || ''} onChange={e => updateOneOff(oc.id, { amount: parseFloat(e.target.value) || 0 })} />
                  <select className="input-field" value={oc.month} onChange={e => updateOneOff(oc.id, { month: parseInt(e.target.value) })}>
                    {Array.from({ length: duration }).map((_, i) => {
                      const m = (form.startMonth + i) % 12;
                      const y = form.startYear + Math.floor((form.startMonth + i) / 12);
                      const labels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                      return <option key={i} value={i}>{labels[m]} {y}</option>;
                    })}
                  </select>
                  <button className="btn-ghost" onClick={() => removeOneOff(oc.id)}>✕</button>
                </div>
              ))}
              <button className="btn-ghost self-start text-xs" onClick={addOneOff}>+ Add one-time expense</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <p className="text-sm text-muted mb-6">Set targets to track against the projection.</p>

            <div className="flex flex-col gap-6 mb-10">
              <div>
                <label className="block text-[13px] font-medium mb-2">Savings Floor (Optional)</label>
                <input className="input-field" type="number" placeholder="e.g. 5000" value={form.floorAmount ?? ''} onChange={e => setForm({ ...form, floorAmount: e.target.value === '' ? undefined : parseFloat(e.target.value) })} />
                <p className="text-xs text-muted mt-2">Alert me if projected cumulative balance drops below this amount.</p>
              </div>
              <div>
                <label className="block text-[13px] font-medium mb-2">Savings Target (Optional)</label>
                <input className="input-field" type="number" placeholder="e.g. 10000" value={form.savingsTarget ?? ''} onChange={e => setForm({ ...form, savingsTarget: e.target.value === '' ? undefined : parseFloat(e.target.value) })} />
                <p className="text-xs text-muted mt-2">The total amount I want to have saved by the end of this scenario.</p>
              </div>
            </div>

            <div className="bg-raised rounded-xl p-6">
              <h4 className="text-sm font-semibold mb-4">Review Summary</h4>
              <ul className="text-[13px] text-muted flex flex-col gap-2 pl-5 list-disc">
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

      <div className="flex justify-between">
        <button className="btn-ghost" onClick={step === 1 ? onCancel : back}>{step === 1 ? 'Cancel' : 'Back'}</button>
        <button className="btn-primary" onClick={() => {
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
