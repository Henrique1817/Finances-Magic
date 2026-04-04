import type { AssetType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

export type SimulationBucketKey = "technology" | "energy" | "mining";

export type HistoricalVariationPoint = {
  date: string;
  /** Média da variação diária (%), entre ativos do bucket, quando há preço no dia e no dia anterior. */
  avgDailyVariationPercent: number;
  /** Quantidade de ativos que entraram na média naquela data. */
  sampleSize: number;
};

export type SimulationHistoricalBucket = {
  key: SimulationBucketKey;
  label: string;
  assetType: AssetType;
  points: HistoricalVariationPoint[];
};

const BUCKET_DEFS: Array<{
  key: SimulationBucketKey;
  label: string;
  assetType: AssetType;
}> = [
  { key: "technology", label: "Tecnologia", assetType: "STOCK" },
  { key: "energy", label: "Energia", assetType: "ENERGY" },
  { key: "mining", label: "Mineração", assetType: "COMMODITY" },
];

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

/**
 * Por ativo: variação % entre fechamentos consecutivos; depois média por calendário no bucket.
 * `assetSeries` = uma série ordenada por data por ativo (não misturar ativos na mesma lista).
 */
function aggregateBucketFromAssets(
  assetSeries: Array<Array<{ date: Date; close: Prisma.Decimal }>>,
  fromDate: Date,
  toDate: Date,
): HistoricalVariationPoint[] {
  const fromMs = startOfUtcDay(fromDate).getTime();
  const toMs = startOfUtcDay(toDate).getTime();
  const byDate = new Map<string, number[]>();

  for (const series of assetSeries) {
    const sorted = [...series].sort((a, b) => a.date.getTime() - b.date.getTime());
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;
      const currDay = startOfUtcDay(curr.date).getTime();
      if (currDay < fromMs || currDay > toMs) continue;

      const p = decimalToNumber(prev.close);
      const c = decimalToNumber(curr.close);
      if (p === 0) continue;

      const pct = (c / p - 1) * 100;
      const key = formatDateOnly(curr.date);
      const arr = byDate.get(key) ?? [];
      arr.push(pct);
      byDate.set(key, arr);
    }
  }

  const dates = [...byDate.keys()].sort();
  return dates.map((date) => {
    const vals = byDate.get(date)!;
    const sum = vals.reduce((a, b) => a + b, 0);
    return {
      date,
      avgDailyVariationPercent: sum / vals.length,
      sampleSize: vals.length,
    };
  });
}

export async function getSimulationHistorical(windowDays: number): Promise<{
  windowDays: number;
  generatedAt: string;
  fromDate: string;
  toDate: string;
  buckets: SimulationHistoricalBucket[];
}> {
  const toDate = startOfUtcDay(new Date());
  const fromDate = new Date(toDate);
  fromDate.setUTCDate(fromDate.getUTCDate() - windowDays);

  const dataStart = new Date(fromDate);
  dataStart.setUTCDate(dataStart.getUTCDate() - 14);

  const types = BUCKET_DEFS.map((b) => b.assetType);
  const assets = await prisma.asset.findMany({
    where: { type: { in: types } },
    select: {
      id: true,
      type: true,
      priceHistory: {
        where: { date: { gte: dataStart, lte: toDate } },
        orderBy: { date: "asc" },
        select: { date: true, close: true },
      },
    },
  });

  const buckets: SimulationHistoricalBucket[] = BUCKET_DEFS.map((def) => {
    const assetRows = assets.filter((a) => a.type === def.assetType);
    const perAsset = assetRows.map((a) => a.priceHistory);
    const points = aggregateBucketFromAssets(perAsset, fromDate, toDate);
    return {
      key: def.key,
      label: def.label,
      assetType: def.assetType,
      points,
    };
  });

  return {
    windowDays,
    generatedAt: new Date().toISOString(),
    fromDate: formatDateOnly(fromDate),
    toDate: formatDateOnly(toDate),
    buckets,
  };
}
