import { Prisma } from "@prisma/client";
import axios, { isAxiosError } from "axios";
import { env } from "../../config/env";
import { runWithIngestionRunLog } from "../../lib/ingestionRun";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { sleep } from "../../lib/sleep";
import { floorUtcToIntervalMs } from "./timeBuckets";
import {
  canUseProvider,
  markProvider429,
  recordIngestionItemStatus,
  withRetry,
} from "./quotaPlanner";

const log = logger.child({ worker: "referencedAssetPrice" });
const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const THIRTY_MIN_MS = 30 * 60 * 1000;

type YahooBar = {
  bucketStart: Date;
  close: string;
  open?: string;
  high?: string;
  low?: string;
  volume?: string;
};

async function fetchYahoo30mLastBar(symbol: string): Promise<YahooBar | null> {
  const providerCheck = canUseProvider("yahooFinance");
  if (!providerCheck.ok) return null;

  try {
    const url = `${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}`;
    const nowSec = Math.floor(Date.now() / 1000);
    const period1 = nowSec - 7 * 24 * 3600;
    const result = await withRetry("yahooFinance", async () => {
      const { data, status } = await axios.get<{
        chart?: {
          result?: Array<{
            timestamp?: number[];
            indicators?: {
              quote?: Array<{
                close?: Array<number | null>;
                open?: Array<number | null>;
                high?: Array<number | null>;
                low?: Array<number | null>;
                volume?: Array<number | null>;
              }>;
            };
          }>;
          error?: { code?: string; description?: string };
        };
      }>(url, {
        params: {
          period1,
          period2: nowSec,
          interval: "30m",
          events: "history",
        },
        validateStatus: () => true,
      });
      if (status === 429) {
        markProvider429("yahooFinance");
        throw new Error("yahoo_429");
      }
      if (status >= 400) throw new Error(`yahoo_http_${status}`);
      if (data.chart?.error) {
        throw new Error(`yahoo_error_${data.chart.error.code ?? "unknown"}`);
      }
      return data;
    });
    if (!result) return null;

    const first = result.chart?.result?.[0];
    const ts = first?.timestamp ?? [];
    const quote = first?.indicators?.quote?.[0];
    const closes = quote?.close ?? [];
    const opens = quote?.open ?? [];
    const highs = quote?.high ?? [];
    const lows = quote?.low ?? [];
    const vols = quote?.volume ?? [];

    for (let i = ts.length - 1; i >= 0; i--) {
      const c = closes[i];
      if (c == null || !Number.isFinite(c) || c <= 0) continue;
      const tSec = ts[i];
      if (tSec == null) continue;
      const bucketStart = floorUtcToIntervalMs(new Date(tSec * 1000), THIRTY_MIN_MS);
      const o = opens[i];
      const h = highs[i];
      const low = lows[i];
      const v = vols[i];
      return {
        bucketStart,
        close: Number(c).toFixed(8),
        open: o != null && Number.isFinite(o) ? Number(o).toFixed(8) : undefined,
        high: h != null && Number.isFinite(h) ? Number(h).toFixed(8) : undefined,
        low: low != null && Number.isFinite(low) ? Number(low).toFixed(8) : undefined,
        volume: v != null && Number.isFinite(v) ? String(v) : undefined,
      };
    }
    return null;
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 429) {
      logRateLimit(symbol);
      return null;
    }
    log.error({ err, symbol }, "Falha ao obter série 30m Yahoo (ativos referenciados)");
    return null;
  }
}

function logRateLimit(symbol: string): void {
  log.warn({ symbol }, "Yahoo Finance 429 — barra 30m ignorada");
}

/**
 * Sincroniza `referenced_asset_usage` com `wallet_assets` (asset_id não nulo).
 */
async function syncReferencedAssetUsage(): Promise<void> {
  const grouped = await prisma.walletAsset.groupBy({
    by: ["assetId"],
    where: { assetId: { not: null } },
    _count: { _all: true },
  });

  const activeIds = new Set<string>();
  for (const g of grouped) {
    if (g.assetId) activeIds.add(g.assetId);
  }

  if (activeIds.size === 0) {
    await prisma.referencedAssetUsage.deleteMany();
    return;
  }

  for (const g of grouped) {
    if (!g.assetId) continue;
    await prisma.referencedAssetUsage.upsert({
      where: { assetId: g.assetId },
      create: { assetId: g.assetId, referenceCount: g._count._all },
      update: { referenceCount: g._count._all },
    });
  }

  await prisma.referencedAssetUsage.deleteMany({
    where: { assetId: { notIn: [...activeIds] } },
  });
}

