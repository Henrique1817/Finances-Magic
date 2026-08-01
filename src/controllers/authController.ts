import type { Request, Response } from "express";

import { env } from "../config/env";
import { sendError, sendSuccess } from "../lib/http";
import {
  neonRefreshAccessToken,
  neonSignInWithPassword,
  neonSignUpWithPassword,
  neonStartGoogleOAuth,
} from "../lib/neonAuth";
import { ensureUserWallet } from "../services/walletService";

const OAUTH_FRONTEND_COOKIE = "cc_oauth_frontend";
const OAUTH_COOKIE_MAX_AGE_MS = 600_000;

function resolvePublicApiUrl(req: Request): string {
  const fixed = env.publicApiBaseUrl?.replace(/\/$/, "").trim();
  if (fixed) return fixed;
  const proto = (req.get("x-forwarded-proto") ?? req.protocol).split(",")[0]?.trim() || "https";
  const host = (req.get("x-forwarded-host") ?? req.get("host") ?? "").split(",")[0]?.trim();
  if (!host) return `http://localhost:${env.port}`;
  return `${proto}://${host}`;
}

/** Garante que o redirect pós-OAuth aponta para um front permitido (CORS). */
function sanitizeOAuthFrontendRedirect(raw: unknown): string {
  const fallbackOrigin = env.frontendOrigins[0] ?? "http://localhost:3000";
  const fallback = `${fallbackOrigin.replace(/\/$/, "")}/auth/callback`;
  if (raw == null || typeof raw !== "string" || !raw.trim()) return fallback;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return fallback;
  }
  if (!env.frontendOrigins.includes(url.origin)) return fallback;
  if (!url.pathname.includes("auth/callback")) {
    return `${url.origin}/auth/callback`;
  }
  return url.toString();
}

function buildFrontendRedirectWithError(frontendUrl: string, message: string): string {
  const url = new URL(frontendUrl);
  url.searchParams.set("error", message);
  return url.toString();
}

function isLikelyEmailConflictMessage(raw: string): boolean {
  const msg = raw.toLowerCase();
  return (
    msg.includes("already") ||
    msg.includes("already registered") ||
    msg.includes("already exists") ||
    msg.includes("identity is already linked") ||
    (msg.includes("email") && msg.includes("exists")) ||
    msg.includes("user already exists")
  );
}

function normalizeOAuthErrorMessage(raw: string): string {
  if (isLikelyEmailConflictMessage(raw)) {
    return "Este e-mail já está associado a uma conta com outro método de autenticação. Entre com e-mail e senha para continuar.";
  }
  return raw;
}

export async function authLogin(req: Request, res: Response): Promise<void> {
  const body = req.validatedBody as { email: string; password: string };
  try {
    const session = await neonSignInWithPassword(body.email.trim().toLowerCase(), body.password);
    await ensureUserWallet(session.user.id, session.user.email);
    sendSuccess(res, session);
  } catch (err) {
    const msg =
      err instanceof Error && err.message
        ? err.message.includes("Invalid") || (err as { status?: number }).status === 401
          ? "E-mail ou senha incorretos."
          : err.message
        : "Falha no login.";
    sendError(res, 401, msg);
  }
}

export async function authRegister(req: Request, res: Response): Promise<void> {
  const body = req.validatedBody as { email: string; password: string };
  try {
    const session = await neonSignUpWithPassword(body.email.trim().toLowerCase(), body.password);
    await ensureUserWallet(session.user.id, session.user.email);
    sendSuccess(res, session, 201);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Falha no registo.";
    if (isLikelyEmailConflictMessage(raw)) {
      sendError(
        res,
        409,
        "Este e-mail já está associado a uma conta. Use «Entrar» ou a mesma forma de registo de sempre.",
      );
      return;
    }
    sendError(res, 400, raw);
  }
}

export async function authRefresh(req: Request, res: Response): Promise<void> {
  const body = req.validatedBody as { refresh_token: string };
  try {
    const session = await neonRefreshAccessToken(body.refresh_token);
    sendSuccess(res, session);
  } catch (err) {
    sendError(res, 401, err instanceof Error ? err.message : "Refresh token inválido ou expirado.");
  }
}

export async function authMe(req: Request, res: Response): Promise<void> {
  sendSuccess(res, { user: req.user });
}

/**
 * Inicia Google OAuth via Neon Auth.
 * callbackURL = front `/auth/callback` (Neon Auth define a sessão no domínio auth;
 * o front troca por JWT via `NEXT_PUBLIC_NEON_AUTH_URL`).
 */
export async function authOAuthGoogleStart(req: Request, res: Response): Promise<void> {
  const nextUrl = sanitizeOAuthFrontendRedirect(req.query.redirect_to);

  res.cookie(OAUTH_FRONTEND_COOKIE, nextUrl, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    maxAge: OAUTH_COOKIE_MAX_AGE_MS,
    path: "/",
  });

  try {
    const url = await neonStartGoogleOAuth(nextUrl);
    res.redirect(302, url);
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : "Não foi possível iniciar o login com Google.";
    const safeMsg = normalizeOAuthErrorMessage(rawMsg);
    res.redirect(302, buildFrontendRedirectWithError(nextUrl, safeMsg));
  }
}

/**
 * Compat: se o Neon Auth redirecionar para a API (legado), reenvia para o front.
 * O fluxo preferido usa callbackURL = front `/auth/callback`.
 */
export async function authOAuthCallback(req: Request, res: Response): Promise<void> {
  const errDesc = req.query.error_description ?? req.query.error;
  const frontend =
    (typeof req.cookies[OAUTH_FRONTEND_COOKIE] === "string"
      ? req.cookies[OAUTH_FRONTEND_COOKIE]
      : null) ?? sanitizeOAuthFrontendRedirect(undefined);

  res.clearCookie(OAUTH_FRONTEND_COOKIE, { path: "/" });

  if (errDesc != null && String(errDesc).length > 0) {
    const raw = decodeURIComponent(String(errDesc).replace(/\+/g, " "));
    const safeMsg = normalizeOAuthErrorMessage(raw);
    res.redirect(302, buildFrontendRedirectWithError(frontend, safeMsg));
    return;
  }

  // Sessão fica no domínio Neon Auth; o front conclui com createAuthClient + token().
  const dest = new URL(frontend);
  for (const [k, v] of Object.entries(req.query)) {
    if (typeof v === "string" && k !== "error" && k !== "error_description") {
      dest.searchParams.set(k, v);
    }
  }
  res.redirect(302, dest.toString());
}

/** Exposto para health/docs. */
export function authPublicConfig(_req: Request, res: Response): void {
  sendSuccess(res, {
    provider: "neon_auth",
    neonAuthUrl: env.neonAuthUrl,
    apiBaseHint: resolvePublicApiUrl(_req),
  });
}
