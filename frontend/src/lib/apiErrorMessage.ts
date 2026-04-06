import { isAxiosError } from "axios";

const API_TIMEOUT_MS = 25_000;

/** Mensagem legível para erros de rede / API (sem depender da instância `api`). */
export function messageFromApiError(e: unknown): string {
  if (!isAxiosError(e)) {
    return e instanceof Error ? e.message : "Erro desconhecido.";
  }
  if (e.code === "ECONNABORTED" || /timeout/i.test(e.message)) {
    return (
      `Tempo esgotado (${API_TIMEOUT_MS / 1000}s) ao contactar a API. ` +
      "Confirme que o backend Express está a correr e que NEXT_PUBLIC_API_BASE_URL aponta para a porta certa " +
      "(ex.: http://localhost:3001 se o Next estiver em :3000). Reinicie o Next após mudar o .env."
    );
  }
  if (e.code === "ECONNREFUSED") {
    return (
      "Conexão recusada: nada está a escutar nesse endereço. Inicie o servidor Node na raiz do projeto " +
      "(ex.: npm run dev) e verifique a variável PORT e NEXT_PUBLIC_API_BASE_URL."
    );
  }
  if (e.message === "Network Error") {
    return (
      "Não foi possível ligar à API (o browser bloqueou ou não há rota). Confirme: (1) NEXT_PUBLIC_API_BASE_URL sem barra no fim e reinício do Next após mudar o .env; " +
      "(2) no Railway, FRONTEND_ORIGINS inclui a origem exata do site (https://seu-app.vercel.app) — http://localhost:3000 e http://127.0.0.1:3000 são origens diferentes; " +
      "(3) para deploy preview *.vercel.app, na API use CORS_ALLOW_VERCEL_PREVIEWS=true ou acrescente a URL exata em FRONTEND_ORIGINS."
    );
  }
  if (e.response?.status === 401) {
    return (
      "Sessão inválida ou token em falta (401). Faça login novamente e confirme que NEXT_PUBLIC_API_BASE_URL aponta para o servidor correto."
    );
  }
  const body = e.response?.data;
  if (
    body &&
    typeof body === "object" &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "string"
  ) {
    return (body as { error: string }).error;
  }
  return e.message;
}
