"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useWalletStore } from "@/store/useWalletStore";
import { postSimulationRun, type SimulationRunData } from "@/lib/simulationApi";
import { formatBRL } from "@/lib/formatBRL";

type SliderProps = {
  id: string;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
};

function SliderRow({
  id,
  label,
  hint,
  min,
  max,
  step,
  value,
  onChange,
  suffix,
}: SliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <label
            htmlFor={id}
            className="text-sm font-medium text-slate-200"
          >
            {label}
          </label>
          <p className="text-xs text-slate-500">{hint}</p>
        </div>
        <span className="font-mono text-sm tabular-nums text-cyan-300">
          {value}
          {suffix ?? ""}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-cyan-400"
      />
    </div>
  );
}

/** 0 = seguro (verde), 1 = risco (vermelho). */
function riskToRgb(risk01: number) {
  const r = Math.round(16 + risk01 * 220);
  const g = Math.round(185 - risk01 * 150);
  const b = Math.round(129 - risk01 * 70);
  return `rgb(${r}, ${g}, ${b})`;
}

export function SimulatorPanel() {
  const walletLoading = useWalletStore((s) => s.walletLoading);
  const walletReady = useWalletStore((s) => s.walletReady);
  const listReady = walletReady && !walletLoading;
  const portfolio = useWalletStore((s) => s.portfolio);
  const portfolioValue = useMemo(
    () => portfolio.reduce((sum, a) => sum + a.valorInvestido, 0),
    [portfolio],
  );

  const [energy, setEnergy] = useState(20);
  const [geo, setGeo] = useState(4);
  const [aiDemand, setAiDemand] = useState(15);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulationRunData | null>(null);

  const projectedRef = useRef<HTMLDivElement>(null);
  const skipShakeOnMount = useRef(true);

  const risk01 = useMemo(() => {
    const e = energy / 100;
    const g = (geo - 1) / 9;
    const a = aiDemand / 100;
    return Math.min(1, Math.max(0, (e + g + a) / 3));
  }, [energy, geo, aiDemand]);

  const applyRiskVisual = useCallback(() => {
    const el = projectedRef.current;
    if (!el) return;

    gsap.killTweensOf(el);
    const border = riskToRgb(risk01);
    const glow = `0 0 32px rgba(${16 + risk01 * 200}, ${80 - risk01 * 40}, ${100 - risk01 * 30}, ${0.15 + risk01 * 0.35})`;

    gsap.to(el, {
      borderColor: border,
      boxShadow: glow,
      duration: 0.45,
      ease: "power2.out",
    });

    if (skipShakeOnMount.current) {
      skipShakeOnMount.current = false;
      return;
    }

    gsap
      .timeline()
      .to(el, { x: 6, duration: 0.045, ease: "power1.out" })
      .to(el, { x: -5, duration: 0.07, ease: "power1.inOut" })
      .to(el, { x: 3, duration: 0.05, ease: "power1.inOut" })
      .to(el, { x: 0, duration: 0.06, ease: "power2.out" });
  }, [risk01]);

  useEffect(() => {
    applyRiskVisual();
  }, [energy, geo, aiDemand, applyRiskVisual]);

  async function handleAnalyze() {
    setError(null);
    if (portfolioValue <= 0) {
      setError(
        "Adicione ativos à carteira com valor investido maior que zero para rodar a simulação.",
      );
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const data = await postSimulationRun({
        energyCostIncrease: energy,
        geoRiskLevel: geo,
        aiDemandIncrease: aiDemand,
        portfolioValue,
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao analisar risco.");
    } finally {
      setLoading(false);
    }
  }

  const canRun = listReady && portfolioValue > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="glass-panel space-y-8 p-6 md:p-8">
        <div>
          <h2 className="text-lg font-semibold text-white md:text-xl">
            Cenários de stress
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Ajuste os eixos do cenário. O painel de patrimônio reage em tempo
            real; o botão envia os parâmetros para o motor no backend.
          </p>
        </div>

        <div className="space-y-6">
          <SliderRow
            id="stress-energy"
            label="Custo de energia"
            hint="Choque sobre margens (especialmente tech)."
            min={0}
            max={100}
            step={1}
            value={energy}
            onChange={setEnergy}
            suffix="%"
          />
          <SliderRow
            id="stress-geo"
            label="Risco geopolítico"
            hint="Escala 1–10 (supply chain acima de 7)."
            min={1}
            max={10}
            step={1}
            value={geo}
            onChange={setGeo}
          />
          <SliderRow
            id="stress-ai"
            label="Demanda de IA"
            hint="Impulso correlacionado a tech e mineração."
            min={0}
            max={100}
            step={1}
            value={aiDemand}
            onChange={setAiDemand}
            suffix="%"
          />
        </div>

        <div
          ref={projectedRef}
          className="rounded-2xl border-2 border-emerald-500/40 bg-slate-950/40 px-5 py-5 md:px-6"
          style={{
            willChange: "transform",
            boxShadow: "0 0 24px rgba(34, 197, 94, 0.12)",
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Patrimônio projetado (pré-run)
          </p>
          <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-white md:text-3xl">
            {formatBRL(portfolioValue)}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Base: soma dos valores investidos na sua carteira. Após
            &quot;Analisar risco&quot;, veja o valor projetado abaixo.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Carteira:{" "}
            <span className="font-mono text-slate-300">
              {!listReady ? "…" : formatBRL(portfolioValue)}
            </span>
            {!canRun && listReady ? (
              <span className="block text-amber-400/90">
                Inclua posições com valor &gt; 0 na carteira.
              </span>
            ) : null}
          </p>
          <button
            type="button"
            disabled={!canRun || loading}
            onClick={handleAnalyze}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-neon transition enabled:hover:from-cyan-400 enabled:hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {loading ? (
              <>
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-slate-900/30 border-t-slate-900"
                  aria-hidden
                />
                <span>Analisando…</span>
              </>
            ) : (
              "Analisar risco"
            )}
          </button>
        </div>

        {error ? (
          <p
            className="rounded-xl border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-200"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>

      {result ? (
        <div className="glass-panel space-y-4 p-6 md:p-8">
          <h3 className="text-base font-semibold text-white">
            Resultado do motor
          </h3>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Baseline</dt>
              <dd className="font-mono text-lg text-slate-200">
                {formatBRL(result.baselineValue)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Projetado</dt>
              <dd
                className={`font-mono text-lg ${
                  result.changePercent >= 0 ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {formatBRL(result.projectedPortfolioValue)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Variação</dt>
              <dd className="font-mono text-lg text-slate-200">
                {result.changePercent >= 0 ? "+" : ""}
                {result.changePercent.toFixed(2)}%
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Supply chain</dt>
              <dd className="text-slate-300">
                {result.breakdown.supplyChainPenaltyApplied
                  ? "Penalidade aplicada"
                  : "Sem penalidade extra"}
              </dd>
            </div>
          </dl>
          {result.alerts.length > 0 ? (
            <ul className="list-inside list-disc space-y-1 text-sm text-amber-200/90">
              {result.alerts.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
