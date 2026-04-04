import type { Response } from "express";
import type { ZodError } from "zod";
import { API_SEMANTIC_VERSION } from "../config/apiVersion";

export function sendSuccess(res: Response, data: unknown, status = 200): void {
  res.status(status).json({
    success: true,
    apiVersion: API_SEMANTIC_VERSION,
    data,
  });
}

export function sendError(res: Response, status: number, message: string, details?: unknown): void {
  const body: Record<string, unknown> = {
    success: false,
    apiVersion: API_SEMANTIC_VERSION,
    error: message,
  };
  if (details !== undefined) body.details = details;
  res.status(status).json(body);
}

export function sendValidationError(res: Response, error: ZodError): void {
  sendError(res, 422, "Parâmetros inválidos.", formatZodIssues(error));
}

function formatZodIssues(error: ZodError) {
  return error.issues.map((i) => ({
    path: i.path.length ? i.path.join(".") : "query",
    message: i.message,
    code: i.code,
  }));
}
