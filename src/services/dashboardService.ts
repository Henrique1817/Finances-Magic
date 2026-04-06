import { Prisma } from "@prisma/client";
import { GEO_RISK_SERIES_ID, MARKET_WORKER_ASSETS } from "../config/ingestion";
import { prisma } from "../lib/prisma";

export type CurrentMacroRow = {
  seriesId: string;
  name: string;
  date: string;
  value: number;
};

export type SectorSnapshot = {
  symbol: string;
  name: string;
  date: string;
  close: number;
} | null;

export type GeoPoliticalRiskSnapshot = {
  seriesId: string;
  name: string;
  date: string;
  /** Escala 1–10. */
  score: number;
} | null;

export type DashboardCurrentStatusPayload = {
  sectors: {
    technology: SectorSnapshot;
    mining: SectorSnapshot;
    energy: SectorSnapshot;
  };
  macro: {
    /** Séries FRED e demais (exclui score de risco Code Chroma). */
    indicators: CurrentMacroRow[];
    geoPoliticalRisk: GeoPoliticalRiskSnapshot;
  };
};

export type HistoricalPricePoint = { date: string; close: number };

export type DashboardHistoricalPayload = {
  windowDays: number;
  fromDate: string;
  toDate: string;
  assetSeries: Array<{
    symbol: string;
    name: string;
    type: string;
    points: HistoricalPricePoint[];
  }>;
  geoPoliticalRisk: Array<{ date: string; score: number }>;
};

export type IngestionOpsPayload = {
  providerQuota: Array<{
    provider: string;
    window: string;
    windowStart: string;
    requests: number;
  }>;
  fallbackEvents: Array<{
    pipeline: string;
    fromProvider: string;
    toProvider: string;
    reason: string;
    createdAt: string;
  }>;
  recentItemStatus: Array<{
    jobName: string;
    provider: string;
    itemType: string;
    itemKey: string;
    status: string;
    createdAt: string;
  }>;
};

export type AiAccuracyTrendPoint = {
  ts: string;
  accuracyPct: number;
  validatedPredictions: number;
};

export type AiAccuracyByHorizon = {
  horizonDays: number;
  accuracyPct: number;
  validatedPredictions: number;
  totalPredictions: number;
  maePct: number | null;
  mapePct: number | null;
  trend: AiAccuracyTrendPoint[];
};

export type DashboardAiAccuracyPayload = {
  currentAccuracyPct: number;
  validatedPredictions: number;
  totalPredictions: number;
  trainingRows: number;
  minTrainingRows: number;
  trainingCoveragePct: number;
  trend: AiAccuracyTrendPoint[];
  byHorizon: AiAccuracyByHorizon[];
  updatedAt: string;
};

function decimalToNumber(d: Prisma.Decimal): number {
  return Number(d.toString());
}

function formatDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

const WORKER_SYMBOLS = new Set(MARKET_WORKER_ASSETS.map((a) => a.symbol));

function sectorKeyFromType(type: string): "technology" | "mining" | "energy" | null {
  if (type === "STOCK") return "technology";
  if (type === "COMMODITY") return "mining";
  if (type === "ENERGY") return "energy";
  return null;
}

/**
 * Painel atual: último preço por pilar (AAPL / COPX / XLE) + macros + risco geopolítico.
 */
