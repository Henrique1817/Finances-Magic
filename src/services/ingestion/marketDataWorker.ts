import { Prisma, type AssetType } from "@prisma/client";
import axios, { isAxiosError } from "axios";
import { ALPHA_VANTAGE_REQUEST_GAP_MS, MARKET_WORKER_ASSETS, MARKET_WORKER_FRED_SERIES } from "../../config/ingestion";
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
const FRED_OBS_URL = "https://api.stlouisfed.org/fred/series/observations";
const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

type TimeSeriesDaily = Record<string, Record<string, string>>;

function parseTradeDate(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T12:00:00.000Z`);
}

/** Todas as datas com fechamento válido, mais recente primeiro. */
function allClosesFromDailySeries(series: TimeSeriesDaily | undefined): { date: string; close: string }[] {
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

async function fetchAlphaVantageDailySeries(symbol: string): Promise<{ date: string; close: string }[] | null> {
  if (env.alphaVantageUseMock || !env.alphaVantageApiKey) {
    if (!env.alphaVantageApiKey && !env.alphaVantageUseMock) {
      log.warn("ALPHA_VANTAGE_API_KEY ausente — usando série mock de fechamentos diários");
    }
    return mockDailyCloses(symbol);
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

async function fetchYahooDailySeries(symbol: string): Promise<{ date: string; close: string }[] | null> {
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
    const out: { date: string; close: string }[] = [];
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
      logRateLimit("alphaVantage", symbol, 429);
      return null;
    }
    log.error({ err, symbol }, "Falha ao consultar fallback Yahoo Finance");
    return null;
  }
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

/**
 * Ingestão Alpha Vantage (ativos configurados) + FRED (séries configuradas).
 * Tratamento explícito de HTTP 429: apenas log; a aplicação não é encerrada.
 */
export async function runMarketDataIngestion(): Promise<void> {
  await runWithIngestionRunLog("marketData", async () => {
    let rowsUpserted = 0;

    log.info("Início marketDataWorker");

    for (let i = 0; i < MARKET_WORKER_ASSETS.length; i++) {
      const cfg = MARKET_WORKER_ASSETS[i]!;
      try {
        let sourceProvider = "alphaVantage";
        let series = await fetchAlphaVantageDailySeries(cfg.symbol);
        if (!series) {
          await recordFallbackEvent({
            pipeline: "marketData",
            fromProvider: "alphaVantage",
            toProvider: "yahooFinance",
            reason: "primary_unavailable_or_quota",
            context: cfg.symbol,
          });
          sourceProvider = "yahooFinance";
          series = await fetchYahooDailySeries(cfg.symbol);
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
      if (i < MARKET_WORKER_ASSETS.length - 1) await sleep(ALPHA_VANTAGE_REQUEST_GAP_MS);
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

    log.info("Fim marketDataWorker");
    return rowsUpserted;
  });
}
