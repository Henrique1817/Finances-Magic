"use client";

import { useEffect, useMemo, useRef, type MouseEvent } from "react";
import gsap from "gsap";
import { useWalletStore } from "@/store/useWalletStore";
import { TotalValueCounter } from "@/components/wallet/TotalValueCounter";

type CardMetric = {
  label: string;
  value: string;
  hint: string;
  tone: "cyan" | "violet" | "amber";
};

function pct(value: number) {
  return `${value.toFixed(1)}%`;
}

export function HomeOverviewPanel() {
  const portfolio = useWalletStore((s) => s.portfolio);
  const marketRows = useWalletStore((s) => s.marketLines);
  const walletReady = useWalletStore((s) => s.walletReady);
  const walletLoading = useWalletStore((s) => s.walletLoading);
  const fetchMarket = useWalletStore((s) => s.fetchMarket);
  const total = useWalletStore((s) => s.getTotalValue());

  const listReady = walletReady && !walletLoading;
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!listReady) return;
    void fetchMarket();
  }, [listReady, fetchMarket, portfolio.length]);

  const metrics = useMemo<CardMetric[]>(() => {
    const priced = marketRows.filter((row) => row.currentPrice != null).length;
    const missing = marketRows.filter((row) => row.missingReason != null).length;
    const coverage = marketRows.length === 0 ? 0 : (priced / marketRows.length) * 100;
    return [
      {
        label: "Ativos na carteira",
        value: String(portfolio.length),
        hint: "linhas sincronizadas",
        tone: "violet",
      },
      {
        label: "Cobertura de mercado",
        value: pct(coverage),
        hint: priced === 0 ? "aguardando preços" : `${priced} com preço atual`,
        tone: "amber",
      },
      {
        label: "Dados incompletos",
        value: String(missing),
        hint: missing > 0 ? "ativos sem histórico completo" : "todos ativos completos",
        tone: "cyan",
      },
    ];
  }, [marketRows, portfolio.length]);

  function toneClass(tone: CardMetric["tone"]) {
    if (tone === "amber") return "from-amber-300/10 to-amber-500/5";
    if (tone === "violet") return "from-violet-300/10 to-violet-500/5";
    return "from-cyan-300/10 to-cyan-500/5";
  }

  function onCardMove(index: number, event: MouseEvent<HTMLDivElement>) {
    const card = cardRefs.current[index];
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (event.clientX - cx) / rect.width;
    const dy = (event.clientY - cy) / rect.height;

    card.style.setProperty("--ice-x", `${((event.clientX - rect.left) / rect.width) * 100}%`);
    card.style.setProperty("--ice-y", `${((event.clientY - rect.top) / rect.height) * 100}%`);

    gsap.to(card, {
      x: -dx * 14,
      y: -dy * 14,
      rotateX: dy * -8,
      rotateY: dx * 10,
      duration: 0.28,
      ease: "power2.out",
      transformPerspective: 900,
      transformOrigin: "center",
    });
  }

  function onCardLeave(index: number) {
    const card = cardRefs.current[index];
    if (!card) return;
    gsap.to(card, {
      x: 0,
      y: 0,
      rotateX: 0,
      rotateY: 0,
      duration: 0.45,
      ease: "expo.out",
    });
  }

  return (
    <section ref={containerRef} className="space-y-5 sm:space-y-6">
      <div className="glass-panel relative overflow-hidden p-5 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_65%_18%,rgba(34,211,238,0.18),transparent_38%),radial-gradient(circle_at_25%_85%,rgba(168,85,247,0.14),transparent_32%)]" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300/80">
            Visão geral
          </p>
          <h2 className="mt-2 max-w-xl text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
            Simulador global de risco
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-slate-200 sm:text-lg">
            A home foca no status geral da conta. A carteira completa agora fica em uma página
            dedicada, mantendo este painel mais limpo e orientado a decisão.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article
          className="interactive-card glass-panel relative overflow-hidden p-4 sm:p-5"
          onMouseMove={(event) => onCardMove(0, event)}
          onMouseLeave={() => onCardLeave(0)}
          ref={(node) => {
            cardRefs.current[0] = node;
          }}
        >
          <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Saldo atual</p>
          <TotalValueCounter
            value={total}
            ready={listReady}
            className="mt-2 font-mono text-3xl font-bold tabular-nums text-cyan-200"
          />
          <p className="mt-2 text-xs text-emerald-200/85">ao vivo</p>
        </article>

        {metrics.map((metric, index) => (
          <article
            key={metric.label}
            className={`interactive-card glass-panel relative overflow-hidden bg-gradient-to-br ${toneClass(metric.tone)} p-4 sm:p-5`}
            onMouseMove={(event) => onCardMove(index + 1, event)}
            onMouseLeave={() => onCardLeave(index + 1)}
            ref={(node) => {
              cardRefs.current[index + 1] = node;
            }}
          >
            <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{metric.label}</p>
            <p className="mt-2 font-mono text-3xl font-bold text-white">{metric.value}</p>
            <p className="mt-2 text-xs text-slate-300">{metric.hint}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
