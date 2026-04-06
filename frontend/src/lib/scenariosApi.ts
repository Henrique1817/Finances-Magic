import { isAxiosError } from "axios";
import { api, messageFromApiError } from "@/lib/apiClient";
import type { AiScenarioResponse } from "@/lib/scenarioAiApi";

export type ScenarioListItem = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
};

type ApiListSuccess = {
  success: true;
  apiVersion: string;
  data: ScenarioListItem[];
};

type ApiDetailSuccess = {
  success: true;
  apiVersion: string;
  data: ScenarioDetailPayload;
};

type ApiError = {
  success: false;
  apiVersion?: string;
  error: string;
};

export type ScenarioDetailPayload = ScenarioListItem & AiScenarioResponse;

export async function fetchScenariosList(): Promise<ScenarioListItem[]> {
  try {
    const { data: json } = await api.get<ApiListSuccess>("/api/v1/scenarios");
    if (!json.success) throw new Error("Resposta inválida.");
    return json.data;
  } catch (e) {
    if (isAxiosError(e)) {
      const body = e.response?.data as ApiError | undefined;
      if (body && typeof body.error === "string") throw new Error(body.error);
      throw new Error(messageFromApiError(e));
    }
    throw e instanceof Error ? e : new Error("Falha ao carregar cenários.");
  }
}

export async function fetchScenarioDetail(id: string): Promise<ScenarioDetailPayload> {
  try {
    const { data: json } = await api.get<ApiDetailSuccess>(`/api/v1/scenarios/${encodeURIComponent(id)}`);
    if (!json.success) throw new Error("Resposta inválida.");
    return json.data as ScenarioDetailPayload;
  } catch (e) {
    if (isAxiosError(e)) {
      const body = e.response?.data as ApiError | undefined;
      if (body && typeof body.error === "string") throw new Error(body.error);
      throw new Error(messageFromApiError(e));
    }
    throw e instanceof Error ? e : new Error("Falha ao carregar o cenário.");
  }
}

type ApiDeleteSuccess = {
  success: true;
  apiVersion: string;
  data: { deleted: boolean };
};

export async function deleteScenario(id: string): Promise<void> {
  try {
    const { data: json } = await api.delete<ApiDeleteSuccess>(
      `/api/v1/scenarios/${encodeURIComponent(id)}`,
    );
    if (!json.success) throw new Error("Resposta inválida.");
  } catch (e) {
    if (isAxiosError(e)) {
      const body = e.response?.data as ApiError | undefined;
      if (body && typeof body.error === "string") throw new Error(body.error);
      throw new Error(messageFromApiError(e));
    }
    throw e instanceof Error ? e : new Error("Falha ao eliminar o cenário.");
  }
}
