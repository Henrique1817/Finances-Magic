import { Prisma, type AssetType } from "@prisma/client";
import axios, { isAxiosError } from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import {
  ALPHA_VANTAGE_REQUEST_GAP_MS,
  BRAPI_REQUEST_GAP_MS,
  MARKET_WORKER_ASSETS,
  MARKET_WORKER_FRED_SERIES,
  MARKET_WORKER_WORLD_BANK_INDICATORS,
  type MonitoredAsset,
} from "../../config/ingestion";
import { env } from "../../config/env";
import { runWithIngestionRunLog } from "../../lib/ingestionRun";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { sleep } from "../../lib/sleep";
import {
  canUseProvider,
  markProvider429,
  recordFallbackEvent,
  recordIngestionItemStatus,
  withRetry,
} from "./quotaPlanner";

const log = logger.child({ worker: "marketData" });

const ALPHA_URL = "https://www.alphavantage.co/query";
const BRAPI_URL = "https://brapi.dev/api/quote";
const FRED_OBS_URL = "https://api.stlouisfed.org/fred/series/observations";
const WORLD_BANK_INDICATOR_URL = "https://api.worldbank.org/v2/country";
const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const STOOQ_DAILY_CSV_URL = "https://stooq.com/q/d/l/";
const YFINANCE_SCRIPT_PATH = resolve(process.cwd(), "src", "scripts", "fetch_yfinance.py");
const execFileAsync = promisify(execFile);
type CandidateAsset = {
  symbol: string;
  name: string;
  category: string;
  type: AssetType;
};
type CountRow = { requests: number };
type GeminiCandidateAsset = CandidateAsset & {
  confidence?: number;
  reason?: string;
};
const NEWS_TICKER_STOPWORDS = new Set([
  "THE",
  "AND",
  "FOR",
  "WITH",
  "FROM",
  "THIS",
  "THAT",
  "WILL",
  "SAYS",
  "SAID",
  "NEAR",
  "OVER",
  "UNDER",
  "ABOVE",
  "AFTER",
  "BEFORE",
  "MIDDLE",
  "CHINA",
  "WAR",
  "OIL",
  "FED",
  "ECB",
  "BIDEN",
  "TRUMP",
  "USA",
  "UK",
  "UAE",
  "NATO",
  "EU",
  "GDP",
  "CPI",
  "ETF",
]);
const ALLOWED_ASSET_TYPES = new Set<AssetType>(["STOCK", "INDEX", "COMMODITY", "ENERGY"]);

function dedupeMonitoredAssets(items: MonitoredAsset[]): MonitoredAsset[] {
  const bySymbol = new Map<string, MonitoredAsset>();
  for (const item of items) {
    const symbol = item.symbol.trim().toUpperCase();
    if (!symbol) continue;
    if (bySymbol.has(symbol)) continue;
    bySymbol.set(symbol, { ...item, symbol });
  }
  return [...bySymbol.values()];
}

function normalizeCandidateAsset(raw: GeminiCandidateAsset): CandidateAsset | null {
  const symbol = String(raw.symbol ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!symbol || !/^[A-Z0-9]{1,6}(?:\.[A-Z]{1,3})?$/.test(symbol)) return null;
  if (NEWS_TICKER_STOPWORDS.has(symbol)) return null;

  const name = String(raw.name ?? "").trim();
  const category = String(raw.category ?? "").trim();
  const typeRaw = String(raw.type ?? "")
    .trim()
    .toUpperCase() as AssetType;
  const type: AssetType = ALLOWED_ASSET_TYPES.has(typeRaw) ? typeRaw : "STOCK";
  return {
    symbol,
    name: name || `Ativo descoberto por agente IA (${symbol})`,
    category: category || "AutoDiscoveryAI",
    type,
  };
}

function safeParseJsonObject(rawText: string): unknown {
  const trimmed = rawText.trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    }
    throw new Error("Resposta da IA não está em JSON válido.");
  }
}

