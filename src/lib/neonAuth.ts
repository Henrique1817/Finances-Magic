import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { env } from "../config/env";

const SESSION_COOKIE_NAME = "__Secure-neon-auth.session_token";

type AuthUser = { id: string; email?: string; name?: string };

type EmailAuthResult = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: AuthUser;
};

function authOriginHeaders(extra?: Record<string, string>): Headers {
  const h = new Headers(extra);
  h.set("Origin", env.neonAuthTrustedOrigin);
  h.set("Content-Type", "application/json");
  return h;
}

function parseSignedSessionFromSetCookie(res: Response): string | null {
  const cookies =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [];
  for (const raw of cookies) {
    const part = raw.split(";")[0] ?? "";
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name === SESSION_COOKIE_NAME && value) return value;
  }
  return null;
}

function sessionCookieHeader(signedSessionValue: string): string {
  return `${SESSION_COOKIE_NAME}=${signedSessionValue}`;
}

const jwks = createRemoteJWKSet(new URL(env.neonAuthJwksUrl));

export async function verifyNeonAccessToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: env.neonAuthIssuer,
    });
    return payload;
  } catch {
    return null;
  }
}

async function fetchJwtWithSessionCookie(signedSessionValue: string): Promise<string> {
  const res = await fetch(`${env.neonAuthUrl}/token`, {
    method: "GET",
    headers: {
      Origin: env.neonAuthTrustedOrigin,
      Cookie: sessionCookieHeader(signedSessionValue),
    },
  });
  if (!res.ok) {
    throw new Error(`Falha ao obter JWT Neon Auth (HTTP ${res.status}).`);
  }
  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new Error("Neon Auth não devolveu JWT.");
  return data.token;
}

function jwtExpiresAtUnix(jwt: string): number {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1]!, "base64url").toString("utf8")) as {
      exp?: number;
    };
    if (typeof payload.exp === "number") return payload.exp;
  } catch {
    /* ignore */
  }
  return Math.floor(Date.now() / 1000) + 14 * 60;
}

async function completeSessionExchange(
  res: Response,
  body: { token?: string; user?: { id: string; email?: string | null; name?: string | null } },
): Promise<EmailAuthResult> {
  const signed = parseSignedSessionFromSetCookie(res);
  if (!signed) {
    throw new Error("Neon Auth não devolveu cookie de sessão.");
  }
  if (!body.user?.id) {
    throw new Error("Neon Auth não devolveu utilizador.");
  }
  const access_token = await fetchJwtWithSessionCookie(signed);
  return {
    access_token,
    refresh_token: signed,
    expires_at: jwtExpiresAtUnix(access_token),
    user: {
      id: body.user.id,
      email: body.user.email ?? undefined,
      name: body.user.name ?? undefined,
    },
  };
}

export async function neonSignInWithPassword(email: string, password: string): Promise<EmailAuthResult> {
  const res = await fetch(`${env.neonAuthUrl}/sign-in/email`, {
    method: "POST",
    headers: authOriginHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as {
    token?: string;
    user?: { id: string; email?: string | null; name?: string | null };
    message?: string;
  };
  if (!res.ok) {
    const err = new Error(body.message ?? "E-mail ou senha incorretos.") as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return completeSessionExchange(res, body);
}

export async function neonSignUpWithPassword(
  email: string,
  password: string,
  name?: string,
): Promise<EmailAuthResult> {
  const res = await fetch(`${env.neonAuthUrl}/sign-up/email`, {
    method: "POST",
    headers: authOriginHeaders(),
    body: JSON.stringify({
      email,
      password,
      name: name?.trim() || email.split("@")[0] || "User",
    }),
  });
  const body = (await res.json()) as {
    token?: string;
    user?: { id: string; email?: string | null; name?: string | null };
    message?: string;
  };
  if (!res.ok) {
    const err = new Error(body.message ?? "Falha no registo.") as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return completeSessionExchange(res, body);
}

export async function neonRefreshAccessToken(refreshToken: string): Promise<EmailAuthResult> {
  const signed = refreshToken.trim();
  const sessRes = await fetch(`${env.neonAuthUrl}/get-session`, {
    method: "GET",
    headers: {
      Origin: env.neonAuthTrustedOrigin,
      Cookie: sessionCookieHeader(signed),
    },
  });
  if (!sessRes.ok) {
    throw new Error("Refresh token inválido ou expirado.");
  }
  const sessBody = (await sessRes.json()) as {
    session?: { token?: string } | null;
    user?: { id: string; email?: string | null; name?: string | null } | null;
  };
  if (!sessBody.session || !sessBody.user?.id) {
    throw new Error("Refresh token inválido ou expirado.");
  }
  const access_token = await fetchJwtWithSessionCookie(signed);
  return {
    access_token,
    refresh_token: signed,
    expires_at: jwtExpiresAtUnix(access_token),
    user: {
      id: sessBody.user.id,
      email: sessBody.user.email ?? undefined,
      name: sessBody.user.name ?? undefined,
    },
  };
}

/** Inicia OAuth Google; devolve URL de redirect do Neon Auth. */
export async function neonStartGoogleOAuth(callbackURL: string): Promise<string> {
  const res = await fetch(`${env.neonAuthUrl}/sign-in/social`, {
    method: "POST",
    headers: authOriginHeaders(),
    body: JSON.stringify({
      provider: "google",
      callbackURL,
    }),
  });
  const body = (await res.json()) as { url?: string; redirect?: boolean; message?: string };
  if (!res.ok || !body.url) {
    throw new Error(body.message ?? "Não foi possível iniciar o login com Google.");
  }
  return body.url;
}
