// ============================================================
//  CONFIG.TS — À MODIFIER À CHAQUE ACHAT D'ETF
//  C'est ta base de données personnelle !
// ============================================================

export const POSITIONS = [
  {
    id: 'ese',
    nom: 'S&P 500 BNP',
    ticker: 'ESE.PA', 
    qty: 53,               
    pru: 27.89,            
    ter: 0.15,             
    couleur: '#e8a45d',
  },
  {
    id: 'dcam',
    nom: 'MSCI World Amundi',
    ticker: 'DCAM.PA',      
    qty: 16,
    pru: 5.17,
    ter: 0.12,
    couleur: '#3dd68c',
  }
];

export const CONFIG = {
  dateOuverture: '2024-04-02',  
  capitalInitial: 2092.12,           
  liquidites: 531.52,            
  objectif: 60000,               
  horizonAns: 15,                
  versementMensuel: 0,           
  cagrCible: 8,                  
};

export const HISTORY = [
  { mois: '2025-09', valeur: 952.52,  depot: 880, ver: 0 },
  { mois: '2025-10', valeur: 987.75,  depot: 880, ver: 0 },
  { mois: '2025-11', valeur: 983.75,  depot: 880, ver: 0 },
  { mois: '2025-12', valeur: 982.15,  depot: 880, ver: 0 },
  { mois: '2026-01', valeur: 977.11,  depot: 880, ver: 0 },
  { mois: '2026-02', valeur: 976.25,  depot: 880, ver: 0 },
  { mois: '2026-03', valeur: 942.97,  depot: 880, ver: 0 },
  { mois: '2026-04', valeur: 992.55,  depot: 880, ver: 0 },
];