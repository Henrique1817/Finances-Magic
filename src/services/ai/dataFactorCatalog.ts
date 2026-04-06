import { env } from "../../config/env";
import {
  CLIMATE_REGION_PRESETS,
  GEO_RISK_MACRO_NAME,
  GEO_RISK_SERIES_ID,
  MARKET_WORKER_FRED_SERIES,
  parseClimateRegionKeys,
} from "../../config/ingestion";
import { prisma } from "../../lib/prisma";

export type CatalogFactor =
  | { kind: "macro"; id: string; seriesId: string; name: string }
  | { kind: "asset"; id: string; symbol: string; name: string; category: string }
  | { kind: "climate"; id: string; regionKey: string; label: string };

export type FactorCatalog = {
  factors: CatalogFactor[];
  validIds: Set<string>;
};

/**
 * Catálogo usado para validar pedidos da IA e para prompts.
 */
export async function loadFactorCatalog(): Promise<FactorCatalog> {
  const factors: CatalogFactor[] = [];

  for (const s of MARKET_WORKER_FRED_SERIES) {
    const id = `macro:${s.seriesId}`;
    factors.push({ kind: "macro", id, seriesId: s.seriesId, name: s.name });
  }

  factors.push({
    kind: "macro",
    id: `macro:${GEO_RISK_SERIES_ID}`,
    seriesId: GEO_RISK_SERIES_ID,
    name: GEO_RISK_MACRO_NAME,
  });

  const syntheticRows = await prisma.macroIndicator.findMany({
    distinct: ["seriesId"],
    orderBy: { seriesId: "asc" },
    select: { seriesId: true, name: true },
  });
  for (const s of syntheticRows) {
    const id = `macro:${s.seriesId}`;
    if (factors.some((x) => x.id === id)) continue;
    factors.push({ kind: "macro", id, seriesId: s.seriesId, name: s.name });
  }

  const assets = await prisma.asset.findMany({
    orderBy: { symbol: "asc" },
    select: { symbol: true, name: true, category: true },
  });

  for (const a of assets) {
    factors.push({
      kind: "asset",
      id: `asset:${a.symbol}`,
      symbol: a.symbol,
      name: a.name,
      category: a.category,
    });
  }

  const climateKeys = parseClimateRegionKeys(env.climateRegionKeys);
  for (const key of climateKeys) {
    const p = CLIMATE_REGION_PRESETS[key];
    if (!p) continue;
    factors.push({
      kind: "climate",
      id: `climate:${key}`,
      regionKey: key,
      label: p.label,
    });
  }

  return {
    factors,
    validIds: new Set(factors.map((f) => f.id)),
  };
}

/**
 * Resumo textual do catálogo para injetar no prompt (Gemini).
 */
export function buildFactorCatalogSummaryForPrompt(catalog: FactorCatalog): string {
  const lines: string[] = [
    "Fatores disponíveis (use exatamente estes catalogId):",
    "",
    "— Macro (série FRED ou sintética):",
  ];

  for (const f of catalog.factors) {
    if (f.kind === "macro") {
      lines.push(`  • ${f.id} — ${f.name}`);
    }
  }

  lines.push("", "— Ativos (preços diários ingeridos):");
  for (const f of catalog.factors) {
    if (f.kind === "asset") {
      lines.push(`  • ${f.id} — ${f.name} [${f.category}]`);
    }
  }

  const climates = catalog.factors.filter((x): x is Extract<CatalogFactor, { kind: "climate" }> => x.kind === "climate");
  if (climates.length > 0) {
    lines.push("", "— Clima (contexto qualitativo; séries diárias por região):");
    for (const f of climates) {
      lines.push(`  • ${f.id} — ${f.label}`);
    }
  }

  lines.push(
    "",
    "Regras: catalogId deve ser uma das chaves acima. shockPercent é o choque percentual assumido no fator (número, pode ser negativo).",
  );

  return lines.join("\n");
}
