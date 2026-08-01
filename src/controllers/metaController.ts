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
      auth: {
        login: {
          method: "POST",
          path: `/api/${API_ROUTE_VERSION}/auth/login`,
          body: { email: "string", password: "string (mín. 6)" },
        },
        register: {
          method: "POST",
          path: `/api/${API_ROUTE_VERSION}/auth/register`,
          body: { email: "string", password: "string (mín. 6)" },
        },
        refresh: {
          method: "POST",
          path: `/api/${API_ROUTE_VERSION}/auth/refresh`,
          body: { refresh_token: "string" },
        },
        me: {
          method: "GET",
          path: `/api/${API_ROUTE_VERSION}/auth/me`,
          auth: "Bearer obrigatório",
        },
        oauthGoogle: {
          method: "GET",
          path: `/api/${API_ROUTE_VERSION}/auth/oauth/google`,
          query: { redirect_to: "URL do front (/auth/callback), origem em FRONTEND_ORIGINS" },
        },
        oauthCallback: {
          method: "GET",
          path: `/api/${API_ROUTE_VERSION}/auth/oauth/callback`,
          note: "OAuth Google via Neon Auth; callback no front /auth/callback.",
        },
      },
      assets: {
        search: {
          method: "GET",
          path: `/api/${API_ROUTE_VERSION}/assets/search`,
          query: { q: "mínimo 2 caracteres; busca em symbol e name" },
        },
        lastPrice: {
          method: "GET",
          path: `/api/${API_ROUTE_VERSION}/assets/last-price`,
          query: {
            symbol: "ticker único (opcional se usar symbols)",
            symbols: "lista separada por vírgula (opcional se usar symbol)",
          },
          note: "Último fechamento em asset_price_history (ingestão).",
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
        aiAccuracy: {
          method: "GET",
          path: `/api/${API_ROUTE_VERSION}/dashboard/ai-accuracy`,
          note: "Acurácia validada das previsões IA vs retorno observado + cobertura do dataset.",
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
      ai: {
        scenario: {
          method: "POST",
          path: `/api/${API_ROUTE_VERSION}/ai/scenario`,
          auth: "Bearer obrigatório",
          body: { message: "string (cenário em linguagem natural)" },
          note: "Persiste cenário; resposta inclui scenarioId e title. OPENAI_API_KEY; limite 5 req/min por IP.",
        },
      },
      scenarios: {
        list: {
          method: "GET",
          path: `/api/${API_ROUTE_VERSION}/scenarios`,
          auth: "Bearer obrigatório",
        },
        get: {
          method: "GET",
          path: `/api/${API_ROUTE_VERSION}/scenarios/:scenarioId`,
          auth: "Bearer obrigatório",
        },
        delete: {
          method: "DELETE",
          path: `/api/${API_ROUTE_VERSION}/scenarios/:scenarioId`,
          auth: "Bearer obrigatório",
        },
      },
    },
    docs: "Consulte README.md do repositório para o contrato completo.",
  });
}
