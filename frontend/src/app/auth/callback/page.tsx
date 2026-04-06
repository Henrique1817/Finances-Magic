"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { setStoredSession } from "@/lib/authSession";

function parseHashParams(hash: string): Record<string, string> {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const out: Record<string, string> = {};
  params.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("A concluir o login com Google…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const qErr =
      searchParams.get("error_description") ?? searchParams.get("error");
    if (qErr) {
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

    setFailed(true);
    setMessage("Não foi possível concluir o login. Volte a tentar.");
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
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="glass-panel max-w-md p-8 text-center">
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
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-slate-400">A carregar…</p>
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
