import type { NextFunction, Request, Response } from "express";
import { sendError, sendSuccess } from "../lib/http";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  deleteScenarioForUser,
  getScenarioForUser,
  listScenariosForUser,
} from "../services/scenarioService";

export const getScenariosListHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) {
      sendError(res, 401, "Sessão inválida.");
      return;
    }
    const rows = await listScenariosForUser(userId);
    sendSuccess(
      res,
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        message: r.message,
        createdAt: r.createdAt.toISOString(),
      })),
    );
  },
);

export const getScenarioByIdHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) {
      sendError(res, 401, "Sessão inválida.");
      return;
    }
    const scenarioId = typeof req.params.scenarioId === "string" ? req.params.scenarioId.trim() : "";
    if (!scenarioId) {
      sendError(res, 400, "Identificador do cenário inválido.");
      return;
    }
    const row = await getScenarioForUser(userId, scenarioId);
    if (!row) {
      sendError(res, 404, "Cenário não encontrado.");
      return;
    }
    const payload = row.resultJson as Record<string, unknown>;
    sendSuccess(res, {
      id: row.id,
      title: row.title,
      message: row.message,
      createdAt: row.createdAt.toISOString(),
      narrative: payload.narrative,
      quant: payload.quant,
      parsedFactors: payload.parsedFactors,
      userIntentSummary: payload.userIntentSummary ?? null,
    });
  },
);

export const deleteScenarioHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) {
      sendError(res, 401, "Sessão inválida.");
      return;
    }
    const scenarioId = typeof req.params.scenarioId === "string" ? req.params.scenarioId.trim() : "";
    if (!scenarioId) {
      sendError(res, 400, "Identificador do cenário inválido.");
      return;
    }
    const ok = await deleteScenarioForUser(userId, scenarioId);
    if (!ok) {
      sendError(res, 404, "Cenário não encontrado.");
      return;
    }
    sendSuccess(res, { deleted: true });
  },
);
