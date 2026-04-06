import { getApiBaseUrl } from "@/config/api";

export type AiAccuracyTrendPoint = {
  ts: string;
  accuracyPct: number;
  validatedPredictions: number;
};

export type AiAccuracyByHorizon = {
  horizonDays: number;
  accuracyPct: number;
  validatedPredictions: number;
  totalPredictions: number;
  maePct: number | null;
  mapePct: number | null;
  trend: AiAccuracyTrendPoint[];
};

export type AiAccuracyData = {
  currentAccuracyPct: number;
  validatedPredictions: number;
  totalPredictions: number;
  trainingRows: number;
  minTrainingRows: number;
  trainingCoveragePct: number;
  trend: AiAccuracyTrendPoint[];
  byHorizon: AiAccuracyByHorizon[];
  updatedAt: string;
};

type ApiSuccess = {
  success: true;
  apiVersion: string;
  data: AiAccuracyData;
};

export async function fetchAiAccuracy(): Promise<AiAccuracyData> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/dashboard/ai-accuracy`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const body = (await res.json()) as ApiSuccess | { error?: string };
  if (!res.ok) {
    const msg = typeof body === "object" && body && "error" in body ? body.error : null;
    throw new Error(typeof msg === "string" && msg ? msg : `HTTP ${res.status}`);
  }
  if (!("success" in body) || !body.success) {
    throw new Error("Resposta inválida da API de acurácia.");
  }
  return body.data;
}
