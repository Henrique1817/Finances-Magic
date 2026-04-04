import { isAxiosError } from "axios";
import { api, messageFromApiError } from "@/lib/apiClient";

export type SimulationRunPayload = {
  energyCostIncrease: number;
  geoRiskLevel: number;
  aiDemandIncrease: number;
  portfolioValue: number;
};

export type SimulationRunData = {
  baselineValue: number;
  projectedPortfolioValue: number;
  changePercent: number;
  alerts: string[];
  breakdown: {
    afterSectorShocks: number;
    supplyChainPenaltyApplied: boolean;
  };
};

type ApiSuccess = {
  success: true;
  apiVersion: string;
  data: SimulationRunData;
};

type ApiError = {
  success: false;
  apiVersion?: string;
  error: string;
  details?: unknown;
};

export async function postSimulationRun(
  payload: SimulationRunPayload,
): Promise<SimulationRunData> {
  try {
    const { data: json } = await api.post<ApiSuccess>("/api/v1/simulation/run", payload);
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
    throw e instanceof Error ? e : new Error("Falha na simulação.");
  }
}
