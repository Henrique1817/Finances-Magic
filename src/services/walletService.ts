import { prisma } from "../lib/prisma";
import {
  getLatestPricesForAssetIds,
  getPriceHistoryWindowForAssetIds,
} from "./assetPriceService";

const PLACEHOLDER_EMAIL_HOST = "users.code-chroma.local";

function resolveEmail(userId: string, email: string | undefined): string {
  if (email && email.trim()) return email.trim();
  return `${userId}@${PLACEHOLDER_EMAIL_HOST}`;
}

export type WalletLineDto = {
  id: string;
  nome: string;
  setor: string;
  valorInvestido: number;
  quantidade: number;
};

export type WalletMarketPointDto = {
  date: string;
  close: number;
};

export type WalletMarketLineDto = WalletLineDto & {
  assetId: string | null;
  assetSymbol: string | null;
  assetName: string | null;
  currentPrice: number | null;
  currentPriceDate: string | null;
  history: WalletMarketPointDto[];
  missingReason: string | null;
};

function formatDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function ensureUserWallet(userId: string, email: string | undefined) {
  const resolvedEmail = resolveEmail(userId, email);
  await prisma.user.upsert({
    where: { id: userId },
    create: { id: userId, email: resolvedEmail },
    update: { email: resolvedEmail },
  });
  let wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    wallet = await prisma.wallet.create({ data: { userId } });
  }
  return wallet;
}

export async function getPortfolioForUser(userId: string): Promise<WalletLineDto[]> {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    include: { walletAssets: { orderBy: { createdAt: "asc" } } },
  });
  if (!wallet) return [];
  return wallet.walletAssets.map((wa) => ({
    id: wa.id,
    nome: wa.nome,
    setor: wa.setor,
    valorInvestido: Number(wa.valorInvestido),
    quantidade: Number(wa.quantidade),
  }));
}

function extractLikelySymbol(nome: string): string | null {
  const token = nome
    .trim()
    .split(/\s|—|-/)[0]
    ?.trim()
    .toUpperCase();
  if (!token) return null;
  if (!/^[A-Z0-9.-]{2,12}$/.test(token)) return null;
  return token;
}

export async function getWalletMarketForUser(
  userId: string,
  windowDays = 90,
): Promise<WalletMarketLineDto[]> {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    include: {
      walletAssets: {
        orderBy: { createdAt: "asc" },
        include: {
          asset: { select: { id: true, symbol: true, name: true } },
        },
      },
    },
  });
  if (!wallet) return [];

  const symbolCandidates = new Set<string>();
  for (const row of wallet.walletAssets) {
    if (row.asset?.symbol) continue;
    const guessed = extractLikelySymbol(row.nome);
    if (guessed) symbolCandidates.add(guessed);
  }

  const guessedAssets =
    symbolCandidates.size > 0
      ? await prisma.asset.findMany({
          where: { symbol: { in: [...symbolCandidates] } },
          select: { id: true, symbol: true, name: true },
        })
      : [];
  const guessedMap = new Map(guessedAssets.map((a) => [a.symbol.toUpperCase(), a]));

  const toDate = new Date();
  toDate.setUTCHours(23, 59, 59, 999);
  const fromDate = new Date();
  fromDate.setUTCHours(0, 0, 0, 0);
  fromDate.setUTCDate(fromDate.getUTCDate() - Math.max(7, windowDays));

  const resolvedIds: string[] = [];
  for (const wa of wallet.walletAssets) {
    const guessedSymbol = extractLikelySymbol(wa.nome);
    const resolved =
      wa.asset ?? (guessedSymbol ? guessedMap.get(guessedSymbol.toUpperCase()) ?? null : null);
    if (resolved) resolvedIds.push(resolved.id);
  }

  const uniqueAssetIds = [...new Set(resolvedIds)];
  const [latestMap, historyMap] = await Promise.all([
    getLatestPricesForAssetIds(uniqueAssetIds),
    getPriceHistoryWindowForAssetIds(uniqueAssetIds, fromDate, toDate),
  ]);

  return wallet.walletAssets.map((wa) => {
    const guessedSymbol = extractLikelySymbol(wa.nome);
    const resolvedAsset =
      wa.asset ?? (guessedSymbol ? guessedMap.get(guessedSymbol.toUpperCase()) ?? null : null);
    const aid = resolvedAsset?.id ?? null;
    const windowHistory = aid ? historyMap.get(aid) ?? [] : [];

    const latestRow = aid ? latestMap.get(aid) : undefined;
    const currentPrice = latestRow ? latestRow.close : null;
    const currentPriceDate = latestRow ? formatDateOnly(latestRow.date) : null;

    let missingReason: string | null = null;
    if (!resolvedAsset) {
      missingReason = "Ativo sem vínculo com catálogo global.";
    } else if (currentPrice === null) {
      missingReason = "Ativo sem preços atuais no banco.";
    } else if (windowHistory.length < 2) {
      missingReason = "Ativo sem histórico suficiente para gráfico.";
    }

    return {
      id: wa.id,
      nome: wa.nome,
      setor: wa.setor,
      valorInvestido: Number(wa.valorInvestido),
      quantidade: Number(wa.quantidade),
      assetId: resolvedAsset?.id ?? null,
      assetSymbol: resolvedAsset?.symbol ?? null,
      assetName: resolvedAsset?.name ?? null,
      currentPrice,
      currentPriceDate,
      history: windowHistory,
      missingReason,
    };
  });
}

export async function addWalletAssetRow(
  userId: string,
  email: string | undefined,
  input: {
    nome: string;
    setor: string;
    valorInvestido: number;
    quantidade: number;
    assetId?: string | null;
  },
): Promise<WalletLineDto> {
  const wallet = await ensureUserWallet(userId, email);
  let assetId: string | null = input.assetId?.trim() || null;
  if (assetId) {
    const exists = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!exists) assetId = null;
  }
  const row = await prisma.walletAsset.create({
    data: {
      walletId: wallet.id,
      assetId,
      nome: input.nome.trim(),
      setor: input.setor,
      valorInvestido: input.valorInvestido,
      quantidade: input.quantidade,
    },
  });
  return {
    id: row.id,
    nome: row.nome,
    setor: row.setor,
    valorInvestido: Number(row.valorInvestido),
    quantidade: Number(row.quantidade),
  };
}

export async function deleteWalletAssetRow(userId: string, lineId: string): Promise<boolean> {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) return false;
  const row = await prisma.walletAsset.findFirst({
    where: { id: lineId, walletId: wallet.id },
  });
  if (!row) return false;
  await prisma.walletAsset.delete({ where: { id: lineId } });
  return true;
}