/**
 * Atualiza cotações intradiárias (Yahoo, barra 30m) só para ativos ligados a carteiras.
 * Respeita intervalo mínimo por ativo (`lastPriceSnapshotAt`) e quota `yahooFinance`.
 */
export async function runReferencedAssetPriceIngestion(): Promise<void> {
  if (!env.userAssetPriceIngestEnabled) {
    log.debug("Worker de cotações referenciadas desativado (USER_ASSET_PRICE_INGEST_ENABLED=false)");
    return;
  }

  await runWithIngestionRunLog("referencedAssetPrice", async () => {
    await syncReferencedAssetUsage();

    const usageRows = await prisma.referencedAssetUsage.findMany({
      include: {
        asset: { select: { id: true, symbol: true, lastPriceSnapshotAt: true } },
      },
    });

    if (usageRows.length === 0) {
      log.info("Nenhum ativo referenciado em carteiras — sem pedidos à API.");
      return 0;
    }

    const cutoff = new Date(Date.now() - env.userAssetPriceMinIntervalMs);
    const due = usageRows
      .filter((r) => {
        const la = r.asset.lastPriceSnapshotAt;
        return la == null || la < cutoff;
      })
      .sort((a, b) => {
        const ta = a.asset.lastPriceSnapshotAt?.getTime() ?? 0;
        const tb = b.asset.lastPriceSnapshotAt?.getTime() ?? 0;
        return ta - tb;
      })
      .slice(0, env.userAssetPriceMaxPerRun);

    if (due.length === 0) {
      log.info(
        { tracked: usageRows.length, minIntervalMs: env.userAssetPriceMinIntervalMs },
        "Nenhum ativo em janela de atualização",
      );
      return 0;
    }

    let rowsUpserted = 0;

    for (let i = 0; i < due.length; i++) {
      const row = due[i]!;
      const symbol = row.asset.symbol;
      const bar = await fetchYahoo30mLastBar(symbol);
      if (!bar) {
        await recordIngestionItemStatus({
          jobName: "referencedAssetPrice",
          provider: "yahooFinance",
          itemType: "asset",
          itemKey: symbol,
          status: "skipped",
          reason: "no_data_or_quota",
        });
      } else {
        const closeDec = new Prisma.Decimal(bar.close);
        await prisma.assetPriceSnapshot.upsert({
          where: {
            assetId_bucketStart: { assetId: row.asset.id, bucketStart: bar.bucketStart },
          },
          create: {
            assetId: row.asset.id,
            bucketStart: bar.bucketStart,
            close: closeDec,
            open: bar.open ? new Prisma.Decimal(bar.open) : undefined,
            high: bar.high ? new Prisma.Decimal(bar.high) : undefined,
            low: bar.low ? new Prisma.Decimal(bar.low) : undefined,
            volume: bar.volume ? new Prisma.Decimal(bar.volume) : undefined,
            source: "yahoo_finance_30m",
          },
          update: {
            close: closeDec,
            open: bar.open ? new Prisma.Decimal(bar.open) : undefined,
            high: bar.high ? new Prisma.Decimal(bar.high) : undefined,
            low: bar.low ? new Prisma.Decimal(bar.low) : undefined,
            volume: bar.volume ? new Prisma.Decimal(bar.volume) : undefined,
            source: "yahoo_finance_30m",
          },
        });

        await prisma.asset.update({
          where: { id: row.asset.id },
          data: { lastPriceSnapshotAt: new Date() },
        });
        rowsUpserted += 1;
        await recordIngestionItemStatus({
          jobName: "referencedAssetPrice",
          provider: "yahooFinance",
          itemType: "asset",
          itemKey: symbol,
          status: "success",
          rowsUpserted: 1,
        });
        log.info({ symbol, bucket: bar.bucketStart.toISOString() }, "Snapshot 30m persistido");
      }

      if (i < due.length - 1) {
        await sleep(env.userAssetPriceRequestGapMs);
      }
    }

    return rowsUpserted;
  });
}
