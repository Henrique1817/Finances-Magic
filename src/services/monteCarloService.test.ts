import { describe, it, expect } from "vitest";
import {
  linearPercentile,
  runMonteCarloSimulation,
} from "./monteCarloService";

describe("linearPercentile", () => {
  it("retorna extremos para p0 e p100", () => {
    const s = [1, 2, 3, 4, 5];
    expect(linearPercentile(s, 0)).toBe(1);
    expect(linearPercentile(s, 100)).toBe(5);
  });

  it("interpola no meio", () => {
    const s = [10, 20];
    expect(linearPercentile(s, 50)).toBe(15);
  });

  it("array vazio retorna 0", () => {
    expect(linearPercentile([], 50)).toBe(0);
  });
});

describe("runMonteCarloSimulation", () => {
  it("rejeita retornos históricos vazios", () => {
    expect(() =>
      runMonteCarloSimulation({ historicalReturns: [], paths: 100, seed: 1 }),
    ).toThrow(RangeError);
  });

  it("rejeita paths inválidos", () => {
    expect(() =>
      runMonteCarloSimulation({
        historicalReturns: [0.01],
        paths: 0,
        seed: 1,
      }),
    ).toThrow(RangeError);
  });

  it("com um único retorno histórico, riqueza terminal é determinística (1+r)^horizon", () => {
    const r = 0.01;
    const horizon = 20;
    const expected = (1 + r) ** horizon;
    const { p5, p50, p95, terminalMin, terminalMax } = runMonteCarloSimulation({
      historicalReturns: [r],
      paths: 500,
      horizon,
      seed: 999,
    });
    expect(p5).toBeCloseTo(expected, 10);
    expect(p50).toBeCloseTo(expected, 10);
    expect(p95).toBeCloseTo(expected, 10);
    expect(terminalMin).toBeCloseTo(expected, 10);
    expect(terminalMax).toBeCloseTo(expected, 10);
  });

  it("mantém p5 <= p50 <= p95", () => {
    const out = runMonteCarloSimulation({
      historicalReturns: [0.01, -0.02, 0.015, -0.005, 0.008, -0.012],
      paths: 8000,
      horizon: 20,
      seed: 42,
    });
    expect(out.p5).toBeLessThanOrEqual(out.p50);
    expect(out.p50).toBeLessThanOrEqual(out.p95);
  });

  it("é reprodutível com a mesma seed", () => {
    const input = {
      historicalReturns: [0.01, -0.02, 0.03],
      paths: 3000,
      horizon: 15,
      seed: 12345,
    } as const;
    const a = runMonteCarloSimulation(input);
    const b = runMonteCarloSimulation(input);
    expect(a.p50).toBe(b.p50);
    expect(a.p5).toBe(b.p5);
    expect(a.p95).toBe(b.p95);
  });

  it("P50 da riqueza terminal situa-se entre min e max observados na simulação", () => {
    const { p50, terminalMin, terminalMax } = runMonteCarloSimulation({
      historicalReturns: [0.01, -0.02, 0.015, -0.005, 0.008, -0.012],
      paths: 6000,
      horizon: 20,
      seed: 7,
    });
    expect(p50).toBeGreaterThanOrEqual(terminalMin);
    expect(p50).toBeLessThanOrEqual(terminalMax);
  });
});
