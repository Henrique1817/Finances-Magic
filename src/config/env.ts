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
  /**
   * Neon Auth (Managed Better Auth).
   * Ex.: https://ep-xxx.neonauth.region.aws.neon.tech/neondb/auth
   */
  neonAuthUrl: required("NEON_AUTH_URL").replace(/\/$/, ""),
  neonAuthJwksUrl:
    optional("NEON_AUTH_JWKS_URL")?.replace(/\/$/, "") ||
    `${required("NEON_AUTH_URL").replace(/\/$/, "")}/.well-known/jwks.json`,
  /** Issuer do JWT = origin do NEON_AUTH_URL (sem path). */
  neonAuthIssuer: (() => {
    const base = required("NEON_AUTH_URL").replace(/\/$/, "");
    return new URL(base).origin;
  })(),
  /**
   * Origin enviada nos pedidos server→Neon Auth (CSRF / trusted_origins).
   * Use a origem do front (ex. http://localhost:3000 ou https://app.vercel.app).
   * Se houver lista separada por vírgulas, usa a primeira.
   */
  neonAuthTrustedOrigin: (
    parseCommaList(optional("NEON_AUTH_TRUSTED_ORIGIN"))[0] ||
    parseOriginsList(process.env.FRONTEND_ORIGINS)[0] ||
    "http://localhost:3000"
  ).replace(/\/$/, ""),
  alphaVantageApiKey: optional("ALPHA_VANTAGE_API_KEY"),
  brapiToken: optional("BRAPI_TOKEN"),
  yfinancePythonExecutable: process.env.YFINANCE_PYTHON_EXECUTABLE?.trim() || "python",
  fredApiKey: optional("FRED_API_KEY"),
  newsApiKey: optional("NEWS_API_KEY"),
  /**
   * OpenAI — cenários IA + Whisper (opcional).
   * Sem chave: POST /api/v1/ai/scenario responde 503; front usa só speech nativo.
   */
  openaiApiKey: optional("OPENAI_API_KEY"),
  openaiWhisperModel: process.env.OPENAI_WHISPER_MODEL?.trim() || "whisper-1",
  /**
   * Modelo de chat para cenários / descoberta de ativos.
   * Padrão gpt-4o-mini: barato e suficiente para JSON estruturado + raciocínio financeiro.
   */
  openaiModel: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
  openaiModelFallbacks: parseCommaList(process.env.OPENAI_MODEL_FALLBACKS),
  /**
   * Cap diário por modelo OpenAI (controle de custo).
   * Formato: "gpt-4o-mini:200,gpt-4.1-mini:80"
   */
  openaiModelDailyCaps: parseOpenAiDailyCaps(process.env.OPENAI_MODEL_DAILY_CAPS),
  /** Modo teste: evita chamadas à OpenAI e gera resposta simulada localmente. */
  openaiUseMock: process.env.OPENAI_USE_MOCK === "true" || process.env.GEMINI_USE_MOCK === "true",
  /** Geração automática de cenários para ampliar dataset supervisionado (consome cota OpenAI). */
  aiAutoTrainingEnabled: process.env.AI_AUTO_TRAINING_ENABLED === "true",
  /** Limite diário de cenários automáticos (proteção extra de custo/cota). */
  aiAutoTrainingMaxScenariosPerDay: parsePositiveInt(process.env.AI_AUTO_TRAINING_MAX_SCENARIOS_PER_DAY, 12),
  /** Quantos usuários no máximo processar por execução do worker automático. */
  aiAutoTrainingMaxUsersPerRun: parsePositiveInt(process.env.AI_AUTO_TRAINING_MAX_USERS_PER_RUN, 12),
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
   * Agente diário de descoberta de parâmetros: propõe novos ativos a partir de manchetes.
   * Usa deduplicação por símbolo e respeita limite por execução.
   */
  dailyParamAgentEnabled: process.env.DAILY_PARAM_AGENT_ENABLED !== "false",
  /** Se true, usa OpenAI para sugerir novos ativos a partir de notícias. */
  dailyParamAgentUseOpenAi:
    process.env.DAILY_PARAM_AGENT_USE_OPENAI !== "false" &&
    process.env.DAILY_PARAM_AGENT_USE_GEMINI !== "false",
  dailyParamAgentMaxNewAssetsPerRun: parsePositiveInt(
    process.env.DAILY_PARAM_AGENT_MAX_NEW_ASSETS_PER_RUN,
    12,
  ),
  dailyParamAgentNewsLookback: parsePositiveInt(process.env.DAILY_PARAM_AGENT_NEWS_LOOKBACK, 200),
  /** Máximo de chamadas OpenAI por dia para descoberta automática de parâmetros. */
  dailyParamAgentOpenAiDailyCap: parsePositiveInt(
    process.env.DAILY_PARAM_AGENT_OPENAI_DAILY_CAP ?? process.env.DAILY_PARAM_AGENT_GEMINI_DAILY_CAP,
    3,
  ),
  /** Modelo OpenAI dedicado ao agente diário (opcional). */
  dailyParamAgentOpenAiModel:
    process.env.DAILY_PARAM_AGENT_OPENAI_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-4o-mini",
  /**
   * Cotações intradiárias (Yahoo 30m) só para ativos ligados a carteiras (`wallet_assets.asset_id`).
   * "false" desliga o cron dedicado (ingestão diária global continua igual).
   */
  userAssetPriceIngestEnabled: process.env.USER_ASSET_PRICE_INGEST_ENABLED !== "false",
  /** Intervalo mínimo entre atualizações por ativo (ms). Padrão 30 min. */
  userAssetPriceMinIntervalMs: parsePositiveInt(process.env.USER_ASSET_PRICE_MIN_INTERVAL_MS, 1_800_000),
  /** Máx. de ativos a atualizar por execução do worker (evita rajadas na API). */
  userAssetPriceMaxPerRun: parsePositiveInt(process.env.USER_ASSET_PRICE_MAX_PER_RUN, 40),
  /** Pausa entre pedidos ao Yahoo neste worker (ms). */
  userAssetPriceRequestGapMs: parsePositiveInt(process.env.USER_ASSET_PRICE_REQUEST_GAP_MS, 550),
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
   * URL pública da API (https://… sem barra final), usada em docs / redirects.
   * Se vazio, usa `X-Forwarded-*` / `Host` do pedido (Render/proxy com trust proxy).
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

function parseOpenAiDailyCaps(raw: string | undefined): Record<string, number> {
  const defaults: Record<string, number> = {
    "gpt-4o-mini": 200,
    "gpt-4.1-mini": 80,
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

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}
