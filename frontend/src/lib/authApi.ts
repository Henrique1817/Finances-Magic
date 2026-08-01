import axios from "axios";

import { getApiBaseUrl } from "@/config/api";
import { getNeonAuthUrl } from "@/config/neonAuth";
import {
  clearStoredSession,
  setStoredSession,
  type StoredAuthSession,
} from "@/lib/authSession";
import { NEON_BROWSER_REFRESH_TOKEN } from "@/lib/neonBrowserSession";

type SuccessEnvelope<T> = { success: true; data: T };

export type AuthUser = { id: string; email?: string };

export async function loginWithPassword(
  email: string,
  password: string,
): Promise<StoredAuthSession & { user: AuthUser }> {
  const base = getApiBaseUrl();
  const { data } = await axios.post<
    SuccessEnvelope<{
      access_token: string;
      refresh_token: string;
      expires_at?: number;
      user: AuthUser;
    }>
  >(`${base}/api/v1/auth/login`, { email, password }, { headers: { "Content-Type": "application/json" } });

  if (!data.success) throw new Error("Resposta inválida da API.");
  const d = data.data;
  const session: StoredAuthSession = {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: d.expires_at,
  };
  setStoredSession(session);
  return { ...session, user: d.user };
}

export type RegisterResult =
  | { kind: "session"; session: StoredAuthSession & { user: AuthUser } }
  | {
      kind: "confirm_email";
      message: string;
      user: AuthUser | null;
    };

export async function registerWithPassword(
  email: string,
  password: string,
): Promise<RegisterResult> {
  const base = getApiBaseUrl();
  const { data } = await axios.post<
    SuccessEnvelope<{
      access_token?: string;
      refresh_token?: string;
      expires_at?: number;
      user?: AuthUser;
      session?: null;
      message?: string;
    }>
  >(`${base}/api/v1/auth/register`, { email, password }, { headers: { "Content-Type": "application/json" } });

  if (!data.success) throw new Error("Resposta inválida da API.");
  const d = data.data;
  if (d.access_token && d.refresh_token && d.user) {
    const session: StoredAuthSession = {
      access_token: d.access_token,
      refresh_token: d.refresh_token,
      expires_at: d.expires_at,
    };
    setStoredSession(session);
    return { kind: "session", session: { ...session, user: d.user } };
  }
  return {
    kind: "confirm_email",
    message: d.message ?? "Verifique seu e-mail para concluir o registo.",
    user: d.user ?? null,
  };
}

/** Atualiza tokens no storage; usar após refresh no interceptor. */
export function applyRefreshedSession(session: StoredAuthSession): void {
  setStoredSession(session);
}

async function refreshViaNeonBrowserCookie(): Promise<StoredAuthSession & { user: AuthUser }> {
  const neon = getNeonAuthUrl();
  if (!neon || typeof window === "undefined") {
    throw new Error("Neon Auth URL ausente.");
  }
  const tokenRes = await fetch(`${neon}/token`, {
    method: "GET",
    credentials: "include",
    headers: { Origin: window.location.origin },
  });
  if (!tokenRes.ok) throw new Error("Refresh Neon Auth falhou.");
  const data = (await tokenRes.json()) as { token?: string };
  if (!data.token) throw new Error("JWT Neon Auth ausente.");

  let expires_at: number | undefined;
  let user: AuthUser = { id: "unknown" };
  try {
    const payload = JSON.parse(
      atob(data.token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp?: number; sub?: string; id?: string; email?: string };
    if (typeof payload.exp === "number") expires_at = payload.exp;
    user = {
      id: payload.sub ?? payload.id ?? "unknown",
      email: payload.email,
    };
  } catch {
    /* ignore */
  }

  const session: StoredAuthSession = {
    access_token: data.token,
    refresh_token: NEON_BROWSER_REFRESH_TOKEN,
    expires_at,
  };
  setStoredSession(session);
  return { ...session, user };
}

export async function refreshSessionRequest(
  refreshToken: string,
): Promise<StoredAuthSession & { user: AuthUser }> {
  if (refreshToken === NEON_BROWSER_REFRESH_TOKEN) {
    return refreshViaNeonBrowserCookie();
  }

  const base = getApiBaseUrl();
  const { data } = await axios.post<
    SuccessEnvelope<{
      access_token: string;
      refresh_token: string;
      expires_at?: number;
      user: AuthUser;
    }>
  >(
    `${base}/api/v1/auth/refresh`,
    { refresh_token: refreshToken },
    { headers: { "Content-Type": "application/json" } },
  );

  if (!data.success) throw new Error("Refresh falhou.");
  const d = data.data;
  const session: StoredAuthSession = {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: d.expires_at,
  };
  setStoredSession(session);
  return { ...session, user: d.user };
}

export function logoutLocal(): void {
  clearStoredSession();
}
