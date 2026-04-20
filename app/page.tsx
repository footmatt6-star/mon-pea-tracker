"use client";
import { useEffect, useRef, useState, useCallback } from 'react';
import { POSITIONS, CONFIG, HISTORY } from './data/config';

const f2 = (v: any) => Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f0 = (v: any) => Math.round(Number(v)).toLocaleString('fr-FR');
const fp = (v: any) => (v >= 0 ? '+' : '') + Number(v).toFixed(2) + ' %';

const randomNormal = () => {
  let u = 0, v = 0;
  while(u === 0) u = Math.random();
  while(v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
};

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('budget'); 
  const [prices, setPrices] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  
  const [salaire, setSalaire] = useState(239);
  const [depenses, setDepenses] = useState<any[]>([]);
  const [inputMontant, setInputMontant] = useState('');
  const [inputNote, setInputNote] = useState('');
  const [simMensuel, setSimMensuel] = useState(150);

  const mcChartRef = useRef<HTMLCanvasElement>(null);
  const mcChartInst = useRef<any>(null);

  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem('mathis_depenses');
    if (saved) setDepenses(JSON.parse(saved));
    const savedSal = localStorage.getItem('mathis_salaire');
    if (savedSal) setSalaire(Number(savedSal));
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('mathis_depenses', JSON.stringify(depenses));
      localStorage.setItem('mathis_salaire', salaire.toString());
    }
  }, [depenses, salaire, isMounted]);

  const totalDepenses = depenses.reduce((s, d) => s + d.montant, 0);
  const resteAVivre = salaire - totalDepenses;

  const fetchPrices = useCallback(async () => {
    setLoading(true);
    try {
      const tickers = [...POSITIONS.map(p => p.ticker), '^FCHI', '^GSPC'].join(',');
      const res = await fetch(`/api/prices?tickers=${tickers}`);
      const data = await res.json();
      setPrices(data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { 
    if (isMounted) fetchPrices(); 
  }, [fetchPrices, isMounted]);

  const positions = POSITIONS.map((p) => {
    const info = prices[p.ticker] || {};
    const prix = info.price || p.pru; 
    const valeur = p.qty * prix;
    const investi = p.qty * p.pru;
    return { ...p, prix, valeur, investi, plPct: investi > 0 ? (valeur - investi) / investi : 0 };
  });

  const totalValeurPF = positions.reduce((s, p) => s + p.valeur, 0) + CONFIG.liquidites;

  const ajouterDepense = (cat: string) => {
    if (!inputMontant) return;
    const nouvelle = { id: Date.now(), date: new Date().toISOString(), categorie: cat, montant: parseFloat(inputMontant), note: inputNote || cat };
    setDepenses([nouvelle, ...depenses]);
    setInputMontant(''); setInputNote('');
  };

  const viderLeMois = () => {
    if(confirm('Es-tu sûr de vouloir vider l\'historique ?')) setDepenses([]);
  };

  useEffect(() => {
    if (activeTab === 'analyse' && mcChartRef.current) {
        import('chart.js/auto').then((module: any) => {
            // C'est ici que l'on trompe TypeScript !
            const GraphMoteur = module.default || module.Chart;
            if (mcChartInst.current) mcChartInst.current.destroy();
            
            let simulations = [];
            for(let s=0; s<100; s++) {
                let path = [totalValeurPF]; let v = totalValeurPF;
                for(let m=1; m<=180; m++) {
                    v = v * (1 + 0.0066 + 0.04 * randomNormal()) + simMensuel;
                    if(m % 12 === 0) path.push(v);
                }
                simulations.push(path);
            }
            const p10 = [], p50 = [], p90 = [];
            for(let y=0; y<=15; y++) {
                let vals = simulations.map(sim => sim[y]).sort((a,b) => a-b);
                p10.push(vals[10]); p50.push(vals[50]); p90.push(vals[90]);
            }

            mcChartInst.current = new GraphMoteur(mcChartRef.current, {
                type: 'line',
                data: {
                    labels: Array.from({length: 16}, (_, i) => new Date().getFullYear() + i),
                    datasets: [
                        { label: 'Optimiste', data: p90, borderColor: '#3dd68c', tension: 0.4, pointRadius: 0 },
                        { label: 'Médian', data: p50, borderColor: '#e8a45d', tension: 0.4, borderWidth: 3 },
                        { label: 'Pessimiste', data: p10, borderColor: '#f05656', tension: 0.4, pointRadius: 0 },
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        });
    }
  }, [activeTab, simMensuel, totalValeurPF]);

  if (!isMounted) return <div style={{ background: '#050505', color: '#fff', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Chargement...</div>;

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div><div style={s.logo}>Hub Mathis 💎</div><div style={s.sublogo}>Finances & PEA</div></div>
        <div style={{ textAlign: 'right' }}>
           <div style={{ fontSize: 18, fontWeight: 700, color: resteAVivre >= 0 ? '#3dd68c' : '#f05656' }}>{f2(resteAVivre)} €</div>
           <div style={{ fontSize: 10, color: '#555' }}>Reste à vivre</div>
        </div>
      </div>

      <div style={s.mainTabs}>
        <button style={{ ...s.mainTab, ...(activeTab === 'budget' ? s.mainTabActive : {}) }} onClick={() => setActiveTab('budget')}>💰 BUDGET</button>
        <button style={{ ...s.mainTab, ...(activeTab === 'pea' ? s.mainTabActive : {}) }} onClick={() => setActiveTab('pea')}>📈 PEA</button>
        <button style={{ ...s.mainTab, ...(activeTab === 'analyse' ? s.mainTabActive : {}) }} onClick={() => setActiveTab('analyse')}>🎲 ANALYSE</button>
      </div>

      <div style={s.page}>
        {activeTab === 'budget' && (
          <>
            <div style={s.card}>
              <div style={s.cardTitle}>Dépense rapide</div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
                <input type="number" placeholder="€" style={s.input} value={inputMontant} onChange={(e) => setInputMontant(e.target.value)} />
                <input type="text" placeholder="Note" style={s.input} value={inputNote} onChange={(e) => setInputNote(e.target.value)} />
              </div>
              <div style={s.gridActions}>
                <button style={{ ...s.actionBtn, background: '#e8a45d22', color: '#e8a45d' }} onClick={() => ajouterDepense('Courses')}>🛒 Courses</button>
                <button style={{ ...s.actionBtn, background: '#3dd68c22', color: '#3dd68c' }} onClick={() => ajouterDepense('Sorties')}>🍻 Sorties</button>
                <button style={{ ...s.actionBtn, background: '#a78bfa22', color: '#a78bfa' }} onClick={() => ajouterDepense('Divers')}>🎁 Divers</button>
                <button style={{ ...s.actionBtn, background: '#f0565622', color: '#f05656' }} onClick={() => ajouterDepense('Fixe')}>🏠 Fixe</button>
              </div>
            </div>

            <div style={s.kpiGrid}>
                <div style={s.kpiCard}><div style={s.kpiLabel}>Revenus</div><input type="number" style={{...s.kpiVal, background: 'none', border: 'none', color: '#fff', width: '100%'}} value={salaire} onChange={(e) => setSalaire(Number(e.target.value))} /></div>
                <div style={s.kpiCard}><div style={s.kpiLabel}>Dépensé</div><div style={{...s.kpiVal, color: '#f05656'}}>{f2(totalDepenses)} €</div></div>
            </div>

            <div style={s.card}>
              <div style={s.cardTitle}>Historique</div>
              {depenses.map(d => (
                <div key={d.id} style={s.historyRow}>
                  <div><div style={{ fontSize: 14 }}>{d.note}</div><div style={{ fontSize: 10, color: '#444' }}>{d.categorie}</div></div>
                  <div style={{ fontWeight: 600 }}>-{f2(d.montant)} €</div>
                </div>
              ))}
              {depenses.length > 0 && <button onClick={viderLeMois} style={{marginTop: 15, background: 'none', border: 'none', color: '#333', fontSize: 10, cursor: 'pointer'}}>Tout effacer</button>}
            </div>
          </>
        )}

        {activeTab === 'pea' && (
          <div style={s.card}>
            <div style={{fontSize: 32, fontWeight: 800, textAlign: 'center', marginBottom: 20}}>{f2(totalValeurPF)} €</div>
            <table style={s.table}>
              <tbody>
                {positions.map(p => (
                  <tr key={p.id}>
                    <td style={s.td}>{p.nom}</td>
                    <td style={s.td}>{f2(p.prix)} €</td>
                    <td style={{ ...s.td, color: p.plPct >= 0 ? '#3dd68c' : '#f05656' }}>{fp(p.plPct * 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'analyse' && (
            <div style={s.card}>
                <div style={s.cardTitle}>Simulation Monte Carlo</div>
                <div style={{ height: 300, position: 'relative' }}><canvas ref={mcChartRef} /></div>
            </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: { background: '#050505', color: '#fff', minHeight: '100vh', fontFamily: '-apple-system, sans-serif' },
  header: { padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #111' },
  logo: { fontSize: 18, fontWeight: 800 },
  sublogo: { fontSize: 10, color: '#444' },
  mainTabs: { display: 'flex', background: '#0a0a0a' },
  mainTab: { flex: 1, padding: '15px', border: 'none', background: 'none', color: '#444', fontWeight: 600, fontSize: 11, cursor: 'pointer' },
  mainTabActive: { color: '#fff', borderBottom: '2px solid #e8a45d' },
  page: { padding: '20px', display: 'flex', flexDirection: 'column', gap: 15, maxWidth: 500, margin: '0 auto' },
  card: { background: '#0a0a0a', border: '1px solid #111', borderRadius: 16, padding: '20px' },
  cardTitle: { fontSize: 10, color: '#444', textTransform: 'uppercase', marginBottom: 15, fontWeight: 700 },
  input: { flex: 1, background: '#111', border: '1px solid #1a1a1a', padding: '12px', borderRadius: 10, color: '#fff', fontSize: 14, width: '100%' },
  gridActions: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  actionBtn: { padding: '15px', border: 'none', borderRadius: 12, fontWeight: 600, cursor: 'pointer' },
  kpiGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15 },
  kpiCard: { background: '#0a0a0a', border: '1px solid #111', borderRadius: 16, padding: '15px' },
  kpiLabel: { fontSize: 10, color: '#444', marginBottom: 5 },
  kpiVal: { fontSize: 20, fontWeight: 700 },
  historyRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #111' },
  table: { width: '100%', borderCollapse: 'collapse' },
  td: { padding: '10px', fontSize: 14, borderBottom: '1px solid #111' }
};