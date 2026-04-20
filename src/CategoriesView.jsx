import { useState } from "react";

export default function CategoriesView({ categories, onSaveCategories }) {
  const [form, setForm] = useState({ label: '', color: '#888888', parentId: '', isIncome: false });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ label: '', color: '', parentId: '', isIncome: false });
  const [search, setSearch] = useState('');
  const [collapsedIds, setCollapsedIds] = useState(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const SYSTEM_CATEGORY_IDS = ['cc-payment', 'income'];

  const saveCategory = () => {
    if (!form.label.trim()) return;
    const catData = {
      label: form.label,
      color: form.color,
      parentId: form.parentId || undefined,
      isIncome: form.parentId ? false : form.isIncome,
    };
    onSaveCategories([...categories, { id: `cat-${Date.now()}`, ...catData }]);
    setForm({ label: '', color: '#888888', parentId: '', isIncome: false });
  };

  const saveInlineEdit = (id) => {
    if (!editForm.label.trim()) return;
    const catData = {
      label: editForm.label,
      color: editForm.color,
      parentId: editForm.parentId || undefined,
      isIncome: editForm.parentId ? false : editForm.isIncome,
    };
    onSaveCategories(categories.map(c => c.id === id ? { ...c, ...catData } : c));
    setEditingId(null);
  };

  const startInlineEdit = (cat) => {
    setEditingId(cat.id);
    setEditForm({ label: cat.label, color: cat.color, parentId: cat.parentId || '', isIncome: cat.isIncome || false });
  };

  const toggleCollapse = (id) => {
    const next = new Set(collapsedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCollapsedIds(next);
  };

  const del = (id) => {
    if (SYSTEM_CATEGORY_IDS.includes(id)) return;
    onSaveCategories(categories.filter(c => c.id !== id && c.parentId !== id));
    setConfirmDeleteId(null);
  };

  const parents = categories.filter(c => !c.parentId);
  const filteredCategories = categories.filter(c => c.label.toLowerCase().includes(search.toLowerCase()));
  const filteredParents = parents.filter(p =>
    p.label.toLowerCase().includes(search.toLowerCase()) ||
    categories.some(c => c.parentId === p.id && c.label.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontSize:26, fontWeight:500, marginBottom:4 }}>Categories</h1>
        <p style={{ color:'var(--color-text-secondary)', fontSize:14 }}>Manage budget categories.</p>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'280px 1fr', gap:20, alignItems: 'start' }}>
        <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:'var(--border-radius-lg)', padding:16, position: 'sticky', top: 76 }}>
          <p style={{ fontSize:11, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:16 }}>Create Category</p>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div>
              <label style={{ fontSize:12, color:'var(--color-text-secondary)', marginBottom:4, display:'block' }}>Name:</label>
              <input className="input-f" value={form.label} onChange={e => setForm({...form, label: e.target.value})} placeholder="e.g., Groceries" />
            </div>
            <div>
              <label style={{ fontSize:12, color:'var(--color-text-secondary)', marginBottom:4, display:'block' }}>Color:</label>
              <div style={{ display:'flex', gap:8 }}>
                <input type="color" value={form.color} onChange={e => setForm({...form, color: e.target.value})} style={{ width:40, height:34, border:'none', background:'none', cursor:'pointer' }} />
                <input className="input-f" value={form.color} onChange={e => setForm({...form, color: e.target.value})} />
              </div>
            </div>
            <div>
              <label style={{ fontSize:12, color:'var(--color-text-secondary)', marginBottom:4, display:'block' }}>Parent:</label>
              <select className="input-f" value={form.parentId} onChange={e => setForm({...form, parentId: e.target.value})}>
                <option value="">None</option>
                {parents.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            {!form.parentId && (
              <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
                <label className="switch" style={{ width:30, height:16 }}>
                  <input type="checkbox" checked={form.isIncome} onChange={e => setForm({...form, isIncome: e.target.checked})} />
                  <span className="slider" style={{ borderRadius:16 }}></span>
                </label>
                <span style={{ fontSize:12, color:'var(--color-text-secondary)' }}>Is Income?</span>
              </div>
            )}
            <div style={{ marginTop:8 }}>
              <button className="btn-p" style={{ width:'100%' }} onClick={saveCategory}>Add Category</button>
            </div>
          </div>
        </div>

        <div>
          <div style={{ padding: '8px 0', marginBottom: 12, position: 'sticky', top: 76, background: 'var(--color-background-tertiary)', zIndex: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{filteredCategories.length} cats</span>
            <input className="input-f" style={{ maxWidth: 240, padding: '6px 12px', fontSize: 13 }} placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:'var(--border-radius-lg)', overflow:'hidden' }}>
            {filteredParents.map((p) => {
              const children = categories.filter(c => c.parentId === p.id && (c.label.toLowerCase().includes(search.toLowerCase()) || p.label.toLowerCase().includes(search.toLowerCase())));
              const isEditingP = editingId === p.id;
              const isCollapsed = collapsedIds.has(p.id);

              return (
                <div key={p.id} style={{ borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
                  <div className="txn-row" style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px' }}>
                    <button onClick={() => toggleCollapse(p.id)} style={{ background:'none', border:'none', color:'var(--color-text-secondary)', cursor:'pointer', padding:0, fontSize:10, width:16, display:'flex', alignItems:'center', justifyContent:'center', visibility: children.length > 0 ? 'visible' : 'hidden' }}>
                      {isCollapsed ? '▶' : '▼'}
                    </button>
                    {isEditingP ? (
                      <div style={{ display:'flex', gap:8, alignItems:'center', flex:1 }}>
                        <input type="color" value={editForm.color} onChange={e => setEditForm({...editForm, color: e.target.value})} style={{ width:24, height:24, border:'none', background:'none' }} />
                        <input className="input-f" style={{ flex:2, fontSize:13, padding:'4px 8px' }} value={editForm.label} onChange={e => setEditForm({...editForm, label: e.target.value})} autoFocus />
                        <label className="switch" style={{ width:24, height:14 }} title="Is Income?">
                          <input type="checkbox" checked={editForm.isIncome} onChange={e => setEditForm({...editForm, isIncome: e.target.checked})} />
                          <span className="slider"></span>
                        </label>
                      </div>
                    ) : (
                      <>
                        <span style={{ width:12, height:12, borderRadius:'50%', background:p.color, display:'inline-block' }} />
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:500, fontSize:14 }}>{p.label}</div>
                        </div>
                      </>
                    )}
                    <div style={{ display:'flex', gap:8 }}>
                      {isEditingP ? (
                        <>
                          <button className="btn-p" style={{ padding:'4px 12px', fontSize:12 }} onClick={() => saveInlineEdit(p.id)}>Save</button>
                          <button className="btn-g" style={{ padding:'4px 12px', fontSize:12 }} onClick={() => setEditingId(null)}>✕</button>
                        </>
                      ) : (
                        <>
                          <button className="btn-g" style={{ padding:'4px 10px', fontSize:12 }} onClick={() => startInlineEdit(p)}>Edit</button>
                          {confirmDeleteId === p.id ? (
                            <>
                              <button className="btn-g" style={{ padding:'4px 10px', fontSize:12, color:'var(--color-text-danger)' }} onClick={() => del(p.id)}>Confirm</button>
                              <button className="btn-g" style={{ padding:'4px 10px', fontSize:12 }} onClick={() => setConfirmDeleteId(null)}>✕</button>
                            </>
                          ) : !SYSTEM_CATEGORY_IDS.includes(p.id) && (
                            <button className="btn-g" style={{ padding:'4px 10px', fontSize:12, color:'var(--color-text-danger)' }} onClick={() => setConfirmDeleteId(p.id)}>✕</button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {!isCollapsed && children.map((c) => {
                    const isEditingC = editingId === c.id;
                    return (
                      <div key={c.id} className="txn-row" style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px 10px 40px', background:'var(--color-background-secondary)', borderTop:'0.5px solid var(--color-border-tertiary)' }}>
                        {isEditingC ? (
                          <div style={{ display:'flex', gap:8, alignItems:'center', flex:1 }}>
                            <input type="color" value={editForm.color} onChange={e => setEditForm({...editForm, color: e.target.value})} style={{ width:20, height:20, border:'none', background:'none' }} />
                            <input className="input-f" style={{ flex:2, fontSize:12, padding:'3px 6px' }} value={editForm.label} onChange={e => setEditForm({...editForm, label: e.target.value})} autoFocus />
                            <select className="input-f" style={{ flex:1, fontSize:12, padding:'3px 6px' }} value={editForm.parentId} onChange={e => setEditForm({...editForm, parentId: e.target.value})}>
                              <option value="">None</option>
                              {parents.filter(par => par.id !== c.id).map(par => <option key={par.id} value={par.id}>{par.label}</option>)}
                            </select>
                          </div>
                        ) : (
                          <>
                            <span style={{ width:8, height:8, borderRadius:'50%', background:c.color, display:'inline-block' }} />
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:13 }}>{c.label}</div>
                            </div>
                          </>
                        )}
                        <div style={{ display:'flex', gap:8 }}>
                          {isEditingC ? (
                            <>
                              <button className="btn-p" style={{ padding:'3px 10px', fontSize:11 }} onClick={() => saveInlineEdit(c.id)}>Save</button>
                              <button className="btn-g" style={{ padding:'3px 10px', fontSize:11 }} onClick={() => setEditingId(null)}>✕</button>
                            </>
                          ) : (
                            <>
                              <button className="btn-g" style={{ padding:'3px 8px', fontSize:11 }} onClick={() => startInlineEdit(c)}>Edit</button>
                              {confirmDeleteId === c.id ? (
                                <>
                                  <button className="btn-g" style={{ padding:'3px 8px', fontSize:11, color:'var(--color-text-danger)' }} onClick={() => del(c.id)}>Confirm</button>
                                  <button className="btn-g" style={{ padding:'3px 8px', fontSize:11 }} onClick={() => setConfirmDeleteId(null)}>✕</button>
                                </>
                              ) : !SYSTEM_CATEGORY_IDS.includes(c.id) && (
                                <button className="btn-g" style={{ padding:'3px 8px', fontSize:11, color:'var(--color-text-danger)' }} onClick={() => setConfirmDeleteId(c.id)}>✕</button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
