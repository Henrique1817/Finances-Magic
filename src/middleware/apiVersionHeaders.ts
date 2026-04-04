import type { NextFunction, Request, Response } from "express";
import { API_ROUTE_VERSION, API_SEMANTIC_VERSION } from "../config/apiVersion";

/**
 * Headers de versionamento para clientes inspecionarem o contrato sem parsear o body.
 * - `X-API-Version`: semver do payload JSON (`apiVersion`).
 * - `X-API-Route-Version`: segmento da URL (`v1`).
 */
export function apiVersionHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-API-Version", API_SEMANTIC_VERSION);
  res.setHeader("X-API-Route-Version", API_ROUTE_VERSION);
  next();
}
