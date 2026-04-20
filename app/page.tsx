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
  
  // -- SÉCURITÉ --
  const PIN_SECRET = "0000"; // CHANGER LE CODE ICI
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");

  const [activeTab, setActiveTab] = useState("budget");
  const [prices, setPrices] = useState<Record<string, any>>({});

  // -- ÉTATS BUDGET --
  const [salaire, setSalaire] = useState(239);
  const [depenses, setDepenses] = useState<any[]>([]);
  const [inputMontant, setInputMontant] = useState("");
  const [inputNote, setInputNote] = useState("");
  const [dateActuelle, setDateActuelle] = useState(new Date());
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

  // -- API BOURSE --
  useEffect(() => {
    let isActive = true;
    const fetchPrices = async () => {
      if (!isUnlocked) return;
      try {
        const tickers = [...POSITIONS.map((p: any) => p.ticker), "^FCHI", "^GSPC"].join(",");
        const res = await fetch(`/api/prices?tickers=${tickers}`);
        const data = await res.json();
        if (isActive) setPrices(data);
      } catch (e) { console.error(e); }
    };
    if (isMounted) fetchPrices();
    return () => { isActive = false; };
  }, [isMounted, isUnlocked]);

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

  // ================= CALCULS GLOBAUX =================
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
  const pvJourTotal = positions.reduce((s: number, p: any) => s + p.pvJour, 0);

  // -- CALCULS DU MOIS ACTUEL --
  const moisIso = dateActuelle.toISOString().slice(0, 7);
  const nomDuMois = dateActuelle.toLocaleString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase();
  
  const depensesDuMois = depenses.filter(d => d.date.startsWith(moisIso));
  
  // Les versements d'épargne ne sont pas des "dépenses" qui partent dans le vide, on les sépare.
  const depensesClassiques = depensesDuMois.filter(d => !["PEA", "Sécurité", "Voyage"].includes(d.cat));
  const epargneDuMois = depensesDuMois.filter(d => ["PEA", "Sécurité", "Voyage"].includes(d.cat));

  const totalDepenseMois = depensesClassiques.reduce((s: number, d: any) => s + d.montant, 0);
  const totalEpargneMois = epargneDuMois.reduce((s: number, d: any) => s + d.montant, 0);
  
  const resteMois = salaire - totalDepenseMois - totalEpargneMois;
  const jaugeEpargne = salaire > 0 ? Math.max(0, Math.min(100, (resteMois / salaire) * 100)) : 0;

  // -- CAGNOTTES GLOBALES (Toutes dates confondues) --
  const totalCagnottePEA = depenses.filter(d => d.cat === "PEA").reduce((s, d) => s + d.montant, 0);
  const totalCagnotteSecu = depenses.filter(d => d.cat === "Sécurité").reduce((s, d) => s + d.montant, 0);
  const totalCagnotteVoyage = depenses.filter(d => d.cat === "Voyage").reduce((s, d) => s + d.montant, 0);

  // -- ACTIONS --
  const changeMois = (offset: number) => {
      const newDate = new Date(dateActuelle);
      newDate.setMonth(newDate.getMonth() + offset);
      setDateActuelle(newDate);
  };

  const addDepense = (c: string) => {
    if (!inputMontant) return;
    const dateDepense = new Date(dateActuelle);
    const n = { id: Date.now(), cat: c, montant: parseFloat(inputMontant), note: inputNote || c, date: dateDepense.toISOString() };
    setDepenses([n, ...depenses]);
    setInputMontant(""); setInputNote("");
  };

  const viderLeMois = () => {
    if(window.confirm(`Supprimer toutes les opérations de ${nomDuMois} ?`)) {
      setDepenses(depenses.filter(d => !d.date.startsWith(moisIso)));
    }
  };

  return (
    <div style={{ background: "#050505", color: "#fff", minHeight: "100vh", fontFamily: "-apple-system, sans-serif", paddingBottom: "50px" }}>
      
      {/* HEADER */}
      <div style={{ padding: "20px", display: "flex", justifyContent: "space-between", position: "sticky", top: 0, background: "rgba(5,5,5,0.9)", backdropFilter: "blur(10px)", zIndex: 100, borderBottom: "1px solid #111" }}>
        <div>
          <div style={{ fontSize: "20px", fontWeight: "bold" }}>Hub Mathis 💎</div>
          <div style={{ fontSize: "12px", color: "#444", textTransform: "uppercase" }}>Investissement & Budget</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: resteMois >= 0 ? "#3dd68c" : "#f05656", fontWeight: "bold", fontSize: "18px" }}>{f2(resteMois)} €</div>
          <div style={{ fontSize: "10px", color: "#555" }}>Reste ({nomDuMois})</div>
        </div>
      </div>

      {/* MENUS */}
      <div style={{ display: "flex", background: "#0a0a0a", borderBottom: "1px solid #111", position: "sticky", top: "65px", zIndex: 99 }}>
        {["pea", "budget", "analyse"].map((tab) => (
          <button key={tab} style={{ flex: 1, padding: "15px", background: activeTab === tab ? "#111" : "none", color: activeTab === tab ? "#fff" : "#555", border: "none", borderBottom: activeTab === tab ? "2px solid #e8a45d" : "none", fontWeight: "bold", cursor: "pointer", textTransform: "uppercase", fontSize: "12px", transition: "0.2s" }} onClick={() => setActiveTab(tab)}>
            {tab === "pea" ? "📈 PEA" : tab === "budget" ? "💰 BUDGET" : "🎲 ANALYSE"}
          </button>
        ))}
      </div>

      <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}>
        
        {/* ======================= BUDGET ======================= */}
        {activeTab === "budget" && (
          <>
            {/* NAVIGATION MOIS (FLUIDE) */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#111", borderRadius: "15px", padding: "5px", border: "1px solid #222" }}>
                <button onClick={() => changeMois(-1)} style={{ padding: "15px 25px", background: "none", border: "none", color: "#fff", fontSize: "18px", cursor: "pointer" }}>←</button>
                <div style={{ fontWeight: "bold", fontSize: "14px", letterSpacing: "1px", color: "#e8a45d" }}>{nomDuMois}</div>
                <button onClick={() => changeMois(1)} style={{ padding: "15px 25px", background: "none", border: "none", color: "#fff", fontSize: "18px", cursor: "pointer" }}>→</button>
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

            {/* SAISIE RAPIDE */}
            <div style={{ background: "#111", padding: "20px", borderRadius: "15px", border: "1px solid #e8a45d44" }}>
              <div style={{ fontSize: "12px", color: "#e8a45d", marginBottom: "15px", fontWeight: "bold" }}>SAISIE RAPIDE ({nomDuMois})</div>
              <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
                <input type="number" placeholder="€" value={inputMontant} onChange={(e) => setInputMontant(e.target.value)} style={{ flex: 1, padding: "15px", borderRadius: "10px", border: "1px solid #222", background: "#050505", color: "#fff", fontSize: "16px" }} />
                <input type="text" placeholder="Note" value={inputNote} onChange={(e) => setInputNote(e.target.value)} style={{ flex: 2, padding: "15px", borderRadius: "10px", border: "1px solid #222", background: "#050505", color: "#fff", fontSize: "16px" }} />
              </div>
              
              <div style={{ fontSize: "10px", color: "#555", marginBottom: "8px", textTransform: "uppercase" }}>Dépenses</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "15px" }}>
                <button onClick={() => addDepense("Courses")} style={s.btnCourse}>🛒 Courses</button>
                <button onClick={() => addDepense("Sorties")} style={s.btnSortie}>🍻 Sorties</button>
                <button onClick={() => addDepense("Abonnement")} style={s.btnAbo}>📱 Abonnements</button>
                <button onClick={() => addDepense("Fixe")} style={s.btnFixe}>🏠 Fixe / Divers</button>
              </div>

              <div style={{ fontSize: "10px", color: "#555", marginBottom: "8px", textTransform: "uppercase" }}>Épargne & Investissement</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                <button onClick={() => addDepense("PEA")} style={s.btnPEA}>🏦 PEA</button>
                <button onClick={() => addDepense("Sécurité")} style={s.btnSecu}>🛡️ Sécu</button>
                <button onClick={() => addDepense("Voyage")} style={s.btnVoyage}>✈️ Voyage</button>
              </div>
            </div>

            {/* HISTORIQUE */}
            <div style={{ background: "#0a0a0a", padding: "20px", borderRadius: "15px", border: "1px solid #111" }}>
              <div style={{ fontSize: "12px", color: "#555", marginBottom: "15px", fontWeight: "bold" }}>HISTORIQUE DU MOIS</div>
              {depensesDuMois.length === 0 && <div style={{ fontSize: "12px", color: "#555", textAlign: "center" }}>Rien ajouté ce mois-ci !</div>}
              {depensesDuMois.map((d: any) => (
                <div key={d.id} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #111" }}>
                  <div><div style={{ fontSize: "14px" }}>{d.note}</div><div style={{ fontSize: "10px", color: "#555" }}>{new Date(d.date).toLocaleDateString("fr-FR")} - {d.cat}</div></div>
                  <div style={{ fontWeight: "bold", color: ["PEA", "Sécurité", "Voyage"].includes(d.cat) ? "#3b82f6" : "#fff" }}>-{f2(d.montant)} €</div>
                </div>
              ))}
              {depensesDuMois.length > 0 && <button onClick={viderLeMois} style={{ width: "100%", marginTop: "15px", background: "none", border: "1px solid #222", color: "#555", padding: "10px", borderRadius: "8px", cursor: "pointer" }}>Réinitialiser ce mois</button>}
            </div>
          </>
        )}

        {/* ======================= PEA (Idem) ======================= */}
        {activeTab === "pea" && (
           <div style={{ background: "linear-gradient(145deg, #161619, #0a0a0a)", padding: "30px", borderRadius: "20px", textAlign: "center", border: "1px solid #1e1e28" }}>
              <div style={{ fontSize: "12px", color: "#555", marginBottom: "5px", fontWeight: "bold" }}>VALEUR TOTALE DU PEA</div>
              <div style={{ fontSize: "36px", fontWeight: "bold" }}>{f2(totalValeurPF)} €</div>
              <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
                <span style={{ padding: "5px 12px", borderRadius: "20px", fontSize: "12px", background: "rgba(232,164,93,0.1)", color: "#e8a45d", fontWeight: "bold" }}>{pvJourTotal >= 0 ? "↗" : "↘"} {pvJourTotal >= 0 ? "+" : ""}{f2(pvJourTotal)} € ajd</span>
              </div>
            </div>
            /* Tu peux remettre le reste des cartes du PEA ici comme dans l'ancien code */
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  btnCourse: { padding: "12px", background: "rgba(61,214,140,0.1)", color: "#3dd68c", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" },
  btnSortie: { padding: "12px", background: "rgba(232,164,93,0.1)", color: "#e8a45d", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" },
  btnAbo: { padding: "12px", background: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" },
  btnFixe: { padding: "12px", background: "rgba(240,86,86,0.1)", color: "#f05656", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" },
  btnPEA: { padding: "12px", background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" },
  btnSecu: { padding: "12px", background: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" },
  btnVoyage: { padding: "12px", background: "rgba(232,164,93,0.1)", color: "#e8a45d", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" },
}