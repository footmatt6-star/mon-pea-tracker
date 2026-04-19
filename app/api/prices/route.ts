import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Récupère les tickers demandés par le tableau de bord
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get('tickers');
  
  if (!tickersParam) {
    return NextResponse.json({ error: 'Paramètre tickers manquant' }, { status: 400 });
  }

  const tickerList = tickersParam.split(',').map((t) => t.trim()).filter(Boolean);
  const results: Record<string, any> = {};

  await Promise.all(
    tickerList.map(async (ticker) => {
      try {
        // Demande 5 jours d'historique pour calculer la variation du jour
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d&includePrePost=false`;

        const resp = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Accept: 'application/json',
          },
          next: { revalidate: 300 } // Met en cache pendant 5 minutes
        });

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const data = await resp.json();
        const result = data?.chart?.result?.[0];
        const meta = result?.meta;
        const closes = result?.indicators?.quote?.[0]?.close ?? [];

        // Calcul du prix et de la variation
        const validCloses = closes.filter((c: any) => c != null);
        const currentPrice = meta?.regularMarketPrice ?? validCloses.at(-1) ?? 0;
        const prevClose = meta?.chartPreviousClose ?? (validCloses.length >= 2 ? validCloses.at(-2) : currentPrice);
        
        const change = currentPrice - prevClose;
        const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

        results[ticker] = {
          price: Math.round(currentPrice * 100) / 100,
          change: Math.round(change * 100) / 100,
          changePct: Math.round(changePct * 100) / 100,
          ok: true,
        };
      } catch (err: any) {
        results[ticker] = {
          price: 0, change: 0, changePct: 0, ok: false, error: err.message
        };
      }
    })
  );

  return NextResponse.json(results);
}