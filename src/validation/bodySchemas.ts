import { z } from "zod";

export const simulationRunBodySchema = z.object({
  energyCostIncrease: z.number().finite().min(0, { message: "energyCostIncrease deve ser >= 0" }),
  geoRiskLevel: z.number().finite().min(1, { message: "geoRiskLevel mínimo 1" }).max(10, { message: "geoRiskLevel máximo 10" }),
  aiDemandIncrease: z.number().finite().min(0, { message: "aiDemandIncrease deve ser >= 0" }),
  portfolioValue: z.number().finite().positive({ message: "portfolioValue deve ser > 0" }),
});

export type SimulationRunBody = z.infer<typeof simulationRunBodySchema>;

export const walletAssetCreateSchema = z.object({
  nome: z.string().trim().min(1, { message: "Informe o nome do ativo." }).max(200),
  setor: z.enum(["Tech", "Mineração", "Energia"], {
    message: "Setor inválido.",
  }),
  valorInvestido: z.number().finite().nonnegative({ message: "Valor investido inválido." }),
  quantidade: z.number().finite().positive({ message: "Quantidade deve ser maior que zero." }),
  assetId: z.string().min(1).optional().nullable(),
});

export type WalletAssetCreateBody = z.infer<typeof walletAssetCreateSchema>;
