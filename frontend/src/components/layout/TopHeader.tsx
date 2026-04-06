"use client";

import { useAddAssetModal } from "@/contexts/AddAssetModalContext";

type Props = {
  onOpenSidebar: () => void;
  variant?: "default" | "simulator";
};

export function TopHeader({ onOpenSidebar, variant = "default" }: Props) {
  const { openAddAsset } = useAddAssetModal();
  const sim = variant === "simulator";

  return (
    <header className="sticky top-0 z-40 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-slate-950/50 px-3 py-2.5 backdrop-blur-xl sm:gap-3 sm:px-4 sm:py-3 md:px-8 md:py-3">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        {!sim ? (
          <button
            type="button"
            onClick={onOpenSidebar}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 md:hidden"
            aria-label="Abrir menu"
          >
            <span className="text-lg leading-none">☰</span>
          </button>
        ) : null}
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-white sm:text-base md:text-lg">
            {sim ? "Code Chroma" : "Painel"}
          </h1>
          <p className="hidden text-xs text-slate-300 sm:block">
            {sim
              ? "Simulação de cenários · IA + gráficos"
              : "Simulador global de risco · visão macro"}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={openAddAsset}
        className="shrink-0 rounded-xl bg-gradient-to-r from-cyan-500/90 to-violet-600/90 px-3 py-2 text-xs font-medium text-slate-950 shadow-neon transition hover:from-cyan-400 hover:to-violet-500 sm:px-4 sm:text-sm"
      >
        <span className="sm:hidden">+ Posição</span>
        <span className="hidden sm:inline">Nova posição</span>
      </button>
    </header>
  );
}
