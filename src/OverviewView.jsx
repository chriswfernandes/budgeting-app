import { resolveMonthBudget, getCategorySpend, getBudgetStatus } from "./utils";
import {
  BarChart, Bar, XAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from "recharts";

const MONTHS_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const fmt = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Math.abs(n));
const fmtCompact = n => {
  const a = Math.abs(n);
  if (a >= 10000) return `$${(a / 1000).toFixed(0)}K`;
  if (a >= 1000)  return `$${(a / 1000).toFixed(1)}K`;
  return `$${Math.round(a)}`;
};

function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const inc = payload.find(p => p.dataKey === 'income')?.value || 0;
  const exp = payload.find(p => p.dataKey === 'expenses')?.value || 0;
  const net = inc - exp;
  return (
    <div className="card px-3 py-2.5 text-xs" style={{ pointerEvents: 'none', zIndex: 50 }}>
      <p className="font-semibold mb-1.5">{label}</p>
      <p className="text-success">+{fmt(inc)}</p>
      <p className="text-danger">-{fmt(exp)}</p>
      <p className={`font-medium mt-1 border-t-[0.5px] border-border-subtle pt-1 ${net >= 0 ? 'text-success' : 'text-danger'}`}>
        {net >= 0 ? '+' : '-'}{fmt(net)}
      </p>
    </div>
  );
}

function Sparkline({ data, color }) {
  if (!data.some(d => d.v !== 0)) return null;
  return (
    <LineChart width={80} height={36} data={data}>
      <Line
        type="monotone" dataKey="v"
        stroke={color} strokeWidth={2}
        dot={false} isAnimationActive={false}
      />
    </LineChart>
  );
}

