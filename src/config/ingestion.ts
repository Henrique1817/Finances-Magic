import type { AssetType } from "@prisma/client";

export type MonitoredAsset = {
  symbol: string;
  name: string;
  type: AssetType;
};

/**
 * Ativos do `marketDataWorker` (Alpha Vantage — TIME_SERIES_DAILY).
 * Tech, mineração (cobre), energia, índice amplo e exemplo large-cap.
 */
export const MARKET_WORKER_ASSETS: MonitoredAsset[] = [
  { symbol: "AAPL", name: "Apple Inc. (Tech)", type: "STOCK" },
  { symbol: "MSFT", name: "Microsoft Corp. (Tech)", type: "STOCK" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust (Índice)", type: "INDEX" },
  { symbol: "COPX", name: "Global X Copper Miners ETF (Cobre/Mineração)", type: "COMMODITY" },
  { symbol: "XLE", name: "Energy Select Sector SPDR Fund (Energia)", type: "ENERGY" },
];

export type FredSeriesConfig = {
  seriesId: string;
  name: string;
};

/** FRED: juros, petróleo, volatilidade implícita, FX, inflação. */
export const MARKET_WORKER_FRED_SERIES: FredSeriesConfig[] = [
  { seriesId: "DFF", name: "Taxa efetiva Federal Funds (diária)" },
  { seriesId: "DCOILWTICO", name: "Petróleo WTI, spot Cushing (USD/bbl)" },
  { seriesId: "VIXCLS", name: "Índice VIX (volatilidade)" },
  { seriesId: "DEXUSEU", name: "Taxa de câmbio USD/EUR (índice)" },
  { seriesId: "CPIAUCSL", name: "CPI EUA — todos os consumidores (nível)" },
];

/** Intervalo entre chamadas Alpha Vantage (free tier). */
export const ALPHA_VANTAGE_REQUEST_GAP_MS = 1_500;

/** Série sintética Code Chroma — risco geopolítico derivado do worker de notícias. */
export const GEO_RISK_SERIES_ID = "CODECHROMA_GEO_RISK_NLP" as const;

export const GEO_RISK_MACRO_NAME =
  "Índice de risco geopolítico (NLP heurístico Code Chroma, escala 1–10)" as const;

export const NEWS_ANALYSIS_PAGE_SIZE = 20;

/** NewsAPI `q` — várias consultas em sequência (com pausa entre elas). */
export const NEWS_ANALYSIS_QUERIES: string[] = [
  '("Data Center" OR "Supply Chain" OR War OR Energy OR energia OR datacenter)',
  '("semiconductor" OR chip OR "interest rates" OR Fed OR Banco Central)',
  '("commodities" OR oil OR petróleo OR copper OR cobre)',
];

/** Pausa entre chamadas NewsAPI ao percorrer `NEWS_ANALYSIS_QUERIES`. */
export const NEWS_ANALYSIS_QUERY_DELAY_MS = 1_200;

/** Presets de coordenadas para ingestão climática (Open-Meteo archive). */
export const CLIMATE_REGION_PRESETS: Record<
  string,
  { lat: number; lon: number; label: string }
> = {
  SP_CAPITAL: { lat: -23.5505, lon: -46.6333, label: "São Paulo (capital)" },
  BRASILIA: { lat: -15.7939, lon: -47.8828, label: "Brasília" },
  RJ_CAPITAL: { lat: -22.9068, lon: -43.1729, label: "Rio de Janeiro (capital)" },
  US_NY: { lat: 40.7128, lon: -74.006, label: "Nova York (referência)" },
};

/** Filtra chaves de ambiente às que existem em `CLIMATE_REGION_PRESETS`. */
export function parseClimateRegionKeys(envKeys: string[]): string[] {
  const set = new Set<string>();
  for (const k of envKeys) {
    if (k in CLIMATE_REGION_PRESETS) set.add(k);
  }
  return [...set];
}
