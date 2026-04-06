import { prisma } from "../../lib/prisma";
import type { WalletLineWithAsset } from "./scenarioContextBuilder";

export const WINDOW_DAYS = 60;

export type QuantFactorRequest = {
  catalogId: string;
  shockPercent: number;
};

export type QuantLineImpact = {
  walletAssetId: string;
  nome: string;
  assetSymbol: string | null;
  betaByFactor: Record<string, number>;
  combinedReturnDecimal: number;
  lineBaselineValue: number;
  lineProjectedValue: number;
};

export type QuantScenarioResult = {
  baselineValue: number;
  projectedPortfolioValue: number;
  portfolioReturnDecimal: number;
  perLine: QuantLineImpact[];
  dataGaps: string[];
  dataAsOf: Record<string, string>;
};

const MAX_LINE_RETURN_ABS = 0.5;

function mean(a: number[]): number {
  if (a.length === 0) return 0;
  return a.reduce((s, x) => s + x, 0) / a.length;
}

function covarianceSample(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;
  const mx = mean(x);
  const my = mean(y);
  let s = 0;
  for (let i = 0; i < x.length; i++) s += (x[i]! - mx) * (y[i]! - my);
  return s / x.length;
}

function varianceSample(y: number[]): number {
  if (y.length < 2) return 0;
  const my = mean(y);
  return y.reduce((acc, v) => acc + (v - my) ** 2, 0) / y.length;
}

function betaLineVsFactor(lineR: number[], factorR: number[]): number {
  const v = varianceSample(factorR);
  if (v < 1e-14) return 0;
  return covarianceSample(lineR, factorR) / v;
}

/** Expõe `cov/var` sobre retornos já alinhados (testes). */
export function estimateBetaFromAlignedReturns(lineReturns: number[], factorReturns: number[]): number {
  return betaLineVsFactor(lineReturns, factorReturns);
}

function buildLevelsReturns(
  dates: Date[],
  values: number[],
): { byDate: Map<string, number>; lastDate: string | null } {
  const byDate = new Map<string, number>();
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1]!;
    const cur = values[i]!;
    const r = prev === 0 ? 0 : (cur - prev) / prev;
    const key = dates[i]!.toISOString().slice(0, 10);
    byDate.set(key, r);
  }
  const lastDate = dates.length > 0 ? dates[dates.length - 1]!.toISOString().slice(0, 10) : null;
  return { byDate, lastDate };
}

function alignMaps(fMap: Map<string, number>, lMap: Map<string, number>): { f: number[]; l: number[] } {
  const keys = [...fMap.keys()].filter((k) => lMap.has(k)).sort();
  return {
    f: keys.map((k) => fMap.get(k)!),
    l: keys.map((k) => lMap.get(k)!),
  };
}

async function loadMacroReturns(seriesId: string, maxPoints: number): Promise<{
  byDate: Map<string, number>;
  dataAsOf: string | null;
}> {
  const rows = await prisma.macroIndicator.findMany({
    where: { seriesId },
    orderBy: { date: "desc" },
    take: maxPoints,
    select: { date: true, value: true },
  });
  if (rows.length < 2) {
    return { byDate: new Map(), dataAsOf: null };
  }
  const asc = [...rows].reverse();
  const dates = asc.map((r) => r.date);
  const values = asc.map((r) => Number(r.value));
  const { byDate, lastDate } = buildLevelsReturns(dates, values);
  return { byDate, dataAsOf: lastDate };
}

async function loadAssetReturnsBySymbol(symbol: string, maxPoints: number): Promise<{
  byDate: Map<string, number>;
  dataAsOf: string | null;
}> {
  const asset = await prisma.asset.findUnique({
    where: { symbol },
    select: { id: true },
  });
  if (!asset) {
    return { byDate: new Map(), dataAsOf: null };
  }

  const rows = await prisma.assetPriceHistory.findMany({
    where: { assetId: asset.id },
    orderBy: { date: "desc" },
    take: maxPoints,
    select: { date: true, close: true },
  });
  if (rows.length < 2) {
    return { byDate: new Map(), dataAsOf: null };
  }
  const asc = [...rows].reverse();
  const dates = asc.map((r) => r.date);
  const values = asc.map((r) => Number(r.close));
  const { byDate, lastDate } = buildLevelsReturns(dates, values);
  return { byDate, dataAsOf: lastDate };
}