function utcDayStartDate(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function reserveDailyParamAgentGeminiCall(modelName: string): Promise<boolean> {
  const provider = `gemini-daily-param-agent:${modelName}`;
  const dayStart = utcDayStartDate();
  const cap = env.dailyParamAgentGeminiDailyCap;
  const rows = await prisma.$queryRaw<CountRow[]>`
    SELECT "requests"
    FROM "api_quota_counters"
    WHERE "provider" = ${provider}
      AND "window" = 'day'
      AND "windowStart" = ${dayStart}
    LIMIT 1
  `;
  const used = rows[0]?.requests ?? 0;
  if (used >= cap) return false;
  await prisma.$executeRaw`
    INSERT INTO "api_quota_counters" ("id","provider","window","windowStart","requests","updatedAt","createdAt")
    VALUES (gen_random_uuid()::text, ${provider}, 'day', ${dayStart}, 1, NOW(), NOW())
    ON CONFLICT ("provider","window","windowStart")
    DO UPDATE SET "requests" = "api_quota_counters"."requests" + 1, "updatedAt" = NOW()
  `;
  return true;
}

async function discoverAssetsFromNewsWithGemini(args: {
  existingSymbols: Set<string>;
  maxNew: number;
  lookback: number;
}): Promise<MonitoredAsset[]> {
  if (!env.geminiApiKey || !env.dailyParamAgentUseGemini) return [];
  const reserved = await reserveDailyParamAgentGeminiCall(env.dailyParamAgentGeminiModel);
  if (!reserved) {
    log.info(
      { cap: env.dailyParamAgentGeminiDailyCap, model: env.dailyParamAgentGeminiModel },
      "Cap diário do agente Gemini atingido; descoberta IA ignorada",
    );
    return [];
  }
  const rows = await prisma.newsRecord.findMany({
    orderBy: { publishedAt: "desc" },
    take: Math.max(20, args.lookback),
    select: { title: true },
  });
  const titles = rows
    .map((r) => r.title?.trim() ?? "")
    .filter(Boolean)
    .slice(0, args.lookback);
  if (titles.length === 0) return [];

  const prompt = [
    "Você é um agente de descoberta de ativos financeiros.",
    "Objetivo: sugerir NOVOS tickers para monitorar com base em manchetes recentes.",
    "Responda SOMENTE JSON no formato:",
    '{"candidates":[{"symbol":"AAPL","name":"Apple Inc.","category":"Tech","type":"STOCK","confidence":0.91,"reason":"..." }]}',
    "Regras:",
    "- Não repetir símbolos já existentes.",
    `- Símbolos existentes (não sugerir): ${[...args.existingSymbols].sort().join(", ")}`,
    `- Retorne no máximo ${args.maxNew} candidatos.`,
    "- Use símbolos reais e negociáveis quando possível.",
    '- "type" deve ser um de: STOCK, INDEX, COMMODITY, ENERGY.',
    "- Evite tokens genéricos (WAR, FED, GDP etc.).",
    "",
    "MANCHETES RECENTES:",
    ...titles.map((t) => `- ${t}`),
  ].join("\n");

  const gen = new GoogleGenerativeAI(env.geminiApiKey);
  const model = gen.getGenerativeModel({
    model: env.dailyParamAgentGeminiModel,
    generationConfig: { responseMimeType: "application/json" },
  });
  const result = await model.generateContent(prompt);
  const raw = result.response.text();
  const parsed = safeParseJsonObject(raw) as { candidates?: GeminiCandidateAsset[] };
  const candidates = Array.isArray(parsed?.candidates) ? parsed.candidates : [];

  const out: MonitoredAsset[] = [];
  const seen = new Set<string>(args.existingSymbols);
  for (const candidate of candidates) {
    const normalized = normalizeCandidateAsset(candidate);
    if (!normalized) continue;
    if (seen.has(normalized.symbol)) continue;
    seen.add(normalized.symbol);
    out.push(normalized);
    if (out.length >= args.maxNew) break;
  }
  return out;
}

async function discoverAssetsFromRecentNews(args: {
  existingSymbols: Set<string>;
  maxNew: number;
  lookback: number;
}): Promise<MonitoredAsset[]> {
  const rows = await prisma.newsRecord.findMany({
    orderBy: { publishedAt: "desc" },
    take: Math.max(20, args.lookback),
    select: { title: true },
  });
  const out: MonitoredAsset[] = [];
  const seen = new Set<string>(args.existingSymbols);
  const pattern = /\b[A-Z]{1,5}(?:\.[A-Z]{1,3})?\b/g;

  for (const row of rows) {
    const title = row.title ?? "";
    const matches = title.toUpperCase().match(pattern) ?? [];
    for (const raw of matches) {
      const symbol = raw.trim().toUpperCase();
      if (!symbol || NEWS_TICKER_STOPWORDS.has(symbol)) continue;
      if (seen.has(symbol)) continue;
      seen.add(symbol);
      out.push({
        symbol,
        name: `Ativo descoberto por agente diário (${symbol})`,
        category: "AutoDiscovery",
        type: "STOCK",
      });
      if (out.length >= args.maxNew) return out;
    }
  }
  return out;
}

type TimeSeriesDaily = Record<string, Record<string, string>>;
type PriceRow = { date: string; close: string };
type BrapiResult = {
  historicalDataPrice?: Array<{ date?: number; close?: number }>;
  symbol?: string;
};

function normalizeBrapiSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/\.SA$/i, "");
}

