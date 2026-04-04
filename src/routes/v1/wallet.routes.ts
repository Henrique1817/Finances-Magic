import { Router } from "express";
import {
  deleteWalletAssetHandler,
  getWalletHandler,
  postWalletAssetHandler,
} from "../../controllers/walletController";
import { authMiddleware } from "../../middlewares/authMiddleware";
import { validateBody } from "../../middleware/validateBody";
import { walletAssetCreateSchema } from "../../validation/bodySchemas";

export const walletRouter = Router();

walletRouter.get("/", authMiddleware, getWalletHandler);
walletRouter.post(
  "/assets",
  authMiddleware,
  validateBody(walletAssetCreateSchema),
  postWalletAssetHandler,
);
walletRouter.delete("/assets/:lineId", authMiddleware, deleteWalletAssetHandler);
