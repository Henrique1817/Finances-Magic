"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchAiAccuracy, type AiAccuracyData } from "@/lib/dashboardApi";

function compactNumber(n: number): string {
  return new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(n);
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function AiAccuracyRealtimeCard() {
  const [data, setData] = useState<AiAccuracyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const load = async () => {
      try {
        const next = await fetchAiAccuracy();
        if (cancelled) return;
        setData(next);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Falha ao carregar acurácia da IA.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    timer = setInterval(() => {
      void load();
    }, 15_000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  const trend = useMemo(
    () => {
      if (!data) return [];
      const byHorizon = new Map(data.byHorizon.map((h) => [h.horizonDays, h.trend]));
      const d7 = byHorizon.get(7) ?? [];
      const d30 = byHorizon.get(30) ?? [];
      const maxLen = Math.max(d7.length, d30.length);
      const out: Array<{ time: string; d7: number | null; d30: number | null }> = [];
      for (let i = 0; i < maxLen; i++) {
        const r7 = d7[i];
        const r30 = d30[i];
        const ts = r30?.ts ?? r7?.ts;
        if (!ts) continue;
        out.push({
          time: formatTime(ts),
          d7: typeof r7?.accuracyPct === "number" ? r7.accuracyPct : null,
          d30: typeof r30?.accuracyPct === "number" ? r30.accuracyPct : null,
        });
      }
      return out;
    },
    [data],
  );

  const d7 = data?.byHorizon.find((h) => h.horizonDays === 7) ?? null;
  const d30 = data?.byHorizon.find((h) => h.horizonDays === 30) ?? null;

  return (
    <section className="glass-panel p-4 sm:p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/80">
            IA em tempo real
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white sm:text-xl md:text-2xl">
            Acurácia validada do motor IA
          </h3>
          <p className="mt-2 text-sm text-slate-200 sm:text-base">
            Métrica real baseada em previsões passadas versus retorno observado no mercado.
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs uppercase tracking-wider text-slate-300">Acurácia atual</p>
          <p className="font-mono text-xl font-bold text-emerald-300 sm:text-2xl">
            {data ? `${data.currentAccuracyPct.toFixed(2)}%` : "--"}
          </p>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-950/25 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-6 flex min-h-[220px] items-center justify-center text-base text-slate-200">
          Carregando acurácia da IA…
        </div>
      ) : trend.length === 0 ? (
        <div className="mt-6 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-6 text-base text-slate-200">
          Ainda não há previsões validadas suficientes para compor o gráfico.
        </div>
      ) : (
        <div className="mt-6 h-[220px] w-full sm:h-[260px] md:h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.75} />
              <XAxis dataKey="time" tick={{ fill: "#e2e8f0", fontSize: 12 }} />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "#cbd5e1", fontSize: 12 }}
                tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
                width={56}
              />
              <Tooltip
                contentStyle={{
                  background: "#0f172a",
                  border: "1px solid rgba(148,163,184,0.25)",
                  borderRadius: 12,
                }}
                labelStyle={{ color: "#e2e8f0" }}
                formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name === "d7" ? "Acurácia D+7" : "Acurácia D+30"]}
              />
              <Legend wrapperStyle={{ fontSize: 13, color: "#e2e8f0" }} />
              <Line
                type="monotone"
                dataKey="d7"
                name="Acurácia D+7"
                stroke="#34d399"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="d30"
                name="Acurácia D+30"
                stroke="#60a5fa"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-5 grid gap-3 text-xs text-slate-200 sm:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
          Previsões validadas:{" "}
          <span className="font-mono text-slate-200">{data ? data.validatedPredictions : "--"}</span>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
          Cobertura de treino:{" "}
          <span className="font-mono text-slate-200">
            {data ? `${data.trainingCoveragePct.toFixed(1)}%` : "--"}
          </span>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
          Linhas no banco:{" "}
          <span className="font-mono text-slate-200">{data ? compactNumber(data.trainingRows) : "--"}</span>
        </div>
      </div>
      <div className="mt-3 grid gap-3 text-xs text-slate-200 sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
          D+7:{" "}
          <span className="font-mono text-emerald-200">
            {d7 ? `${d7.accuracyPct.toFixed(2)}% | MAE ${d7.maePct?.toFixed(2) ?? "--"}%` : "--"}
          </span>
        </div>
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2">
          D+30:{" "}
          <span className="font-mono text-blue-200">
            {d30 ? `${d30.accuracyPct.toFixed(2)}% | MAE ${d30.maePct?.toFixed(2) ?? "--"}%` : "--"}
          </span>
        </div>
      </div>
    </section>
  );
}
