"use client";

import { useState } from "react";

// --- TYPES ---
interface PainMarker {
  id: number;
  x: number; // Pourcentage X
  y: number; // Pourcentage Y
  intensity: number; // 1 à 10
}

export default function BodyMapPoC() {
  const [markers, setMarkers] = useState<PainMarker[]>([]);
  const [pendingClick, setPendingClick] = useState<{ x: number; y: number } | null>(null);
  const [intensitySelect, setIntensitySelect] = useState<number>(5);

  // --- LOGIQUE DE CLIC SUR LE CORPS ---
  const handleBodyClick = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    // On calcule la position du clic en pourcentage (pour que ça marche sur tout écran)
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setPendingClick({ x, y });
    setIntensitySelect(5); // Valeur par défaut
  };

  const confirmMarker = () => {
    if (pendingClick) {
      setMarkers([...markers, { id: Date.now(), x: pendingClick.x, y: pendingClick.y, intensity: intensitySelect }]);
      setPendingClick(null);
    }
  };

  const cancelMarker = () => setPendingClick(null);

  const removeMarker = (id: number) => {
    setMarkers(markers.filter(m => m.id !== id));
  };

  // --- GESTION DES COULEURS (EVA) ---
  const getIntensityColor = (val: number) => {
    if (val <= 3) return "#3dd68c"; // Vert (Léger)
    if (val <= 6) return "#e8a45d"; // Orange (Modéré)
    return "#f05656"; // Rouge (Fort)
  };

  return (
    <div style={{ background: "#f8fafc", color: "#1e293b", minHeight: "100vh", fontFamily: "-apple-system, sans-serif" }}>
      
      {/* HEADER PRO */}
      <div style={{ background: "#ffffff", padding: "20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div>
          <div style={{ fontSize: "20px", fontWeight: "bold", color: "#0f172a" }}>Kiné Run Tracker 🏃‍♂️</div>
          <div style={{ fontSize: "12px", color: "#64748b", textTransform: "uppercase", letterSpacing: "1px" }}>Espace Patient - Saisie de séance</div>
        </div>
      </div>

      <div style={{ maxWidth: "500px", margin: "0 auto", padding: "20px" }}>
        
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: "0 0 5px 0", fontSize: "18px" }}>Où as-tu ressenti une gêne ?</h2>
          <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>Touche la zone concernée sur le schéma ci-dessous.</p>
        </div>

        {/* ================= ZONE DE LA BODY MAP ================= */}
        <div style={{ position: "relative", width: "100%", maxWidth: "300px", margin: "0 auto", background: "#ffffff", borderRadius: "20px", padding: "20px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0" }}>
          
          <svg 
            viewBox="0 0 100 200" 
            style={{ width: "100%", height: "auto", cursor: "crosshair", overflow: "visible" }}
            onClick={handleBodyClick}
          >
            {/* SILHOUETTE BASIQUE (SVG dessiné à la main pour le test) */}
            <g stroke="#cbd5e1" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round">
              {/* Tête */}
              <circle cx="50" cy="20" r="12" fill="#f1f5f9" />
              {/* Tronc */}
              <rect x="35" y="35" width="30" height="50" rx="8" fill="#f1f5f9" />
              {/* Bras Gauche */}
              <line x1="30" y1="45" x2="15" y2="80" />
              <line x1="15" y1="80" x2="10" y2="100" />
              {/* Bras Droit */}
              <line x1="70" y1="45" x2="85" y2="80" />
              <line x1="85" y1="80" x2="90" y2="100" />
              {/* Jambe Gauche (Cuisse + Mollet) */}
              <line x1="42" y1="85" x2="35" y2="135" />
              <line x1="35" y1="135" x2="35" y2="185" />
              {/* Jambe Droite (Cuisse + Mollet) */}
              <line x1="58" y1="85" x2="65" y2="135" />
              <line x1="65" y1="135" x2="65" y2="185" />
            </g>

            {/* AFFICHAGE DES PASTILLES ENREGISTRÉES */}
            {markers.map((m) => (
              <g key={m.id} style={{ transform: `translate(${m.x}%, ${m.y}%)` }}>
                <circle cx="0" cy="0" r="4" fill={getIntensityColor(m.intensity)} stroke="#fff" strokeWidth="1" />
                <circle cx="0" cy="0" r="8" fill={getIntensityColor(m.intensity)} opacity="0.3" />
                <text x="6" y="2" fontSize="4" fontWeight="bold" fill="#0f172a">{m.intensity}</text>
              </g>
            ))}

            {/* CURSEUR EN COURS D'AJOUT (Cible) */}
            {pendingClick && (
              <g style={{ transform: `translate(${pendingClick.x}%, ${pendingClick.y}%)` }}>
                <circle cx="0" cy="0" r="4" fill="#3b82f6" />
                <circle cx="0" cy="0" r="12" fill="none" stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="2,2" />
              </g>
            )}
          </svg>
        </div>

        {/* ================= MODAL D'INTENSITÉ ================= */}
        {pendingClick && (
          <div style={{ marginTop: "20px", padding: "20px", background: "#fff", borderRadius: "15px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", border: "1px solid #e2e8f0", animation: "slideUp 0.3s ease" }}>
            <div style={{ fontWeight: "bold", textAlign: "center", marginBottom: "15px" }}>Intensité de la gêne / douleur</div>
            
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "14px", fontWeight: "bold", color: getIntensityColor(intensitySelect) }}>
              <span>1 (Légère)</span>
              <span style={{ fontSize: "24px" }}>{intensitySelect}/10</span>
              <span>10 (Forte)</span>
            </div>
            
            <input 
              type="range" 
              min="1" max="10" step="1" 
              value={intensitySelect} 
              onChange={(e) => setIntensitySelect(Number(e.target.value))} 
              style={{ width: "100%", marginBottom: "20px", accentColor: getIntensityColor(intensitySelect) }} 
            />
            
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={cancelMarker} style={{ flex: 1, padding: "12px", background: "#f1f5f9", color: "#64748b", border: "none", borderRadius: "10px", fontWeight: "bold", cursor: "pointer" }}>Annuler</button>
              <button onClick={confirmMarker} style={{ flex: 2, padding: "12px", background: getIntensityColor(intensitySelect), color: "#fff", border: "none", borderRadius: "10px", fontWeight: "bold", cursor: "pointer" }}>Valider la zone</button>
            </div>
          </div>
        )}

        {/* ================= RÉCAPITULATIF DES GÊNES ================= */}
        {markers.length > 0 && !pendingClick && (
          <div style={{ marginTop: "20px" }}>
            <h3 style={{ fontSize: "14px", color: "#64748b", textTransform: "uppercase" }}>Gênes signalées ({markers.length})</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {markers.map((m) => (
                <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", padding: "12px 15px", borderRadius: "10px", borderLeft: `4px solid ${getIntensityColor(m.intensity)}`, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "24px", height: "24px", borderRadius: "12px", background: getIntensityColor(m.intensity), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "bold" }}>
                      {m.intensity}
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: "500" }}>Zone localisée</div>
                  </div>
                  <button onClick={() => removeMarker(m.id)} style={{ background: "none", border: "none", color: "#ef4444", fontSize: "18px", cursor: "pointer" }}>✕</button>
                </div>
              ))}
            </div>
            <button style={{ width: "100%", padding: "15px", marginTop: "20px", background: "#0f172a", color: "#fff", border: "none", borderRadius: "10px", fontWeight: "bold", cursor: "pointer", fontSize: "16px", boxShadow: "0 4px 6px rgba(15,23,42,0.2)" }}>
              Enregistrer la séance
            </button>
          </div>
        )}
      </div>
    </div>
  );
}