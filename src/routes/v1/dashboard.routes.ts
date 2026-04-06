import { Router } from "express";
import {
  getAiAccuracyHandler,
  getCurrentStatusHandler,
  getDashboardHistoricalHandler,
  getIngestionOpsHandler,
} from "../../controllers/dashboardController";
import { validateQuery } from "../../middleware/validateQuery";
import { simulationHistoricalQuerySchema } from "../../validation/querySchemas";

export const dashboardRouter = Router();

dashboardRouter.get("/current-status", getCurrentStatusHandler);
dashboardRouter.get("/historical", validateQuery(simulationHistoricalQuerySchema), getDashboardHistoricalHandler);
dashboardRouter.get("/ingestion-ops", getIngestionOpsHandler);
dashboardRouter.get("/ai-accuracy", getAiAccuracyHandler);
