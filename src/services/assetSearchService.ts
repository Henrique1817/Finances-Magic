import { prisma } from "../lib/prisma";

export type AssetSearchRow = {
  id: string;
  symbol: string;
  name: string;
  category: string;
  type: string;
};

/**
 * Até 5 ativos cujo `symbol` ou `name` contém `q` (case-insensitive).
 */
export async function searchAssets(q: string): Promise<AssetSearchRow[]> {
  const term = q.trim();
  if (term.length < 2) return [];

  const rows = await prisma.asset.findMany({
    where: {
      OR: [
        { symbol: { contains: term, mode: "insensitive" } },
        { name: { contains: term, mode: "insensitive" } },
      ],
    },
    take: 5,
    orderBy: { symbol: "asc" },
    select: {
      id: true,
      symbol: true,
      name: true,
      category: true,
      type: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    name: r.name,
    category: r.category,
    type: r.type,
  }));
}
