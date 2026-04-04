import { Router } from "express";
import { getApiV1Root } from "../controllers/metaController";
import { assetsRouter } from "./v1/assets.routes";
import { dashboardRouter } from "./v1/dashboard.routes";
import { simulationRouter } from "./v1/simulation.routes";
import { walletRouter } from "./v1/wallet.routes";

/**
 * API REST v1 — único agregador de rotas sob `/api/v1`.
 */
export const apiV1Router = Router();

apiV1Router.get("/", getApiV1Root);
apiV1Router.use("/assets", assetsRouter);
apiV1Router.use("/dashboard", dashboardRouter);
apiV1Router.use("/simulation", simulationRouter);
apiV1Router.use("/wallet", walletRouter);
