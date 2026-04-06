/** Traduz mensagens comuns devolvidas pela API de auth (Supabase no servidor). */
export function formatApiAuthMessage(message: string): string {
  const msg = message ?? "";
  const lower = msg.toLowerCase();

  if (
    lower.includes("already registered") ||
    lower.includes("user already registered") ||
    lower.includes("email address is already registered")
  ) {
    return "Este e-mail já está registado. Use «Entrar» ou, se usou Google antes, «Continuar com Google».";
  }

  return msg;
}

/** @deprecated Usar formatApiAuthMessage; mantido para não quebrar imports antigos. */
export function formatAuthError(err: { message?: string }): string {
  return formatApiAuthMessage(err.message ?? "");
}
