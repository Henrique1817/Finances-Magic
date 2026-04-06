import { describe, expect, it } from "vitest";
import { estimateBetaFromAlignedReturns } from "./quantScenarioEngine";

describe("estimateBetaFromAlignedReturns", () => {
  it("aproxima beta = 1 quando os retornos da linha e do fator coincidem", () => {
    const factor = Array.from({ length: 60 }, (_, i) => (Math.sin(i / 7) * 0.015 + (i % 3) * 0.002) / 1);
    const line = factor.map((r) => r);
    const beta = estimateBetaFromAlignedReturns(line, factor);
    expect(beta).toBeCloseTo(1, 4);
  });

  it("aproxima beta = 2 quando a linha replica o fator com ganho 2x", () => {
    const factor = Array.from({ length: 60 }, (_, i) => Math.cos(i / 11) * 0.018 + (i % 4) * 0.001);
    const line = factor.map((r) => r * 2);
    const beta = estimateBetaFromAlignedReturns(line, factor);
    expect(beta).toBeCloseTo(2, 4);
  });

  it("retorna 0 quando o fator não varia (variância ~0)", () => {
    const factor = Array(60).fill(0.01);
    const line = Array.from({ length: 60 }, (_, i) => i * 0.0001);
    expect(estimateBetaFromAlignedReturns(line, factor)).toBe(0);
  });
});
