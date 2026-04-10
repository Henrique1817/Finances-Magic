"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";
import { useWalletStore } from "@/store/useWalletStore";
import { postSimulationRun, type SimulationRunData } from "@/lib/simulationApi";
import { postAiScenario, type AiScenarioResponse } from "@/lib/scenarioAiApi";
import {
  fetchScenarioDetail,
  fetchScenariosList,
  type ScenarioListItem,
} from "@/lib/scenariosApi";
import { formatBRL } from "@/lib/formatBRL";
import { hasWakePhrase } from "@/lib/voiceMake";
import { useVoiceStore } from "@/store/useVoiceStore";
import { ScenarioImpactCharts } from "@/components/simulator/ScenarioImpactCharts";
import { Layout } from "@/components/simulator/Layout";

const VISUAL_SCENE_EVENT = "codechroma:visual-scene";
const VISUAL_BEAT_EVENT = "codechroma:visual-beat";
const WAKE_COOLDOWN_MS = 2200;
const COMMAND_TIMEOUT_MS = 18000;
const COMMAND_SILENCE_MS = 2200;

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

type SpeechRecognitionErrorEventLike = Event & {
  error?: string;
};

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

type WindowWithSpeech = Window & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

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

  const setMicPermissionGranted = useVoiceStore(
    (s) => s.setMicPermissionGranted,
  );
  const setIsWakeArmed = useVoiceStore((s) => s.setIsWakeArmed);
  const setIsListening = useVoiceStore((s) => s.setIsListening);
  const setLastTranscript = useVoiceStore((s) => s.setLastTranscript);
  const micPermissionGranted = useVoiceStore((s) => s.micPermissionGranted);
  const isWakeArmed = useVoiceStore((s) => s.isWakeArmed);
  const isListening = useVoiceStore((s) => s.isListening);

  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeResponse, setActiveResponse] =
    useState<AiScenarioResponse | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [railOpen, setRailOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    if (mq.matches) setRailOpen(true);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
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
  const [stressResult, setStressResult] = useState<SimulationRunData | null>(
    null,
  );
  const [cinematicMode, setCinematicMode] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [wakeRestartTick, setWakeRestartTick] = useState(0);

  const mainRef = useRef<HTMLDivElement>(null);
  const projectedRef = useRef<HTMLDivElement>(null);
  const skipShake = useRef(true);
  const sceneTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const permissionAskedRef = useRef(false);
  const wakeRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const commandRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const commandTimeoutRef = useRef<number | null>(null);
  const commandSilenceTimeoutRef = useRef<number | null>(null);
  const commandBufferRef = useRef("");
  const cooldownRef = useRef(0);
  const draftMessageRef = useRef("");
  const runScenarioFromVoiceRef = useRef<(text: string) => void>(() => undefined);

  const playConfirmBeep = useCallback(() => {
    if (typeof window === "undefined") return;
    const AudioCtor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = new AudioCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = 900;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.055, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  }, []);

  const dispatchListeningVisualPulse = useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent(VISUAL_SCENE_EVENT, {
        detail: { id: "default", intensity: 0.5, motion: "pulse", palette: "cold", durationMs: 1200 },
      }),
    );
    window.dispatchEvent(
      new CustomEvent(VISUAL_BEAT_EVENT, {
        detail: { kind: "wake-word", strength: 0.85 },
      }),
    );
  }, []);

  const stopWakeRecognition = useCallback(() => {
    const rec = wakeRecognitionRef.current;
    if (!rec) return;
    wakeRecognitionRef.current = null;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    try {
      rec.stop();
    } catch {
      // no-op
    }
    setIsWakeArmed(false);
  }, [setIsWakeArmed]);

  const startWakeRecognition = useCallback(() => {
    if (typeof window === "undefined" || !micPermissionGranted || wakeRecognitionRef.current) return;
    const speechWindow = window as WindowWithSpeech;
    const SR = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (evt: Event) => {
      const e = evt as SpeechRecognitionEventLike;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i]?.[0]?.transcript ?? "";
        if (!hasWakePhrase(transcript)) continue;
        const now = Date.now();
        if (now - cooldownRef.current < WAKE_COOLDOWN_MS) return;
        cooldownRef.current = now;
        stopWakeRecognition();
        setIsListening(true);
        playConfirmBeep();
        dispatchListeningVisualPulse();
        return;
      }
    };

    rec.onerror = () => {
      setIsWakeArmed(false);
      setWakeRestartTick((v) => v + 1);
    };

    rec.onend = () => {
      wakeRecognitionRef.current = null;
      setIsWakeArmed(false);
      setWakeRestartTick((v) => v + 1);
    };

    try {
      rec.start();
      wakeRecognitionRef.current = rec;
      setIsWakeArmed(true);
    } catch {
      setIsWakeArmed(false);
    }
  }, [
    dispatchListeningVisualPulse,
    micPermissionGranted,
    playConfirmBeep,
    setIsWakeArmed,
    setIsListening,
    stopWakeRecognition,
  ]);

  const startCommandRecognition = useCallback(() => {
    if (typeof window === "undefined") return;
    const speechWindow = window as WindowWithSpeech;
    const SR = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!SR) {
      setIsListening(false);
      if (micPermissionGranted) startWakeRecognition();
      return;
    }
    const prev = commandRecognitionRef.current;
    if (prev) {
      try {
        prev.stop();
      } catch {
        // no-op
      }
      commandRecognitionRef.current = null;
    }
    if (commandTimeoutRef.current !== null) {
      window.clearTimeout(commandTimeoutRef.current);
      commandTimeoutRef.current = null;
    }
    if (commandSilenceTimeoutRef.current !== null) {
      window.clearTimeout(commandSilenceTimeoutRef.current);
      commandSilenceTimeoutRef.current = null;
    }
    commandBufferRef.current = "";

    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    const scheduleSilenceStop = () => {
      if (commandSilenceTimeoutRef.current !== null) {
        window.clearTimeout(commandSilenceTimeoutRef.current);
      }
      commandSilenceTimeoutRef.current = window.setTimeout(() => {
        try {
          rec.stop();
        } catch {
          // no-op
        }
      }, COMMAND_SILENCE_MS);
    };

    rec.onresult = (evt: Event) => {
      const e = evt as SpeechRecognitionEventLike;
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const text = res?.[0]?.transcript?.trim() ?? "";
        if (!text) continue;
        if (res.isFinal) {
          commandBufferRef.current = `${commandBufferRef.current} ${text}`.trim();
        } else {
          interimText = `${interimText} ${text}`.trim();
        }
      }
      const preview = `${commandBufferRef.current} ${interimText}`.trim();
      if (preview) {
        setDraftMessage(preview);
        setLastTranscript(preview);
      }
      scheduleSilenceStop();
    };

    const finish = () => {
      if (commandTimeoutRef.current !== null) {
        window.clearTimeout(commandTimeoutRef.current);
        commandTimeoutRef.current = null;
      }
      if (commandSilenceTimeoutRef.current !== null) {
        window.clearTimeout(commandSilenceTimeoutRef.current);
        commandSilenceTimeoutRef.current = null;
      }
      commandRecognitionRef.current = null;
      setIsListening(false);
      const finalText = commandBufferRef.current.trim();
      commandBufferRef.current = "";
      if (finalText) {
        setDraftMessage(finalText);
        setLastTranscript(finalText);
        runScenarioFromVoiceRef.current(finalText);
      }
      if (micPermissionGranted) startWakeRecognition();
    };

    rec.onerror = (_evt: Event) => {
      void (_evt as SpeechRecognitionErrorEventLike);
      finish();
    };
    rec.onend = finish;

    try {
      rec.start();
      commandRecognitionRef.current = rec;
      commandTimeoutRef.current = window.setTimeout(() => {
        try {
          rec.stop();
        } catch {
          finish();
        }
      }, COMMAND_TIMEOUT_MS);
    } catch {
      finish();
    }
  }, [micPermissionGranted, setIsListening, setLastTranscript, startWakeRecognition]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const speechWindow = window as WindowWithSpeech;
    setSpeechSupported(Boolean(speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!navigator?.mediaDevices?.getUserMedia) {
      setMicPermissionGranted(false);
      setIsWakeArmed(false);
      return;
    }

    let unmounted = false;

    const removeListeners = () => {
      window.removeEventListener("pointerdown", requestMicPermissionOnce);
      window.removeEventListener("keydown", requestMicPermissionOnce);
    };

    const requestMicPermissionOnce = async () => {
      if (permissionAskedRef.current) return;
      permissionAskedRef.current = true;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        if (unmounted) return;
        setMicPermissionGranted(true);
      } catch {
        if (unmounted) return;
        setMicPermissionGranted(false);
        setIsWakeArmed(false);
      } finally {
        removeListeners();
      }
    };

    window.addEventListener("pointerdown", requestMicPermissionOnce, { once: true });
    window.addEventListener("keydown", requestMicPermissionOnce, { once: true });

    return () => {
      unmounted = true;
      removeListeners();
    };
  }, [setIsWakeArmed, setMicPermissionGranted]);

  useEffect(() => {
    if (!micPermissionGranted || isListening || wakeRecognitionRef.current) return;
    startWakeRecognition();
  }, [isListening, micPermissionGranted, startWakeRecognition, wakeRestartTick]);

  useEffect(() => {
    if (isListening) {
      startCommandRecognition();
      return;
    }
    const rec = commandRecognitionRef.current;
    if (!rec) return;
    try {
      rec.stop();
    } catch {
      // no-op
    }
  }, [isListening, startCommandRecognition]);

  useEffect(() => {
    return () => {
      stopWakeRecognition();
      const commandRec = commandRecognitionRef.current;
      if (commandRec) {
        try {
          commandRec.stop();
        } catch {
          // no-op
        }
        commandRecognitionRef.current = null;
      }
      if (commandTimeoutRef.current !== null) {
        window.clearTimeout(commandTimeoutRef.current);
        commandTimeoutRef.current = null;
      }
      if (commandSilenceTimeoutRef.current !== null) {
        window.clearTimeout(commandSilenceTimeoutRef.current);
        commandSilenceTimeoutRef.current = null;
      }
      commandBufferRef.current = "";
    };
  }, [stopWakeRecognition]);

  const refreshScenariosList = useCallback(async () => {
    setListError(null);
    setListLoading(true);
    try {
      const rows = await fetchScenariosList();
      setScenarios(rows);
    } catch (e) {
      setListError(
        e instanceof Error
          ? e.message
          : "Não foi possível sincronizar os cenários.",
      );
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshScenariosList();
  }, [refreshScenariosList]);

  useEffect(() => {
    // Condições para executar a função fetchMarket que é responsavel por buscar os dados do mercado

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
      setDetailError(
        e instanceof Error ? e.message : "Falha ao abrir o cenário.",
      );
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    draftMessageRef.current = draftMessage;
  }, [draftMessage]);

  const runScenarioIa = useCallback(async (forcedMessage?: string) => {
    setIaError(null);
    const msg = (forcedMessage ?? draftMessageRef.current).trim();
    if (!msg) {
      setIaError(
        "Descreva um cenário possível para analisarmos o impacto na carteira.",
      );
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
      setDraftMessage(msg);
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
      setIaError(
        e instanceof Error ? e.message : "Falha ao analisar o cenário.",
      );
    } finally {
      setIaLoading(false);
    }
  }, [refreshScenariosList]);

  useEffect(() => {
    runScenarioFromVoiceRef.current = (text: string) => {
      void runScenarioIa(text);
    };
  }, [runScenarioIa]);

  async function handleStressRun() {
    setStressError(null);
    if (portfolioValue <= 0) {
      setStressError(
        "Inclua posições na carteira (com preço de mercado ou valor informado).",
      );
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
      setStressError(
        e instanceof Error ? e.message : "Falha na simulação clássica.",
      );
    } finally {
      setLoadingStress(false);
    }
  }

  const canStress = listReady && portfolioValue > 0;
  useEffect(() => {
    const root = mainRef.current;
    if (!root) return;
    sceneTimelineRef.current?.kill();
    sceneTimelineRef.current = null;

    const scene = displayResponse?.narrative?.visualScene;
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(VISUAL_SCENE_EVENT, {
          detail:
            cinematicMode && !reduceMotion
              ? (scene ?? {
                  id: "default",
                  intensity: 0.2,
                  motion: "calm",
                  palette: "default",
                })
              : {
                  id: "default",
                  intensity: 0.15,
                  motion: "calm",
                  palette: "default",
                },
        }),
      );
    }
    if (!cinematicMode || reduceMotion) return;
    if (!scene || scene.id === "default") return;

    const intensity = Math.max(0, Math.min(1, scene.intensity ?? 0.5));
    const duration = Math.max(
      0.6,
      Math.min(8, (scene.durationMs ?? 1800) / 1000),
    );
    const chart = root.querySelector(
      "[data-visual-chart]",
    ) as HTMLElement | null;
    const cards = Array.from(
      root.querySelectorAll("[data-visual-card]"),
    ) as HTMLElement[];
    const headings = Array.from(
      root.querySelectorAll("[data-visual-heading]"),
    ) as HTMLElement[];
    const badge = root.querySelector(
      "[data-visual-scene-badge]",
    ) as HTMLElement | null;

    const tl = gsap.timeline();
    sceneTimelineRef.current = tl;

    if (scene.id === "apocalypse") {
      tl.to(root, {
        filter: "saturate(0.74) contrast(1.08)",
        duration: duration * 0.2,
        ease: "power2.out",
      });
      if (chart) {
        tl.fromTo(
          chart,
          { scale: 1, rotate: 0 },
          {
            scale: 1 - 0.08 * intensity,
            rotate: -2.5 * intensity,
            duration: duration * 0.35,
            ease: "power3.out",
          },
          "<",
        );
      }
      cards.forEach((card, i) => {
        tl.to(
          card,
          {
            x: (i % 2 === 0 ? -1 : 1) * (26 + i * 8) * intensity,
            y: (12 + i * 10) * intensity,
            rotate: (i % 2 === 0 ? -1 : 1) * (6 + i * 2) * intensity,
            opacity: 0.93,
            duration: duration * 0.42,
            ease: "power2.out",
          },
          "<",
        );
      });
      tl.to(
        headings,
        {
          letterSpacing: "0.14em",
          duration: duration * 0.2,
          ease: "power1.out",
        },
        "<",
      );
      tl.to(root, {
        x: 10 * intensity,
        duration: 0.06,
        yoyo: true,
        repeat: 5,
        ease: "power1.inOut",
      });
    } else if (scene.id === "oil-collapse") {
      tl.to(root, {
        backgroundColor: "rgba(24,13,5,0.16)",
        duration: duration * 0.3,
        ease: "power2.out",
      });
      if (chart) {
        tl.fromTo(
          chart,
          { boxShadow: "0 0 0 rgba(251,146,60,0)", y: 0 },
          {
            boxShadow: `0 0 ${28 + 40 * intensity}px rgba(251,146,60,${0.15 + 0.3 * intensity})`,
            y: 6 * intensity,
            duration: duration * 0.35,
            ease: "sine.inOut",
          },
          "<",
        );
      }
      tl.to(
        cards,
        {
          y: (i) => (i % 2 === 0 ? 5 : -5) * intensity,
          duration: duration * 0.25,
          stagger: 0.05,
          yoyo: true,
          repeat: 1,
          ease: "sine.inOut",
        },
        "<",
      );
    } else if (scene.id === "geopolitical-shock") {
      tl.to(root, {
        filter: "hue-rotate(-12deg) saturate(1.1)",
        duration: duration * 0.2,
        ease: "power2.out",
      });
      tl.to([chart, ...cards].filter(Boolean), {
        x: 6 * intensity,
        duration: 0.08,
        yoyo: true,
        repeat: 7,
        ease: "power1.inOut",
      });
    }

    if (badge) {
      tl.fromTo(
        badge,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" },
        0,
      );
    }

    return () => {
      sceneTimelineRef.current?.kill();
      sceneTimelineRef.current = null;
      gsap.set([root, chart, ...cards, ...headings, badge].filter(Boolean), {
        clearProps: "all",
      });
    };
  }, [displayResponse, cinematicMode, reduceMotion]);

  useEffect(() => {
    if (!cinematicMode || reduceMotion) return;
    const root = mainRef.current;
    const blocks = Array.from(
      root?.querySelectorAll("[data-analysis-block]") ?? [],
    ) as HTMLElement[];
    if (!root || blocks.length === 0) return;
    const scene = displayResponse?.narrative?.visualScene;
    const intensity = Math.max(0, Math.min(1, scene?.intensity ?? 0.4));
    const timeline = gsap.timeline({ delay: 0.25 });

    blocks.forEach((block, idx) => {
      timeline.fromTo(
        block,
        { opacity: 0.72, y: 8, boxShadow: "0 0 0 rgba(34,211,238,0)" },
        {
          opacity: 1,
          y: 0,
          boxShadow: `0 0 ${14 + intensity * 20}px rgba(34,211,238,${0.18 + intensity * 0.22})`,
          duration: 0.3,
          ease: "power2.out",
          onStart: () => {
            window.dispatchEvent(
              new CustomEvent(VISUAL_BEAT_EVENT, {
                detail: {
                  kind: scene?.id ?? "default",
                  strength: Math.min(1, 0.35 + intensity + idx * 0.06),
                },
              }),
            );
          },
          onComplete: () => {
            gsap.to(block, {
              boxShadow: "0 0 0 rgba(34,211,238,0)",
              duration: 0.35,
              ease: "power1.out",
            });
          },
        },
      );
    });

    return () => {
      timeline.kill();
    };
  }, [displayResponse, cinematicMode, reduceMotion]);

  const commandBar = (
    <div className="px-3 py-3 sm:px-4 sm:py-4 md:px-8 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-5xl space-y-3">
        {iaError ? (
          <p className="rounded-lg border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
            {iaError}
          </p>
        ) : null}
        {!micPermissionGranted ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-900/25 px-3 py-2 text-xs text-amber-100">
            Clique em qualquer lugar da página para autorizar o microfone e ativar o comando por voz.
          </p>
        ) : null}
        {!speechSupported ? (
          <p className="rounded-lg border border-violet-500/30 bg-violet-900/20 px-3 py-2 text-xs text-violet-100">
            Este navegador não suporta reconhecimento de voz contínuo. Use o comando por texto neste campo.
          </p>
        ) : null}
        <div
          className={`flex items-end gap-2 rounded-2xl border bg-slate-900/85 p-2 transition ${
            isListening
              ? "border-cyan-300/80 shadow-[0_12px_40px_rgba(2,6,23,0.6),0_0_38px_rgba(34,211,238,0.26)]"
              : "border-white/15 shadow-[0_12px_40px_rgba(2,6,23,0.6),0_0_30px_rgba(34,211,238,0.08)]"
          }`}
        >
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
          <div className="flex items-center gap-3">
            <span
              className={`rounded-md border px-2 py-0.5 text-[11px] ${
                isListening
                  ? "border-cyan-300/60 bg-cyan-400/15 text-cyan-100"
                  : isWakeArmed
                    ? "border-emerald-300/35 bg-emerald-400/10 text-emerald-100"
                    : "border-white/20 bg-white/5 text-slate-300"
              }`}
            >
              {isListening ? "Code Chroma ativa. Pode falar." : isWakeArmed ? "Wake ativo: diga hey magic" : "Wake inativo"}
            </span>
            <button
              type="button"
              onClick={() => setCinematicMode((v) => !v)}
              className="rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-slate-200 transition hover:bg-white/10"
            >
              Cinemático: {cinematicMode ? "on" : "off"}
            </button>
            <span>{draftMessage.length}/4000</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setStressOpen((o) => !o)}
          className="text-sm text-slate-300 underline decoration-slate-500 underline-offset-2 hover:text-slate-100"
        >
          {stressOpen ? "Ocultar" : "Mostrar"} simulação por sliders (modo
          clássico)
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
              <p className="mt-1 font-mono text-lg text-white">
                {formatBRL(portfolioValue)}
              </p>
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
  );

  const desktopSidebar = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 items-center border-b border-white/10 px-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-300/90">
          Cenarios
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <button
          type="button"
          onClick={handleNewScenario}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/10 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
        >
          <span className="text-lg leading-none">+</span>
          Novo cenario
        </button>
        <nav className="simulator-rail-scroll min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
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
            <p className="px-2 text-sm text-slate-300">
              A sincronizar com o servidor...
            </p>
          ) : scenarios.length === 0 ? (
            <p className="px-2 text-sm leading-relaxed text-slate-300">
              Nenhum cenario na conta. Envie uma analise abaixo e ela ficara
              guardada no servidor.
            </p>
          ) : (
            scenarios.map((s) => {
              const active = s.id === activeId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => void handleSelectScenario(s.id)}
                  className={`flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    active
                      ? "bg-gradient-to-r from-cyan-500/20 to-violet-600/15 text-white"
                      : "text-slate-200 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="mt-0.5 text-slate-600" aria-hidden>
                    #
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
          Voltar ao painel
        </Link>
      </div>
    </div>
  );

  return (
    <Layout footer={commandBar} sidebar={desktopSidebar}>
      <div className="flex h-full w-full min-h-0 flex-1 overflow-hidden bg-transparent text-slate-100">
        <AnimatePresence>
          {isListening ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.22 }}
              className="pointer-events-none fixed bottom-20 left-1/2 z-[60] -translate-x-1/2"
            >
              <div className="rounded-2xl border border-cyan-300/40 bg-slate-950/85 px-4 py-3 shadow-[0_0_28px_rgba(34,211,238,0.25)] backdrop-blur">
                <p className="text-xs font-medium text-cyan-100">Code Chroma ativa. Pode falar.</p>
                <div className="mt-2 flex items-end justify-center gap-1.5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <motion.span
                      key={i}
                      className="block w-1 rounded-full bg-cyan-300/80"
                      animate={{ height: [6, 16 + (i % 2) * 6, 8, 18 - (i % 2) * 5, 6] }}
                      transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: i * 0.07 }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
        {/* Rail cenários — mobile: drawer; desktop: coluna colapsável */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 flex w-[min(86vw,280px)] flex-col border-r border-white/10 bg-slate-950/95 backdrop-blur-xl transition-transform duration-300 md:hidden ${
            railOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="simulator-rail-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain p-3 md:p-4">
            <div className="mb-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setRailOpen((o) => !o)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10"
                aria-label={
                  railOpen
                    ? "Fechar lista de cenários"
                    : "Abrir lista de cenários"
                }
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
                    if (
                      typeof window !== "undefined" &&
                      window.matchMedia("(max-width: 767px)").matches
                    ) {
                      setRailOpen(false);
                    }
                  }}
                  className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/10 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
                >
                  <span className="text-lg leading-none">+</span>
                  Novo cenário
                </button>
                <nav className="min-h-0 flex-1 space-y-1 pr-1">
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
                    <p className="px-2 text-sm text-slate-300">
                      A sincronizar com o servidor…
                    </p>
                  ) : scenarios.length === 0 ? (
                    <p className="px-2 text-sm leading-relaxed text-slate-300">
                      Nenhum cenário na conta. Envie uma análise abaixo — fica
                      guardada no servidor.
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
                            if (
                              typeof window !== "undefined" &&
                              window.matchMedia("(max-width: 767px)").matches
                            ) {
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
                <span className="text-[10px] text-slate-600 [writing-mode:vertical-rl]">
                  Cenários
                </span>
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

        <div
          ref={mainRef}
          className="relative flex min-h-0 min-w-0 flex-1 flex-col"
        >
          <div className="relative z-10 flex min-h-0 flex-1 flex-col">
            <div className="mx-auto flex w-full max-w-5xl flex-col px-3 pb-[max(9rem,env(safe-area-inset-bottom))] pt-0 sm:px-4 sm:pb-32 sm:pt-0 md:px-6 md:pb-36 md:pt-0 lg:px-8 lg:pb-36 lg:pt-8">
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
              <h2
                data-visual-heading
                className="mt-3 text-center text-3xl font-medium leading-tight tracking-tight text-zinc-100 sm:text-3xl md:text-4xl"
              >
                Olá. Que cenário quer testar?
              </h2>
              <p className="mx-auto mt-2 max-w-3xl text-center text-sm text-slate-200 sm:text-base">
                Descreva um evento possível (mercado, macro, geopolítica). A
                Code Chroma estima o impacto na sua carteira e mostra gráficos
                interativos — não é recomendação de investimento.
              </p>

              <div className="mt-6 flex flex-wrap justify-center gap-2 sm:mt-8 sm:gap-2.5">
                {CHIPS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDraftMessage(c)}
                    className="max-w-[min(100%,22rem)] rounded-full border border-white/15 bg-slate-900/75 px-3 py-2 text-left text-xs leading-snug text-slate-100 shadow-[0_8px_20px_rgba(2,6,23,0.45)] transition hover:-translate-y-0.5 hover:border-cyan-400/40 hover:text-white sm:max-w-none sm:px-4 sm:py-2 sm:text-sm sm:text-center"
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div data-scenario-result className="mt-6 space-y-5">
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
                  <div
                    data-visual-card
                    className="rounded-2xl border border-white/15 bg-slate-950/70 p-5 shadow-[0_16px_50px_rgba(2,6,23,0.7)] backdrop-blur-xl"
                  >
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                      Leitura IA
                    </h3>
                    {displayResponse.narrative.visualScene?.id &&
                    displayResponse.narrative.visualScene.id !== "default" ? (
                      <p
                        data-visual-scene-badge
                        className="mt-2 inline-flex rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200"
                      >
                        Cena visual: {displayResponse.narrative.visualScene.id}
                      </p>
                    ) : null}
                    <p className="mt-2 text-base text-slate-100">
                      {displayResponse.narrative.summary}
                    </p>
                    {displayResponse.narrative.analysisBlocks &&
                    displayResponse.narrative.analysisBlocks.length > 0 ? (
                      <div className="mt-4 space-y-3">
                        {displayResponse.narrative.analysisBlocks.map(
                          (b, i) => (
                            <div
                              key={`${b.title}-${i}`}
                              data-analysis-block
                              data-visual-card
                              data-analysis-index={i}
                              className="rounded-xl border border-white/10 bg-white/[0.02] p-3"
                            >
                              <p className="text-sm font-semibold text-violet-100">
                                {b.title}
                              </p>
                              <p className="mt-1 text-sm leading-relaxed text-slate-200">
                                {b.content}
                              </p>
                            </div>
                          ),
                        )}
                      </div>
                    ) : null}
                    {displayResponse.narrative.causalChain &&
                    displayResponse.narrative.causalChain.length > 0 ? (
                      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                          Cadeia causal (causa → transmissão → efeito)
                        </p>
                        <ul className="mt-2 space-y-2">
                          {displayResponse.narrative.causalChain.map(
                            (c, idx) => (
                              <li
                                key={`${c.cause}-${idx}`}
                                className="rounded-lg border border-white/10 bg-slate-950/40 p-2.5"
                              >
                                <p className="text-sm text-slate-100">
                                  <span className="font-semibold text-violet-100">
                                    Causa:
                                  </span>{" "}
                                  {c.cause}
                                </p>
                                <p className="mt-1 text-sm text-slate-200">
                                  <span className="font-semibold text-cyan-100">
                                    Transmissão:
                                  </span>{" "}
                                  {c.transmission}
                                </p>
                                <p className="mt-1 text-sm text-slate-200">
                                  <span className="font-semibold text-amber-100">
                                    Efeito:
                                  </span>{" "}
                                  {c.effect}
                                </p>
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    ) : null}
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
                    {displayResponse.narrative.evidence &&
                    displayResponse.narrative.evidence.length > 0 ? (
                      <div className="mt-4 border-t border-white/10 pt-3">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                          Provas do cenário
                        </p>
                        <ul className="mt-2 space-y-2">
                          {displayResponse.narrative.evidence.map((ev, idx) => (
                            <li
                              key={`${ev.title}-${idx}`}
                              className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5"
                            >
                              <p className="text-sm font-semibold text-cyan-100">
                                {ev.title}
                              </p>
                              <p className="mt-1 text-sm text-slate-200">
                                {ev.detail}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                                {ev.relatedFactorId ? (
                                  <span>Fator: {ev.relatedFactorId}</span>
                                ) : null}
                                {ev.relatedAssetLabel ? (
                                  <span>Ativo: {ev.relatedAssetLabel}</span>
                                ) : null}
                                {typeof ev.confidence === "number" ? (
                                  <span>
                                    Confiança:{" "}
                                    {(ev.confidence * 100).toFixed(0)}%
                                  </span>
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
                    <h3 className="text-sm font-semibold text-violet-200">
                      Stress clássico (sliders)
                    </h3>
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

                {!detailLoading &&
                !detailError &&
                !displayResponse &&
                !stressResult ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-5 backdrop-blur-xl">
                    <p className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                      Resultados da IA
                    </p>
                    <p className="mt-2 text-sm text-slate-200">
                      Envie um cenário acima para abrir a análise com impacto
                      por ativo, narrativa de risco e sinais de confiança.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                        <p className="text-xs uppercase tracking-wider text-slate-400">
                          Gráficos
                        </p>
                        <p className="mt-1 text-sm text-slate-200">
                          Distribuição de impacto e retorno.
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                        <p className="text-xs uppercase tracking-wider text-slate-400">
                          Ativos
                        </p>
                        <p className="mt-1 text-sm text-slate-200">
                          Linhas mais sensíveis da carteira.
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                        <p className="text-xs uppercase tracking-wider text-slate-400">
                          Insights
                        </p>
                        <p className="mt-1 text-sm text-slate-200">
                          Leitura IA com fatores e evidências.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
