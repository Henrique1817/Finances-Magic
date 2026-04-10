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
  { symbol: "MXRF11.SA", name: "Maxi Renda FII", category: "Imobiliario", type: "STOCK" },
  { symbol: "ACWI", name: "iShares MSCI ACWI ETF", category: "Index", type: "INDEX" },
  ...buildExtraMarketWorkerAssets(),
];

function buildExtraMarketWorkerAssets(): MonitoredAsset[] {
  return [
  { symbol: "GOOGL", name: "Alphabet Inc. Class A", category: "Tech", type: "STOCK" },
  { symbol: "TSLA", name: "Tesla Inc.", category: "Auto", type: "STOCK" },
  { symbol: "AVGO", name: "Broadcom Inc.", category: "Tech", type: "STOCK" },
  { symbol: "ORCL", name: "Oracle Corp.", category: "Tech", type: "STOCK" },
  { symbol: "ADBE", name: "Adobe Inc.", category: "Tech", type: "STOCK" },
  { symbol: "CRM", name: "Salesforce Inc.", category: "Tech", type: "STOCK" },
  { symbol: "INTC", name: "Intel Corp.", category: "Tech", type: "STOCK" },
  { symbol: "AMD", name: "Advanced Micro Devices Inc.", category: "Tech", type: "STOCK" },
  { symbol: "QCOM", name: "Qualcomm Inc.", category: "Tech", type: "STOCK" },
  { symbol: "TXN", name: "Texas Instruments Inc.", category: "Tech", type: "STOCK" },
  { symbol: "ASML", name: "ASML Holding N.V.", category: "Tech", type: "STOCK" },
  { symbol: "TSM", name: "Taiwan Semiconductor Manufacturing", category: "Tech", type: "STOCK" },
  { symbol: "SAP", name: "SAP SE", category: "Tech", type: "STOCK" },
  { symbol: "SNOW", name: "Snowflake Inc.", category: "Tech", type: "STOCK" },
  { symbol: "PANW", name: "Palo Alto Networks Inc.", category: "Tech", type: "STOCK" },
  { symbol: "CRWD", name: "CrowdStrike Holdings Inc.", category: "Tech", type: "STOCK" },
  { symbol: "PLTR", name: "Palantir Technologies Inc.", category: "Tech", type: "STOCK" },
  { symbol: "UBER", name: "Uber Technologies Inc.", category: "Tech", type: "STOCK" },
  { symbol: "SHOP", name: "Shopify Inc.", category: "Tech", type: "STOCK" },
  { symbol: "SQ", name: "Block Inc.", category: "Tech", type: "STOCK" },
  { symbol: "IBM", name: "International Business Machines Corp.", category: "Tech", type: "STOCK" },
  { symbol: "CSCO", name: "Cisco Systems Inc.", category: "Tech", type: "STOCK" },
  { symbol: "NFLX", name: "Netflix Inc.", category: "Tech", type: "STOCK" },
  { symbol: "PYPL", name: "PayPal Holdings Inc.", category: "Tech", type: "STOCK" },
  { symbol: "SONY", name: "Sony Group Corp.", category: "Consumo", type: "STOCK" },
  { symbol: "F", name: "Ford Motor Co.", category: "Auto", type: "STOCK" },
  { symbol: "GM", name: "General Motors Co.", category: "Auto", type: "STOCK" },
  { symbol: "NKE", name: "NIKE Inc.", category: "Consumo", type: "STOCK" },
  { symbol: "MCD", name: "McDonald's Corp.", category: "Consumo", type: "STOCK" },
  { symbol: "SBUX", name: "Starbucks Corp.", category: "Consumo", type: "STOCK" },
  { symbol: "DIS", name: "The Walt Disney Co.", category: "Consumo", type: "STOCK" },
  { symbol: "PEP", name: "PepsiCo Inc.", category: "Consumo", type: "STOCK" },
  { symbol: "KO", name: "The Coca-Cola Co.", category: "Consumo", type: "STOCK" },
  { symbol: "COST", name: "Costco Wholesale Corp.", category: "Consumo", type: "STOCK" },
  { symbol: "WMT", name: "Walmart Inc.", category: "Consumo", type: "STOCK" },
  { symbol: "TGT", name: "Target Corp.", category: "Consumo", type: "STOCK" },
  { symbol: "PG", name: "Procter & Gamble Co.", category: "Consumo", type: "STOCK" },
  { symbol: "JNJ", name: "Johnson & Johnson", category: "Saude", type: "STOCK" },
  { symbol: "PFE", name: "Pfizer Inc.", category: "Saude", type: "STOCK" },
  { symbol: "MRK", name: "Merck & Co. Inc.", category: "Saude", type: "STOCK" },
  { symbol: "LLY", name: "Eli Lilly and Co.", category: "Saude", type: "STOCK" },
  { symbol: "ABBV", name: "AbbVie Inc.", category: "Saude", type: "STOCK" },
  { symbol: "UNH", name: "UnitedHealth Group Inc.", category: "Saude", type: "STOCK" },
  { symbol: "CVS", name: "CVS Health Corp.", category: "Saude", type: "STOCK" },
  { symbol: "BAC", name: "Bank of America Corp.", category: "Financeiro", type: "STOCK" },
  { symbol: "JPM", name: "JPMorgan Chase & Co.", category: "Financeiro", type: "STOCK" },
  { symbol: "GS", name: "Goldman Sachs Group Inc.", category: "Financeiro", type: "STOCK" },
  { symbol: "MS", name: "Morgan Stanley", category: "Financeiro", type: "STOCK" },
  { symbol: "C", name: "Citigroup Inc.", category: "Financeiro", type: "STOCK" },
  { symbol: "BLK", name: "BlackRock Inc.", category: "Financeiro", type: "STOCK" },
  { symbol: "SCHW", name: "Charles Schwab Corp.", category: "Financeiro", type: "STOCK" },
  { symbol: "AXP", name: "American Express Co.", category: "Financeiro", type: "STOCK" },
  { symbol: "V", name: "Visa Inc.", category: "Financeiro", type: "STOCK" },
  { symbol: "MA", name: "Mastercard Inc.", category: "Financeiro", type: "STOCK" },
  { symbol: "XOM", name: "Exxon Mobil Corp.", category: "Energia", type: "ENERGY" },
  { symbol: "CVX", name: "Chevron Corp.", category: "Energia", type: "ENERGY" },
  { symbol: "SHEL", name: "Shell plc", category: "Energia", type: "ENERGY" },
  { symbol: "BP", name: "BP plc", category: "Energia", type: "ENERGY" },
  { symbol: "TTE", name: "TotalEnergies SE", category: "Energia", type: "ENERGY" },
  { symbol: "COP", name: "ConocoPhillips", category: "Energia", type: "ENERGY" },
  { symbol: "EOG", name: "EOG Resources Inc.", category: "Energia", type: "ENERGY" },
  { symbol: "SLB", name: "Schlumberger N.V.", category: "Energia", type: "ENERGY" },
  { symbol: "HAL", name: "Halliburton Co.", category: "Energia", type: "ENERGY" },
  { symbol: "ENB", name: "Enbridge Inc.", category: "Energia", type: "ENERGY" },
  { symbol: "KMI", name: "Kinder Morgan Inc.", category: "Energia", type: "ENERGY" },
  { symbol: "NEE", name: "NextEra Energy Inc.", category: "Energia", type: "ENERGY" },
  { symbol: "DUK", name: "Duke Energy Corp.", category: "Energia", type: "ENERGY" },
  { symbol: "SO", name: "The Southern Co.", category: "Energia", type: "ENERGY" },
  { symbol: "AEP", name: "American Electric Power Co.", category: "Energia", type: "ENERGY" },
  { symbol: "EXC", name: "Exelon Corp.", category: "Energia", type: "ENERGY" },
  { symbol: "BA", name: "The Boeing Co.", category: "Industrial", type: "STOCK" },
  { symbol: "CAT", name: "Caterpillar Inc.", category: "Industrial", type: "STOCK" },
  { symbol: "DE", name: "Deere & Co.", category: "Industrial", type: "STOCK" },
  { symbol: "GE", name: "GE Aerospace", category: "Industrial", type: "STOCK" },
  { symbol: "HON", name: "Honeywell International Inc.", category: "Industrial", type: "STOCK" },
  { symbol: "MMM", name: "3M Co.", category: "Industrial", type: "STOCK" },
  { symbol: "LMT", name: "Lockheed Martin Corp.", category: "Industrial", type: "STOCK" },
  { symbol: "NOC", name: "Northrop Grumman Corp.", category: "Industrial", type: "STOCK" },
  { symbol: "RTX", name: "RTX Corp.", category: "Industrial", type: "STOCK" },
  { symbol: "UPS", name: "United Parcel Service Inc.", category: "Industrial", type: "STOCK" },
  { symbol: "FDX", name: "FedEx Corp.", category: "Industrial", type: "STOCK" },
  { symbol: "UNP", name: "Union Pacific Corp.", category: "Industrial", type: "STOCK" },
  { symbol: "CSX", name: "CSX Corp.", category: "Industrial", type: "STOCK" },
  { symbol: "NSC", name: "Norfolk Southern Corp.", category: "Industrial", type: "STOCK" },
  { symbol: "BHP", name: "BHP Group Ltd.", category: "Materiais", type: "STOCK" },
  { symbol: "RIO", name: "Rio Tinto plc", category: "Materiais", type: "STOCK" },
  { symbol: "FCX", name: "Freeport-McMoRan Inc.", category: "Materiais", type: "STOCK" },
  { symbol: "NEM", name: "Newmont Corp.", category: "Materiais", type: "STOCK" },
  { symbol: "VNQ", name: "Vanguard Real Estate ETF", category: "Imobiliario", type: "INDEX" },
  { symbol: "XLRE", name: "Real Estate Select Sector SPDR Fund", category: "Imobiliario", type: "INDEX" },
  { symbol: "PLD", name: "Prologis Inc.", category: "Imobiliario", type: "STOCK" },
  { symbol: "AMT", name: "American Tower Corp.", category: "Imobiliario", type: "STOCK" },
  { symbol: "EQIX", name: "Equinix Inc.", category: "Imobiliario", type: "STOCK" },
  { symbol: "SPG", name: "Simon Property Group Inc.", category: "Imobiliario", type: "STOCK" },
  { symbol: "O", name: "Realty Income Corp.", category: "Imobiliario", type: "STOCK" },
  { symbol: "TLT", name: "iShares 20+ Year Treasury Bond ETF", category: "Renda Fixa", type: "INDEX" },
  { symbol: "IEF", name: "iShares 7-10 Year Treasury Bond ETF", category: "Renda Fixa", type: "INDEX" },
  { symbol: "HYG", name: "iShares iBoxx $ High Yield Corporate Bond ETF", category: "Renda Fixa", type: "INDEX" },
  { symbol: "LQD", name: "iShares iBoxx $ Investment Grade Corporate Bond ETF", category: "Renda Fixa", type: "INDEX" },
    { symbol: "BND", name: "Vanguard Total Bond Market ETF", category: "Renda Fixa", type: "INDEX" },
  ];
}

