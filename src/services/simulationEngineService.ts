/**
 * Motor de correlação (MVP): alocação fixa fictícia + choques dos sliders.
 * Pesos somam 1 — ajuste conforme o produto evoluir.
 */
const SECTOR_WEIGHTS = {
  technology: 0.35,
  mining: 0.25,
  energy: 0.25,
  other: 0.15,
} as const;

export type SimulationRunInput = {
  energyCostIncrease: number;
  geoRiskLevel: number;
  aiDemandIncrease: number;
  portfolioValue: number;
};

export type SimulationRunResult = {
  baselineValue: number;
  projectedPortfolioValue: number;
  changePercent: number;
  alerts: string[];
  breakdown: {
    afterSectorShocks: number;
    supplyChainPenaltyApplied: boolean;
  };
};

export function runStressCorrelationMock(input: SimulationRunInput): SimulationRunResult {
  const alerts: string[] = [];

  let vTech = input.portfolioValue * SECTOR_WEIGHTS.technology;
  let vMining = input.portfolioValue * SECTOR_WEIGHTS.mining;
  const vEnergy = input.portfolioValue * SECTOR_WEIGHTS.energy;
  const vOther = input.portfolioValue * SECTOR_WEIGHTS.other;

  if (input.aiDemandIncrease > 0) {
    const bump = (input.aiDemandIncrease * 0.5) / 100;
    vTech *= 1 + bump;
    vMining *= 1 + bump;
  }

  if (input.energyCostIncrease > 0) {
    const drag = (input.energyCostIncrease * 0.2) / 100;
    vTech *= 1 - drag;
    if (input.energyCostIncrease >= 40) {
      alerts.push("Custo de energia elevado: pressão adicional sobre margens do setor de tecnologia.");
    }
  }

  const afterSectorShocks = vTech + vMining + vEnergy + vOther;
  let projected = afterSectorShocks;
  let supplyChainPenaltyApplied = false;

  if (input.geoRiskLevel > 7) {
    projected *= 0.85;
    supplyChainPenaltyApplied = true;
    alerts.push(
      "Risco de quebra de supply chain: nível geopolítico > 7 — penalidade de -15% aplicada ao valor total do portfólio.",
    );
  }

  if (input.geoRiskLevel >= 9) {
    alerts.push("Alerta crítico: risco geopolítico extremo (≥ 9). Revise exposição a cadeias globais.");
  }

  if (input.aiDemandIncrease >= 60) {
    alerts.push("Demanda por IA muito alta no cenário: verifique concentração em tech/mineração.");
  }

  const projectedPortfolioValue = Math.round(projected * 100) / 100;
  const changePercent =
    input.portfolioValue > 0
      ? Math.round(((projectedPortfolioValue - input.portfolioValue) / input.portfolioValue) * 10_000) / 100
      : 0;

  return {
    baselineValue: input.portfolioValue,
    projectedPortfolioValue,
    changePercent,
    alerts,
    breakdown: {
      afterSectorShocks: Math.round(afterSectorShocks * 100) / 100,
      supplyChainPenaltyApplied,
    },
  };
}
