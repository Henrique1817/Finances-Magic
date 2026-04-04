"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function hintForOAuthFailure(text: string): string {
  const t = text.toLowerCase();
  if (
    t.includes("code verifier") ||
    t.includes("invalid request") ||
    t.includes("redirect_uri") ||
    t.includes("redirect uri")
  ) {
    return (
      `${text} — Confirme no Supabase: Authentication → URL Configuration → Redirect URLs, inclua exatamente ` +
      "`http://localhost:3000/auth/callback` e `http://127.0.0.1:3000/auth/callback` se usar ambos. " +
      "No Google Cloud, o redirect autorizado tem de ser `https://<ref>.supabase.co/auth/v1/callback`."
    );
  }
  return text;
}

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("A concluir o login com Google…");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const code = searchParams.get("code");
    const err =
      searchParams.get("error_description") ?? searchParams.get("error");

    if (err) {
      setFailed(true);
      const raw = decodeURIComponent(String(err).replace(/\+/g, " "));
      setMessage(hintForOAuthFailure(raw));
      return;
    }

    async function finish() {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setFailed(true);
          setMessage(hintForOAuthFailure(error.message));
          return;
        }
        router.replace("/");
        router.refresh();
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        router.replace("/");
        router.refresh();
        return;
      }

      setFailed(true);
      setMessage("Não foi possível concluir o login. Volte a tentar.");
    }

    void finish();
  }, [router, searchParams]);

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
