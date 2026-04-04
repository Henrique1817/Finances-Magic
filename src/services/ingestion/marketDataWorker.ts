import { Prisma, type AssetType } from "@prisma/client";
import axios, { isAxiosError } from "axios";
import { ALPHA_VANTAGE_REQUEST_GAP_MS, MARKET_WORKER_ASSETS, MARKET_WORKER_FRED_SERIES } from "../../config/ingestion";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { sleep } from "../../lib/sleep";

const log = logger.child({ worker: "marketData" });

const ALPHA_URL = "https://www.alphavantage.co/query";
const FRED_OBS_URL = "https://api.stlouisfed.org/fred/series/observations";

type TimeSeriesDaily = Record<string, Record<string, string>>;

function parseTradeDate(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T12:00:00.000Z`);
}

function latestCloseFromDailySeries(series: TimeSeriesDaily | undefined): { date: string; close: string } | null {
  if (!series || typeof series !== "object") return null;
  const dates = Object.keys(series).sort((a, b) => b.localeCompare(a));
  for (const d of dates) {
    const row = series[d];
    const close = row?.["4. close"];
    if (close && close !== "null") return { date: d, close };
  }
  return null;
}

/** Mock determinístico para desenvolvimento / ausência de chave (não chama rede). */
function mockLatestDailyClose(symbol: string): { date: string; close: string } {
  const date = new Date().toISOString().slice(0, 10);
  const seed = [...symbol].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const close = (100 + (seed % 80) + symbol.length * 0.37).toFixed(4);
  return { date, close };
}

function logRateLimit(provider: string, context: string, status?: number): void {
  log.warn({ provider, context, status }, "Rate limit (HTTP 429) — pulando sem interromper o worker");
}

async function fetchAlphaVantageDaily(symbol: string): Promise<{ date: string; close: string } | null> {
  if (env.alphaVantageUseMock || !env.alphaVantageApiKey) {
    if (!env.alphaVantageApiKey && !env.alphaVantageUseMock) {
      log.warn("ALPHA_VANTAGE_API_KEY ausente — usando mock de fechamento diário");
    }
    return mockLatestDailyClose(symbol);
  }

  try {
    const { data, status } = await axios.get<Record<string, unknown>>(ALPHA_URL, {
      params: {
        function: "TIME_SERIES_DAILY",
        symbol,
        outputsize: "compact",
        apikey: env.alphaVantageApiKey,
      },
      validateStatus: () => true,
    });

    if (status === 429) {
      logRateLimit("alphaVantage", symbol, status);
      return null;
    }
    if (status >= 400) {
      log.error({ symbol, status }, "Alpha Vantage HTTP erro");
      return null;
    }

    if (typeof data["Note"] === "string") {
      log.warn({ symbol, note: data["Note"] }, "Alpha Vantage limite/throttle (Note)");
      return null;
    }
    if (typeof data["Error Message"] === "string") {
      log.error({ symbol, message: data["Error Message"] }, "Alpha Vantage erro de API");
      return null;
    }

    const series = data["Time Series (Daily)"] as TimeSeriesDaily | undefined;
    return latestCloseFromDailySeries(series);
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 429) {
      logRateLimit("alphaVantage", symbol, 429);
      return null;
    }
    log.error({ err, symbol }, "Falha de rede Alpha Vantage");
    return null;
  }
}

async function upsertAssetPrice(symbol: string, name: string, type: AssetType, date: string, close: string): Promise<void> {
  const tradeDate = parseTradeDate(date);
  const closeDec = new Prisma.Decimal(close);

  const asset = await prisma.asset.upsert({
    where: { symbol },
    create: { symbol, name, type },
    update: { name, type },
  });

  await prisma.assetPriceHistory.upsert({
    where: { assetId_date: { assetId: asset.id, date: tradeDate } },
    create: { assetId: asset.id, date: tradeDate, close: closeDec },
    update: { close: closeDec },
  });

  log.info({ symbol, date, close }, "Preço diário persistido");
}

type FredObservation = { date: string; value: string };

function parseObsDate(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T12:00:00.000Z`);
}

function latestValidObservation(observations: FredObservation[] | undefined): FredObservation | null {
  if (!Array.isArray(observations)) return null;
  const sorted = [...observations].sort((a, b) => b.date.localeCompare(a.date));
  for (const o of sorted) {
    if (o.value && o.value !== ".") return o;
  }
  return null;
}

async function fetchAndPersistFredSeries(seriesId: string, name: string): Promise<void> {
  const key = env.fredApiKey;
  if (!key) {
    log.warn("FRED_API_KEY ausente — bloco FRED ignorado");
    return;
  }

  try {
    const { data, status } = await axios.get<{
      error_message?: string;
      observations?: FredObservation[];
    }>(FRED_OBS_URL, {
      params: {
        series_id: seriesId,
        api_key: key,
        file_type: "json",
        sort_order: "desc",
        limit: 100,
      },
      validateStatus: () => true,
    });

    if (status === 429) {
      logRateLimit("fred", seriesId, status);
      return;
    }
    if (status >= 400) {
      log.error({ seriesId, status }, "FRED HTTP erro");
      return;
    }

    if (data.error_message) {
      log.error({ seriesId, message: data.error_message }, "FRED erro de API");
      return;
    }

    const latest = latestValidObservation(data.observations);
    if (!latest) {
      log.error({ seriesId }, "FRED sem observação válida");
      return;
    }

    const obsDate = parseObsDate(latest.date);
    const value = new Prisma.Decimal(latest.value);

    await prisma.macroIndicator.upsert({
      where: { seriesId_date: { seriesId, date: obsDate } },
      create: { seriesId, name, date: obsDate, value },
      update: { name, value },
    });

    log.info({ seriesId, date: latest.date, value: latest.value }, "Indicador FRED persistido");
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 429) {
      logRateLimit("fred", seriesId, 429);
      return;
    }
    log.error({ err, seriesId }, "Falha FRED");
  }
}

/**
 * Ingestão Alpha Vantage (3 ativos) + FRED (taxa Fed + preço energia via WTI).
 * Tratamento explícito de HTTP 429: apenas log; a aplicação não é encerrada.
 */
export async function runMarketDataIngestion(): Promise<void> {
  log.info("Início marketDataWorker");

  for (let i = 0; i < MARKET_WORKER_ASSETS.length; i++) {
    const cfg = MARKET_WORKER_ASSETS[i]!;
    try {
      const latest = await fetchAlphaVantageDaily(cfg.symbol);
      if (!latest) continue;
      await upsertAssetPrice(cfg.symbol, cfg.name, cfg.type, latest.date, latest.close);
    } catch (err) {
      log.error({ err, symbol: cfg.symbol }, "Erro isolado Alpha Vantage / Prisma");
    }
    if (i < MARKET_WORKER_ASSETS.length - 1) await sleep(ALPHA_VANTAGE_REQUEST_GAP_MS);
  }

  for (const series of MARKET_WORKER_FRED_SERIES) {
    try {
      await fetchAndPersistFredSeries(series.seriesId, series.name);
    } catch (err) {
      log.error({ err, seriesId: series.seriesId }, "Erro isolado FRED / Prisma");
    }
  }

  log.info("Fim marketDataWorker");
}
