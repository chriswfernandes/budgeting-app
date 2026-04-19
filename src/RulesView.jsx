import { useState } from "react";

export default function RulesView({ rules, categories, onSaveRules }) {
  const [form, setForm] = useState({ trigger: '', targetCategory: categories[0]?.id || '', amountThreshold: '', type: '' });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ trigger: '', targetCategory: '', amountThreshold: '', type: '' });
  const [search, setSearch] = useState('');

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
  
  const filteredRules = rules.filter(r => 
    r.trigger.toLowerCase().includes(search.toLowerCase()) ||
    categories.find(c => c.id === r.targetCategory)?.label.toLowerCase().includes(search.toLowerCase())
  );

  const fmt = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Math.abs(n));

  return (
    <div>
      <div style={{ marginBottom:28 }}><h1 style={{ fontSize:26, fontWeight:500, marginBottom:4 }}>Rules</h1><p style={{ color:'var(--color-text-secondary)', fontSize:14 }}>Manage categorization rules.</p></div>
      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:20, alignItems: 'start' }}>
        <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:'var(--border-radius-lg)', padding:16, position: 'sticky', top: 76 }}>
          <p style={{ fontSize:11, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:16 }}>Create Rule</p>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div><label style={{ fontSize:12, color:'var(--color-text-secondary)', marginBottom:4, display:'block' }}>Contains:</label><input className="input-f" value={form.trigger} onChange={e => setForm({...form, trigger: e.target.value})} placeholder="e.g., Starbucks" /></div>
            <div><label style={{ fontSize:12, color:'var(--color-text-secondary)', marginBottom:4, display:'block' }}>Category:</label><select className="input-f" value={form.targetCategory} onChange={e => setForm({...form, targetCategory: e.target.value})}>{categories.map(c => <option key={c.id} value={c.id}>{c.parentId ? '↳ ' + c.label : c.label}</option>)}</select></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div><label style={{ fontSize:12, color:'var(--color-text-secondary)', marginBottom:4, display:'block' }}>Amount &gt; :</label><input className="input-f" type="number" value={form.amountThreshold} onChange={e => setForm({...form, amountThreshold: e.target.value})} placeholder="0.00" /></div>
              <div><label style={{ fontSize:12, color:'var(--color-text-secondary)', marginBottom:4, display:'block' }}>Type:</label><select className="input-f" value={form.type} onChange={e => setForm({...form, type: e.target.value})}><option value="">Any</option><option value="expense">Expense</option><option value="income">Income</option></select></div>
            </div>
            <div style={{ marginTop:8 }}><button className="btn-p" style={{ width:'100%' }} onClick={saveRule}>Add Rule</button></div>
          </div>
        </div>

        <div>
          {!rules.some(r => r.targetCategory === 'cc-payment') && (
            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--color-background-info)', border: '0.5px solid var(--color-text-info)', borderRadius: 'var(--border-radius-md)', fontSize: 12, color: 'var(--color-text-info)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>💳</span>
              <span>Tip: create rules mapping <strong>"VISA PREAUTH PYMT"</strong> (checking) and <strong>"PREAUTHORIZED PAYMENT"</strong> (credit card) → <strong>CC Payment</strong> to automatically exclude credit card bill payments from your totals.</span>
            </div>
          )}
          <div style={{ padding: '8px 0', marginBottom: 12, position: 'sticky', top: 76, background: 'var(--color-background-tertiary)', zIndex: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}><span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{filteredRules.length} rules</span><input className="input-f" style={{ maxWidth: 240, padding: '6px 12px', fontSize: 13 }} placeholder="Search rules..." value={search} onChange={e => setSearch(e.target.value)} /></div>
          <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:'var(--border-radius-lg)', overflow:'hidden' }}>
            {filteredRules.map((r) => {
              const c = categories.find(cat => cat.id === r.targetCategory);
              const isEditing = editingId === r.id;

              return (
                <div key={r.id} className="txn-row" style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom: '0.5px solid var(--color-border-tertiary)', opacity: r.active || isEditing ? 1 : 0.5 }}>
                  {!isEditing && (
                    <label className="switch"><input type="checkbox" checked={r.active} onChange={() => toggle(r.id)} /><span className="slider"></span></label>
                  )}
                  
                  <div style={{ flex:1 }}>
                    {isEditing ? (
                      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap: 'wrap' }}>
                        <input className="input-f" style={{ flex:'1 1 200px', fontSize:13, padding:'4px 8px' }} value={editForm.trigger} onChange={e => setEditForm({...editForm, trigger: e.target.value})} autoFocus />
                        <select className="input-f" style={{ flex:'1 1 120px', fontSize:13, padding:'4px 8px' }} value={editForm.targetCategory} onChange={e => setEditForm({...editForm, targetCategory: e.target.value})}>
                          {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.parentId ? '↳ ' + cat.label : cat.label}</option>)}
                        </select>
                        <input className="input-f" style={{ flex:'1 1 80px', fontSize:13, padding:'4px 8px' }} type="number" value={editForm.amountThreshold} onChange={e => setEditForm({...editForm, amountThreshold: e.target.value})} placeholder="Amt >" />
                        <select className="input-f" style={{ flex:'1 1 100px', fontSize:13, padding:'4px 8px' }} value={editForm.type} onChange={e => setEditForm({...editForm, type: e.target.value})}><option value="">Any</option><option value="expense">Expense</option><option value="income">Income</option></select>
                      </div>
                    ) : (
                      <>
                        <p style={{ fontSize:14, fontWeight:500 }}>"{r.trigger}"</p>
                        <div style={{ display:'flex', alignItems:'center', gap:12, fontSize:12, color:'var(--color-text-secondary)', marginTop:2 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <span>↳</span>
                            <span style={{ width:8, height:8, borderRadius:'50%', background:c?.color||'#888', display:'inline-block' }} />
                            {c?.label || 'Unknown'}
                          </div>
                          {(r.amountThreshold || r.type) && (
                            <span style={{ opacity:0.8 }}>
                              (r.type || 'any') {r.amountThreshold ? `&gt; ${fmt(r.amountThreshold)}` : ''}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                    {isEditing ? (
                      <>
                        <button className="btn-p" style={{ padding:'4px 12px', fontSize:12 }} onClick={() => saveInlineEdit(r.id)}>Save</button>
                        <button className="btn-g" style={{ padding:'4px 12px', fontSize:12 }} onClick={() => setEditingId(null)}>✕</button>
                      </>
                    ) : (
                      <>
                        <button className="btn-g" style={{ padding:'4px 10px', fontSize:12 }} onClick={() => startInlineEdit(r)}>Edit</button>
                        <button className="btn-g" style={{ padding:'4px 10px', fontSize:12, color:'var(--color-text-danger)' }} onClick={() => del(r.id)}>✕</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

