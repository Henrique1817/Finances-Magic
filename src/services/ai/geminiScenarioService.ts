import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import type { QuantScenarioResult } from "./quantScenarioEngine";

const parseFactorsSchema = z.object({
  factors: z.array(
    z.object({
      catalogId: z.string(),
      shockPercent: z.number(),
      rationale: z.string().optional(),
    }),
  ),
  userIntentSummary: z.string().optional(),
});

export type ParsedFactorsPayload = z.infer<typeof parseFactorsSchema>;

const narrativeSchema = z.object({
  summary: z.string(),
  visualScene: z
    .object({
      id: z.enum(["default", "apocalypse", "oil-collapse", "geopolitical-shock"]).optional(),
      intensity: z.number().min(0).max(1).optional(),
      palette: z.enum(["default", "danger", "amber", "cold"]).optional(),
      motion: z.enum(["calm", "pulse", "shake", "collapse"]).optional(),
      durationMs: z.number().int().min(300).max(15000).optional(),
      rationale: z.string().optional(),
    })
    .optional(),
  analysisBlocks: z
    .array(
      z.object({
        title: z.string(),
        content: z.string(),
      }),
    )
    .optional(),
  causalChain: z
    .array(
      z.object({
        cause: z.string(),
        transmission: z.string(),
        effect: z.string(),
      }),
    )
    .optional(),
  factorsUsed: z.array(z.string()),
  perAsset: z.array(
    z.object({
      label: z.string(),
      impactSummary: z.string(),
    }),
  ),
  disclaimer: z.string(),
  riskNotes: z.array(z.string()).optional(),
  evidence: z
    .array(
      z.object({
        title: z.string(),
        detail: z.string(),
        relatedFactorId: z.string().optional(),
        relatedAssetLabel: z.string().optional(),
        confidence: z.number().min(0).max(1).optional(),
      }),
    )
    .optional(),
});

export type NarrativePayload = z.infer<typeof narrativeSchema>;

export type GeminiScenarioError = {
  ok: false;
  code: "NO_API_KEY" | "PARSE_FAILED" | "GENERATION_FAILED";
  message: string;
};

export type GeminiScenarioOk<T> = { ok: true; data: T };

type CatalogStub = { id: string; label: string };
type ModelAttemptError = { model: string; err: unknown };

function buildGeminiErrorMessage(err: unknown, stage: "parse" | "narrativa"): string {
  if (err && typeof err === "object") {
    const maybeStatus = "status" in err ? (err as { status?: unknown }).status : undefined;
    const maybeMessage = "message" in err ? (err as { message?: unknown }).message : undefined;
    if (maybeStatus === 429) {
      return "Gemini indisponível por limite de quota (HTTP 429). Verifique billing/plano e limites da API.";
    }
    if (typeof maybeMessage === "string" && maybeMessage.trim() !== "") {
      return `Falha ao chamar o modelo Gemini (${stage}): ${maybeMessage}`;
    }
  }
  return `Falha ao chamar o modelo Gemini (${stage}).`;
}

function parseCatalogSummaryItems(catalogSummary: string): CatalogStub[] {
  const rows = catalogSummary.split("\n");
  const out: CatalogStub[] = [];
  for (const r of rows) {
    const m = /^\s*•\s+([a-z]+:[^ ]+)\s+—\s+(.+)\s*$/.exec(r);
    if (!m?.[1] || !m?.[2]) continue;
    out.push({ id: m[1].trim(), label: m[2].trim() });
  }
  return out;
}

function buildMockFactors(userMessage: string, catalogSummary: string): ParsedFactorsPayload {
  const items = parseCatalogSummaryItems(catalogSummary);
  const tokens = userMessage
    .toLowerCase()
    .replace(/[^\p{L}\p{N}:+\- ]/gu, " ")
    .split(/\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 2);

  const isNegative = /(queda|crise|recess|baixa|piora|stress|risco|guerra)/i.test(userMessage);
  const shock = isNegative ? -10 : 10;

  const scored = items
    .map((it) => {
      const hay = `${it.id} ${it.label}`.toLowerCase();
      const score = tokens.reduce((acc, t) => (hay.includes(t) ? acc + 1 : acc), 0);
      return { ...it, score };
    })
    .sort((a, b) => b.score - a.score);

  const picked = scored.filter((x) => x.score > 0).slice(0, 3);
  const fallback = picked.length > 0 ? picked : scored.slice(0, 2);

  return {
    factors: fallback.map((f) => ({
      catalogId: f.id,
      shockPercent: shock,
      rationale: "Modo mock ativo para testes (sem custo).",
    })),
    userIntentSummary: `Mock local: ${userMessage.slice(0, 120)}`,
  };
}

