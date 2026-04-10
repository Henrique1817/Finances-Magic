import { Router } from "express";
import { getApiV1Root } from "../controllers/metaController";
import { aiRouter } from "./v1/ai.routes";
import { assetsRouter } from "./v1/assets.routes";
import { authRouter } from "./v1/auth.routes";
import { dashboardRouter } from "./v1/dashboard.routes";
import { scenariosRouter } from "./v1/scenarios.routes";
import { simulationRouter } from "./v1/simulation.routes";
import { speechRouter } from "./v1/speech.routes";
import { walletRouter } from "./v1/wallet.routes";

/**
 * API REST v1 — único agregador de rotas sob `/api/v1`.
 */
export const apiV1Router = Router();

apiV1Router.get("/", getApiV1Root);
apiV1Router.use("/auth", authRouter);
apiV1Router.use("/assets", assetsRouter);
apiV1Router.use("/dashboard", dashboardRouter);
apiV1Router.use("/simulation", simulationRouter);
apiV1Router.use("/wallet", walletRouter);
apiV1Router.use("/ai", aiRouter);
apiV1Router.use("/speech", speechRouter);
apiV1Router.use("/scenarios", scenariosRouter);
