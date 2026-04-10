import { resolveMonthBudget, getCategorySpend, getBudgetStatus } from "./utils";

export default function OverviewView({ year, yearSummary, monthData, categories, globalBudgets, monthOverrides, onSelectMonth }) {
  const s = yearSummary(year); const maxBar = Math.max(...s.monthly.map(m => Math.max(m.totalIncome, m.expenses)), 1); const now = new Date();
  const fmtLocal = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Math.abs(n));
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  
  return (
    <div>
      <div style={{ marginBottom:28 }}><h1 style={{ fontSize:26, fontWeight:500, marginBottom:4 }}>{year}</h1><p style={{ color:'var(--color-text-secondary)', fontSize:14 }}>Annual summary</p></div>
      
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12, marginBottom:28 }}>
        {[ 
          { label:'Total income', value: s.totalIncome, sign: '+', ok: true }, 
          { label:'Total expenses', value: s.totalExpenses, sign: '-', ok: false }, 
          { label:'Net savings', value: s.net, sign: s.net>=0?'+':'-', ok: s.net>=0 } 
        ].map(k => (
          <div key={k.label} style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:'var(--border-radius-lg)', padding:'16px 20px' }}>
            <p style={{ fontSize:11, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>{k.label}</p>
            <p style={{ fontSize:26, fontWeight:500, fontFamily:'var(--font-mono)', color: k.ok ? 'var(--color-text-success)' : 'var(--color-text-danger)' }}>{k.sign}{fmtLocal(k.value)}</p>
          </div>
        ))}
      </div>

      <div style={{ background:'var(--color-background-primary)', border:'0.5px solid var(--color-border-tertiary)', borderRadius:'var(--border-radius-lg)', padding:'20px 20px 16px', marginBottom:28 }}>
        <p style={{ fontSize:11, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:16 }}>Monthly Performance</p>
        <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:100 }}>
          {s.monthly.map((m, i) => { 
            const isCur = i===now.getMonth() && year===now.getFullYear(); 
            return (
              <div key={i} onClick={() => onSelectMonth(i)} style={{ flex:1, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                <div style={{ width:'100%', display:'flex', gap:2, alignItems:'flex-end', height:78 }}>
                  <div style={{ flex:1, background:'var(--color-background-success)', borderRadius:'2px 2px 0 0', height:`${(m.totalIncome/maxBar)*100}%`, minHeight: m.totalIncome>0?2:0, opacity:0.8 }} />
                  <div style={{ flex:1, background:'var(--color-background-danger)', borderRadius:'2px 2px 0 0', height:`${(m.expenses/maxBar)*100}%`, minHeight: m.expenses>0?2:0, opacity:0.8 }} />
                </div>
                <span style={{ fontSize:10, color: isCur ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontWeight: isCur?500:400 }}>{m.name}</span>
              </div>
            ); 
          })}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:10 }}>
        {MONTHS.map((name, i) => { 
          const d = monthData(year, i); const hasData = d.list.length > 0 || d.totalIncome > 0; const isCur = i===now.getMonth() && year===now.getFullYear(); 
          
          // PRP-03: Budget status calculations for Overview
          const overCount = categories.filter(c => {
            const spent = getCategorySpend(d.list, c.id);
            const limit = resolveMonthBudget(globalBudgets, monthOverrides[`${year}-${i}`] || {}, c.id);
            return getBudgetStatus(spent, limit) === 'over';
          }).length;

          const hasAnyBudget = categories.some(c =>
            resolveMonthBudget(globalBudgets, monthOverrides[`${year}-${i}`] || {}, c.id) !== null
          );

          return (
            <div key={i} className="month-card" onClick={() => onSelectMonth(i)} style={{ borderColor: isCur ? 'var(--color-border-info)' : undefined }}>
              <p style={{ fontSize:14, fontWeight:500 }}>{name}</p>
              {hasData ? (
                <> 
                  <p style={{ fontSize:12, color:'var(--color-text-secondary)' }}>+ {fmtLocal(d.totalIncome)}</p> 
                  <p style={{ fontSize:12, color:'var(--color-text-secondary)' }}>- {fmtLocal(d.expenses)}</p> 
                  <p style={{ fontSize:18, fontWeight:500, fontFamily:'var(--font-mono)', color: d.net>=0 ? 'var(--color-text-success)' : 'var(--color-text-danger)' }}>{d.net>=0?'+':''}{fmtLocal(d.net)}</p> 
                  
                  {/* PRP-03: Status Indicators */}
                  {overCount > 0 && (
                    <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:6 }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--color-text-danger)', display:'inline-block' }} />
                      <span style={{ fontSize:11, color:'var(--color-text-danger)' }}>{overCount} over budget</span>
                    </div>
                  )}
                  {overCount === 0 && hasAnyBudget && (
                    <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:6 }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--color-text-success)', display:'inline-block' }} />
                      <span style={{ fontSize:11, color:'var(--color-text-success)' }}>On track</span>
                    </div>
                  )}
                </>
              ) : <p style={{ fontSize:12, color:'var(--color-text-secondary)', fontStyle:'italic' }}>No data</p>}
            </div>
          ); 
        })}
      </div>
    </div>
  );
}
