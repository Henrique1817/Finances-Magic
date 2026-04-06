import type { Request, Response } from "express";

import { env } from "../config/env";
import { sendError, sendSuccess } from "../lib/http";
import { supabaseAnon } from "../lib/supabaseAnonClient";
import { createSupabaseServerClient } from "../lib/supabaseServerCookies";

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

export async function authLogin(req: Request, res: Response): Promise<void> {
  const body = req.validatedBody as { email: string; password: string };
  const { data, error } = await supabaseAnon.auth.signInWithPassword({
    email: body.email.trim().toLowerCase(),
    password: body.password,
  });
  if (error || !data.session) {
    const msg =
      error?.message === "Invalid login credentials"
        ? "E-mail ou senha incorretos."
        : (error?.message ?? "Falha no login.");
    sendError(res, 401, msg);
    return;
  }
  const s = data.session;
  sendSuccess(res, {
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    expires_at: s.expires_at,
    user: { id: s.user.id, email: s.user.email ?? undefined },
  });
}

export async function authRegister(req: Request, res: Response): Promise<void> {
  const body = req.validatedBody as { email: string; password: string };
  const { data, error } = await supabaseAnon.auth.signUp({
    email: body.email.trim().toLowerCase(),
    password: body.password,
  });
  if (error) {
    sendError(res, 400, error.message);
    return;
  }
  const identities = data.user?.identities;
  if (data.user && Array.isArray(identities) && identities.length === 0) {
    sendError(
      res,
      409,
      "Este e-mail já está associado a uma conta. Use «Entrar» ou a mesma forma de registo de sempre.",
    );
    return;
  }
  if (!data.session) {
    sendSuccess(
      res,
      {
        session: null,
        user: data.user
          ? { id: data.user.id, email: data.user.email ?? undefined }
          : null,
        message:
          "Conta criada. Se o projeto exigir confirmação por e-mail, verifique a caixa de entrada antes de entrar.",
      },
      201,
    );
    return;
  }
  const s = data.session;
  sendSuccess(
    res,
    {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: s.expires_at,
      user: { id: s.user.id, email: s.user.email ?? undefined },
    },
    201,
  );
}

export async function authRefresh(req: Request, res: Response): Promise<void> {
  const body = req.validatedBody as { refresh_token: string };
  const { data, error } = await supabaseAnon.auth.refreshSession({
    refresh_token: body.refresh_token,
  });
  if (error || !data.session) {
    sendError(res, 401, error?.message ?? "Refresh token inválido ou expirado.");
    return;
  }
  const s = data.session;
  sendSuccess(res, {
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    expires_at: s.expires_at,
    user: { id: s.user.id, email: s.user.email ?? undefined },
  });
}

export async function authMe(req: Request, res: Response): Promise<void> {
  sendSuccess(res, { user: req.user });
}

export async function authOAuthGoogleStart(req: Request, res: Response): Promise<void> {
  const nextUrl = sanitizeOAuthFrontendRedirect(req.query.redirect_to);
  const apiBase = resolvePublicApiUrl(req);
  const callbackUrl = `${apiBase}/api/v1/auth/oauth/callback`;

  res.cookie(OAUTH_FRONTEND_COOKIE, nextUrl, {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    maxAge: OAUTH_COOKIE_MAX_AGE_MS,
    path: "/",
  });

  const supabase = createSupabaseServerClient(req, res);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl,
      scopes: "email profile openid",
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data.url) {
    sendError(res, 502, error?.message ?? "Não foi possível iniciar o login com Google.");
    return;
  }

  res.redirect(302, data.url);
}

export async function authOAuthCallback(req: Request, res: Response): Promise<void> {
  const errDesc = req.query.error_description ?? req.query.error;
  const frontend =
    (typeof req.cookies[OAUTH_FRONTEND_COOKIE] === "string"
      ? req.cookies[OAUTH_FRONTEND_COOKIE]
      : null) ?? sanitizeOAuthFrontendRedirect(undefined);

  res.clearCookie(OAUTH_FRONTEND_COOKIE, { path: "/" });

  if (errDesc != null && String(errDesc).length > 0) {
    const raw = decodeURIComponent(String(errDesc).replace(/\+/g, " "));
    res.redirect(302, `${frontend}?error=${encodeURIComponent(raw)}`);
    return;
  }

  const code = req.query.code;
  if (typeof code !== "string" || !code) {
    res.redirect(
      302,
      `${frontend}?error=${encodeURIComponent("Código OAuth em falta. Volte a tentar.")}`,
    );
    return;
  }

  const supabase = createSupabaseServerClient(req, res);
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    res.redirect(
      302,
      `${frontend}?error=${encodeURIComponent(error?.message ?? "Falha ao concluir o login com Google.")}`,
    );
    return;
  }

  const s = data.session;
  const hash = new URLSearchParams({
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    expires_at: String(s.expires_at ?? ""),
  }).toString();

  res.redirect(302, `${frontend}#${hash}`);
}
