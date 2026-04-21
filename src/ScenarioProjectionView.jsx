import { useState } from "react";

export default function ScenarioProjectionView({ scenario, projection, onEdit, onBack }) {
  const fmt = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Math.abs(n));

  const finalCumulative = projection[projection.length - 1].cumulativeNet;
  const avgMonthlyNet = projection.reduce((sum, m) => sum + m.net, 0) / projection.length;
  const maxCumulative = Math.max(...projection.map(m => m.cumulativeNet), 0);
  const minCumulative = Math.min(...projection.map(m => m.cumulativeNet), 0);

  const targetMet = scenario.savingsTarget !== undefined ? finalCumulative >= scenario.savingsTarget : null;

  const width = 800;
  const height = 200;
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const getX = (i) => padding + (i * (chartWidth / (projection.length - 1 || 1)));
  const getY = (val) => {
    const range = Math.max(maxCumulative, scenario.savingsTarget || 0) - Math.min(minCumulative, scenario.floorAmount || 0, 0);
    const min = Math.min(minCumulative, scenario.floorAmount || 0, 0);
    const normalized = range === 0 ? 0.5 : (val - min) / range;
    return height - padding - (normalized * chartHeight);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-7">
        <div className="flex items-center gap-3">
          <button className="btn-ghost py-1.5 px-3" onClick={onBack}>← Back</button>
          <span className="w-3 h-3 rounded-full inline-block" style={{ background: scenario.color }} />
          <h1 className="text-2xl font-medium">{scenario.name}</h1>
        </div>
        <button className="btn-primary" onClick={onEdit}>Edit Scenario</button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card p-5">
          <p className="text-[11px] text-muted uppercase tracking-[0.06em] mb-2">Avg. Monthly Net</p>
          <p className={`text-2xl font-semibold ${avgMonthlyNet >= 0 ? 'text-success' : 'text-danger'}`}>
            {avgMonthlyNet >= 0 ? '+' : '-'}{fmt(avgMonthlyNet)}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-[11px] text-muted uppercase tracking-[0.06em] mb-2">Final Cumulative Net</p>
          <p className={`text-2xl font-semibold ${finalCumulative >= 0 ? 'text-success' : 'text-danger'}`}>
            {finalCumulative >= 0 ? '+' : '-'}{fmt(finalCumulative)}
          </p>
          {scenario.savingsTarget !== undefined && (
            <p className={`text-xs mt-1 ${targetMet ? 'text-success' : 'text-danger'}`}>
              {targetMet ? '✓ Target Met' : `✕ Short by ${fmt(scenario.savingsTarget - finalCumulative)}`}
            </p>
          )}
        </div>
        <div className="card p-5">
          <p className="text-[11px] text-muted uppercase tracking-[0.06em] mb-2">Scenario Duration</p>
          <p className="text-2xl font-semibold">{projection.length} Months</p>
          <p className="text-xs mt-1 text-muted">
            Ends {projection[projection.length - 1].label}
          </p>
        </div>
      </div>

      <div className="card p-6 mb-8">
        <p className="text-[11px] text-muted uppercase tracking-[0.06em] mb-5">Cumulative Net Projection</p>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
          <line x1={padding} y1={getY(0)} x2={width - padding} y2={getY(0)} stroke="var(--color-border-subtle)" strokeWidth="1" />
          {scenario.floorAmount !== undefined && (
            <line x1={padding} y1={getY(scenario.floorAmount)} x2={width - padding} y2={getY(scenario.floorAmount)} stroke="var(--color-danger)" strokeWidth="1" strokeDasharray="4 2" />
          )}
          {scenario.savingsTarget !== undefined && (
            <line x1={padding} y1={getY(scenario.savingsTarget)} x2={width - padding} y2={getY(scenario.savingsTarget)} stroke="var(--color-success)" strokeWidth="1" strokeDasharray="4 2" />
          )}
          <path
            d={`M ${projection.map((m, i) => `${getX(i)} ${getY(m.cumulativeNet)}`).join(' L ')}`}
            fill="none"
            stroke={scenario.color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {projection.map((m, i) => (
            <circle key={i} cx={getX(i)} cy={getY(m.cumulativeNet)} r="4" fill={scenario.color} />
          ))}
          {projection.length <= 12 && projection.map((m, i) => (
            <text key={i} x={getX(i)} y={height - padding + 20} fontSize="10" textAnchor="middle" fill="var(--color-muted)">{m.label.split(' ')[0]}</text>
          ))}
          {projection.length > 12 && [0, Math.floor(projection.length / 2), projection.length - 1].map(i => (
            <text key={i} x={getX(i)} y={height - padding + 20} fontSize="10" textAnchor="middle" fill="var(--color-muted)">{projection[i].label}</text>
          ))}
        </svg>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-left border-b-[0.5px] border-border-subtle bg-raised">
              <th className="px-4 py-3 font-medium">Month</th>
              <th className="px-4 py-3 font-medium">Income</th>
              <th className="px-4 py-3 font-medium">Expenses</th>
              <th className="px-4 py-3 font-medium">One-offs</th>
              <th className="px-4 py-3 font-medium">Monthly Net</th>
              <th className="px-4 py-3 font-medium">Cumulative</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {projection.map((m, i) => (
              <tr
                key={i}
                className={`border-b-[0.5px] border-border-subtle last:border-b-0 ${m.isBelowFloor ? 'border-l-4 border-l-danger' : ''}`}
                style={{ background: m.isActual ? 'rgba(0,0,0,0.02)' : undefined }}
              >
                <td className="px-4 py-3">
                  <span className="font-medium">{m.label}</span>
                  {m.isActual && <span className="text-[10px] ml-2 opacity-60">(Actual)</span>}
                </td>
                <td className="px-4 py-3 text-success">+{fmt(m.income)}</td>
                <td className="px-4 py-3 text-danger">-{fmt(m.expenses)}</td>
                <td className={`px-4 py-3 ${m.oneOffCosts > 0 ? 'text-danger' : 'text-muted'}`}>
                  {m.oneOffCosts > 0 ? `-${fmt(m.oneOffCosts)}` : '—'}
                </td>
                <td className={`px-4 py-3 font-medium ${m.net >= 0 ? 'text-success' : 'text-danger'}`}>
                  {m.net >= 0 ? '+' : '-'}{fmt(m.net)}
                </td>
                <td className="px-4 py-3 font-semibold font-mono">{fmt(m.cumulativeNet)}</td>
                <td className="px-4 py-3">
                  {m.isBelowFloor && <span className="text-[11px] text-danger font-semibold">⚠ BELOW FLOOR</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
