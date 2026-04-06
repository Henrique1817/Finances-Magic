import type { NextFunction, Request, Response } from "express";
import { sendSuccess } from "../lib/http";
import { asyncHandler } from "../middleware/asyncHandler";
import { searchAssets } from "../services/assetSearchService";
import type { AssetSearchQuery } from "../validation/querySchemas";

export const getAssetSearchHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { q, limit, offset } = req.validatedQuery as AssetSearchQuery;
    const { results, hasMore } = await searchAssets({ q, limit, offset });
    sendSuccess(res, {
      results,
      page: { limit, offset, hasMore },
    });
  },
);
