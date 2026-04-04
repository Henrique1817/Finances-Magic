import type { Request, Response } from "express";
import { API_ROUTE_VERSION, API_SEMANTIC_VERSION } from "../config/apiVersion";
import { sendSuccess } from "../lib/http";

export function getApiV1Root(_req: Request, res: Response): void {
  sendSuccess(res, {
    name: "Code Chroma API",
    semanticVersion: API_SEMANTIC_VERSION,
    routeVersion: API_ROUTE_VERSION,
    basePath: `/api/${API_ROUTE_VERSION}`,
    endpoints: {
      assets: {
        search: {
          method: "GET",
          path: `/api/${API_ROUTE_VERSION}/assets/search`,
          query: { q: "mínimo 2 caracteres; busca em symbol e name" },
        },
      },
      dashboard: {
        currentStatus: {
          method: "GET",
          path: `/api/${API_ROUTE_VERSION}/dashboard/current-status`,
        },
        historical: {
          method: "GET",
          path: `/api/${API_ROUTE_VERSION}/dashboard/historical`,
          query: { days: "opcional, 1–90, padrão 30" },
        },
      },
      simulation: {
        historical: {
          method: "GET",
          path: `/api/${API_ROUTE_VERSION}/simulation/historical`,
          query: { days: "opcional, 1–90, padrão 30" },
        },
        run: {
          method: "POST",
          path: `/api/${API_ROUTE_VERSION}/simulation/run`,
          body: {
            energyCostIncrease: "number (>= 0)",
            geoRiskLevel: "number (1–10)",
            aiDemandIncrease: "number (>= 0)",
            portfolioValue: "number (> 0)",
          },
        },
      },
    },
    docs: "Consulte README.md do repositório para o contrato completo.",
  });
}
