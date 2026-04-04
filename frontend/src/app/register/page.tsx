"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GoogleOAuthButton } from "@/components/auth/GoogleOAuthButton";
import {
  formatAuthError,
  isSignUpDuplicateEmailNoIdentities,
} from "@/lib/formatAuthError";
import {
  describeSupabaseAuthException,
  isSupabaseBrowserConfigured,
  supabase,
} from "@/lib/supabaseClient";

export default function RegisterPage() {
  const router = useRouter();
  const formId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/");
    });
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError("Informe seu e-mail.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    if (!isSupabaseBrowserConfigured()) {
      setError(
        "Configure o Supabase no frontend: crie `frontend/.env.local` com NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY (Settings → API). Reinicie `npm run dev`.",
      );
      return;
    }
    setLoading(true);
    try {
      const { data, error: signErr } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signErr) {
        setError(formatAuthError(signErr));
        return;
      }
      if (isSignUpDuplicateEmailNoIdentities(data.user)) {
        setError(
          "Este e-mail já está associado a uma conta. Use «Entrar» ou «Continuar com Google» (se for o mesmo Gmail). No painel Supabase, pode haver duas entradas se criou com Google e com senha — use o mesmo método de sempre.",
        );
        return;
      }
      if (data.session) {
        router.replace("/");
        router.refresh();
        return;
      }
      setInfo(
        "Conta criada. Se o projeto exigir confirmação por e-mail, verifique sua caixa de entrada antes de entrar.",
      );
    } catch (e) {
      setError(describeSupabaseAuthException(e));
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
            Criar conta
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Crie conta com Google ou com e-mail e senha.
          </p>
        </div>

        <GoogleOAuthButton
          label="Criar conta com Google"
          onError={setError}
          disabled={loading}
        />

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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-2.5 text-sm text-white outline-none ring-cyan-400/40 placeholder:text-slate-600 focus:border-cyan-400/40 focus:ring-2"
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div>
            <label
              htmlFor={`${formId}-confirm`}
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400"
            >
              Confirmar senha
            </label>
            <input
              id={`${formId}-confirm`}
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-950/50 px-4 py-2.5 text-sm text-white outline-none ring-cyan-400/40 placeholder:text-slate-600 focus:border-cyan-400/40 focus:ring-2"
              placeholder="Repita a senha"
            />
          </div>

          {error ? (
            <p className="text-sm text-rose-400" role="alert">
              {error}
            </p>
          ) : null}
          {info ? (
            <p className="text-sm text-emerald-300/90" role="status">
              {info}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-cyan-500/90 to-violet-500/90 py-2.5 text-sm font-semibold text-slate-950 shadow-neon transition enabled:hover:from-cyan-400 enabled:hover:to-violet-400 disabled:opacity-50"
          >
            {loading ? "Registrando…" : "Registrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Já tem conta?{" "}
          <Link
            href="/login"
            className="font-medium text-cyan-400/90 underline-offset-2 hover:text-cyan-300 hover:underline"
          >
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
