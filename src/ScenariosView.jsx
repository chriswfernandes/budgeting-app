import { useState } from "react";
import ScenarioBuilder from "./ScenarioBuilder";
import ScenarioProjectionView from "./ScenarioProjectionView";
import { projectScenario } from "./utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

const MS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmt = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Math.abs(n));
const fmtCompact = n => { const a = Math.abs(n); if (a >= 10000) return `$${(a/1000).toFixed(0)}K`; if (a >= 1000) return `$${(a/1000).toFixed(1)}K`; return fmt(n); };

function ComparisonTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2.5 text-xs" style={{ pointerEvents: 'none', zIndex: 50 }}>
      <p className="font-semibold mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="mb-0.5" style={{ color: p.color }}>
          {p.name}: {p.value >= 0 ? '+' : '-'}{fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function ScenariosView({
  scenarios,
  incomeSources,
  budgetEntries,
  categories,
  allTxns,
  allIncomeAdjusts,
  allOverrides,
  onSave
}) {
  const [view, setView] = useState('list');
  const [activeScenario, setActiveScenario] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const handleCreate = () => { setActiveScenario(null); setView('create'); };
  const handleEdit = (scenario) => { setActiveScenario(scenario); setView('edit'); };
  const handleViewProjection = (scenario) => { setActiveScenario(scenario); setView('projection'); };
  const handleArchive = (scenario) => {
    onSave(scenarios.map(s => s.id === scenario.id ? { ...s, status: s.status === 'archived' ? 'active' : 'archived' } : s));
  };
  const handleSaveScenario = (scenario) => {
    onSave(activeScenario ? scenarios.map(s => s.id === scenario.id ? scenario : s) : [...scenarios, scenario]);
    setView('list');
  };

  if (view === 'create' || view === 'edit') {
    return <ScenarioBuilder existing={activeScenario} incomeSources={incomeSources} budgetEntries={budgetEntries} categories={categories} onSave={handleSaveScenario} onCancel={() => setView('list')} />;
  }

  if (view === 'projection' && activeScenario) {
    const projection = projectScenario(activeScenario, incomeSources, budgetEntries, allTxns, allIncomeAdjusts, allOverrides, categories);
    return <ScenarioProjectionView scenario={activeScenario} projection={projection} onEdit={() => setView('edit')} onBack={() => setView('list')} />;
  }

  const filteredScenarios = scenarios.filter(s => showArchived ? true : s.status !== 'archived');
  const activeScenarios = scenarios.filter(s => s.status !== 'archived');
  const showComparison = activeScenarios.length >= 2;

  const projectionData = showComparison
    ? activeScenarios.map(s => ({
        scenario: s,
        data: projectScenario(s, incomeSources, budgetEntries, allTxns, allIncomeAdjusts, allOverrides, categories),
      }))
    : [];

  const maxLen = projectionData.length > 0 ? Math.max(...projectionData.map(p => p.data.length)) : 0;
  const refData = projectionData.find(p => p.data.length === maxLen)?.data || [];
  const compChartData = Array.from({ length: maxLen }, (_, i) => {
    const entry = { name: refData[i]?.label || `M${i + 1}` };
    projectionData.forEach(p => { if (i < p.data.length) entry[p.scenario.id] = p.data[i].cumulativeNet; });
    return entry;
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-7">
        <div>
          <h1 className="text-[28px] font-semibold mb-1">Scenarios</h1>
          <p className="text-sm text-muted">Model "what-if" questions without touching your real data.</p>
        </div>
        <button className="btn-primary" onClick={handleCreate}>+ New scenario</button>
      </div>

      {showComparison && (
        <div className="card px-5 pt-5 pb-4 mb-6">
          <p className="text-xs text-muted mb-4">Scenario Comparison — Cumulative Net</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={compChartData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
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
              <Tooltip content={<ComparisonTooltip />} cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }} />
              {projectionData.map(p => (
                <Line
                  key={p.scenario.id}
                  type="monotone"
                  dataKey={p.scenario.id}
                  name={p.scenario.name}
                  stroke={p.scenario.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-4 pt-2.5 mt-1 border-t-[0.5px] border-border-subtle">
            {projectionData.map(p => (
              <div key={p.scenario.id} className="flex items-center gap-1.5 text-[11px] text-muted">
                <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: p.scenario.color }} />
                {p.scenario.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {scenarios.length > 0 && (
        <div className="mb-5 flex justify-end">
          <label className="flex items-center gap-2 text-[13px] cursor-pointer">
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
            Show archived
          </label>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {filteredScenarios.length === 0 ? (
          <div className="card p-[60px_20px] text-center">
            <p className="text-muted mb-5">No scenarios yet.</p>
            <button className="btn-primary" onClick={handleCreate}>Create your first scenario</button>
          </div>
        ) : (
          filteredScenarios.map(s => {
            const duration = ((s.endYear - s.startYear) * 12) + (s.endMonth - s.startMonth) + 1;
            return (
              <div
                key={s.id}
                className={`card p-5 ${s.status === 'archived' ? 'opacity-60' : ''}`}
                style={{ borderLeft: `4px solid ${s.color || '#378ADD'}` }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-[18px] font-semibold leading-snug">{s.name}</h3>
                    <p className="text-xs text-muted mt-0.5">
                      {MS[s.startMonth]} {s.startYear} → {MS[s.endMonth]} {s.endYear} · {duration} months
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-4">
                    <button className="btn-primary py-1.5 px-3 text-xs" onClick={() => handleViewProjection(s)}>View projection</button>
                    <button className="btn-ghost py-1.5 px-3 text-xs" onClick={() => handleEdit(s)}>Edit</button>
                    <button className="btn-ghost py-1.5 px-3 text-xs" onClick={() => handleArchive(s)}>
                      {s.status === 'archived' ? 'Unarchive' : 'Archive'}
                    </button>
                  </div>
                </div>

                {(s.incomeChanges.length > 0 || s.categoryChanges.length > 0 || s.oneOffCosts.length > 0) && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {s.incomeChanges.length > 0 && (
                      <span className="text-[11px] bg-success-bg text-success px-2.5 py-[3px] rounded-full font-medium">
                        {s.incomeChanges.length} income {s.incomeChanges.length === 1 ? 'change' : 'changes'}
                      </span>
                    )}
                    {s.categoryChanges.length > 0 && (
                      <span className="text-[11px] bg-info-bg text-info px-2.5 py-[3px] rounded-full font-medium">
                        {s.categoryChanges.length} budget {s.categoryChanges.length === 1 ? 'adjustment' : 'adjustments'}
                      </span>
                    )}
                    {s.oneOffCosts.length > 0 && (
                      <span className="text-[11px] bg-danger-bg text-danger px-2.5 py-[3px] rounded-full font-medium">
                        {s.oneOffCosts.length} one-off {s.oneOffCosts.length === 1 ? 'cost' : 'costs'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
