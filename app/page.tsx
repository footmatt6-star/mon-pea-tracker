"use client";
import { useEffect, useRef, useState, useCallback } from 'react';
import { POSITIONS, CONFIG, HISTORY } from './data/config';

// ── HELPERS ──────────────────────────────────────────────────
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
  // BOUCLIER ANTI-CRASH VERCEL
  const [isMounted, setIsMounted] = useState(false);

  const [activeTab, setActiveTab] = useState('budget'); 
  const [prices, setPrices] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  
  // -- ÉTATS BUDGET --
  const [salaire, setSalaire] = useState(239);
  const [depenses, setDepenses] = useState<any[]>([]);
  const [inputMontant, setInputMontant] = useState('');
  const [inputNote, setInputNote] = useState('');
  const [simMensuel, setSimMensuel] = useState(150);

  const mcChartRef = useRef<HTMLCanvasElement>(null);
  const mcChartInst = useRef<any>(null);

  // Allumage sécurisé (uniquement sur le navigateur, pas sur le serveur)
  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem('mathis_depenses');
    if (saved) setDepenses(JSON.parse(saved));
    const savedSal = localStorage.getItem('mathis_salaire');
    if (savedSal) setSalaire(Number(savedSal));
  }, []);

  // Sauvegarde à chaque changement
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('mathis_depenses', JSON.stringify(depenses));
      localStorage.setItem('mathis_salaire', salaire.toString());
    }
  }, [depenses, salaire, isMounted]);

  // -- CALCULS --
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

  // -- ACTIONS BUDGET --
  const ajouterDepense = (cat: string) => {
    if (!inputMontant) return;
    const nouvelle = { id: Date.now(), date: new Date().toISOString(), categorie: cat, montant: parseFloat(inputMontant), note: inputNote || cat };
    setDepenses([nouvelle, ...depenses]);
    setInputMontant(''); setInputNote('');
  };

  const viderLeMois = () => {
    if(confirm('Es-tu sûr de vouloir vider l\'historique de ce mois ?')) {
        setDepenses([]);
    }
  };

  // -- MONTE CARLO --
  useEffect(() => {
    if (activeTab === 'analyse' && mcChartRef.current) {
        import('chart.js/auto').then((mod) => {
            const Chart = mod.default || mod.Chart;
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
            mcChartInst.current = new Chart(mcChartRef.current, {
                type: 'line',
                data: {