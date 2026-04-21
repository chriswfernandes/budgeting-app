import { useState } from "react";
import { resolveMonthBudget, computeDerivedMonthlyAmount, isIncomeCat, isCCPaymentCat } from "./utils";

const fmt = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Math.abs(n));

const fmtDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length >= 3) {
    return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return new Date(parts[0], parts[1] - 1).toLocaleDateString('en-CA', { month: 'short', year: 'numeric' });
};

const hasOverlap = (entries, newStart, newEnd, excludeId = null) => {
  const newStartMo = newStart.substring(0, 7);
  const newEndMo   = newEnd ? newEnd.substring(0, 7) : '9999-12';
  return entries.filter(e => e.id !== excludeId).some(e => {
    const existStart = e.startDate.substring(0, 7);
    const existEnd   = e.endDate ? e.endDate.substring(0, 7) : '9999-12';
    return newStartMo <= existEnd && newEndMo >= existStart;
  });
};

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function buildRecurrenceFromForm(form) {
  return {
    enabled: true,
    type: form.recType,
    interval: parseInt(form.recInterval) || 1,
    daysOfWeek: form.recType === 'weekly' ? form.recDows : [],
    dayOfMonth: (form.recType === 'monthly' && form.recMonthlyMode === 'day') || form.recType === 'yearly'
      ? (parseInt(form.recDayOfMonth) || 1)
      : null,
    ordinalWeekday: form.recType === 'monthly' && form.recMonthlyMode === 'weekday'
      ? { ordinal: form.recOrdinal, weekday: parseInt(form.recOrdinalDow) }
      : null,
    monthOfYear: form.recType === 'yearly' ? (parseInt(form.recMonthOfYear) || 1) : null,
    isBusinessDay: form.recType === 'daily' ? !!form.recBusinessDay : false,
    amountPerOccurrence: parseFloat(form.amount) || 0,
  };
}

function buildSummaryText(form) {
  if (!form.recEnabled || !form.startDate) return '';
  const interval = parseInt(form.recInterval) || 1;
  const fmtMo = yyyyMM => `${MONTHS_SH[parseInt(yyyyMM.split('-')[1]) - 1]} ${yyyyMM.split('-')[0]}`;

  let pattern = '';
  switch (form.recType) {
    case 'weekly': {
      const days = (form.recDows || [5]).map(d => DOW_SHORT[d]).join(', ');
      pattern = interval === 1 ? `Every week on ${days}` : `Every ${interval} weeks on ${days}`;
      break;
    }
    case 'daily':
      pattern = form.recBusinessDay
        ? 'Every business day (Mon–Fri)'
        : interval === 1 ? 'Every day' : `Every ${interval} days`;
      break;
    case 'monthly':
      pattern = interval === 1 ? 'Monthly' : `Every ${interval} months`;
      if (form.recMonthlyMode === 'day') {
        pattern += `, day ${form.recDayOfMonth}`;
      } else {
        pattern += `, the ${form.recOrdinal} ${DOW_SHORT[parseInt(form.recOrdinalDow)]}`;
      }
      break;
    case 'yearly':
      pattern = interval === 1 ? 'Yearly' : `Every ${interval} years`;
      pattern += ` on ${MONTHS_SH[(parseInt(form.recMonthOfYear) || 1) - 1]} ${form.recDayOfMonth}`;
      break;
    default: break;
  }

  const startText = `starting ${fmtMo(form.startDate)}`;
  const endText = form.noEndDate
    ? 'no end date'
    : (form.endDate ? `ending ${fmtMo(form.endDate)}` : '');
  return [pattern, startText, endText].filter(Boolean).join(', ');
}

const DEFAULT_FORM = {
  amount: '', startDate: '', endDate: '', noEndDate: true,
  recEnabled: false,
  recType: 'weekly',
  recInterval: 2,
  recDows: [5],
  recDayOfMonth: 1,
  recMonthlyMode: 'day',
  recOrdinal: 'first',
  recOrdinalDow: 5,
  recMonthOfYear: 1,
  recBusinessDay: false,
};

