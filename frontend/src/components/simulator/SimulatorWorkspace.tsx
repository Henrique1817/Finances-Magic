"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { useWalletStore } from "@/store/useWalletStore";
import { postSimulationRun, type SimulationRunData } from "@/lib/simulationApi";
import { postAiScenario, type AiScenarioQuant, type AiScenarioResponse } from "@/lib/scenarioAiApi";
import {
  fetchScenarioDetail,
  fetchScenariosList,
  type ScenarioListItem,
} from "@/lib/scenariosApi";
import { formatBRL } from "@/lib/formatBRL";
import { SimulatorAtmosphere } from "@/components/simulator/SimulatorAtmosphere";
import { ScenarioImpactCharts } from "@/components/simulator/ScenarioImpactCharts";

const CHIPS = [
  "E se o petróleo WTI cair 20%?",
  "Fed sobe juros 0,5 pp — impacto na minha carteira?",
  "VIX dispara 30% numa semana",
  "Dólar sobe 10% frente ao euro",
];

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
          <label htmlFor={id} className="text-base font-medium text-slate-100">
            {label}
          </label>
          <p className="text-sm text-slate-300">{hint}</p>
        </div>
        <span className="font-mono text-base tabular-nums text-cyan-200">
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

function riskToRgb(risk01: number) {
  const r = Math.round(16 + risk01 * 220);
  const g = Math.round(185 - risk01 * 150);
  const b = Math.round(129 - risk01 * 70);
  return `rgb(${r}, ${g}, ${b})`;
}

function heightsFromQuant(quant: AiScenarioQuant | null): number[] {
  if (!quant?.perLine?.length) return [];
  const raw = quant.perLine.map((l) =>
    Math.min(1, Math.abs(l.combinedReturnDecimal) * 8 + 0.12),
  );
  const mx = Math.max(...raw, 0.01);
  return raw.map((v: number) => v / mx);
}

