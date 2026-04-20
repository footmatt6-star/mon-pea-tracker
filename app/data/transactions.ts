// app/data/transactions.ts

export const TRANSACTIONS = [
  // Tes achats initiaux (Base de ton PEA)
  { date: '2024-04-02', ticker: 'ESE.PA', type: 'ACHAT', qty: 53, prix: 26.27, frais: 0.00 },
  { date: '2024-04-02', ticker: 'DCAM.PA', type: 'ACHAT', qty: 16, prix: 5.17, frais: 0.00 },

  // Modèle pour tes prochains achats (à copier-coller le mois prochain) :
  // { date: '2026-05-05', ticker: 'DCAM.PA', type: 'ACHAT', qty: 4, prix: 5.50, frais: 0.99 },
];

// --- Moteur de calcul automatique ---
export function calcPRU(ticker: string) {
  const ops = TRANSACTIONS.filter((t) => t.ticker === ticker && t.type === 'ACHAT');
  if (!ops.length) return 0;
  const totalInvesti = ops.reduce((s, t) => s + (t.qty * t.prix) + t.frais, 0);
  const totalQty = ops.reduce((s, t) => s + t.qty, 0);
  return totalQty > 0 ? totalInvesti / totalQty : 0;
}

export function calcQty(ticker: string) {
  return TRANSACTIONS.filter((t) => t.ticker === ticker)
    .reduce((s, t) => s + (t.type === 'ACHAT' ? t.qty : -t.qty), 0);
}

export function calcFraisTotal(ticker: string) {
  return TRANSACTIONS.filter((t) => t.ticker === ticker)
    .reduce((s, t) => s + (t.frais || 0), 0);
}