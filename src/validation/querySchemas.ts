import { z } from "zod";

function firstQueryValue(val: unknown): unknown {
  if (Array.isArray(val)) return val[0];
  return val;
}

/**
 * Query `days`: janela em dias (1–90). Omite ou vazio → 30.
 * Suporta string repetida na query (usa o primeiro valor).
 */
export const simulationHistoricalQuerySchema = z.object({
  days: z.preprocess((val) => {
    const v = firstQueryValue(val);
    if (v === undefined || v === null || v === "") return 30;
    if (typeof v === "string") {
      const t = v.trim();
      if (t === "") return 30;
      return Number.parseInt(t, 10);
    }
    if (typeof v === "number") return v;
    return Number.NaN;
  }, z.number().int().min(1, { message: "days deve ser pelo menos 1" }).max(90, { message: "days não pode exceder 90" })),
});

export type SimulationHistoricalQuery = z.infer<typeof simulationHistoricalQuerySchema>;

/** Live search de ativos (`q` = texto em `symbol` ou `name`). */
export const assetSearchQuerySchema = z.object({
  q: z.preprocess((val) => {
    const v = firstQueryValue(val);
    if (v === undefined || v === null) return "";
    return String(v).trim();
  }, z.string().min(2, { message: "Informe ao menos 2 caracteres em q." }).max(120)),
  limit: z.preprocess((val) => {
    const v = firstQueryValue(val);
    if (v === undefined || v === null || v === "") return 20;
    if (typeof v === "string") return Number.parseInt(v, 10);
    if (typeof v === "number") return v;
    return Number.NaN;
  }, z.number().int().min(1).max(100)),
  offset: z.preprocess((val) => {
    const v = firstQueryValue(val);
    if (v === undefined || v === null || v === "") return 0;
    if (typeof v === "string") return Number.parseInt(v, 10);
    if (typeof v === "number") return v;
    return Number.NaN;
  }, z.number().int().min(0).max(10_000)),
});

export type AssetSearchQuery = z.infer<typeof assetSearchQuerySchema>;

/** Último preço: `symbol` (um) ou `symbols` (lista separada por vírgula). */
export const assetLastPriceQuerySchema = z
  .object({
    symbol: z.preprocess((val) => {
      const v = firstQueryValue(val);
      if (v === undefined || v === null || v === "") return undefined;
      return String(v).trim();
    }, z.string().min(1).max(32).optional()),
    symbols: z.preprocess((val) => {
      const v = firstQueryValue(val);
      if (v === undefined || v === null || v === "") return undefined;
      return String(v).trim();
    }, z.string().min(1).max(2000).optional()),
  })
  .refine((d) => Boolean(d.symbol) || Boolean(d.symbols), {
    message: "Informe symbol ou symbols.",
  });

export type AssetLastPriceQuery = z.infer<typeof assetLastPriceQuerySchema>;
