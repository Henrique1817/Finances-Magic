"use client";

import { useAddAssetModal } from "@/contexts/AddAssetModalContext";

type Props = {
  onOpenSidebar: () => void;
};

export function TopHeader({ onOpenSidebar }: Props) {
  const { openAddAsset } = useAddAssetModal();

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-white/10 bg-slate-950/50 px-4 py-3 backdrop-blur-xl md:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 md:hidden"
          aria-label="Abrir menu"
        >
          <span className="text-lg leading-none">☰</span>
        </button>
        <div>
          <h1 className="text-base font-semibold text-white md:text-lg">
            Painel
          </h1>
          <p className="hidden text-xs text-slate-500 sm:block">
            Simulador global de risco · visão macro
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={openAddAsset}
        className="rounded-xl bg-gradient-to-r from-cyan-500/90 to-violet-600/90 px-4 py-2 text-sm font-medium text-slate-950 shadow-neon transition hover:from-cyan-400 hover:to-violet-500"
      >
        Nova posição
      </button>
    </header>
  );
}
