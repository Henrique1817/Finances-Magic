import { isAxiosError } from "axios";
import { api, messageFromApiError } from "@/lib/apiClient";
import type { CarteiraAtivo, SetorAtivo } from "@/store/useWalletStore";

type WalletGetResponse = {
  success: true;
  data: { portfolio: CarteiraAtivo[] };
};

type WalletPostResponse = {
  success: true;
  data: { asset: CarteiraAtivo };
};

function toError(e: unknown): Error {
  if (isAxiosError(e)) {
    return new Error(messageFromApiError(e));
  }
  return e instanceof Error ? e : new Error("Erro desconhecido.");
}

export async function fetchWalletFromApi(): Promise<CarteiraAtivo[]> {
  try {
    const { data } = await api.get<WalletGetResponse>("/api/v1/wallet");
    if (!data.success) throw new Error("Resposta inválida da API.");
    return data.data.portfolio.map((row) => ({
      ...row,
      setor: row.setor as SetorAtivo,
    }));
  } catch (e) {
    throw toError(e);
  }
}

export async function postWalletAssetApi(body: {
  nome: string;
  setor: SetorAtivo;
  valorInvestido: number;
  quantidade: number;
  assetId?: string | null;
}): Promise<CarteiraAtivo> {
  try {
    const { data } = await api.post<WalletPostResponse>("/api/v1/wallet/assets", body);
    if (!data.success) throw new Error("Resposta inválida da API.");
    return { ...data.data.asset, setor: data.data.asset.setor as SetorAtivo };
  } catch (e) {
    throw toError(e);
  }
}

export async function deleteWalletAssetApi(lineId: string): Promise<void> {
  try {
    await api.delete(`/api/v1/wallet/assets/${lineId}`);
  } catch (e) {
    throw toError(e);
  }
}
