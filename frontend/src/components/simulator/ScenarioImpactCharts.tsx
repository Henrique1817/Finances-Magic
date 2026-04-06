"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AiScenarioQuant } from "@/lib/scenarioAiApi";
import { formatBRL } from "@/lib/formatBRL";

type Row = {
  name: string;
  baseline: number;
  projetado: number;
  deltaPct: number;
};

function buildRows(quant: AiScenarioQuant): Row[] {
  return quant.perLine.map((line) => ({
    name:
      line.assetSymbol && line.nome
        ? `${line.nome} (${line.assetSymbol})`
        : line.nome || line.assetSymbol || "Posição",
    baseline: line.lineBaselineValue,
    projetado: line.lineProjectedValue,
    deltaPct: line.lineBaselineValue > 0
      ? ((line.lineProjectedValue - line.lineBaselineValue) / line.lineBaselineValue) * 100
      : 0,
  }));
}

const BAR_BASE = "#334155";
const BAR_PROJ = "#22d3ee";
const BAR_NEG = "#f43f5e";

type Props = {
  quant: AiScenarioQuant;
};

export function ScenarioImpactCharts({ quant }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const rows = buildRows(quant);

  const portfolioRow: Row = {
    name: "Carteira (total)",
    baseline: quant.baselineValue,
    projetado: quant.projectedPortfolioValue,
    deltaPct: quant.baselineValue > 0
      ? (quant.portfolioReturnDecimal * 100)
      : 0,
  };

  const chartData = [...rows, portfolioRow];

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    gsap.fromTo(
      el,
      { opacity: 0, y: 28 },
      { opacity: 1, y: 0, duration: 0.65, ease: "power3.out" },
    );
  }, [quant]);

  return (
    <div
      ref={wrapRef}
      className="space-y-6 rounded-2xl border border-white/10 bg-slate-950/50 p-4 backdrop-blur-md md:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/80">
            Impacto estimado
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Baseline vs. projetado por posição (motor quantitativo + IA).
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-slate-500">
            Variação carteira
          </p>
          <p
            className={`font-mono text-lg font-semibold tabular-nums ${
              portfolioRow.deltaPct >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {portfolioRow.deltaPct >= 0 ? "+" : ""}
            {portfolioRow.deltaPct.toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="h-[min(420px,55vh)] w-full min-h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
            barGap={4}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
            <XAxis
              dataKey="name"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              interval={0}
              angle={-18}
              textAnchor="end"
              height={72}
            />
            <YAxis
              tick={{ fill: "#64748b", fontSize: 11 }}
              tickFormatter={(v) => formatBRL(Number(v))}
              width={72}
            />
            <Tooltip
              contentStyle={{
                background: "#0f172a",
                border: "1px solid rgba(148,163,184,0.25)",
                borderRadius: 12,
              }}
              labelStyle={{ color: "#e2e8f0" }}
              formatter={(value: number, name: string) => [
                formatBRL(value),
                name === "baseline" ? "Baseline" : "Projetado",
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, color: "#94a3b8" }}
              formatter={(value) =>
                value === "baseline" ? "Valor investido (baseline)" : "Projetado"
              }
            />
            <Bar dataKey="baseline" fill={BAR_BASE} radius={[6, 6, 0, 0]} maxBarSize={36} />
            <Bar dataKey="projetado" radius={[6, 6, 0, 0]} maxBarSize={36}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.deltaPct >= 0 ? BAR_PROJ : BAR_NEG}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
