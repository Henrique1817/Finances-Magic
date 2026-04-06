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
  const [walletLines, macroLastBySeries, newsRows] = await Promise.all([
    getWalletLinesWithAssets(userId),
    loadRecentMacroLastDates(),
    prisma.newsRecord.findMany({
      orderBy: { publishedAt: "desc" },
      take: 10,
      select: { title: true },
    }),
  ]);

  return {
    walletLines,
    macroLastBySeries,
    recentNewsTitles: newsRows.map((n) => n.title),
  };
}

export function formatScenarioContextForPrompt(ctx: ScenarioContext): string {
  const parts: string[] = [];

  parts.push("Carteira do usuário:");
  if (ctx.walletLines.length === 0) {
    parts.push("  (vazia)");
  } else {
    for (const w of ctx.walletLines) {
      const sym = w.assetSymbol ? ` [ativo: ${w.assetSymbol}${w.assetName ? ` — ${w.assetName}` : ""}]` : " [sem vínculo a ativo catalogado]";
      parts.push(
        `  • ${w.nome} (${w.setor}) — investido: ${w.valorInvestido.toFixed(2)}${sym}`,
      );
    }
  }

  parts.push("", "Última observação conhecida por série macro (amostra):");
  for (const m of ctx.macroLastBySeries.slice(0, 25)) {
    parts.push(`  • ${m.seriesId} @ ${m.lastDate} = ${m.lastValue}`);
  }
  if (ctx.macroLastBySeries.length > 25) {
    parts.push(`  … (+${ctx.macroLastBySeries.length - 25} séries)`);
  }

  parts.push("", "Manchetes recentes (até 10):");
  for (const t of ctx.recentNewsTitles) {
    parts.push(`  • ${t}`);
  }

  return parts.join("\n");
}
