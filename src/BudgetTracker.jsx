import { useState, useEffect, useRef } from "react";
import CategoriesView from "./CategoriesView";
import RulesView from "./RulesView";
import ClassifyView from "./ClassifyView";
import OverviewView from "./OverviewView";
import MonthView from "./MonthView";
import BudgetView from "./BudgetView";
import ScenariosView from "./ScenariosView";
import ForecastView from "./ForecastView";
import { resolveMonthIncome, isIncomeCat, isCCPaymentCat } from "./utils";

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const INITIAL_CATEGORIES = [
  { id: 'income', label: 'Income', color: '#3B6D11', isIncome: true },
  { id: 'housing', label: 'Housing', color: '#378ADD' },
  { id: 'food', label: 'Food & Dining', color: '#BA7517' },
  { id: 'transport', label: 'Transport', color: '#1D9E75' },
  { id: 'entertainment', label: 'Entertainment', color: '#7F77DD' },
  { id: 'shopping',      label: 'Shopping',        color: '#D85A30' },
  { id: 'health',        label: 'Health',          color: '#639922' },
  { id: 'travel',        label: 'Travel',          color: '#185FA5' },
  { id: 'utilities',     label: 'Utilities',       color: '#854F0B' },
  { id: 'subscriptions', label: 'Subscriptions',   color: '#993556' },
  { id: 'transfers',     label: 'Transfers',       color: '#5F5E5A' },
  { id: 'cc-payment',   label: 'CC Payment',      color: '#5F7A9E', isCCPayment: true },
  { id: 'other',         label: 'Other',           color: '#444441' },
];

const store = {
  async get(key) {
    try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : null; }
    catch { return null; }
  },
  async set(key, val) {
    try { await window.storage.set(key, JSON.stringify(val)); } catch {}
  },
  async delete(key) {
    try { await window.storage.delete(key); } catch {}
  },
  async list(prefix) {
    try { const r = await window.storage.list(prefix); return r ? r.keys : []; }
    catch { return []; }
  }
};

async function migrateStorage() {
  const migrated = await store.get('migration-v1');
  if (migrated) return;
  await store.set('migration-v1', true);
}

