import { useState } from "react";
import ScenarioBuilder from "./ScenarioBuilder";
import ScenarioProjectionView from "./ScenarioProjectionView";
import { projectScenario } from "./utils";

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

  const fmt = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Math.abs(n));

  if (view === 'create' || view === 'edit') {
    return <ScenarioBuilder existing={activeScenario} incomeSources={incomeSources} budgetEntries={budgetEntries} categories={categories} onSave={handleSaveScenario} onCancel={() => setView('list')} />;
  }

  if (view === 'projection' && activeScenario) {
    const projection = projectScenario(activeScenario, incomeSources, budgetEntries, allTxns, allIncomeAdjusts, allOverrides, categories);
    return <ScenarioProjectionView scenario={activeScenario} projection={projection} onEdit={() => setView('edit')} onBack={() => setView('list')} />;
  }

  const filteredScenarios = scenarios.filter(s => showArchived ? true : s.status !== 'archived');

  return (
    <div>
      <div className="flex justify-between items-center mb-7">
        <div>
          <h1 className="text-[26px] font-medium mb-1">Scenarios</h1>
          <p className="text-sm text-muted">Model "what-if" questions without touching your real data.</p>
        </div>
        <button className="btn-primary" onClick={handleCreate}>+ New scenario</button>
      </div>

      {scenarios.length > 0 && (
        <div className="mb-5 flex justify-end">
          <label className="flex items-center gap-2 text-[13px] cursor-pointer">
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
            Show archived scenarios
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
            const MS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            return (
              <div key={s.id} className={`card p-5 ${s.status === 'archived' ? 'opacity-60' : ''}`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-[10px]">
                    <span className="w-3 h-3 rounded-full inline-block" style={{ background: s.color || '#378ADD' }} />
                    <h3 className="text-lg font-medium">{s.name}</h3>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-primary py-1.5 px-3 text-xs" onClick={() => handleViewProjection(s)}>View projection</button>
                    <button className="btn-ghost py-1.5 px-3 text-xs" onClick={() => handleEdit(s)}>Edit</button>
                    <button className="btn-ghost py-1.5 px-3 text-xs" onClick={() => handleArchive(s)}>{s.status === 'archived' ? 'Unarchive' : 'Archive'}</button>
                  </div>
                </div>
                <p className="text-[13px] text-muted mb-3">{MS[s.startMonth]} {s.startYear} → {MS[s.endMonth]} {s.endYear} · {duration} months</p>
                <div className="flex flex-wrap gap-2">
                  {s.incomeChanges.length > 0 && <span className="text-[11px] bg-raised px-2 py-1 rounded-md">{s.incomeChanges.length} income {s.incomeChanges.length === 1 ? 'change' : 'changes'}</span>}
                  {s.categoryChanges.length > 0 && <span className="text-[11px] bg-raised px-2 py-1 rounded-md">{s.categoryChanges.length} budget {s.categoryChanges.length === 1 ? 'adjustment' : 'adjustments'}</span>}
                  {s.oneOffCosts.length > 0 && <span className="text-[11px] bg-raised px-2 py-1 rounded-md">{s.oneOffCosts.length} one-off {s.oneOffCosts.length === 1 ? 'cost' : 'costs'}</span>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
