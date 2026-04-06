import { prisma } from "../lib/prisma";

export type AssetSearchRow = {
  id: string;
  symbol: string;
  name: string;
  category: string;
  type: string;
};

export type SearchAssetsParams = {
  q: string;
  limit: number;
  offset: number;
};

export type SearchAssetsResult = {
  results: AssetSearchRow[];
  hasMore: boolean;
};

function normalizeSymbolForSearch(s: string): string {
  return s.trim().replace(/\.SA$/i, "");
}

/**
 * Busca ativos por texto com paginação e normalização de ticker BR (.SA).
 */
export async function searchAssets(params: SearchAssetsParams): Promise<SearchAssetsResult> {
  const term = params.q.trim();
  if (term.length < 2) return { results: [], hasMore: false };
  const normalizedTerm = normalizeSymbolForSearch(term);
  const limit = Math.max(1, Math.min(100, params.limit));
  const offset = Math.max(0, params.offset);
  const pageSize = limit + 1;

  try {
    const likeTerm = `%${term}%`;
    const likeNormalizedTerm = `%${normalizedTerm}%`;
    const ranked = await prisma.$queryRaw<AssetSearchRow[]>`
      SELECT
        a."id",
        a."symbol",
        a."name",
        a."category",
        a."type"::text AS "type"
      FROM "assets" a
      WHERE lower(a."symbol") LIKE lower(${likeTerm})
         OR lower(regexp_replace(a."symbol", '\.SA$', '', 'i')) LIKE lower(${likeNormalizedTerm})
         OR lower(a."name") LIKE lower(${likeTerm})
         OR lower(a."category") LIKE lower(${likeTerm})
      ORDER BY
        (
          CASE
            WHEN lower(a."symbol") = lower(${term}) THEN 100
            WHEN lower(regexp_replace(a."symbol", '\.SA$', '', 'i')) = lower(${normalizedTerm}) THEN 95
            WHEN lower(a."symbol") LIKE lower(${term}) || '%' THEN 80
            WHEN lower(regexp_replace(a."symbol", '\.SA$', '', 'i')) LIKE lower(${normalizedTerm}) || '%' THEN 75
            WHEN lower(a."name") LIKE lower(${term}) || '%' THEN 60
            WHEN lower(a."category") LIKE lower(${term}) || '%' THEN 50
            ELSE 40
          END
          + similarity(lower(a."symbol"), lower(${term})) * 10
          + similarity(lower(regexp_replace(a."symbol", '\.SA$', '', 'i')), lower(${normalizedTerm})) * 8
          + similarity(lower(a."name"), lower(${term})) * 5
          + similarity(lower(a."category"), lower(${term})) * 3
        ) DESC,
        a."symbol" ASC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `;

    return {
      results: ranked.slice(0, limit),
      hasMore: ranked.length > limit,
    };
  } catch {
    // Fallback para ambientes sem pg_trgm/similarity habilitado.
    const rows = await prisma.asset.findMany({
      where: {
        OR: [
          { symbol: { contains: term, mode: "insensitive" } },
          { symbol: { contains: normalizedTerm, mode: "insensitive" } },
          { name: { contains: term, mode: "insensitive" } },
          { category: { contains: term, mode: "insensitive" } },
        ],
      },
      skip: offset,
      take: pageSize,
      orderBy: { symbol: "asc" },
      select: {
        id: true,
        symbol: true,
        name: true,
        category: true,
        type: true,
      },
    });

    const mapped = rows.map((r) => ({
      id: r.id,
      symbol: r.symbol,
      name: r.name,
      category: r.category,
      type: r.type,
    }));
    return {
      results: mapped.slice(0, limit),
      hasMore: mapped.length > limit,
    };
  }
}