function parseTradeDate(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T12:00:00.000Z`);
}

/** Todas as datas com fechamento válido, mais recente primeiro. */
function allClosesFromDailySeries(series: TimeSeriesDaily | undefined): PriceRow[] {
  if (!series || typeof series !== "object") return [];
  const dates = Object.keys(series).sort((a, b) => b.localeCompare(a));
  const out: { date: string; close: string }[] = [];
  for (const d of dates) {
    const row = series[d];
    const close = row?.["4. close"];
    if (close && close !== "null") out.push({ date: d, close });
  }
  return out;
}

/** Mock: ~100 dias de fechamentos determinísticos (sem rede). */
function mockDailyCloses(symbol: string): { date: string; close: string }[] {
  const out: { date: string; close: string }[] = [];
  const seed = [...symbol].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  for (let i = 0; i < 100; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const base = 100 + (seed % 80) + symbol.length * 0.37;
    const wobble = ((seed + i * 17) % 100) * 0.02;
    const close = (base + wobble).toFixed(4);
    out.push({ date: ds, close });
  }
  return out;
}

function logRateLimit(provider: string, context: string, status?: number): void {
  log.warn({ provider, context, status }, "Rate limit (HTTP 429) — pulando sem interromper o worker");
}

async function fetchBrapiDailySeries(symbol: string): Promise<PriceRow[] | null> {
  const symbolForBrapi = normalizeBrapiSymbol(symbol);
  const payload = await withRetry("brapi", async () => {
    const { data, status } = await axios.get<{ results?: BrapiResult[] }>(`${BRAPI_URL}/${encodeURIComponent(symbolForBrapi)}`, {
      params: {
        range: "2y",
        interval: "1d",
        token: env.brapiToken,
      },
      validateStatus: () => true,
    });
    if (status === 429) {
      markProvider429("brapi");
      logRateLimit("brapi", symbolForBrapi, status);
      throw new Error("brapi_429");
    }
    if (status >= 400) throw new Error(`brapi_http_${status}`);
    return data;
  });
  if (!payload?.results?.length) return null;
  const history = payload.results[0]?.historicalDataPrice ?? [];
  const out: PriceRow[] = [];
  for (const row of history) {
    if (!row.date || typeof row.close !== "number" || !Number.isFinite(row.close) || row.close <= 0) continue;
    const ds = new Date(row.date * 1000).toISOString().slice(0, 10);
    out.push({ date: ds, close: row.close.toFixed(8) });
  }
  out.sort((a, b) => b.date.localeCompare(a.date));
  return out.length ? out : null;
}

async function fetchYfinancePythonDailySeries(symbol: string): Promise<PriceRow[] | null> {
  const result = await withRetry("yfinancePython", async () => {
    const { stdout } = await execFileAsync(env.yfinancePythonExecutable, [YFINANCE_SCRIPT_PATH, symbol, "2y"], {
      timeout: 60_000,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 4,
    });
    return stdout;
  });
  if (!result) return null;
  try {
    const parsed = JSON.parse(result) as { ok?: boolean; rows?: PriceRow[]; error?: string };
    if (!parsed.ok || !Array.isArray(parsed.rows)) return null;
    return parsed.rows.filter((x) => typeof x.date === "string" && typeof x.close === "string");
  } catch {
    return null;
  }
}

async function fetchAlphaVantageDailySeries(symbol: string): Promise<PriceRow[] | null> {
  if (env.alphaVantageUseMock || !env.alphaVantageApiKey) {
    if (env.alphaVantageUseMock) return mockDailyCloses(symbol);
    log.warn("ALPHA_VANTAGE_API_KEY ausente — fonte Alpha Vantage ignorada (seguindo para fallback real)");
    return null;
  }

  return withRetry("alphaVantage", async () => {
    const { data, status } = await axios.get<Record<string, unknown>>(ALPHA_URL, {
      params: {
        function: "TIME_SERIES_DAILY",
        symbol,
        outputsize: "compact",
        apikey: env.alphaVantageApiKey,
      },
      validateStatus: () => true,
    });

    if (status === 429 || (typeof data["Note"] === "string" && String(data["Note"]).toLowerCase().includes("call frequency"))) {
      markProvider429("alphaVantage");
      logRateLimit("alphaVantage", symbol, status);
      throw new Error("alpha_vantage_429");
    }
    if (status >= 400) {
      log.error({ symbol, status }, "Alpha Vantage HTTP erro");
      throw new Error(`alpha_vantage_http_${status}`);
    }

    if (typeof data["Error Message"] === "string") {
      log.error({ symbol, message: data["Error Message"] }, "Alpha Vantage erro de API");
      throw new Error("alpha_vantage_api_error");
    }

    const series = data["Time Series (Daily)"] as TimeSeriesDaily | undefined;
    const rows = allClosesFromDailySeries(series);
    return rows.length ? rows : null;
  });
}

async function fetchYahooDailySeries(symbol: string): Promise<PriceRow[] | null> {
  const providerCheck = canUseProvider("yahooFinance");
  if (!providerCheck.ok) return null;
  try {
    const url = `${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}`;
    const nowSec = Math.floor(Date.now() / 1000);
    const twoYearsAgoSec = nowSec - 3600 * 24 * 700;
    const result = await withRetry("yahooFinance", async () => {
      const { data, status } = await axios.get<{
        chart?: {
          result?: Array<{
            timestamp?: number[];
            indicators?: { quote?: Array<{ close?: Array<number | null> }> };
          }>;
          error?: { code?: string; description?: string };
        };
      }>(url, {
        params: {
          period1: twoYearsAgoSec,
          period2: nowSec,
          interval: "1d",
          events: "history",
        },
        validateStatus: () => true,
      });
      if (status === 429) {
        markProvider429("yahooFinance");
        throw new Error("yahoo_429");
      }
      if (status >= 400) {
        throw new Error(`yahoo_http_${status}`);
      }
      if (data.chart?.error) {
        throw new Error(`yahoo_error_${data.chart.error.code ?? "unknown"}`);
      }
      return data;
    });
    if (!result) return null;
    const first = result.chart?.result?.[0];
    const ts = first?.timestamp ?? [];
    const closes = first?.indicators?.quote?.[0]?.close ?? [];
    const out: PriceRow[] = [];
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i];
      const c = closes[i];
      if (!t || c == null || !Number.isFinite(c)) continue;
      const ds = new Date(t * 1000).toISOString().slice(0, 10);
      out.push({ date: ds, close: Number(c).toFixed(8) });
    }
    out.sort((a, b) => b.date.localeCompare(a.date));
    return out.length ? out : null;
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 429) {
      logRateLimit("yahooFinance", symbol, 429);
      return null;
    }
    log.error({ err, symbol }, "Falha ao consultar fallback Yahoo Finance");
    return null;
  }
}

function toStooqSymbol(symbol: string): string {
  const s = symbol.trim().toLowerCase();
  if (s.endsWith(".sa")) return `${s.slice(0, -3)}.br`;
  if (s.endsWith(".us") || s.endsWith(".br") || s.endsWith(".uk") || s.endsWith(".de")) return s;
  return `${s}.us`;
}

async function fetchStooqDailySeries(symbol: string): Promise<PriceRow[] | null> {
  const stooqSymbol = toStooqSymbol(symbol);
  const payload = await withRetry("stooq", async () => {
    const { data, status } = await axios.get<string>(STOOQ_DAILY_CSV_URL, {
      params: { s: stooqSymbol, i: "d" },
      responseType: "text",
      transformResponse: [(v) => v as string],
      validateStatus: () => true,
    });
    if (status === 429) {
      markProvider429("stooq");
      throw new Error("stooq_429");
    }
    if (status >= 400) throw new Error(`stooq_http_${status}`);
    return data;
  });
  if (!payload) return null;

  const lines = payload
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  if (lines.length <= 1) return null;

  const out: PriceRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(",");
    const date = cols[0]?.trim();
    const close = cols[4]?.trim();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (!close || close.toLowerCase() === "null" || close.toLowerCase() === "n/d") continue;
    const closeNum = Number(close);
    if (!Number.isFinite(closeNum) || closeNum <= 0) continue;
    out.push({ date, close: closeNum.toFixed(8) });
  }
  out.sort((a, b) => b.date.localeCompare(a.date));
  return out.length ? out : null;
}

async function upsertAssetPrice(
  symbol: string,
  name: string,
  category: string,
  type: AssetType,
  date: string,
  close: string,
): Promise<void> {
  const tradeDate = parseTradeDate(date);
  const closeDec = new Prisma.Decimal(close);

  const asset = await prisma.asset.upsert({
    where: { symbol },
    create: { symbol, name, category, type },
    update: { name, category, type },
  });

  await prisma.assetPriceHistory.upsert({
    where: { assetId_date: { assetId: asset.id, date: tradeDate } },
    create: { assetId: asset.id, date: tradeDate, close: closeDec },
    update: { close: closeDec },
  });
}

type FredObservation = { date: string; value: string };
type WorldBankObservation = { date?: string; value?: number | null };

function parseObsDate(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T12:00:00.000Z`);
}

