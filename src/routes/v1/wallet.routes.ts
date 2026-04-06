import { Router } from "express";
import {
  deleteWalletAssetHandler,
  getWalletMarketHandler,
  getWalletHandler,
  postWalletAssetHandler,
} from "../../controllers/walletController";
import { authMiddleware } from "../../middlewares/authMiddleware";
import { validateBody } from "../../middleware/validateBody";
import { walletAssetCreateSchema } from "../../validation/bodySchemas";

export const walletRouter = Router();

walletRouter.get("/", authMiddleware, getWalletHandler);
walletRouter.get("/market", authMiddleware, getWalletMarketHandler);
walletRouter.post(
  "/assets",
  authMiddleware,
  validateBody(walletAssetCreateSchema),
  postWalletAssetHandler,
);
walletRouter.delete("/assets/:lineId", authMiddleware, deleteWalletAssetHandler);
