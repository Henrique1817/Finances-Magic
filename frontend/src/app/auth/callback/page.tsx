"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { getNeonAuthUrl } from "@/config/neonAuth";
import { setStoredSession } from "@/lib/authSession";
import { NEON_BROWSER_REFRESH_TOKEN } from "@/lib/neonBrowserSession";

function parseHashParams(hash: string): Record<string, string> {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const out: Record<string, string> = {};
  params.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

async function exchangeNeonBrowserSession(): Promise<{
  access_token: string;
  expires_at?: number;
} | null> {
  const base = getNeonAuthUrl();
  if (!base) return null;

  const tokenRes = await fetch(`${base}/token`, {
    method: "GET",
    credentials: "include",
    headers: { Origin: window.location.origin },
  });
  if (!tokenRes.ok) return null;
  const data = (await tokenRes.json()) as { token?: string };
  if (!data.token) return null;

  let expires_at: number | undefined;
  try {
    const payload = JSON.parse(atob(data.token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/"))) as {
      exp?: number;
    };
    if (typeof payload.exp === "number") expires_at = payload.exp;
  } catch {
    /* ignore */
  }

  return { access_token: data.token, expires_at };
}

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("A concluir o login com Google…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const qErr =
        searchParams.get("error_description") ?? searchParams.get("error");
      if (qErr) {
        if (cancelled) return;
        setFailed(true);
        setMessage(decodeURIComponent(String(qErr).replace(/\+/g, " ")));
        return;
      }

      if (typeof window === "undefined") return;

      const fromHash = parseHashParams(window.location.hash);
      const access = fromHash.access_token;
      const refresh = fromHash.refresh_token;
      const expiresAt = fromHash.expires_at;

      if (access && refresh) {
        setStoredSession({
          access_token: access,
          refresh_token: refresh,
          expires_at: expiresAt ? Number(expiresAt) : undefined,
        });
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        router.replace("/");
        router.refresh();
        return;
      }

      // Neon Auth OAuth: sessão em cookie no domínio auth → JWT via /token
      try {
        const exchanged = await exchangeNeonBrowserSession();
        if (exchanged) {
          setStoredSession({
            access_token: exchanged.access_token,
            refresh_token: NEON_BROWSER_REFRESH_TOKEN,
            expires_at: exchanged.expires_at,
          });
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
          router.replace("/");
          router.refresh();
          return;
        }
      } catch {
        /* fall through */
      }

      if (cancelled) return;
      setFailed(true);
      setMessage("Não foi possível concluir o login. Volte a tentar.");
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  useEffect(() => {
    if (!failed) return;
    const timer = window.setTimeout(() => {
      const msg = message.trim() || "Não foi possível concluir o login. Volte a tentar.";
      router.replace(`/login?error=${encodeURIComponent(msg)}`);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [failed, message, router]);

  return (
    <div className="flex min-h-dvh items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="glass-panel max-w-md p-6 text-center sm:p-8">
        <p className={failed ? "text-sm text-rose-300" : "text-sm text-slate-300"}>
          {message}
        </p>
        {failed ? (
          <Link
            href="/login"
            className="mt-6 inline-block text-sm font-medium text-cyan-400/90 underline-offset-2 hover:text-cyan-300 hover:underline"
          >
            Voltar ao login
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center px-4">
          <p className="text-sm text-slate-400">A carregar…</p>
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
