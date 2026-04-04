import { Router } from "express";
import { getAssetSearchHandler } from "../../controllers/assetController";
import { validateQuery } from "../../middleware/validateQuery";
import { assetSearchQuerySchema } from "../../validation/querySchemas";

export const assetsRouter = Router();

assetsRouter.get("/search", validateQuery(assetSearchQuerySchema), getAssetSearchHandler);
