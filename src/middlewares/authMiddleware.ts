import type { NextFunction, Request, Response } from "express";

import { verifyNeonAccessToken } from "../lib/neonAuth";

function parseBearerToken(req: Request): string | null {
  const raw = req.headers.authorization;
  if (!raw || typeof raw !== "string") return null;
  const m = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return m?.[1]?.trim() || null;
}

/**
 * Exige `Authorization: Bearer <jwt>` válido (Neon Auth / JWKS).
 * Preenche `req.user` com o id (UUID) alinhado ao `User.id` do Prisma.
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = parseBearerToken(req);

  if (!token) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Envie o token no header Authorization: Bearer <token>.",
    });
    return;
  }

  const payload = await verifyNeonAccessToken(token);
  const id = typeof payload?.sub === "string" ? payload.sub : typeof payload?.id === "string" ? payload.id : null;

  if (!payload || !id) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Token inválido ou expirado.",
    });
    return;
  }

  req.user = {
    id,
    email: typeof payload.email === "string" ? payload.email : undefined,
  };

  next();
}