export type FredSeriesConfig = {
  seriesId: string;
  name: string;
};

export type WorldBankIndicatorConfig = {
  /** Código ISO-2 do país (ex.: US, BR, CN). */
  countryIso2: string;
  /** Código do indicador no World Bank. */
  indicatorId: string;
  name: string;
};

/** FRED: juros, petróleo, volatilidade implícita, FX, inflação. */
export const MARKET_WORKER_FRED_SERIES: FredSeriesConfig[] = [
  { seriesId: "DFF", name: "Taxa efetiva Federal Funds (diária)" },
  { seriesId: "DCOILWTICO", name: "Petróleo WTI, spot Cushing (USD/bbl)" },
  { seriesId: "VIXCLS", name: "Índice VIX (volatilidade)" },
  { seriesId: "DEXUSEU", name: "Taxa de câmbio USD/EUR (índice)" },
  { seriesId: "DEXJPUS", name: "Taxa de câmbio Japão JPY/USD (índice)" },
  { seriesId: "DEXCHUS", name: "Taxa de câmbio China CNY/USD (índice)" },
  { seriesId: "DEXBZUS", name: "Taxa de câmbio Brasil BRL/USD (índice)" },
  { seriesId: "CPIAUCSL", name: "CPI EUA — todos os consumidores (nível)" },
  { seriesId: "UNRATE", name: "Taxa de desemprego EUA (mensal)" },
  { seriesId: "DGS10", name: "Treasury 10Y EUA (diário)" },
  { seriesId: "DGS2", name: "Treasury 2Y EUA (diário)" },
  { seriesId: "BAMLH0A0HYM2", name: "US High Yield OAS (spread)" },
  { seriesId: "T10YIE", name: "Breakeven 10Y inflação implícita" },
  { seriesId: "INDPRO", name: "Produção industrial EUA (mensal)" },
  { seriesId: "PAYEMS", name: "Payroll não-agrícola EUA (mensal)" },
  { seriesId: "RSAFS", name: "Vendas no varejo EUA (mensal)" },
];