export async function getDashboardCurrentStatus(): Promise<DashboardCurrentStatusPayload> {
  const assetsWithLatest = await prisma.asset.findMany({
    where: { symbol: { in: [...WORKER_SYMBOLS] } },
    orderBy: { symbol: "asc" },
    include: {
      priceHistory: {
        orderBy: { date: "desc" },
        take: 1,
      },
    },
  });

  const sectors: DashboardCurrentStatusPayload["sectors"] = {
    technology: null,
    mining: null,
    energy: null,
  };

  for (const a of assetsWithLatest) {
    const row = a.priceHistory[0];
    if (!row) continue;
    const key = sectorKeyFromType(a.type);
    if (!key) continue;
    sectors[key] = {
      symbol: a.symbol,
      name: a.name,
      date: formatDateOnly(row.date),
      close: decimalToNumber(row.close),
    };
  }

  const macroRows = await prisma.$queryRaw<
    Array<{
      seriesId: string;
      name: string;
      date: Date;
      value: Prisma.Decimal;
    }>
  >`
    SELECT DISTINCT ON ("seriesId") "seriesId", name, date, value
    FROM macro_indicators
    ORDER BY "seriesId", date DESC
  `;

  let geoPoliticalRisk: GeoPoliticalRiskSnapshot = null;
  const indicators: CurrentMacroRow[] = [];

  for (const m of macroRows) {
    if (m.seriesId === GEO_RISK_SERIES_ID) {
      geoPoliticalRisk = {
        seriesId: m.seriesId,
        name: m.name,
        date: formatDateOnly(m.date),
        score: decimalToNumber(m.value),
      };
    } else {
      indicators.push({
        seriesId: m.seriesId,
        name: m.name,
        date: formatDateOnly(m.date),
        value: decimalToNumber(m.value),
      });
    }
  }

  return {
    sectors,
    macro: { indicators, geoPoliticalRisk },
  };
}

/**
 * Últimos N dias: preços dos ativos principais + série de risco geopolítico.
 */
export async function getDashboardHistorical(windowDays = 30): Promise<DashboardHistoricalPayload> {
  const toDate = startOfUtcDay(new Date());
  const fromDate = new Date(toDate);
  fromDate.setUTCDate(fromDate.getUTCDate() - windowDays);

  const assets = await prisma.asset.findMany({
    where: { symbol: { in: [...WORKER_SYMBOLS] } },
    orderBy: { symbol: "asc" },
    include: {
      priceHistory: {
        where: { date: { gte: fromDate, lte: toDate } },
        orderBy: { date: "asc" },
      },
    },
  });

  const assetSeries = assets.map((a) => ({
    symbol: a.symbol,
    name: a.name,
    type: a.type,
    points: a.priceHistory.map((h) => ({
      date: formatDateOnly(h.date),
      close: decimalToNumber(h.close),
    })),
  }));

  const geoRows = await prisma.macroIndicator.findMany({
    where: {
      seriesId: GEO_RISK_SERIES_ID,
      date: { gte: fromDate, lte: toDate },
    },
    orderBy: { date: "asc" },
  });

  const geoPoliticalRisk = geoRows.map((r) => ({
    date: formatDateOnly(r.date),
    score: decimalToNumber(r.value),
  }));

  return {
    windowDays,
    fromDate: formatDateOnly(fromDate),
    toDate: formatDateOnly(toDate),
    assetSeries,
    geoPoliticalRisk,
  };
}

export async function getIngestionOpsDashboard(): Promise<IngestionOpsPayload> {
  const [quota, fallbacks, statuses] = await Promise.all([
    prisma.apiQuotaCounter.findMany({
      orderBy: { windowStart: "desc" },
      take: 120,
      select: { provider: true, window: true, windowStart: true, requests: true },
    }),
    prisma.providerFallbackEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { pipeline: true, fromProvider: true, toProvider: true, reason: true, createdAt: true },
    }),
    prisma.ingestionItemStatus.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { jobName: true, provider: true, itemType: true, itemKey: true, status: true, createdAt: true },
    }),
  ]);

  return {
    providerQuota: quota.map((q) => ({
      provider: q.provider,
      window: q.window,
      windowStart: formatDateOnly(q.windowStart),
      requests: q.requests,
    })),
    fallbackEvents: fallbacks.map((f) => ({
      pipeline: f.pipeline,
      fromProvider: f.fromProvider,
      toProvider: f.toProvider,
      reason: f.reason,
      createdAt: f.createdAt.toISOString(),
    })),
    recentItemStatus: statuses.map((s) => ({
      jobName: s.jobName,
      provider: s.provider,
      itemType: s.itemType,
      itemKey: s.itemKey,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
    })),
  };
}

const AI_ACCURACY_MIN_TRAINING_ROWS = 50_000;
const AI_ACCURACY_HORIZONS = [7, 30] as const;