function RecurrenceSubForm({ form, setForm }) {
  const toggleDow = (dow) => {
    const next = form.recDows.includes(dow)
      ? form.recDows.filter(d => d !== dow)
      : [...form.recDows, dow];
    if (next.length > 0) setForm({ ...form, recDows: next });
  };

  const pill = (active) =>
    `px-2.5 py-1 rounded-full text-[11px] cursor-pointer border-0 font-sans ${active ? 'bg-text text-surface' : 'bg-raised text-muted'}`;

  return (
    <div className="mt-3.5 p-3.5 bg-bg rounded-md border-[0.5px] border-border">
      <div className="mb-3">
        <label className="text-[11px] text-muted block mb-1">Recurrence type</label>
        <div className="flex gap-1.5">
          {['daily','weekly','monthly','yearly'].map(t => (
            <button key={t} onClick={() => setForm({ ...form, recType: t })}
              className={`px-3 py-[5px] rounded-md text-xs capitalize cursor-pointer border-0 font-sans ${form.recType === t ? 'bg-text text-surface' : 'bg-raised text-muted'}`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {form.recType === 'weekly' && (
        <>
          <div className="flex items-center gap-2 flex-wrap mb-2.5">
            <span className="text-xs">Repeat every</span>
            <input className="input-field !w-[60px] !py-[5px] !px-2 !text-xs" type="number" min="1" value={form.recInterval}
              onChange={e => setForm({ ...form, recInterval: e.target.value })} />
            <span className="text-xs">week(s)</span>
          </div>
          <div className="mb-2.5">
            <label className="text-[11px] text-muted block mb-1">On</label>
            <div className="flex gap-1.5 flex-wrap">
              {[1,2,3,4,5,6,0].map(dow => (
                <button key={dow} onClick={() => toggleDow(dow)} className={pill(form.recDows.includes(dow))}>
                  {DOW_SHORT[dow]}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {form.recType === 'daily' && (
        <>
          <div className="flex items-center gap-2 flex-wrap mb-2.5">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={!!form.recBusinessDay}
                onChange={e => setForm({ ...form, recBusinessDay: e.target.checked })} />
              Every business day (Mon–Fri)
            </label>
          </div>
          {!form.recBusinessDay && (
            <div className="flex items-center gap-2 flex-wrap mb-2.5">
              <span className="text-xs">Repeat every</span>
              <input className="input-field !w-[60px] !py-[5px] !px-2 !text-xs" type="number" min="1" value={form.recInterval}
                onChange={e => setForm({ ...form, recInterval: e.target.value })} />
              <span className="text-xs">day(s)</span>
            </div>
          )}
        </>
      )}

      {form.recType === 'monthly' && (
        <>
          <div className="flex items-center gap-2 flex-wrap mb-2.5">
            <span className="text-xs">Repeat every</span>
            <input className="input-field !w-[60px] !py-[5px] !px-2 !text-xs" type="number" min="1" value={form.recInterval}
              onChange={e => setForm({ ...form, recInterval: e.target.value })} />
            <span className="text-xs">month(s)</span>
          </div>
          <div className="mb-2">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer mb-1.5">
              <input type="radio" checked={form.recMonthlyMode === 'day'}
                onChange={() => setForm({ ...form, recMonthlyMode: 'day' })} />
              Day
              <input className="input-field !w-[60px] !py-[5px] !px-2 !text-xs ml-1" type="number" min="1" max="31" value={form.recDayOfMonth}
                onChange={e => setForm({ ...form, recDayOfMonth: e.target.value, recMonthlyMode: 'day' })} />
              of the month
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer flex-wrap">
              <input type="radio" checked={form.recMonthlyMode === 'weekday'}
                onChange={() => setForm({ ...form, recMonthlyMode: 'weekday' })} />
              The
              <select className="input-field !w-[90px] !py-1 !px-1.5 !text-[11px]" value={form.recOrdinal}
                onChange={e => setForm({ ...form, recOrdinal: e.target.value, recMonthlyMode: 'weekday' })}>
                {['first','second','third','fourth','last'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <select className="input-field !w-[90px] !py-1 !px-1.5 !text-[11px]" value={form.recOrdinalDow}
                onChange={e => setForm({ ...form, recOrdinalDow: parseInt(e.target.value), recMonthlyMode: 'weekday' })}>
                {DOW_SHORT.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
              of the month
            </label>
          </div>
        </>
      )}

      {form.recType === 'yearly' && (
        <>
          <div className="flex items-center gap-2 flex-wrap mb-2.5">
            <span className="text-xs">Repeat every</span>
            <input className="input-field !w-[60px] !py-[5px] !px-2 !text-xs" type="number" min="1" value={form.recInterval}
              onChange={e => setForm({ ...form, recInterval: e.target.value })} />
            <span className="text-xs">year(s)</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap mb-2.5">
            <span className="text-xs">On</span>
            <select className="input-field !w-[110px] !py-1 !px-1.5 !text-[11px]" value={form.recMonthOfYear}
              onChange={e => setForm({ ...form, recMonthOfYear: parseInt(e.target.value) })}>
              {MONTHS_FULL.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <input className="input-field !w-[60px] !py-[5px] !px-2 !text-xs" type="number" min="1" max="31" value={form.recDayOfMonth}
              onChange={e => setForm({ ...form, recDayOfMonth: e.target.value })} />
          </div>
        </>
      )}
    </div>
  );
}

function EntryList({ entries, onSave, onDelete, showRecurrence = false }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [error, setError] = useState('');

  const resetForm = () => { setForm(DEFAULT_FORM); setError(''); };
  const openAdd = () => { resetForm(); setEditingId(null); setAdding(true); };

  const toInputDate = (dateStr) => {
    if (!dateStr) return '';
    if (showRecurrence && dateStr.length === 7) return dateStr + '-01';
    return dateStr;
  };

  const openEdit = (entry) => {
    const rec = entry.recurrence;
    setForm({
      amount: String(rec?.enabled && rec?.amountPerOccurrence != null ? rec.amountPerOccurrence : entry.amount),
      startDate: toInputDate(entry.startDate),
      endDate: entry.endDate ? toInputDate(entry.endDate) : '',
      noEndDate: entry.endDate === null,
      recEnabled: rec?.enabled || false,
      recType: rec?.type || 'weekly',
      recInterval: rec?.interval || 2,
      recDows: rec?.daysOfWeek?.length ? rec.daysOfWeek : [5],
      recDayOfMonth: rec?.dayOfMonth || (rec?.ordinalWeekday ? 1 : 1),
      recMonthlyMode: rec?.ordinalWeekday ? 'weekday' : 'day',
      recOrdinal: rec?.ordinalWeekday?.ordinal || 'first',
      recOrdinalDow: rec?.ordinalWeekday?.weekday ?? 5,
      recMonthOfYear: rec?.monthOfYear || 1,
      recBusinessDay: rec?.isBusinessDay || false,
    });
    setEditingId(entry.id);
    setAdding(false);
    setError('');
  };

  const cancelForm = () => { setAdding(false); setEditingId(null); resetForm(); };

  const saveEntry = () => {
    const amountVal = parseFloat(form.amount);
    if (!amountVal || amountVal <= 0) { setError('Amount must be greater than 0.'); return; }
    if (!form.startDate) { setError('Start month is required.'); return; }
    const endDate = form.noEndDate ? null : (form.endDate || null);
    if (!form.noEndDate && endDate && endDate < form.startDate) {
      setError('End month must be after start month.'); return;
    }
    if (hasOverlap(entries, form.startDate, endDate, editingId)) {
      const conflict = entries.filter(e => e.id !== editingId).find(e => {
        const existEnd = e.endDate || '9999-12';
        const end = endDate || '9999-12';
        return form.startDate <= existEnd && end >= e.startDate;
      });
      setError(`Overlaps with existing entry (${fmtDate(conflict.startDate)} – ${conflict.endDate ? fmtDate(conflict.endDate) : 'onwards'}).`);
      return;
    }

    let amount = amountVal;
    let recurrence = null;
    if (showRecurrence && form.recEnabled) {
      const rec = buildRecurrenceFromForm(form);
      amount = computeDerivedMonthlyAmount(rec, amountVal);
      recurrence = rec;
    }

    const entry = { id: editingId || `be-${Date.now()}`, amount, startDate: form.startDate, endDate, recurrence };
    const updated = editingId
      ? entries.map(e => e.id === editingId ? entry : e)
      : [...entries, entry].sort((a, b) => a.startDate.localeCompare(b.startDate));
    onSave(updated);
    cancelForm();
  };

  const monthlyHint = (() => {
    if (!showRecurrence || !form.recEnabled) return null;
    const amtPerOcc = parseFloat(form.amount) || 0;
    if (!amtPerOcc) return null;
    const rec = buildRecurrenceFromForm(form);
    const monthly = computeDerivedMonthlyAmount(rec, amtPerOcc);
    return monthly > 0 ? `≈ ${fmt(monthly)} / month based on recurrence` : null;
  })();

  const summaryText = showRecurrence ? buildSummaryText(form) : '';
  const sorted = [...entries].sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <div onKeyDown={e => e.key === 'Escape' && (adding || editingId) && cancelForm()}>
      {sorted.length === 0 && !adding && (
        <p className="text-[13px] text-muted italic mb-4">No budget periods set.</p>
      )}

      {sorted.length > 0 && (
        <table className="w-full border-collapse text-[13px] mb-4">
          <thead>
            <tr className="bg-raised border-b-[0.5px] border-border-subtle">
              {['From', 'To', 'Amount', ''].map(h => (
                <th key={h} className={`px-3 py-2 font-medium text-[11px] text-muted uppercase tracking-[0.05em] ${h === 'Amount' ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((e, i) => {
              const rec = e.recurrence;
              const recLabel = rec?.enabled ? (() => {
                if (rec.type === 'weekly') {
                  const days = (rec.daysOfWeek || [5]).map(d => DOW_SHORT[d]).join('/');
                  return `${rec.interval === 1 ? 'wkly' : `${rec.interval}wk`} ${days}`;
                }
                if (rec.type === 'daily') return rec.isBusinessDay ? 'biz day' : `${rec.interval}d`;
                if (rec.type === 'monthly') return `${rec.interval}mo`;
                if (rec.type === 'yearly') return `${rec.interval}yr`;
                return null;
              })() : null;
              return (
                <tr key={e.id} className="border-b-[0.5px] border-border-subtle last:border-b-0">
                  <td className="px-3 py-2.5">{fmtDate(e.startDate)}</td>
                  <td className={`px-3 py-2.5 ${e.endDate ? 'text-text' : 'text-muted'}`}>
                    {e.endDate ? fmtDate(e.endDate) : 'onwards'}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="font-mono font-medium">{fmt(e.amount)}/mo</span>
                    {recLabel && (
                      <span className="text-[10px] text-info ml-1.5 bg-info-bg px-[5px] py-[1px] rounded-lg">
                        {recLabel}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {confirmDeleteId === e.id ? (
                      <span className="flex gap-1.5 justify-end items-center">
                        <span className="text-xs text-danger">Delete?</span>
                        <button className="btn-ghost py-[3px] px-2 text-[11px] text-danger" onClick={() => { onDelete(e.id); setConfirmDeleteId(null); }}>Confirm</button>
                        <button className="btn-ghost py-[3px] px-2 text-[11px]" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                      </span>
                    ) : (
                      <span className="flex gap-1.5 justify-end">
                        <button className="btn-ghost py-[3px] px-2 text-[11px]" onClick={() => openEdit(e)}>Edit</button>
                        <button className="btn-ghost py-[3px] px-2 text-[11px] text-danger" onClick={() => setConfirmDeleteId(e.id)}>Delete</button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {(adding || editingId) && (
        <div className="bg-raised border-[0.5px] border-border rounded-md p-4 mb-3">
          <p className="text-xs font-medium mb-3">{editingId ? 'Edit period' : 'Add period'}</p>
          <div className="grid grid-cols-3 gap-2.5 mb-2.5">
            <div>
              <label className="text-[11px] text-muted block mb-1">
                {showRecurrence && form.recEnabled ? 'Amount per occurrence (CAD) *' : 'Monthly amount (CAD) *'}
              </label>
              <input className="input-field" type="number" min="0" step="0.01" value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" autoFocus />
              {monthlyHint && (
                <p className="text-[11px] text-info mt-1.5">{monthlyHint}</p>
              )}
            </div>
            <div>
              <label className="text-[11px] text-muted block mb-1">
                {showRecurrence ? 'Start date *' : 'Start month *'}
              </label>
              <input className="input-field" type={showRecurrence ? 'date' : 'month'}
                value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="text-[11px] text-muted block mb-1">
                {showRecurrence ? 'End date' : 'End month'}
              </label>
              <input className="input-field" type={showRecurrence ? 'date' : 'month'}
                value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}
                disabled={form.noEndDate} style={{ opacity: form.noEndDate ? 0.4 : 1 }} />
              <label className="flex items-center gap-1.5 mt-1.5 text-xs cursor-pointer">
                <input type="checkbox" checked={form.noEndDate} onChange={e => setForm({ ...form, noEndDate: e.target.checked, endDate: e.target.checked ? '' : form.endDate })} />
                No end date
              </label>
            </div>
          </div>

          {showRecurrence && (
            <div className="mb-2.5">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={form.recEnabled}
                  onChange={e => setForm({ ...form, recEnabled: e.target.checked })} />
                <span className={form.recEnabled ? 'font-medium' : ''}>Define recurrence pattern (optional)</span>
              </label>
              {form.recEnabled && <RecurrenceSubForm form={form} setForm={setForm} />}
              {form.recEnabled && summaryText && (
                <p className="text-xs text-muted italic mt-2.5 px-3 py-2 bg-bg rounded-md border-[0.5px] border-border-subtle">
                  {summaryText}
                </p>
              )}
            </div>
          )}

          {error && <p className="text-xs text-danger mb-2">{error}</p>}
          <div className="flex gap-2">
            <button className="btn-primary py-1.5 px-4 text-xs" onClick={saveEntry}>Save</button>
            <button className="btn-ghost py-1.5 px-3 text-xs" onClick={cancelForm}>Cancel</button>
          </div>
        </div>
      )}

      {!adding && !editingId && (
        <button className="btn-ghost text-xs py-1.5 px-3.5" onClick={openAdd}>+ Add period</button>
      )}
    </div>
  );
}

export default function BudgetView({ categories, budgetEntries, onSaveBudgetEntries, incomeSources, onSaveIncomeSources, year }) {
  const [activeTab, setActiveTab] = useState('outgoing');
  const [selectedCatId, setSelectedCatId] = useState(null);
  const [selectedIncomeCatId, setSelectedIncomeCatId] = useState(null);
  const [selectedSourceId, setSelectedSourceId] = useState(null);
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [newSourceLabel, setNewSourceLabel] = useState('');
  const [editingSourceId, setEditingSourceId] = useState(null);
  const [sourceLabelInput, setSourceLabelInput] = useState('');
  const [confirmDeleteSourceId, setConfirmDeleteSourceId] = useState(null);

  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth();

  const getCatEntries = (catId) => budgetEntries[catId] || [];
  const saveCatEntries = (catId, entries) => onSaveBudgetEntries({ ...budgetEntries, [catId]: entries });
  const deleteEntry = (catId, entryId) => {
    const updated = getCatEntries(catId).filter(e => e.id !== entryId);
    onSaveBudgetEntries({ ...budgetEntries, [catId]: updated });
  };

  const activeMonthTotal = categories
    .filter(c => !isIncomeCat(categories, c.id) && !isCCPaymentCat(categories, c.id))
    .reduce((sum, c) => sum + (resolveMonthBudget(budgetEntries, {}, c.id, curYear, curMonth) || 0), 0);

  const getCatDisplayValue = (catId) => {
    const entries = getCatEntries(catId);
    if (!entries.length) return null;
    const key = `${curYear}-${String(curMonth + 1).padStart(2, '0')}`;
    const active = entries.find(e => {
      const s = e.startDate.substring(0, 7);
      const en = e.endDate ? e.endDate.substring(0, 7) : null;
      return s <= key && (en === null || en >= key);
    });
    if (active) return fmt(active.amount);
    return `${entries.length} ${entries.length === 1 ? 'period' : 'periods'}`;
  };

  const activeIncomeCatTotal = categories
    .filter(c => isIncomeCat(categories, c.id) && !isCCPaymentCat(categories, c.id))
    .reduce((sum, c) => sum + (resolveMonthBudget(budgetEntries, {}, c.id, curYear, curMonth) || 0), 0);

  const selectedIncomeCat = categories.find(c => c.id === selectedIncomeCatId);

  const getSourceEntries = (sourceId) => incomeSources.find(s => s.id === sourceId)?.entries || [];
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
    const entry = source.entries.find(e => {
      const start = e.startDate.substring(0, 7);
      const end   = e.endDate ? e.endDate.substring(0, 7) : null;
      return start <= key && (end === null || end >= key);
    });
    return entry ? entry.amount : null;
  };

  const toggleIncome = (id) => onSaveIncomeSources(incomeSources.map(s => s.id === id ? { ...s, active: !s.active } : s));

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

  const catListBtn = (isSelected, onClick, children) => (
    <button
      onClick={onClick}
      className={`flex justify-between items-center w-full px-3 py-2 rounded-lg border-0 cursor-pointer text-left text-[13px] font-sans text-text transition-colors ${isSelected ? 'bg-raised' : 'bg-transparent hover:bg-raised'}`}
    >
      {children}
    </button>
  );

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-[26px] font-medium mb-1">Budgeting for {year}</h1>
        <p className="text-sm text-muted">Set spending limits and manage your income streams.</p>
      </div>

      <div className="flex gap-2 mb-5 border-b-[0.5px] border-border-subtle pb-3">
        <button className={`nav-tab ${activeTab === 'outgoing' ? 'active' : ''}`} onClick={() => { setActiveTab('outgoing'); setSelectedCatId(null); }}>Outgoing</button>
        <button className={`nav-tab ${activeTab === 'income' ? 'active' : ''}`} onClick={() => { setActiveTab('income'); setSelectedIncomeCatId(null); }}>Income</button>
        <button className={`nav-tab ${activeTab === 'sources' ? 'active' : ''}`} onClick={() => { setActiveTab('sources'); setSelectedSourceId(null); }}>Sources</button>
      </div>

      {activeTab === 'outgoing' && (
        <div className="grid grid-cols-[280px_1fr] gap-6 items-start">
          <div className="card p-4 sticky top-[120px]">
            <p className="text-[11px] text-muted uppercase tracking-[0.06em] mb-3">Categories</p>
            <div className="flex flex-col gap-1">
              {categories.filter(c => !isIncomeCat(categories, c.id) && !isCCPaymentCat(categories, c.id)).map(c => {
                const display = getCatDisplayValue(c.id);
                return catListBtn(selectedCatId === c.id, () => setSelectedCatId(c.id), (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                      <span style={{ marginLeft: c.parentId ? 12 : 0 }}>{c.label}</span>
                    </div>
                    <span className={`text-[11px] ${display ? 'text-text' : 'text-muted'}`}>{display || 'No limit'}</span>
                  </>
                ));
              })}
            </div>
            <div className="mt-4 pt-3 border-t-[0.5px] border-border-subtle flex justify-between text-[13px]">
              <span className="text-muted">Active this month:</span>
              <span className="font-medium">{fmt(activeMonthTotal)}</span>
            </div>
          </div>

          <div className="card p-7 min-h-[300px]">
            {selectedCat ? (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <span className="w-4 h-4 rounded-full" style={{ background: selectedCat.color }} />
                  <h2 className="text-xl font-medium">{selectedCat.label}</h2>
                </div>
                <EntryList
                  key={selectedCatId}
                  entries={getCatEntries(selectedCatId)}
                  onSave={entries => saveCatEntries(selectedCatId, entries)}
                  onDelete={entryId => deleteEntry(selectedCatId, entryId)}
                  showRecurrence={true}
                />
              </div>
            ) : (
              <div className="text-center py-10 text-muted">
                <p>Select a category to manage its budget periods.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'income' && (
        <div className="grid grid-cols-[280px_1fr] gap-6 items-start">
          <div className="card p-4 sticky top-[120px]">
            <p className="text-[11px] text-muted uppercase tracking-[0.06em] mb-3">Income Categories</p>
            <div className="flex flex-col gap-1">
              {categories.filter(c => isIncomeCat(categories, c.id) && !isCCPaymentCat(categories, c.id)).map(c => {
                const display = getCatDisplayValue(c.id);
                return catListBtn(selectedIncomeCatId === c.id, () => setSelectedIncomeCatId(c.id), (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                      <span style={{ marginLeft: c.parentId ? 12 : 0 }}>{c.label}</span>
                    </div>
                    <span className={`text-[11px] ${display ? 'text-text' : 'text-muted'}`}>{display || 'No target'}</span>
                  </>
                ));
              })}
            </div>
            <div className="mt-4 pt-3 border-t-[0.5px] border-border-subtle flex justify-between text-[13px]">
              <span className="text-muted">Expected this month:</span>
              <span className="font-medium text-success">{fmt(activeIncomeCatTotal)}</span>
            </div>
          </div>

          <div className="card p-7 min-h-[300px]">
            {selectedIncomeCat ? (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <span className="w-4 h-4 rounded-full" style={{ background: selectedIncomeCat.color }} />
                  <h2 className="text-xl font-medium">{selectedIncomeCat.label}</h2>
                </div>
                <EntryList
                  key={selectedIncomeCatId}
                  entries={getCatEntries(selectedIncomeCatId)}
                  onSave={entries => saveCatEntries(selectedIncomeCatId, entries)}
                  onDelete={entryId => deleteEntry(selectedIncomeCatId, entryId)}
                  showRecurrence={true}
                />
              </div>
            ) : (
              <div className="text-center py-10 text-muted">
                <p>Select an income category to set expected monthly amounts.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'sources' && (
        <div className="grid grid-cols-[280px_1fr] gap-6 items-start">
          <div className="card p-4 sticky top-[120px]">
            <div className="flex justify-between items-center mb-3">
              <p className="text-[11px] text-muted uppercase tracking-[0.06em]">Income Sources</p>
              {!isAddingSource && (
                <button className="btn-ghost text-[11px] py-[3px] px-2" onClick={() => setIsAddingSource(true)}>+ Add</button>
              )}
            </div>
            {isAddingSource && (
              <div className="mb-3 flex gap-1.5">
                <input
                  className="input-field flex-1 !py-[5px] !px-2 !text-xs"
                  placeholder="Source name"
                  value={newSourceLabel}
                  onChange={e => setNewSourceLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addIncomeSource(); if (e.key === 'Escape') { setIsAddingSource(false); setNewSourceLabel(''); } }}
                  autoFocus
                />
                <button className="btn-primary py-[5px] px-2.5 text-[11px]" onClick={addIncomeSource}>Add</button>
                <button className="btn-ghost py-[5px] px-2 text-[11px]" onClick={() => { setIsAddingSource(false); setNewSourceLabel(''); }}>✕</button>
              </div>
            )}
            <div className="flex flex-col gap-1">
              {incomeSources.length === 0 && (
                <p className="text-[13px] text-muted italic py-2">No income sources.</p>
              )}
              {incomeSources.map(s => {
                const activeAmt = getSourceActiveAmount(s);
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSourceId(s.id)}
                    className={`flex justify-between items-center w-full px-3 py-2 rounded-lg border-0 cursor-pointer text-left text-[13px] font-sans text-text transition-colors ${selectedSourceId === s.id ? 'bg-raised' : 'bg-transparent hover:bg-raised'} ${s.active ? '' : 'opacity-50'}`}
                  >
                    <span className="truncate">{s.label}</span>
                    <span className={`text-[11px] whitespace-nowrap ml-2 ${activeAmt != null ? 'text-success' : 'text-muted'}`}>
                      {activeAmt != null ? fmt(activeAmt) : 'No entry'}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t-[0.5px] border-border-subtle flex justify-between text-[13px]">
              <span className="text-muted">Active this month:</span>
              <span className="font-medium text-success">{fmt(activeIncomeTotal)}</span>
            </div>
          </div>

          <div className="card p-7 min-h-[300px]">
            {selectedSource ? (
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <label className="switch">
                    <input type="checkbox" checked={selectedSource.active} onChange={() => toggleIncome(selectedSource.id)} />
                    <span className="slider"></span>
                  </label>
                  {editingSourceId === selectedSource.id ? (
                    <div className="flex gap-2 flex-1">
                      <input
                        className="input-field !text-lg !font-medium !py-1 !px-2"
                        value={sourceLabelInput}
                        onChange={e => setSourceLabelInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveSourceLabel(selectedSource.id); if (e.key === 'Escape') setEditingSourceId(null); }}
                        autoFocus
                      />
                      <button className="btn-primary py-1 px-3 text-xs" onClick={() => saveSourceLabel(selectedSource.id)}>Save</button>
                      <button className="btn-ghost py-1 px-2.5 text-xs" onClick={() => setEditingSourceId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-xl font-medium">{selectedSource.label}</h2>
                      <button
                        onClick={() => { setEditingSourceId(selectedSource.id); setSourceLabelInput(selectedSource.label); }}
                        className="bg-transparent border-0 text-muted cursor-pointer text-xs underline p-0"
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
                  showRecurrence={true}
                />

                <div className="mt-8 pt-4 border-t-[0.5px] border-border-subtle">
                  {confirmDeleteSourceId === selectedSource.id ? (
                    <div className="flex items-center gap-2.5">
                      <span className="text-[13px] text-danger">Remove {selectedSource.label} and all its entries?</span>
                      <button className="btn-ghost py-[5px] px-3 text-xs text-danger" onClick={() => removeSource(selectedSource.id)}>Confirm</button>
                      <button className="btn-ghost py-[5px] px-2.5 text-xs" onClick={() => setConfirmDeleteSourceId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button className="btn-ghost text-xs py-1.5 px-3.5 text-danger" onClick={() => setConfirmDeleteSourceId(selectedSource.id)}>
                      Remove source
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-muted">
                <p>{incomeSources.length === 0 ? 'Add an income source to get started.' : 'Select an income source to manage its entries.'}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
