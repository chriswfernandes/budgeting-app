import { useState } from "react";
import { buildForecast } from "./utils";
import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const fmt = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Math.abs(n));
const fmtSigned = n => (n >= 0 ? '+' : '-') + fmt(n);
const fmtCompact = v => {
  const a = Math.abs(v);
  if (a >= 10000) return `$${(v / 1000).toFixed(0)}K`;
  if (a >= 1000)  return `$${(v / 1000).toFixed(1)}K`;
  return `$${Math.round(v)}`;
};

function ForecastTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const balance = payload[0]?.value ?? payload[1]?.value;
  if (balance == null) return null;
  const { net, isActual } = payload[0]?.payload || {};
  return (
    <div className="card px-3 py-2.5 text-xs" style={{ pointerEvents: 'none', zIndex: 50 }}>
      <p className="font-semibold mb-1.5">{label}</p>
      <p className="font-mono">{fmt(balance)}</p>
      {net != null && (
        <p className={`mt-1 ${net >= 0 ? 'text-success' : 'text-danger'}`}>Net: {fmtSigned(net)}</p>
      )}
      {!isActual && <p className="text-muted mt-1 italic">Projected</p>}
    </div>
  );
}

export default function ForecastView({
  year,
  incomeSources,
  budgetEntries,
  categories,
  allTxns,
  allIncomeAdjusts,
  allOverrides,
  startingBalance,
  onSaveBalance,
  onNavigateToMonth,
  latestAccountBalance,
}) {
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState(String(startingBalance));

  const openEdit = () => { setBalanceInput(String(startingBalance)); setEditingBalance(true); };
  const closeEdit = () => setEditingBalance(false);
  const commitEdit = () => { onSaveBalance(parseFloat(balanceInput) || 0); setEditingBalance(false); };

  const forecast = buildForecast(
    year, startingBalance, incomeSources, budgetEntries,
    allTxns, allIncomeAdjusts, allOverrides, categories
  );

  const plannedNet    = forecast.reduce((s, m) => s + (m.plannedIncome - m.plannedExpenses), 0);
  const actualNet     = forecast.filter(m => m.isActual).reduce((s, m) => s + m.net, 0);
  const yearEndEst    = forecast[11].runningBalance;
  const lastActualIdx = forecast.reduce((last, m, i) => m.isActual ? i : last, -1);
  const goesNegative  = forecast.some(m => m.runningBalance < 0);

  const chartData = forecast.map((m, i) => ({
    name: MONTHS_SHORT[m.month],
    actual:    i <= lastActualIdx ? m.runningBalance : null,
    projected: i >= lastActualIdx ? m.runningBalance : null,
    net: m.net,
    isActual: m.isActual,
  }));

  return (
    <div>
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-[28px] font-semibold mb-3">Forecast {year}</h1>
          {editingBalance ? (
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-muted">Starting balance</span>
              <input
                className="input-field !w-[140px] !py-[5px] !px-2.5 !text-[13px]"
                type="number"
                value={balanceInput}
                onChange={e => setBalanceInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') closeEdit(); }}
                autoFocus
              />
              <button className="btn-primary py-[5px] px-3 text-xs" onClick={commitEdit}>Save</button>
              <button className="btn-ghost py-[5px] px-2.5 text-xs" onClick={closeEdit}>Cancel</button>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-[13px] text-muted">Starting balance</span>
                <span className="text-[15px] font-mono font-medium">{fmt(startingBalance)}</span>
                <button className="btn-ghost py-[3px] px-2.5 text-xs" onClick={openEdit}>Edit</button>
                <span className="text-xs text-muted">Balance in account on Jan 1, {year}</span>
              </div>
              {latestAccountBalance && (
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-muted">
                    Last recorded balance: <span className="font-mono">{fmt(latestAccountBalance.balance)}</span>
                    {' '}(from {(() => { const d = new Date(latestAccountBalance.date); return isNaN(d) ? latestAccountBalance.date : d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }); })()})
                  </span>
                  <button className="btn-ghost py-[2px] px-2 text-[11px]" onClick={() => onSaveBalance(latestAccountBalance.balance)}>
                    Use this →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card px-5 py-5">
          <p className="text-xs text-muted mb-3">Planned net</p>
          <p className={`text-[38px] font-semibold font-mono leading-none ${plannedNet >= 0 ? 'text-success' : 'text-danger'}`}>
            {fmtSigned(plannedNet)}
          </p>
          <p className="text-xs text-muted mt-2">Full year</p>
        </div>
        <div className="card px-5 py-5">
          <p className="text-xs text-muted mb-3">Actual net</p>
          <p className={`font-semibold font-mono leading-none ${actualNet >= 0 ? 'text-success' : 'text-danger'} ${forecast.some(m => m.isActual) ? 'text-[38px]' : 'text-xl'}`}>
            {forecast.some(m => m.isActual) ? fmtSigned(actualNet) : <span className="text-muted">No data yet</span>}
          </p>
          <p className="text-xs text-muted mt-2">Months with transactions</p>
        </div>
        <div className="card px-5 py-5">
          <p className="text-xs text-muted mb-3">Year-end estimate</p>
          <p className={`text-[38px] font-semibold font-mono leading-none ${yearEndEst >= 0 ? 'text-text' : 'text-danger'}`}>
            {fmt(yearEndEst)}
          </p>
          <p className="text-xs text-muted mt-2">Projected balance at Dec 31</p>
        </div>
      </div>

      <div className="card px-5 pt-5 pb-4 mb-6">
        <p className="text-xs text-muted mb-4">Account balance projection</p>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--color-success)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0.03} />
              </linearGradient>
              <linearGradient id="gradProjected" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--color-success)" stopOpacity={0.10} />
                <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: 'var(--color-muted)', fontFamily: 'var(--font-sans)' }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tickFormatter={fmtCompact}
              tick={{ fontSize: 11, fill: 'var(--color-muted)', fontFamily: 'var(--font-sans)' }}
              axisLine={false} tickLine={false} width={52}
            />
            <Tooltip content={<ForecastTooltip />} cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }} />
            {goesNegative && (
              <ReferenceLine y={0} stroke="var(--color-danger)" strokeDasharray="4 3" strokeWidth={1} />
            )}
            <ReferenceLine y={startingBalance} stroke="var(--color-muted)" strokeDasharray="4 3" strokeWidth={1} strokeOpacity={0.5} />
            <Area
              type="monotone" dataKey="actual"
              stroke="var(--color-success)" strokeWidth={2}
              fill="url(#gradActual)"
              dot={{ r: 3, fill: 'var(--color-success)', strokeWidth: 0 }}
              activeDot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Area
              type="monotone" dataKey="projected"
              stroke="var(--color-success)" strokeWidth={1.5} strokeDasharray="6 4"
              fill="url(#gradProjected)"
              dot={{ r: 3, fill: 'var(--color-surface)', stroke: 'var(--color-success)', strokeWidth: 1.5 }}
              activeDot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex gap-5 pt-2.5 mt-1 border-t-[0.5px] border-border-subtle text-[11px] text-muted">
          <div className="flex items-center gap-1.5">
            <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="var(--color-success)" strokeWidth="2" /></svg>
            Actual
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="var(--color-success)" strokeWidth="2" strokeDasharray="5 4" opacity="0.7" /></svg>
            Projected
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="var(--color-muted)" strokeWidth="1" strokeDasharray="4 3" opacity="0.5" /></svg>
            Starting balance
          </div>
        </div>
      </div>

      <div className="card mb-6 overflow-hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-raised border-b-[0.5px] border-border-subtle">
              {['Month', 'Planned In', 'Planned Out', 'Actual In', 'Actual Out', 'Net', 'Balance'].map(h => (
                <th key={h} className={`px-3.5 py-2.5 font-medium text-[11px] text-muted uppercase tracking-[0.05em] ${h === 'Month' ? 'text-left' : 'text-right'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {forecast.map((m, i) => (
              <tr
                key={i}
                onClick={() => onNavigateToMonth(m.year, m.month)}
                className={`border-b-[0.5px] border-border-subtle last:border-b-0 cursor-pointer transition-colors hover:bg-raised ${m.isActual ? '' : 'bg-raised'}`}
              >
                <td className="px-3.5 py-3 whitespace-nowrap">
                  <span className="font-medium">{MONTHS_SHORT[m.month]}</span>
                  {' '}
                  <span className={`text-[11px] ${m.isActual ? 'text-success' : 'text-muted'}`}>
                    {m.isActual ? '✓' : '→'}
                  </span>
                </td>
                <td className="px-3.5 py-3 text-right font-mono text-xs text-muted">
                  {m.plannedIncome > 0 ? fmt(m.plannedIncome) : <span className="opacity-35">—</span>}
                </td>
                <td className="px-3.5 py-3 text-right font-mono text-xs text-muted">
                  {m.plannedExpenses > 0 ? fmt(m.plannedExpenses) : <span className="opacity-35">—</span>}
                </td>
                <td className="px-3.5 py-3 text-right font-mono text-xs">
                  {m.isActual ? <span className="text-success">{fmt(m.actualIncome)}</span> : <span className="opacity-35">—</span>}
                </td>
                <td className="px-3.5 py-3 text-right font-mono text-xs">
                  {m.isActual ? <span className="text-danger">{fmt(m.actualExpenses)}</span> : <span className="opacity-35">—</span>}
                </td>
                <td className="px-3.5 py-3 text-right font-mono font-medium">
                  <span className={m.net >= 0 ? 'text-success' : 'text-danger'}>{fmtSigned(m.net)}</span>
                </td>
                <td className="px-3.5 py-3 text-right font-mono font-medium">
                  <span className={m.runningBalance < 0 ? 'text-danger' : 'text-text'}>{fmt(m.runningBalance)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
