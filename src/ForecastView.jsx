import { useState } from "react";
import { buildForecast } from "./utils";

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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

  const openEdit = () => {
    setBalanceInput(String(startingBalance));
    setEditingBalance(true);
  };

  const closeEdit = () => setEditingBalance(false);

  const commitEdit = () => {
    onSaveBalance(parseFloat(balanceInput) || 0);
    setEditingBalance(false);
  };

  const fmt = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Math.abs(n));
  const fmtSigned = n => (n >= 0 ? '+' : '-') + fmt(n);
  const fmtCompact = v => {
    if (Math.abs(v) >= 10000) return `$${(v / 1000).toFixed(0)}K`;
    if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}K`;
    return `$${Math.round(v)}`;
  };

  const forecast = buildForecast(
    year, startingBalance, incomeSources, budgetEntries,
    allTxns, allIncomeAdjusts, allOverrides, categories
  );

  const plannedNet = forecast.reduce((s, m) => s + (m.plannedIncome - m.plannedExpenses), 0);
  const actualNet  = forecast.filter(m => m.isActual).reduce((s, m) => s + m.net, 0);
  const yearEndEst = forecast[11].runningBalance;

  const balances = forecast.map(m => m.runningBalance);
  const lastActualIdx = forecast.reduce((last, m, i) => m.isActual ? i : last, -1);

  const SVG_W = 800, SVG_H = 200;
  const PL = 56, PR = 16, PT = 12, PB = 28;
  const chartW = SVG_W - PL - PR;
  const chartH = SVG_H - PT - PB;

  const allChartValues = [...balances, startingBalance];
  const rawMin = Math.min(...allChartValues);
  const rawMax = Math.max(...allChartValues);
  const valuePad = (rawMax - rawMin) * 0.08 || 100;
  const minY = rawMin - valuePad;
  const maxY = rawMax + valuePad;
  const range = maxY - minY || 1;

  const toX = i => PL + (i / 11) * chartW;
  const toY = v => PT + (1 - (v - minY) / range) * chartH;

  const pointStr = i => `${toX(i).toFixed(1)},${toY(balances[i]).toFixed(1)}`;

  const solidPoints = lastActualIdx >= 0
    ? Array.from({ length: lastActualIdx + 1 }, (_, i) => pointStr(i)).join(' ')
    : null;

  const dashedStart = Math.max(0, lastActualIdx);
  const dashedPoints = Array.from({ length: 12 - dashedStart }, (_, i) => pointStr(dashedStart + i)).join(' ');

  const ticks = Array.from({ length: 5 }, (_, i) => minY + (i / 4) * (maxY - minY));
  const showZero = minY < 0 && maxY > 0;

  return (
    <div>
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-[26px] font-medium mb-3">Forecast {year}</h1>
          {editingBalance ? (
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-muted">Starting balance</span>
              <input
                className="input-field !w-[140px] !py-[5px] !px-2.5 !text-[13px]"
                type="number"
                value={balanceInput}
                onChange={e => setBalanceInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEdit();
                  if (e.key === 'Escape') closeEdit();
                }}
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
                  <button
                    className="btn-ghost py-[2px] px-2 text-[11px]"
                    onClick={() => onSaveBalance(latestAccountBalance.balance)}
                  >
                    Use this →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card px-5 py-4">
          <p className="text-[11px] text-muted uppercase tracking-[0.06em] mb-2">Planned net</p>
          <p className={`text-[26px] font-medium font-mono ${plannedNet >= 0 ? 'text-success' : 'text-danger'}`}>
            {fmtSigned(plannedNet)}
          </p>
          <p className="text-[11px] text-muted mt-1">Full year</p>
        </div>
        <div className="card px-5 py-4">
          <p className="text-[11px] text-muted uppercase tracking-[0.06em] mb-2">Actual net</p>
          <p className={`text-[26px] font-medium font-mono ${actualNet >= 0 ? 'text-success' : 'text-danger'}`}>
            {forecast.some(m => m.isActual) ? fmtSigned(actualNet) : <span className="text-lg text-muted">No data yet</span>}
          </p>
          <p className="text-[11px] text-muted mt-1">Months with transactions</p>
        </div>
        <div className="card px-5 py-4">
          <p className="text-[11px] text-muted uppercase tracking-[0.06em] mb-2">Year-end estimate</p>
          <p className={`text-[26px] font-medium font-mono ${yearEndEst >= 0 ? 'text-text' : 'text-danger'}`}>
            {fmt(yearEndEst)}
          </p>
          <p className="text-[11px] text-muted mt-1">Projected balance at Dec 31</p>
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
                  {m.isActual
                    ? <span className="text-success">{fmt(m.actualIncome)}</span>
                    : <span className="opacity-35">—</span>}
                </td>
                <td className="px-3.5 py-3 text-right font-mono text-xs">
                  {m.isActual
                    ? <span className="text-danger">{fmt(m.actualExpenses)}</span>
                    : <span className="opacity-35">—</span>}
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

      <div className="card px-5 pt-5 pb-2">
        <p className="text-[11px] text-muted uppercase tracking-[0.06em] mb-4">Account balance projection</p>
        <svg width="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ overflow: 'visible', display: 'block' }}>
          {ticks.map((v, i) => {
            const y = toY(v).toFixed(1);
            return (
              <g key={i}>
                <line x1={PL} y1={y} x2={SVG_W - PR} y2={y} stroke="var(--color-border-subtle)" strokeWidth="0.5" />
                <text x={PL - 6} y={parseFloat(y) + 4} fontSize="10" textAnchor="end" fill="var(--color-muted)">
                  {fmtCompact(v)}
                </text>
              </g>
            );
          })}
          {showZero && (
            <line x1={PL} y1={toY(0)} x2={SVG_W - PR} y2={toY(0)} stroke="var(--color-danger)" strokeWidth="0.5" strokeDasharray="3 3" />
          )}
          {(() => {
            const y = toY(startingBalance).toFixed(1);
            return (
              <line x1={PL} y1={y} x2={SVG_W - PR} y2={y}
                stroke="var(--color-muted)" strokeWidth="0.5" strokeDasharray="4 3" opacity="0.5" />
            );
          })()}
          {solidPoints && (
            <polyline points={solidPoints} fill="none" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          )}
          {dashedPoints && (
            <polyline points={dashedPoints} fill="none" stroke="var(--color-success)" strokeWidth="2"
              strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
          )}
          {forecast.map((m, i) => (
            <circle key={i} cx={toX(i).toFixed(1)} cy={toY(balances[i]).toFixed(1)} r="3"
              fill={m.isActual ? 'var(--color-success)' : 'var(--color-surface)'}
              stroke="var(--color-success)" strokeWidth="1.5" />
          ))}
          {forecast.map((m, i) => (
            <text key={i} x={toX(i).toFixed(1)} y={SVG_H - 4} fontSize="10" textAnchor="middle" fill="var(--color-muted)">
              {MONTHS_SHORT[m.month]}
            </text>
          ))}
        </svg>
        <div className="flex gap-5 mt-2 pt-2 border-t-[0.5px] border-border-subtle text-[11px] text-muted">
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
    </div>
  );
}
