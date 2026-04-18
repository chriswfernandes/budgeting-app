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
  const [view, setView] = useState('list'); // 'list', 'create', 'edit', 'projection'
  const [activeScenario, setActiveScenario] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const handleCreate = () => {
    setActiveScenario(null);
    setView('create');
  };

  const handleEdit = (scenario) => {
    setActiveScenario(scenario);
    setView('edit');
  };

  const handleViewProjection = (scenario) => {
    setActiveScenario(scenario);
    setView('projection');
  };

  const handleArchive = (scenario) => {
    const updated = scenarios.map(s => 
      s.id === scenario.id ? { ...s, status: s.status === 'archived' ? 'active' : 'archived' } : s
    );
    onSave(updated);
  };

  const handleSaveScenario = (scenario) => {
    let updated;
    if (activeScenario) {
      updated = scenarios.map(s => s.id === scenario.id ? scenario : s);
    } else {
      updated = [...scenarios, scenario];
    }
    onSave(updated);
    setView('list');
  };

  const fmt = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Math.abs(n));

  if (view === 'create' || view === 'edit') {
    return (
      <ScenarioBuilder 
        existing={activeScenario}
        incomeSources={incomeSources}
        budgetEntries={budgetEntries}
        categories={categories}
        onSave={handleSaveScenario}
        onCancel={() => setView('list')}
      />
    );
  }

  if (view === 'projection' && activeScenario) {
    const projection = projectScenario(
      activeScenario,
      incomeSources,
      budgetEntries,
      allTxns,
      allIncomeAdjusts,
      allOverrides,
      categories
    );
    return (
      <ScenarioProjectionView 
        scenario={activeScenario}
        projection={projection}
        onEdit={() => setView('edit')}
        onBack={() => setView('list')}
      />
    );
  }

  const filteredScenarios = scenarios.filter(s => showArchived ? true : s.status !== 'archived');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 4 }}>Scenarios</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>Model "what-if" questions without touching your real data.</p>
        </div>
        <button className="btn-p" onClick={handleCreate}>+ New scenario</button>
      </div>

      {scenarios.length > 0 && (
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
            Show archived scenarios
          </label>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {filteredScenarios.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-lg)' }}>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 20 }}>No scenarios yet.</p>
            <button className="btn-p" onClick={handleCreate}>Create your first scenario</button>
          </div>
        ) : (
          filteredScenarios.map(s => {
            const duration = ((s.endYear - s.startYear) * 12) + (s.endMonth - s.startMonth) + 1;
            const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            return (
              <div key={s.id} style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-lg)', padding: 20, opacity: s.status === 'archived' ? 0.6 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: s.color || '#378ADD' }} />
                    <h3 style={{ fontSize: 18, fontWeight: 500 }}>{s.name}</h3>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-p" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => handleViewProjection(s)}>View projection</button>
                    <button className="btn-g" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => handleEdit(s)}>Edit</button>
                    <button className="btn-g" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => handleArchive(s)}>
                      {s.status === 'archived' ? 'Unarchive' : 'Archive'}
                    </button>
                  </div>
                </div>
                
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                  {MONTHS_SHORT[s.startMonth]} {s.startYear} → {MONTHS_SHORT[s.endMonth]} {s.endYear} · {duration} months
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {s.incomeChanges.length > 0 && (
                    <span style={{ fontSize: 11, background: 'var(--color-background-secondary)', padding: '4px 8px', borderRadius: 6 }}>
                      {s.incomeChanges.length} income {s.incomeChanges.length === 1 ? 'change' : 'changes'}
                    </span>
                  )}
                  {s.categoryChanges.length > 0 && (
                    <span style={{ fontSize: 11, background: 'var(--color-background-secondary)', padding: '4px 8px', borderRadius: 6 }}>
                      {s.categoryChanges.length} budget {s.categoryChanges.length === 1 ? 'adjustment' : 'adjustments'}
                    </span>
                  )}
                  {s.oneOffCosts.length > 0 && (
                    <span style={{ fontSize: 11, background: 'var(--color-background-secondary)', padding: '4px 8px', borderRadius: 6 }}>
                      {s.oneOffCosts.length} one-off {s.oneOffCosts.length === 1 ? 'cost' : 'costs'}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
