import type { NextFunction, Request, Response } from "express";
import { sendSuccess } from "../lib/http";
import { asyncHandler } from "../middleware/asyncHandler";
import { runStressCorrelationMock } from "../services/simulationEngineService";
import { getSimulationHistorical } from "../services/simulationHistoryService";
import type { SimulationHistoricalQuery } from "../validation/querySchemas";
import type { SimulationRunBody } from "../validation/bodySchemas";

export const getHistoricalSimulationHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { days } = req.validatedQuery as SimulationHistoricalQuery;
    const data = await getSimulationHistorical(days);
    sendSuccess(res, data);
  },
);

export const postSimulationRunHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const body = req.validatedBody as SimulationRunBody;
    const data = runStressCorrelationMock({
      energyCostIncrease: body.energyCostIncrease,
      geoRiskLevel: body.geoRiskLevel,
      aiDemandIncrease: body.aiDemandIncrease,
      portfolioValue: body.portfolioValue,
    });
    sendSuccess(res, data);
  },
);
