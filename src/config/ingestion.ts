import type { AssetType } from "@prisma/client";

export type MonitoredAsset = {
  symbol: string;
  name: string;
  type: AssetType;
};

/**
 * Ativos do `marketDataWorker` (Alpha Vantage — TIME_SERIES_DAILY).
 * Tech, mineração (cobre), energia.
 */
export const MARKET_WORKER_ASSETS: MonitoredAsset[] = [
  { symbol: "AAPL", name: "Apple Inc. (Tech)", type: "STOCK" },
  { symbol: "COPX", name: "Global X Copper Miners ETF (Cobre/Mineração)", type: "COMMODITY" },
  { symbol: "XLE", name: "Energy Select Sector SPDR Fund (Energia)", type: "ENERGY" },
];

export type FredSeriesConfig = {
  seriesId: string;
  name: string;
};

/** FRED: taxa de juros (Fed Funds) + proxy de preço de energia (WTI). */
export const MARKET_WORKER_FRED_SERIES: FredSeriesConfig[] = [
  { seriesId: "DFF", name: "Taxa efetiva Federal Funds (diária)" },
  { seriesId: "DCOILWTICO", name: "Petróleo WTI, spot Cushing (USD/bbl)" },
];

/** Intervalo entre chamadas Alpha Vantage (free tier). */
export const ALPHA_VANTAGE_REQUEST_GAP_MS = 1_500;

/** Série sintética Code Chroma — risco geopolítico derivado do worker de notícias. */
export const GEO_RISK_SERIES_ID = "CODECHROMA_GEO_RISK_NLP" as const;

export const GEO_RISK_MACRO_NAME =
  "Índice de risco geopolítico (NLP heurístico Code Chroma, escala 1–10)" as const;

export const NEWS_ANALYSIS_PAGE_SIZE = 20;

/** NewsAPI `q` — keywords do produto. */
export const NEWS_ANALYSIS_QUERY =
  '("Data Center" OR "Supply Chain" OR War OR Energy OR energia OR datacenter)';