function buildMockNarrative(args: {
  validatedFactors: ParsedFactorsPayload["factors"];
  quant: QuantScenarioResult;
}): NarrativePayload {
  return {
    summary: "Narrativa gerada em modo de teste local (mock), sem chamada ao Gemini.",
    visualScene: {
      id: "default",
      intensity: 0.2,
      palette: "default",
      motion: "calm",
      durationMs: 1400,
      rationale: "Modo mock sem cena extrema.",
    },
    analysisBlocks: [
      {
        title: "Leitura estratégica",
        content:
          "Em modo mock, os fatores são selecionados por correspondência textual simples e devem ser tratados como rascunho analítico.",
      },
      {
        title: "Impacto provável na carteira",
        content:
          "As variações por ativo foram calculadas por sensibilidade histórica (beta) e agregadas no retorno projetado de carteira.",
      },
    ],
    causalChain: args.validatedFactors.slice(0, 3).map((f) => ({
      cause: `Choque aplicado em ${f.catalogId}.`,
      transmission: "O choque é transmitido via betas históricos e correlações de mercado.",
      effect: "A carteira reage conforme a sensibilidade de cada linha ao fator.",
    })),
    factorsUsed: args.validatedFactors.map((f) => f.catalogId),
    perAsset: args.quant.perLine.map((row) => ({
      label: row.assetSymbol ? `${row.nome} (${row.assetSymbol})` : row.nome,
      impactSummary: `Retorno composto estimado: ${(row.combinedReturnDecimal * 100).toFixed(2)}%.`,
    })),
    disclaimer:
      "Resultado de validação técnica em modo mock. Não constitui aconselhamento financeiro.",
    riskNotes: ["Defina GEMINI_USE_MOCK=false para usar o modelo real."],
    evidence: args.quant.perLine.slice(0, 4).map((row) => ({
      title: `Impacto quantitativo em ${row.assetSymbol ?? row.nome}`,
      detail: `Retorno composto estimado: ${(row.combinedReturnDecimal * 100).toFixed(2)}% com base em beta histórico.`,
      relatedAssetLabel: row.assetSymbol ? `${row.nome} (${row.assetSymbol})` : row.nome,
      confidence: 0.6,
    })),
  };
}

function safeJsonParse(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    }
    throw new Error("Resposta não é JSON válido.");
  }
}

function getModel(modelName: string) {
  const key = env.geminiApiKey;
  if (!key) return null;
  const gen = new GoogleGenerativeAI(key);
  return gen.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
    },
  });
}

function isDeprecatedModelName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return n === "gemini-2.0-flash" || n === "gemini-2.0-flash-lite";
}

function getGeminiModelCandidates(): string[] {
  const candidates = [
    env.geminiModel,
    ...env.geminiModelFallbacks,
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
  ]
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => !isDeprecatedModelName(x));
  return [...new Set(candidates)];
}

function shouldTryNextModel(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const status = "status" in err ? (err as { status?: unknown }).status : undefined;
  const message = "message" in err ? String((err as { message?: unknown }).message ?? "") : "";
  if (status === 429 || status === 404 || status === 403) return true;
  return /quota|rate|not found|unsupported|permission|resource has been exhausted/i.test(message);
}

