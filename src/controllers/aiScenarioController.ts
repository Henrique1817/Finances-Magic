import type { NextFunction, Request, Response } from "express";
import { sendError, sendSuccess } from "../lib/http";
import { asyncHandler } from "../middleware/asyncHandler";
import { generateAndPersistAiScenario } from "../services/ai/aiScenarioOrchestrator";
import { ensureUserWallet } from "../services/walletService";
import type { AiScenarioBody } from "../validation/bodySchemas";

export const postAiScenarioHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const body = req.validatedBody as AiScenarioBody;
    const userId = req.user?.id;
    if (!userId) {
      sendError(res, 401, "Sessão inválida.");
      return;
    }

    await ensureUserWallet(userId, req.user?.email);

    const generated = await generateAndPersistAiScenario({
      userId,
      message: body.message,
    });
    if (!generated.ok) {
      sendError(res, generated.status, generated.message);
      return;
    }

    sendSuccess(res, {
      scenarioId: generated.data.scenarioId,
      title: generated.data.title,
      narrative: generated.data.narrative,
      quant: generated.data.quant,
      parsedFactors: generated.data.parsedFactors,
      userIntentSummary: generated.data.userIntentSummary,
    });
  },
);
