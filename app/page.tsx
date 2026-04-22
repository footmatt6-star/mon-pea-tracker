"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { POSITIONS, CONFIG, HISTORY } from "./data/config";

// --- INIT SUPABASE ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// --- HELPERS ---
const f2 = (v: number) => Number(v).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f0 = (v: number) => Math.round(Number(v)).toLocaleString("fr-FR");
const fp = (v: number) => (v >= 0 ? "+" : "") + Number(v).toFixed(2) + " %";

const randomNormal = () => {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
};

// --- MOTEUR GRAPHIQUE SVG ---
interface Ligne { data: number[]; color: string; }
function GraphiqueNatif({ lignes, showXAxis }: { lignes: Ligne[], showXAxis?: boolean }) {
  if (!lignes || !Array.isArray(lignes)) return null;
  const lignesValides = lignes.filter(l => l && Array.isArray(l.data) && l.data.length > 0);
  if (lignesValides.length === 0) return null;
  const tout = lignesValides.flatMap(l => l.data);
  const min = Math.min(...tout);
  const max = Math.max(...tout);
  const range = max - min || 1;

  return (
    <svg viewBox="0 -5 100 55" preserveAspectRatio="none" style={{ width: "100%", height: "100%", overflow: "visible" }}>
      {lignesValides.map((ligne, i) => {
        const step = 100 / Math.max(1, ligne.data.length - 1);
        const points = ligne.data.map((val: number, idx: number) => `${idx * step},${40 - ((val - min) / range) * 40}`).join(" ");
        return <polyline key={i} fill="none" stroke={ligne.color} strokeWidth="2" points={points} strokeLinejoin="round" strokeLinecap="round" />;
      })}
      {showXAxis && (
          <>
            <text x="0" y="52" fontSize="4" fill="#888">Ajd</text>
            <text x="50" y="52" fontSize="4" fill="#888" textAnchor="middle">+7.5 ans</text>
            <text x="100" y="52" fontSize="4" fill="#888" textAnchor="end">+15 ans</text>
          </>
      )}
    </svg>
  );
}

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const PIN_SECRET = "0000"; 
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");

  const [activeTab, setActiveTab] = useState("patrimoine"); 
  const [prices, setPrices] = useState<Record<string, any>>({});
  const [isFetchingPrices, setIsFetchingPrices] = useState(false);
  const [showFabModal, setShowFabModal] = useState(false);

  // -- ÉTATS DONNÉES CLOUD --
  const [salaires, setSalaires] = useState<Record<string, number>>({}); 
  const [depenses, setDepenses] = useState<any[]>([]);
  const [mesPositions, setMesPositions] = useState<any[]>([]);
  const [patrimoineManuels, setPatrimoineManuels] = useState<Record<string, number>>({
    "Livret A": 0, "Livret Jeune": 0, "PayPal": 0, "Espèces": 0, "Immobilier": 0
  });
  
  // -- ÉTATS FORMULAIRES --
  const [inputMontant, setInputMontant] = useState("");
  const [inputNote, setInputNote] = useState("");
  const [isRecurrente, setIsRecurrente] = useState(false);
  const [moisActuel, setMoisActuel] = useState(new Date().toISOString().slice(0, 7)); 
  const [simMensuel, setSimMensuel] = useState(150);

  const [showAddETF, setShowAddETF] = useState(false);
  const [etfTicker, setEtfTicker] = useState("");
  const [etfNom, setEtfNom] = useState("");
  const [etfQty, setEtfQty] = useState("");
  const [etfPru, setEtfPru] = useState("");

  // -- CHARGEMENT SUPABASE --
  useEffect(() => {
    setIsMounted(true);
    const unlocked = sessionStorage.getItem("m_unlocked");
    if (unlocked === "true") setIsUnlocked(true);
  }, []);

  useEffect(() => {
    const loadCloudData = async () => {
      // Dépenses
      const { data: dData } = await supabase.from('depenses').select('*').order('date', { ascending: false });
      if (dData) setDepenses(dData);

      // Salaires
      const { data: sData } = await supabase.from('salaires').select('*');
      if (sData) {
        const sObj = sData.reduce((acc: any, row: any) => ({...acc, [row.mois]: row.montant}), {});
        setSalaires(sObj);
      }

      // Positions PEA
      const { data: pData } = await supabase.from('positions').select('*');
      if (pData && pData.length > 0) setMesPositions(pData);
      else setMesPositions(POSITIONS); // Par défaut si vide

      // Patrimoine manuel
      const { data: patData } = await supabase.from('patrimoine').select('*');
      if (patData && patData.length > 0) {
        const patObj = patData.reduce((acc: any, row: any) => ({...acc, [row.cle]: row.valeur}), {});
        setPatrimoineManuels({...patrimoineManuels, ...patObj});
      }
    };

    if (isUnlocked) {
      loadCloudData();
    }
  }, [isUnlocked]);

  const handlePinSubmit = () => {
      if (pinInput === PIN_SECRET) {
          setIsUnlocked(true);
          sessionStorage.setItem("m_unlocked", "true");
      } else { alert("Code incorrect"); setPinInput(""); }
  };

  const fetchPrices = useCallback(async () => {
    if (!isUnlocked || mesPositions.length === 0) return;
    setIsFetchingPrices(true);
    try {
      const timestamp = new Date().getTime();
      const tickers = [...mesPositions.map((p: any) => p.ticker), "^FCHI", "^GSPC"].join(",");
      const res = await fetch(`/api/prices?tickers=${tickers}&t=${timestamp}`);
      const data = await res.json();
      setPrices(data);
    } catch (e) { console.error(e); } finally { setIsFetchingPrices(false); }
  }, [isUnlocked, mesPositions]);

  useEffect(() => { if (isMounted && isUnlocked) fetchPrices(); }, [isMounted, isUnlocked, fetchPrices]);

  if (!isMounted) return <div style={{ background: "#050505", height: "100vh" }}></div>;

  if (!isUnlocked) {
      return (
          <div style={{ background: "#050505", color: "#fff", height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px" }}>Hub Mathis 🔒</div>
              <input type="password" maxLength={4} value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="Code PIN" style={{ fontSize: "24px", letterSpacing: "10px", padding: "15px", borderRadius: "10px", border: "1px solid #333", background: "#111", color: "#fff", width: "200px", textAlign: "center", outline: "none" }} />
              <button onClick={handlePinSubmit} style={{ marginTop: "20px", padding: "15px 40px", background: "#3dd68c", color: "#000", border: "none", borderRadius: "10px", fontWeight: "bold", cursor: "pointer", fontSize: "16px" }}>Déverrouiller</button>
          </div>
      );
  }

  // ================= CALCULS BOURSE / PEA =================
  const positions = mesPositions.map((p: any) => {
    const info = prices[p.ticker] || {};
    const prix = info.price || p.pru;
    const valeur = p.qty * prix;
    const investi = p.qty * p.pru;
    return { ...p, prix, valeur, investi, pl: valeur - investi, plPct: investi > 0 ? (valeur - investi) / investi : 0, changePct: info.changePct || 0, pvJour: info.change ? p.qty * info.change : 0 };
  });

  const totalValeurETF = positions.reduce((s: number, p: any) => s + p.valeur, 0);
  const totalPL = positions.reduce((s: number, p: any) => s + p.pl, 0);
  const totalValeurPF = totalValeurETF + CONFIG.liquidites;
  const capitalInvestiDynamique = positions.reduce((s: number, p: any) => s + p.investi, 0);
  const capitalDepose = capitalInvestiDynamique + CONFIG.liquidites;
  const performancePct = capitalDepose > 0 ? (totalValeurPF - capitalDepose) / capitalDepose : 0;
  const pvJourTotal = positions.reduce((s: number, p: any) => s + p.pvJour, 0);
  
  const anneesInvesties = Math.max(1, HISTORY.length / 12);
  const cagr = capitalDepose > 0 ? (Math.pow(totalValeurPF / capitalDepose, 1 / anneesInvesties) - 1) : 0;
  const fiscalite5ans = Math.max(0, totalPL) * 0.172;
  const gainsNets5ans = Math.max(0, totalPL) - fiscalite5ans;
  const sortedHist = [...HISTORY].sort((a: any, b: any) => String(a.mois).localeCompare(String(b.mois)));
  const histValeur = sortedHist.map(h => h.valeur || 0);
  const histDepot = sortedHist.map(h => h.depot || 0);

  // ================= CALCULS PATRIMOINE =================
  const totalActifsManuels = Object.values(patrimoineManuels).reduce((s, v) => s + v, 0);
  const patrimoineTotalGlobal = totalValeurPF + totalActifsManuels;

  // ================= CALCULS BUDGET =================
  const [yStr, mStr] = moisActuel.split("-");
  const dateObjectActuelle = new Date(Number(yStr), Number(mStr) - 1, 1);
  const nomDuMois = dateObjectActuelle.toLocaleString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase();
  const anneeActuelle = yStr;

  const changeMois = (offset: number) => {
      const d = new Date(Number(yStr), (Number(mStr) - 1) + offset, 1);
      setMoisActuel(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const changeAnnee = (offset: number) => {
      const d = new Date(Number(yStr) + offset, Number(mStr) - 1, 1);
      setMoisActuel(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const getSalaireForMois = (mIso: string) => {
      if (salaires[mIso] !== undefined) return salaires[mIso];
      const pastMois = Object.keys(salaires).filter(m => m < mIso).sort();
      return pastMois.length > 0 ? salaires[pastMois[pastMois.length - 1]] : 0;
  };
  
  const salaireActuel = getSalaireForMois(moisActuel);
  const depensesDuMoisReelles = depenses.filter(d => d.date && d.date.startsWith(moisActuel));
  
  const epargneCats = ["PEA", "Sécurité", "Voyage"];
  const besoinsCats = ["Fixe", "Courses", "Abonnement"];
  const enviesCats = ["Sorties", "Divers"];
  const catColors: any = { Courses: "#3dd68c", Sorties: "#e8a45d", Abonnement: "#3b82f6", Divers: "#a78bfa", Fixe: "#f05656", PEA: "#a78bfa", Sécurité: "#3b82f6", Voyage: "#e8a45d" };

  const depensesClassiques = depensesDuMoisReelles.filter(d => !epargneCats.includes(d.cat));
  const epargneDuMois = depensesDuMoisReelles.filter(d => epargneCats.includes(d.cat));
  
  const totalDepenseMois = depensesClassiques.reduce((s: number, d: any) => s + d.montant, 0);
  const totalEpargneMois = epargneDuMois.reduce((s: number, d: any) => s + d.montant, 0);
  const resteMois = salaireActuel - totalDepenseMois - totalEpargneMois;
  const pctBesoins = salaireActuel > 0 ? (depensesDuMoisReelles.filter(d => besoinsCats.includes(d.cat)).reduce((s, d) => s + d.montant, 0) / salaireActuel) * 100 : 0;
  const pctEnvies = salaireActuel > 0 ? (depensesDuMoisReelles.filter(d => enviesCats.includes(d.cat)).reduce((s, d) => s + d.montant, 0) / salaireActuel) * 100 : 0;
  const pctEpargneReel = salaireActuel > 0 ? (totalEpargneMois / salaireActuel) * 100 : 0;
  const objectifAtteint = pctEpargneReel >= 20;
  const budgetCats: any = depensesDuMoisReelles.reduce((acc: any, d: any) => { acc[d.cat] = (acc[d.cat] || 0) + d.montant; return acc; }, {});

  // ================= CALCULS CAGNOTTES =================
  const totalCagnottePEA = depenses.filter(d => d.cat === "PEA").reduce((s, d) => s + d.montant, 0);
  const totalCagnotteSecu = depenses.filter(d => d.cat === "Sécurité").reduce((s, d) => s + d.montant, 0);
  const totalCagnotteVoyage = depenses.filter(d => d.cat === "Voyage").reduce((s, d) => s + d.montant, 0);

  // ================= GRAPHIQUES ET BILANS =================
  const derniersMois = Array.from({length: 6}, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - i); return d.toISOString().slice(0, 7); }).reverse();
  const dataBarres = derniersMois.map(m => {
      const dep = depenses.filter(d => d.date && d.date.startsWith(m) && !epargneCats.includes(d.cat)).reduce((s: number, d: any) => s + d.montant, 0);
      return { label: m.split("-")[1], depense: dep, revenu: getSalaireForMois(m) };
  });
  const maxBarre = Math.max(...dataBarres.map(d => Math.max(d.depense, d.revenu)), 1);

  const moisDeLAnnee = Array.from({length: 12}, (_, i) => `${anneeActuelle}-${String(i+1).padStart(2, "0")}`);
  const bilanAnnuel = moisDeLAnnee.map(mIso => {
      const nomM = new Date(mIso + "-01").toLocaleString('fr-FR', { month: 'short' });
      const sal = getSalaireForMois(mIso);
      const depsM = depenses.filter(d => d.date && d.date.startsWith(mIso));
      const depensesPures = depsM.filter(d => !epargneCats.includes(d.cat)).reduce((s, d) => s + d.montant, 0);
      const epargnePure = depsM.filter(d => epargneCats.includes(d.cat)).reduce((s, d) => s + d.montant, 0);
      const rest = sal - depensesPures - epargnePure;
      return { moisIso: mIso, nom: nomM, sal, dep: depensesPures, epa: epargnePure, rest };
  });
  const totalAnnuelSal = bilanAnnuel.reduce((s, b) => s + b.sal, 0);
  const totalAnnuelDep = bilanAnnuel.reduce((s, b) => s + b.dep, 0);
  const totalAnnuelEpa = bilanAnnuel.reduce((s, b) => s + b.epa, 0);
  const tauxEpargneAnnuel = totalAnnuelSal > 0 ? (totalAnnuelEpa / totalAnnuelSal) * 100 : 0;

  // ================= MONTE CARLO =================
  const sims: number[][] = [];
  for(let s=0; s<100; s++) {
      const path = [totalValeurPF]; let v = totalValeurPF;
      for(let m=1; m<=180; m++) {
          v = v * (1 + 0.0066 + 0.04 * randomNormal()) + simMensuel;
          if(m % 12 === 0) path.push(v);
      }
      sims.push(path);
  }
  const p10: number[] = [], p50: number[] = [], p90: number[] = [];
  for(let y=0; y<=15; y++) {
      const vals = sims.map(sim => sim[y]).sort((a, b) => a - b);
      if (vals.length >= 91) { p10.push(vals[10]); p50.push(vals[50]); p90.push(vals[90]); }
  }

  // ================= ACTIONS CLOUD =================
  const updatePatrimoine = async (cle: string, val: string) => {
      const numVal = Number(val);
      setPatrimoineManuels({ ...patrimoineManuels, [cle]: numVal });
      await supabase.from('patrimoine').upsert({ cle, valeur: numVal });
  };
  
  const updateSalaire = async (val: string) => {
    if (val === "") {
        const newSalaires = { ...salaires }; delete newSalaires[moisActuel]; setSalaires(newSalaires);
        await supabase.from('salaires').delete().eq('mois', moisActuel);
    } else { 
        setSalaires({ ...salaires, [moisActuel]: Number(val) }); 
        await supabase.from('salaires').upsert({ mois: moisActuel, montant: Number(val) });
    }
  };

  const addDepense = async (c: string) => {
    if (!inputMontant) return;
    const dateDepense = new Date();
    dateDepense.setFullYear(Number(yStr), Number(mStr) - 1);
    const n = { id: Date.now(), cat: c, montant: parseFloat(inputMontant), note: inputNote || c, date: dateDepense.toISOString(), recurrent: isRecurrente };
    
    setDepenses([n, ...depenses]); // Update local direct pour la fluidité
    await supabase.from('depenses').insert([n]); // Sauvegarde Cloud en arrière-plan
    
    setInputMontant(""); setInputNote(""); setIsRecurrente(false); setShowFabModal(false);
  };

  const viderLeMois = async () => {
    if(window.confirm(`Supprimer toutes les opérations de ${nomDuMois} ?`)) {
      const aSupprimer = depenses.filter(d => d.date && d.date.startsWith(moisActuel));
      const ids = aSupprimer.map(d => d.id);
      setDepenses(depenses.filter(d => !d.date || !d.date.startsWith(moisActuel)));
      
      if (ids.length > 0) {
        await supabase.from('depenses').delete().in('id', ids);
      }
    }
  };

  const acheterETF = async () => {
    if(!etfTicker || !etfQty || !etfPru) return alert("Remplis le Ticker, la Quantité et le Prix d'Achat !");
    const nouvelETF = { nom: etfNom || etfTicker.toUpperCase(), ticker: etfTicker.toUpperCase(), qty: Number(etfQty), pru: Number(etfPru) };
    const exists = mesPositions.findIndex(p => p.ticker === nouvelETF.ticker);
    let updatedPos = nouvelETF;

    if (exists >= 0) {
        const pos = mesPositions[exists];
        const newTotalQty = pos.qty + nouvelETF.qty;
        const newPruMoyen = ((pos.qty * pos.pru) + (nouvelETF.qty * nouvelETF.pru)) / newTotalQty;
        const updated = [...mesPositions];
        updatedPos = { ...pos, qty: newTotalQty, pru: newPruMoyen };
        updated[exists] = updatedPos;
        setMesPositions(updated);
    } else { 
        setMesPositions([...mesPositions, nouvelETF]); 
    }
    
    await supabase.from('positions').upsert({ ticker: updatedPos.ticker, nom: updatedPos.nom, qty: updatedPos.qty, pru: updatedPos.pru });
    setEtfTicker(""); setEtfNom(""); setEtfQty(""); setEtfPru(""); setShowAddETF(false);
  };

  const exportCSV = () => {
    const header = "Date,Catégorie,Note,Montant (€),Recurrent\n";
    const rows = depenses.map(d => `${d.date?.split('T')[0]},${d.cat},${d.note || "Sans note"},${d.montant},${d.recurrent ? 'Oui' : 'Non'}`).join("\n");
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
    link.download = `budget_mathis_${new Date().toISOString().split('T')[0]}.csv`; link.click();
  };

  return (
    <div style={{ background: "#050505", color: "#fff", minHeight: "100vh", fontFamily: "-apple-system, sans-serif", paddingBottom: "100px" }}>
      
      {/* HEADER FIXE */}
      <div style={{ padding: "20px", display: "flex", justifyContent: "space-between", position: "sticky", top: 0, background: "rgba(5,5,5,0.9)", backdropFilter: "blur(10px)", zIndex: 100, borderBottom: "1px solid #111" }}>
        <div>
          <div style={{ fontSize: "20px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "8px" }}>Hub Mathis 💎 <span style={{fontSize: "10px", background: "#3dd68c", color: "#000", padding: "2px 6px", borderRadius: "10px"}}>Cloud Sync</span></div>
          <div style={{ fontSize: "10px", color: "#444", textTransform: "uppercase" }}>Patrimoine & Finances</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "#e8a45d", fontWeight: "bold", fontSize: "18px" }}>{f0(patrimoineTotalGlobal)} €</div>
          <div style={{ fontSize: "10px", color: "#555" }}>Patrimoine Net</div>
        </div>
      </div>

      {/* NAVIGATION FIXE */}
      <div style={{ display: "flex", background: "#0a0a0a", borderBottom: "1px solid #111", position: "sticky", top: "65px", zIndex: 99, overflowX: "auto" }}>
        {[ 
          { id: "patrimoine", label: "🏢 PATRIMOINE" },
          { id: "pea", label: "📈 PEA" }, 
          { id: "budget", label: "💰 BUDGET" }, 
          { id: "bilan", label: "📊 BILAN" },
          { id: "analyse", label: "🎲 ANALYSE" } 
        ].map((tab) => (
          <button key={tab.id} style={{ flex: 1, minWidth: "90px", padding: "15px 5px", background: activeTab === tab.id ? "#111" : "none", color: activeTab === tab.id ? "#fff" : "#555", border: "none", borderBottom: activeTab === tab.id ? "2px solid #e8a45d" : "none", fontWeight: "bold", cursor: "pointer", fontSize: "11px" }} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}>
        
        {/* ==================== ONGLET PATRIMOINE ==================== */}
        {activeTab === "patrimoine" && (
          <>
            <div style={{ background: "linear-gradient(145deg, #161619, #0a0a0a)", padding: "30px", borderRadius: "20px", textAlign: "center", border: "1px solid #1e1e28" }}>
                <div style={{ fontSize: "12px", color: "#555", marginBottom: "5px", fontWeight: "bold" }}>VALEUR NETTE TOTALE</div>
                <div style={{ fontSize: "42px", fontWeight: "bold", color: "#fff" }}>{f0(patrimoineTotalGlobal)} €</div>
                <div style={{ marginTop: "15px", display: "flex", height: "10px", borderRadius: "5px", overflow: "hidden", background: "#111" }}>
                    <div style={{ width: `${(totalValeurPF/patrimoineTotalGlobal)*100}%`, background: "#e8a45d" }} />
                    <div style={{ width: `${(totalActifsManuels/patrimoineTotalGlobal)*100}%`, background: "#3dd68c" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "center", gap: "15px", marginTop: "10px", fontSize: "10px" }}>
                    <span style={{color: "#e8a45d"}}>● Bourse ({f0(totalValeurPF)}€)</span>
                    <span style={{color: "#3dd68c"}}>● Cash / Immo ({f0(totalActifsManuels)}€)</span>
                </div>
            </div>

            <div style={{ background: "#0a0a0a", padding: "20px", borderRadius: "15px", border: "1px solid #111" }}>
                <div style={{ fontSize: "12px", color: "#555", marginBottom: "15px", fontWeight: "bold" }}>ACTIFS FINANCIERS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                            <div style={{ fontSize: "14px", fontWeight: "bold" }}>📈 PEA (Actions)</div>
                            <div style={{ fontSize: "10px", color: "#555" }}>Mis à jour via onglet PEA</div>
                        </div>
                        <div style={{ fontWeight: "bold" }}>{f2(totalValeurPF)} €</div>
                    </div>
                    <hr style={{ border: "none", borderTop: "1px solid #111", width: "100%" }} />
                    {Object.keys(patrimoineManuels).map((key) => (
                        <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: "14px", fontWeight: "bold" }}>{key}</div>
                            <input type="number" value={patrimoineManuels[key] || ""} placeholder="0" onChange={(e) => updatePatrimoine(key, e.target.value)} style={{ background: "#050505", border: "1px solid #222", color: "#3dd68c", padding: "8px", borderRadius: "8px", textAlign: "right", width: "120px", fontWeight: "bold" }} />
                        </div>
                    ))}
                </div>
            </div>
          </>
        )}

        {/* ==================== ONGLET BILAN ==================== */}
        {activeTab === "bilan" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#111", borderRadius: "15px", padding: "5px", border: "1px solid #222" }}>
                <button onClick={() => changeAnnee(-1)} style={{ padding: "15px 25px", background: "none", border: "none", color: "#fff", fontSize: "18px", cursor: "pointer" }}>&laquo;</button>
                <div style={{ fontWeight: "bold", fontSize: "16px", letterSpacing: "2px", color: "#e8a45d" }}>BILAN {anneeActuelle}</div>
                <button onClick={() => changeAnnee(1)} style={{ padding: "15px 25px", background: "none", border: "none", color: "#fff", fontSize: "18px", cursor: "pointer" }}>&raquo;</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div style={{ background: "linear-gradient(145deg, #161619, #0a0a0a)", padding: "20px", borderRadius: "15px", border: "1px solid #1e1e28", textAlign: "center" }}><div style={{ fontSize: "10px", color: "#555", textTransform: "uppercase", marginBottom: "5px" }}>Revenus Annuels</div><div style={{ fontSize: "20px", fontWeight: "bold", color: "#3dd68c" }}>{f0(totalAnnuelSal)} €</div></div>
                <div style={{ background: "linear-gradient(145deg, #161619, #0a0a0a)", padding: "20px", borderRadius: "15px", border: "1px solid #1e1e28", textAlign: "center" }}><div style={{ fontSize: "10px", color: "#555", textTransform: "uppercase", marginBottom: "5px" }}>Dépenses Annuelles</div><div style={{ fontSize: "20px", fontWeight: "bold", color: "#f05656" }}>{f0(totalAnnuelDep)} €</div></div>
                <div style={{ background: "linear-gradient(145deg, #161619, #0a0a0a)", padding: "20px", borderRadius: "15px", border: "1px solid #1e1e28", textAlign: "center" }}><div style={{ fontSize: "10px", color: "#555", textTransform: "uppercase", marginBottom: "5px" }}>Épargne & Investi</div><div style={{ fontSize: "20px", fontWeight: "bold", color: "#3b82f6" }}>{f0(totalAnnuelEpa)} €</div></div>
                <div style={{ background: "linear-gradient(145deg, #161619, #0a0a0a)", padding: "20px", borderRadius: "15px", border: "1px solid #1e1e28", textAlign: "center" }}><div style={{ fontSize: "10px", color: "#555", textTransform: "uppercase", marginBottom: "5px" }}>Taux d'Épargne</div><div style={{ fontSize: "20px", fontWeight: "bold", color: "#e8a45d" }}>{fp(tauxEpargneAnnuel)}</div></div>
            </div>
            <div style={{ background: "#0a0a0a", padding: "15px", borderRadius: "15px", border: "1px solid #111", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "right" }}>
                <thead><tr><th style={{ textAlign: "left", padding: "10px 5px", color: "#555", borderBottom: "1px solid #222" }}>Mois</th><th style={{ padding: "10px 5px", color: "#555", borderBottom: "1px solid #222" }}>In</th><th style={{ padding: "10px 5px", color: "#555", borderBottom: "1px solid #222" }}>Out</th><th style={{ padding: "10px 5px", color: "#555", borderBottom: "1px solid #222" }}>Épargne</th><th style={{ padding: "10px 5px", color: "#555", borderBottom: "1px solid #222" }}>Reste</th></tr></thead>
                <tbody>
                  {bilanAnnuel.map((b) => (
                    <tr key={b.moisIso} style={{ borderBottom: "1px solid #111" }}>
                      <td style={{ textAlign: "left", padding: "12px 5px", textTransform: "capitalize", fontWeight: "bold", color: b.moisIso === moisActuel ? "#e8a45d" : "#fff" }}>{b.nom}</td>
                      <td style={{ padding: "12px 5px", color: "#3dd68c" }}>{f0(b.sal)}</td>
                      <td style={{ padding: "12px 5px", color: b.dep > 0 ? "#f05656" : "#444" }}>{f0(b.dep)}</td>
                      <td style={{ padding: "12px 5px", color: b.epa > 0 ? "#3b82f6" : "#444" }}>{f0(b.epa)}</td>
                      <td style={{ padding: "12px 5px", fontWeight: "bold", color: b.rest >= 0 ? "#fff" : "#f05656" }}>{f0(b.rest)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ==================== ONGLET PEA ==================== */}
        {activeTab === "pea" && (
          <>
            <div style={{ background: "linear-gradient(145deg, #161619, #0a0a0a)", padding: "30px", borderRadius: "20px", textAlign: "center", border: "1px solid #1e1e28" }}>
              <div style={{ fontSize: "12px", color: "#555", marginBottom: "5px", fontWeight: "bold" }}>VALEUR TOTALE DU PEA</div>
              <div style={{ fontSize: "36px", fontWeight: "bold" }}>{f2(totalValeurPF)} €</div>
              <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "15px", flexWrap: "wrap" }}>
                <span style={{ padding: "5px 12px", borderRadius: "20px", fontSize: "12px", background: "rgba(232,164,93,0.1)", color: "#e8a45d", fontWeight: "bold" }}>{pvJourTotal >= 0 ? "↗" : "↘"} {pvJourTotal >= 0 ? "+" : ""}{f2(pvJourTotal)} € ajd</span>
                <span style={{ padding: "5px 12px", borderRadius: "20px", fontSize: "12px", background: performancePct >= 0 ? "rgba(61,214,140,0.1)" : "rgba(240,86,86,0.1)", color: performancePct >= 0 ? "#3dd68c" : "#f05656", fontWeight: "bold" }}>Global : {fp(performancePct * 100)}</span>
                <span style={{ padding: "5px 12px", borderRadius: "20px", fontSize: "12px", background: "rgba(167,139,250,0.1)", color: "#a78bfa", fontWeight: "bold" }}>CAGR : {fp(cagr * 100)}</span>
              </div>
              <button onClick={fetchPrices} disabled={isFetchingPrices} style={{ marginTop: "20px", padding: "8px 20px", background: "none", border: "1px solid #333", borderRadius: "20px", color: "#888", fontSize: "12px", cursor: "pointer" }}>{isFetchingPrices ? "Actualisation en cours..." : "🔄 Forcer l'actualisation"}</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
              <div style={{ background: "#0a0a0a", padding: "15px", borderRadius: "15px", border: "1px solid #111" }}><div style={{ fontSize: "10px", color: "#555", textTransform: "uppercase" }}>Capital déposé</div><div style={{ fontSize: "20px", fontWeight: "bold" }}>{f2(capitalDepose)} €</div></div>
              <div style={{ background: "#0a0a0a", padding: "15px", borderRadius: "15px", border: "1px solid #111" }}><div style={{ fontSize: "10px", color: "#555", textTransform: "uppercase" }}>Plus-value brute</div><div style={{ fontSize: "20px", fontWeight: "bold", color: totalPL >= 0 ? "#3dd68c" : "#f05656" }}>{f2(totalPL)} €</div></div>
            </div>
            <div style={{ background: "#0a0a0a", padding: "20px", borderRadius: "15px", border: "1px solid #111" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}><span style={{ fontSize: "12px", color: "#555", fontWeight: "bold" }}>ÉVOLUTION HISTORIQUE</span><div style={{ display: "flex", gap: "10px", fontSize: "10px", color: "#888" }}><span style={{color: "#e8a45d"}}>● Valeur</span><span style={{color: "#444"}}>● Dépôts</span></div></div>
              <div style={{ height: "150px" }}><GraphiqueNatif lignes={[{ data: histValeur, color: "#e8a45d" }, { data: histDepot, color: "#444" }]} /></div>
            </div>
            <div style={{ background: "#0a0a0a", padding: "20px", borderRadius: "15px", border: "1px solid #111", overflowX: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}><div style={{ fontSize: "12px", color: "#555", fontWeight: "bold" }}>DÉTAIL DES ETF</div><button onClick={() => setShowAddETF(!showAddETF)} style={{ background: "#e8a45d", color: "#000", border: "none", borderRadius: "5px", padding: "5px 10px", fontSize: "10px", fontWeight: "bold", cursor: "pointer" }}>{showAddETF ? "Fermer" : "+ Acheter"}</button></div>
              {showAddETF && (
                  <div style={{ background: "#111", padding: "15px", borderRadius: "10px", marginBottom: "15px", border: "1px dashed #333" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}><input type="text" placeholder="Ticker (CW8.PA)" value={etfTicker} onChange={(e) => setEtfTicker(e.target.value)} style={{ padding: "10px", borderRadius: "5px", background: "#050505", border: "1px solid #222", color: "#fff", fontSize: "12px" }} /><input type="text" placeholder="Nom (Opt)" value={etfNom} onChange={(e) => setEtfNom(e.target.value)} style={{ padding: "10px", borderRadius: "5px", background: "#050505", border: "1px solid #222", color: "#fff", fontSize: "12px" }} /><input type="number" placeholder="Qté" value={etfQty} onChange={(e) => setEtfQty(e.target.value)} style={{ padding: "10px", borderRadius: "5px", background: "#050505", border: "1px solid #222", color: "#fff", fontSize: "12px" }} /><input type="number" placeholder="PRU €" value={etfPru} onChange={(e) => setEtfPru(e.target.value)} style={{ padding: "10px", borderRadius: "5px", background: "#050505", border: "1px solid #222", color: "#fff", fontSize: "12px" }} /></div>
                      <button onClick={acheterETF} style={{ width: "100%", padding: "10px", background: "#3dd68c", color: "#000", border: "none", borderRadius: "5px", fontWeight: "bold", cursor: "pointer" }}>Confirmer</button>
                  </div>
              )}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead><tr><th style={{ textAlign: "left", color: "#555" }}>ETF</th><th style={{ textAlign: "right", color: "#555" }}>Cours</th><th style={{ textAlign: "right", color: "#555" }}>P/L</th></tr></thead>
                <tbody>
                  {positions.map((p: any) => (
                    <tr key={p.ticker} style={{ borderBottom: "1px solid #111" }}>
                      <td style={{ padding: "12px 0" }}>{p.nom} <div style={{fontSize: "9px", color: "#555"}}>{p.qty} parts</div></td>
                      <td style={{ textAlign: "right" }}>{f2(p.prix)} €</td>
                      <td style={{ textAlign: "right", color: p.plPct >= 0 ? "#3dd68c" : "#f05656", fontWeight: "bold" }}>{fp(p.plPct * 100)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ background: "#0a0a0a", padding: "20px", borderRadius: "15px", border: "1px solid #111" }}>
              <div style={{ fontSize: "12px", color: "#555", marginBottom: "15px", fontWeight: "bold" }}>FISCALITÉ (RETRAIT &gt; 5 ANS)</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}><span style={{ color: "#aaa" }}>Plus-value brute</span><span style={{ fontWeight: "bold" }}>{f2(totalPL)} €</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}><span style={{ color: "#aaa" }}>PS (17.2%)</span><span style={{ color: "#f05656" }}>-{f2(fiscalite5ans)} €</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed #333" }}><span style={{ color: "#3dd68c", fontWeight: "bold" }}>BÉNÉFICE NET</span><span style={{ color: "#3dd68c", fontWeight: "bold" }}>{f2(gainsNets5ans)} €</span></div>
            </div>
          </>
        )}

        {/* ==================== ONGLET BUDGET ==================== */}
        {activeTab === "budget" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#111", borderRadius: "15px", padding: "5px", border: "1px solid #222" }}>
                <div style={{ display: "flex" }}><button onClick={() => changeAnnee(-1)} style={{ padding: "15px 15px", background: "none", border: "none", color: "#555", fontSize: "14px", cursor: "pointer" }}>&laquo;</button><button onClick={() => changeMois(-1)} style={{ padding: "15px 15px", background: "none", border: "none", color: "#fff", fontSize: "18px", cursor: "pointer" }}>‹</button></div>
                <div style={{ fontWeight: "bold", fontSize: "14px", color: "#e8a45d" }}>{nomDuMois}</div>
                <div style={{ display: "flex" }}><button onClick={() => changeMois(1)} style={{ padding: "15px 15px", background: "none", border: "none", color: "#fff", fontSize: "18px", cursor: "pointer" }}>›</button><button onClick={() => changeAnnee(1)} style={{ padding: "15px 15px", background: "none", border: "none", color: "#555", fontSize: "14px", cursor: "pointer" }}>&raquo;</button></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
              <div style={{ background: "#0a0a0a", padding: "15px", borderRadius: "15px", border: "1px solid #111" }}>
                <div style={{ fontSize: "10px", color: "#555", textTransform: "uppercase" }}>Revenus fixes</div>
                <input type="number" value={salaires[moisActuel] || ""} placeholder={getSalaireForMois(moisActuel).toString()} onChange={(e) => updateSalaire(e.target.value)} style={{ background: "none", border: "none", color: "#3dd68c", fontSize: "20px", fontWeight: "bold", width: "100%" }} />
              </div>
              <div style={{ background: "#0a0a0a", padding: "15px", borderRadius: "15px", border: "1px solid #111" }}>
                <div style={{ fontSize: "10px", color: "#555", textTransform: "uppercase" }}>Dépensé</div>
                <div style={{ color: "#f05656", fontSize: "20px", fontWeight: "bold" }}>{f2(totalDepenseMois)} €</div>
              </div>
            </div>
            {objectifAtteint && (
                <div style={{ background: "linear-gradient(90deg, rgba(61,214,140,0.2) 0%, rgba(61,214,140,0.05) 100%)", padding: "15px", borderRadius: "15px", borderLeft: "4px solid #3dd68c", display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ fontSize: "24px" }}>🎉</div>
                    <div><div style={{ fontSize: "12px", fontWeight: "bold", color: "#3dd68c" }}>Objectif atteint !</div><div style={{ fontSize: "10px", color: "#aaa" }}>Plus de 20% épargnés ce mois-ci.</div></div>
                </div>
            )}
            <div style={{ background: "#0a0a0a", padding: "20px", borderRadius: "15px", border: "1px solid #111" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}><span style={{ fontSize: "12px", color: "#555", fontWeight: "bold" }}>RÈGLE 50/30/20 (IDÉAL)</span></div>
                <div style={{ marginBottom: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "5px" }}><span style={{ color: "#f05656" }}>Besoins ({pctBesoins.toFixed(0)}%)</span><span style={{ color: "#e8a45d" }}>Envies ({pctEnvies.toFixed(0)}%)</span><span style={{ color: "#3dd68c" }}>Épargne ({pctEpargneReel.toFixed(0)}%)</span></div>
                    <div style={{ display: "flex", height: "8px", borderRadius: "4px", overflow: "hidden", background: "#1a1a22", gap: "2px" }}>
                        <div style={{ width: `${pctBesoins}%`, background: pctBesoins > 50 ? "#f05656" : "#f0565688", transition: "width 0.5s" }}></div><div style={{ width: `${pctEnvies}%`, background: pctEnvies > 30 ? "#e8a45d" : "#e8a45d88", transition: "width 0.5s" }}></div><div style={{ width: `${pctEpargneReel}%`, background: pctEpargneReel < 20 ? "#3dd68c88" : "#3dd68c", transition: "width 0.5s" }}></div>
                    </div>
                </div>
            </div>
            <div style={{ background: "#0a0a0a", padding: "20px", borderRadius: "15px", border: "1px solid #111" }}>
                <div style={{ fontSize: "12px", color: "#555", marginBottom: "15px", fontWeight: "bold" }}>MES CAGNOTTES (GLOBALES)</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>🏦 Versé PEA</span><span style={{ fontWeight: "bold", color: "#a78bfa" }}>{f2(totalCagnottePEA)} €</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>🛡️ Épargne Sécurité</span><span style={{ fontWeight: "bold", color: "#3b82f6" }}>{f2(totalCagnotteSecu)} €</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span>✈️ Voyage</span><span style={{ fontWeight: "bold", color: "#e8a45d" }}>{f2(totalCagnotteVoyage)} €</span></div>
                </div>
            </div>
            <div style={{ background: "#0a0a0a", padding: "20px", borderRadius: "15px", border: "1px solid #111" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}><span style={{ fontSize: "12px", color: "#555", fontWeight: "bold" }}>REVENUS VS DÉPENSES (6 MOIS)</span><div style={{ display: "flex", gap: "10px", fontSize: "10px", color: "#888" }}><span style={{color: "#3dd68c"}}>● In</span><span style={{color: "#f05656"}}>● Out</span></div></div>
              <div style={{ display: "flex", alignItems: "flex-end", height: "120px", gap: "10px" }}>
                {dataBarres.map((d) => (
                  <div key={d.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "5px", height: "100%" }}>
                    <div style={{ height: "100%", display: "flex", alignItems: "flex-end", width: "100%", gap: "2px" }}><div style={{ height: `${(d.revenu/maxBarre)*100}%`, width: "100%", background: "#3dd68c", borderRadius: "2px 2px 0 0", transition: "height 0.5s" }} /><div style={{ height: `${(d.depense/maxBarre)*100}%`, width: "100%", background: "#f05656", borderRadius: "2px 2px 0 0", transition: "height 0.5s" }} /></div>
                    <div style={{ fontSize: "10px", color: "#555" }}>{d.label}</div>
                  </div>
                ))}
              </div>
            </div>
            {depensesDuMoisReelles.length > 0 && (
                <div style={{ background: "#0a0a0a", padding: "20px", borderRadius: "15px", border: "1px solid #111" }}>
                    <div style={{ fontSize: "12px", color: "#555", marginBottom: "15px", fontWeight: "bold" }}>RÉPARTITION DU MOIS</div>
                    <div style={{ display: "flex", height: "16px", borderRadius: "8px", overflow: "hidden", gap: "2px" }}>
                      {Object.entries(budgetCats).map(([cat, val]) => {
                        const total = totalDepenseMois + totalEpargneMois; const w = total > 0 ? ((val as number) / total) * 100 : 0; return <div key={cat} style={{ width: `${w}%`, background: catColors[cat] || "#888", transition: "width 0.5s ease" }} />;
                      })}
                    </div>
                </div>
            )}
            <div style={{ background: "#0a0a0a", padding: "20px", borderRadius: "15px", border: "1px solid #111" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}><div style={{ fontSize: "12px", color: "#555", fontWeight: "bold" }}>HISTORIQUE ({nomDuMois})</div><button onClick={exportCSV} style={{ background: "none", border: "none", color: "#3b82f6", fontSize: "12px", cursor: "pointer", textDecoration: "underline" }}>📥 Exporter CSV</button></div>
              {depensesDuMoisReelles.length === 0 && <div style={{ fontSize: "12px", color: "#555", textAlign: "center" }}>Rien ce mois-ci</div>}
              {depensesDuMoisReelles.map((d: any) => (
                <div key={d.id} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #111" }}>
                  <div><div style={{ fontSize: "14px" }}>{d.note} {d.recurrent && "🔄"}</div><div style={{ fontSize: "10px", color: "#555" }}>{d.cat}</div></div>
                  <div style={{ fontWeight: "bold", color: epargneCats.includes(d.cat) ? "#3b82f6" : "#fff" }}>-{f2(d.montant)} €</div>
                </div>
              ))}
              {depensesDuMoisReelles.length > 0 && <button onClick={viderLeMois} style={{ width: "100%", marginTop: "15px", background: "none", border: "1px solid #222", color: "#555", padding: "10px", borderRadius: "8px", cursor: "pointer" }}>Réinitialiser ce mois</button>}
            </div>
          </>
        )}

        {/* ==================== ONGLET ANALYSE ==================== */}
        {activeTab === "analyse" && (
            <div style={{ background: "#0a0a0a", padding: "20px", borderRadius: "15px", border: "1px solid #111" }}>
                <div style={{ fontSize: "12px", color: "#555", marginBottom: "10px", fontWeight: "bold" }}>PROJECTION MONTE CARLO (15 ANS)</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}><span style={{ fontSize: "11px", color: "#aaa" }}>Investi / mois :</span><strong style={{fontSize: "14px"}}>{simMensuel} €</strong></div>
                <input type="range" min="0" max="1000" step="50" value={simMensuel} onChange={(e) => setSimMensuel(Number(e.target.value))} style={{ width: "100%", marginBottom: "25px" }} />
                <div style={{ height: "250px" }}><GraphiqueNatif lignes={[{ data: p90, color: "#3dd68c" }, { data: p50, color: "#e8a45d" }, { data: p10, color: "#f05656" }]} showXAxis={true} /></div>
            </div>
        )}
      </div>

      {/* BOUTON FLOTTANT + MODAL */}
      {(activeTab === "budget" || activeTab === "bilan" || activeTab === "patrimoine") && (
          <button onClick={() => setShowFabModal(true)} style={{ position: "fixed", bottom: "30px", right: "30px", width: "60px", height: "60px", borderRadius: "30px", background: "#e8a45d", color: "#000", fontSize: "30px", border: "none", boxShadow: "0 4px 15px rgba(232,164,93,0.4)", cursor: "pointer", zIndex: 1000 }}>+</button>
      )}

      {showFabModal && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", zIndex: 1001, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
              <div style={{ background: "#111", width: "100%", maxWidth: "600px", padding: "20px", borderRadius: "20px 20px 0 0", borderTop: "1px solid #333" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}><div style={{ fontWeight: "bold", color: "#e8a45d" }}>NOUVELLE OPÉRATION</div><button onClick={() => setShowFabModal(false)} style={{ background: "none", border: "none", color: "#fff", fontSize: "20px", cursor: "pointer" }}>✕</button></div>
                  <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
                    <input type="number" placeholder="€" value={inputMontant} onChange={(e) => setInputMontant(e.target.value)} style={{ flex: 1, padding: "15px", borderRadius: "10px", background: "#050505", border: "1px solid #333", color: "#fff", fontSize: "18px" }} autoFocus />
                    <input type="text" placeholder="Note (ex: Netflix)" value={inputNote} onChange={(e) => setInputNote(e.target.value)} style={{ flex: 2, padding: "15px", borderRadius: "10px", background: "#050505", border: "1px solid #333", color: "#fff" }} />
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", fontSize: "12px", color: "#aaa", cursor: "pointer" }}>
                      <input type="checkbox" checked={isRecurrente} onChange={(e) => setIsRecurrente(e.target.checked)} style={{ width: "18px", height: "18px", accentColor: "#e8a45d" }} /> Dépense récurrente
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "15px" }}>
                    <button onClick={() => addDepense("Courses")} style={s.btnC}>🛒 Courses</button>
                    <button onClick={() => addDepense("Sorties")} style={s.btnS}>🍻 Sorties</button>
                    <button onClick={() => addDepense("Abonnement")} style={s.btnA}>📱 Abos</button>
                    <button onClick={() => addDepense("Fixe")} style={s.btnF}>🏠 Fixe</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                    <button onClick={() => addDepense("PEA")} style={s.btnP}>🏦 PEA</button>
                    <button onClick={() => addDepense("Sécurité")} style={s.btnSe}>🛡️ Sécu</button>
                    <button onClick={() => addDepense("Voyage")} style={s.btnV}>✈️ Voyage</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

const s: Record<string, any> = {
  btnC: { padding: "15px", background: "rgba(61,214,140,0.1)", color: "#3dd68c", border: "none", borderRadius: "10px", fontWeight: "bold", cursor: "pointer" },
  btnS: { padding: "15px", background: "rgba(232,164,93,0.1)", color: "#e8a45d", border: "none", borderRadius: "10px", fontWeight: "bold", cursor: "pointer" },
  btnA: { padding: "15px", background: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "none", borderRadius: "10px", fontWeight: "bold", cursor: "pointer" },
  btnF: { padding: "15px", background: "rgba(240,86,86,0.1)", color: "#f05656", border: "none", borderRadius: "10px", fontWeight: "bold", cursor: "pointer" },
  btnP: { padding: "10px", background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "none", borderRadius: "10px", fontWeight: "bold", fontSize: "11px", cursor: "pointer" },
  btnSe: { padding: "10px", background: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "none", borderRadius: "10px", fontWeight: "bold", fontSize: "11px", cursor: "pointer" },
  btnV: { padding: "10px", background: "rgba(232,164,93,0.1)", color: "#e8a45d", border: "none", borderRadius: "10px", fontWeight: "bold", fontSize: "11px", cursor: "pointer" },
}