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

  // ── Summary tile values ───────────────────────────────────────────────────

  const plannedNet = forecast.reduce((s, m) => s + (m.plannedIncome - m.plannedExpenses), 0);
  const actualNet  = forecast.filter(m => m.isActual).reduce((s, m) => s + m.net, 0);
  const yearEndEst = forecast[11].runningBalance;

  // ── Chart data ────────────────────────────────────────────────────────────

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

  // Y axis ticks (5 evenly spaced)
  const ticks = Array.from({ length: 5 }, (_, i) => minY + (i / 4) * (maxY - minY));

  // Show zero line only when range spans near zero
  const showZero = minY < 0 && maxY > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  const cardStyle = {
    background: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-lg)',
  };

  return (
    <div>
      {/* Header + balance editor */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 12 }}>Forecast {year}</h1>
          {editingBalance ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Starting balance</span>
              <input
                className="input-f"
                style={{ width: 140, padding: '5px 10px', fontSize: 13 }}
                type="number"
                value={balanceInput}
                onChange={e => setBalanceInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEdit();
                  if (e.key === 'Escape') closeEdit();
                }}
                autoFocus
              />
              <button className="btn-p" style={{ padding: '5px 12px', fontSize: 12 }} onClick={commitEdit}>Save</button>
              <button className="btn-g" style={{ padding: '5px 10px', fontSize: 12 }} onClick={closeEdit}>Cancel</button>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Starting balance</span>
                <span style={{ fontSize: 15, fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{fmt(startingBalance)}</span>
                <button className="btn-g" style={{ padding: '3px 10px', fontSize: 12 }} onClick={openEdit}>Edit</button>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  Balance in account on Jan 1, {year}
                </span>
              </div>
              {latestAccountBalance && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    Last recorded balance: <span style={{ fontFamily: 'var(--font-mono)' }}>{fmt(latestAccountBalance.balance)}</span>
                    {' '}(from {(() => { const d = new Date(latestAccountBalance.date); return isNaN(d) ? latestAccountBalance.date : d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }); })()})
                  </span>
                  <button
                    className="btn-g"
                    style={{ padding: '2px 8px', fontSize: 11 }}
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

      {/* Summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <div style={{ ...cardStyle, padding: '16px 20px' }}>
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Planned net</p>
          <p style={{ fontSize: 26, fontWeight: 500, fontFamily: 'var(--font-mono)', color: plannedNet >= 0 ? 'var(--color-text-success)' : 'var(--color-text-danger)' }}>
            {fmtSigned(plannedNet)}
          </p>
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>Full year</p>
        </div>
        <div style={{ ...cardStyle, padding: '16px 20px' }}>
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Actual net</p>
          <p style={{ fontSize: 26, fontWeight: 500, fontFamily: 'var(--font-mono)', color: actualNet >= 0 ? 'var(--color-text-success)' : 'var(--color-text-danger)' }}>
            {forecast.some(m => m.isActual) ? fmtSigned(actualNet) : <span style={{ fontSize: 18, color: 'var(--color-text-secondary)' }}>No data yet</span>}
          </p>
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>Months with transactions</p>
        </div>
        <div style={{ ...cardStyle, padding: '16px 20px' }}>
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Year-end estimate</p>
          <p style={{ fontSize: 26, fontWeight: 500, fontFamily: 'var(--font-mono)', color: yearEndEst >= 0 ? 'var(--color-text-primary)' : 'var(--color-text-danger)' }}>
            {fmt(yearEndEst)}
          </p>
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4 }}>Projected balance at Dec 31</p>
        </div>
      </div>

      {/* Monthly forecast table */}
      <div style={{ ...cardStyle, marginBottom: 24, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--color-background-secondary)', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
              {['Month', 'Planned In', 'Planned Out', 'Actual In', 'Actual Out', 'Net', 'Balance'].map(h => (
                <th key={h} style={{ padding: '10px 14px', fontWeight: 500, textAlign: h === 'Month' ? 'left' : 'right', color: 'var(--color-text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {forecast.map((m, i) => (
              <tr
                key={i}
                onClick={() => onNavigateToMonth(m.year, m.month)}
                style={{
                  borderBottom: i < 11 ? '0.5px solid var(--color-border-tertiary)' : 'none',
                  background: m.isActual ? 'transparent' : 'var(--color-background-secondary)',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-background-secondary)'}
                onMouseLeave={e => e.currentTarget.style.background = m.isActual ? 'transparent' : 'var(--color-background-secondary)'}
              >
                {/* Month */}
                <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                  <span style={{ fontWeight: 500 }}>{MONTHS_SHORT[m.month]}</span>
                  {' '}
                  <span style={{ fontSize: 11, color: m.isActual ? 'var(--color-text-success)' : 'var(--color-text-secondary)' }}>
                    {m.isActual ? '✓' : '→'}
                  </span>
                </td>

                {/* Planned In */}
                <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', fontSize: 12 }}>
                  {m.plannedIncome > 0 ? fmt(m.plannedIncome) : <span style={{ opacity: 0.35 }}>—</span>}
                </td>

                {/* Planned Out */}
                <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', fontSize: 12 }}>
                  {m.plannedExpenses > 0 ? fmt(m.plannedExpenses) : <span style={{ opacity: 0.35 }}>—</span>}
                </td>

                {/* Actual In */}
                <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {m.isActual
                    ? <span style={{ color: 'var(--color-text-success)' }}>{fmt(m.actualIncome)}</span>
                    : <span style={{ opacity: 0.35 }}>—</span>}
                </td>

                {/* Actual Out */}
                <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {m.isActual
                    ? <span style={{ color: 'var(--color-text-danger)' }}>{fmt(m.actualExpenses)}</span>
                    : <span style={{ opacity: 0.35 }}>—</span>}
                </td>

                {/* Net */}
                <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 13 }}>
                  <span style={{ color: m.net >= 0 ? 'var(--color-text-success)' : 'var(--color-text-danger)' }}>
                    {fmtSigned(m.net)}
                  </span>
                </td>

                {/* Running balance */}
                <td style={{ padding: '11px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: 13 }}>
                  <span style={{ color: m.runningBalance < 0 ? 'var(--color-text-danger)' : 'var(--color-text-primary)' }}>
                    {fmt(m.runningBalance)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Balance chart */}
      <div style={{ ...cardStyle, padding: '20px 20px 8px' }}>
        <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
          Account balance projection
        </p>
        <svg width="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ overflow: 'visible', display: 'block' }}>

          {/* Y axis ticks and gridlines */}
          {ticks.map((v, i) => {
            const y = toY(v).toFixed(1);
            return (
              <g key={i}>
                <line x1={PL} y1={y} x2={SVG_W - PR} y2={y} stroke="var(--color-border-tertiary)" strokeWidth="0.5" />
                <text x={PL - 6} y={parseFloat(y) + 4} fontSize="10" textAnchor="end" fill="var(--color-text-secondary)">
                  {fmtCompact(v)}
                </text>
              </g>
            );
          })}

          {/* Zero line (only when range spans zero) */}
          {showZero && (
            <line x1={PL} y1={toY(0)} x2={SVG_W - PR} y2={toY(0)} stroke="var(--color-text-danger)" strokeWidth="0.5" strokeDasharray="3 3" />
          )}

          {/* Starting balance reference line */}
          {(() => {
            const y = toY(startingBalance).toFixed(1);
            return (
              <line x1={PL} y1={y} x2={SVG_W - PR} y2={y}
                stroke="var(--color-text-secondary)" strokeWidth="0.5" strokeDasharray="4 3" opacity="0.5" />
            );
          })()}

          {/* Solid line — actual months */}
          {solidPoints && (
            <polyline points={solidPoints} fill="none" stroke="var(--color-text-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          )}

          {/* Dashed line — projected months */}
          {dashedPoints && (
            <polyline points={dashedPoints} fill="none" stroke="var(--color-text-success)" strokeWidth="2"
              strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
          )}

          {/* Data points */}
          {forecast.map((m, i) => (
            <circle key={i} cx={toX(i).toFixed(1)} cy={toY(balances[i]).toFixed(1)} r="3"
              fill={m.isActual ? 'var(--color-text-success)' : 'var(--color-background-primary)'}
              stroke="var(--color-text-success)" strokeWidth="1.5" />
          ))}

          {/* X axis month labels */}
          {forecast.map((m, i) => (
            <text key={i} x={toX(i).toFixed(1)} y={SVG_H - 4} fontSize="10" textAnchor="middle" fill="var(--color-text-secondary)">
              {MONTHS_SHORT[m.month]}
            </text>
          ))}
        </svg>

        {/* Chart legend */}
        <div style={{ display: 'flex', gap: 20, marginTop: 8, paddingTop: 8, borderTop: '0.5px solid var(--color-border-tertiary)', fontSize: 11, color: 'var(--color-text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="var(--color-text-success)" strokeWidth="2" /></svg>
            Actual
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="var(--color-text-success)" strokeWidth="2" strokeDasharray="5 4" opacity="0.7" /></svg>
            Projected
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke="var(--color-text-secondary)" strokeWidth="1" strokeDasharray="4 3" opacity="0.5" /></svg>
            Starting balance
          </div>
        </div>
      </div>
    </div>
  );
}
