import type { AuthError } from "@supabase/supabase-js";

/** Traduz / unifica erros comuns do GoTrue (registo e login). */
export function formatAuthError(err: AuthError): string {
  const msg = err.message ?? "";
  const lower = msg.toLowerCase();
  const code = err.code ?? "";

  if (
    code === "user_already_exists" ||
    lower.includes("already registered") ||
    lower.includes("user already registered") ||
    lower.includes("email address is already registered")
  ) {
    return "Este e-mail já está registado. Use «Entrar» ou, se usou Google antes, «Continuar com Google».";
  }

  return msg;
}

/** Após signUp: Supabase pode devolver user com identities vazias quando o e-mail já existe (sem erro explícito). */
export function isSignUpDuplicateEmailNoIdentities(user: {
  identities?: unknown[] | null;
} | null): boolean {
  if (!user) return false;
  return Array.isArray(user.identities) && user.identities.length === 0;
}