export function SimulatorWorkspace() {
  const walletLoading = useWalletStore((s) => s.walletLoading);
  const walletReady = useWalletStore((s) => s.walletReady);
  const listReady = walletReady && !walletLoading;
  const portfolio = useWalletStore((s) => s.portfolio);
  const fetchMarket = useWalletStore((s) => s.fetchMarket);
  const portfolioValue = useWalletStore((s) => s.getTotalValue());
  const portfolioFingerprint = useMemo(
    () => portfolio.map((p) => p.id).join("|"),
    [portfolio],
  );

  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeResponse, setActiveResponse] = useState<AiScenarioResponse | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [railOpen, setRailOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    if (mq.matches) setRailOpen(true);
  }, []);

  const [draftMessage, setDraftMessage] = useState("");
  const [iaLoading, setIaLoading] = useState(false);
  const [iaError, setIaError] = useState<string | null>(null);

  const [energy, setEnergy] = useState(20);
  const [geo, setGeo] = useState(4);
  const [aiDemand, setAiDemand] = useState(15);
  const [stressOpen, setStressOpen] = useState(false);
  const [loadingStress, setLoadingStress] = useState(false);
  const [stressError, setStressError] = useState<string | null>(null);
  const [stressResult, setStressResult] = useState<SimulationRunData | null>(null);

  const mainRef = useRef<HTMLDivElement>(null);
  const projectedRef = useRef<HTMLDivElement>(null);
  const skipShake = useRef(true);

  const refreshScenariosList = useCallback(async () => {
    setListError(null);
    setListLoading(true);
    try {
      const rows = await fetchScenariosList();
      setScenarios(rows);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Não foi possível sincronizar os cenários.");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshScenariosList();
  }, [refreshScenariosList]);

  useEffect(() => {
    if (!listReady) return;
    void fetchMarket();
  }, [listReady, fetchMarket, portfolioFingerprint]);

  const displayResponse = detailLoading ? null : activeResponse;

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
    if (skipShake.current) {
      skipShake.current = false;
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

  function handleNewScenario() {
    setActiveId(null);
    setActiveResponse(null);
    setDraftMessage("");
    setIaError(null);
    setDetailError(null);
    setStressResult(null);
  }

  async function handleSelectScenario(id: string) {
    setActiveId(id);
    setIaError(null);
    setDetailError(null);
    setDetailLoading(true);
    setActiveResponse(null);
    try {
      const d = await fetchScenarioDetail(id);
      setDraftMessage(d.message);
      setActiveResponse({
        narrative: d.narrative,
        quant: d.quant,
        parsedFactors: d.parsedFactors,
        userIntentSummary: d.userIntentSummary,
      });
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Falha ao abrir o cenário.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function runScenarioIa() {
    setIaError(null);
    const msg = draftMessage.trim();
    if (!msg) {
      setIaError("Descreva um cenário possível para analisarmos o impacto na carteira.");
      return;
    }
    setIaLoading(true);
    try {
      const run = await postAiScenario(msg);
      setActiveResponse({
        narrative: run.narrative,
        quant: run.quant,
        parsedFactors: run.parsedFactors,
        userIntentSummary: run.userIntentSummary,
      });
      setActiveId(run.scenarioId);
      await refreshScenariosList();

      const tgt = mainRef.current?.querySelector("[data-scenario-result]");
      if (tgt) {
        gsap.fromTo(
          tgt,
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", delay: 0.05 },
        );
      }
    } catch (e) {
      setIaError(e instanceof Error ? e.message : "Falha ao analisar o cenário.");
    } finally {
      setIaLoading(false);
    }
  }

  async function handleStressRun() {
    setStressError(null);
    if (portfolioValue <= 0) {
      setStressError("Inclua posições na carteira (com preço de mercado ou valor informado).");
      return;
    }
    setLoadingStress(true);
    setStressResult(null);
    try {
      const data = await postSimulationRun({
        energyCostIncrease: energy,
        geoRiskLevel: geo,
        aiDemandIncrease: aiDemand,
        portfolioValue,
      });
      setStressResult(data);
    } catch (e) {
      setStressError(e instanceof Error ? e.message : "Falha na simulação clássica.");
    } finally {
      setLoadingStress(false);
    }
  }

  const canStress = listReady && portfolioValue > 0;
  const barHeights = heightsFromQuant(displayResponse?.quant ?? null);

  return (
    <div className="flex w-full min-h-0 flex-1 bg-[#020617] text-slate-100">
      {/* Rail cenários — mobile: drawer; desktop: coluna colapsável */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-[min(86vw,280px)] flex-col border-r border-white/10 bg-slate-950/95 backdrop-blur-xl transition-transform duration-300 md:static md:z-20 md:bg-slate-950/90 ${
          railOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${railOpen ? "md:w-[min(100%,280px)]" : "md:w-14"}`}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 md:p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setRailOpen((o) => !o)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10"
              aria-label={railOpen ? "Fechar lista de cenários" : "Abrir lista de cenários"}
            >
              ☰
            </button>
            {railOpen ? (
              <span className="truncate text-xs font-semibold uppercase tracking-wider text-slate-500">
                Cenários
              </span>
            ) : null}
          </div>

          {railOpen ? (
            <>
              <button
                type="button"
                onClick={() => {
                  handleNewScenario();
                  if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
                    setRailOpen(false);
                  }
                }}
                className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/10 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
              >
                <span className="text-lg leading-none">+</span>
                Novo cenário
              </button>
              <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
                {listError ? (
                  <div className="space-y-2 px-2">
                    <p className="text-xs text-rose-300">{listError}</p>
                    <button
                      type="button"
                      onClick={() => void refreshScenariosList()}
                      className="text-xs text-cyan-400 underline"
                    >
                      Tentar novamente
                    </button>
                  </div>
                ) : listLoading ? (
                  <p className="px-2 text-sm text-slate-300">A sincronizar com o servidor…</p>
                ) : scenarios.length === 0 ? (
                  <p className="px-2 text-sm leading-relaxed text-slate-300">
                    Nenhum cenário na conta. Envie uma análise abaixo — fica guardada no servidor.
                  </p>
                ) : (
                  scenarios.map((s) => {
                    const active = s.id === activeId;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          void handleSelectScenario(s.id);
                          if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
                            setRailOpen(false);
                          }
                        }}
                        className={`flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left text-base transition ${
                          active
                            ? "bg-gradient-to-r from-cyan-500/20 to-violet-600/15 text-white"
                            : "text-slate-200 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <span className="mt-0.5 text-slate-600" aria-hidden>
                          📌
                        </span>
                        <span className="line-clamp-2">{s.title}</span>
                      </button>
                    );
                  })
                )}
              </nav>
              <Link
                href="/"
                className="mt-4 block rounded-xl border border-white/10 px-3 py-2 text-center text-xs text-slate-400 transition hover:border-cyan-500/25 hover:text-slate-200"
              >
                ← Painel
              </Link>
            </>
          ) : (
            <div className="hidden flex-1 flex-col items-center pt-2 md:flex">
              <span className="text-[10px] text-slate-600 [writing-mode:vertical-rl]">Cenários</span>
            </div>
          )}
        </div>
      </aside>

      {railOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-slate-950/70 backdrop-blur-sm md:hidden"
          aria-label="Fechar menu de cenários"
          onClick={() => setRailOpen(false)}
        />
      ) : null}

      <div ref={mainRef} className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <SimulatorAtmosphere barHeights={barHeights} />
        <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(circle_at_50%_10%,rgba(15,23,42,0)_0%,rgba(2,6,23,0.65)_48%,rgba(2,6,23,0.95)_100%)]" />

        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-28 pt-8 md:px-8 md:pb-32 md:pt-12">
            <div className="mb-2 flex items-center justify-between gap-3 md:hidden">
              <button
                type="button"
                onClick={() => setRailOpen(true)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300"
              >
                Cenários
              </button>
              <span className="text-xs font-semibold uppercase tracking-wider text-violet-400/80">
                Code Chroma
              </span>
            </div>

            <p className="text-center text-sm font-semibold uppercase tracking-[0.25em] text-slate-300">
              Simulação inteligente
            </p>
            <h2 className="mt-3 text-center text-3xl font-semibold text-white md:text-4xl">
              Olá. Que cenário quer testar?
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-center text-base text-slate-200">
              Descreva um evento possível (mercado, macro, geopolítica). A Code Chroma estima o
              impacto na sua carteira e mostra gráficos interativos — não é recomendação de
              investimento.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setDraftMessage(c)}
                  className="rounded-full border border-white/15 bg-slate-900/75 px-4 py-2 text-sm text-slate-100 shadow-[0_8px_20px_rgba(2,6,23,0.45)] transition hover:-translate-y-0.5 hover:border-cyan-400/40 hover:text-white"
                >
                  {c}
                </button>
              ))}
            </div>

            <div data-scenario-result className="mt-10 space-y-6">
              {detailError ? (
                <p
                  className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-base text-rose-100"
                  role="alert"
                >
                  {detailError}
                </p>
              ) : null}
              {detailLoading ? (
                <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 py-16 text-base text-slate-200">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
                  A carregar cenário…
                </div>
              ) : null}
              {!detailLoading && displayResponse?.quant ? (
                <ScenarioImpactCharts quant={displayResponse.quant} />
              ) : null}

              {!detailLoading && displayResponse ? (
                <div className="rounded-2xl border border-white/15 bg-slate-950/70 p-5 shadow-[0_16px_50px_rgba(2,6,23,0.7)] backdrop-blur-xl">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                    Leitura IA
                  </h3>
                  <p className="mt-2 text-base text-slate-100">{displayResponse.narrative.summary}</p>
                  {displayResponse.narrative.factorsUsed.length > 0 ? (
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                        Fatores
                      </p>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {displayResponse.narrative.factorsUsed.map((f) => (
                          <li
                            key={f}
                            className="rounded-lg bg-slate-900/80 px-2 py-1 font-mono text-xs text-cyan-100"
                          >
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {displayResponse.narrative.evidence && displayResponse.narrative.evidence.length > 0 ? (
                    <div className="mt-4 border-t border-white/10 pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                        Provas do cenário
                      </p>
                      <ul className="mt-2 space-y-2">
                        {displayResponse.narrative.evidence.map((ev, idx) => (
                          <li key={`${ev.title}-${idx}`} className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
                            <p className="text-sm font-semibold text-cyan-100">{ev.title}</p>
                            <p className="mt-1 text-sm text-slate-200">{ev.detail}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                              {ev.relatedFactorId ? <span>Fator: {ev.relatedFactorId}</span> : null}
                              {ev.relatedAssetLabel ? <span>Ativo: {ev.relatedAssetLabel}</span> : null}
                              {typeof ev.confidence === "number" ? (
                                <span>Confiança: {(ev.confidence * 100).toFixed(0)}%</span>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <p className="mt-4 border-t border-white/10 pt-3 text-sm text-amber-100">
                    {displayResponse.narrative.disclaimer}
                  </p>
                </div>
              ) : null}

              {stressResult ? (
                <div className="rounded-2xl border border-violet-500/20 bg-violet-950/20 p-5">
                  <h3 className="text-sm font-semibold text-violet-200">Stress clássico (sliders)</h3>
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-slate-300">Projetado</dt>
                      <dd className="font-mono text-slate-100">
                        {formatBRL(stressResult.projectedPortfolioValue)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-300">Variação</dt>
                      <dd className="font-mono text-slate-100">
                        {stressResult.changePercent >= 0 ? "+" : ""}
                        {stressResult.changePercent.toFixed(2)}%
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : null}
            </div>
          </div>

          {/* Input bar — estilo Gemini */}
          <div className="sticky bottom-0 z-20 border-t border-white/10 bg-slate-950/88 px-4 py-4 backdrop-blur-xl md:px-8">
            <div className="mx-auto max-w-3xl space-y-3">
              {iaError ? (
                <p className="rounded-lg border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
                  {iaError}
                </p>
              ) : null}
              <div className="flex items-end gap-2 rounded-2xl border border-white/15 bg-slate-900/85 p-2 shadow-[0_12px_40px_rgba(2,6,23,0.6),0_0_30px_rgba(34,211,238,0.08)]">
                <textarea
                  value={draftMessage}
                  onChange={(e) => setDraftMessage(e.target.value)}
                  rows={2}
                  maxLength={4000}
                  placeholder="Descreva o cenário possível…"
                  className="max-h-40 min-h-[44px] flex-1 resize-y bg-transparent px-3 py-2 text-base text-slate-100 placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  type="button"
                  disabled={iaLoading}
                  onClick={() => void runScenarioIa()}
                  className="mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 text-lg font-bold text-slate-950 shadow-lg transition enabled:hover:opacity-95 disabled:opacity-40"
                  aria-label="Analisar cenário"
                >
                  {iaLoading ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-900/40 border-t-slate-900" />
                  ) : (
                    "→"
                  )}
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                <span>
                  Carteira (mercado):{" "}
                  <span className="font-mono text-slate-100">
                    {!listReady ? "…" : formatBRL(portfolioValue)}
                  </span>
                </span>
                <span>{draftMessage.length}/4000</span>
              </div>

              <button
                type="button"
                onClick={() => setStressOpen((o) => !o)}
                className="text-sm text-slate-300 underline decoration-slate-500 underline-offset-2 hover:text-slate-100"
              >
                {stressOpen ? "Ocultar" : "Mostrar"} simulação por sliders (modo clássico)
              </button>

              {stressOpen ? (
                <div className="space-y-4 rounded-xl border border-white/10 bg-slate-900/50 p-4">
                  <SliderRow
                    id="sw-energy"
                    label="Custo de energia"
                    hint="Choque sobre margens (tech)."
                    min={0}
                    max={100}
                    step={1}
                    value={energy}
                    onChange={setEnergy}
                    suffix="%"
                  />
                  <SliderRow
                    id="sw-geo"
                    label="Risco geopolítico"
                    hint="1–10"
                    min={1}
                    max={10}
                    step={1}
                    value={geo}
                    onChange={setGeo}
                  />
                  <SliderRow
                    id="sw-ai"
                    label="Demanda IA"
                    hint="Correlação tech / mineração."
                    min={0}
                    max={100}
                    step={1}
                    value={aiDemand}
                    onChange={setAiDemand}
                    suffix="%"
                  />
                  <div
                    ref={projectedRef}
                    className="rounded-xl border-2 border-emerald-500/30 bg-slate-950/50 px-4 py-3"
                    style={{ willChange: "transform" }}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Pré-visualização património
                    </p>
                    <p className="mt-1 font-mono text-lg text-white">{formatBRL(portfolioValue)}</p>
                  </div>
                  {stressError ? (
                    <p className="text-xs text-rose-300">{stressError}</p>
                  ) : null}
                  <button
                    type="button"
                    disabled={!canStress || loadingStress}
                    onClick={() => void handleStressRun()}
                    className="w-full rounded-xl bg-white/10 py-2.5 text-sm font-medium text-slate-200 transition enabled:hover:bg-white/15 disabled:opacity-40"
                  >
                    {loadingStress ? "A calcular…" : "Correr stress clássico"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
