import { describe, it, expect } from "vitest";
import { runStressCorrelationMock } from "./simulationEngineService";

describe("runStressCorrelationMock", () => {
  it("projeta valor conhecido para cenário de referência (README)", () => {
    const result = runStressCorrelationMock({
      energyCostIncrease: 20,
      geoRiskLevel: 8,
      aiDemandIncrease: 50,
      portfolioValue: 100_000,
    });
    expect(result.baselineValue).toBe(100_000);
    expect(result.projectedPortfolioValue).toBeCloseTo(96_262.5, 4);
    expect(result.breakdown.supplyChainPenaltyApplied).toBe(true);
    expect(result.changePercent).toBeCloseTo(-3.74, 2);
  });

  it("sem penalidade geopolítica quando nível <= 7", () => {
    const result = runStressCorrelationMock({
      energyCostIncrease: 0,
      geoRiskLevel: 7,
      aiDemandIncrease: 0,
      portfolioValue: 10_000,
    });
    expect(result.breakdown.supplyChainPenaltyApplied).toBe(false);
    expect(result.projectedPortfolioValue).toBe(10_000);
    expect(result.alerts).toHaveLength(0);
  });

  it("aplica -15% quando geoRiskLevel > 7", () => {
    const base = runStressCorrelationMock({
      energyCostIncrease: 0,
      geoRiskLevel: 7,
      aiDemandIncrease: 0,
      portfolioValue: 100_000,
    });
    const shocked = runStressCorrelationMock({
      energyCostIncrease: 0,
      geoRiskLevel: 8,
      aiDemandIncrease: 0,
      portfolioValue: 100_000,
    });
    expect(shocked.projectedPortfolioValue).toBeCloseTo(base.projectedPortfolioValue * 0.85, 4);
  });

  it("portfolio zero: changePercent 0 e sem divisão por zero", () => {
    const result = runStressCorrelationMock({
      energyCostIncrease: 10,
      geoRiskLevel: 3,
      aiDemandIncrease: 20,
      portfolioValue: 0,
    });
    expect(result.changePercent).toBe(0);
    expect(result.projectedPortfolioValue).toBe(0);
  });

  it("alerta de energia quando aumento >= 40%", () => {
    const result = runStressCorrelationMock({
      energyCostIncrease: 40,
      geoRiskLevel: 3,
      aiDemandIncrease: 0,
      portfolioValue: 50_000,
    });
    expect(result.alerts.some((a) => a.includes("Custo de energia elevado"))).toBe(true);
  });

  it("alerta crítico geopolítico quando nível >= 9", () => {
    const result = runStressCorrelationMock({
      energyCostIncrease: 0,
      geoRiskLevel: 9,
      aiDemandIncrease: 0,
      portfolioValue: 10_000,
    });
    expect(result.alerts.some((a) => a.includes("Alerta crítico"))).toBe(true);
  });

  it("alerta de demanda IA quando >= 60%", () => {
    const result = runStressCorrelationMock({
      energyCostIncrease: 0,
      geoRiskLevel: 3,
      aiDemandIncrease: 60,
      portfolioValue: 10_000,
    });
    expect(
      result.alerts.some((a) => a.includes("Demanda por IA")),
    ).toBe(true);
  });

  it("expõe afterSectorShocks coerente com sliders nulos", () => {
    const result = runStressCorrelationMock({
      energyCostIncrease: 0,
      geoRiskLevel: 0,
      aiDemandIncrease: 0,
      portfolioValue: 100_000,
    });
    expect(result.breakdown.afterSectorShocks).toBe(100_000);
  });
});
