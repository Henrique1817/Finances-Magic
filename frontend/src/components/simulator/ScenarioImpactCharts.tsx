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
const BAR_NEG = "#fb7185";
const GRID_COLOR = "rgba(148, 163, 184, 0.28)";
const AXIS_TEXT = "#e2e8f0";
const AXIS_TEXT_SOFT = "#cbd5e1";

function shortLabel(label: string): string {
  if (label.length <= 16) return label;
  return `${label.slice(0, 14)}...`;
}

type Props = {
  quant: AiScenarioQuant;
  visualClassName?: string;
};

export function ScenarioImpactCharts({ quant, visualClassName }: Props) {
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
      data-visual-chart
      className={`space-y-4 rounded-2xl border border-white/10 bg-slate-950/50 p-3 backdrop-blur-md sm:space-y-6 sm:p-4 md:p-6 ${visualClassName ?? ""}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/80">
            Impacto estimado
          </h3>
          <p className="mt-1 text-base text-slate-200">
            Baseline vs. projetado por posição (motor quantitativo + IA).
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs uppercase tracking-wider text-slate-300">
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

      <div className="h-[min(280px,45svh)] w-full min-h-[200px] sm:min-h-[240px] sm:h-[min(380px,50vh)] md:h-[min(420px,55vh)]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
            barGap={4}
          >
            <XAxis
              dataKey="name"
              tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              tickFormatter={shortLabel}
              interval={0}
              angle={-18}
              textAnchor="end"
              height={72}
            />
            <YAxis
              tick={{ fill: AXIS_TEXT_SOFT, fontSize: 12 }}
              tickFormatter={(v) => formatBRL(Number(v))}
              width={72}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(15, 23, 42, 0.94)",
                border: "1px solid rgba(148,163,184,0.4)",
                borderRadius: 12,
                boxShadow: "0 12px 28px rgba(2, 6, 23, 0.55)",
              }}
              itemStyle={{ color: "#e2e8f0" }}
              labelStyle={{ color: "#f8fafc", fontWeight: 600 }}
              formatter={(value: number, name: string) => [
                formatBRL(value),
                name === "baseline" ? "Baseline" : "Projetado",
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: 13, color: "#e2e8f0" }}
              formatter={(value) =>
                value === "baseline" ? "Valor investido (baseline)" : "Projetado"
              }
            />
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} opacity={0.85} />
            <Bar dataKey="baseline" fill={BAR_BASE} fillOpacity={0.95} radius={[6, 6, 0, 0]} maxBarSize={34} />
            <Bar dataKey="projetado" radius={[6, 6, 0, 0]} maxBarSize={34}>
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
