/**
 * Base URL do backend Code Chroma (sem barra final).
 * Padrão **3001**: o Next.js em dev costuma usar 3000; o Express deve usar outra porta.
 */
export function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return "http://localhost:3001";
}
