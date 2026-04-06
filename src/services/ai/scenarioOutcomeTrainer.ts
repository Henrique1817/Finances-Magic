import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

const TRAIN_HORIZONS = [7, 30] as const;
const DEADZONE = 0.001;
const SCAN_LIMIT = 300;

type QuantPerLine = {
  walletAssetId?: string;
  assetSymbol?: string | null;
  combinedReturnDecimal?: number;
};

type ScenarioResultLike = {
  quant?: {
    perLine?: QuantPerLine[];
  };
};

function toUtcDateOnly(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function addUtcDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function signWithDeadzone(v: number): -1 | 0 | 1 {
  if (v > DEADZONE) return 1;
  if (v < -DEADZONE) return -1;
  return 0;
}

export async function runScenarioOutcomeTraining(): Promise<{
  scannedScenarios: number;
  upsertedOutcomes: number;
  evaluatedOutcomes: number;
}> {
  const scenarios = await prisma.scenario.findMany({
    orderBy: { createdAt: "desc" },
    take: SCAN_LIMIT,
    select: { id: true, createdAt: true, resultJson: true },
  });

  const scannedScenarios = scenarios.length;
  let upsertedOutcomes = 0;
  let evaluatedOutcomes = 0;

  const symbols = new Set<string>();
  for (const s of scenarios) {
    const payload = s.resultJson as ScenarioResultLike;
    const lines = Array.isArray(payload?.quant?.perLine) ? payload.quant.perLine : [];
    for (const line of lines) {
      const symbol = typeof line.assetSymbol === "string" ? line.assetSymbol.trim().toUpperCase() : "";
      if (symbol) symbols.add(symbol);
    }
  }

  const assets = await prisma.asset.findMany({
    where: { symbol: { in: [...symbols] } },
    select: { id: true, symbol: true },
  });
  const assetIdBySymbol = new Map(assets.map((a) => [a.symbol.toUpperCase(), a.id]));
  const baselineCloseCache = new Map<string, number | null>();
  const targetCloseCache = new Map<string, number | null>();

  for (const s of scenarios) {
    const payload = s.resultJson as ScenarioResultLike;
    const lines = Array.isArray(payload?.quant?.perLine) ? payload.quant.perLine : [];
    const scenarioDate = toUtcDateOnly(s.createdAt);

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx]!;
      const symbol = typeof line.assetSymbol === "string" ? line.assetSymbol.trim().toUpperCase() : "";
      const predictedReturn =
        typeof line.combinedReturnDecimal === "number" ? line.combinedReturnDecimal : NaN;
      if (!symbol || !Number.isFinite(predictedReturn)) continue;

      const assetId = assetIdBySymbol.get(symbol);
      if (!assetId) continue;

      const baselineKey = `${assetId}:${scenarioDate.toISOString().slice(0, 10)}`;
      let baselineClose = baselineCloseCache.get(baselineKey);
      if (typeof baselineClose === "undefined") {
        const baselineRow = await prisma.assetPriceHistory.findFirst({
          where: { assetId, date: { lte: scenarioDate } },
          orderBy: { date: "desc" },
          select: { close: true, date: true },
        });
        baselineClose = baselineRow ? Number(baselineRow.close) : null;
        baselineCloseCache.set(baselineKey, baselineClose);
      }
      if (baselineClose === null || !Number.isFinite(baselineClose) || baselineClose <= 0) continue;

      for (const horizon of TRAIN_HORIZONS) {
        const targetDate = toUtcDateOnly(addUtcDays(scenarioDate, horizon));
        const rowKey = `${s.id}:${line.walletAssetId ?? symbol}:${idx}:${horizon}`;
        await prisma.scenarioOutcome.upsert({
          where: { outcomeKey: rowKey },
          create: {
            outcomeKey: rowKey,
            scenarioId: s.id,
            walletAssetId: line.walletAssetId ?? null,
            assetSymbol: symbol,
            horizonDays: horizon,
            predictedReturn: new Prisma.Decimal(predictedReturn),
            predictedDirection: signWithDeadzone(predictedReturn),
            baselineDate: scenarioDate,
            baselineClose: new Prisma.Decimal(baselineClose),
            targetDate,
            status: "pending",
          },
          update: {
            predictedReturn: new Prisma.Decimal(predictedReturn),
            predictedDirection: signWithDeadzone(predictedReturn),
            baselineDate: scenarioDate,
            baselineClose: new Prisma.Decimal(baselineClose),
            targetDate,
          },
        });
        upsertedOutcomes += 1;
      }
    }
  }

  const today = toUtcDateOnly(new Date());
  const pending = await prisma.scenarioOutcome.findMany({
    where: {
      status: "pending",
      targetDate: { lte: today },
    },
    orderBy: { targetDate: "asc" },
    take: 2000,
    select: {
      id: true,
      assetSymbol: true,
      targetDate: true,
      baselineClose: true,
      predictedReturn: true,
      predictedDirection: true,
      horizonDays: true,
    },
  });

  const pendingSymbols = [...new Set(pending.map((p) => p.assetSymbol))];
  const pendingAssets = await prisma.asset.findMany({
    where: { symbol: { in: pendingSymbols } },
    select: { id: true, symbol: true },
  });
  const pendingAssetIdBySymbol = new Map(pendingAssets.map((a) => [a.symbol, a.id]));

  for (const row of pending) {
    const assetId = pendingAssetIdBySymbol.get(row.assetSymbol);
    if (!assetId) continue;
    const targetKey = `${assetId}:${row.targetDate.toISOString().slice(0, 10)}`;
    let targetClose = targetCloseCache.get(targetKey);
    if (typeof targetClose === "undefined") {
      const target = await prisma.assetPriceHistory.findFirst({
        where: { assetId, date: { lte: row.targetDate } },
        orderBy: { date: "desc" },
        select: { close: true },
      });
      targetClose = target ? Number(target.close) : null;
      targetCloseCache.set(targetKey, targetClose);
    }
    if (targetClose === null || !Number.isFinite(targetClose) || targetClose <= 0) continue;

    const base = Number(row.baselineClose);
    if (!Number.isFinite(base) || base <= 0) continue;
    const actualReturn = (targetClose - base) / base;
    const actualDirection = signWithDeadzone(actualReturn);
    const directionHit = actualDirection !== 0 && row.predictedDirection !== 0
      ? actualDirection === row.predictedDirection
      : null;
    const pred = Number(row.predictedReturn);
    const absError = Math.abs(actualReturn - pred);
    const absPctError = Math.abs(actualReturn) > 1e-9 ? absError / Math.abs(actualReturn) : null;

    await prisma.scenarioOutcome.update({
      where: { id: row.id },
      data: {
        actualReturn: new Prisma.Decimal(actualReturn),
        actualDirection,
        directionHit,
        absoluteError: new Prisma.Decimal(absError),
        absolutePctError: absPctError === null ? null : new Prisma.Decimal(absPctError),
        status: "evaluated",
        evaluatedAt: new Date(),
      },
    });
    evaluatedOutcomes += 1;
  }

  return { scannedScenarios, upsertedOutcomes, evaluatedOutcomes };
}