export async function getDashboardAiAccuracy(): Promise<DashboardAiAccuracyPayload> {
  const [evaluatedRows, totalsByHorizon, assetPriceRows, macroRows, climateRows, newsRows] = await Promise.all([
    prisma.scenarioOutcome.findMany({
      where: { status: "evaluated", horizonDays: { in: [...AI_ACCURACY_HORIZONS] } },
      orderBy: { evaluatedAt: "asc" },
      select: {
        horizonDays: true,
        evaluatedAt: true,
        directionHit: true,
        absoluteError: true,
        absolutePctError: true,
      },
    }),
    prisma.scenarioOutcome.groupBy({
      by: ["horizonDays"],
      where: { horizonDays: { in: [...AI_ACCURACY_HORIZONS] } },
      _count: { _all: true },
    }),
    prisma.assetPriceHistory.count(),
    prisma.macroIndicator.count(),
    prisma.climateObservation.count(),
    prisma.newsRecord.count(),
  ]);

  const trainingRows = assetPriceRows + macroRows + climateRows + newsRows;
  const trainingCoveragePct = Math.min(100, (trainingRows / AI_ACCURACY_MIN_TRAINING_ROWS) * 100);

  if (evaluatedRows.length === 0) {
    return {
      currentAccuracyPct: 0,
      validatedPredictions: 0,
      totalPredictions: totalsByHorizon.reduce((sum, x) => sum + x._count._all, 0),
      trainingRows,
      minTrainingRows: AI_ACCURACY_MIN_TRAINING_ROWS,
      trainingCoveragePct,
      trend: [],
      byHorizon: AI_ACCURACY_HORIZONS.map((horizonDays) => ({
        horizonDays,
        accuracyPct: 0,
        validatedPredictions: 0,
        totalPredictions: totalsByHorizon.find((x) => x.horizonDays === horizonDays)?._count._all ?? 0,
        maePct: null,
        mapePct: null,
        trend: [],
      })),
      updatedAt: new Date().toISOString(),
    };
  }

  const byHorizon: AiAccuracyByHorizon[] = [];
  for (const horizon of AI_ACCURACY_HORIZONS) {
    const rows = evaluatedRows.filter((r) => r.horizonDays === horizon);
    let hits = 0;
    let valids = 0;
    let sumAbsError = 0;
    let sumAbsPctError = 0;
    let absPctCount = 0;
    const trend: AiAccuracyTrendPoint[] = [];

    for (const r of rows) {
      if (r.directionHit !== null) {
        valids += 1;
        if (r.directionHit) hits += 1;
      }
      if (r.absoluteError !== null) sumAbsError += Number(r.absoluteError);
      if (r.absolutePctError !== null) {
        sumAbsPctError += Number(r.absolutePctError);
        absPctCount += 1;
      }
      if (r.evaluatedAt && valids > 0) {
        trend.push({
          ts: r.evaluatedAt.toISOString(),
          accuracyPct: (hits / valids) * 100,
          validatedPredictions: valids,
        });
      }
    }

    byHorizon.push({
      horizonDays: horizon,
      accuracyPct: valids > 0 ? (hits / valids) * 100 : 0,
      validatedPredictions: valids,
      totalPredictions: totalsByHorizon.find((x) => x.horizonDays === horizon)?._count._all ?? 0,
      maePct: rows.length > 0 ? (sumAbsError / rows.length) * 100 : null,
      mapePct: absPctCount > 0 ? (sumAbsPctError / absPctCount) * 100 : null,
      trend: trend.slice(-40),
    });
  }

  const validatedPredictions = byHorizon.reduce((sum, h) => sum + h.validatedPredictions, 0);
  const currentAccuracyPct =
    validatedPredictions > 0
      ? byHorizon.reduce((sum, h) => sum + h.accuracyPct * h.validatedPredictions, 0) / validatedPredictions
      : 0;
  const defaultTrend = byHorizon.find((h) => h.horizonDays === 7)?.trend ?? [];

  return {
    currentAccuracyPct,
    validatedPredictions,
    totalPredictions: totalsByHorizon.reduce((sum, x) => sum + x._count._all, 0),
    trainingRows,
    minTrainingRows: AI_ACCURACY_MIN_TRAINING_ROWS,
    trainingCoveragePct,
    trend: defaultTrend,
    byHorizon,
    updatedAt: new Date().toISOString(),
  };
}