/** World Bank (dados anuais): cobertura macro global por país. */
export const MARKET_WORKER_WORLD_BANK_INDICATORS: WorldBankIndicatorConfig[] = [
  { countryIso2: "US", indicatorId: "NY.GDP.MKTP.KD.ZG", name: "PIB real (% a.a.) — EUA" },
  { countryIso2: "US", indicatorId: "FP.CPI.TOTL.ZG", name: "Inflação CPI (% a.a.) — EUA" },
  { countryIso2: "US", indicatorId: "SL.UEM.TOTL.ZS", name: "Desemprego (% força de trabalho) — EUA" },
  { countryIso2: "US", indicatorId: "NE.EXP.GNFS.ZS", name: "Exportações (% do PIB) — EUA" },

  { countryIso2: "BR", indicatorId: "NY.GDP.MKTP.KD.ZG", name: "PIB real (% a.a.) — Brasil" },
  { countryIso2: "BR", indicatorId: "FP.CPI.TOTL.ZG", name: "Inflação CPI (% a.a.) — Brasil" },
  { countryIso2: "BR", indicatorId: "SL.UEM.TOTL.ZS", name: "Desemprego (% força de trabalho) — Brasil" },
  { countryIso2: "BR", indicatorId: "NE.EXP.GNFS.ZS", name: "Exportações (% do PIB) — Brasil" },

  { countryIso2: "CN", indicatorId: "NY.GDP.MKTP.KD.ZG", name: "PIB real (% a.a.) — China" },
  { countryIso2: "CN", indicatorId: "FP.CPI.TOTL.ZG", name: "Inflação CPI (% a.a.) — China" },
  { countryIso2: "CN", indicatorId: "SL.UEM.TOTL.ZS", name: "Desemprego (% força de trabalho) — China" },

  { countryIso2: "IN", indicatorId: "NY.GDP.MKTP.KD.ZG", name: "PIB real (% a.a.) — Índia" },
  { countryIso2: "IN", indicatorId: "FP.CPI.TOTL.ZG", name: "Inflação CPI (% a.a.) — Índia" },
  { countryIso2: "IN", indicatorId: "SL.UEM.TOTL.ZS", name: "Desemprego (% força de trabalho) — Índia" },

  { countryIso2: "DE", indicatorId: "NY.GDP.MKTP.KD.ZG", name: "PIB real (% a.a.) — Alemanha" },
  { countryIso2: "DE", indicatorId: "FP.CPI.TOTL.ZG", name: "Inflação CPI (% a.a.) — Alemanha" },
  { countryIso2: "DE", indicatorId: "SL.UEM.TOTL.ZS", name: "Desemprego (% força de trabalho) — Alemanha" },
];

