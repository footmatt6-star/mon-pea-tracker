"use client";
import { useEffect, useRef, useState, useCallback } from 'react';
import { POSITIONS, CONFIG, HISTORY } from './data/config';

// ── Helpers ──────────────────────────────────────────────────
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

export default function Home() {
  const [prices, setPrices] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  const evoChartRef = useRef<HTMLCanvasElement>(null);
  const pieChartRef = useRef<HTMLCanvasElement>(null);
  const evoChartInst = useRef<any>(null);
  const pieChartInst = useRef<any>(null);

  const fetchPrices = useCallback(async () => {
    setLoading(true);
    try {
      const tickers = POSITIONS.map((p) => p.ticker).join(',');
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
    const prix = info.price || p.pru; // Si prix indisponible, utilise PRU
    const valeur = p.qty * prix;
    const investi = p.qty * p.pru;
    const pl = valeur - investi;
    const plPct = investi > 0 ? pl / investi : 0;
    const pvJour = info.change ? p.qty * info.change : 0;
    return { ...p, prix, valeur, investi, pl, plPct, pvJour, info };
  });

  const totalValeurETF = positions.reduce((s, p) => s + p.valeur, 0);
  const totalInvesti = positions.reduce((s, p) => s + p.investi, 0);
  const totalPL = positions.reduce((s, p) => s + p.pl, 0);
  const totalValeurPF = totalValeurETF + CONFIG.liquidites;
  const capitalDepose = CONFIG.capitalInitial;
  const performancePct = capitalDepose > 0 ? (totalValeurPF - capitalDepose) / capitalDepose : 0;
  const pvJourTotal = positions.reduce((s, p) => s + p.pvJour, 0);
  const cagr = anneesOuverture > 0 && capitalDepose > 0 ? Math.pow(totalValeurPF / capitalDepose, 1 / anneesOuverture) - 1 : 0;

  const SOCIAL_CHARGES = 0.172;
  const gainsBruts = totalPL;
  const gainsBrutsPositifs = Math.max(0, gainsBruts);
  const fiscalite5ans = gainsBrutsPositifs * SOCIAL_CHARGES;
  const gainsNets5ans = gainsBrutsPositifs - fiscalite5ans;

  useEffect(() => {
    if (activeTab !== 'dashboard') return;
    import('chart.js/auto').then((mod) => {
      const Chart = mod.default || mod.Chart;

      if (evoChartInst.current) evoChartInst.current.destroy();
      if (evoChartRef.current) {
        const sortedHist = [...HISTORY].sort((a, b) => a.mois.localeCompare(b.mois));
        evoChartInst.current = new Chart(evoChartRef.current, {
          type: 'line',
          data: {
            labels: sortedHist.map((h) => fdate(h.mois)),
            datasets: [
              {
                label: 'Valeur PEA',
                data: sortedHist.map((h) => h.valeur),
                borderColor: '#e8a45d',
                backgroundColor: 'rgba(232,164,93,0.08)',
                borderWidth: 2.5,
                pointRadius: 4,
                pointBackgroundColor: '#e8a45d',
                tension: 0.4,
                fill: true,
              },
              {
                label: 'Capital investi',
                data: sortedHist.map((h) => h.depot),
                borderColor: '#3a3a4a',
                borderDash: [5, 4],
                borderWidth: 1.5,
                pointRadius: 0,
                tension: 0.1,
                fill: false,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { color: 'rgba(255,255,255,0.04)' } },
              y: { grid: { color: 'rgba(255,255,255,0.04)' } },
            },
          },
        });
      }

      if (pieChartInst.current) pieChartInst.current.destroy();
      if (pieChartRef.current) {
        pieChartInst.current = new Chart(pieChartRef.current, {
          type: 'doughnut',
          data: {
            labels: [...positions.map((p) => p.nom), 'Liquidités'],
            datasets: [{
              data: [...positions.map((p) => p.valeur), CONFIG.liquidites],
              backgroundColor: [...positions.map((p) => p.couleur), '#3a3a4a'],
              borderWidth: 0,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '68%',
            plugins: { legend: { display: false } },
          },
        });
      }
    });

    return () => {
      if (evoChartInst.current) evoChartInst.current.destroy();
      if (pieChartInst.current) pieChartInst.current.destroy();
    };
  }, [activeTab, prices]);

  return (
      <div style={s.root}>
        {/* HEADER */}
        <div style={s.header}>
          <div>
            <div style={s.logo}>Mon PEA · Mathis</div>
            <div style={s.sublogo}>
              {loading ? 'Sync en cours…' : lastSync ? 'Mis à jour ' + lastSync.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ ...s.dot, background: loading ? '#e8a45d' : '#3dd68c' }} />
            <button style={s.btn} onClick={fetchPrices} disabled={loading}>
              {loading ? '…' : '↻ Sync'}
            </button>
          </div>
        </div>

        {/* ONGLETS */}
        <div style={s.tabs}>
          <button style={{ ...s.tab, ...(activeTab === 'dashboard' ? s.tabActive : {}) }} onClick={() => setActiveTab('dashboard')}>Tableau de bord</button>
          <button style={{ ...s.tab, ...(activeTab === 'positions' ? s.tabActive : {}) }} onClick={() => setActiveTab('positions')}>Positions</button>
          <button style={{ ...s.tab, ...(activeTab === 'fiscalite' ? s.tabActive : {}) }} onClick={() => setActiveTab('fiscalite')}>Fiscalité</button>
        </div>

        {/* ONGLET DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div style={s.page}>
            <div style={s.heroCard}>
              <div style={s.heroLabel}>Valeur totale du PEA</div>
              <div style={s.heroVal}>{f2(totalValeurPF)} €</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
                <span style={{ ...s.badge, ...s.badgeAmber }}>
                  {pvJourTotal >= 0 ? '↗' : '↘'} {pvJourTotal >= 0 ? '+' : ''}{f2(pvJourTotal)} € aujourd'hui
                </span>
                <span style={{ ...s.badge, ...(performancePct >= 0 ? s.badgeGreen : s.badgeRed) }}>
                  {fp(performancePct * 100)} depuis ouverture
                </span>
              </div>
            </div>

            <div style={s.kpiGrid}>
              <KpiCard label="Capital déposé" value={f2(capitalDepose) + ' €'} sub="Total" />
              <KpiCard label="Liquidités" value={f2(CONFIG.liquidites) + ' €'} sub="Cash disponible" />
              <KpiCard label="Valeur investie" value={f2(totalValeurETF) + ' €'} sub={`${positions.length} ETF`} />
              <KpiCard label="Plus-value" value={(totalPL >= 0 ? '+' : '') + f2(totalPL) + ' €'} color={totalPL >= 0 ? '#3dd68c' : '#f05656'} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
              <div style={s.card}>
                <div style={s.cardTitle}>Évolution du patrimoine</div>
                <div style={{ height: 220, position: 'relative' }}>
                  <canvas ref={evoChartRef} />
                </div>
              </div>
              <div style={s.card}>
                <div style={s.cardTitle}>Répartition</div>
                <div style={{ height: 220, position: 'relative' }}>
                  <canvas ref={pieChartRef} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ONGLET POSITIONS */}
        {activeTab === 'positions' && (
          <div style={s.page}>
            <div style={s.card}>
              <div style={s.cardTitle}>Mes positions</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['ETF', 'Qté', 'PRU', 'Cours', 'Valeur', 'P/L €'].map((h) => <th key={h} style={s.th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((p) => (
                      <tr key={p.id}>
                        <td style={s.td}>{p.nom}</td>
                        <td style={s.td}>{p.qty}</td>
                        <td style={s.td}>{f2(p.pru)} €</td>
                        <td style={s.td}>{p.info.ok ? f2(p.prix) + ' €' : '–'}</td>
                        <td style={s.td}>{f2(p.valeur)} €</td>
                        <td style={{ ...s.td, color: p.pl >= 0 ? '#3dd68c' : '#f05656' }}>{p.pl >= 0 ? '+' : ''}{f2(p.pl)} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ONGLET FISCALITE */}
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
      </div>
  );
}

// ── Composants helper ─────────────────────────────────────────
function KpiCard({ label, value, sub, color }: any) {
  return (
    <div style={s.kpiCard}>
      <div style={s.kpiLabel}>{label}</div>
      <div style={{ ...s.kpiVal, ...(color ? { color } : {}) }}>{value}</div>
      {sub && <div style={s.kpiSub}>{sub}</div>}
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

// ── Styles ────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  root: { background: '#0d0d0f', color: '#f0f0f2', minHeight: '100vh', fontFamily: '-apple-system, sans-serif' },
  header: { padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.5px solid #1e1e28' },
  logo: { fontSize: 17, fontWeight: 600 },
  sublogo: { fontSize: 11, color: '#555', marginTop: 2 },
  dot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  btn: { background: 'rgba(232,164,93,0.1)', border: '0.5px solid rgba(232,164,93,0.4)', color: '#e8a45d', padding: '7px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer' },
  tabs: { display: 'flex', gap: 2, background: '#161619', padding: '4px 24px 0', borderBottom: '0.5px solid #1e1e28' },
  tab: { padding: '10px 16px', fontSize: 14, border: 'none', background: 'none', color: '#555', cursor: 'pointer', borderBottom: '2px solid transparent' },
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
  kpiSub: { fontSize: 10, color: '#555', marginTop: 3 },
  card: { background: '#161619', border: '0.5px solid #1e1e28', borderRadius: 12, padding: '14px 16px' },
  cardTitle: { fontSize: 11, fontWeight: 500, color: '#555', textTransform: 'uppercase', marginBottom: 12 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 },
  th: { textAlign: 'left', padding: '7px 10px', fontSize: 10, color: '#555', borderBottom: '0.5px solid #1e1e28', textTransform: 'uppercase' },
  td: { padding: '10px 10px', color: '#f0f0f2' }
};
