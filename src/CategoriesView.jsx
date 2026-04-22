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
      <div className="mb-7">
        <h1 className="text-[28px] font-semibold mb-1">Categories</h1>
        <p className="text-sm text-muted">Manage budget categories.</p>
      </div>
      <div className="grid grid-cols-[280px_1fr] gap-5 items-start">
        <div className="card p-4 sticky top-[76px]">
          <p className="text-xs text-muted mb-4">Create Category</p>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-muted mb-1 block">Name:</label>
              <input className="input-field" value={form.label} onChange={e => setForm({...form, label: e.target.value})} placeholder="e.g., Groceries" />
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Color:</label>
              <div className="flex items-center gap-2">
                <div className="relative shrink-0">
                  <span className="w-7 h-7 rounded-full inline-block border-[0.5px] border-border-subtle" style={{ background: form.color }} />
                  <input type="color" value={form.color} onChange={e => setForm({...form, color: e.target.value})} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                </div>
                <input className="input-field" value={form.color} onChange={e => setForm({...form, color: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted mb-1 block">Parent:</label>
              <select className="input-field" value={form.parentId} onChange={e => setForm({...form, parentId: e.target.value})}>
                <option value="">None</option>
                {parents.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            {!form.parentId && (
              <div className="flex items-center gap-2 mt-1">
                <label className="switch">
                  <input type="checkbox" checked={form.isIncome} onChange={e => setForm({...form, isIncome: e.target.checked})} />
                  <span className="slider"></span>
                </label>
                <span className="text-xs text-muted">Is Income?</span>
              </div>
            )}
            <div className="mt-2">
              <button className="btn-primary w-full" onClick={saveCategory}>Add Category</button>
            </div>
          </div>
        </div>

        <div>
          <div className="py-2 mb-3 sticky top-[76px] bg-bg z-[5] flex justify-between items-center gap-4">
            <span className="text-[13px] text-muted">{filteredCategories.length} cats</span>
            <input className="input-field" style={{ maxWidth: 240, padding: '6px 12px', fontSize: 13 }} placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="card overflow-hidden">
            {filteredParents.map((p) => {
              const children = categories.filter(c => c.parentId === p.id && (c.label.toLowerCase().includes(search.toLowerCase()) || p.label.toLowerCase().includes(search.toLowerCase())));
              const isEditingP = editingId === p.id;
              const isCollapsed = collapsedIds.has(p.id);

              return (
                <div key={p.id} className="border-b-[0.5px] border-border-subtle last:border-b-0">
                  <div className="txn-row flex items-center gap-3 px-4 py-3">
                    <button
                      onClick={() => toggleCollapse(p.id)}
                      className="bg-transparent border-0 text-muted cursor-pointer p-0 text-[10px] w-4 flex items-center justify-center"
                      style={{ visibility: children.length > 0 ? 'visible' : 'hidden' }}
                    >
                      {isCollapsed ? '▶' : '▼'}
                    </button>
                    {isEditingP ? (
                      <div className="flex gap-2 items-center flex-1">
                        <div className="relative shrink-0">
                          <span className="w-6 h-6 rounded-full inline-block border-[0.5px] border-border-subtle" style={{ background: editForm.color }} />
                          <input type="color" value={editForm.color} onChange={e => setEditForm({...editForm, color: e.target.value})} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                        </div>
                        <input className="input-field flex-[2] !text-[13px] !py-1 !px-2" value={editForm.label} onChange={e => setEditForm({...editForm, label: e.target.value})} autoFocus />
                        <label className="switch" title="Is Income?">
                          <input type="checkbox" checked={editForm.isIncome} onChange={e => setEditForm({...editForm, isIncome: e.target.checked})} />
                          <span className="slider"></span>
                        </label>
                      </div>
                    ) : (
                      <>
                        <span className="w-3 h-3 rounded-full inline-block" style={{ background: p.color }} />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{p.label}</div>
                        </div>
                      </>
                    )}
                    <div className="flex gap-2">
                      {isEditingP ? (
                        <>
                          <button className="btn-primary py-1 px-3 text-xs" onClick={() => saveInlineEdit(p.id)}>Save</button>
                          <button className="btn-ghost py-1 px-3 text-xs" onClick={() => setEditingId(null)}>✕</button>
                        </>
                      ) : (
                        <>
                          <button className="btn-ghost py-1 px-2.5 text-xs" onClick={() => startInlineEdit(p)}>Edit</button>
                          {confirmDeleteId === p.id ? (
                            <>
                              <button className="btn-ghost py-1 px-2.5 text-xs text-danger" onClick={() => del(p.id)}>Confirm</button>
                              <button className="btn-ghost py-1 px-2.5 text-xs" onClick={() => setConfirmDeleteId(null)}>✕</button>
                            </>
                          ) : !SYSTEM_CATEGORY_IDS.includes(p.id) && (
                            <button className="btn-ghost py-1 px-2.5 text-xs text-danger" onClick={() => setConfirmDeleteId(p.id)}>✕</button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {!isCollapsed && children.map((c) => {
                    const isEditingC = editingId === c.id;
                    return (
                      <div key={c.id} className="txn-row flex items-center gap-3 pl-10 pr-4 py-3 bg-raised border-t-[0.5px] border-border-subtle">
                        {isEditingC ? (
                          <div className="flex gap-2 items-center flex-1">
                            <div className="relative shrink-0">
                              <span className="w-5 h-5 rounded-full inline-block border-[0.5px] border-border-subtle" style={{ background: editForm.color }} />
                              <input type="color" value={editForm.color} onChange={e => setEditForm({...editForm, color: e.target.value})} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                            </div>
                            <input className="input-field flex-[2] !text-xs !py-[3px] !px-1.5" value={editForm.label} onChange={e => setEditForm({...editForm, label: e.target.value})} autoFocus />
                            <select className="input-field flex-1 !text-xs !py-[3px] !px-1.5" value={editForm.parentId} onChange={e => setEditForm({...editForm, parentId: e.target.value})}>
                              <option value="">None</option>
                              {parents.filter(par => par.id !== c.id).map(par => <option key={par.id} value={par.id}>{par.label}</option>)}
                            </select>
                          </div>
                        ) : (
                          <>
                            <span className="w-2 h-2 rounded-full inline-block" style={{ background: c.color }} />
                            <div className="flex-1">
                              <div className="text-[13px]">{c.label}</div>
                            </div>
                          </>
                        )}
                        <div className="flex gap-2">
                          {isEditingC ? (
                            <>
                              <button className="btn-primary py-[3px] px-2.5 text-[11px]" onClick={() => saveInlineEdit(c.id)}>Save</button>
                              <button className="btn-ghost py-[3px] px-2.5 text-[11px]" onClick={() => setEditingId(null)}>✕</button>
                            </>
                          ) : (
                            <>
                              <button className="btn-ghost py-[3px] px-2 text-[11px]" onClick={() => startInlineEdit(c)}>Edit</button>
                              {confirmDeleteId === c.id ? (
                                <>
                                  <button className="btn-ghost py-[3px] px-2 text-[11px] text-danger" onClick={() => del(c.id)}>Confirm</button>
                                  <button className="btn-ghost py-[3px] px-2 text-[11px]" onClick={() => setConfirmDeleteId(null)}>✕</button>
                                </>
                              ) : !SYSTEM_CATEGORY_IDS.includes(c.id) && (
                                <button className="btn-ghost py-[3px] px-2 text-[11px] text-danger" onClick={() => setConfirmDeleteId(c.id)}>✕</button>
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