async function loadAssetReturnsForAssetId(assetId: string, maxPoints: number): Promise<{
  byDate: Map<string, number>;
  dataAsOf: string | null;
}> {
  const rows = await prisma.assetPriceHistory.findMany({
    where: { assetId },
    orderBy: { date: "desc" },
    take: maxPoints,
    select: { date: true, close: true },
  });
  if (rows.length < 2) {
    return { byDate: new Map(), dataAsOf: null };
  }
  const asc = [...rows].reverse();
  const dates = asc.map((r) => r.date);
  const values = asc.map((r) => Number(r.close));
  const { byDate, lastDate } = buildLevelsReturns(dates, values);
  return { byDate, dataAsOf: lastDate };
}

function parseCatalogId(catalogId: string):
  | { type: "macro"; seriesId: string }
  | { type: "asset"; symbol: string }
  | { type: "climate"; regionKey: string }
  | null {
  const m = /^macro:(.+)$/.exec(catalogId);
  if (m?.[1]) return { type: "macro", seriesId: m[1] };
  const a = /^asset:(.+)$/.exec(catalogId);
  if (a?.[1]) return { type: "asset", symbol: a[1] };
  const c = /^climate:(.+)$/.exec(catalogId);
  if (c?.[1]) return { type: "climate", regionKey: c[1] };
  return null;
}

async function loadClimateReturns(regionKey: string, maxPoints: number): Promise<{
  byDate: Map<string, number>;
  dataAsOf: string | null;
}> {
  const rows = await prisma.climateObservation.findMany({
    where: { regionKey },
    orderBy: { date: "desc" },
    take: maxPoints,
    select: { date: true, tempMeanC: true, precipMm: true },
  });
  if (rows.length < 2) {
    return { byDate: new Map(), dataAsOf: null };
  }
  const asc = [...rows].reverse();
  const byDate = new Map<string, number>();
  for (let i = 1; i < asc.length; i++) {
    const prev = asc[i - 1]!;
    const cur = asc[i]!;
    const prevTemp = Number(prev.tempMeanC ?? 0);
    const curTemp = Number(cur.tempMeanC ?? 0);
    const prevP = Number(prev.precipMm ?? 0);
    const curP = Number(cur.precipMm ?? 0);
    const tempDelta = curTemp - prevTemp;
    const precipBase = Math.max(Math.abs(prevP), 1);
    const precipDeltaPct = (curP - prevP) / precipBase;
    // Índice climático sintético diário para correlação: combina variação térmica e precipitação.
    const climateReturn = tempDelta * 0.01 + precipDeltaPct * 0.2;
    byDate.set(cur.date.toISOString().slice(0, 10), climateReturn);
  }
  return {
    byDate,
    dataAsOf: asc[asc.length - 1]!.date.toISOString().slice(0, 10),
  };
}

/**
 * Estima betas em janela de `WINDOW_DAYS` retornos alinhados e aplica choques percentuais nos fatores.
 * Fatores aceites: `macro:*`, `asset:*` e `climate:*`.
 */