export default function OverviewView({
  year, yearSummary, monthData, categories,
  budgetEntries, monthOverrides, accountBalances, onSelectMonth,
}) {
  const s   = yearSummary(year);
  const now = new Date();

  const latestBalance = (() => {
    let latest = null;
    for (let m = 0; m < 12; m++) {
      const rec = (accountBalances || {})[`balance-${year}-${m}`];
      if (rec && (!latest || rec.date > latest.date)) latest = rec;
    }
    return latest;
  })();

  const fmtDate = ds => {
    const d = new Date(ds);
    return isNaN(d) ? ds : d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Bar chart data
  const chartData = s.monthly.map((m, i) => ({
    name: MONTHS_SHORT[i],
    income: m.totalIncome,
    expenses: m.expenses,
  }));

  // Sparkline: last 6 months up to current (or Dec for past years)
  const refIdx   = year === now.getFullYear() ? now.getMonth() : 11;
  const sparkSlice = s.monthly.slice(Math.max(0, refIdx - 5), refIdx + 1);
  const sparkIncome   = sparkSlice.map(m => ({ v: m.totalIncome }));
  const sparkExpenses = sparkSlice.map(m => ({ v: m.expenses }));
  const sparkNet      = sparkSlice.map(m => ({ v: m.net }));

  // Delta vs prior month
  const curM  = s.monthly[refIdx];
  const prevM = refIdx > 0 ? s.monthly[refIdx - 1] : null;
  const pctDelta = (cur, prev) => {
    if (!prevM || !prev) return null;
    return prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100;
  };
  const fmtPct = p => p === null ? null : `${p >= 0 ? '+' : ''}${Math.round(p)}% vs last month`;
  const fmtAmtDelta = d => d === null ? null : `${d >= 0 ? '+' : '-'}${fmt(d)} vs last month`;

  const kpis = [
    {
      label: 'Total Income',
      value: s.totalIncome, sign: '+',
      colorClass: 'text-success', strokeColor: 'var(--color-success)',
      spark: sparkIncome,
      delta: fmtPct(pctDelta(curM.totalIncome, prevM?.totalIncome)),
    },
    {
      label: 'Total Expenses',
      value: s.totalExpenses, sign: '-',
      colorClass: 'text-danger', strokeColor: 'var(--color-danger)',
      spark: sparkExpenses,
      delta: fmtPct(pctDelta(curM.expenses, prevM?.expenses)),
    },
    {
      label: 'Net Savings',
      value: Math.abs(s.net), sign: s.net >= 0 ? '+' : '-',
      colorClass: s.net >= 0 ? 'text-success' : 'text-danger',
      strokeColor: s.net >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
      spark: sparkNet,
      delta: prevM ? fmtAmtDelta(curM.net - prevM.net) : null,
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold mb-1">{year}</h1>
        <p className="text-sm text-muted">Annual summary</p>
      </div>

      {/* Hero KPI cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {kpis.map(k => (
          <div key={k.label} className="card px-5 py-5">
            <p className="text-xs text-muted mb-3">{k.label}</p>
            <div className="flex items-end justify-between gap-2">
              <p
                className={`text-[38px] font-semibold font-mono leading-none ${k.colorClass}`}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {k.sign}{fmt(k.value)}
              </p>
              <div className="shrink-0 mb-0.5 opacity-70">
                <Sparkline data={k.spark} color={k.strokeColor} />
              </div>
            </div>
            {k.delta && <p className="text-xs text-muted mt-2">{k.delta}</p>}
          </div>
        ))}
      </div>

      {/* Account balance */}
      {latestBalance && (
        <div className="card px-5 py-3 mb-5 flex items-center gap-4">
          <span className="text-xs text-muted">Account balance</span>
          <span className="text-base font-semibold font-mono">{fmt(latestBalance.balance)}</span>
          <span className="text-xs text-muted">as of {fmtDate(latestBalance.date)}</span>
        </div>
      )}

      {/* Monthly performance chart */}
      <div className="card px-5 pt-5 pb-4 mb-7">
        <p className="text-xs text-muted mb-4">Monthly Performance</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barCategoryGap="28%" barGap={3}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--color-border-subtle)" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: 'var(--color-muted)', fontFamily: 'var(--font-sans)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<BarTooltip />} cursor={{ fill: 'var(--color-raised)' }} />
            <Bar dataKey="income"   name="Income"   fill="var(--color-success)" radius={[3,3,0,0]} maxBarSize={36} opacity={0.85} />
            <Bar dataKey="expenses" name="Expenses" fill="var(--color-danger)"  radius={[3,3,0,0]} maxBarSize={36} opacity={0.85} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-5 pt-2.5 mt-1 border-t-[0.5px] border-border-subtle text-[11px] text-muted">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm inline-block bg-success opacity-85" />
            Income
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm inline-block bg-danger opacity-85" />
            Expenses
          </div>
        </div>
      </div>

      {/* Month card grid */}
      <div className="grid grid-cols-4 gap-3">
        {MONTHS_FULL.map((name, i) => {
          const d       = monthData(year, i);
          const hasData = d.list.length > 0 || d.totalIncome > 0;
          const isCur   = i === now.getMonth() && year === now.getFullYear();

          const overCount = categories.filter(c => {
            const spent = getCategorySpend(d.list, c.id);
            const limit = resolveMonthBudget(budgetEntries, monthOverrides[`${year}-${i}`] || {}, c.id, year, i);
            return getBudgetStatus(spent, limit) === 'over';
          }).length;

          const hasAnyBudget = categories.some(c =>
            resolveMonthBudget(budgetEntries, monthOverrides[`${year}-${i}`] || {}, c.id, year, i) !== null
          );

          const spendPct  = d.totalIncome > 0 ? Math.min((d.expenses / d.totalIncome) * 100, 100) : 0;
          const overIncome = d.expenses > d.totalIncome && d.totalIncome > 0;

          return (
            <div
              key={i}
              className={`month-card${isCur ? ' border-l-2' : ''}`}
              style={isCur ? { borderLeftColor: 'var(--color-accent)' } : undefined}
              onClick={() => onSelectMonth(i)}
            >
              <p className="text-sm font-semibold mb-2">{name}</p>
              {hasData ? (
                <>
                  <p className={`text-[24px] font-semibold font-mono leading-tight mb-2 ${d.net >= 0 ? 'text-success' : 'text-danger'}`}
                     style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {d.net >= 0 ? '+' : '-'}{fmtCompact(d.net)}
                  </p>

                  {/* Mini spend bar */}
                  {d.totalIncome > 0 && (
                    <div className="h-1 bg-raised rounded-full mb-2.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${overIncome ? 'bg-danger' : 'bg-accent'}`}
                        style={{ width: `${spendPct}%` }}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-1">
                    <div>
                      <p className="text-[11px] text-muted">+{fmtCompact(d.totalIncome)}</p>
                      <p className="text-[11px] text-muted">-{fmtCompact(d.expenses)}</p>
                    </div>
                    {overCount > 0 && (
                      <span className="text-[10px] bg-danger-bg text-danger font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        {overCount} over
                      </span>
                    )}
                    {overCount === 0 && hasAnyBudget && (
                      <span className="text-[10px] bg-success-bg text-success font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        ✓ on track
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted italic">No data</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