/** Intervalo entre chamadas Alpha Vantage (free tier). */
export const ALPHA_VANTAGE_REQUEST_GAP_MS = 1_500;
export const BRAPI_REQUEST_GAP_MS = 2_000;

export type ProviderName =
  | "brapi"
  | "yfinancePython"
  | "alphaVantage"
  | "yahooFinance"
  | "stooq"
  | "fred"
  | "worldBank"
  | "newsApi"
  | "gdelt"
  | "googleNewsRss"
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
  brapi: {
    requestsPerMinute: 10,
    requestsPerDay: 650,
    cooldownOn429Ms: 30 * 60_000,
    circuitBreakerFailures: 3,
    circuitBreakerMs: 30 * 60_000,
  },
  yfinancePython: {
    requestsPerMinute: 20,
    requestsPerDay: 1_500,
    cooldownOn429Ms: 10 * 60_000,
    circuitBreakerFailures: 4,
    circuitBreakerMs: 20 * 60_000,
  },
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
  stooq: {
    requestsPerMinute: 30,
    requestsPerDay: 3_000,
    cooldownOn429Ms: 10 * 60_000,
    circuitBreakerFailures: 5,
    circuitBreakerMs: 20 * 60_000,
  },
  fred: {
    requestsPerMinute: 60,
    requestsPerDay: 2_000,
    cooldownOn429Ms: 10 * 60_000,
    circuitBreakerFailures: 5,
    circuitBreakerMs: 15 * 60_000,
  },
  worldBank: {
    requestsPerMinute: 30,
    requestsPerDay: 3_000,
    cooldownOn429Ms: 5 * 60_000,
    circuitBreakerFailures: 5,
    circuitBreakerMs: 10 * 60_000,
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
  googleNewsRss: {
    requestsPerMinute: 20,
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
