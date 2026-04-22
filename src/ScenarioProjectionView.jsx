import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";

const fmt = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Math.abs(n));
const fmtCompact = n => { const a = Math.abs(n); if (a >= 10000) return `$${(a/1000).toFixed(0)}K`; if (a >= 1000) return `$${(a/1000).toFixed(1)}K`; return fmt(n); };

function ProjectionTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  const { net } = payload[0]?.payload || {};
  if (value == null) return null;
  return (
    <div className="card px-3 py-2.5 text-xs" style={{ pointerEvents: 'none', zIndex: 50 }}>
      <p className="font-semibold mb-1.5">{label}</p>
      <p className="font-mono">{value >= 0 ? '+' : '-'}{fmt(value)}</p>
      {net != null && (
        <p className={`mt-1 ${net >= 0 ? 'text-success' : 'text-danger'}`}>Net: {net >= 0 ? '+' : '-'}{fmt(net)}</p>
      )}
    </div>
  );
}

export default function ScenarioProjectionView({ scenario, projection, onEdit, onBack }) {
  const finalCumulative = projection[projection.length - 1].cumulativeNet;
  const avgMonthlyNet   = projection.reduce((sum, m) => sum + m.net, 0) / projection.length;
  const targetMet       = scenario.savingsTarget !== undefined ? finalCumulative >= scenario.savingsTarget : null;

  const chartData = projection.map(m => ({
    name: m.label,
    value: m.cumulativeNet,
    net: m.net,
  }));

  const gradId = `grad-${scenario.id || 'sc'}`;

  return (
    <div>
      <div className="flex justify-between items-center mb-7">
        <div className="flex items-center gap-3">
          <button className="btn-ghost py-1.5 px-3" onClick={onBack}>← Back</button>
          <span className="w-3 h-3 rounded-full inline-block shrink-0" style={{ background: scenario.color }} />
          <h1 className="text-[28px] font-semibold">{scenario.name}</h1>
        </div>
        <button className="btn-primary" onClick={onEdit}>Edit scenario</button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-7">
        <div className="card px-5 py-5">
          <p className="text-xs text-muted mb-3">Avg. monthly net</p>
          <p className={`text-[38px] font-semibold font-mono leading-none ${avgMonthlyNet >= 0 ? 'text-success' : 'text-danger'}`}>
            {avgMonthlyNet >= 0 ? '+' : '-'}{fmt(avgMonthlyNet)}
          </p>
        </div>
        <div className="card px-5 py-5">
          <p className="text-xs text-muted mb-3">Final cumulative net</p>
          <p className={`text-[38px] font-semibold font-mono leading-none ${finalCumulative >= 0 ? 'text-success' : 'text-danger'}`}>
            {finalCumulative >= 0 ? '+' : '-'}{fmt(finalCumulative)}
          </p>
          {scenario.savingsTarget !== undefined && (
            <p className={`text-xs mt-2 ${targetMet ? 'text-success' : 'text-danger'}`}>
              {targetMet ? '✓ Target met' : `✕ Short by ${fmt(scenario.savingsTarget - finalCumulative)}`}
            </p>
          )}
        </div>
        <div className="card px-5 py-5">
          <p className="text-xs text-muted mb-3">Scenario duration</p>
          <p className="text-[38px] font-semibold font-mono leading-none text-text">
            {projection.length}
          </p>
          <p className="text-xs text-muted mt-2">months · ends {projection[projection.length - 1].label}</p>
        </div>
      </div>

      <div className="card px-5 pt-5 pb-4 mb-7">
        <p className="text-xs text-muted mb-4">Cumulative net projection</p>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={scenario.color} stopOpacity={0.30} />
                <stop offset="95%" stopColor={scenario.color} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: 'var(--color-muted)', fontFamily: 'var(--font-sans)' }}
              axisLine={false} tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={fmtCompact}
              tick={{ fontSize: 11, fill: 'var(--color-muted)', fontFamily: 'var(--font-sans)' }}
              axisLine={false} tickLine={false} width={52}
            />
            <Tooltip content={<ProjectionTooltip />} cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }} />
            <ReferenceLine y={0} stroke="var(--color-border)" strokeDasharray="3 3" strokeWidth={1} />
            {scenario.floorAmount !== undefined && (
              <ReferenceLine
                y={scenario.floorAmount}
                stroke="var(--color-danger)" strokeDasharray="4 2" strokeWidth={1}
                label={{ value: 'Floor', position: 'insideTopRight', fontSize: 10, fill: 'var(--color-danger)' }}
              />
            )}
            {scenario.savingsTarget !== undefined && (
              <ReferenceLine
                y={scenario.savingsTarget}
                stroke="var(--color-success)" strokeDasharray="4 2" strokeWidth={1}
                label={{ value: 'Target', position: 'insideTopRight', fontSize: 10, fill: 'var(--color-success)' }}
              />
            )}
            <Area
              type="monotone" dataKey="value"
              stroke={scenario.color} strokeWidth={2}
              fill={`url(#${gradId})`}
              dot={{ r: 3, fill: scenario.color, strokeWidth: 0 }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-left border-b-[0.5px] border-border-subtle bg-raised">
              {['Month', 'Income', 'Expenses', 'One-offs', 'Monthly Net', 'Cumulative', 'Status'].map(h => (
                <th key={h} className="px-4 py-2.5 font-medium text-[11px] text-muted uppercase tracking-[0.05em]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projection.map((m, i) => (
              <tr
                key={i}
                className={`border-b-[0.5px] border-border-subtle last:border-b-0 ${m.isBelowFloor ? '' : ''} ${m.isActual ? 'bg-raised' : ''}`}
                style={m.isBelowFloor ? { borderLeft: '3px solid var(--color-danger)' } : undefined}
              >
                <td className="px-4 py-3">
                  <span className="font-medium">{m.label}</span>
                  {m.isActual && <span className="text-[10px] ml-2 text-muted">(actual)</span>}
                </td>
                <td className="px-4 py-3 text-success font-mono text-xs">+{fmt(m.income)}</td>
                <td className="px-4 py-3 text-danger font-mono text-xs">-{fmt(m.expenses)}</td>
                <td className={`px-4 py-3 font-mono text-xs ${m.oneOffCosts > 0 ? 'text-danger' : 'text-muted'}`}>
                  {m.oneOffCosts > 0 ? `-${fmt(m.oneOffCosts)}` : '—'}
                </td>
                <td className={`px-4 py-3 font-medium font-mono text-xs ${m.net >= 0 ? 'text-success' : 'text-danger'}`}>
                  {m.net >= 0 ? '+' : '-'}{fmt(m.net)}
                </td>
                <td className="px-4 py-3 font-semibold font-mono text-xs">{fmt(m.cumulativeNet)}</td>
                <td className="px-4 py-3">
                  {m.isBelowFloor && <span className="text-[11px] text-danger font-semibold">⚠ Below floor</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
