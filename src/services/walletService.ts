import { prisma } from "../lib/prisma";

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
