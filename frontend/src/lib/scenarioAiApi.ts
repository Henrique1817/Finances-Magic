import { isAxiosError } from "axios";
import { api, messageFromApiError } from "@/lib/apiClient";

export type AiScenarioNarrative = {
  summary: string;
  factorsUsed: string[];
  perAsset: { label: string; impactSummary: string }[];
  disclaimer: string;
  riskNotes?: string[];
  evidence?: Array<{
    title: string;
    detail: string;
    relatedFactorId?: string;
    relatedAssetLabel?: string;
    confidence?: number;
  }>;
};

export type AiScenarioQuantLine = {
  walletAssetId: string;
  nome: string;
  assetSymbol: string | null;
  betaByFactor: Record<string, number>;
  combinedReturnDecimal: number;
  lineBaselineValue: number;
  lineProjectedValue: number;
};

export type AiScenarioQuant = {
  baselineValue: number;
  projectedPortfolioValue: number;
  portfolioReturnDecimal: number;
  perLine: AiScenarioQuantLine[];
  dataGaps: string[];
  dataAsOf: Record<string, string>;
};

export type AiScenarioParsedFactor = {
  catalogId: string;
  shockPercent: number;
  rationale?: string;
};

export type AiScenarioResponse = {
  narrative: AiScenarioNarrative;
  quant: AiScenarioQuant;
  parsedFactors: AiScenarioParsedFactor[];
  userIntentSummary: string | null;
};

/** Resposta do POST /ai/scenario após persistência no servidor. */
export type AiScenarioRunResponse = AiScenarioResponse & {
  scenarioId: string;
  title: string;
};

type ApiSuccess = {
  success: true;
  apiVersion: string;
  data: AiScenarioRunResponse;
};

type ApiError = {
  success: false;
  apiVersion?: string;
  error: string;
  details?: unknown;
};

export async function postAiScenario(message: string): Promise<AiScenarioRunResponse> {
  try {
    const { data: json } = await api.post<ApiSuccess>("/api/v1/ai/scenario", { message });
    if (!json.success) {
      throw new Error("Resposta inválida do servidor.");
    }
    return json.data;
  } catch (e) {
    if (isAxiosError(e)) {
      const body = e.response?.data as ApiError | undefined;
      if (body && typeof body.error === "string") {
        throw new Error(body.error);
      }
      throw new Error(messageFromApiError(e));
    }
    throw e instanceof Error ? e : new Error("Falha no cenário IA.");
  }
}
