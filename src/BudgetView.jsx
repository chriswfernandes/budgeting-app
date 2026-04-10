import { useState } from "react";

export default function BudgetView({ categories, globalBudgets, onSaveGlobalBudgets, incomeSources, onSaveIncomeSources, year }) {
  const [activeTab, setActiveTab] = useState('categories');
  const [selectedCatId, setSelectedCatId] = useState(null);
  const [limitInput, setLimitInput] = useState('');
  
  const [isEditingIncome, setIsEditingIncome] = useState(null);
  const [incomeForm, setIncomeForm] = useState({ label: '', amount: '' });
  const [isAddingIncome, setIsAddingIncome] = useState(false);

  const fmt = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Math.abs(n));

  // --- Category Budget Logic ---
  const handleSelectCat = (cat) => {
    setSelectedCatId(cat.id);
    setLimitInput(globalBudgets[cat.id]?.toString() || '');
  };

  const saveGlobalLimit = () => {
    const val = parseFloat(limitInput);
    const updated = { ...globalBudgets };
    if (isNaN(val) || val <= 0) {
      delete updated[selectedCatId];
    } else {
      updated[selectedCatId] = val;
    }
    onSaveGlobalBudgets(updated);
  };

  const totalBudgeted = Object.values(globalBudgets).reduce((s, v) => s + (v || 0), 0);

  // --- Income Source Logic ---
  const saveIncomeSource = () => {
    if (!incomeForm.label.trim()) return;
    const amount = parseFloat(incomeForm.amount) || 0;
    let updated;
    if (isEditingIncome) {
      updated = incomeSources.map(s => s.id === isEditingIncome ? { ...s, label: incomeForm.label, amount } : s);
    } else {
      updated = [...incomeSources, { id: `inc-${Date.now()}`, label: incomeForm.label, amount, active: true }];
    }
    onSaveIncomeSources(updated);
    setIncomeForm({ label: '', amount: '' });
    setIsEditingIncome(null);
    setIsAddingIncome(false);
  };

  const toggleIncome = (id) => {
    onSaveIncomeSources(incomeSources.map(s => s.id === id ? { ...s, active: !s.active } : s));
  };

  const removeIncome = (id) => {
    if (window.confirm("This will remove this income from all months that haven't been manually adjusted. Are you sure?")) {
      onSaveIncomeSources(incomeSources.filter(s => s.id !== id));
    }
  };

  const startEditIncome = (source) => {
    setIsEditingIncome(source.id);
    setIncomeForm({ label: source.label, amount: source.amount.toString() });
  };

  const activeIncomeTotal = incomeSources.filter(s => s.active).reduce((s, src) => s + src.amount, 0);

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 4 }}>Budgeting for {year}</h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>Set global targets and manage your income streams.</p>
      </div>

      {/* Section Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '0.5px solid var(--color-border-tertiary)', paddingBottom: 12 }}>
        <button className={`nav-tab ${activeTab === 'categories' ? 'active' : ''}`} onClick={() => setActiveTab('categories')}>Category Budgets</button>
        <button className={`nav-tab ${activeTab === 'income' ? 'active' : ''}`} onClick={() => setActiveTab('income')}>Income Sources</button>
      </div>

      {activeTab === 'categories' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, alignItems: 'start' }}>
          {/* Sidebar */}
          <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-lg)', padding: 16, position: 'sticky', top: 120 }}>
            <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>Select Category</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {categories.filter(c => !c.isIncome).map(c => (
                <button 
                  key={c.id} 
                  onClick={() => handleSelectCat(c)}
                  style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: selectedCatId === c.id ? 'var(--color-background-secondary)' : 'transparent',
                    color: 'var(--color-text-primary)', textAlign: 'left', fontSize: 13, fontFamily: 'var(--font-sans)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />
                    <span style={{ marginLeft: c.parentId ? 12 : 0 }}>{c.label}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    {globalBudgets[c.id] ? fmt(globalBudgets[c.id]) : 'No limit'}
                  </span>
                </button>
              ))}
            </div>
            <div style={{ marginTop: 20, paddingTop: 12, borderTop: '0.5px solid var(--color-border-tertiary)', display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 500 }}>
              <span>Total budgeted:</span>
              <span>{fmt(totalBudgeted)}</span>
            </div>
          </div>

          {/* Edit Panel */}
          <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-lg)', padding: 32 }}>
            {selectedCatId ? (
              <div style={{ maxWidth: 400 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                  <span style={{ width: 16, height: 16, borderRadius: '50%', background: getcat(selectedCatId).color }} />
                  <h2 style={{ fontSize: 20, fontWeight: 500 }}>{getcat(selectedCatId).label}</h2>
                </div>
                
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 8, display: 'block' }}>Monthly limit (CAD)</label>
                  <input 
                    className="input-f" 
                    type="number" 
                    value={limitInput} 
                    onChange={e => setLimitInput(e.target.value)}
                    placeholder="No limit" 
                    style={{ fontSize: 16, padding: '12px' }}
                  />
                  <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 8 }}>
                    This applies to all months unless overridden in a specific month's view.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button className="btn-p" style={{ padding: '10px 24px' }} onClick={saveGlobalLimit}>Save Limit</button>
                  {globalBudgets[selectedCatId] && (
                    <button className="btn-g" style={{ padding: '10px 24px' }} onClick={() => { setLimitInput(''); onSaveGlobalBudgets({ ...globalBudgets, [selectedCatId]: undefined }); }}>Clear Limit</button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-secondary)' }}>
                <p>Select a category from the list to set its global monthly budget.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: 800 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 500 }}>Recurring Income Streams</h2>
            {!isAddingIncome && <button className="btn-p" onClick={() => setIsAddingIncome(true)}>+ Add Income Source</button>}
          </div>

          {(isAddingIncome || isEditingIncome) && (
            <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--border-radius-lg)', padding: 20, marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>{isEditingIncome ? 'Edit Income Source' : 'New Income Source'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' }}>Label</label>
                  <input className="input-f" value={incomeForm.label} onChange={e => setIncomeForm({...incomeForm, label: e.target.value})} placeholder="e.g. Salary" autoFocus />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4, display: 'block' }}>Monthly Amount</label>
                  <input className="input-f" type="number" value={incomeForm.amount} onChange={e => setIncomeForm({...incomeForm, amount: e.target.value})} placeholder="0.00" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-p" onClick={saveIncomeSource}>Save Source</button>
                <button className="btn-g" onClick={() => { setIsAddingIncome(false); setIsEditingIncome(null); setIncomeForm({ label: '', amount: '' }); }}>Cancel</button>
              </div>
            </div>
          )}

          <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-lg)', overflow: 'hidden' }}>
            {incomeSources.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>No recurring income sources configured.</div>
            ) : (
              incomeSources.map((source, i) => (
                <div key={source.id} className="txn-row" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderBottom: i < incomeSources.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none', opacity: source.active ? 1 : 0.5 }}>
                  <label className="switch">
                    <input type="checkbox" checked={source.active} onChange={() => toggleIncome(source.id)} />
                    <span className="slider"></span>
                  </label>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 15 }}>{source.label}</div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{source.active ? 'Active' : 'Inactive'}</div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{fmt(source.amount)}/mo</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-g" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => startEditIncome(source)}>Edit</button>
                    <button className="btn-g" style={{ padding: '6px 12px', fontSize: 12, color: 'var(--color-text-danger)' }} onClick={() => removeIncome(source.id)}>Remove</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ marginTop: 24, padding: '16px 20px', background: 'var(--color-background-secondary)', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 500 }}>Combined monthly income:</span>
            <span style={{ fontSize: 20, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--color-text-success)' }}>{fmt(activeIncomeTotal)}</span>
          </div>
        </div>
      )}
    </div>
  );

  function getcat(id) {
    return categories.find(c => c.id === id) || { label: 'Unknown', color: '#888' };
  }
}
