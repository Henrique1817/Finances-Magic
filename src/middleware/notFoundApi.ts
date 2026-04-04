import type { Request, Response } from "express";
import { sendError } from "../lib/http";

/** 404 apenas para caminhos sob `/api` que não casaram rota. */
export function notFoundApi(req: Request, res: Response): void {
  sendError(res, 404, "Recurso não encontrado.");
}
