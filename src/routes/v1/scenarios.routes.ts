import { Router } from "express";
import {
  deleteScenarioHandler,
  getScenarioByIdHandler,
  getScenariosListHandler,
} from "../../controllers/scenariosController";
import { authMiddleware } from "../../middlewares/authMiddleware";

export const scenariosRouter = Router();

scenariosRouter.get("/", authMiddleware, getScenariosListHandler);
scenariosRouter.get("/:scenarioId", authMiddleware, getScenarioByIdHandler);
scenariosRouter.delete("/:scenarioId", authMiddleware, deleteScenarioHandler);
