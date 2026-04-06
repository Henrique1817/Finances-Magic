"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isAxiosError } from "axios";
import { GoogleOAuthButton } from "@/components/auth/GoogleOAuthButton";
import { formatApiAuthMessage } from "@/lib/formatAuthError";
import { loginWithPassword } from "@/lib/authApi";
import { hasAuthSession } from "@/lib/authSession";
import { messageFromApiError } from "@/lib/apiErrorMessage";

export default function LoginPage() {
  const router = useRouter();
  const formId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hasAuthSession()) router.replace("/");
  }, [router]);

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
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="glass-panel relative w-full max-w-md p-8 md:p-10">
        <div className="mb-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-cyan-400/80">
            Code Chroma
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            Entrar
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            E-mail e senha ou conta Google (OAuth via API).
          </p>
        </div>

        <GoogleOAuthButton onError={setError} disabled={loading} />

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center" aria-hidden>
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wider">
            <span className="bg-[#0a0f18]/90 px-3 text-slate-500">ou</span>
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
              className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-2.5 text-sm text-white outline-none ring-cyan-400/40 placeholder:text-slate-600 focus:border-cyan-400/40 focus:ring-2"
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
              className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-2.5 text-sm text-white outline-none ring-cyan-400/40 placeholder:text-slate-600 focus:border-cyan-400/40 focus:ring-2"
              placeholder="••••••••"
            />
          </div>

          {error ? (
            <p className="text-sm text-rose-400" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-cyan-500/90 to-violet-500/90 py-2.5 text-sm font-semibold text-slate-950 shadow-neon transition enabled:hover:from-cyan-400 enabled:hover:to-violet-400 disabled:opacity-50"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Não tem conta?{" "}
          <Link
            href="/register"
            className="font-medium text-cyan-400/90 underline-offset-2 hover:text-cyan-300 hover:underline"
          >
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