function utcDayStartDate(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function dailyCapForModel(modelName: string): number {
  return env.geminiModelDailyCaps[modelName] ?? 60;
}

async function reserveGeminiModelRequest(modelName: string): Promise<boolean> {
  const providerKey = `gemini:${modelName}`;
  const dayStart = utcDayStartDate();
  const cap = dailyCapForModel(modelName);

  type CountRow = { requests: number };
  const rows = await prisma.$queryRaw<CountRow[]>`
    SELECT "requests"
    FROM "api_quota_counters"
    WHERE "provider" = ${providerKey}
      AND "window" = 'day'
      AND "windowStart" = ${dayStart}
    LIMIT 1
  `;
  const used = rows[0]?.requests ?? 0;
  if (used >= cap) return false;

  await prisma.$executeRaw`
    INSERT INTO "api_quota_counters" ("id","provider","window","windowStart","requests","updatedAt","createdAt")
    VALUES (gen_random_uuid()::text, ${providerKey}, 'day', ${dayStart}, 1, NOW(), NOW())
    ON CONFLICT ("provider","window","windowStart")
    DO UPDATE SET "requests" = "api_quota_counters"."requests" + 1, "updatedAt" = NOW()
  `;
  return true;
}

async function generateContentWithFallback(prompt: string): Promise<{ text: string }> {
  const models = getGeminiModelCandidates();
  if (!env.geminiApiKey) {
    throw new Error("GEMINI_API_KEY ausente.");
  }
  if (models.length === 0) {
    throw new Error("Nenhum modelo Gemini válido configurado.");
  }

  const errors: ModelAttemptError[] = [];
  for (const modelName of models) {
    const model = getModel(modelName);
    if (!model) continue;
    const reserved = await reserveGeminiModelRequest(modelName);
    if (!reserved) {
      errors.push({
        model: modelName,
        err: new Error(`Cap diário atingido para ${modelName} (cap=${dailyCapForModel(modelName)}).`),
      });
      continue;
    }
    try {
      const result = await model.generateContent(prompt);
      return { text: result.response.text() };
    } catch (err) {
      errors.push({ model: modelName, err });
      if (!shouldTryNextModel(err)) break;
    }
  }

  const last = errors[errors.length - 1];
  if (!last) {
    throw new Error("Falha ao inicializar modelos Gemini.");
  }
  const attempted = errors.map((e) => e.model).join(", ");
  const baseMsg = last.err instanceof Error ? last.err.message : String(last.err);
  throw new Error(`Modelos testados (${attempted}) falharam. Último erro: ${baseMsg}`);
}

/**
 * Primeira chamada Gemini: extrai fatores do catálogo e magnitudes de choque a partir da mensagem do usuário.
 */
export async function geminiParseFactors(
  userMessage: string,
  catalogSummary: string,
  scenarioContext: string,
): Promise<GeminiScenarioOk<ParsedFactorsPayload> | GeminiScenarioError> {
  if (env.geminiUseMock) {
    return { ok: true, data: buildMockFactors(userMessage, catalogSummary) };
  }

  if (!env.geminiApiKey) {
    return {
      ok: false,
      code: "NO_API_KEY",
      message: "Configure GEMINI_API_KEY para usar cenários com IA.",
    };
  }

  const prompt = [
    "És um assistente financeiro. Extrai fatores de risco/cenário a partir da mensagem do utilizador.",
    "Usa APENAS catalogId presentes no catálogo. shockPercent é o movimento percentual hipotético nesse fator (ex.: 10 = +10%, -5 = -5%).",
    "Responde só com JSON no formato:",
    '{"factors":[{"catalogId":"macro:DCOILWTICO","shockPercent":10,"rationale":"..."}],"userIntentSummary":"..."}',
    "",
    "CATÁLOGO:",
    catalogSummary,
    "",
    "CONTEXTO DO UTILIZADOR (carteira + macro + notícias):",
    scenarioContext,
    "",
    "MENSAGEM:",
    userMessage,
  ].join("\n");

  try {
    const result = await generateContentWithFallback(prompt);
    const raw = result.text;
    const json = safeJsonParse(raw);
    const parsed = parseFactorsSchema.safeParse(json);
    if (!parsed.success) {
      return {
        ok: false,
        code: "PARSE_FAILED",
        message: "Não foi possível interpretar a mensagem como cenário estruturado.",
      };
    }
    return { ok: true, data: parsed.data };
  } catch (err) {
    return {
      ok: false,
      code: "GENERATION_FAILED",
      message: buildGeminiErrorMessage(err, "parse"),
    };
  }
}

/**
 * Segunda chamada Gemini: narrativa final alinhada ao resultado quantitativo.
 */
export async function geminiBuildNarrative(args: {
  userMessage: string;
  catalogSummary: string;
  scenarioContext: string;
  validatedFactors: ParsedFactorsPayload["factors"];
  quant: QuantScenarioResult;
}): Promise<GeminiScenarioOk<NarrativePayload> | GeminiScenarioError> {
  if (env.geminiUseMock) {
    return { ok: true, data: buildMockNarrative(args) };
  }

  if (!env.geminiApiKey) {
    return {
      ok: false,
      code: "NO_API_KEY",
      message: "Configure GEMINI_API_KEY para usar cenários com IA.",
    };
  }

  const prompt = [
    "Gera uma resposta JSON para um utilizador de uma app de carteira (português de Portugal/Brasil claro e profissional).",
    "Pensa de forma profunda, relacionando macroeconomia, geopolítica, cadeia de suprimentos e comportamento setorial.",
    "A resposta deve ser útil para decisão humana e explicar causalidade (por que o efeito acontece).",
    "Campos obrigatórios:",
    '- "summary": texto curto do cenário;',
    '- "visualScene": objeto para interação visual da UI { "id","intensity","palette","motion","durationMs","rationale" };',
    '- "analysisBlocks": array com 4-7 blocos { "title","content" } cobrindo: mecanismo causal, curto prazo, médio/longo prazo, riscos e gatilhos;',
    '- "causalChain": array com 3-6 itens { "cause","transmission","effect" } para explicar como o choque vira impacto financeiro;',
    '- "factorsUsed": lista de catalogId usados na explicação;',
    '- "perAsset": array de { "label", "impactSummary" } alinhado às linhas da carteira quando possível;',
    '- "disclaimer": aviso de que é ilustrativo, não aconselhamento de investimento;',
    '- "riskNotes" (opcional): bullets com lacunas de dados ou limitações.',
    '- "evidence" (obrigatório): lista com 3-8 itens { "title","detail","relatedFactorId"?(catalogId),"relatedAssetLabel"?,"confidence"?(0..1) } explicando por que o cenário foi gerado.',
    "",
    "Regras de qualidade obrigatórias:",
    "- Usa a carteira do utilizador como base central da resposta; evita resposta genérica.",
    "- Estrutura a explicação em ordem: causas do cenário -> mecanismos de transmissão -> consequências na carteira.",
    "- Se a pergunta for extrema/absurda (ex.: fim do mundo), reconhece a limitação do cenário e responde com lucidez humana antes da análise financeira.",
    "- Se previres quedas fortes (ex.: -50%), explicita no mínimo 2 causas e 1 condição de invalidação.",
    "- Não inventes dados numéricos fora do resultado quantitativo; quando faltar dado, diz explicitamente.",
    "- Evita repetição: não repitas a mesma ideia com frases diferentes; cada bloco deve adicionar informação nova.",
    "- Evita repetir vários fatores equivalentes sem distinção causal clara.",
    "- Para cenários extremos, define visualScene forte (ex.: apocalypse/collapse). Para cenários normais, usa visualScene default/calm.",
    "",
    "Baseia-te no resultado quantitativo (JSON) e não contradigas os sinais (+/-) das projeções por linha.",
    "",
    "CATÁLOGO (referência):",
    args.catalogSummary,
    "",
    "CONTEXTO:",
    args.scenarioContext,
    "",
    "MENSAGEM ORIGINAL:",
    args.userMessage,
    "",
    "FATORES VALIDADOS:",
    JSON.stringify(args.validatedFactors),
    "",
    "RESULTADO QUANTITATIVO:",
    JSON.stringify(args.quant),
  ].join("\n");

  try {
    const result = await generateContentWithFallback(prompt);
    const raw = result.text;
    const json = safeJsonParse(raw);
    const parsed = narrativeSchema.safeParse(json);
    if (!parsed.success) {
      return {
        ok: false,
        code: "PARSE_FAILED",
        message: "Não foi possível gerar a narrativa estruturada do cenário.",
      };
    }
    return { ok: true, data: parsed.data };
  } catch (err) {
    return {
      ok: false,
      code: "GENERATION_FAILED",
      message: buildGeminiErrorMessage(err, "narrativa"),
    };
  }
}
