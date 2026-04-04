import { Router } from "express";
import rateLimit from "express-rate-limit";
import { getHistoricalSimulationHandler, postSimulationRunHandler } from "../../controllers/simulationController";
import { authMiddleware } from "../../middlewares/authMiddleware";
import { validateBody } from "../../middleware/validateBody";
import { validateQuery } from "../../middleware/validateQuery";
import { simulationRunBodySchema } from "../../validation/bodySchemas";
import { simulationHistoricalQuerySchema } from "../../validation/querySchemas";

export const simulationRouter = Router();

const simulationRunLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too Many Requests",
    message: "Limite de 10 simulações por minuto por IP. Aguarde e tente novamente.",
  },
});

simulationRouter.get(
  "/historical",
  authMiddleware,
  validateQuery(simulationHistoricalQuerySchema),
  getHistoricalSimulationHandler,
);
simulationRouter.post(
  "/run",
  simulationRunLimiter,
  authMiddleware,
  validateBody(simulationRunBodySchema),
  postSimulationRunHandler,
);
