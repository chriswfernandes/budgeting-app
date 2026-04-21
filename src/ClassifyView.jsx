import { useState, useEffect } from "react";

export default function ClassifyView({ queue, idx, categories, onClassify, onSkip, onDone, onSaveCategories }) {
  const [showRuleBuilder, setShowRuleBuilder] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  const [ruleTrigger, setRuleTrigger] = useState('');
  const [ruleAmountThreshold, setRuleAmountThreshold] = useState('');
  const [ruleType, setRuleType] = useState('');
  const [createRule, setCreateRule] = useState(false);

  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatColor, setNewCatColor] = useState('#888888');
  const [newCatParentId, setNewCatParentId] = useState('');
  const [newCatIsIncome, setNewCatIsIncome] = useState(false);

  const txn = queue[idx];
  const pct = queue.length ? (idx / queue.length) * 100 : 0;
  const fmtLocal = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Math.abs(n));

  useEffect(() => {
    if (txn) {
      setShowRuleBuilder(false);
      setSelectedCatId(null);
      const keyword = txn.description
        .replace(/\s*\*\*\*.*/, '')
        .replace(/\d{4,}/g, '')
        .trim();
      setRuleTrigger(keyword);
      setRuleAmountThreshold('');
      setRuleType(txn.type || '');
      setCreateRule(false);
    }
  }, [idx, txn]);

  if (!txn) return (
    <div className="text-center py-20">
      <div className="w-12 h-12 rounded-full bg-success-bg flex items-center justify-center mx-auto mb-4 text-success text-[22px]">✓</div>
      <p className="text-xl font-medium mb-2">All done</p>
      <button className="btn-primary" onClick={onDone}>View overview</button>
    </div>
  );

  const handleSelectCategory = (catId) => {
    setSelectedCatId(catId);
    setShowRuleBuilder(true);
  };

  const handleConfirmClassify = (isRule) => {
    const ruleData = isRule ? {
      create: true,
      trigger: ruleTrigger,
      amountThreshold: ruleAmountThreshold ? parseFloat(ruleAmountThreshold) : undefined,
      type: ruleType || undefined
    } : { create: false };

    onClassify(txn, selectedCatId, ruleData);
  };

  const handleAddCategory = () => {
    if (!newCatLabel.trim()) return;
    const newCat = {
      id: `cat-${Date.now()}`,
      label: newCatLabel,
      color: newCatColor,
      parentId: newCatParentId || undefined,
      isIncome: newCatIsIncome
    };
    onSaveCategories([...categories, newCat]);
    setNewCatLabel('');
    setShowCategoryForm(false);
  };

  return (
    <div className="max-w-[700px] mx-auto">
      <div className="mb-7">
        <div className="flex justify-between mb-1.5 text-[13px] text-muted">
          <span>Classifying Transactions</span>
          <span>{idx + 1} of {queue.length}</span>
        </div>
        <div className="h-[3px] bg-raised rounded-sm">
          <div className="h-full bg-text rounded-sm transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="card px-7 py-8 text-center mb-6">
        <div className="flex justify-center gap-3 mb-4">
          <div className="px-2.5 py-1 rounded-full bg-raised text-[10px] text-muted uppercase tracking-[0.05em]">
            {txn.date || 'No Date'}
          </div>
          <div className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-[0.05em] ${txn.type === 'income' ? 'bg-success-bg text-success' : 'bg-raised text-muted'}`}>
            {txn.type === 'income' ? 'Money In' : 'Money Out'}
          </div>
          <div className="px-2.5 py-1 rounded-full bg-raised text-[10px] text-muted uppercase tracking-[0.05em]">
            {txn.account} account
          </div>
        </div>
        <p className="text-xl font-medium mb-3.5">{txn.description}</p>
        <p className={`text-[34px] font-normal font-mono ${txn.type === 'income' ? 'text-success' : 'text-text'}`}>
          {txn.type === 'income' ? '+' : '-'}{fmtLocal(txn.amount)}
        </p>
      </div>

      {!showRuleBuilder ? (
        <>
          <p className="text-[13px] text-muted mb-3 font-medium">Select a category:</p>
          <div className="grid grid-cols-3 gap-2 mb-5">
            {categories.map(c => (
              <button
                key={c.id}
                className="cat-pill"
                onClick={() => handleSelectCategory(c.id)}
                style={{ padding: c.parentId ? '8px 12px 8px 24px' : '10px 14px' }}
              >
                <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ background: c.color }} />
                <span className={c.parentId ? 'text-xs' : 'text-[13px]'}>{c.label}</span>
              </button>
            ))}
            {!showCategoryForm && (
              <button className="cat-pill border-dashed justify-center" onClick={() => setShowCategoryForm(true)}>
                + New Category
              </button>
            )}
          </div>

          {showCategoryForm && (
            <div className="bg-raised p-5 rounded-xl mb-6 border-[0.5px] border-border">
              <p className="text-xs font-semibold uppercase mb-4">Create New Category</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-[11px] text-muted mb-1 block">Label</label>
                  <input className="input-field" value={newCatLabel} onChange={e => setNewCatLabel(e.target.value)} placeholder="e.g. Subscriptions" />
                </div>
                <div>
                  <label className="text-[11px] text-muted mb-1 block">Color</label>
                  <input className="input-field !h-[38px] !p-1" type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-[11px] text-muted mb-1 block">Parent Category</label>
                  <select className="input-field" value={newCatParentId} onChange={e => setNewCatParentId(e.target.value)}>
                    <option value="">None (Top Level)</option>
                    {categories.filter(c => !c.parentId && !c.isIncome).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <label className="switch">
                    <input type="checkbox" checked={newCatIsIncome} onChange={e => setNewCatIsIncome(e.target.checked)} />
                    <span className="slider"></span>
                  </label>
                  <span className="text-xs">Income Category</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="btn-primary" onClick={handleAddCategory}>Create & Use</button>
                <button className="btn-ghost" onClick={() => setShowCategoryForm(false)}>Cancel</button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="card border-[0.5px] border-text p-6 mb-6">
          <div className="flex justify-between items-center mb-5">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full inline-block" style={{ background: categories.find(c => c.id === selectedCatId)?.color }} />
              <h3 className="text-lg font-medium">{categories.find(c => c.id === selectedCatId)?.label}</h3>
            </div>
            <button className="btn-ghost py-1 px-2 text-[11px]" onClick={() => setShowRuleBuilder(false)}>Change Category</button>
          </div>

          <div className="mb-5">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={createRule} onChange={e => setCreateRule(e.target.checked)} />
              <span className="text-sm font-medium">Create a rule for future transactions like this</span>
            </label>
          </div>

          {createRule && (
            <div className="p-4 bg-raised rounded-lg mb-5">
              <p className="text-xs text-muted uppercase font-semibold mb-4">Rule Conditions</p>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] text-muted mb-1 block">Description contains:</label>
                  <input className="input-field" value={ruleTrigger} onChange={e => setRuleTrigger(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-muted mb-1 block">Amount is over:</label>
                    <input className="input-field" type="number" value={ruleAmountThreshold} onChange={e => setRuleAmountThreshold(e.target.value)} placeholder="0.00" />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted mb-1 block">Transaction type:</label>
                    <select className="input-field" value={ruleType} onChange={e => setRuleType(e.target.value)}>
                      <option value="">Any</option>
                      <option value="expense">Money Out (Expense)</option>
                      <option value="income">Money In (Income)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button className="btn-primary flex-1 py-3" onClick={() => handleConfirmClassify(createRule)}>
              {createRule ? 'Save Rule & Classify' : 'Classify Once'}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 justify-center">
        {!showRuleBuilder && (
          <>
            <button className="btn-ghost" onClick={onSkip}>Skip</button>
            <button className="btn-ghost" onClick={onDone}>Stop</button>
          </>
        )}
      </div>
    </div>
  );
}
