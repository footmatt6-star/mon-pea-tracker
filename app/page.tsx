"use client";
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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

// Fonction de distribution normale (Box-Muller) pour Monte Carlo
const randomNormal = (mean: number, stdDev: number) => {
  let u = 0, v = 0;
  while(u === 0) u = Math.random();
  while(v === 0) v = Math.random();
  return (Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)) * stdDev + mean;
};

export default function Home() {
  const [prices, setPrices] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // States Outils & Stress Test
  const [simMensuel, setSimMensuel] = useState(150);
  const [calcEtf, setCalcEtf] = useState(POSITIONS[0]?.ticker || '');
  const [calcQty, setCalcQty] = useState(0);
  const [calcPrice, setCalcPrice] = useState(0);
  const [crashDrop, setCrashDrop] = useState(30);

  const evoChartRef = useRef<HTMLCanvasElement>(null);
  const projChartRef = useRef<HTMLCanvasElement>(null);
  const mcChartRef = useRef<HTMLCanvasElement>(null);
  
  const evoChartInst = useRef<any>(null);
  const projChartInst = useRef<any>(null);
  const mcChartInst = useRef<any>(null);

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
    const interval = setInterval(() => { if (!document.hidden) fetchPrices(); }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  // --- Calculs Globaux ---
  const now = new Date();
  const dateOpen = new Date(CONFIG.dateOuverture);
  const anneesOuverture = yearsBetween(dateOpen, now);

  const positions = POSITIONS.map((p) => {
    const info = prices[p.ticker] || {};
    const prix = info.price || p.pru; 
    const valeur = p.qty * prix;
    const investi = p.qty * p.pru;
    const pl = valeur - investi;
    return { ...p, prix, valeur, investi, pl, plPct: investi > 0 ? pl / investi : 0, pvJour: info.change ? p.qty * info.change : 0, info, alertDrop: info.changePct && info.changePct < -2 };
  });

  const totalValeurETF = positions.reduce((s, p) => s + p.valeur, 0);
  const totalPL = positions.reduce((s, p) => s + p.pl, 0);
  const totalValeurPF = totalValeurETF + CONFIG.liquidites;
  const capitalDepose = CONFIG.capitalInitial;
  const performancePct = capitalDepose > 0 ? (totalValeurPF - capitalDepose) / capitalDepose : 0;
  const pvJourTotal = positions.reduce((s, p) => s + p.pvJour, 0);
  
  // PRU
  const targetPos = positions.find(p => p.ticker === calcEtf);
  const newPru = targetPos && calcQty > 0 ? ((targetPos.qty * targetPos.pru) + (calcQty * calcPrice)) / (targetPos.qty + calcQty) : 0;

  // Fiscalité
  const fiscalite5ans = Math.max(0, totalPL) * 0.172;
  const gainsNets5ans = Math.max(0, totalPL) - fiscalite5ans;

  // Drawdown
  let peak = 0, maxDrawdown = 0;
  HISTORY.forEach(h => {
    if (h.valeur > peak) peak = h.valeur;
    const drawdown = peak > 0 ? (peak - h.valeur) / peak : 0;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  });

  // Stress Test
  const valeurApresCrash = totalValeurPF * (1 - crashDrop / 100);
  const anneesPourRecuperer = Math.log(1 / (1 - crashDrop / 100)) / Math.log(1 + 0.08);

  // Projections 3 Scénarios simples
  const projeter = (taux: number) => {
    let v = totalValeurPF;
    const res = [];
    for(let i=0; i<=15; i++) { res.push(v); v = v * (1 + taux/100) + (simMensuel * 12); }
    return res;
  };

  // Monte Carlo (1000 scénarios)
  const mcResults = useMemo(() => {
    const horizon = 15;
    const numSimulations = 1000;
    const meanReturn = 0.08; // 8% moyen
    const vol = 0.15; // 15% volatilité
    let paths = [];

    for(let i=0; i<numSimulations; i++) {
      let current = totalValeurPF;
      let path = [current];
      for(let y=1; y<=horizon; y++) {
        let annualReturn = randomNormal(meanReturn, vol);
        current = current * (1 + annualReturn) + (simMensuel * 12);
        path.push(Math.max(0, current)); // Pas de valeur négative
      }
      paths.push(path);
    }
    
    // Trier par résultat final pour trouver les percentiles
    paths.sort((a, b) => a[horizon] - b[horizon]);
    return {
      p10: paths[Math.floor(numSimulations * 0.1)], // Pessimiste (10%)
      p50: paths[Math.floor(numSimulations * 0.5)], // Médian (50%)
      p90: paths[Math.floor(numSimulations * 0.9)], // Optimiste (90%)
    };
  }, [totalValeurPF, simMensuel]);

  useEffect(() => {
    import('chart.js/auto').then((mod) => {
      const Chart = mod.default || mod.Chart;

      if (activeTab === 'dashboard') {
        if (evoChartInst.current) evoChartInst.current.destroy();
        if (evoChartRef.current) {
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
      }

      if (activeTab === 'outils') {
        if (projChartInst.current) projChartInst.current.destroy();
        if (projChartRef.current) {
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
      }

      if (activeTab === 'analyse') {
        if (mcChartInst.current) mcChartInst.current.destroy();
        if (mcChartRef.current) {
            mcChartInst.current = new Chart(mcChartRef.current, {
            type: 'line',
            data: {
                labels: Array.from({length: 16}, (_, i) => new Date().getFullYear() + i),
                datasets: [
                { label: 'Top 10% (Très chanceux)', data: mcResults.p90, borderColor: 'rgba(61, 214, 140, 0.4)', tension: 0.4, pointRadius: 0 },
                { label: 'Médiane (Trajectoire probable)', data: mcResults.p50, borderColor: '#a78bfa', tension: 0.4, borderWidth: 3, pointRadius: 0 },
                { label: 'Pire 10% (Malchanceux)', data: mcResults.p10, borderColor: 'rgba(240, 86, 86, 0.4)', tension: 0.4, pointRadius: 0 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false }
            });
        }
      }
    });

    return () => {
      if (evoChartInst.current) evoChartInst.current.destroy();
      if (projChartInst.current) projChartInst.current.destroy();
      if (mcChartInst.current) mcChartInst.current.destroy();
    };
  }, [activeTab, prices, simMensuel, mcResults]);

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
          <button style={{ ...s.tab, ...(activeTab === 'dashboard' ? s.tabActive