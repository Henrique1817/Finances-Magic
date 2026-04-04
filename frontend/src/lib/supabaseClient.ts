import { createClient } from "@supabase/supabase-js";

/** Placeholders só para build/SSG; no browser use sempre `NEXT_PUBLIC_*` reais. */
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "https://placeholder.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.build-placeholder";

export function isSupabaseBrowserConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

/** Mensagem quando `signIn`/`signUp` lançam (ex.: TypeError: Failed to fetch). */
export function describeSupabaseAuthException(e: unknown): string {
  if (e instanceof TypeError) {
    if (e.message === "Failed to fetch" || e.message.includes("fetch")) {
      return (
        "Não foi possível contactar o Supabase. Confira: NEXT_PUBLIC_SUPABASE_URL " +
        "(ex.: https://xxxxx.supabase.co), chave anon em NEXT_PUBLIC_SUPABASE_ANON_KEY, " +
        "projeto ativo no dashboard, rede e extensões (bloqueador). Reinicie `next dev` após alterar .env.local."
      );
    }
    return e.message;
  }
  if (e instanceof Error) return e.message;
  return "Erro inesperado ao falar com o Supabase.";
}

/**
 * Cliente browser para Supabase Auth (sessão em memória / storage padrão do SDK).
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    flowType: "pkce",
    detectSessionInUrl: true,
  },
});
