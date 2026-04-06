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

  try {
    const likeTerm = `%${term}%`;
    const ranked = await prisma.$queryRaw<AssetSearchRow[]>`
      SELECT
        a."id",
        a."symbol",
        a."name",
        a."category",
        a."type"::text AS "type"
      FROM "assets" a
      WHERE lower(a."symbol") LIKE lower(${likeTerm})
         OR lower(a."name") LIKE lower(${likeTerm})
         OR lower(a."category") LIKE lower(${likeTerm})
      ORDER BY
        (
          CASE
            WHEN lower(a."symbol") = lower(${term}) THEN 100
            WHEN lower(a."symbol") LIKE lower(${term}) || '%' THEN 80
            WHEN lower(a."name") LIKE lower(${term}) || '%' THEN 60
            WHEN lower(a."category") LIKE lower(${term}) || '%' THEN 50
            ELSE 40
          END
          + similarity(lower(a."symbol"), lower(${term})) * 10
          + similarity(lower(a."name"), lower(${term})) * 5
          + similarity(lower(a."category"), lower(${term})) * 3
        ) DESC,
        a."symbol" ASC
      LIMIT 10
    `;

    return ranked;
  } catch {
    // Fallback para ambientes sem pg_trgm/similarity habilitado.
    const rows = await prisma.asset.findMany({
      where: {
        OR: [
          { symbol: { contains: term, mode: "insensitive" } },
          { name: { contains: term, mode: "insensitive" } },
          { category: { contains: term, mode: "insensitive" } },
        ],
      },
      take: 10,
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
}
