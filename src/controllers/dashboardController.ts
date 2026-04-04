import type { NextFunction, Request, Response } from "express";
import { sendSuccess } from "../lib/http";
import { asyncHandler } from "../middleware/asyncHandler";
import { getDashboardCurrentStatus, getDashboardHistorical } from "../services/dashboardService";
import type { SimulationHistoricalQuery } from "../validation/querySchemas";

export const getCurrentStatusHandler = asyncHandler(async (_req: Request, res: Response, _next: NextFunction) => {
  const data = await getDashboardCurrentStatus();
  sendSuccess(res, data);
});

export const getDashboardHistoricalHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { days } = req.validatedQuery as SimulationHistoricalQuery;
    const data = await getDashboardHistorical(days);
    sendSuccess(res, data);
  },
);
