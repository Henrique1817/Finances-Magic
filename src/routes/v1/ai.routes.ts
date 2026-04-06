import { Router } from "express";
import rateLimit from "express-rate-limit";
import { postAiScenarioHandler } from "../../controllers/aiScenarioController";
import { authMiddleware } from "../../middlewares/authMiddleware";
import { validateBody } from "../../middleware/validateBody";
import { aiScenarioBodySchema } from "../../validation/bodySchemas";

export const aiRouter = Router();

const aiScenarioLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too Many Requests",
    message: "Limite de 5 pedidos de cenário IA por minuto por IP. Aguarde e tente novamente.",
  },
});

aiRouter.post(
  "/scenario",
  aiScenarioLimiter,
  authMiddleware,
  validateBody(aiScenarioBodySchema),
  postAiScenarioHandler,
);
