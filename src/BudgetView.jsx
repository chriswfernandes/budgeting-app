import { useState } from "react";
import { resolveMonthBudget } from "./utils";

const fmt = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Math.abs(n));

const fmtMonth = yyyyMM => {
  const [y, m] = yyyyMM.split('-');
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-CA', { month: 'short', year: 'numeric' });
};

const hasOverlap = (entries, newStart, newEnd, excludeId = null) => {
  const end = newEnd || '9999-12';
  return entries.filter(e => e.id !== excludeId).some(e => {
    const existEnd = e.endDate || '9999-12';
    return newStart <= existEnd && end >= e.startDate;
  });
};

function EntryList({ entries, onSave, onDelete }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ amount: '', startDate: '', endDate: '', noEndDate: true });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [error, setError] = useState('');

  const resetForm = () => {
    setForm({ amount: '', startDate: '', endDate: '', noEndDate: true });
    setError('');
  };

  const openAdd = () => { resetForm(); setEditingId(null); setAdding(true); };
  const openEdit = (entry) => {
    setForm({ amount: String(entry.amount), startDate: entry.startDate, endDate: entry.endDate || '', noEndDate: entry.endDate === null });
    setEditingId(entry.id);
    setAdding(false);
    setError('');
  };

  const cancelForm = () => { setAdding(false); setEditingId(null); resetForm(); };

  const saveEntry = () => {
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) { setError('Amount must be greater than 0.'); return; }
    if (!form.startDate) { setError('Start month is required.'); return; }
    const endDate = form.noEndDate ? null : (form.endDate || null);
    if (!form.noEndDate && endDate && endDate < form.startDate) {
      setError('End month must be after start month.');
      return;
    }
    if (hasOverlap(entries, form.startDate, endDate, editingId)) {
      const conflict = entries.filter(e => e.id !== editingId).find(e => {
        const existEnd = e.endDate || '9999-12';
        const end = endDate || '9999-12';
        return form.startDate <= existEnd && end >= e.startDate;
      });
      setError(`Overlaps with existing entry (${fmtMonth(conflict.startDate)} – ${conflict.endDate ? fmtMonth(conflict.endDate) : 'onwards'}).`);
      return;
    }
    const entry = { id: editingId || `be-${Date.now()}`, amount, startDate: form.startDate, endDate };
    const updated = editingId
      ? entries.map(e => e.id === editingId ? entry : e)
      : [...entries, entry].sort((a, b) => a.startDate.localeCompare(b.startDate));
    onSave(updated);
    cancelForm();
  };

  const sorted = [...entries].sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <div>
      {sorted.length === 0 && !adding && (
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontStyle: 'italic', marginBottom: 16 }}>No budget periods set.</p>
      )}

      {sorted.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
          <thead>
            <tr style={{ background: 'var(--color-background-secondary)', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
              {['From', 'To', 'Amount', ''].map(h => (
                <th key={h} style={{ padding: '8px 12px', fontWeight: 500, textAlign: h === 'Amount' ? 'right' : 'left', color: 'var(--color-text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((e, i) => (
              <tr key={e.id} style={{ borderBottom: i < sorted.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none' }}>
                <td style={{ padding: '10px 12px' }}>{fmtMonth(e.startDate)}</td>
                <td style={{ padding: '10px 12px', color: e.endDate ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                  {e.endDate ? fmtMonth(e.endDate) : 'onwards'}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{fmt(e.amount)}/mo</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {confirmDeleteId === e.id ? (
                    <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--color-text-danger)' }}>Delete?</span>
                      <button className="btn-g" style={{ padding: '3px 8px', fontSize: 11, color: 'var(--color-text-danger)' }} onClick={() => { onDelete(e.id); setConfirmDeleteId(null); }}>Confirm</button>
                      <button className="btn-g" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                    </span>
                  ) : (
                    <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn-g" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => openEdit(e)}>Edit</button>
                      <button className="btn-g" style={{ padding: '3px 8px', fontSize: 11, color: 'var(--color-text-danger)' }} onClick={() => setConfirmDeleteId(e.id)}>Delete</button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {(adding || editingId) && (
        <div style={{ background: 'var(--color-background-secondary)', border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--border-radius-md)', padding: 16, marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 12 }}>{editingId ? 'Edit period' : 'Add period'}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Monthly amount (CAD) *</label>
              <input className="input-f" type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" autoFocus />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Start month *</label>
              <input className="input-f" type="month" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>End month</label>
              <input className="input-f" type="month" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} disabled={form.noEndDate} style={{ opacity: form.noEndDate ? 0.4 : 1 }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.noEndDate} onChange={e => setForm({ ...form, noEndDate: e.target.checked, endDate: e.target.checked ? '' : form.endDate })} />
                No end date
              </label>
            </div>
          </div>
          {error && <p style={{ fontSize: 12, color: 'var(--color-text-danger)', marginBottom: 8 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-p" style={{ padding: '6px 16px', fontSize: 12 }} onClick={saveEntry}>Save</button>
            <button className="btn-g" style={{ padding: '6px 12px', fontSize: 12 }} onClick={cancelForm}>Cancel</button>
          </div>
        </div>
      )}

      {!adding && !editingId && (
        <button className="btn-g" style={{ fontSize: 12, padding: '6px 14px' }} onClick={openAdd}>+ Add period</button>
      )}
    </div>
  );
}

export default function BudgetView({ categories, budgetEntries, onSaveBudgetEntries, incomeSources, onSaveIncomeSources, year }) {
  const [activeTab, setActiveTab] = useState('outgoing');

  // Outgoing tab state
  const [selectedCatId, setSelectedCatId] = useState(null);

  // Income tab state
  const [selectedSourceId, setSelectedSourceId] = useState(null);
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [newSourceLabel, setNewSourceLabel] = useState('');
  const [editingSourceId, setEditingSourceId] = useState(null);
  const [sourceLabelInput, setSourceLabelInput] = useState('');
  const [confirmDeleteSourceId, setConfirmDeleteSourceId] = useState(null);

  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();

  // ── Outgoing helpers ──────────────────────────────────────────────────────

  const getCatEntries = (catId) => budgetEntries[catId] || [];

  const saveCatEntries = (catId, entries) => {
    onSaveBudgetEntries({ ...budgetEntries, [catId]: entries });
  };

  const deleteEntry = (catId, entryId) => {
    const updated = getCatEntries(catId).filter(e => e.id !== entryId);
    onSaveBudgetEntries({ ...budgetEntries, [catId]: updated });
  };

  const activeMonthTotal = categories
    .filter(c => !c.isIncome)
    .reduce((sum, c) => {
      const val = resolveMonthBudget(budgetEntries, {}, c.id, curYear, curMonth);
      return sum + (val || 0);
    }, 0);

  const getCatDisplayValue = (catId) => {
    const entries = getCatEntries(catId);
    if (!entries.length) return null;
    const key = `${curYear}-${String(curMonth + 1).padStart(2, '0')}`;
    const active = entries.find(e => e.startDate <= key && (e.endDate === null || e.endDate >= key));
    if (active) return fmt(active.amount);
    return `${entries.length} ${entries.length === 1 ? 'period' : 'periods'}`;
  };

  // ── Income helpers ────────────────────────────────────────────────────────

  const getSourceEntries = (sourceId) => {
    const source = incomeSources.find(s => s.id === sourceId);
    return source?.entries || [];
  };

  const saveSourceEntries = (sourceId, entries) => {
    onSaveIncomeSources(incomeSources.map(s => s.id === sourceId ? { ...s, entries } : s));
  };

  const deleteSourceEntry = (sourceId, entryId) => {
    const entries = getSourceEntries(sourceId).filter(e => e.id !== entryId);
    onSaveIncomeSources(incomeSources.map(s => s.id === sourceId ? { ...s, entries } : s));
  };

  const getSourceActiveAmount = (source) => {
    if (!source.entries) return source.amount || 0;
    const key = `${curYear}-${String(curMonth + 1).padStart(2, '0')}`;
    const entry = source.entries.find(e => e.startDate <= key && (e.endDate === null || e.endDate >= key));
    return entry ? entry.amount : null;
  };

  const toggleIncome = (id) => {
    onSaveIncomeSources(incomeSources.map(s => s.id === id ? { ...s, active: !s.active } : s));
  };

  const addIncomeSource = () => {
    if (!newSourceLabel.trim()) return;
    const newSource = { id: `inc-${Date.now()}`, label: newSourceLabel.trim(), active: true, entries: [] };
    onSaveIncomeSources([...incomeSources, newSource]);
    setSelectedSourceId(newSource.id);
    setNewSourceLabel('');
    setIsAddingSource(false);
  };

  const removeSource = (id) => {
    onSaveIncomeSources(incomeSources.filter(s => s.id !== id));
    if (selectedSourceId === id) setSelectedSourceId(null);
    setConfirmDeleteSourceId(null);
  };

  const saveSourceLabel = (id) => {
    if (!sourceLabelInput.trim()) return;
    onSaveIncomeSources(incomeSources.map(s => s.id === id ? { ...s, label: sourceLabelInput.trim() } : s));
    setEditingSourceId(null);
  };

  const activeIncomeTotal = incomeSources
    .filter(s => s.active)
    .reduce((sum, s) => sum + (getSourceActiveAmount(s) || 0), 0);

  const selectedCat = categories.find(c => c.id === selectedCatId);
  const selectedSource = incomeSources.find(s => s.id === selectedSourceId);

  const sidebarStyle = {
    background: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-lg)',
    padding: 16,
    position: 'sticky',
    top: 120,
  };

  const panelStyle = {
    background: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-lg)',
    padding: 28,
    minHeight: 300,
  };

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 4 }}>Budgeting for {year}</h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>Set spending limits and manage your income streams.</p>
      </div>

      {/* Section Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '0.5px solid var(--color-border-tertiary)', paddingBottom: 12 }}>
        <button className={`nav-tab ${activeTab === 'outgoing' ? 'active' : ''}`} onClick={() => { setActiveTab('outgoing'); setSelectedCatId(null); }}>Outgoing</button>
        <button className={`nav-tab ${activeTab === 'income' ? 'active' : ''}`} onClick={() => { setActiveTab('income'); setSelectedSourceId(null); }}>Income</button>
      </div>

      {/* ── Outgoing tab ── */}
      {activeTab === 'outgoing' && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, alignItems: 'start' }}>
          <div style={sidebarStyle}>
            <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Categories</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {categories.filter(c => !c.isIncome).map(c => {
                const display = getCatDisplayValue(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCatId(c.id)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: selectedCatId === c.id ? 'var(--color-background-secondary)' : 'transparent',
                      color: 'var(--color-text-primary)', textAlign: 'left', fontSize: 13, fontFamily: 'var(--font-sans)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />
                      <span style={{ marginLeft: c.parentId ? 12 : 0 }}>{c.label}</span>
                    </div>
                    <span style={{ fontSize: 11, color: display ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                      {display || 'No limit'}
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '0.5px solid var(--color-border-tertiary)', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Active this month:</span>
              <span style={{ fontWeight: 500 }}>{fmt(activeMonthTotal)}</span>
            </div>
          </div>

          <div style={panelStyle}>
            {selectedCat ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                  <span style={{ width: 16, height: 16, borderRadius: '50%', background: selectedCat.color }} />
                  <h2 style={{ fontSize: 20, fontWeight: 500 }}>{selectedCat.label}</h2>
                </div>
                <EntryList
                  key={selectedCatId}
                  entries={getCatEntries(selectedCatId)}
                  onSave={entries => saveCatEntries(selectedCatId, entries)}
                  onDelete={entryId => deleteEntry(selectedCatId, entryId)}
                />
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-secondary)' }}>
                <p>Select a category to manage its budget periods.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Income tab ── */}
      {activeTab === 'income' && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24, alignItems: 'start' }}>
          <div style={sidebarStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Income Sources</p>
              {!isAddingSource && (
                <button className="btn-g" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setIsAddingSource(true)}>+ Add</button>
              )}
            </div>

            {isAddingSource && (
              <div style={{ marginBottom: 12, display: 'flex', gap: 6 }}>
                <input
                  className="input-f"
                  style={{ flex: 1, padding: '5px 8px', fontSize: 12 }}
                  placeholder="Source name"
                  value={newSourceLabel}
                  onChange={e => setNewSourceLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addIncomeSource(); if (e.key === 'Escape') { setIsAddingSource(false); setNewSourceLabel(''); } }}
                  autoFocus
                />
                <button className="btn-p" style={{ padding: '5px 10px', fontSize: 11 }} onClick={addIncomeSource}>Add</button>
                <button className="btn-g" style={{ padding: '5px 8px', fontSize: 11 }} onClick={() => { setIsAddingSource(false); setNewSourceLabel(''); }}>✕</button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {incomeSources.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontStyle: 'italic', padding: '8px 0' }}>No income sources.</p>
              )}
              {incomeSources.map(s => {
                const activeAmt = getSourceActiveAmount(s);
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSourceId(s.id)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: selectedSourceId === s.id ? 'var(--color-background-secondary)' : 'transparent',
                      color: 'var(--color-text-primary)', textAlign: 'left', fontSize: 13,
                      fontFamily: 'var(--font-sans)', opacity: s.active ? 1 : 0.5,
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                    <span style={{ fontSize: 11, color: activeAmt != null ? 'var(--color-text-success)' : 'var(--color-text-secondary)', whiteSpace: 'nowrap', marginLeft: 8 }}>
                      {activeAmt != null ? fmt(activeAmt) : 'No entry'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '0.5px solid var(--color-border-tertiary)', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Active this month:</span>
              <span style={{ fontWeight: 500, color: 'var(--color-text-success)' }}>{fmt(activeIncomeTotal)}</span>
            </div>
          </div>

          <div style={panelStyle}>
            {selectedSource ? (
              <div>
                {/* Source header: label + toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                  <label className="switch">
                    <input type="checkbox" checked={selectedSource.active} onChange={() => toggleIncome(selectedSource.id)} />
                    <span className="slider"></span>
                  </label>
                  {editingSourceId === selectedSource.id ? (
                    <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                      <input
                        className="input-f"
                        style={{ fontSize: 18, fontWeight: 500, padding: '4px 8px' }}
                        value={sourceLabelInput}
                        onChange={e => setSourceLabelInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveSourceLabel(selectedSource.id); if (e.key === 'Escape') setEditingSourceId(null); }}
                        autoFocus
                      />
                      <button className="btn-p" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => saveSourceLabel(selectedSource.id)}>Save</button>
                      <button className="btn-g" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setEditingSourceId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <h2 style={{ fontSize: 20, fontWeight: 500 }}>{selectedSource.label}</h2>
                      <button
                        onClick={() => { setEditingSourceId(selectedSource.id); setSourceLabelInput(selectedSource.label); }}
                        style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 12, textDecoration: 'underline', padding: 0 }}
                      >
                        Rename
                      </button>
                    </div>
                  )}
                </div>

                <EntryList
                  key={selectedSourceId}
                  entries={getSourceEntries(selectedSourceId)}
                  onSave={entries => saveSourceEntries(selectedSourceId, entries)}
                  onDelete={entryId => deleteSourceEntry(selectedSourceId, entryId)}
                />

                {/* Remove source */}
                <div style={{ marginTop: 32, paddingTop: 16, borderTop: '0.5px solid var(--color-border-tertiary)' }}>
                  {confirmDeleteSourceId === selectedSource.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13, color: 'var(--color-text-danger)' }}>Remove {selectedSource.label} and all its entries?</span>
                      <button className="btn-g" style={{ padding: '5px 12px', fontSize: 12, color: 'var(--color-text-danger)' }} onClick={() => removeSource(selectedSource.id)}>Confirm</button>
                      <button className="btn-g" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => setConfirmDeleteSourceId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button className="btn-g" style={{ fontSize: 12, padding: '6px 14px', color: 'var(--color-text-danger)' }} onClick={() => setConfirmDeleteSourceId(selectedSource.id)}>
                      Remove source
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-secondary)' }}>
                <p>{incomeSources.length === 0 ? 'Add an income source to get started.' : 'Select an income source to manage its entries.'}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
