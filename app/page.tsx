"use client";

import { useEffect, useState, useCallback } from "react";
import { POSITIONS, CONFIG, HISTORY } from "./data/config";

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

// --- MOTEUR GRAPHIQUE SVG NATIF ---
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
  
  // ================= SÉCURITÉ =================
  const PIN_SECRET = "0000"; // <-- TON CODE PIN
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");

  const [activeTab, setActiveTab] = useState("pea");
  const [prices, setPrices] = useState<Record<string, any>>({});
  const [isFetchingPrices, setIsFetchingPrices] = useState(false);
  const [showFabModal, setShowFabModal] = useState(false);

  // -- ÉTATS BUDGET --
  const [salaire, setSalaire] = useState(239);
  const [depenses, setDepenses] = useState<any[]>([]);
  const [inputMontant, setInputMontant] = useState("");
  const [inputNote, setInputNote] = useState("");
  const [moisActuel, setMoisActuel] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [simMensuel, setSimMensuel] = useState(150);

  // -- MÉMOIRE --
  useEffect(() => {
    setIsMounted(true);
    const savedD = localStorage.getItem("m_d");
    if (savedD) setDepenses(JSON.parse(savedD));
    const savedS = localStorage.getItem("m_s");
    if (savedS) setSalaire(Number(savedS));
    const unlocked = sessionStorage.getItem("m_unlocked");
    if (unlocked === "true") setIsUnlocked(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("m_d", JSON.stringify(depenses));
      localStorage.setItem("m_s", salaire.toString());
    }
  }, [depenses, salaire, isMounted]);

  const handlePinSubmit = () => {
      if (pinInput === PIN_SECRET) {
          setIsUnlocked(true);
          sessionStorage.setItem("m_unlocked", "true");
      } else {
          alert("Code incorrect");
          setPinInput("");
      }
  };

  // -- API BOURSE (Avec Refresh Manuel) --
  const fetchPrices = useCallback(async () => {
    if (!isUnlocked) return;
    setIsFetchingPrices(true);
    try {
      // On rajoute un paramètre de temps pour empêcher le cache du navigateur
      const timestamp = new Date().getTime();
      const tickers = [...POSITIONS.map((p: any) => p.ticker), "^FCHI", "^GSPC"].join(",");
      const res = await fetch(`/api/prices?tickers=${tickers}&t=${timestamp}`);
      const data = await res.json();
      setPrices(data);
    } catch (e) { 
      console.error(e); 
    } finally {
      setIsFetchingPrices(false);
    }
  }, [isUnlocked]);

  useEffect(() => {
    if (isMounted && isUnlocked) {
      fetchPrices();
    }
  }, [isMounted, isUnlocked, fetchPrices]);

  if (!isMounted) return <div style={{ background: "#050505", height: "100vh" }}></div>;

  // ================= ECRAN DE VERROUILLAGE =================
  if (!isUnlocked) {
      return (
          <div style={{ background: "#050505", color: "#fff", height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px" }}>Hub Mathis 🔒</div>
              <input 
                type="password" 
                maxLength={4}
                value={pinInput} 
                onChange={(e) => setPinInput(e.target.value)} 
                placeholder="Code PIN"
                style={{ fontSize: "24px", letterSpacing: "10px", padding: "15px", borderRadius: "10px", border: "1px solid #333", background: "#111", color: "#fff", width: "200px", textAlign: "center", outline: "none" }}
              />
              <button onClick={handlePinSubmit} style={{ marginTop: "20px", padding: "15px 40px", background: "#3dd68c", color: "#000", border: "none", borderRadius: "10px", fontWeight: "bold", cursor: "pointer", fontSize: "16px" }}>Déverrouiller</button>
          </div>
      );
  }

  // ================= EXPORT CSV =================
  const exportCSV = () => {
      const header = "Date,Catégorie,Note,Montant (€)\n";
      const rows = depenses.map(d => `${d.date.split('T')[0]},${d.cat},${d.note || "Sans note"},${d.montant}`).join("\n");
      const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `budget_mathis_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
  };

  // ================= CALCULS PEA GLOBAUX =================
  const positions = POSITIONS.map((p: any) => {
    const info = prices[p.ticker] || {};
    const prix = info.price || p.pru;
    const valeur = p.qty * prix;
    const investi = p.qty * p.pru;
    return { ...p, prix, valeur, investi, pl: valeur - investi, plPct: investi > 0 ? (valeur - investi) / investi : 0, changePct: info.changePct || 0, pvJour: info.change ? p.qty * info.change : 0 };
  });

  const totalValeurETF = positions.reduce((s: number, p: any) => s + p.valeur, 0);
  const totalPL = positions.reduce((s: number, p: any) => s + p.pl, 0);
  const totalValeurPF = totalValeurETF + CONFIG.liquidites;
  const capitalDepose = CONFIG.capitalInitial;
  const performancePct = capitalDepose > 0 ? (totalValeurPF - capitalDepose) / capitalDepose : 0;
  const pvJourTotal = positions.reduce((s: number, p: any) => s + p.pvJour, 0);

  const anneesInvesties = Math.max(1, HISTORY.length / 12);
  const cagr = capitalDepose > 0 ? (Math.pow(totalValeurPF / capitalDepose, 1 / anneesInvesties) - 1) : 0;

  const fiscalite5ans = Math.max(0, totalPL) * 0.172;
  const gainsNets5ans = Math.max(0, totalPL) - fiscalite5ans;

  const sortedHist = [...HISTORY].sort((a: any, b: any) => String(a.mois).localeCompare(String(b.mois)));
  const histValeur = sortedHist.map(h => h.valeur || 0);
  const histDepot = sortedHist.map(h => h.depot || 0);

  // ================= CALCULS BUDGET =================
  const dateObjectActuelle = new Date(moisActuel + "-01T00:00:00");
  const nomDuMois = dateObjectActuelle.toLocaleString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase();
  
  const depensesDuMois = depenses.filter(d => d.date.startsWith(moisActuel));
  
  const epargneCats = ["PEA", "Sécurité", "Voyage"];
  const besoinsCats = ["Fixe", "Courses", "Abonnement"];
  const enviesCats = ["Sorties", "Divers"];

  const depensesClassiques = depensesDuMois.filter(d => !epargneCats.includes(d.cat));
  const epargneDuMois = depensesDuMois.filter(d => epargneCats.includes(d.cat));

  const totalDepenseMois = depensesClassiques.reduce((s: number, d: any) => s + d.montant, 0);
  const totalEpargneMois = epargneDuMois.reduce((s: number, d: any) => s + d.montant, 0);
  
  const resteMois = salaire - totalDepenseMois - totalEpargneMois;
  const jaugeEpargne = salaire > 0 ? Math.max(0, Math.min(100, (resteMois / salaire) * 100)) : 0;

  // -- 50/30/20 Règle --
  const valBesoins = depensesDuMois.filter(d => besoinsCats.includes(d.cat)).reduce((s, d) => s + d.montant, 0);
  const valEnvies = depensesDuMois.filter(d => enviesCats.includes(d.cat)).reduce((s, d) => s + d.montant, 0);
  const pctBesoins = salaire > 0 ? (valBesoins / salaire) * 100 : 0;
  const pctEnvies = salaire > 0 ? (valEnvies / salaire) * 100 : 0;
  const pctEpargneReel = salaire > 0 ? (totalEpargneMois / salaire) * 100 : 0;

  // -- Cagnottes Globales --
  const totalCagnottePEA = depenses.filter(d => d.cat === "PEA").reduce((s, d) => s + d.montant, 0);
  const totalCagnotteSecu = depenses.filter(d => d.cat === "Sécurité").reduce((s, d) => s + d.montant, 0);
  const totalCagnotteVoyage = depenses.filter(d => d.cat === "Voyage").reduce((s, d) => s + d.montant, 0);

  const budgetCats: any = depensesDuMois.reduce((acc: any, d: any) => {
      acc[d.cat] = (acc[d.cat] || 0) + d.montant;
      return acc;
  }, {});
  const catColors: any = { Courses: "#3dd68c", Sorties: "#e8a45d", Abonnement: "#3b82f6", Divers: "#a78bfa", Fixe: "#f05656", PEA: "#a78bfa", Sécurité: "#3b82f6", Voyage: "#e8a45d" };

  // ================= GRAPHIQUE BARRES 6 MOIS =================
  const derniersMois = Array.from({length: 6}, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return d.toISOString().slice(0, 7);
  }).reverse();

  const dataBarres = derniersMois.map(m => {
      const dep = depenses.filter(d => d.date.startsWith(m) && !epargneCats.includes(d.cat)).reduce((s: number, d: any) => s + d.montant, 0);
      return { label: m.split("-")[1], depense: dep, revenu: salaire };
  });
  const maxBarre = Math.max(...dataBarres.map(d => Math.max(d.depense, d.revenu)), 1);

  // ================= SIMULATEUR MONTE CARLO =================
  const sims: number[][] = [];
  for(let s=0; s<100; s++) {
      const path = [totalValeurPF];
      let v = totalValeurPF;
      for(let m=1; m<=180; m++) {
          v = v * (1 + 0.0066 + 0.04 * randomNormal()) + simMensuel;
          if(m % 12 === 0) path.push(v);
      }
      sims.push(path);
  }
  const p10: number[] = [], p50: number[] = [], p90: number[] = [];
  for(let y=0; y<=15; y++) {
      const vals = sims.map(sim => sim[y]).sort((a, b) => a - b);
      if (vals.length >= 91) {
          p10.push(vals[10]); p50.push(vals[50]); p90.push(vals[90]);
      }
  }

  // ================= ACTIONS =================
  const changeMois = (offset: number) => {
      const newDate = new Date(dateObjectActuelle);
      newDate.setMonth(newDate.getMonth() + offset);
      setMoisActuel(newDate.toISOString().slice(0, 7));
  };
  
  const changeAnnee = (offset: number) => {
      const newDate = new Date(dateObjectActuelle);
      newDate.setFullYear(newDate.getFullYear() + offset);
      setMoisActuel(newDate.toISOString().slice(0, 7));
  };

  const addDepense = (c: string) => {
    if (!inputMontant) return;
    const dateDepense = new Date();
    const [y, m] = moisActuel.split("-");
    dateDepense.setFullYear(Number(y), Number(m) - 1);
    
    const n = { id: Date.now(), cat: c, montant: parseFloat(inputMontant), note: inputNote || c, date: dateDepense.toISOString() };
    setDepenses([n, ...depenses]);
    setInputMontant(""); setInputNote("");
    setShowFabModal(false);
  };

  const viderLeMois = () => {
    if(window.confirm(`Supprimer toutes les opérations de ${nomDuMois} ?`)) {
      setDepenses(depenses.filter(d => !d.date.startsWith(moisActuel)));
    }
  };

  return (
    <div style={{ background: "#050505", color: "#fff", minHeight: "100vh", fontFamily: "-apple-system, sans-serif", paddingBottom: "100px" }}>
      
      {/* HEADER FIXE */}
      <div style={{ padding: "20px", display: "flex", justifyContent: "space-between", position: "sticky", top: 0, background: "rgba(5,5,5,0.9)", backdropFilter: "blur(10px)", zIndex: 100, borderBottom: "1px solid #111" }}>
        <div>
          <div style={{ fontSize: "20px", fontWeight: "bold" }}>Hub Mathis 💎</div>
          <div style={{ fontSize: "12px", color: "#444", textTransform: "uppercase" }}>Investissement & Budget</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: activeTab === "budget" ? (resteMois >= 0 ? "#3dd68c" : "#f05656") : (totalPL >= 0 ? "#3dd68c" : "#f05656"), fontWeight: "bold", fontSize: "18px" }}>
            {activeTab === "budget" ? f2(resteMois) : f2(totalPL)} €
          </div>
          <div style={{ fontSize: "10px", color: "#555" }}>{activeTab === "budget" ? `Reste (${nomDuMois})` : "Plus-Value Globale"}</div>
        </div>
      </div>

      {/* NAVIGATION FIXE */}
      <div style={{ display: "flex", background: "#0a0a0a", borderBottom: "1px solid #111", position: "sticky", top: "65px", zIndex: 99 }}>
        {["pea", "budget", "analyse"].map((tab) => (
          <button key={tab} style={{ flex: 1, padding: "15px", background: activeTab === tab ? "#111" : "none", color: activeTab === tab ? "#fff" : "#555", border: "none", borderBottom: activeTab === tab ? "2px solid #e8a45d" : "none", fontWeight: "bold", cursor: "pointer", textTransform: "uppercase", fontSize: "12px", transition: "0.2s" }} onClick={() => setActiveTab(tab)}>
            {tab === "pea" ? "📈 PEA" : tab === "budget" ? "💰 BUDGET" : "🎲 ANALYSE"}
          </button>
        ))}
      </div>

      <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}>
        
        {/* =========================================================
            ONGLET PEA
        ========================================================= */}
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
              
              {/* NOUVEAU BOUTON D'ACTUALISATION */}
              <button 
                onClick={fetchPrices} 
                disabled={isFetchingPrices}
                style={{ marginTop: "20px", padding: "8px 20px", background: "none", border: "1px solid #333", borderRadius: "20px", color: "#888", fontSize: "12px", cursor: "pointer" }}>
                {isFetchingPrices ? "Actualisation en cours..." : "🔄 Forcer l'actualisation"}
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
              <div style={{ background: "#0a0a0a", padding: "15px", borderRadius: "15px", border: "1px solid #111" }}>
                <div style={{ fontSize: "10px", color: "#555", textTransform: "uppercase", marginBottom: "5px" }}>Capital déposé</div>
                <div style={{ fontSize: "20px", fontWeight: "bold" }}>{f2(capitalDepose)} €</div>
              </div>
              <div style={{ background: "#0a0a0a", padding: "15px", borderRadius: "15px", border: "1px solid #111" }}>
                <div style={{ fontSize: "10px", color: "#555", textTransform: "uppercase", marginBottom: "5px" }}>Plus-value brute</div>
                <div style={{ fontSize: "20px", fontWeight: "bold", color: totalPL >= 0 ? "#3dd68c" : "#f05656" }}>{(totalPL >= 0 ? "+" : "") + f2(totalPL)} €</div>
              </div>
            </div>

            <div style={{ background: "#0a0a0a", padding: "20px", borderRadius: "15px", border: "1px solid #111" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}>
                <span style={{ fontSize: "12px", color: "#555", fontWeight: "bold" }}>ÉVOLUTION HISTORIQUE</span>
                <div style={{ display: "flex", gap: "10px", fontSize: "10px", color: "#888" }}>
                    <span style={{color: "#e8a45d"}}>● Valeur</span>
                    <span style={{color: "#444"}}>● Dépôts</span>
                </div>
              </div>
              <div style={{ height: "150px" }}>
                <GraphiqueNatif lignes={[{ data: histValeur, color: "#e8a45d" }, { data: histDepot, color: "#444" }]} />
              </div>
            </div>

            <div style={{ background: "#0a0a0a", padding: "20px", borderRadius: "15px", border: "1px solid #111", overflowX: "auto" }}>
              <div style={{ fontSize: "12px", color: "#555", marginBottom: "15px", fontWeight: "bold" }}>DÉTAIL DE TES ETF</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", paddingBottom: "10px", color: "#555", fontWeight: "normal" }}>ETF</th>
                    <th style={{ textAlign: "left", paddingBottom: "10px", color: "#555", fontWeight: "normal" }}>Qté</th>
                    <th style={{ textAlign: "left", paddingBottom: "10px", color: "#555", fontWeight: "normal" }}>Cours</th>
                    <th style={{ textAlign: "left", paddingBottom: "10px", color: "#555", fontWeight: "normal" }}>P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p: any) => (
                    <tr key={p.ticker || p.nom} style={{ borderBottom: "1px solid #111" }}>
                      <td style={{ padding: "12px 0" }}>{p.nom}</td>
                      <td style={{ padding: "12px 0" }}>{p.qty}</td>
                      <td style={{ padding: "12px 0" }}>{f2(p.prix)} €</td>
                      <td style={{ padding: "12px 0", color: p.plPct >= 0 ? "#3dd68c" : "#f05656", fontWeight: "bold" }}>{fp(p.plPct * 100)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ background: "#0a0a0a", padding: "20px", borderRadius: "15px", border: "1px solid #111" }}>
              <div style={{ fontSize: "12px", color: "#555", marginBottom: "15px", fontWeight: "bold" }}>FISCALITÉ (SI RETRAIT &gt; 5 ANS)</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ color: "#aaa" }}>Plus-value AVANT impôts</span>
                <span style={{ color: totalPL >= 0 ? "#fff" : "#f05656", fontWeight: "bold" }}>{f2(totalPL)} €</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ color: "#aaa" }}>Prélèvements Sociaux (17.2%)</span>
                <span style={{ color: "#f05656" }}>-{f2(fiscalite5ans)} €</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed #333", fontWeight: "bold" }}>
                <span style={{ color: "#3dd68c" }}>BÉNÉFICE NET APRÈS IMPÔTS</span>
                <span style={{ color: "#3dd68c" }}>{f2(gainsNets5ans)} €</span>
              </div>
            </div>
          </>
        )}

        {/* =========================================================
            ONGLET BUDGET
        ========================================================= */}
        {activeTab === "budget" && (
          <>
            {/* NAVIGATION MOIS (FLUIDIFIÉE) */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#111", borderRadius: "15px", padding: "5px", border: "1px solid #222" }}>
                <div style={{ display: "flex" }}>
                  <button onClick={() => changeAnnee(-1)} style={{ padding: "15px 15px", background: "none", border: "none", color: "#555", fontSize: "14px", cursor: "pointer" }}>&laquo;</button>
                  <button onClick={() => changeMois(-1)} style={{ padding: "15px 15px", background: "none", border: "none", color: "#fff", fontSize: "18px", cursor: "pointer" }}>‹</button>
                </div>
                
                <div style={{ fontWeight: "bold", fontSize: "14px", letterSpacing: "1px", color: "#e8a45d", textAlign: "center", flex: 1 }}>{nomDuMois}</div>
                
                <div style={{ display: "flex" }}>
                  <button onClick={() => changeMois(1)} style={{ padding: "15px 15px", background: "none", border: "none", color: "#fff", fontSize: "18px", cursor: "pointer" }}>›</button>
                  <button onClick={() => changeAnnee(1)} style={{ padding: "15px 15px", background: "none", border: "none", color: "#555", fontSize: "14px", cursor: "pointer" }}>&raquo;</button>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
              <div style={{ background: "#0a0a0a", padding: "15px", borderRadius: "15px", border: "1px solid #111" }}>
                <div style={{ fontSize: "10px", color: "#555", textTransform: "uppercase", marginBottom: "5px" }}>Revenus fixes</div>
                <input type="number" value={salaire} onChange={(e) => setSalaire(Number(e.target.value))} style={{ background: "none", border: "none", color: "#3dd68c", fontSize: "20px", fontWeight: "bold", width: "100%", padding: 0 }} />
              </div>
              <div style={{ background: "#0a0a0a", padding: "15px", borderRadius: "15px", border: "1px solid #111" }}>
                <div style={{ fontSize: "10px", color: "#555", textTransform: "uppercase", marginBottom: "5px" }}>Dépensé ce mois</div>
                <div style={{ color: "#f05656", fontSize: "20px", fontWeight: "bold" }}>{f2(totalDepenseMois)} €</div>
              </div>
            </div>

            {/* RÈGLE 50/30/20 */}
            <div style={{ background: "#0a0a0a", padding: "20px", borderRadius: "15px", border: "1px solid #111" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}>
                    <span style={{ fontSize: "12px", color: "#555", fontWeight: "bold" }}>RÈGLE 50/30/20 (IDÉAL)</span>
                </div>
                <div style={{ marginBottom: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "5px" }}>
                        <span style={{ color: "#f05656" }}>Besoins ({pctBesoins.toFixed(0)}% / 50%)</span>
                        <span style={{ color: "#e8a45d" }}>Envies ({pctEnvies.toFixed(0)}% / 30%)</span>
                        <span style={{ color: "#3dd68c" }}>Épargne ({pctEpargneReel.toFixed(0)}% / 20%)</span>
                    </div>
                    <div style={{ display: "flex", height: "8px", borderRadius: "4px", overflow: "hidden", background: "#1a1a22", gap: "2px" }}>
                        <div style={{ width: `${pctBesoins}%`, background: pctBesoins > 50 ? "#f05656" : "#f0565688" }}></div>
                        <div style={{ width: `${pctEnvies}%`, background: pctEnvies > 30 ? "#e8a45d" : "#e8a45d88" }}></div>
                        <div style={{ width: `${pctEpargneReel}%`, background: pctEpargneReel < 20 ? "#3dd68c88" : "#3dd68c" }}></div>
                    </div>
                </div>
            </div>

            {/* CAGNOTTES GLOBALES */}
            <div style={{ background: "#0a0a0a", padding: "20px", borderRadius: "15px", border: "1px solid #111" }}>
                <div style={{ fontSize: "12px", color: "#555", marginBottom: "15px", fontWeight: "bold" }}>MES CAGNOTTES (GLOBALES)</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: "13px" }}>🏦 Versé PEA</div>
                        <div style={{ fontWeight: "bold", color: "#a78bfa" }}>{f2(totalCagnottePEA)} €</div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: "13px" }}>🛡️ Épargne Sécurité</div>
                        <div style={{ fontWeight: "bold", color: "#3b82f6" }}>{f2(totalCagnotteSecu)} €</div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: "13px" }}>✈️ Voyage</div>
                        <div style={{ fontWeight: "bold", color: "#e8a45d" }}>{f2(totalCagnotteVoyage)} €</div>
                    </div>
                </div>
            </div>

            {/* GRAPHIQUE BARRES 6 MOIS */}
            <div style={{ background: "#0a0a0a", padding: "20px", borderRadius: "15px", border: "1px solid #111" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}>
                <span style={{ fontSize: "12px", color: "#555", fontWeight: "bold" }}>REVENUS VS DÉPENSES (6 MOIS)</span>
                <div style={{ display: "flex", gap: "10px", fontSize: "10px", color: "#888" }}>
                    <span style={{color: "#3dd68c"}}>● In</span>
                    <span style={{color: "#f05656"}}>● Out</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", height: "120px", gap: "10px" }}>
                {dataBarres.map((d) => (
                  <div key={d.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "5px", height: "100%" }}>
                    <div style={{ height: "100%", display: "flex", alignItems: "flex-end", width: "100%", gap: "2px" }}>
                      <div style={{ height: `${(d.revenu/maxBarre)*100}%`, width: "100%", background: "#3dd68c", borderRadius: "2px 2px 0 0" }} />
                      <div style={{ height: `${(d.depense/maxBarre)*100}%`, width: "100%", background: "#f05656", borderRadius: "2px 2px 0 0" }} />
                    </div>
                    <div style={{ fontSize: "10px", color: "#555" }}>{d.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* RÉPARTITION */}
            {depensesDuMois.length > 0 && (
                <div style={{ background: "#0a0a0a", padding: "20px", borderRadius: "15px", border: "1px solid #111" }}>
                    <div style={{ fontSize: "12px", color: "#555", marginBottom: "15px", fontWeight: "bold" }}>RÉPARTITION DU MOIS</div>
                    <div style={{ display: "flex", height: "16px", borderRadius: "8px", overflow: "hidden", gap: "2px" }}>
                      {Object.entries(budgetCats).map(([cat, val]) => {
                        const total = totalDepenseMois + totalEpargneMois;
                        const w = total > 0 ? ((val as number) / total) * 100 : 0;
                        return <div key={cat} style={{ width: `${w}%`, background: catColors[cat] || "#888" }} />;
                      })}
                    </div>
                    <div style={{ display: "flex", gap: "15px", marginTop: "15px", flexWrap: "wrap" }}>
                      {Object.entries(budgetCats).map(([cat, val]) => (
                        <div key={cat} style={{ fontSize: "11px", color: "#aaa", display: "flex", alignItems: "center", gap: "6px" }}>
                            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: catColors[cat] || "#888" }} />
                            {cat} ({f2(val as number)} €)
                        </div>
                      ))}
                    </div>
                </div>
            )}

            {/* HISTORIQUE DU MOIS */}
            <div style={{ background: "#0a0a0a", padding: "20px", borderRadius: "15px", border: "1px solid #111" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}>
                  <div style={{ fontSize: "12px", color: "#555", fontWeight: "bold" }}>HISTORIQUE ({nomDuMois})</div>
                  <button onClick={exportCSV} style={{ background: "none", border: "none", color: "#3b82f6", fontSize: "12px", cursor: "pointer", textDecoration: "underline" }}>📥 Exporter CSV</button>
              </div>
              {depensesDuMois.length === 0 && <div style={{ fontSize: "12px", color: "#555", textAlign: "center", padding: "10px 0" }}>Aucune opération ce mois-ci !</div>}
              {depensesDuMois.map((d: any) => (
                <div key={d.id} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #111" }}>
                  <div><div style={{ fontSize: "14px" }}>{d.note}</div><div style={{ fontSize: "10px", color: "#555" }}>{new Date(d.date).toLocaleDateString("fr-FR")} - {d.cat}</div></div>
                  <div style={{ fontWeight: "bold", color: epargneCats.includes(d.cat) ? "#3b82f6" : "#fff" }}>-{f2(d.montant)} €</div>
                </div>
              ))}
              {depensesDuMois.length > 0 && <button onClick={viderLeMois} style={{ width: "100%", marginTop: "15px", background: "none", border: "1px solid #222", color: "#555", padding: "10px", borderRadius: "8px", cursor: "pointer" }}>Réinitialiser ce mois</button>}
            </div>
          </>
        )}

        {/* =========================================================
            ONGLET ANALYSE
        ========================================================= */}
        {activeTab === "analyse" && (
            <div style={{ background: "#0a0a0a", padding: "20px", borderRadius: "15px", border: "1px solid #111" }}>
                <div style={{ fontSize: "12px", color: "#555", marginBottom: "10px", fontWeight: "bold" }}>SIMULATEUR MONTE CARLO</div>
                <p style={{fontSize: "12px", color: "#888", marginBottom: "20px", lineHeight: "1.5"}}>100 futurs boursiers calculés (Volatilité historique sur 15 ans).</p>
                
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                  <span style={{ fontSize: "11px", color: "#aaa" }}>Investissement mensuel :</span>
                  <strong style={{color: "#fff", fontSize: "14px"}}>{simMensuel} €</strong>
                </div>
                <input type="range" min="0" max="1000" step="50" value={simMensuel} onChange={(e) => setSimMensuel(Number(e.target.value))} style={{ width: "100%", marginBottom: "25px" }} />
                
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", fontSize: "10px", fontWeight: "bold" }}>
                    <span style={{color: "#3dd68c"}}>● Top 10% ({f0(p90[15] || 0)}€)</span>
                    <span style={{color: "#e8a45d"}}>● Médiane ({f0(p50[15] || 0)}€)</span>
                    <span style={{color: "#f05656"}}>● Pire 10% ({f0(p10[15] || 0)}€)</span>
                </div>
                
                <div style={{ height: "250px" }}>
                  <GraphiqueNatif lignes={[
                    { data: p90, color: "#3dd68c" },
                    { data: p50, color: "#e8a45d" },
                    { data: p10, color: "#f05656" }
                  ]} showXAxis={true} />
                </div>
            </div>
        )}
      </div>

      {/* =========================================================
          BOUTON D'ACTION RAPIDE (FAB) ET MODAL
      ========================================================= */}
      {activeTab === "budget" && (
          <button 
            onClick={() => setShowFabModal(true)}
            style={{ position: "fixed", bottom: "30px", right: "30px", width: "60px", height: "60px", borderRadius: "30px", background: "#e8a45d", color: "#000", fontSize: "30px", border: "none", boxShadow: "0 4px 15px rgba(232,164,93,0.4)", cursor: "pointer", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
            +
          </button>
      )}

      {showFabModal && (
          <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", zIndex: 1001, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
              <div style={{ background: "#111", width: "100%", maxWidth: "600px", padding: "20px", borderRadius: "20px 20px 0 0", borderTop: "1px solid #333", animation: "slideUp 0.3s ease-out" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}>
                      <div style={{ fontWeight: "bold", color: "#e8a45d" }}>NOUVELLE OPÉRATION</div>
                      <button onClick={() => setShowFabModal(false)} style={{ background: "none", border: "none", color: "#fff", fontSize: "20px", cursor: "pointer" }}>✕</button>
                  </div>
                  
                  <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
                    <input type="number" placeholder="€" value={inputMontant} onChange={(e) => setInputMontant(e.target.value)} style={{ flex: 1, padding: "15px", borderRadius: "10px", border: "1px solid #333", background: "#050505", color: "#fff", fontSize: "18px" }} autoFocus />
                    <input type="text" placeholder="Note (ex: Essence)" value={inputNote} onChange={(e) => setInputNote(e.target.value)} style={{ flex: 2, padding: "15px", borderRadius: "10px", border: "1px solid #333", background: "#050505", color: "#fff", fontSize: "16px" }} />
                  </div>

                  <div style={{ fontSize: "10px", color: "#555", marginBottom: "8px", textTransform: "uppercase" }}>Dépenses Courantes</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "15px" }}>
                    <button onClick={() => addDepense("Courses")} style={s.btnCourse}>🛒 Courses</button>
                    <button onClick={() => addDepense("Sorties")} style={s.btnSortie}>🍻 Sorties</button>
                    <button onClick={() => addDepense("Abonnement")} style={s.btnAbo}>📱 Abonnements</button>
                    <button onClick={() => addDepense("Fixe")} style={s.btnFixe}>🏠 Fixe / Divers</button>
                  </div>

                  <div style={{ fontSize: "10px", color: "#555", marginBottom: "8px", textTransform: "uppercase" }}>Épargne & Cagnottes</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                    <button onClick={() => addDepense("PEA")} style={s.btnPEA}>🏦 PEA</button>
                    <button onClick={() => addDepense("Sécurité")} style={s.btnSecu}>🛡️ Sécu</button>
                    <button onClick={() => addDepense("Voyage")} style={s.btnVoyage}>✈️ Voyage</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  btnCourse: { padding: "15px", background: "rgba(61,214,140,0.1)", color: "#3dd68c", border: "none", borderRadius: "10px", fontWeight: "bold", cursor: "pointer" },
  btnSortie: { padding: "15px", background: "rgba(232,164,93,0.1)", color: "#e8a45d", border: "none", borderRadius: "10px", fontWeight: "bold", cursor: "pointer" },
  btnAbo: { padding: "15px", background: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "none", borderRadius: "10px", fontWeight: "bold", cursor: "pointer" },
  btnFixe: { padding: "15px", background: "rgba(240,86,86,0.1)", color: "#f05656", border: "none", borderRadius: "10px", fontWeight: "bold", cursor: "pointer" },
  btnPEA: { padding: "10px", background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "none", borderRadius: "10px", fontWeight: "bold", cursor: "pointer", fontSize: "12px" },
  btnSecu: { padding: "10px", background: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "none", borderRadius: "10px", fontWeight: "bold", cursor: "pointer", fontSize: "12px" },
  btnVoyage: { padding: "10px", background: "rgba(232,164,93,0.1)", color: "#e8a45d", border: "none", borderRadius: "10px", fontWeight: "bold", cursor: "pointer", fontSize: "12px" },
}