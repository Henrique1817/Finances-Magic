import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return v;
}

function optional(name: string): string | undefined {
  const v = process.env[name];
  if (!v || v.trim() === "") return undefined;
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT) || 3000,
  /** Níveis pino: trace | debug | info | warn | error | fatal */
  logLevel:
    process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  databaseUrl: required("DATABASE_URL"),
  /** Supabase — validação de JWT no backend (`auth.getUser`) */
  supabaseUrl: required("SUPABASE_URL"),
  supabaseAnonKey: required("SUPABASE_ANON_KEY"),
  alphaVantageApiKey: optional("ALPHA_VANTAGE_API_KEY"),
  fredApiKey: optional("FRED_API_KEY"),
  newsApiKey: optional("NEWS_API_KEY"),
  /** Google Gemini — cenários IA (opcional; sem chave o endpoint retorna erro claro). */
  geminiApiKey: optional("GEMINI_API_KEY"),
  geminiModel: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash-lite",
  geminiModelFallbacks: parseCommaList(process.env.GEMINI_MODEL_FALLBACKS),
  /**
   * Cap diário por modelo Gemini para manter custo zero em free tier.
   * Formato: "gemini-2.5-flash-lite:200,gemini-2.5-flash:120,gemini-2.5-pro:60"
   */
  geminiModelDailyCaps: parseGeminiDailyCaps(process.env.GEMINI_MODEL_DAILY_CAPS),
  /** Modo teste: evita chamadas ao Gemini e gera resposta simulada localmente. */
  geminiUseMock: process.env.GEMINI_USE_MOCK === "true",
  /**
   * Regiões de clima (chaves do mapa em `ingestion.ts`), separadas por vírgula.
   * Ex.: SP_CAPITAL,BRASILIA
   */
  climateRegionKeys: parseCommaList(process.env.CLIMATE_REGION_KEYS),
  /** Força fechamentos Alpha Vantage simulados (sem rede). */
  alphaVantageUseMock: process.env.ALPHA_VANTAGE_USE_MOCK === "true",
  /** IANA, ex.: America/Sao_Paulo */
  cronTimezone: process.env.CRON_TZ ?? "America/Sao_Paulo",
  /** "false" desliga o agendamento (útil em testes). */
  ingestionCronEnabled: process.env.INGESTION_CRON_ENABLED !== "false",
  /**
   * Origens CORS permitidas (separadas por vírgula).
   * Padrão: Vite e front comuns em localhost.
   * `localhost` e `127.0.0.1` são espelhados automaticamente (o browser trata como origens diferentes).
   */
  frontendOrigins: parseOriginsList(process.env.FRONTEND_ORIGINS),
  /**
   * Se `true`, aceita qualquer `https://*.vercel.app` (útil para deploys preview).
   * Produção pode manter `false` e listar só o domínio final em FRONTEND_ORIGINS.
   */
  corsAllowVercelPreviews: process.env.CORS_ALLOW_VERCEL_PREVIEWS === "true",
  /**
   * URL pública da API (https://… sem barra final), usada no redirect OAuth (Supabase).
   * Se vazio, usa `X-Forwarded-*` / `Host` do pedido (Railway com trust proxy).
   */
  publicApiBaseUrl: optional("PUBLIC_API_BASE_URL"),
};

function expandLocalhostAliases(origins: string[]): string[] {
  const set = new Set(origins);
  for (const o of origins) {
    const m = /^http:\/\/localhost:(\d+)\/?$/.exec(o);
    if (m) set.add(`http://127.0.0.1:${m[1]}`);
    const m2 = /^http:\/\/127\.0\.0\.1:(\d+)\/?$/.exec(o);
    if (m2) set.add(`http://localhost:${m2[1]}`);
  }
  return [...set];
}

function parseCommaList(raw: string | undefined): string[] {
  if (!raw || raw.trim() === "") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseOriginsList(raw: string | undefined): string[] {
  const fallback = expandLocalhostAliases([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
  ]);
  if (!raw || raw.trim() === "") return fallback;
  const listed = raw
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return expandLocalhostAliases(listed);
}

function parseGeminiDailyCaps(raw: string | undefined): Record<string, number> {
  const defaults: Record<string, number> = {
    "gemini-2.5-flash-lite": 200,
    "gemini-2.5-flash": 120,
    "gemini-2.5-pro": 60,
  };
  if (!raw || raw.trim() === "") return defaults;
  const out: Record<string, number> = { ...defaults };
  const entries = raw.split(",").map((x) => x.trim()).filter(Boolean);
  for (const e of entries) {
    const [model, capRaw] = e.split(":").map((x) => x.trim());
    const cap = Number(capRaw);
    if (!model || !Number.isFinite(cap) || cap <= 0) continue;
    out[model] = Math.floor(cap);
  }
  return out;
}
