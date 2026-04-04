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
  logLevel: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  databaseUrl: required("DATABASE_URL"),
  /** Supabase — validação de JWT no backend (`auth.getUser`) */
  supabaseUrl: required("SUPABASE_URL"),
  supabaseAnonKey: required("SUPABASE_ANON_KEY"),
  alphaVantageApiKey: optional("ALPHA_VANTAGE_API_KEY"),
  fredApiKey: optional("FRED_API_KEY"),
  newsApiKey: optional("NEWS_API_KEY"),
  /** Força fechamentos Alpha Vantage simulados (sem rede). */
  alphaVantageUseMock: process.env.ALPHA_VANTAGE_USE_MOCK === "true",
  /** IANA, ex.: America/Sao_Paulo */
  cronTimezone: process.env.CRON_TZ ?? "America/Sao_Paulo",
  /** "false" desliga o agendamento (útil em testes). */
  ingestionCronEnabled: process.env.INGESTION_CRON_ENABLED !== "false",
  /**
   * Origens CORS permitidas (separadas por vírgula).
   * Padrão: Vite e front comuns em localhost.
   */
  frontendOrigins: parseOriginsList(process.env.FRONTEND_ORIGINS),
};

function parseOriginsList(raw: string | undefined): string[] {
  const fallback = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
  ];
  if (!raw || raw.trim() === "") return fallback;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
