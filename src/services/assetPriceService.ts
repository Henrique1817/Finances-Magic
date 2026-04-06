import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

export type LastPriceRow = {
  assetId: string;
  symbol: string;
  name: string;
  close: number;
  date: string;
};

/** Símbolos equivalentes no catálogo (ex.: PETR4 vs PETR4.SA). */
function symbolLookupVariants(raw: string): string[] {
  const s = raw.trim().toUpperCase();
  const out = new Set<string>([s]);
  if (s.endsWith(".SA")) {
    out.add(s.slice(0, -3));
  } else if (/^[A-Z0-9]{1,12}$/.test(s)) {
    out.add(`${s}.SA`);
  }
  return [...out];
}

export async function findAssetBySymbolLookup(rawSymbol: string) {
  const variants = symbolLookupVariants(rawSymbol);
  return prisma.asset.findFirst({
    where: { symbol: { in: variants } },
    select: { id: true, symbol: true, name: true },
  });
}

export async function getLastCloseForAssetId(assetId: string): Promise<LastPriceRow | null> {
  const row = await prisma.assetPriceHistory.findFirst({
    where: { assetId },
    orderBy: { date: "desc" },
    select: { close: true, date: true },
  });
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, symbol: true, name: true },
  });
  if (!row || !asset) return null;
  return {
    assetId: asset.id,
    symbol: asset.symbol,
    name: asset.name,
    close: Number(row.close),
    date: row.date.toISOString().slice(0, 10),
  };
}

export async function getLastCloseForSymbol(rawSymbol: string): Promise<LastPriceRow | null> {
  const asset = await findAssetBySymbolLookup(rawSymbol);
  if (!asset) return null;
  return getLastCloseForAssetId(asset.id);
}

/** Último fechamento por `assetId` (consulta única, DISTINCT ON). */
export async function getLatestPricesForAssetIds(
  assetIds: string[],
): Promise<Map<string, { close: number; date: Date }>> {
  if (assetIds.length === 0) return new Map();
  const rows = await prisma.$queryRaw<
    Array<{ assetId: string; close: Prisma.Decimal; date: Date }>
  >(Prisma.sql`
    SELECT DISTINCT ON ("assetId") "assetId", "close", "date"
    FROM "asset_price_history"
    WHERE "assetId" IN (${Prisma.join(assetIds)})
    ORDER BY "assetId", "date" DESC
  `);
  const m = new Map<string, { close: number; date: Date }>();
  for (const r of rows) {
    m.set(r.assetId, { close: Number(r.close), date: r.date });
  }
  return m;
}

export async function getPriceHistoryWindowForAssetIds(
  assetIds: string[],
  fromDate: Date,
  toDate: Date,
): Promise<Map<string, Array<{ date: string; close: number }>>> {
  if (assetIds.length === 0) return new Map();
  const rows = await prisma.assetPriceHistory.findMany({
    where: {
      assetId: { in: assetIds },
      date: { gte: fromDate, lte: toDate },
    },
    orderBy: [{ assetId: "asc" }, { date: "asc" }],
    select: { assetId: true, close: true, date: true },
  });
  const m = new Map<string, Array<{ date: string; close: number }>>();
  for (const r of rows) {
    const list = m.get(r.assetId) ?? [];
    list.push({ date: r.date.toISOString().slice(0, 10), close: Number(r.close) });
    m.set(r.assetId, list);
  }
  return m;
}

export async function getLastClosesForSymbols(rawSymbols: string[]): Promise<LastPriceRow[]> {
  const uniq = [...new Set(rawSymbols.map((s) => s.trim()).filter(Boolean))];
  if (uniq.length === 0) return [];

  const seen = new Set<string>();
  const assetIds: string[] = [];
  for (const sym of uniq) {
    const a = await findAssetBySymbolLookup(sym);
    if (a && !seen.has(a.id)) {
      seen.add(a.id);
      assetIds.push(a.id);
    }
  }
  if (assetIds.length === 0) return [];

  const latest = await getLatestPricesForAssetIds(assetIds);
  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds } },
    select: { id: true, symbol: true, name: true },
  });

  const out: LastPriceRow[] = [];
  for (const a of assets) {
    const row = latest.get(a.id);
    if (!row) continue;
    out.push({
      assetId: a.id,
      symbol: a.symbol,
      name: a.name,
      close: row.close,
      date: row.date.toISOString().slice(0, 10),
    });
  }
  return out;
}
