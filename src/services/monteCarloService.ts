/**
 * Monte Carlo didático: amostragem com reposição de retornos históricos
 * ao longo de `horizon` períodos; agrega riqueza terminal e percentis.
 */
export type MonteCarloInput = {
  historicalReturns: number[];
  paths: number;
  /** Períodos por trajetória (padrão 20). */
  horizon?: number;
  seed?: number;
};

export type MonteCarloOutput = {
  p5: number;
  p50: number;
  p95: number;
  terminalMin: number;
  terminalMax: number;
};

/** Percentil linear em array já ordenada (0–100). */
export function linearPercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const clamped = Math.min(100, Math.max(0, p));
  const idx = (clamped / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function runMonteCarloSimulation(input: MonteCarloInput): MonteCarloOutput {
  const { historicalReturns, paths, seed = 1, horizon = 20 } = input;
  if (historicalReturns.length === 0) {
    throw new RangeError("historicalReturns não pode ser vazio");
  }
  if (paths < 1 || !Number.isFinite(paths)) {
    throw new RangeError("paths deve ser um inteiro >= 1");
  }
  if (horizon < 1 || !Number.isFinite(horizon)) {
    throw new RangeError("horizon deve ser um inteiro >= 1");
  }

  const next = lcg(seed);
  const terminal: number[] = [];

  for (let i = 0; i < paths; i++) {
    let wealth = 1;
    for (let t = 0; t < horizon; t++) {
      const r = historicalReturns[Math.floor(next() * historicalReturns.length)];
      wealth *= 1 + r;
    }
    terminal.push(wealth);
  }

  terminal.sort((a, b) => a - b);
  return {
    p5: linearPercentile(terminal, 5),
    p50: linearPercentile(terminal, 50),
    p95: linearPercentile(terminal, 95),
    terminalMin: terminal[0],
    terminalMax: terminal[terminal.length - 1],
  };
}