function validFredObservations(observations: FredObservation[] | undefined): FredObservation[] {
  if (!Array.isArray(observations)) return [];
  return observations.filter((o) => o.value && o.value !== ".");
}

async function fetchAndPersistFredSeries(seriesId: string, name: string): Promise<number> {
  const key = env.fredApiKey;
  if (!key) {
    log.warn("FRED_API_KEY ausente — bloco FRED ignorado");
    return 0;
  }

  let count = 0;
  try {
    const payload = await withRetry("fred", async () => {
      const { data, status } = await axios.get<{
      error_message?: string;
      observations?: FredObservation[];
    }>(FRED_OBS_URL, {
      params: {
        series_id: seriesId,
        api_key: key,
        file_type: "json",
        sort_order: "desc",
        limit: 500,
      },
      validateStatus: () => true,
    });

      if (status === 429) {
        markProvider429("fred");
      logRateLimit("fred", seriesId, status);
        throw new Error("fred_429");
      }
      if (status >= 400) {
        throw new Error(`fred_http_${status}`);
      }
      if (data.error_message) {
        throw new Error(`fred_api_${data.error_message}`);
      }
      return data;
    });
    if (!payload) return 0;
    const list = validFredObservations(payload.observations);
    if (list.length === 0) {
      log.error({ seriesId }, "FRED sem observação válida");
      return 0;
    }

    for (const obs of list) {
      const obsDate = parseObsDate(obs.date);
      const value = new Prisma.Decimal(obs.value);
      await prisma.macroIndicator.upsert({
        where: { seriesId_date: { seriesId, date: obsDate } },
        create: { seriesId, name, date: obsDate, value },
        update: { name, value },
      });
      count += 1;
    }

    log.info({ seriesId, rows: count }, "Série FRED persistida (até 500 obs.)");
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 429) {
      logRateLimit("fred", seriesId, 429);
      return count;
    }
    log.error({ err, seriesId }, "Falha FRED");
  }
  return count;
}

