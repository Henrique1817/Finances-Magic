"use client";

import { useState } from "react";
import { useWalletStore } from "@/store/useWalletStore";
import { useAddAssetModal } from "@/contexts/AddAssetModalContext";
import { TotalValueCounter } from "./TotalValueCounter";
import { formatBRL } from "@/lib/formatBRL";

const sectorStyles: Record<string, string> = {
  Tech: "border-cyan-400/25 bg-cyan-400/10 text-cyan-200",
  Mineração: "border-amber-400/25 bg-amber-400/10 text-amber-100",
  Energia: "border-violet-400/25 bg-violet-400/10 text-violet-200",
};

export function WalletPanel() {
  const walletLoading = useWalletStore((s) => s.walletLoading);
  const walletReady = useWalletStore((s) => s.walletReady);
  const walletError = useWalletStore((s) => s.walletError);
  const portfolio = useWalletStore((s) => s.portfolio);
  const removeAsset = useWalletStore((s) => s.removeAsset);
  const { openAddAsset } = useAddAssetModal();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const listReady = walletReady && !walletLoading;

  const total = portfolio.reduce((sum, a) => sum + a.valorInvestido, 0);

  return (
    <section
      id="carteira"
      className="glass-panel scroll-mt-24 p-5 md:p-8"
      aria-labelledby="carteira-heading"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="carteira-heading"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/80"
          >
            Minha conta
          </h2>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-white md:text-3xl">
            Sua carteira
          </p>
          <p className="mt-2 max-w-xl text-base text-slate-200">
            Posições sincronizadas com a conta autenticada. Use o total como base
            nos cenários do simulador.
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <p className="text-xs uppercase tracking-wider text-slate-300">
            Valor total
          </p>
          <TotalValueCounter
            value={total}
            ready={listReady}
            className="font-mono text-3xl font-bold tabular-nums text-white md:text-4xl"
          />
          <button
            type="button"
            onClick={openAddAsset}
            className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 shadow-neon transition hover:border-cyan-300/50 hover:bg-cyan-400/20"
          >
            + Adicionar ativo
          </button>
        </div>
      </div>

      {walletError ? (
        <p
          className="mt-4 rounded-xl border border-rose-500/30 bg-rose-950/25 px-4 py-3 text-sm text-rose-200"
          role="alert"
        >
          {walletError}
        </p>
      ) : null}

      <div className="mt-8 overflow-hidden rounded-xl border border-white/10">
        <table className="w-full min-w-[520px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wider text-slate-300">
              <th className="px-4 py-3 font-medium">Ativo</th>
              <th className="px-4 py-3 font-medium">Setor</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">
                Qtd
              </th>
              <th className="px-4 py-3 font-medium">Valor (R$)</th>
              <th className="w-24 px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {!listReady ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-slate-300"
                >
                  Carregando carteira…
                </td>
              </tr>
            ) : portfolio.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-slate-300"
                >
                  Nenhum ativo. Adicione uma posição para começar.
                </td>
              </tr>
            ) : (
              portfolio.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-white/5 transition hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3 font-medium text-white">{a.nome}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-lg border px-2 py-0.5 text-xs font-medium ${sectorStyles[a.setor] ?? "border-white/20 bg-white/5"}`}
                    >
                      {a.setor}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-slate-200 sm:table-cell">
                    {a.quantidade}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-200">
                    {formatBRL(a.valorInvestido)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={removingId === a.id}
                      onClick={async () => {
                        setRemovingId(a.id);
                        try {
                          await removeAsset(a.id);
                        } catch {
                          /* erro já em walletError */
                        } finally {
                          setRemovingId(null);
                        }
                      }}
                      className="text-xs text-rose-400/90 underline-offset-2 hover:text-rose-300 hover:underline disabled:opacity-40"
                    >
                      {removingId === a.id ? "…" : "Remover"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
