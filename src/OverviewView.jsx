import { resolveMonthBudget, getCategorySpend, getBudgetStatus } from "./utils";

export default function OverviewView({ year, yearSummary, monthData, categories, budgetEntries, monthOverrides, accountBalances, onSelectMonth }) {
  const s = yearSummary(year); const maxBar = Math.max(...s.monthly.map(m => Math.max(m.totalIncome, m.expenses)), 1); const now = new Date();
  const fmtLocal = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Math.abs(n));
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const latestBalance = (() => {
    let latest = null;
    for (let m = 0; m < 12; m++) {
      const rec = (accountBalances || {})[`balance-${year}-${m}`];
      if (rec && (!latest || rec.date > latest.date)) latest = rec;
    }
    return latest;
  })();

  const fmtDate = dateStr => {
    const d = new Date(dateStr);
    return isNaN(d) ? dateStr : d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-[26px] font-medium mb-1">{year}</h1>
        <p className="text-sm text-muted">Annual summary</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-7">
        {[
          { label: 'Total income',   value: s.totalIncome,   sign: '+',            ok: true      },
          { label: 'Total expenses', value: s.totalExpenses, sign: '-',            ok: false     },
          { label: 'Net savings',    value: s.net,           sign: s.net>=0?'+':'-', ok: s.net>=0 },
        ].map(k => (
          <div key={k.label} className="card px-5 py-4">
            <p className="text-[11px] text-muted uppercase tracking-[0.06em] mb-[10px]">{k.label}</p>
            <p className={`text-[26px] font-medium font-mono ${k.ok ? 'text-success' : 'text-danger'}`}>{k.sign}{fmtLocal(k.value)}</p>
          </div>
        ))}
      </div>

      {latestBalance && (
        <div className="card px-5 py-3 mb-4 flex items-center gap-4">
          <span className="text-[11px] text-muted uppercase tracking-[0.06em]">Account balance</span>
          <span className="text-base font-medium font-mono">{fmtLocal(latestBalance.balance)}</span>
          <span className="text-xs text-muted">as of {fmtDate(latestBalance.date)}</span>
        </div>
      )}

      <div className="card px-5 pt-5 pb-4 mb-7">
        <p className="text-[11px] text-muted uppercase tracking-[0.06em] mb-4">Monthly Performance</p>
        <div className="flex items-end gap-1.5 h-[100px]">
          {s.monthly.map((m, i) => {
            const isCur = i === now.getMonth() && year === now.getFullYear();
            return (
              <div key={i} onClick={() => onSelectMonth(i)} className="flex-1 cursor-pointer flex flex-col items-center gap-1">
                <div className="w-full flex gap-0.5 items-end h-[78px]">
                  <div className="flex-1 bg-success-bg rounded-[2px_2px_0_0] opacity-80" style={{ height: `${(m.totalIncome / maxBar) * 100}%`, minHeight: m.totalIncome > 0 ? 2 : 0 }} />
                  <div className="flex-1 bg-danger-bg rounded-[2px_2px_0_0] opacity-80" style={{ height: `${(m.expenses / maxBar) * 100}%`, minHeight: m.expenses > 0 ? 2 : 0 }} />
                </div>
                <span className={`text-[10px] ${isCur ? 'text-text font-medium' : 'text-muted'}`}>{m.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-[10px]">
        {MONTHS.map((name, i) => {
          const d = monthData(year, i); const hasData = d.list.length > 0 || d.totalIncome > 0; const isCur = i === now.getMonth() && year === now.getFullYear();

          const overCount = categories.filter(c => {
            const spent = getCategorySpend(d.list, c.id);
            const limit = resolveMonthBudget(budgetEntries, monthOverrides[`${year}-${i}`] || {}, c.id, year, i);
            return getBudgetStatus(spent, limit) === 'over';
          }).length;

          const hasAnyBudget = categories.some(c =>
            resolveMonthBudget(budgetEntries, monthOverrides[`${year}-${i}`] || {}, c.id, year, i) !== null
          );

          return (
            <div key={i} className="month-card" onClick={() => onSelectMonth(i)} style={{ borderColor: isCur ? 'var(--color-info)' : undefined }}>
              <p className="text-sm font-medium">{name}</p>
              {hasData ? (
                <>
                  <p className="text-xs text-muted">+ {fmtLocal(d.totalIncome)}</p>
                  <p className="text-xs text-muted">- {fmtLocal(d.expenses)}</p>
                  <p className={`text-lg font-medium font-mono ${d.net >= 0 ? 'text-success' : 'text-danger'}`}>{d.net >= 0 ? '+' : ''}{fmtLocal(d.net)}</p>
                  {overCount > 0 && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-danger inline-block" />
                      <span className="text-[11px] text-danger">{overCount} over budget</span>
                    </div>
                  )}
                  {overCount === 0 && hasAnyBudget && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                      <span className="text-[11px] text-success">On track</span>
                    </div>
                  )}
                </>
              ) : <p className="text-xs text-muted italic">No data</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
