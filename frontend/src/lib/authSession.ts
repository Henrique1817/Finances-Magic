const STORAGE_KEY = "codechroma.auth.session";

export type StoredAuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
};

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getStoredSession(): StoredAuthSession | null {
  const raw = readRaw();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as StoredAuthSession).access_token !== "string" ||
      typeof (parsed as StoredAuthSession).refresh_token !== "string"
    ) {
      return null;
    }
    return parsed as StoredAuthSession;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return getStoredSession()?.access_token ?? null;
}

export function getRefreshToken(): string | null {
  return getStoredSession()?.refresh_token ?? null;
}

export function setStoredSession(session: StoredAuthSession): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* quota / private mode */
  }
}

export function clearStoredSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function hasAuthSession(): boolean {
  return getStoredSession() !== null;
}
