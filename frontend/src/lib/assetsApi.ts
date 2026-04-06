import { isAxiosError } from "axios";
import { api, messageFromApiError } from "@/lib/apiClient";

export type AssetLastPrice = {
  assetId: string;
  symbol: string;
  name: string;
  close: number;
  date: string;
};

type LastPriceOneResponse = {
  success: true;
  data: { price: AssetLastPrice | null };
};

function toError(e: unknown): Error {
  if (isAxiosError(e)) {
    return new Error(messageFromApiError(e));
  }
  return e instanceof Error ? e : new Error("Erro desconhecido.");
}

/** Último fechamento no banco para o ticker (ingestão). */
export async function fetchAssetLastPrice(symbol: string): Promise<AssetLastPrice | null> {
  try {
    const { data } = await api.get<LastPriceOneResponse>("/api/v1/assets/last-price", {
      params: { symbol: symbol.trim() },
    });
    if (!data.success) throw new Error("Resposta inválida da API.");
    return data.data.price;
  } catch (e) {
    throw toError(e);
  }
}
