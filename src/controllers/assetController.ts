import type { NextFunction, Request, Response } from "express";
import { sendSuccess } from "../lib/http";
import { asyncHandler } from "../middleware/asyncHandler";
import { getLastCloseForSymbol, getLastClosesForSymbols } from "../services/assetPriceService";
import { searchAssets } from "../services/assetSearchService";
import type { AssetLastPriceQuery, AssetSearchQuery } from "../validation/querySchemas";

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

/** Último fechamento conhecido no banco (ingestão), por ticker. */
export const getAssetLastPriceHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const q = req.validatedQuery as AssetLastPriceQuery;
    if (q.symbols) {
      const list = q.symbols
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 100);
      const prices = await getLastClosesForSymbols(list);
      sendSuccess(res, { prices });
      return;
    }
    const one = await getLastCloseForSymbol(q.symbol!);
    sendSuccess(res, { price: one });
  },
);