async function fetchAndPersistWorldBankIndicator(
  countryIso2: string,
  indicatorId: string,
  name: string,
): Promise<number> {
  let count = 0;
  try {
    const payload = await withRetry("worldBank", async () => {
      const url = `${WORLD_BANK_INDICATOR_URL}/${encodeURIComponent(countryIso2)}/indicator/${encodeURIComponent(indicatorId)}`;
      const { data, status } = await axios.get<unknown>(url, {
        params: {
          format: "json",
          per_page: 120,
          mrnev: 20,
        },
        validateStatus: () => true,
      });
      if (status === 429) {
        markProvider429("worldBank");
        logRateLimit("worldBank", `${countryIso2}:${indicatorId}`, status);
        throw new Error("world_bank_429");
      }
      if (status >= 400) {
        throw new Error(`world_bank_http_${status}`);
      }
      return data;
    });
    if (!payload || !Array.isArray(payload) || payload.length < 2 || !Array.isArray(payload[1])) {
      return 0;
    }

    const observations = payload[1] as WorldBankObservation[];
    for (const obs of observations) {
      const year = Number(obs.date);
      const value = obs.value;
      if (!Number.isInteger(year) || year < 1900 || year > 2200) continue;
      if (typeof value !== "number" || !Number.isFinite(value)) continue;

      const obsDate = new Date(Date.UTC(year, 6, 1, 12, 0, 0));
      const seriesId = `WB_${countryIso2.toUpperCase()}_${indicatorId.replace(/\./g, "_")}`;
      await prisma.macroIndicator.upsert({
        where: { seriesId_date: { seriesId, date: obsDate } },
        create: {
          seriesId,
          name,
          date: obsDate,
          value: new Prisma.Decimal(value),
        },
        update: {
          name,
          value: new Prisma.Decimal(value),
        },
      });
      count += 1;
    }
    log.info(
      { countryIso2, indicatorId, rows: count },
      "Série World Bank persistida (até 20 observações anuais)",
    );
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 429) {
      logRateLimit("worldBank", `${countryIso2}:${indicatorId}`, 429);
      return count;
    }
    log.error({ err, countryIso2, indicatorId }, "Falha World Bank");
  }
  return count;
}

