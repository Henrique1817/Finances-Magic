export {};

declare global {
  namespace Express {
    interface Request {
      /** Preenchido por `validateQuery` após sucesso do Zod. */
      validatedQuery?: unknown;
      /** Preenchido por `validateBody` após sucesso do Zod. */
      validatedBody?: unknown;
      /** Preenchido por `authMiddleware` após JWT Neon Auth válido. */
      user?: { id: string; email?: string };
    }
  }
}
