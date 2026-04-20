"use client";

import { useEffect, useState, useCallback } from "react";
import { POSITIONS, CONFIG, HISTORY } from "./data/config";

const f2 = (v: any) => Number(v).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fp = (v: any) => (v >= 0 ? "+" : "") + Number(v).toFixed(2) + " %";

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("pea");
  const [prices, setPrices] = useState<any>({});

  const [salaire, setSalaire] = useState(239);
  const [depenses, setDepenses] = useState<any[]>([]);
  const [inputMontant, setInputMontant] = useState("");
  const [inputNote, setInputNote] = useState("");

  useEffect(() => {
    setIsMounted(true);
    const savedD = localStorage.getItem("m_d");
    if (savedD) setDepenses(JSON.parse(savedD));
    const savedS = localStorage.getItem("m_s");
    if (savedS) setSalaire(Number(savedS));
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem("m_d", JSON.stringify(depenses));
      localStorage.setItem("m_s", salaire.toString());
    }
  }, [depenses, salaire, isMounted]);

  const fetchPrices = useCallback(async () => {
    try {
      const t = POSITIONS.map((p: any) => p.ticker).join(",");
      const res = await fetch("/api/prices?tickers=" + t);
      const data = await res.json();
      setPrices(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (isMounted) fetchPrices();
  }, [fetchPrices, isMounted]);

  const totalDepenses = depenses.reduce((s: number, d: any) => s + d.montant, 0);
  const reste = salaire - totalDepenses;

  const myPositions = POSITIONS.map((p: any) => {
    const info = prices[p.ticker] || {};
    const prix = info.price || p.pru;
    const valeur = p.qty * prix;
    const investi = p.qty * p.pru;
    return { ...p, prix, valeur, investi, plPct: investi > 0 ? (valeur - investi) / investi : 0 };
  });

  const totalValeurPF = myPositions.reduce((s: number, p: any) => s + p.valeur, 0) + CONFIG.liquidites;

  const addDepense = (c: string) => {
    if (!inputMontant) return;
    const n = { id: Date.now(), cat: c, montant: parseFloat(inputMontant), note: inputNote || c };
    setDepenses([n, ...depenses]);
    setInputMontant("");
    setInputNote("");
  };

  if (!isMounted) return null;

  return (
    <div style={{ background: "#050505", color: "#fff", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <div style={{ padding: "20px", borderBottom: "1px solid #111", display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "20px", fontWeight: "bold" }}>Hub Mathis 🚀</div>
          <div style={{ fontSize: "12px", color: "#444" }}>Budget & PEA</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: reste >= 0 ? "#3dd68c" : "#f05656", fontWeight: "bold" }}>{f2(reste)} €</div>
          <div style={{ fontSize: "10px" }}>Reste à vivre</div>
        </div>
      </div>

      <div style={{ display: "flex", background: "#0a0a0a" }}>
        <button style={{ flex: 1, padding: "15px", background: activeTab === "pea" ? "#111" : "none", color: "#fff", border: "none" }} onClick={() => setActiveTab("pea")}>📈 PEA</button>
        <button style={{ flex: 1, padding: "15px", background: activeTab === "budget" ? "#111" : "none", color: "#fff", border: "none" }} onClick={() => setActiveTab("budget")}>💰 BUDGET</button>
      </div>

      <div style={{ padding: "20px" }}>
        {activeTab === "pea" ? (
          <div>
            <div style={{ background: "#111", padding: "30px", borderRadius: "15px", textAlign: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "12px", color: "#555" }}>VALEUR TOTALE</div>
              <div style={{ fontSize: "32px", fontWeight: "bold" }}>{f2(totalValeurPF)} €</div>
            </div>
            {myPositions.map((p: any) => (
              <div key={p.ticker} style={{ display: "flex", justifyContent: "space-between", padding: "15px 0", borderBottom: "1px solid #111" }}>
                <span>{p.nom}</span>
                <span style={{ color: p.plPct >= 0 ? "#3dd68c" : "#f05656" }}>{fp(p.plPct * 100)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "20px" }}>
              <div style={{ background: "#111", padding: "15px", borderRadius: "10px" }}>
                <div style={{ fontSize: "10px" }}>REVENUS</div>
                <input type="number" value={salaire} onChange={(e) => setSalaire(Number(e.target.value))} style={{ background: "none", border: "none", color: "#fff", fontSize: "18px", width: "100%" }} />
              </div>
              <div style={{ background: "#111", padding: "15px", borderRadius: "10px" }}>
                <div style={{ fontSize: "10px" }}>DÉPENSÉ</div>
                <div style={{ color: "#f05656", fontSize: "18px" }}>{f2(totalDepenses)} €</div>
              </div>
            </div>

            <div style={{ background: "#111", padding: "20px", borderRadius: "15px", marginBottom: "20px" }}>
              <input type="number" placeholder="Montant €" value={inputMontant} onChange={(e) => setInputMontant(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "10px", borderRadius: "5px", border: "1px solid #222", background: "#050505", color: "#fff" }} />
              <input type="text" placeholder="Note" value={inputNote} onChange={(e) => setInputNote(e.target.value)} style={{ width: "100%", padding: "10px", marginBottom: "15px", borderRadius: "5px", border: "1px solid #222", background: "#050505", color: "#fff" }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <button onClick={() => addDepense("Courses")} style={{ padding: "10px", background: "#3dd68c", border: "none", borderRadius: "5px" }}>🛒 Courses</button>
                <button onClick={() => addDepense("Sorties")} style={{ padding: "10px", background: "#e8a45d", border: "none", borderRadius: "5px" }}>🍻 Sorties</button>
                <button onClick={() => addDepense("Divers")} style={{ padding: "10px", background: "#a78bfa", border: "none", borderRadius: "5px" }}>🎁 Divers</button>
                <button onClick={() => addDepense("Fixe")} style={{ padding: "10px", background: "#f05656", border: "none", borderRadius: "5px" }}>🏠 Fixe</button>
              </div>
            </div>

            {depenses.map((d: any) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #111" }}>
                <div><div>{d.note}</div><div style={{ fontSize: "10px", color: "#444" }}>{d.cat}</div></div>
                <div style={{ fontWeight: "bold" }}>-{f2(d.montant)} €</div>
              </div>
            ))}
            {depenses.length > 0 && <button onClick={() => setDepenses([])} style={{ width: "100%", marginTop: "20px", background: "none", border: "1px solid #222", color: "#444", padding: "10px", borderRadius: "5px" }}>Vider le mois</button>}
          </div>
        )}
      </div>
    </div>
  );
}