function parseCSV(text, accountType = 'checking') {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 1) return [];
  const firstLine = lines[0];
  const delimiters = [',', ';', '\t'];
  let delimiter = ',';
  let maxCols = 0;
  for (const d of delimiters) {
    const cols = firstLine.split(d).length;
    if (cols > maxCols) { maxCols = cols; delimiter = d; }
  }
  const isDate = (s) => {
    if (!s) return false;
    const d = new Date(s);
    return !isNaN(d.getTime()) && s.length >= 8 && /\d/.test(s);
  };
  let headerIdx = -1;
  let headers = [];
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const cols = lines[i].split(delimiter).map(h => h.replace(/"/g,'').trim().toLowerCase());
    if (cols.some(c => c.includes('date')) && (cols.some(c => c.includes('desc') || c.includes('merchant') || c.includes('name') || c.includes('narrat')))) {
      headerIdx = i; headers = cols; break;
    }
    if (isDate(cols[0]) && i === 0) break; 
  }
  let dateI, descI, withdrawalI, depositI, amtI, balanceI;
  if (headerIdx !== -1) {
    const idx = (terms) => headers.findIndex(h => terms.some(t => h.includes(t)));
    dateI = idx(['date']);
    descI = idx(['description','desc','merchant','narrat','name','memo','label']);
    withdrawalI = idx(['withdraw','debit','payment','out','spent']);
    depositI = idx(['deposit','credit','in','received']);
    amtI = idx(['amount','value','total']);
    balanceI = headers.findIndex(h => /balance|running.?bal|closing.?bal/i.test(h));
  } else {
    dateI = 0; descI = 1; withdrawalI = 2; depositI = 3; amtI = -1; balanceI = -1;
  }
  const txns = [];
  const balanceEntries = [];
  const raw = s => (s||'').replace(/"/g,'').replace(/[$,]/g,'').trim();
  const cleanNum = s => {
    let n = raw(s); if (!n) return 0;
    if (delimiter !== ',' && n.includes(',') && !n.includes('.')) n = n.replace(',', '.');
    if (n.startsWith('(') && n.endsWith(')')) return -parseFloat(n.slice(1, -1)) || 0;
    return parseFloat(n) || 0;
  };
  const startIdx = headerIdx === -1 ? 0 : headerIdx + 1;
  for (let i = startIdx; i < lines.length; i++) {
    const fields = []; let cur = '', inQ = false;
    for (const ch of lines[i]) {
      if (ch === '"') inQ = !inQ;
      else if (ch === delimiter && !inQ) { fields.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    fields.push(cur.trim());
    if (fields.length < 2) continue;
    const date = raw(fields[dateI >= 0 ? dateI : 0]);
    let desc = raw(fields[descI >= 0 ? descI : 1]) || 'Unknown';
    let amount = 0; let type = 'expense';
    if (withdrawalI >= 0 || depositI >= 0) {
      const w = Math.abs(cleanNum(fields[withdrawalI]));
      const d = Math.abs(cleanNum(fields[depositI]));
      if (d > 0) { amount = d; type = 'income'; }
      else if (w > 0) { amount = w; type = 'expense'; }
    }
    if (amount === 0 && amtI >= 0) {
      const a = cleanNum(fields[amtI]); amount = Math.abs(a);
      type = a > 0 ? 'income' : 'expense';
    }
    if (amount !== 0) {
      txns.push({ id: `csv-${i}-${Date.now()}`, date, description: desc, amount, category: null, type, account: accountType });
    }
    if (balanceI >= 0 && date && fields[balanceI] !== undefined) {
      const balRaw = fields[balanceI].trim();
      if (balRaw !== '') {
        const bal = cleanNum(balRaw);
        const d = new Date(date);
        if (!isNaN(d)) balanceEntries.push({ date: d.toISOString().slice(0, 10), balance: bal });
      }
    }
  }
  let closingBalance = null;
  if (balanceEntries.length > 0) {
    closingBalance = balanceEntries.reduce((latest, e) => e.date > latest.date ? e : latest);
  }
  return { txns, closingBalance };
}

const fmt = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Math.abs(n));

const S = `
  :root {
    --color-background-primary: #ffffff; --color-background-secondary: #f9f9f9; --color-background-tertiary: #f4f4f4;
    --color-border-primary: #333333; --color-border-secondary: #cccccc; --color-border-tertiary: #eeeeee;
    --color-text-primary: #111111; --color-text-secondary: #666666; --color-text-success: #2e7d32;
    --color-text-danger: #d32f2f; --color-text-info: #0288d1; --color-background-success: #e8f5e9;
    --color-background-danger: #ffebee; --color-background-info: #e1f5fe;
    --border-radius-lg: 12px; --border-radius-md: 8px;
    --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    --font-mono: "SF Mono", "Roboto Mono", monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --color-background-primary: #1a1a1a; --color-background-secondary: #242424; --color-background-tertiary: #121212;
      --color-border-primary: #ffffff; --color-border-secondary: #444444; --color-border-tertiary: #2a2a2a;
      --color-text-primary: #eeeeee; --color-text-secondary: #aaaaaa; --color-text-success: #81c784;
      --color-text-danger: #e57373; --color-text-info: #64b5f6; --color-background-success: #1b2e1c;
      --color-background-danger: #3c1e1e; --color-background-info: #1a2e3e;
    }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--color-background-tertiary); }
  .month-card { background: var(--color-background-primary); border: 0.5px solid var(--color-border-tertiary); border-radius: var(--border-radius-lg); padding: 16px; cursor: pointer; transition: border-color 0.15s; }
  .month-card:hover { border-color: var(--color-border-secondary); }
  .txn-row { transition: background 0.1s; }
  .txn-row:hover { background: var(--color-background-secondary); }
  .txn-row:hover .del-btn { opacity: 1; }
  .del-btn { opacity: 0; background: none; border: none; color: var(--color-text-secondary); cursor: pointer; padding: 2px 6px; font-size: 13px; transition: opacity 0.1s; font-family: var(--font-sans); }
  .cat-pill { cursor: pointer; border-radius: 8px; padding: 10px 14px; border: 0.5px solid var(--color-border-tertiary); background: var(--color-background-primary); transition: border-color 0.1s, background 0.1s; font-size: 13px; font-family: var(--font-sans); text-align: left; color: var(--color-text-primary); display: flex; align-items: center; gap: 8px; }
  .cat-pill:hover { border-color: var(--color-border-primary); background: var(--color-background-secondary); }
  .input-f { background: var(--color-background-primary); border: 0.5px solid var(--color-border-tertiary); color: var(--color-text-primary); border-radius: var(--border-radius-md); padding: 8px 12px; font-size: 14px; width: 100%; outline: none; font-family: var(--font-sans); }
  .input-f:focus { border-color: var(--color-border-secondary); }
  .btn-p { background: var(--color-text-primary); color: var(--color-background-primary); border: none; border-radius: var(--border-radius-md); padding: 8px 16px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: var(--font-sans); white-space: nowrap; }
  .btn-p:hover { opacity: 0.8; }
  .btn-g { background: transparent; border: 0.5px solid var(--color-border-secondary); color: var(--color-text-primary); border-radius: var(--border-radius-md); padding: 8px 14px; font-size: 13px; cursor: pointer; font-family: var(--font-sans); white-space: nowrap; }
  .btn-g:hover { background: var(--color-background-secondary); }
  .nav-tab { padding: 4px 10px; font-size: 13px; border-radius: 6px; border: 0.5px solid transparent; background: transparent; color: var(--color-text-secondary); cursor: pointer; font-family: var(--font-sans); transition: all 0.1s; }
  .nav-tab.active { background: var(--color-background-secondary); border-color: var(--color-border-secondary); color: var(--color-text-primary); }
  .cat-bar-row { cursor: pointer; transition: opacity 0.15s; margin-bottom: 14px; }
  select.input-f option { background: var(--color-background-primary); color: var(--color-text-primary); }
  .switch { position: relative; display: inline-block; width: 34px; height: 20px; }
  .switch input { opacity: 0; width: 0; height: 0; }
  .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--color-border-secondary); transition: .2s; border-radius: 20px; }
  .slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: white; transition: .2s; border-radius: 50%; }
  input:checked + .slider { background-color: var(--color-text-primary); }
  input:checked + .slider:before { transform: translateX(14px); }
  .dropdown { position: relative; display: inline-block; }
  .dropdown-content { display: none; position: absolute; right: 0; background-color: var(--color-background-primary); min-width: 160px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border: 0.5px solid var(--color-border-tertiary); border-radius: var(--border-radius-md); z-index: 100; overflow: hidden; }
  .dropdown-content button { color: var(--color-text-primary); padding: 10px 16px; text-decoration: none; display: block; border: none; background: none; width: 100%; text-align: left; cursor: pointer; font-size: 13px; font-family: var(--font-sans); }
  .dropdown-content button:hover { background-color: var(--color-background-secondary); }
  .dropdown:hover .dropdown-content { display: block; }
`;

export default function BudgetTracker() {
  const [years, setYears] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(null);
  const [view, setView] = useState('overview');
  const [txns, setTxns] = useState({});
  const [incomes, setIncomes] = useState({});
  const [rules, setRules]     = useState([]); 
  const [categories, setCategories] = useState(INITIAL_CATEGORIES);
  const [budgetEntries, setBudgetEntries]   = useState({}); // PRP-09: { [catId]: BudgetEntry[] }
  const [incomeSources, setIncomeSources]   = useState([]); // PRP-02: Named income streams
  const [monthOverrides, setMonthOverrides] = useState({}); // PRP-02: { "y-m": { catId: limit } }
  const [incomeAdjusts, setIncomeAdjusts]   = useState({}); // PRP-02: { "y-m": [ { sourceId, amount } ] }
  const [scenarios, setScenarios]         = useState([]);
  const [savingsGoals, setSavingsGoals]   = useState([]);
  const [forecastStartBalances, setForecastStartBalances] = useState({});
  const [accountBalances, setAccountBalances] = useState({});
  const [queue, setQueue]     = useState([]);
  const [qIdx, setQIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [newYear, setNewYear] = useState('');
  const [addingYear, setAddingYear] = useState(false);
  const [activeImportAccount, setActiveImportAccount] = useState('checking');
  const fileRef = useRef();

  const isIncomeCatLocal = (catId) => isIncomeCat(categories, catId);
  const isCCPaymentCatLocal = (catId) => isCCPaymentCat(categories, catId);

  const getcat = (id) => categories.find(c => c.id === id) || { label: id || 'Uncategorized', color: '#888' };

  useEffect(() => {
    (async () => {
      await migrateStorage(); 
      const sy = await store.get('budget-years') || [new Date().getFullYear()];
      const sr = await store.get('budget-rules') || [];
      const sc = await store.get('budget-categories') || INITIAL_CATEGORIES;
      const be = await store.get('budget-entries') || {};
      let is = await store.get('income-sources') || [];
      // PRP-10: migrate legacy flat-amount sources to entries format
      if (is.some(s => !s.entries && s.amount !== undefined)) {
        is = is.map(s => {
          if (s.entries) return s;
          const { amount, ...rest } = s;
          return { ...rest, entries: amount > 0 ? [{ id: `ie-${Date.now()}-${s.id}`, amount, startDate: '2000-01', endDate: null }] : [] };
        });
        await store.set('income-sources', is);
      }
      const ssn = await store.get('scenarios') || [];
      const ssg = await store.get('savings-goals') || [];

      // Load forecast starting balances for all known years
      const fsb = {};
      for (const y of sy) {
        const bal = await store.get(`forecast-start-${y}`);
        if (bal != null) fsb[y] = bal;
      }

      // Load account balance records for all known years/months
      const abs = {};
      for (const y of sy) {
        for (let m = 0; m < 12; m++) {
          const rec = await store.get(`balance-${y}-${m}`);
          if (rec) abs[`balance-${y}-${m}`] = rec;
        }
      }

      setYears(sy); setYear(sy[sy.length - 1]); setRules(sr); setCategories(sc);
      setBudgetEntries(be); setIncomeSources(is); setScenarios(ssn); setSavingsGoals(ssg);
      setForecastStartBalances(fsb);
      setAccountBalances(abs);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!year) return;
    (async () => {
      const t = {}, inc = {}, movr = {}, iadj = {};
      
      for (let m = 0; m < 12; m++) {
        const key = `${year}-${m}`;
        const td = await store.get(`t-${year}-${m}`);
        const id = await store.get(`i-${year}-${m}`);
        const ovr = await store.get(`budget-override-${year}-${m}`);
        const adj = await store.get(`income-adjust-${year}-${m}`);
        
        if (td) t[key] = td;
        if (id !== null) inc[key] = id;
        if (ovr) movr[key] = ovr;
        if (adj) iadj[key] = adj;
      }
      setTxns(t);
      setIncomes(inc);
      setMonthOverrides(prev => ({ ...prev, ...movr }));
      setIncomeAdjusts(prev => ({ ...prev, ...iadj }));

      // Load forecast starting balance for this year if not already loaded
      const bal = await store.get(`forecast-start-${year}`);
      if (bal != null) setForecastStartBalances(prev => ({ ...prev, [year]: bal }));

      // Load account balance records for this year
      const balRecs = {};
      for (let m = 0; m < 12; m++) {
        const rec = await store.get(`balance-${year}-${m}`);
        if (rec) balRecs[`balance-${year}-${m}`] = rec;
      }
      if (Object.keys(balRecs).length > 0) {
        setAccountBalances(prev => ({ ...prev, ...balRecs }));
      }
    })();
  }, [year]);

  const saveTxns = async (y, m, data) => { setTxns(prev => ({ ...prev, [`${y}-${m}`]: data })); await store.set(`t-${y}-${m}`, data); };
  const saveIncome = async (y, m, val) => { setIncomes(prev => ({ ...prev, [`${y}-${m}`]: val })); await store.set(`i-${y}-${m}`, val); };
  const saveRules = async (newRules) => { setRules(newRules); await store.set('budget-rules', newRules); };
  const saveCategories = async (newCats) => { setCategories(newCats); await store.set('budget-categories', newCats); };
  
  const saveBudgetEntries = async (data) => {
    setBudgetEntries(data);
    await store.set('budget-entries', data);
  };
  const saveIncomeSources = async (data) => { setIncomeSources(data); await store.set('income-sources', data); };
  const saveScenarios = async (data) => { setScenarios(data); await store.set('scenarios', data); };
  const saveForecastStart = async (y, amount) => {
    setForecastStartBalances(prev => ({ ...prev, [y]: amount }));
    await store.set(`forecast-start-${y}`, amount);
  };
  const saveAccountBalance = async (y, m, record) => {
    const key = `balance-${y}-${m}`;
    const existing = accountBalances[key];
    if (existing && existing.date >= record.date) return;
    setAccountBalances(prev => ({ ...prev, [key]: record }));
    await store.set(key, record);
  };
  const saveMonthOverride = async (y, m, data) => {
    const key = `${y}-${m}`;
    setMonthOverrides(prev => ({ ...prev, [key]: data }));
    await store.set(`budget-override-${y}-${m}`, data);
  };
  const saveIncomeAdjust = async (y, m, data) => {
    const key = `${y}-${m}`;
    setIncomeAdjusts(prev => ({ ...prev, [key]: data }));
    await store.set(`income-adjust-${y}-${m}`, data);
  };

  const reapplyRules = async () => {
    const activeRules = rules.filter(r => r.active);
    if (!activeRules.length) return 0;
    const updatedTxns = { ...txns };
    let count = 0;
    for (const [key, list] of Object.entries(txns)) {
      const updated = list.map(t => {
        const match = activeRules.find(r => t.description.toLowerCase().includes(r.trigger.toLowerCase()));
        if (!match) return t;
        const newType = isIncomeCatLocal(match.targetCategory) ? 'income' : 'expense';
        if (t.category === match.targetCategory && t.type === newType) return t;
        count++;
        return { ...t, category: match.targetCategory, type: newType };
      });
      updatedTxns[key] = updated;
      const [y, m] = key.split('-').map(Number);
      await store.set(`t-${y}-${m}`, updated);
    }
    setTxns(updatedTxns);
    return count;
  };

  const monthData = (y, m) => {
    const key = `${y}-${m}`;
    const list = txns[key] || [];
    const legacyInc = incomes[key] || 0;
    const overrides = monthOverrides[key] || {};
    const adjustments = incomeAdjusts[key] || [];

    const totalIncome = resolveMonthIncome(incomeSources, legacyInc, adjustments, y, m);
    const expenses = list.filter(t => !isIncomeCatLocal(t.category) && !isCCPaymentCatLocal(t.category) && t.type !== 'income').reduce((s,t) => s + t.amount, 0);
    const txnIncome = list.filter(t => (isIncomeCatLocal(t.category) || t.type === 'income') && !isCCPaymentCatLocal(t.category)).reduce((s,t) => s + t.amount, 0);
    // Use transaction income when available; income sources are planning-only fallback
    const effectiveIncome = txnIncome > 0 ? txnIncome : totalIncome;

    return { 
      list, totalIncome: effectiveIncome, expenses, net: effectiveIncome - expenses, overrides, adjustments
    };
  };

  const yearSummary = (y) => {
    const monthly = MONTHS.map((_, i) => ({ name: MONTHS_SHORT[i], ...monthData(y, i) }));
    return {
      monthly,
      totalIncome: monthly.reduce((s,m) => s + m.totalIncome, 0),
      totalExpenses: monthly.reduce((s,m) => s + m.expenses, 0),
      net: monthly.reduce((s,m) => s + m.net, 0),
    };
  };

  const handleFile = async e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async evt => {
      const { txns: parsed, closingBalance } = parseCSV(evt.target.result, activeImportAccount);
      if (!parsed.length) return alert('No transactions found.');
      const activeRules = rules.filter(r => r.active);
      const toManualQueue = []; const autoClassifiedGroups = {}; const newYearsSet = new Set(years);
      for (const txn of parsed) {
        const matchedRule = activeRules.find(r => txn.description.toLowerCase().includes(r.trigger.toLowerCase()));
        if (matchedRule) {
          const classified = { ...txn, category: matchedRule.targetCategory, type: isIncomeCatLocal(matchedRule.targetCategory) ? 'income' : 'expense' };
          let y = year; let m = month ?? new Date().getMonth();
          if (txn.date) { const d = new Date(txn.date); if (!isNaN(d)) { y = d.getFullYear(); m = d.getMonth(); } }
          newYearsSet.add(y); const k = `${y}-${m}`;
          if (!autoClassifiedGroups[k]) autoClassifiedGroups[k] = [];
          autoClassifiedGroups[k].push(classified);
        } else { toManualQueue.push(txn); }
      }
      for (const [k, txnsToAdd] of Object.entries(autoClassifiedGroups)) {
        const [yStr, mStr] = k.split('-'); const yInt = parseInt(yStr);
        const existing = (await store.get(`t-${yInt}-${mStr}`)) || [];
        const combined = [...existing, ...txnsToAdd];
        await store.set(`t-${yInt}-${mStr}`, combined);
        if (yInt === year) setTxns(prev => ({ ...prev, [k]: combined }));
      }
      if (newYearsSet.size > years.length) {
        const updatedYears = Array.from(newYearsSet).sort();
        setYears(updatedYears); await store.set('budget-years', updatedYears);
      }
      if (closingBalance && activeImportAccount === 'checking') {
        const d = new Date(closingBalance.date);
        if (!isNaN(d)) {
          await saveAccountBalance(d.getFullYear(), d.getMonth(), { ...closingBalance, source: 'csv' });
        }
      }
      if (toManualQueue.length > 0) { setQueue(toManualQueue); setQIdx(0); setView('classify'); }
      else { alert('Import complete!'); setView(month !== null ? 'month' : 'overview'); }
    };
    reader.readAsText(file); e.target.value = '';
  };

  const classify = async (txn, catId, ruleData = null) => {
    const classified = { ...txn, category: catId };
    classified.type = isIncomeCatLocal(catId) ? 'income' : 'expense';
    let y = year; let m = month ?? new Date().getMonth();
    if (txn.date) { const d = new Date(txn.date); if (!isNaN(d)) { y = d.getFullYear(); m = d.getMonth(); } }
    const k = `${y}-${m}`;
    
    if (!years.includes(y)) {
      const updatedYears = [...years, y].sort();
      setYears(updatedYears);
      await store.set('budget-years', updatedYears);
    }

    const currentTxns = (await store.get(`t-${y}-${m}`)) || [];
    const updated = [...currentTxns, classified];
    await saveTxns(y, m, updated);
    
    if (ruleData && ruleData.create && catId) {
      const newRule = { 
        id: `rule-${Date.now()}`, 
        trigger: ruleData.trigger || txn.description, 
        targetCategory: catId, 
        amountThreshold: ruleData.amountThreshold,
        type: ruleData.type,
        active: true 
      };
      await saveRules([...rules, newRule]);
    }
    qIdx + 1 < queue.length ? setQIdx(i => i + 1) : done();
  };

  const updateTxn = async (y, m, id, updates) => {
    const k = `${y}-${m}`;
    const updated = (txns[k] || []).map(t => t.id === id ? { ...t, ...updates } : t);
    await saveTxns(y, m, updated);
  };

  const done = () => { setQueue([]); setQIdx(0); setView(month !== null ? 'month' : 'overview'); };
  const deleteTxn = async (id) => { if (month === null) return; const k = `${year}-${month}`; await saveTxns(year, month, (txns[k] || []).filter(t => t.id !== id)); };
  const clearMonthTxns = async () => { if (month === null) return; await saveTxns(year, month, []); };
  const addManual = async (txn) => { const m = month ?? new Date().getMonth(); const k = `${year}-${m}`; await saveTxns(year, m, [...(txns[k] || []), { ...txn, id: `m-${Date.now()}`, account: 'manual' }]); };
  const doAddYear = async () => { const y = parseInt(newYear); if (!y || years.includes(y)) return; const updated = [...years, y].sort(); setYears(updated); await store.set('budget-years', updated); setYear(y); setNewYear(''); setAddingYear(false); };
  const triggerImport = (type) => { setActiveImportAccount(type); setTimeout(() => fileRef.current?.click(), 0); };

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', color:'var(--color-text-secondary)', fontFamily:'var(--font-sans)', fontSize:14 }}>Loading...</div>;

  return (
    <div style={{ minHeight:'100vh', background:'var(--color-background-tertiary)', color:'var(--color-text-primary)', fontFamily:'var(--font-sans)' }}>
      <style>{S}</style>
      <div style={{ borderBottom:'0.5px solid var(--color-border-tertiary)', background:'var(--color-background-primary)', padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', height:52, position:'sticky', top:0, zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:20 }}>
          <span style={{ fontWeight:500, fontSize:15, letterSpacing:'-0.01em' }}>Budget</span>
          <div style={{ display:'flex', gap:4 }}>
            <button className={`nav-tab ${view === 'budget' ? 'active' : ''}`} onClick={() => { setView('budget'); setMonth(null); }}>Budget</button>
            <button className={`nav-tab ${view === 'overview' ? 'active' : ''}`} onClick={() => { setView('overview'); setMonth(null); }}>Overview</button>
            <button className={`nav-tab ${view === 'forecast' ? 'active' : ''}`} onClick={() => { setView('forecast'); setMonth(null); }}>Forecast</button>
            <button className={`nav-tab ${view === 'scenarios' ? 'active' : ''}`} onClick={() => { setView('scenarios'); setMonth(null); }}>Scenarios</button>
            {month !== null && <button className={`nav-tab ${view === 'month' ? 'active' : ''}`} onClick={() => setView('month')}>{MONTHS[month]}</button>}
            <button className={`nav-tab ${view === 'rules' ? 'active' : ''}`} onClick={() => setView('rules')}>Rules</button>
            <button className={`nav-tab ${view === 'categories' ? 'active' : ''}`} onClick={() => setView('categories')}>Categories</button>
            {view === 'classify' && <button className="nav-tab active">Classify</button>}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {years.map(y => <button key={y} onClick={() => setYear(y)} style={{ padding:'4px 10px', fontSize:13, borderRadius:6, background: y===year ? 'var(--color-background-secondary)' : 'transparent', border: y===year ? '0.5px solid var(--color-border-secondary)' : '0.5px solid transparent', color:'var(--color-text-primary)', cursor:'pointer', fontFamily:'var(--font-sans)' }}>{y}</button>)}
          {addingYear ? <div style={{ display:'flex', gap:4, alignItems:'center' }}><input className="input-f" style={{ width:70, padding:'4px 8px', fontSize:13 }} placeholder={String(new Date().getFullYear()+1)} value={newYear} onChange={e => setNewYear(e.target.value)} onKeyDown={e => e.key==='Enter' && doAddYear()} autoFocus /><button className="btn-p" style={{ padding:'5px 10px', fontSize:12 }} onClick={doAddYear}>Add</button><button className="btn-g" style={{ padding:'5px 8px', fontSize:12 }} onClick={() => setAddingYear(false)}>X</button></div> : <button className="btn-g" style={{ padding:'4px 10px', fontSize:12, borderStyle:'dashed' }} onClick={() => setAddingYear(true)}>+ Year</button>}
          <div className="dropdown"><button className="btn-p">Import CSV</button><div className="dropdown-content"><button onClick={() => triggerImport('checking')}>Checking Account</button><button onClick={() => triggerImport('credit')}>Credit Card</button></div></div>
          <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display:'none' }} onChange={handleFile} />
        </div>
      </div>
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'32px 24px' }}>
        {view === 'classify' && <ClassifyView queue={queue} idx={qIdx} categories={categories} onClassify={classify} onSkip={() => classify(queue[qIdx], null)} onDone={done} onSaveCategories={saveCategories} />}
        {view === 'overview' && <OverviewView year={year} yearSummary={yearSummary} monthData={monthData} categories={categories} budgetEntries={budgetEntries} monthOverrides={monthOverrides} accountBalances={accountBalances} onSelectMonth={m => { setMonth(m); setView('month'); }} />}
        {view === 'forecast' && (
          <ForecastView
            year={year}
            incomeSources={incomeSources}
            budgetEntries={budgetEntries}
            categories={categories}
            allTxns={txns}
            allIncomeAdjusts={incomeAdjusts}
            allOverrides={monthOverrides}
            startingBalance={forecastStartBalances[year] ?? 0}
            onSaveBalance={amount => saveForecastStart(year, amount)}
            onNavigateToMonth={(y, m) => { setYear(y); setMonth(m); setView('month'); }}
            latestAccountBalance={(() => {
              let latest = null;
              for (let m = 0; m < 12; m++) {
                const rec = accountBalances[`balance-${year}-${m}`];
                if (rec && (!latest || rec.date > latest.date)) latest = rec;
              }
              return latest;
            })()}
          />
        )}
        {view === 'rules' && <RulesView rules={rules} categories={categories} onSaveRules={saveRules} onReapplyRules={reapplyRules} txnCount={Object.values(txns).reduce((s, list) => s + list.length, 0)} />}
        {view === 'categories' && <CategoriesView categories={categories} onSaveCategories={saveCategories} />}
        {view === 'budget' && <BudgetView categories={categories} budgetEntries={budgetEntries} onSaveBudgetEntries={saveBudgetEntries} incomeSources={incomeSources} onSaveIncomeSources={saveIncomeSources} year={year} />}
        {view === 'scenarios' && (
          <ScenariosView 
            scenarios={scenarios}
            incomeSources={incomeSources}
            budgetEntries={budgetEntries}
            categories={categories}
            allTxns={txns}
            allIncomeAdjusts={incomeAdjusts}
            allOverrides={monthOverrides}
            onSave={saveScenarios}
          />
        )}
        {view === 'month' && month !== null && (
          <MonthView
            year={year}
            month={month}
            data={monthData(year, month)}
            categories={categories}
            budgetEntries={budgetEntries}
            incomeSources={incomeSources}
            monthOverrides={monthOverrides[`${year}-${month}`] || {}}
            incomeAdjustments={incomeAdjusts[`${year}-${month}`] || []}
            getcat={getcat}
            onUpdateIncome={v => saveIncome(year, month, v)}
            onUpdateTxn={(id, updates) => updateTxn(year, month, id, updates)}
            onSaveOverride={(data) => saveMonthOverride(year, month, data)}
            onSaveIncomeAdjust={(data) => saveIncomeAdjust(year, month, data)}
            onDelete={deleteTxn}
            onClearMonth={clearMonthTxns}
            onImport={triggerImport}
            onAddManual={addManual}
            accountBalance={accountBalances[`balance-${year}-${month}`] || null}
            lastKnownBalance={(() => {
              for (let m = month - 1; m >= 0; m--) {
                const rec = accountBalances[`balance-${year}-${m}`];
                if (rec) return rec;
              }
              return null;
            })()}
          />
        )}
      </div>
    </div>
  );
}
