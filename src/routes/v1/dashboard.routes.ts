import { Router } from "express";
import { getCurrentStatusHandler, getDashboardHistoricalHandler } from "../../controllers/dashboardController";
import { validateQuery } from "../../middleware/validateQuery";
import { simulationHistoricalQuerySchema } from "../../validation/querySchemas";

export const dashboardRouter = Router();

dashboardRouter.get("/current-status", getCurrentStatusHandler);
dashboardRouter.get("/historical", validateQuery(simulationHistoricalQuerySchema), getDashboardHistoricalHandler);
