import { useState } from "react";

export default function RulesView({ rules, categories, onSaveRules, onReapplyRules, txnCount = 0 }) {
  const [form, setForm] = useState({ trigger: '', targetCategory: categories[0]?.id || '', amountThreshold: '', type: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ trigger: '', targetCategory: '', amountThreshold: '', type: '' });
  const [search, setSearch] = useState('');
  const [confirmReapply, setConfirmReapply] = useState(false);
  const [reapplyResult, setReapplyResult] = useState(null);
  const [reapplying, setReapplying] = useState(false);

  const saveRule = () => {
    if (!form.trigger.trim()) return;
    const newRule = {
      id: `rule-${Date.now()}`,
      trigger: form.trigger,
      targetCategory: form.targetCategory,
      amountThreshold: form.amountThreshold ? parseFloat(form.amountThreshold) : undefined,
      type: form.type || undefined,
      active: true
    };
    onSaveRules([...rules, newRule]);
    setForm({ trigger: '', targetCategory: categories[0]?.id || '', amountThreshold: '', type: '' });
  };

  const saveInlineEdit = (id) => {
    if (!editForm.trigger.trim()) return;
    const newRules = rules.map(r => r.id === id ? {
      ...r,
      trigger: editForm.trigger,
      targetCategory: editForm.targetCategory,
      amountThreshold: editForm.amountThreshold ? parseFloat(editForm.amountThreshold) : undefined,
      type: editForm.type || undefined
    } : r);
    onSaveRules(newRules);
    setEditingId(null);
  };

  const startInlineEdit = (rule) => {
    setEditingId(rule.id);
    setEditForm({
      trigger: rule.trigger,
      targetCategory: rule.targetCategory,
      amountThreshold: rule.amountThreshold?.toString() || '',
      type: rule.type || ''
    });
  };

  const toggle = (id) => onSaveRules(rules.map(r => r.id === id ? { ...r, active: !r.active } : r));
  const del = (id) => onSaveRules(rules.filter(r => r.id !== id));

  const runReapply = async () => {
    setReapplying(true);
    setConfirmReapply(false);
    const count = await onReapplyRules();
    setReapplyResult(count);
    setReapplying(false);
  };

  const filteredRules = rules.filter(r =>
    r.trigger.toLowerCase().includes(search.toLowerCase()) ||
    categories.find(c => c.id === r.targetCategory)?.label.toLowerCase().includes(search.toLowerCase())
  );

  const fmt = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Math.abs(n));

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-[28px] font-semibold mb-1">Rules</h1>
        <p className="text-sm text-muted">Manage categorization rules.</p>
      </div>
      <div className="grid grid-cols-[280px_1fr] gap-5 items-start">
        <div className="card p-4 sticky top-[76px]">
          <p className="text-xs text-muted mb-4">Create Rule</p>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-muted mb-1 block">Contains:</label>
              <input className="input-field" value={form.trigger} onChange={e => setForm({...form, trigger: e.target.value})} placeholder="e.g., Starbucks" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Category:</label>
              <select className="input-field" value={form.targetCategory} onChange={e => setForm({...form, targetCategory: e.target.value})}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.parentId ? '↳ ' + c.label : c.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted mb-1 block">Amount &gt; :</label>
                <input className="input-field" type="number" value={form.amountThreshold} onChange={e => setForm({...form, amountThreshold: e.target.value})} placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs text-muted mb-1 block">Type:</label>
                <select className="input-field" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                  <option value="">Any</option>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
            </div>
            <div className="mt-2">
              <button className="btn-primary w-full" onClick={saveRule}>Add Rule</button>
            </div>
          </div>
        </div>

        <div>
          {!rules.some(r => r.targetCategory === 'cc-payment') && (
            <div className="mb-4 px-3.5 py-2.5 bg-info-bg border-[0.5px] border-info rounded-md text-xs text-info flex items-center gap-2.5">
              <span>💳</span>
              <span>Tip: create rules mapping <strong>"VISA PREAUTH PYMT"</strong> (checking) and <strong>"PREAUTHORIZED PAYMENT"</strong> (credit card) → <strong>CC Payment</strong> to automatically exclude credit card bill payments from your totals.</span>
            </div>
          )}
          <div className="py-2 mb-3 sticky top-[76px] bg-bg z-[5] flex justify-between items-center gap-4">
            <span className="text-[13px] text-muted">{filteredRules.length} rules</span>
            <input className="input-field" style={{ maxWidth: 240, padding: '6px 12px', fontSize: 13 }} placeholder="Search rules..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {filteredRules.length === 0 && search === '' && (
            <div className="card px-6 py-8 text-center text-muted text-[13px]">
              No rules yet. Create one using the panel on the left.
            </div>
          )}
          <div className="card overflow-hidden">
            {filteredRules.map((r) => {
              const c = categories.find(cat => cat.id === r.targetCategory);
              const isEditing = editingId === r.id;

              return (
                <div key={r.id} className={`txn-row flex items-center gap-3 px-4 py-3 border-b-[0.5px] border-border-subtle last:border-b-0 ${r.active || isEditing ? '' : 'opacity-50'}`}>
                  {!isEditing && (
                    <label className="switch"><input type="checkbox" checked={r.active} onChange={() => toggle(r.id)} /><span className="slider"></span></label>
                  )}

                  <div className="flex-1">
                    {isEditing ? (
                      <div className="flex gap-2 items-center flex-wrap">
                        <input className="input-field !text-[13px] !py-1 !px-2" style={{ flex: '1 1 200px' }} value={editForm.trigger} onChange={e => setEditForm({...editForm, trigger: e.target.value})} autoFocus />
                        <select className="input-field !text-[13px] !py-1 !px-2" style={{ flex: '1 1 120px' }} value={editForm.targetCategory} onChange={e => setEditForm({...editForm, targetCategory: e.target.value})}>
                          {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.parentId ? '↳ ' + cat.label : cat.label}</option>)}
                        </select>
                        <input className="input-field !text-[13px] !py-1 !px-2" style={{ flex: '1 1 80px' }} type="number" value={editForm.amountThreshold} onChange={e => setEditForm({...editForm, amountThreshold: e.target.value})} placeholder="Amt >" />
                        <select className="input-field !text-[13px] !py-1 !px-2" style={{ flex: '1 1 100px' }} value={editForm.type} onChange={e => setEditForm({...editForm, type: e.target.value})}>
                          <option value="">Any</option>
                          <option value="expense">Expense</option>
                          <option value="income">Income</option>
                        </select>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium">"{r.trigger}"</p>
                        <div className="flex items-center gap-3 text-xs text-muted mt-0.5">
                          <div className="flex items-center gap-1.5">
                            <span>↳</span>
                            <span className="w-3 h-3 rounded-full inline-block shrink-0" style={{ background: c?.color || '#888' }} />
                            {c?.label || 'Unknown'}
                          </div>
                          {(r.amountThreshold || r.type) && (
                            <span className="opacity-80">
                              ({r.type || 'any'}) {r.amountThreshold ? `> ${fmt(r.amountThreshold)}` : ''}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex gap-2 shrink-0">
                    {isEditing ? (
                      <>
                        <button className="btn-primary py-1 px-3 text-xs" onClick={() => saveInlineEdit(r.id)}>Save</button>
                        <button className="btn-ghost py-1 px-3 text-xs" onClick={() => setEditingId(null)}>✕</button>
                      </>
                    ) : (
                      <>
                        <button className="btn-ghost py-1 px-2.5 text-xs" onClick={() => startInlineEdit(r)}>Edit</button>
                        <button className="btn-ghost py-1 px-2.5 text-xs text-danger" onClick={() => del(r.id)}>✕</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card p-4 mt-6">
            <p className="text-xs text-muted mb-3">Bulk actions</p>
            <div className="flex items-center gap-3 flex-wrap">
              {reapplyResult !== null ? (
                <span className="text-[13px] text-success">
                  ✓ {reapplyResult} transaction{reapplyResult !== 1 ? 's' : ''} reclassified
                  <button onClick={() => setReapplyResult(null)} className="bg-transparent border-0 text-muted cursor-pointer text-xs ml-2 underline p-0">dismiss</button>
                </span>
              ) : confirmReapply ? (
                <>
                  <span className="text-[13px] text-muted">
                    Run {rules.filter(r => r.active).length} active rules against {txnCount} stored transactions?
                  </span>
                  <button className="btn-primary py-[5px] px-3.5 text-xs" onClick={runReapply} disabled={reapplying}>
                    {reapplying ? 'Running…' : 'Confirm'}
                  </button>
                  <button className="btn-ghost py-[5px] px-2.5 text-xs" onClick={() => setConfirmReapply(false)}>Cancel</button>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-[13px] font-medium">Re-apply rules to all imported transactions</p>
                    <p className="text-xs text-muted mt-0.5">
                      Updates categories on all {txnCount} stored transactions using your current active rules.
                    </p>
                  </div>
                  <button
                    className="btn-ghost py-1.5 px-3.5 text-xs whitespace-nowrap shrink-0"
                    onClick={() => setConfirmReapply(true)}
                    disabled={!rules.some(r => r.active) || txnCount === 0}
                  >
                    Re-apply rules
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
