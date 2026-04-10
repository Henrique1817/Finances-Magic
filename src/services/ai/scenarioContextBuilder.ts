import { prisma } from "../../lib/prisma";

export type WalletLineWithAsset = {
  id: string;
  nome: string;
  setor: string;
  valorInvestido: number;
  quantidade: number;
  assetId: string | null;
  assetSymbol: string | null;
  assetName: string | null;
};

export type MacroSeriesLastDate = {
  seriesId: string;
  lastDate: string;
  lastValue: string;
};

export type ScenarioContext = {
  walletLines: WalletLineWithAsset[];
  macroLastBySeries: MacroSeriesLastDate[];
  recentNewsTitles: string[];
  climateLastByRegion: Array<{
    regionKey: string;
    lastDate: string;
    tempMeanC: string | null;
    precipMm: string | null;
  }>;
};

/**
 * Linhas da carteira com dados do `Asset` quando `assetId` está preenchido.
 */
export async function getWalletLinesWithAssets(userId: string): Promise<WalletLineWithAsset[]> {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    include: {
      walletAssets: {
        orderBy: { createdAt: "asc" },
        include: { asset: { select: { id: true, symbol: true, name: true } } },
      },
    },
  });

  if (!wallet) return [];

  return wallet.walletAssets.map((wa) => ({
    id: wa.id,
    nome: wa.nome,
    setor: wa.setor,
    valorInvestido: Number(wa.valorInvestido),
    quantidade: Number(wa.quantidade),
    assetId: wa.assetId,
    assetSymbol: wa.asset?.symbol ?? null,
    assetName: wa.asset?.name ?? null,
  }));
}

async function loadRecentMacroLastDates(): Promise<MacroSeriesLastDate[]> {
  const seriesIds = await prisma.macroIndicator.groupBy({
    by: ["seriesId"],
    _max: { date: true },
  });

  const out: MacroSeriesLastDate[] = [];

  for (const row of seriesIds) {
    const d = row._max.date;
    if (!d) continue;
    const latest = await prisma.macroIndicator.findFirst({
      where: { seriesId: row.seriesId, date: d },
      select: { seriesId: true, date: true, value: true },
    });
    if (!latest) continue;
    out.push({
      seriesId: latest.seriesId,
      lastDate: latest.date.toISOString().slice(0, 10),
      lastValue: latest.value.toString(),
    });
  }

  return out.sort((a, b) => a.seriesId.localeCompare(b.seriesId));
}

/**
 * Contexto para cenários: carteira, últimas datas macro por série, manchetes recentes.
 */
export async function buildScenarioContext(userId: string): Promise<ScenarioContext> {
  // carrega as linhas da carteira com os ativos catalogados
  const [walletLines, macroLastBySeries, newsRows, climateRows] = await Promise.all([
    getWalletLinesWithAssets(userId),
    loadRecentMacroLastDates(),
    // carrega as manchetes recentes
    prisma.newsRecord.findMany({
      orderBy: { publishedAt: "desc" },
      take: 10,
      select: { title: true },
    }),
    // carrega as observações climáticas recentes
    prisma.climateObservation.findMany({
      orderBy: [{ regionKey: "asc" }, { date: "desc" }],
      take: 200,
      select: { regionKey: true, date: true, tempMeanC: true, precipMm: true },
    }),
  ]);
  // agrupa as observações climáticas por região
  const climateByRegion = new Map<
    string,
    { regionKey: string; lastDate: string; tempMeanC: string | null; precipMm: string | null }
  >();
  // agrupa as observações climáticas por região
  for (const row of climateRows) {
    if (climateByRegion.has(row.regionKey)) continue;
    climateByRegion.set(row.regionKey, {
      regionKey: row.regionKey,
      lastDate: row.date.toISOString().slice(0, 10),
      tempMeanC: row.tempMeanC?.toString() ?? null,
      precipMm: row.precipMm?.toString() ?? null,
    });
  }

  // retorna o contexto
  return {
    walletLines,
    macroLastBySeries,
    recentNewsTitles: newsRows.map((n) => n.title),
    climateLastByRegion: [...climateByRegion.values()],
  };
}

export function formatScenarioContextForPrompt(ctx: ScenarioContext): string {
  const parts: string[] = [];

  parts.push("Carteira do usuário:");
  if (ctx.walletLines.length === 0) {
    parts.push("  (vazia)");
  } else {
    const semAtivo = ctx.walletLines.filter((w) => !w.assetId || !w.assetSymbol).length;
    for (const w of ctx.walletLines) {
      const sym = w.assetSymbol ? ` [ativo: ${w.assetSymbol}${w.assetName ? ` — ${w.assetName}` : ""}]` : " [sem vínculo a ativo catalogado]";
      parts.push(
        `  • ${w.nome} (${w.setor}) — investido: ${w.valorInvestido.toFixed(2)}${sym}`,
      );
    }
    if (semAtivo > 0) {
      parts.push(
        `  Nota: ${semAtivo} linha(s) sem ativo catalogado — a projeção por beta de mercado fica limitada ou ausente nessas posições; o utilizador deve ser avisado.`,
      );
    }
  }
  // adiciona as últimas observações conhecidas por série macro
  parts.push("", "Última observação conhecida por série macro (amostra):");
  for (const m of ctx.macroLastBySeries.slice(0, 25)) {
    parts.push(`  • ${m.seriesId} @ ${m.lastDate} = ${m.lastValue}`);
  }
  if (ctx.macroLastBySeries.length > 25) {
    parts.push(`  … (+${ctx.macroLastBySeries.length - 25} séries)`);
  }
  // adiciona as manchetes recentes
  parts.push("", "Manchetes recentes (até 10):");
  for (const t of ctx.recentNewsTitles) {
    parts.push(`  • ${t}`);
  }
  // adiciona as últimas observações climáticas por região
  parts.push("", "Última observação climática por região (amostra):");
  for (const c of ctx.climateLastByRegion.slice(0, 25)) {
    parts.push(
      `  • ${c.regionKey} @ ${c.lastDate} = temp ${c.tempMeanC ?? "n/d"}°C; precip ${c.precipMm ?? "n/d"} mm`,
    );
  }
  if (ctx.climateLastByRegion.length > 25) {
    parts.push(`  … (+${ctx.climateLastByRegion.length - 25} regiões)`);
  }
  // retorna o contexto formatado
  return parts.join("\n");
}
