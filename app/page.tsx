"use client";
import { useEffect, useRef, useState, useCallback } from 'react';
import { POSITIONS as BASE_POSITIONS, CONFIG, HISTORY } from './data/config';
import { TRANSACTIONS, calcPRU, calcQty, calcFraisTotal } from './data/transactions';

// ── Helpers Mathématiques & Formatage ─────────────────────────────────────────
const f2 = (v: any) => Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f0 = (v: any) => Math.round(Number(v)).toLocaleString('fr-FR');
const fp = (v: any) => (v >= 0 ? '+' : '') + Number(v).toFixed(2) + ' %';
const fdate = (iso: string) => {
  const [y, m] = iso.split('-');
  const months = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
  return months[+m - 1] + ' ' + y;
};
const daysBetween = (d1: string | Date, d2: string | Date) => (new Date(d2).getTime() - new Date(d1).getTime()) / 86400000;
const yearsBetween = (d1: string | Date, d2: string | Date) => daysBetween(d1, d2) / 365.25;

const randomNormal = () => {
  let u = 0, v = 0;
  while(u === 0) u = Math.random();
  while(v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
};

export default function Home() {
  const [prices, setPrices] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [simMensuel, setSimMensuel] = useState(150);
  const [crashPct, setCrashPct] = useState(30);

  const evoChartRef = useRef<HTMLCanvasElement>(null);
  const projChartRef = useRef<HTMLCanvasElement>(null);
  const mcChartRef = useRef<HTMLCanvasElement>(null);
  
  const evoChartInst = useRef<any>(null);
  const projChartInst = useRef<any>(null);
  const mcChartInst = useRef<any>(null);

  // CONNEXION AU JOURNAL DES TRANSACTIONS
  const POSITIONS = BASE_POSITIONS.map(p => {
    const calculatedQty = calcQty(p.ticker);
    const calculatedPru = calcPRU(p.ticker);
    return {
      ...p,
      qty: calculatedQty > 0 ? calculatedQty : p.qty,
      pru: calculatedPru > 0 ? calculatedPru : p.pru
    };
  });

  const fetchPrices = useCallback(async () => {
    setLoading(true);
    try {
      const tickers = [...POSITIONS.map(p => p.ticker), '^FCHI', '^GSPC'].join(',');
      const res = await fetch(`/api/prices?tickers=${tickers}`);
      const data = await res.json();
      setPrices(data);
      setLastSync(new Date());
    } catch (e) {
      console.error('Erreur fetch prices:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(() => {
      if (!document.hidden) fetchPrices();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  const now = new Date();
  const dateOpen = new Date(CONFIG.dateOuverture);
  const anneesOuverture = yearsBetween(dateOpen, now);

  const positions = POSITIONS.map((p) => {
    const info = prices[p.ticker] || {};
    const prix = info.price || p.pru; 
    const valeur = p.qty * prix;
    const investi = p.qty * p.pru;
    const pl = valeur - investi;
    const plPct = investi > 0 ? pl / investi : 0;
    const pvJour = info.change ? p.qty * info.change : 0;
    const alertDrop = info.changePct && info.changePct < -2;
    return { ...p, prix, valeur, investi, pl, plPct, pvJour, info, alertDrop };
  });

  const totalValeurETF = positions.reduce((s, p) => s + p.valeur, 0);
  const totalInvesti = positions.reduce((s, p) => s + p.investi, 0);
  const totalPL = positions.reduce((s, p) => s + p.pl, 0);
  const totalValeurPF = totalValeurETF + CONFIG.liquidites;
  const capitalDepose = CONFIG.capitalInitial;
  const performancePct = capitalDepose > 0 ? (totalValeurPF - capitalDepose) / capitalDepose : 0;
  const pvJourTotal = positions.reduce((s, p) => s + p.pvJour, 0);

  const gainsBruts = totalPL;
  const fiscalite5ans = Math.max(0, gainsBruts) * 0.172;
  const gainsNets5ans = Math.max(0, gainsBruts) - fiscalite5ans;

  let peak = 0;
  let maxDrawdown = 0;
  HISTORY.forEach(h => {
    if (h.valeur > peak) peak = h.valeur;
    const drawdown = peak > 0 ? (peak - h.valeur) / peak : 0;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  });

  const valeurPostCrash = totalValeurPF * (1 - crashPct / 100);
  const perteCrash = totalValeurPF - valeurPostCrash;
  const moisRecuperation = Math.ceil(Math.log(totalValeurPF / valeurPostCrash) / Math.log(1 + 0.08 / 12));

  const projeter = (taux: number) => {
    let v = totalValeurPF;
    const res = [];
    for(let i=0; i<=15; i++) {
      res.push(v);
      v = v * Math.pow(1 + taux/100, 1) + (simMensuel * 12);
    }
    return res;
  };

  useEffect(() => {
    import('chart.js/auto').then((mod) => {
      const Chart = mod.default || mod.Chart;

      if (activeTab === 'dashboard' && evoChartRef.current) {
        if (evoChartInst.current) evoChartInst.current.destroy();
        const sortedHist = [...HISTORY].sort((a, b) => a.mois.localeCompare(b.mois));
        evoChartInst.current = new Chart(evoChartRef.current, {
          type: 'line',
          data: {
            labels: sortedHist.map((h) => fdate(h.mois)),
            datasets: [
              { label: 'Valeur', data: sortedHist.map((h) => h.valeur), borderColor: '#e8a45d', backgroundColor: 'rgba(232,164,93,0.1)', fill: true, tension: 0.4 },
              { label: 'Capital', data: sortedHist.map((h) => h.depot), borderColor: '#3a3a4a', borderDash: [5, 5], fill: false }
            ]
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
      }

      if (activeTab === 'outils' && projChartRef.current) {
        if (projChartInst.current) projChartInst.current.destroy();
        projChartInst.current = new Chart(projChartRef.current, {
          type: 'line',
          data: {
            labels: Array.from({length: 16}, (_, i) => new Date().getFullYear() + i),
            datasets: [
              { label: 'Optimiste (12%)', data: projeter(12), borderColor: '#3dd68c', borderDash: [2, 2], tension: 0.4, pointRadius: 0 },
              { label: 'Réaliste (8%)', data: projeter(8), borderColor: '#e8a45d', tension: 0.4, borderWidth: 3 },
              { label: 'Pessimiste (5%)', data: projeter(5), borderColor: '#f05656', borderDash: [2, 2], tension: 0.4, pointRadius: 0 }
            ]
          },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }

      if (activeTab === 'analyse' && mcChartRef.current) {
        if (mcChartInst.current) mcChartInst.current.destroy();
        const years = 15;
        const drift = 0.08 / 12; 
        const vol = 0.15 / Math.sqrt(12); 
        let simulations = [];
        
        for(let s=0; s<100; s++) {
          let path = [totalValeurPF];
          let currentVal = totalValeurPF;
          for(let m=1; m<=years*12; m++) {
            let shock = randomNormal();
            currentVal = currentVal * (1 + drift + vol * shock) + simMensuel;
            if(m % 12 === 0) path.push(currentVal); 
          }
          simulations.push(path);
        }

        const p10 = [], p50 = [], p90 = [];
        for(let y=0; y<=years; y++) {
          let yearVals = simulations.map(sim => sim[y]).sort((a,b) => a-b);
          p10.push(yearVals[Math.floor(100 * 0.10)]);
          p50.push(yearVals[Math.floor(100 * 0.50)]);
          p90.push(yearVals[Math.floor(100 * 0.90)]);
        }

        mcChartInst.current = new Chart(mcChartRef.current, {
          type: 'line',
          data: {
            labels: Array.from({length: years+1}, (_, i) => new Date().getFullYear() + i),
            datasets: [
              { label: 'Scénario Top 10%', data: p90, borderColor: '#3dd68c', backgroundColor: 'rgba(61,214,140,0.1)', fill: '+1', tension: 0.4, pointRadius: 0, borderWidth: 1 },
              { label: 'Médiane (50%)', data: p50, borderColor: '#e8a45d', tension: 0.4, borderWidth: 3 },
              { label: 'Scénario Pire 10%', data: p10, borderColor: '#f05656', backgroundColor: 'rgba(240,86,86,0.1)', fill: '-1', tension: 0.4, pointRadius: 0, borderWidth: 1 }
            ]
          },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }
    });

    return () => {
      if (evoChartInst.current) evoChartInst.current.destroy();
      if (projChartInst.current) projChartInst.current.destroy();
      if (mcChartInst.current) mcChartInst.current.destroy();
    };
  }, [activeTab, prices, simMensuel, totalValeurPF]);

  return (
      <div style={s.root}>
        <div style={s.header}>
          <div>
            <div style={s.logo}>Mon PEA · Mathis 🚀</div>
            <div style={s.sublogo}>{loading ? 'Sync en cours…' : lastSync ? 'Mis à jour ' + lastSync.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}</div>
          </div>
          <button style={s.btn} onClick={fetchPrices} disabled={loading}>{loading ? '…' : '↻ Sync'}</button>
        </div>

        <div style={s.tabs}>
          <button style={{ ...s.tab, ...(activeTab === 'dashboard' ? s.tabActive : {}) }} onClick={() => setActiveTab('dashboard')}>Tableau de bord</button>
          <button style={{ ...s.tab, ...(activeTab === 'positions' ? s.tabActive : {}) }} onClick={() => setActiveTab('positions')}>Positions</button>
          <button style={{ ...s.tab, ...(activeTab === 'transactions' ? s.tabActive : {}) }} onClick={() => setActiveTab('transactions')}>Transactions</button>
          <button style={{ ...s.tab, ...(activeTab === 'fiscalite' ? s.tabActive : {}) }} onClick={() => setActiveTab('fiscalite')}>Fiscalité</button>
          <button style={{ ...s.tab, ...(activeTab === 'outils' ? s.tabActive : {}) }} onClick={() => setActiveTab('outils')}>Projections</button>
          <button style={{ ...s.tab, ...(activeTab === 'analyse' ? s.tabActive : {}) }} onClick={() => setActiveTab('analyse')}>Analyse Pro 💎</button>
        </div>

        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div style={s.page}>
            <div style={s.heroCard}>
              <div style={s.heroLabel}>Valeur totale du PEA</div>
              <div style={s.heroVal}>{f2(totalValeurPF)} €</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <span style={{ ...s.badge, ...s.badgeAmber }}>{pvJourTotal >= 0 ? '↗' : '↘'} {pvJourTotal >= 0 ? '+' : ''}{f2(pvJourTotal)} € ajd</span>
                <span style={{ ...s.badge, ...(performancePct >= 0 ? s.badgeGreen : s.badgeRed) }}>{fp(performancePct * 100)} global</span>
              </div>
            </div>
            <div style={s.kpiGrid}>
              <KpiCard label="Capital déposé" value={f2(capitalDepose) + ' €'} />
              <KpiCard label="Liquidités" value={f2(CONFIG.liquidites) + ' €'} />
              <KpiCard label="Plus-value" value={(totalPL >= 0 ? '+' : '') + f2(totalPL) + ' €'} color={totalPL >= 0 ? '#3dd68c' : '#f05656'} />
            </div>
            <div style={s.card}>
              <div style={s.cardTitle}>Évolution du patrimoine</div>
              <div style={{ height: 250, position: 'relative' }}><canvas ref={evoChartRef} /></div>
            </div>
          </div>
        )}

        {/* POSITIONS */}
        {activeTab === 'positions' && (
          <div style={s.page}>
            <div style={s.card}>
              <div style={s.cardTitle}>Mes ETF</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead><tr>{['ETF', 'Qté', 'PRU', 'Cours', 'Jour', 'P/L €'].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {positions.map((p) => (
                      <tr key={p.id}>
                        <td style={s.td}>{p.nom} {p.alertDrop && <span title="Baisse > 2% ajd" style={{color: '#f05656'}}>⚠️</span>}</td>
                        <td style={s.td}>{p.qty}</td>
                        <td style={{ ...s.td, color: '#e8a45d' }}>{f2(p.pru)} €</td>
                        <td style={s.td}>{f2(p.prix)} €</td>
                        <td style={{ ...s.td, color: (p.info.changePct ?? 0) >= 0 ? '#3dd68c' : '#f05656' }}>{fp(p.info.changePct)}</td>
                        <td style={{ ...s.td, color: p.pl >= 0 ? '#3dd68c' : '#f05656' }}>{p.pl >= 0 ? '+' : ''}{f2(p.pl)} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* NOUVEAU : TRANSACTIONS */}
        {activeTab === 'transactions' && (
          <div style={s.page}>
            <div style={s.card}>
              <div style={s.cardTitle}>Journal des Achats</div>
              <p style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>
                L'application calcule automatiquement ton Prix de Revient Unitaire (PRU) à partir de cet historique. Fini les calculs à la main !
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead><tr>{['Date', 'ETF', 'Type', 'Qté', 'Prix Achat', 'Frais', 'Total'].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {[...TRANSACTIONS].reverse().map((t, i) => (
                      <tr key={i} style={{ borderBottom: '0.5px solid #1a1a22' }}>
                        <td style={s.td}>{new Date(t.date).toLocaleDateString('fr-FR')}</td>
                        <td style={{ ...s.td, fontWeight: 500 }}>{t.ticker}</td>
                        <td style={s.td}><span style={{ ...s.badge, ...s.badgeGreen, fontSize: 10 }}>{t.type}</span></td>
                        <td style={s.td}>{t.qty}</td>
                        <td style={s.td}>{f2(t.prix)} €</td>
                        <td style={{ ...s.td, color: '#f05656' }}>{t.frais > 0 ? f2(t.frais) + ' €' : '—'}</td>
                        <td style={{ ...s.td, fontWeight: 500 }}>{f2((t.qty * t.prix) + t.frais)} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* FISCALITE */}
        {activeTab === 'fiscalite' && (
          <div style={s.page}>
            <div style={s.card}>
              <div style={s.cardTitle}>Fiscalité PEA</div>
              <FiscRow label="Plus-value latente brute" value={(gainsBruts >= 0 ? '+' : '') + f2(gainsBruts) + ' €'} color={gainsBruts >= 0 ? '#3dd68c' : '#f05656'} />
              <FiscRow label="Prélèvements sociaux (17,2%)" value={f2(fiscalite5ans) + ' €'} color="#f05656" />
              <FiscRow label="Gain NET (après 5 ans)" value={f2(gainsNets5ans) + ' €'} color="#3dd68c" bold />
            </div>
          </div>
        )}

        {/* OUTILS / PROJECTIONS */}
        {activeTab === 'outils' && (
          <div style={s.page}>
            <div style={s.card}>
              <div style={s.cardTitle}>Simulateur de Projection (15 ans)</div>
              <label style={{ fontSize: 12, color: '#aaa' }}>Versement mensuel prévu : <strong style={{color: '#fff'}}>{simMensuel} €</strong></label>
              <input type="range" min="0" max="1000" step="50" value={simMensuel} onChange={(e) => setSimMensuel(Number(e.target.value))} style={{ width: '100%', marginTop: 10 }} />
              <div style={{ height: 220, position: 'relative', marginTop: 16 }}><canvas ref={projChartRef} /></div>
            </div>
          </div>
        )}

        {/* ANALYSE PRO */}
        {activeTab === 'analyse' && (
          <div style={s.page}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
              
              <div style={s.card}>
                <div style={s.cardTitle}>Comparaison Marché (Aujourd'hui)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <FiscRow label="📈 Ton PEA" value={fp((pvJourTotal / totalValeurPF) * 100)} color={(pvJourTotal >= 0) ? '#3dd68c' : '#f05656'} bold />
                  <div style={{ borderTop: '0.5px solid #2a2a36' }}></div>
                  <FiscRow label="🇫🇷 CAC 40" value={fp(prices['^FCHI']?.changePct || 0)} color={(prices['^FCHI']?.changePct >= 0) ? '#3dd68c' : '#f05656'} />
                  <FiscRow label="🇺🇸 S&P 500" value={fp(prices['^GSPC']?.changePct || 0)} color={(prices['^GSPC']?.changePct >= 0) ? '#3dd68c' : '#f05656'} />
                </div>
              </div>

              <div style={s.card}>
                <div style={s.cardTitle}>Crash Test Boursier</div>
                <label style={{ fontSize: 12, color: '#aaa' }}>Si le marché chute de : <strong style={{color: '#f05656'}}>-{crashPct}%</strong></label>
                <input type="range" min="5" max="50" step="1" value={crashPct} onChange={(e) => setCrashPct(Number(e.target.value))} style={{ width: '100%', marginTop: 10 }} />
                <div style={{ marginTop: 16, background: 'rgba(240,86,86,0.1)', padding: 12, borderRadius: 8, border: '1px solid rgba(240,86,86,0.3)' }}>
                  <p style={{ fontSize: 11, color: '#f05656', textTransform: 'uppercase' }}>Perte instantanée</p>
                  <p style={{ fontSize: 24, fontWeight: 'bold', color: '#f05656' }}>-{f0(perteCrash)} €</p>
                  <p style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
                    Ton solde tomberait à {f0(valeurPostCrash)} €. Il te faudrait environ <strong style={{color:'#fff'}}>{moisRecuperation} mois</strong> pour remonter à zéro.
                  </p>
                </div>
              </div>

              <div style={{ ...s.card, gridColumn: '1 / -1' }}>
                <div style={s.cardTitle}>Simulateur Monte Carlo (15 ans, 100 scénarios)</div>
                <p style={{ fontSize: 12, color: '#aaa', marginBottom: 12 }}>
                  Cet algorithme simule 100 futurs possibles. Il révèle tes vraies probabilités de réussite.
                </p>
                <div style={{ height: 300, position: 'relative' }}><canvas ref={mcChartRef} /></div>
              </div>

            </div>
          </div>
        )}
      </div>
  );
}

function KpiCard({ label, value, color }: any) {
  return (
    <div style={s.kpiCard}>
      <div style={s.kpiLabel}>{label}</div>
      <div style={{ ...s.kpiVal, ...(color ? { color } : {}) }}>{value}</div>
    </div>
  );
}

function FiscRow({ label, value, color, bold }: any) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
      <span style={{ fontSize: 13, color: '#aaa' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: bold ? 600 : 400, color: color || '#f0f0f2' }}>{value}</span>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: { background: '#0d0d0f', color: '#f0f0f2', minHeight: '100vh', fontFamily: '-apple-system, sans-serif' },
  header: { padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.5px solid #1e1e28' },
  logo: { fontSize: 17, fontWeight: 600 },
  sublogo: { fontSize: 11, color: '#555', marginTop: 2 },
  btn: { background: 'rgba(232,164,93,0.1)', border: '0.5px solid rgba(232,164,93,0.4)', color: '#e8a45d', padding: '7px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer' },
  tabs: { display: 'flex', gap: 2, background: '#161619', padding: '4px 24px 0', borderBottom: '0.5px solid #1e1e28', overflowX: 'auto' },
  tab: { padding: '10px 16px', fontSize: 13, border: 'none', background: 'none', color: '#555', cursor: 'pointer', borderBottom: '2px solid transparent', whiteSpace: 'nowrap' },
  tabActive: { color: '#f0f0f2', borderBottomColor: '#e8a45d', fontWeight: 500 },
  page: { padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 1200, margin: '0 auto' },
  heroCard: { background: '#161619', border: '0.5px solid #1e1e28', borderRadius: 14, padding: '18px 20px' },
  heroLabel: { fontSize: 11, color: '#555', textTransform: 'uppercase', marginBottom: 6 },
  heroVal: { fontSize: 38, fontWeight: 600 },
  badge: { display: 'inline-flex', padding: '3px 9px', borderRadius: 20, fontSize: 12, fontWeight: 500 },
  badgeGreen: { background: 'rgba(61,214,140,0.1)', color: '#3dd68c' },
  badgeRed: { background: 'rgba(240,86,86,0.1)', color: '#f05656' },
  badgeAmber: { background: 'rgba(232,164,93,0.1)', color: '#e8a45d' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 },
  kpiCard: { background: '#161619', border: '0.5px solid #1e1e28', borderRadius: 10, padding: '12px 14px' },
  kpiLabel: { fontSize: 10, color: '#555', textTransform: 'uppercase', marginBottom: 6 },
  kpiVal: { fontSize: 18, fontWeight: 500 },
  card: { background: '#161619', border: '0.5px solid #1e1e28', borderRadius: 12, padding: '14px 16px' },
  cardTitle: { fontSize: 12, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', marginBottom: 12 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 10px', fontSize: 11, color: '#555', borderBottom: '0.5px solid #1e1e28', textTransform: 'uppercase' },
  td: { padding: '10px 10px', color: '#f0f0f2', borderBottom: '0.5px solid #1a1a22' },
  input: { background: '#0d0d0f', border: '1px solid #1e1e28', padding: '10px', borderRadius: '8px', color: '#fff', width: '100%' }
};