export async function runQuantScenario(
  walletLines: WalletLineWithAsset[],
  factors: QuantFactorRequest[],
): Promise<QuantScenarioResult> {
  const dataGaps: string[] = [];
  const dataAsOf: Record<string, string> = {};

  const baselineValue = walletLines.reduce((s, w) => s + w.valorInvestido, 0);

  const quantFactors = factors.filter((f) => parseCatalogId(f.catalogId) !== null);
  if (quantFactors.length === 0 && factors.length > 0) {
    dataGaps.push("Nenhum fator quantificável (use catalogId macro: ou asset:).");
  }

  type PreparedFactor = {
    catalogId: string;
    shockPercent: number;
    byDate: Map<string, number>;
    asOf: string | null;
  };

  const prepared: PreparedFactor[] = [];
  const needPoints = WINDOW_DAYS + 2;

  for (const q of quantFactors) {
    const parsed = parseCatalogId(q.catalogId);
    if (!parsed) continue;

    if (parsed.type === "macro") {
      const { byDate, dataAsOf: asOf } = await loadMacroReturns(parsed.seriesId, needPoints);
      if (byDate.size < WINDOW_DAYS * 0.5) {
        dataGaps.push(`Histórico macro insuficiente para ${q.catalogId} (mín. desejável ~${WINDOW_DAYS} retornos alinhados).`);
      }
      if (asOf) dataAsOf[q.catalogId] = asOf;
      prepared.push({ catalogId: q.catalogId, shockPercent: q.shockPercent, byDate, asOf });
    } else if (parsed.type === "climate") {
      const { byDate, dataAsOf: asOf } = await loadClimateReturns(parsed.regionKey, needPoints);
      if (byDate.size < WINDOW_DAYS * 0.35) {
        dataGaps.push(`Histórico climático insuficiente para ${q.catalogId}.`);
      }
      if (asOf) dataAsOf[q.catalogId] = asOf;
      prepared.push({ catalogId: q.catalogId, shockPercent: q.shockPercent, byDate, asOf });
    } else {
      const { byDate, dataAsOf: asOf } = await loadAssetReturnsBySymbol(parsed.symbol, needPoints);
      if (byDate.size < WINDOW_DAYS * 0.5) {
        dataGaps.push(`Histórico de preço insuficiente para ${q.catalogId}.`);
      }
      if (asOf) dataAsOf[q.catalogId] = asOf;
      prepared.push({ catalogId: q.catalogId, shockPercent: q.shockPercent, byDate, asOf });
    }
  }

  const perLine: QuantLineImpact[] = [];

  for (const line of walletLines) {
    const betaByFactor: Record<string, number> = {};
    let combined = 0;

    if (!line.assetId) {
      dataGaps.push(`Linha "${line.nome}" sem ativo catalogado — betas não estimados.`);
      perLine.push({
        walletAssetId: line.id,
        nome: line.nome,
        assetSymbol: line.assetSymbol,
        betaByFactor,
        combinedReturnDecimal: 0,
        lineBaselineValue: line.valorInvestido,
        lineProjectedValue: line.valorInvestido,
      });
      continue;
    }

    const lineRet = await loadAssetReturnsForAssetId(line.assetId, needPoints);
    if (lineRet.byDate.size < 2) {
      dataGaps.push(`Preços diários ausentes para a linha "${line.nome}" (${line.assetSymbol ?? line.assetId}).`);
      perLine.push({
        walletAssetId: line.id,
        nome: line.nome,
        assetSymbol: line.assetSymbol,
        betaByFactor,
        combinedReturnDecimal: 0,
        lineBaselineValue: line.valorInvestido,
        lineProjectedValue: line.valorInvestido,
      });
      continue;
    }

    for (const pf of prepared) {
      const { f, l } = alignMaps(pf.byDate, lineRet.byDate);
      const take = Math.min(WINDOW_DAYS, f.length, l.length);
      if (take < 10) {
        dataGaps.push(
          `Sobreposição de datas insuficiente entre ${pf.catalogId} e "${line.nome}" (${take} pontos).`,
        );
        betaByFactor[pf.catalogId] = 0;
        continue;
      }
      const fS = f.slice(-take);
      const lS = l.slice(-take);
      const b = betaLineVsFactor(lS, fS);
      betaByFactor[pf.catalogId] = b;
      const shockDec = pf.shockPercent / 100;
      combined += b * shockDec;
    }

    const capped = Math.max(-MAX_LINE_RETURN_ABS, Math.min(MAX_LINE_RETURN_ABS, combined));
    const lineProjectedValue = line.valorInvestido * (1 + capped);

    perLine.push({
      walletAssetId: line.id,
      nome: line.nome,
      assetSymbol: line.assetSymbol,
      betaByFactor,
      combinedReturnDecimal: capped,
      lineBaselineValue: line.valorInvestido,
      lineProjectedValue,
    });
  }

  const projectedPortfolioValue = perLine.reduce((s, row) => s + row.lineProjectedValue, 0);
  const portfolioReturnDecimal = baselineValue > 0 ? projectedPortfolioValue / baselineValue - 1 : 0;

  return {
    baselineValue,
    projectedPortfolioValue,
    portfolioReturnDecimal,
    perLine,
    dataGaps,
    dataAsOf,
  };
}
