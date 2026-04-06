import type { NextFunction, Request, Response } from "express";
import { sendError, sendSuccess } from "../lib/http";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  addWalletAssetRow,
  deleteWalletAssetRow,
  ensureUserWallet,
  getWalletMarketForUser,
  getPortfolioForUser,
} from "../services/walletService";
import type { WalletAssetCreateBody } from "../validation/bodySchemas";

export const getWalletHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const userId = req.user!.id;
    await ensureUserWallet(userId, req.user!.email);
    const portfolio = await getPortfolioForUser(userId);
    sendSuccess(res, { portfolio });
  },
);

export const postWalletAssetHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const userId = req.user!.id;
    const body = req.validatedBody as WalletAssetCreateBody;
    const asset = await addWalletAssetRow(userId, req.user!.email, {
      nome: body.nome,
      setor: body.setor,
      valorInvestido: body.valorInvestido,
      quantidade: body.quantidade,
      assetId: body.assetId,
    });
    sendSuccess(res, { asset }, 201);
  },
);

export const getWalletMarketHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const userId = req.user!.id;
    await ensureUserWallet(userId, req.user!.email);
    const market = await getWalletMarketForUser(userId, 90);
    sendSuccess(res, { market, windowDays: 90 });
  },
);

export const deleteWalletAssetHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const userId = req.user!.id;
    const raw = req.params.lineId;
    const lineId = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
    if (!lineId?.trim()) {
      sendError(res, 400, "Identificador da posição ausente.");
      return;
    }
    const ok = await deleteWalletAssetRow(userId, lineId.trim());
    if (!ok) {
      sendError(res, 404, "Posição não encontrada.");
      return;
    }
    sendSuccess(res, { deleted: true });
  },
);
