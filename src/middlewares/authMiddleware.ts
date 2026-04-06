import type { NextFunction, Request, Response } from "express";

import { supabaseAnon } from "../lib/supabaseAnonClient";

function parseBearerToken(req: Request): string | null {
  const raw = req.headers.authorization;
  if (!raw || typeof raw !== "string") return null;
  const m = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return m?.[1]?.trim() || null;
}

/**
 * Exige `Authorization: Bearer <access_token>` válido (Supabase Auth).
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

  const { data, error } = await supabaseAnon.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Token inválido ou expirado.",
    });
    return;
  }

  req.user = {
    id: data.user.id,
    email: data.user.email ?? undefined,
  };

  next();
}
