/**
 * Base URL do backend Code Chroma (sem barra final).
 * Padrão **3001**: o Next.js em dev costuma usar 3000; o Express deve usar outra porta.
 */
export function getApiBaseUrl(): string {
  let raw = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!raw) return "http://localhost:3001";
  raw = raw.replace(/\/$/, "");
  // Se a env incluir o prefixo da API, evita `/api/v1/api/v1/...` (404).
  raw = raw.replace(/\/api\/v1$/i, "");
  return raw;
}
