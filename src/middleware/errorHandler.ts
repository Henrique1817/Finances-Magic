import type { NextFunction, Request, Response } from "express";
import type { Logger } from "pino";
import { env } from "../config/env";
import { sendError } from "../lib/http";
import { logger } from "../lib/logger";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) return;

  if (isMalformedJsonBodyError(err)) {
    sendError(res, 400, "Corpo JSON inválido ou malformado.");
    return;
  }

  const reqLog = (req as Request & { log?: Logger }).log;
  const log = reqLog ?? logger;
  log.error({ err }, "Erro não tratado na requisição");

  const expose = env.nodeEnv !== "production" && err instanceof Error;
  const message = expose && err.message ? err.message : "Erro interno do servidor.";
  sendError(res, 500, message);
}

function isMalformedJsonBodyError(err: unknown): boolean {
  if (!(err instanceof SyntaxError)) return false;
  const e = err as SyntaxError & { status?: number; body?: unknown; type?: string };
  if (e.status === 400 && Object.prototype.hasOwnProperty.call(e, "body")) return true;
  if (e.type === "entity.parse.failed") return true;
  return false;
}