/**
 * Ingestão Alpha Vantage (ativos configurados) + FRED (séries configuradas).
 * Tratamento explícito de HTTP 429: apenas log; a aplicação não é encerrada.
 */
export async function runMarketDataIngestion(): Promise<void> {
  await runWithIngestionRunLog("marketData", async () => {
    let rowsUpserted = 0;

    log.info("Início marketDataWorker");
    const configuredAssets = dedupeMonitoredAssets(MARKET_WORKER_ASSETS);
    const configuredSymbols = new Set(configuredAssets.map((x) => x.symbol));
    let discoveredAssets: MonitoredAsset[] = [];
    if (env.dailyParamAgentEnabled && "newsRecord" in prisma) {
      try {
        discoveredAssets = await discoverAssetsFromNewsWithGemini({
          existingSymbols: configuredSymbols,
          maxNew: env.dailyParamAgentMaxNewAssetsPerRun,
          lookback: env.dailyParamAgentNewsLookback,
        });
      } catch (err) {
        log.warn(
          { err },
          "Agente Gemini de descoberta falhou; aplicando fallback heurístico",
        );
      }
      if (discoveredAssets.length === 0) {
        discoveredAssets = await discoverAssetsFromRecentNews({
          existingSymbols: configuredSymbols,
          maxNew: env.dailyParamAgentMaxNewAssetsPerRun,
          lookback: env.dailyParamAgentNewsLookback,
        });
      }
    }
    const assetsToIngest = dedupeMonitoredAssets([...configuredAssets, ...discoveredAssets]);

    log.info(
      {
        configured: configuredAssets.length,
        discovered: discoveredAssets.length,
        total: assetsToIngest.length,
      },
      "Lista final de ativos para ingestão (com deduplicação)",
    );

    for (let i = 0; i < assetsToIngest.length; i++) {
      const cfg = assetsToIngest[i]!;
      try {
        const providers = [
          { name: "brapi" as const, fetch: () => fetchBrapiDailySeries(cfg.symbol) },
          { name: "yfinancePython" as const, fetch: () => fetchYfinancePythonDailySeries(cfg.symbol) },
          { name: "yahooFinance" as const, fetch: () => fetchYahooDailySeries(cfg.symbol) },
          { name: "stooq" as const, fetch: () => fetchStooqDailySeries(cfg.symbol) },
          { name: "alphaVantage" as const, fetch: () => fetchAlphaVantageDailySeries(cfg.symbol) },
        ];
        let sourceProvider: "brapi" | "yfinancePython" | "yahooFinance" | "stooq" | "alphaVantage" = "brapi";
        let series: PriceRow[] | null = null;

        for (let p = 0; p < providers.length; p++) {
          const current = providers[p]!;
          series = await current.fetch();
          if (series?.length) {
            sourceProvider = current.name;
            break;
          }
          if (p < providers.length - 1) {
            const next = providers[p + 1]!;
            await recordFallbackEvent({
              pipeline: "marketData",
              fromProvider: current.name,
              toProvider: next.name,
              reason: "primary_unavailable_or_quota",
              context: cfg.symbol,
            });
          }
        }
        if (!series) continue;
        for (const row of series) {
          await upsertAssetPrice(cfg.symbol, cfg.name, cfg.category, cfg.type, row.date, row.close);
          rowsUpserted += 1;
        }
        await recordIngestionItemStatus({
          jobName: "marketData",
          provider: sourceProvider,
          itemType: "asset",
          itemKey: cfg.symbol,
          status: "success",
          rowsUpserted: series.length,
        });
        log.info(
          { symbol: cfg.symbol, provider: sourceProvider, days: series.length },
          "Preços diários persistidos (série completa compact)",
        );
      } catch (err) {
        log.error({ err, symbol: cfg.symbol }, "Erro isolado Alpha Vantage / Prisma");
        await recordIngestionItemStatus({
          jobName: "marketData",
          provider: "alphaVantage",
          itemType: "asset",
          itemKey: cfg.symbol,
          status: "error",
          reason: err instanceof Error ? err.message : "unknown_error",
        });
      }
      if (i < assetsToIngest.length - 1) {
        const gap = env.brapiToken ? BRAPI_REQUEST_GAP_MS : ALPHA_VANTAGE_REQUEST_GAP_MS;
        await sleep(gap);
      }
    }

    for (const s of MARKET_WORKER_FRED_SERIES) {
      try {
        const n = await fetchAndPersistFredSeries(s.seriesId, s.name);
        rowsUpserted += n;
        await recordIngestionItemStatus({
          jobName: "marketData",
          provider: "fred",
          itemType: "macro_series",
          itemKey: s.seriesId,
          status: n > 0 ? "success" : "skipped",
          rowsUpserted: n,
        });
      } catch (err) {
        log.error({ err, seriesId: s.seriesId }, "Erro isolado FRED / Prisma");
        await recordIngestionItemStatus({
          jobName: "marketData",
          provider: "fred",
          itemType: "macro_series",
          itemKey: s.seriesId,
          status: "error",
          reason: err instanceof Error ? err.message : "unknown_error",
        });
      }
    }

    for (const cfg of MARKET_WORKER_WORLD_BANK_INDICATORS) {
      try {
        const n = await fetchAndPersistWorldBankIndicator(cfg.countryIso2, cfg.indicatorId, cfg.name);
        rowsUpserted += n;
        await recordIngestionItemStatus({
          jobName: "marketData",
          provider: "worldBank",
          itemType: "macro_series",
          itemKey: `${cfg.countryIso2}:${cfg.indicatorId}`,
          status: n > 0 ? "success" : "skipped",
          rowsUpserted: n,
        });
      } catch (err) {
        log.error({ err, cfg }, "Erro isolado World Bank / Prisma");
        await recordIngestionItemStatus({
          jobName: "marketData",
          provider: "worldBank",
          itemType: "macro_series",
          itemKey: `${cfg.countryIso2}:${cfg.indicatorId}`,
          status: "error",
          reason: err instanceof Error ? err.message : "unknown_error",
        });
      }
    }

    log.info("Fim marketDataWorker");
    return rowsUpserted;
  });
}
