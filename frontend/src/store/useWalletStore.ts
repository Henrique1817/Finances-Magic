import { create } from "zustand";
import {
  deleteWalletAssetApi,
  fetchWalletFromApi,
  postWalletAssetApi,
} from "@/lib/walletApi";

export type SetorAtivo = "Tech" | "Mineração" | "Energia";

export type CarteiraAtivo = {
  id: string;
  nome: string;
  setor: SetorAtivo;
  /** Valor monetário da posição (ex.: BRL investido ou valor de mercado da linha). */
  valorInvestido: number;
  quantidade: number;
};

type WalletState = {
  portfolio: CarteiraAtivo[];
  walletLoading: boolean;
  /** `true` após a primeira tentativa de `fetchWallet` (sucesso ou erro). */
  walletReady: boolean;
  walletError: string | null;
  fetchWallet: () => Promise<void>;
  saveAssetToDb: (
    input: Omit<CarteiraAtivo, "id"> & { id?: string; assetId?: string | null },
  ) => Promise<void>;
  removeAsset: (id: string) => Promise<void>;
  /** Soma de `valorInvestido` de todas as posições. */
  getTotalValue: () => number;
  resetWallet: () => void;
};

export const useWalletStore = create<WalletState>()((set, get) => ({
  portfolio: [],
  walletLoading: false,
  walletReady: false,
  walletError: null,

  resetWallet: () =>
    set({
      portfolio: [],
      walletLoading: false,
      walletReady: false,
      walletError: null,
    }),

  fetchWallet: async () => {
    set({ walletLoading: true, walletError: null });
    try {
      const portfolio = await fetchWalletFromApi();
      set({ portfolio, walletLoading: false, walletReady: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha ao carregar a carteira.";
      set({
        portfolio: [],
        walletError: message,
        walletLoading: false,
        walletReady: true,
      });
    }
  },

  saveAssetToDb: async (input) => {
    set({ walletError: null });
    const { assetId, ...rest } = input;
    const row = await postWalletAssetApi({
      nome: rest.nome,
      setor: rest.setor,
      valorInvestido: rest.valorInvestido,
      quantidade: rest.quantidade,
      assetId: assetId ?? undefined,
    });
    set((s) => ({ portfolio: [...s.portfolio, row] }));
  },

  removeAsset: async (id) => {
    set({ walletError: null });
    try {
      await deleteWalletAssetApi(id);
      set((s) => ({
        portfolio: s.portfolio.filter((a) => a.id !== id),
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha ao remover a posição.";
      set({ walletError: message });
      throw e;
    }
  },

  getTotalValue: () =>
    get().portfolio.reduce((sum, a) => sum + a.valorInvestido, 0),
}));
