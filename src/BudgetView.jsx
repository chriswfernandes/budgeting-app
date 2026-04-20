import { useState } from "react";
import { resolveMonthBudget, computeDerivedMonthlyAmount, isIncomeCat, isCCPaymentCat } from "./utils";

const fmt = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Math.abs(n));

// Handles both "YYYY-MM" and "YYYY-MM-DD" date strings for display
const fmtDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length >= 3) {
    return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return new Date(parts[0], parts[1] - 1).toLocaleDateString('en-CA', { month: 'short', year: 'numeric' });
};

// Compare only the month part (first 7 chars) so "YYYY-MM-DD" and "YYYY-MM" are both handled
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

  const labelStyle = { fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 };
  const rowStyle = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 };
  const numInputStyle = { width: 60, padding: '5px 8px', fontSize: 12 };
  const pillStyle = (active) => ({
    padding: '4px 10px', fontSize: 11, borderRadius: 20, cursor: 'pointer', border: 'none',
    background: active ? 'var(--color-text-primary)' : 'var(--color-background-secondary)',
    color: active ? 'var(--color-background-primary)' : 'var(--color-text-secondary)',
    fontFamily: 'var(--font-sans)',
  });

  return (
    <div style={{ marginTop: 14, padding: 14, background: 'var(--color-background-tertiary)', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-secondary)' }}>
      {/* Recurrence type selector */}
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Recurrence type</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {['daily','weekly','monthly','yearly'].map(t => (
            <button key={t} onClick={() => setForm({ ...form, recType: t })}
              style={{ ...pillStyle(form.recType === t), padding: '5px 12px', borderRadius: 'var(--border-radius-md)', fontSize: 12, textTransform: 'capitalize' }}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Weekly */}
      {form.recType === 'weekly' && (
        <>
          <div style={rowStyle}>
            <span style={{ fontSize: 12 }}>Repeat every</span>
            <input className="input-f" type="number" min="1" value={form.recInterval}
              onChange={e => setForm({ ...form, recInterval: e.target.value })}
              style={numInputStyle} />
            <span style={{ fontSize: 12 }}>week(s)</span>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>On</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[1,2,3,4,5,6,0].map(dow => (
                <button key={dow} onClick={() => toggleDow(dow)} style={pillStyle(form.recDows.includes(dow))}>
                  {DOW_SHORT[dow]}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Daily */}
      {form.recType === 'daily' && (
        <>
          <div style={rowStyle}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!form.recBusinessDay}
                onChange={e => setForm({ ...form, recBusinessDay: e.target.checked })} />
              Every business day (Mon–Fri)
            </label>
          </div>
          {!form.recBusinessDay && (
            <div style={rowStyle}>
              <span style={{ fontSize: 12 }}>Repeat every</span>
              <input className="input-f" type="number" min="1" value={form.recInterval}
                onChange={e => setForm({ ...form, recInterval: e.target.value })}
                style={numInputStyle} />
              <span style={{ fontSize: 12 }}>day(s)</span>
            </div>
          )}
        </>
      )}

      {/* Monthly */}
      {form.recType === 'monthly' && (
        <>
          <div style={rowStyle}>
            <span style={{ fontSize: 12 }}>Repeat every</span>
            <input className="input-f" type="number" min="1" value={form.recInterval}
              onChange={e => setForm({ ...form, recInterval: e.target.value })}
              style={numInputStyle} />
            <span style={{ fontSize: 12 }}>month(s)</span>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', marginBottom: 6 }}>
              <input type="radio" checked={form.recMonthlyMode === 'day'}
                onChange={() => setForm({ ...form, recMonthlyMode: 'day' })} />
              Day
              <input className="input-f" type="number" min="1" max="31" value={form.recDayOfMonth}
                onChange={e => setForm({ ...form, recDayOfMonth: e.target.value, recMonthlyMode: 'day' })}
                style={{ ...numInputStyle, marginLeft: 4 }} />
              of the month
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', flexWrap: 'wrap' }}>
              <input type="radio" checked={form.recMonthlyMode === 'weekday'}
                onChange={() => setForm({ ...form, recMonthlyMode: 'weekday' })} />
              The
              <select className="input-f" value={form.recOrdinal}
                onChange={e => setForm({ ...form, recOrdinal: e.target.value, recMonthlyMode: 'weekday' })}
                style={{ width: 90, padding: '4px 6px', fontSize: 11 }}>
                {['first','second','third','fourth','last'].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <select className="input-f" value={form.recOrdinalDow}
                onChange={e => setForm({ ...form, recOrdinalDow: parseInt(e.target.value), recMonthlyMode: 'weekday' })}
                style={{ width: 90, padding: '4px 6px', fontSize: 11 }}>
                {DOW_SHORT.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
              of the month
            </label>
          </div>
        </>
      )}

      {/* Yearly */}
      {form.recType === 'yearly' && (
        <>
          <div style={rowStyle}>
            <span style={{ fontSize: 12 }}>Repeat every</span>
            <input className="input-f" type="number" min="1" value={form.recInterval}
              onChange={e => setForm({ ...form, recInterval: e.target.value })}
              style={numInputStyle} />
            <span style={{ fontSize: 12 }}>year(s)</span>
          </div>
          <div style={rowStyle}>
            <span style={{ fontSize: 12 }}>On</span>
            <select className="input-f" value={form.recMonthOfYear}
              onChange={e => setForm({ ...form, recMonthOfYear: parseInt(e.target.value) })}
              style={{ width: 110, padding: '4px 6px', fontSize: 11 }}>
              {MONTHS_FULL.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <input className="input-f" type="number" min="1" max="31" value={form.recDayOfMonth}
              onChange={e => setForm({ ...form, recDayOfMonth: e.target.value })}
              style={numInputStyle} />
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
  // Normalise a stored date to the expected input format.
  // When showRecurrence is true we use type="date" (needs "YYYY-MM-DD").
  // Legacy entries stored as "YYYY-MM" are promoted to the 1st of that month.
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

  // Derived monthly hint for recurrence
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
                <tr key={e.id} style={{ borderBottom: i < sorted.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none' }}>
                  <td style={{ padding: '10px 12px' }}>{fmtDate(e.startDate)}</td>
                  <td style={{ padding: '10px 12px', color: e.endDate ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                    {e.endDate ? fmtDate(e.endDate) : 'onwards'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{fmt(e.amount)}/mo</span>
                    {recLabel && (
                      <span style={{ fontSize: 10, color: 'var(--color-text-info)', marginLeft: 6, background: 'var(--color-background-info)', padding: '1px 5px', borderRadius: 8 }}>
                        {recLabel}
                      </span>
                    )}
                  </td>
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
              );
            })}
          </tbody>
        </table>
      )}

      {(adding || editingId) && (
        <div style={{ background: 'var(--color-background-secondary)', border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--border-radius-md)', padding: 16, marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 500, marginBottom: 12 }}>{editingId ? 'Edit period' : 'Add period'}</p>

          {/* Core fields — always visible */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                {showRecurrence && form.recEnabled ? 'Amount per occurrence (CAD) *' : 'Monthly amount (CAD) *'}
              </label>
              <input className="input-f" type="number" min="0" step="0.01" value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" autoFocus />
              {monthlyHint && (
                <p style={{ fontSize: 11, color: 'var(--color-text-info)', marginTop: 5 }}>{monthlyHint}</p>
              )}
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                {showRecurrence ? 'Start date *' : 'Start month *'}
              </label>
              <input className="input-f" type={showRecurrence ? 'date' : 'month'}
                value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
                {showRecurrence ? 'End date' : 'End month'}
              </label>
              <input className="input-f" type={showRecurrence ? 'date' : 'month'}
                value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}
                disabled={form.noEndDate} style={{ opacity: form.noEndDate ? 0.4 : 1 }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.noEndDate} onChange={e => setForm({ ...form, noEndDate: e.target.checked, endDate: e.target.checked ? '' : form.endDate })} />
                No end date
              </label>
            </div>
          </div>

          {/* Recurrence toggle — income sources only */}
          {showRecurrence && (
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.recEnabled}
                  onChange={e => setForm({ ...form, recEnabled: e.target.checked })} />
                <span style={{ fontWeight: form.recEnabled ? 500 : 400 }}>Define recurrence pattern (optional)</span>
              </label>

              {form.recEnabled && <RecurrenceSubForm form={form} setForm={setForm} />}

              {form.recEnabled && summaryText && (
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontStyle: 'italic', marginTop: 10, padding: '8px 12px', background: 'var(--color-background-tertiary)', borderRadius: 'var(--border-radius-md)', border: '0.5px solid var(--color-border-tertiary)' }}>
                  {summaryText}
                </p>
              )}
            </div>
          )}

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
    .filter(c => !isIncomeCat(categories, c.id) && !isCCPaymentCat(categories, c.id))
    .reduce((sum, c) => {
      const val = resolveMonthBudget(budgetEntries, {}, c.id, curYear, curMonth);
      return sum + (val || 0);
    }, 0);

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
    const entry = source.entries.find(e => {
      const start = e.startDate.substring(0, 7);
      const end   = e.endDate ? e.endDate.substring(0, 7) : null;
      return start <= key && (end === null || end >= key);
    });
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
              {categories.filter(c => !isIncomeCat(categories, c.id) && !isCCPaymentCat(categories, c.id)).map(c => {
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
                  showRecurrence={true}
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
