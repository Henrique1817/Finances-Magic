import cors from "cors";
import express, { type Request, type Response } from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { API_SEMANTIC_VERSION } from "./config/apiVersion";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { apiVersionHeaders } from "./middleware/apiVersionHeaders";
import { errorHandler } from "./middleware/errorHandler";
import { notFoundApi } from "./middleware/notFoundApi";
import { apiV1Router } from "./routes";

export function createApp() {
  const app = express();

  if (env.nodeEnv === "production") {
    app.set("trust proxy", 1);
  }

  app.use(helmet());

  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === "/health" || req.url === "/favicon.ico",
      },
    }),
  );
  app.use(apiVersionHeaders);
  app.use(
    cors({
      origin: env.frontendOrigins,
    }),
  );
  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "code-chroma-backend", apiVersion: API_SEMANTIC_VERSION });
  });

  app.use("/api/v1", apiV1Router);

  app.use((req, res, next) => {
    if (!req.originalUrl.startsWith("/api")) {
      next();
      return;
    }
    notFoundApi(req, res);
  });

  app.use(errorHandler);

  return app;
}
