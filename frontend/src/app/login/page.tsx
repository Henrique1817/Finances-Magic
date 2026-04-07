"use client";

import { Suspense, useEffect, useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { isAxiosError } from "axios";
import { GoogleOAuthButton } from "@/components/auth/GoogleOAuthButton";
import { formatApiAuthMessage } from "@/lib/formatAuthError";
import { loginWithPassword } from "@/lib/authApi";
import { hasAuthSession } from "@/lib/authSession";
import { messageFromApiError } from "@/lib/apiErrorMessage";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hasAuthSession()) router.replace("/");
  }, [router]);

  useEffect(() => {
    const qErr = searchParams.get("error");
    if (!qErr) return;
    setError(decodeURIComponent(String(qErr).replace(/\+/g, " ")));
  }, [searchParams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Informe seu e-mail.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      await loginWithPassword(email.trim().toLowerCase(), password);
      router.replace("/");
      router.refresh();
    } catch (e) {
      if (isAxiosError(e)) {
        const body = e.response?.data;
        const msg =
          body &&
          typeof body === "object" &&
          "error" in body &&
          typeof (body as { error: unknown }).error === "string"
            ? (body as { error: string }).error
            : messageFromApiError(e);
        setError(formatApiAuthMessage(msg));
      } else {
        setError(e instanceof Error ? e.message : "Erro ao entrar.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(80rem 36rem at 20% -10%, rgba(34,211,238,0.14), transparent 55%), radial-gradient(70rem 34rem at 100% 0%, rgba(168,85,247,0.12), transparent 58%)",
        }}
      />
      <div className="glass-panel relative w-full max-w-md border border-white/15 bg-slate-950/55 p-6 shadow-[0_30px_80px_rgba(2,6,23,0.65)] sm:p-8 md:p-10">
        <div className="pointer-events-none absolute inset-0 rounded-2xl border border-white/10 [mask-image:linear-gradient(to_bottom,white,transparent)]" />
        <div className="mb-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-300">
            Code Chroma
          </p>
          <h1 className="mt-2 bg-gradient-to-b from-white to-slate-300 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
            Entrar
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            Acesse sua conta com e-mail e senha ou continue com Google.
          </p>
        </div>

        <GoogleOAuthButton onError={setError} disabled={loading} />

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center" aria-hidden>
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wider">
            <span className="bg-[#0a0f18]/90 px-3 text-slate-500">ou com e-mail</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor={`${formId}-email`}
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400"
            >
              E-mail
            </label>
            <input
              id={`${formId}-email`}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-950/60 px-4 py-2.5 text-sm text-white outline-none ring-cyan-400/40 transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2"
              placeholder="voce@empresa.com"
            />
          </div>
          <div>
            <label
              htmlFor={`${formId}-password`}
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400"
            >
              Senha
            </label>
            <input
              id={`${formId}-password`}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-slate-950/60 px-4 py-2.5 text-sm text-white outline-none ring-cyan-400/40 transition placeholder:text-slate-500 focus:border-cyan-300/70 focus:ring-2"
              placeholder="••••••••"
            />
          </div>

          {error ? (
            <p className="rounded-xl border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-sm text-rose-300" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-cyan-300 to-violet-300 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_10px_30px_rgba(34,211,238,0.35)] transition enabled:hover:brightness-105 disabled:opacity-50"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Não tem conta?{" "}
          <Link
            href="/register"
            className="font-medium text-cyan-300 underline-offset-2 hover:text-cyan-200 hover:underline"
          >
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-slate-400">A carregar…</p>
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
