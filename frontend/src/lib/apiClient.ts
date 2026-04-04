import axios, { isAxiosError } from "axios";
import { getApiBaseUrl } from "@/config/api";
import { supabase } from "@/lib/supabaseClient";

/** Evita pedidos “pendurados” quando a API está offline ou na porta errada. */
const API_TIMEOUT_MS = 25_000;

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: API_TIMEOUT_MS,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

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
      "Não foi possível ligar à API (rede/CORS/URL). Verifique NEXT_PUBLIC_API_BASE_URL e se o backend está no ar."
    );
  }
  if (e.response?.status === 401) {
    return (
      "Sessão inválida ou token em falta (401). Confirme que está com login feito, " +
      "que o Supabase no front coincide com o do backend e que NEXT_PUBLIC_API_BASE_URL aponta para o servidor correto."
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

api.interceptors.request.use(async (config) => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    /* getSession falhou; pedido segue sem Bearer — rotas públicas ou 401 explícito */
  }
  return config;
});
