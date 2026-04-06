import { Router } from "express";
import { getAssetLastPriceHandler, getAssetSearchHandler } from "../../controllers/assetController";
import { validateQuery } from "../../middleware/validateQuery";
import { assetLastPriceQuerySchema, assetSearchQuerySchema } from "../../validation/querySchemas";

export const assetsRouter = Router();

assetsRouter.get("/last-price", validateQuery(assetLastPriceQuerySchema), getAssetLastPriceHandler);
assetsRouter.get("/search", validateQuery(assetSearchQuerySchema), getAssetSearchHandler);
