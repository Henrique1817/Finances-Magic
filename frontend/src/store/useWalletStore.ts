import { create } from "zustand";
import {
  deleteWalletAssetApi,
  fetchWalletFromApi,
  fetchWalletMarketFromApi,
  postWalletAssetApi,
  type WalletMarketLine,
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
  /** Preços e histórico da carteira (último fechamento + série). */
  marketLines: WalletMarketLine[];
  marketLoading: boolean;
  marketError: string | null;
  fetchWallet: () => Promise<void>;
  fetchMarket: () => Promise<void>;
  saveAssetToDb: (
    input: Omit<CarteiraAtivo, "id"> & { id?: string; assetId?: string | null },
  ) => Promise<void>;
  removeAsset: (id: string) => Promise<void>;
  /**
   * Valor total da carteira: para cada posição, `quantidade × preço de mercado` quando houver
   * último preço; caso contrário usa `valorInvestido` (custo informado).
   */
  getTotalValue: () => number;
  resetWallet: () => void;
};

export const useWalletStore = create<WalletState>()((set, get) => ({
  portfolio: [],
  walletLoading: false,
  walletReady: false,
  walletError: null,
  marketLines: [],
  marketLoading: false,
  marketError: null,

  resetWallet: () =>
    set({
      portfolio: [],
      walletLoading: false,
      walletReady: false,
      walletError: null,
      marketLines: [],
      marketLoading: false,
      marketError: null,
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
    void get().fetchMarket();
  },

  removeAsset: async (id) => {
    set({ walletError: null });
    try {
      await deleteWalletAssetApi(id);
      set((s) => ({
        portfolio: s.portfolio.filter((a) => a.id !== id),
      }));
      void get().fetchMarket();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha ao remover a posição.";
      set({ walletError: message });
      throw e;
    }
  },

  fetchMarket: async () => {
    const { walletReady, walletLoading, portfolio } = get();
    if (!walletReady || walletLoading) return;
    if (portfolio.length === 0) {
      set({ marketLines: [], marketLoading: false, marketError: null });
      return;
    }
    set({ marketLoading: true, marketError: null });
    try {
      const data = await fetchWalletMarketFromApi();
      set({ marketLines: data.market, marketLoading: false });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha ao carregar preços.";
      set({ marketLines: [], marketError: message, marketLoading: false });
    }
  },

  getTotalValue: () => {
    const { portfolio, marketLines } = get();
    const map = new Map(marketLines.map((m) => [m.id, m]));
    return portfolio.reduce((sum, p) => {
      const m = map.get(p.id);
      if (m?.currentPrice != null && Number.isFinite(m.currentPrice)) {
        return sum + p.quantidade * m.currentPrice;
      }
      return sum + p.valorInvestido;
    }, 0);
  },
}));
