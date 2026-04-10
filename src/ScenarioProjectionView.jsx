import { useState } from "react";

export default function ScenarioProjectionView({ scenario, projection, onEdit, onBack }) {
  const fmt = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Math.abs(n));
  
  const finalCumulative = projection[projection.length - 1].cumulativeNet;
  const avgMonthlyNet = projection.reduce((sum, m) => sum + m.net, 0) / projection.length;
  const maxCumulative = Math.max(...projection.map(m => m.cumulativeNet), 0);
  const minCumulative = Math.min(...projection.map(m => m.cumulativeNet), 0);
  
  const targetMet = scenario.savingsTarget !== undefined ? finalCumulative >= scenario.savingsTarget : null;

  // SVG Chart Dimensions
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn-g" style={{ padding: '6px 12px' }} onClick={onBack}>← Back</button>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: scenario.color }} />
          <h1 style={{ fontSize: 24, fontWeight: 500 }}>{scenario.name}</h1>
        </div>
        <button className="btn-p" onClick={onEdit}>Edit Scenario</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-lg)', padding: 20 }}>
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Avg. Monthly Net</p>
          <p style={{ fontSize: 24, fontWeight: 600, color: avgMonthlyNet >= 0 ? 'var(--color-text-success)' : 'var(--color-text-danger)' }}>
            {avgMonthlyNet >= 0 ? '+' : '-'}{fmt(avgMonthlyNet)}
          </p>
        </div>
        <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-lg)', padding: 20 }}>
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Final Cumulative Net</p>
          <p style={{ fontSize: 24, fontWeight: 600, color: finalCumulative >= 0 ? 'var(--color-text-success)' : 'var(--color-text-danger)' }}>
            {finalCumulative >= 0 ? '+' : '-'}{fmt(finalCumulative)}
          </p>
          {scenario.savingsTarget !== undefined && (
            <p style={{ fontSize: 12, marginTop: 4, color: targetMet ? 'var(--color-text-success)' : 'var(--color-text-danger)' }}>
              {targetMet ? '✓ Target Met' : `✕ Short by ${fmt(scenario.savingsTarget - finalCumulative)}`}
            </p>
          )}
        </div>
        <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-lg)', padding: 20 }}>
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Scenario Duration</p>
          <p style={{ fontSize: 24, fontWeight: 600 }}>{projection.length} Months</p>
          <p style={{ fontSize: 12, marginTop: 4, color: 'var(--color-text-secondary)' }}>
            Ends {projection[projection.length - 1].label}
          </p>
        </div>
      </div>

      <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-lg)', padding: 24, marginBottom: 32 }}>
        <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 20 }}>Cumulative Net Projection</p>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
          {/* Zero Line */}
          <line x1={padding} y1={getY(0)} x2={width - padding} y2={getY(0)} stroke="var(--color-border-tertiary)" strokeWidth="1" />
          
          {/* Floor Line */}
          {scenario.floorAmount !== undefined && (
            <line x1={padding} y1={getY(scenario.floorAmount)} x2={width - padding} y2={getY(scenario.floorAmount)} stroke="var(--color-text-danger)" strokeWidth="1" strokeDasharray="4 2" />
          )}

          {/* Target Line */}
          {scenario.savingsTarget !== undefined && (
            <line x1={padding} y1={getY(scenario.savingsTarget)} x2={width - padding} y2={getY(scenario.savingsTarget)} stroke="var(--color-text-success)" strokeWidth="1" strokeDasharray="4 2" />
          )}

          {/* Projection Path */}
          <path 
            d={`M ${projection.map((m, i) => `${getX(i)} ${getY(m.cumulativeNet)}`).join(' L ')}`}
            fill="none"
            stroke={scenario.color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Bars for Net Income/Expense per month (Optional visual) */}
          {projection.map((m, i) => (
            <circle key={i} cx={getX(i)} cy={getY(m.cumulativeNet)} r="4" fill={scenario.color} />
          ))}

          {/* Labels */}
          {projection.length <= 12 && projection.map((m, i) => (
            <text key={i} x={getX(i)} y={height - padding + 20} fontSize="10" textAnchor="middle" fill="var(--color-text-secondary)">{m.label.split(' ')[0]}</text>
          ))}
          {projection.length > 12 && [0, Math.floor(projection.length/2), projection.length-1].map(i => (
            <text key={i} x={getX(i)} y={height - padding + 20} fontSize="10" textAnchor="middle" fill="var(--color-text-secondary)">{projection[i].label}</text>
          ))}
        </svg>
      </div>

      <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-lg)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-secondary)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>Month</th>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>Income</th>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>Expenses</th>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>One-offs</th>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>Monthly Net</th>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>Cumulative</th>
              <th style={{ padding: '12px 16px', fontWeight: 500 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {projection.map((m, i) => (
              <tr key={i} style={{ 
                borderBottom: i < projection.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none',
                background: m.isActual ? 'rgba(0,0,0,0.02)' : 'transparent',
                borderLeft: m.isBelowFloor ? '4px solid var(--color-text-danger)' : 'none'
              }}>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontWeight: 500 }}>{m.label}</span>
                  {m.isActual && <span style={{ fontSize: 10, marginLeft: 8, opacity: 0.6 }}>(Actual)</span>}
                </td>
                <td style={{ padding: '12px 16px', color: 'var(--color-text-success)' }}>+{fmt(m.income)}</td>
                <td style={{ padding: '12px 16px', color: 'var(--color-text-danger)' }}>-{fmt(m.expenses)}</td>
                <td style={{ padding: '12px 16px', color: m.oneOffCosts > 0 ? 'var(--color-text-danger)' : 'var(--color-text-secondary)' }}>
                  {m.oneOffCosts > 0 ? `-${fmt(m.oneOffCosts)}` : '—'}
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 500, color: m.net >= 0 ? 'var(--color-text-success)' : 'var(--color-text-danger)' }}>
                  {m.net >= 0 ? '+' : '-'}{fmt(m.net)}
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{fmt(m.cumulativeNet)}</td>
                <td style={{ padding: '12px 16px' }}>
                  {m.isBelowFloor && <span style={{ fontSize: 11, color: 'var(--color-text-danger)', fontWeight: 600 }}>⚠ BELOW FLOOR</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
