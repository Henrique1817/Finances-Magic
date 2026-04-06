import type { AssetType } from "@prisma/client";

export type MonitoredAsset = {
  symbol: string;
  name: string;
  category: string;
  type: AssetType;
};

/**
 * Ativos do `marketDataWorker` (Alpha Vantage — TIME_SERIES_DAILY).
 * Tech, mineração (cobre), energia, índice amplo e exemplo large-cap.
 */
export const MARKET_WORKER_ASSETS: MonitoredAsset[] = [
  { symbol: "AAPL", name: "Apple Inc.", category: "Tech", type: "STOCK" },
  { symbol: "MSFT", name: "Microsoft Corp.", category: "Tech", type: "STOCK" },
  { symbol: "NVDA", name: "NVIDIA Corp.", category: "Tech", type: "STOCK" },
  { symbol: "AMZN", name: "Amazon.com Inc.", category: "Tech", type: "STOCK" },
  { symbol: "META", name: "Meta Platforms Inc.", category: "Tech", type: "STOCK" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", category: "Index", type: "INDEX" },
  { symbol: "QQQ", name: "Invesco QQQ Trust", category: "Index", type: "INDEX" },
  { symbol: "IWM", name: "iShares Russell 2000 ETF", category: "Index", type: "INDEX" },
  { symbol: "EEM", name: "iShares MSCI Emerging Markets ETF", category: "Index", type: "INDEX" },
  { symbol: "EWZ", name: "iShares MSCI Brazil ETF", category: "Index", type: "INDEX" },
  { symbol: "GLD", name: "SPDR Gold Trust", category: "Commodities", type: "COMMODITY" },
  { symbol: "SLV", name: "iShares Silver Trust", category: "Commodities", type: "COMMODITY" },
  { symbol: "COPX", name: "Global X Copper Miners ETF", category: "Commodities", type: "COMMODITY" },
  { symbol: "LIT", name: "Global X Lithium & Battery Tech ETF", category: "Commodities", type: "COMMODITY" },
  { symbol: "XLE", name: "Energy Select Sector SPDR Fund", category: "Energia", type: "ENERGY" },
  { symbol: "XOP", name: "SPDR Oil & Gas Exploration & Production ETF", category: "Energia", type: "ENERGY" },
  { symbol: "USO", name: "United States Oil Fund", category: "Energia", type: "ENERGY" },
  { symbol: "PETR4.SA", name: "Petrobras PN", category: "Brasil", type: "STOCK" },
  { symbol: "VALE3.SA", name: "Vale ON", category: "Brasil", type: "STOCK" },
  { symbol: "ITUB4.SA", name: "Itau Unibanco PN", category: "Financeiro", type: "STOCK" },
  { symbol: "BBDC4.SA", name: "Bradesco PN", category: "Financeiro", type: "STOCK" },
  { symbol: "WEGE3.SA", name: "WEG SA ON", category: "Industrial", type: "STOCK" },
  { symbol: "ABEV3.SA", name: "Ambev SA ON", category: "Consumo", type: "STOCK" },
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
  { seriesId: "UNRATE", name: "Taxa de desemprego EUA (mensal)" },
  { seriesId: "DGS10", name: "Treasury 10Y EUA (diário)" },
  { seriesId: "DGS2", name: "Treasury 2Y EUA (diário)" },
  { seriesId: "BAMLH0A0HYM2", name: "US High Yield OAS (spread)" },
  { seriesId: "T10YIE", name: "Breakeven 10Y inflação implícita" },
];

/** Intervalo entre chamadas Alpha Vantage (free tier). */
export const ALPHA_VANTAGE_REQUEST_GAP_MS = 1_500;

export type ProviderName =
  | "alphaVantage"
  | "yahooFinance"
  | "fred"
  | "newsApi"
  | "gdelt"
  | "openMeteo";

export type ProviderBudget = {
  requestsPerMinute: number;
  requestsPerDay: number;
  cooldownOn429Ms: number;
  circuitBreakerFailures: number;
  circuitBreakerMs: number;
};

/** Budgets conservadores para operar em planos gratuitos. */
export const INGESTION_PROVIDER_BUDGETS: Record<ProviderName, ProviderBudget> = {
  alphaVantage: {
    requestsPerMinute: 5,
    requestsPerDay: 25,
    cooldownOn429Ms: 15 * 60_000,
    circuitBreakerFailures: 3,
    circuitBreakerMs: 30 * 60_000,
  },
  yahooFinance: {
    requestsPerMinute: 20,
    requestsPerDay: 2_000,
    cooldownOn429Ms: 10 * 60_000,
    circuitBreakerFailures: 4,
    circuitBreakerMs: 20 * 60_000,
  },
  fred: {
    requestsPerMinute: 60,
    requestsPerDay: 2_000,
    cooldownOn429Ms: 10 * 60_000,
    circuitBreakerFailures: 5,
    circuitBreakerMs: 15 * 60_000,
  },
  newsApi: {
    requestsPerMinute: 5,
    requestsPerDay: 90,
    cooldownOn429Ms: 30 * 60_000,
    circuitBreakerFailures: 3,
    circuitBreakerMs: 30 * 60_000,
  },
  gdelt: {
    requestsPerMinute: 30,
    requestsPerDay: 2_000,
    cooldownOn429Ms: 5 * 60_000,
    circuitBreakerFailures: 5,
    circuitBreakerMs: 10 * 60_000,
  },
  openMeteo: {
    requestsPerMinute: 30,
    requestsPerDay: 3_000,
    cooldownOn429Ms: 5 * 60_000,
    circuitBreakerFailures: 5,
    circuitBreakerMs: 10 * 60_000,
  },
};

export const INGESTION_RETRY_MAX_ATTEMPTS = 3;
export const INGESTION_RETRY_BASE_DELAY_MS = 1_000;

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

export const NEWS_ANALYSIS_REGIONAL_QUERIES: Array<{
  region: "AMERICAS" | "EUROPE" | "APAC" | "GLOBAL";
  language: "en" | "pt" | "es";
  q: string;
}> = [
  {
    region: "GLOBAL",
    language: "en",
    q: '("interest rates" OR inflation OR recession OR "central bank" OR geopolitics)',
  },
  {
    region: "AMERICAS",
    language: "en",
    q: '("Federal Reserve" OR Treasury OR "S&P 500" OR Nasdaq OR commodities)',
  },
  {
    region: "EUROPE",
    language: "en",
    q: '("ECB" OR "euro area" OR energy crisis OR "natural gas")',
  },
  {
    region: "APAC",
    language: "en",
    q: '(China OR Japan OR "South Korea" OR semiconductor OR shipping)',
  },
  {
    region: "AMERICAS",
    language: "pt",
    q: '("Banco Central" OR "taxa de juros" OR Ibovespa OR Petrobras OR Vale)',
  },
];

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
