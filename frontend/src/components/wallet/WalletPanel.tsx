"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
  const marketRows = useWalletStore((s) => s.marketLines);
  const marketLoading = useWalletStore((s) => s.marketLoading);
  const marketError = useWalletStore((s) => s.marketError);
  const fetchMarket = useWalletStore((s) => s.fetchMarket);
  const total = useWalletStore((s) => s.getTotalValue());
  const { openAddAsset } = useAddAssetModal();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const windowDays = 90;
  const listReady = walletReady && !walletLoading;

  const portfolioFingerprint = useMemo(
    () => portfolio.map((p) => p.id).join("|"),
    [portfolio],
  );
  const marketByWalletId = useMemo(
    () => new Map(marketRows.map((r) => [r.id, r])),
    [marketRows],
  );
  const missingDataCount = useMemo(
    () => marketRows.filter((r) => r.missingReason !== null).length,
    [marketRows],
  );

  useEffect(() => {
    if (!listReady) return;
    void fetchMarket();
  }, [listReady, portfolioFingerprint, fetchMarket]);

  function formatPrice(value: number | null) {
    if (value === null) return "Sem preço";
    return value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return (
    <section
      id="carteira"
      className="glass-panel scroll-mt-24 p-4 sm:p-5 md:p-8"
      aria-labelledby="carteira-heading"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2
            id="carteira-heading"
            className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/80"
          >
            Minha conta
          </h2>
          <p className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl md:text-3xl">
            Sua carteira
          </p>
          <p className="mt-2 max-w-xl text-sm text-slate-200 sm:text-base">
            Posições sincronizadas com a conta autenticada. O total usa preço de mercado
            (último fechamento ingerido) × quantidade quando disponível.
          </p>
        </div>
        <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:items-end">
          <p className="text-xs uppercase tracking-wider text-slate-300">
            Valor total (mercado)
          </p>
          <TotalValueCounter
            value={total}
            ready={listReady}
            className="font-mono text-2xl font-bold tabular-nums text-white sm:text-3xl md:text-4xl"
          />
          <button
            type="button"
            onClick={openAddAsset}
            className="w-full rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-sm font-medium text-cyan-100 shadow-neon transition hover:border-cyan-300/50 hover:bg-cyan-400/20 sm:w-auto"
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

      <div className="mt-6 sm:mt-8 overflow-hidden rounded-xl border border-white/10">
        <p className="border-b border-white/10 bg-slate-950/40 px-3 py-2 text-[11px] text-slate-400 sm:hidden">
          Deslize horizontalmente para ver todas as colunas.
        </p>
        <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
        <table className="w-full min-w-[720px] border-collapse text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wider text-slate-300">
              <th className="px-4 py-3 font-medium">Ativo</th>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Setor</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">
                Qtd
              </th>
              <th className="px-4 py-3 font-medium">Custo (R$)</th>
              <th className="px-4 py-3 font-medium">Valor mercado</th>
              <th className="px-4 py-3 font-medium">Preço atual</th>
              <th className="w-24 px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {!listReady ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-slate-300"
                >
                  Carregando carteira…
                </td>
              </tr>
            ) : portfolio.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
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
                  <td className="px-4 py-3 text-slate-100">
                    {marketByWalletId.get(a.id)?.assetSymbol ? (
                      <span>
                        {marketByWalletId.get(a.id)?.assetName ?? a.nome}{" "}
                        <span className="font-mono text-cyan-200">
                          ({marketByWalletId.get(a.id)?.assetSymbol})
                        </span>
                      </span>
                    ) : (
                      <span className="text-amber-200/85">Sem vínculo com catálogo</span>
                    )}
                  </td>
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
                  <td className="px-4 py-3 font-mono text-slate-100">
                    {(() => {
                      const px = marketByWalletId.get(a.id)?.currentPrice;
                      if (px == null) return "—";
                      return formatBRL(px * a.quantidade);
                    })()}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-100">
                    {formatPrice(marketByWalletId.get(a.id)?.currentPrice ?? null)}
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
      </div>

      <div className="mt-6 sm:mt-8">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
          <h3 className="text-base font-semibold text-white sm:text-lg">Histórico por ativo</h3>
          <p className="text-xs text-slate-300">Janela: últimos {windowDays} dias</p>
        </div>

        {marketError ? (
          <p className="mb-4 rounded-xl border border-rose-500/30 bg-rose-950/25 px-4 py-3 text-sm text-rose-200">
            {marketError}
          </p>
        ) : null}

        {listReady && !marketLoading && marketRows.length > 0 && missingDataCount > 0 ? (
          <p className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {missingDataCount} ativo(s) sem preço atual e/ou histórico suficiente. Eu destaquei isso
            em cada card abaixo.
          </p>
        ) : null}

        {marketLoading ? (
          <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-10 text-center text-slate-300">
            Carregando preços e histórico dos ativos...
          </div>
        ) : marketRows.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-10 text-center text-slate-300">
            Sem dados de mercado para exibir.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {marketRows.map((row) => (
              <article
                key={row.id}
                className="min-w-0 rounded-xl border border-white/10 bg-slate-950/50 p-3 sm:p-4"
              >
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      {row.assetName ?? row.nome}
                      {row.assetSymbol ? (
                        <span className="ml-2 font-mono text-cyan-200">({row.assetSymbol})</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-slate-300">
                      {row.currentPriceDate
                        ? `Preço atual (${row.currentPriceDate}): ${formatPrice(row.currentPrice)}`
                        : "Preço atual indisponível"}
                    </p>
                  </div>
                  <span
                    className={`self-start rounded-md px-2 py-1 text-[11px] sm:self-auto ${
                      row.missingReason
                        ? "bg-amber-500/15 text-amber-100"
                        : "bg-emerald-500/15 text-emerald-200"
                    }`}
                  >
                    {row.missingReason ? "Dados incompletos" : "Dados OK"}
                  </span>
                </div>

                {row.history.length > 1 ? (
                  <div className="h-40 w-full sm:h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={row.history} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.7} />
                        <XAxis dataKey="date" tick={{ fill: "#cbd5e1", fontSize: 11 }} hide />
                        <YAxis
                          tick={{ fill: "#cbd5e1", fontSize: 11 }}
                          width={64}
                          tickFormatter={(v) => Number(v).toFixed(2)}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "#0f172a",
                            border: "1px solid rgba(148,163,184,0.25)",
                            borderRadius: 12,
                          }}
                          labelStyle={{ color: "#e2e8f0" }}
                          formatter={(value: number) => [formatPrice(value), "Preço"]}
                        />
                        <Line
                          type="monotone"
                          dataKey="close"
                          stroke="#22d3ee"
                          strokeWidth={2.2}
                          dot={false}
                          activeDot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
                    {row.missingReason ?? "Sem histórico suficiente para montar gráfico."}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
