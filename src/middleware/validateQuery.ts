import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { z, ZodTypeAny } from "zod";
import { sendValidationError } from "../lib/http";

export function validateQuery<Schema extends ZodTypeAny>(schema: Schema): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      sendValidationError(res, parsed.error);
      return;
    }
    req.validatedQuery = parsed.data as z.infer<Schema>;
    next();
  };
}
