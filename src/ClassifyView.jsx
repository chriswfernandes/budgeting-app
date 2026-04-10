import { useState, useEffect } from "react";

export default function ClassifyView({ queue, idx, categories, onClassify, onSkip, onDone, onSaveCategories }) {
  const [showRuleBuilder, setShowRuleBuilder] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  
  // Rule form state
  const [ruleTrigger, setRuleTrigger] = useState('');
  const [ruleAmountThreshold, setRuleAmountThreshold] = useState('');
  const [ruleType, setRuleType] = useState('');
  const [createRule, setCreateRule] = useState(false);

  // Category form state
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatColor, setNewCatColor] = useState('#888888');
  const [newCatParentId, setNewCatParentId] = useState('');
  const [newCatIsIncome, setNewCatIsIncome] = useState(false);

  const txn = queue[idx]; 
  const pct = queue.length ? (idx / queue.length) * 100 : 0;
  const fmtLocal = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Math.abs(n));

  // Reset states when transaction changes
  useEffect(() => {
    if (txn) {
      setShowRuleBuilder(false);
      setSelectedCatId(null);
      // Simplified keyword extraction
      const keyword = txn.description
        .replace(/\s*\*\*\*.*/, '') // Remove *** suffix
        .replace(/\d{4,}/g, '') // Remove long numbers
        .trim();
      setRuleTrigger(keyword);
      setRuleAmountThreshold('');
      setRuleType(txn.type || '');
      setCreateRule(false);
    }
  }, [idx, txn]);

  if (!txn) return (
    <div style={{ textAlign:'center', padding:'80px 0' }}>
      <div style={{ width:48, height:48, borderRadius:'50%', background:'var(--color-background-success)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', color:'var(--color-text-success)', fontSize:22 }}>V</div>
      <p style={{ fontSize:20, fontWeight:500, marginBottom:8 }}>All done</p>
      <button className="btn-p" onClick={onDone}>View overview</button>
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
    <div style={{ maxWidth:700, margin:'0 auto' }}>
      <div style={{ marginBottom:28 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:13, color:'var(--color-text-secondary)' }}>
          <span>Classifying Transactions</span>
          <span>{idx + 1} of {queue.length}</span>
        </div>
        <div style={{ height:3, background:'var(--color-background-secondary)', borderRadius:2 }}>
          <div style={{ height:'100%', width:`${pct}%`, background:'var(--color-text-primary)', borderRadius:2, transition:'width 0.3s ease' }} />
        </div>
      </div>

      <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:'var(--border-radius-lg)', padding:'32px 28px', textAlign:'center', marginBottom:24 }}>
        <div style={{ display:'flex', justifyContent:'center', gap:12, marginBottom:16 }}>
          <div style={{ padding:'4px 10px', borderRadius:20, background:'var(--color-background-secondary)', fontSize:10, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em' }}>
            {txn.date || 'No Date'}
          </div>
          <div style={{ padding:'4px 10px', borderRadius:20, background: txn.type === 'income' ? 'var(--color-background-success)' : 'var(--color-background-secondary)', fontSize:10, color: txn.type === 'income' ? 'var(--color-text-success)' : 'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em' }}>
            {txn.type === 'income' ? 'Money In' : 'Money Out'}
          </div>
          <div style={{ padding:'4px 10px', borderRadius:20, background:'var(--color-background-secondary)', fontSize:10, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em' }}>
            {txn.account} account
          </div>
        </div>
        <p style={{ fontSize:20, fontWeight:500, marginBottom:14 }}>{txn.description}</p>
        <p style={{ fontSize:34, fontWeight:400, fontFamily:'var(--font-mono)', color: txn.type === 'income' ? 'var(--color-text-success)' : 'var(--color-text-primary)' }}>
          {txn.type === 'income' ? '+' : '-'}{fmtLocal(txn.amount)}
        </p>
      </div>

      {!showRuleBuilder ? (
        <>
          <p style={{ fontSize:13, color:'var(--color-text-secondary)', marginBottom:12, fontWeight:500 }}>Select a category:</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8, marginBottom:20 }}>
            {categories.map(c => (
              <button key={c.id} className="cat-pill" onClick={() => handleSelectCategory(c.id)} style={{ padding: c.parentId ? '8px 12px 8px 24px' : '10px 14px' }}>
                <span style={{ width:10, height:10, borderRadius:'50%', background:c.color, display:'inline-block', flexShrink:0 }} />
                <span style={{ fontSize: c.parentId ? 12 : 13 }}>{c.label}</span>
              </button>
            ))}
            {!showCategoryForm && (
              <button className="cat-pill" style={{ borderStyle:'dashed', justifyContent:'center' }} onClick={() => setShowCategoryForm(true)}>
                + New Category
              </button>
            )}
          </div>

          {showCategoryForm && (
            <div style={{ background:'var(--color-background-secondary)', padding:20, borderRadius:12, marginBottom:24, border:'0.5px solid var(--color-border-secondary)' }}>
              <p style={{ fontSize:12, fontWeight:600, textTransform:'uppercase', marginBottom:16 }}>Create New Category</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div>
                  <label style={{ fontSize:11, color:'var(--color-text-secondary)', marginBottom:4, display:'block' }}>Label</label>
                  <input className="input-f" value={newCatLabel} onChange={e => setNewCatLabel(e.target.value)} placeholder="e.g. Subscriptions" />
                </div>
                <div>
                  <label style={{ fontSize:11, color:'var(--color-text-secondary)', marginBottom:4, display:'block' }}>Color</label>
                  <input className="input-f" type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} style={{ height:38, padding:4 }} />
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                <div>
                  <label style={{ fontSize:11, color:'var(--color-text-secondary)', marginBottom:4, display:'block' }}>Parent Category</label>
                  <select className="input-f" value={newCatParentId} onChange={e => setNewCatParentId(e.target.value)}>
                    <option value="">None (Top Level)</option>
                    {categories.filter(c => !c.parentId && !c.isIncome).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, paddingTop:20 }}>
                  <label className="switch">
                    <input type="checkbox" checked={newCatIsIncome} onChange={e => setNewCatIsIncome(e.target.checked)} />
                    <span className="slider"></span>
                  </label>
                  <span style={{ fontSize:12 }}>Income Category</span>
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn-p" onClick={handleAddCategory}>Create & Use</button>
                <button className="btn-g" onClick={() => setShowCategoryForm(false)}>Cancel</button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ background:'var(--color-background-primary)', border:'1px solid var(--color-text-primary)', borderRadius:'var(--border-radius-lg)', padding:24, marginBottom:24 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ width:12, height:12, borderRadius:'50%', background: categories.find(c => c.id === selectedCatId)?.color }} />
              <h3 style={{ fontSize:18, fontWeight:500 }}>{categories.find(c => c.id === selectedCatId)?.label}</h3>
            </div>
            <button className="btn-g" style={{ padding:'4px 8px', fontSize:11 }} onClick={() => setShowRuleBuilder(false)}>Change Category</button>
          </div>

          <div style={{ marginBottom:20 }}>
            <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
              <input type="checkbox" checked={createRule} onChange={e => setCreateRule(e.target.checked)} />
              <span style={{ fontSize:14, fontWeight:500 }}>Create a rule for future transactions like this</span>
            </label>
          </div>

          {createRule && (
            <div style={{ padding:16, background:'var(--color-background-secondary)', borderRadius:8, marginBottom:20 }}>
              <p style={{ fontSize:12, color:'var(--color-text-secondary)', textTransform:'uppercase', fontWeight:600, marginBottom:16 }}>Rule Conditions</p>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div>
                  <label style={{ fontSize:11, color:'var(--color-text-secondary)', marginBottom:4, display:'block' }}>Description contains:</label>
                  <input className="input-f" value={ruleTrigger} onChange={e => setRuleTrigger(e.target.value)} />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label style={{ fontSize:11, color:'var(--color-text-secondary)', marginBottom:4, display:'block' }}>Amount is over:</label>
                    <input className="input-f" type="number" value={ruleAmountThreshold} onChange={e => setRuleAmountThreshold(e.target.value)} placeholder="0.00" />
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:'var(--color-text-secondary)', marginBottom:4, display:'block' }}>Transaction type:</label>
                    <select className="input-f" value={ruleType} onChange={e => setRuleType(e.target.value)}>
                      <option value="">Any</option>
                      <option value="expense">Money Out (Expense)</option>
                      <option value="income">Money In (Income)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ display:'flex', gap:12 }}>
            <button className="btn-p" style={{ flex:1, padding:12 }} onClick={() => handleConfirmClassify(createRule)}>
              {createRule ? 'Save Rule & Classify' : 'Classify Once'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
        {!showRuleBuilder && (
          <>
            <button className="btn-g" onClick={onSkip}>Skip</button>
            <button className="btn-g" style={{ color:'var(--color-text-secondary)' }} onClick={onDone}>Stop</button>
          </>
        )}
      </div>
    </div>
  );
}
