import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { env } from "../../config/env";
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
  factorsUsed: z.array(z.string()),
  perAsset: z.array(
    z.object({
      label: z.string(),
      impactSummary: z.string(),
    }),
  ),
  disclaimer: z.string(),
  riskNotes: z.array(z.string()).optional(),
});

export type NarrativePayload = z.infer<typeof narrativeSchema>;

export type GeminiScenarioError = {
  ok: false;
  code: "NO_API_KEY" | "PARSE_FAILED" | "GENERATION_FAILED";
  message: string;
};

export type GeminiScenarioOk<T> = { ok: true; data: T };

type CatalogStub = { id: string; label: string };

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
    factorsUsed: args.validatedFactors.map((f) => f.catalogId),
    perAsset: args.quant.perLine.map((row) => ({
      label: row.assetSymbol ? `${row.nome} (${row.assetSymbol})` : row.nome,
      impactSummary: `Retorno composto estimado: ${(row.combinedReturnDecimal * 100).toFixed(2)}%.`,
    })),
    disclaimer:
      "Resultado de validação técnica em modo mock. Não constitui aconselhamento financeiro.",
    riskNotes: ["Defina GEMINI_USE_MOCK=false para usar o modelo real."],
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

function getModel() {
  const key = env.geminiApiKey;
  if (!key) return null;
  const gen = new GoogleGenerativeAI(key);
  return gen.getGenerativeModel({
    model: env.geminiModel,
    generationConfig: {
      responseMimeType: "application/json",
    },
  });
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

  const model = getModel();
  if (!model) {
    return { ok: false, code: "NO_API_KEY", message: "Configure GEMINI_API_KEY para usar cenários com IA." };
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
    const result = await model.generateContent(prompt);
    const raw = result.response.text();
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

  const model = getModel();
  if (!model) {
    return { ok: false, code: "NO_API_KEY", message: "Configure GEMINI_API_KEY para usar cenários com IA." };
  }

  const prompt = [
    "Gera uma resposta JSON para um utilizador de uma app de carteira (português de Portugal/Brasil claro e profissional).",
    "Campos obrigatórios:",
    '- "summary": texto curto do cenário;',
    '- "factorsUsed": lista de catalogId usados na explicação;',
    '- "perAsset": array de { "label", "impactSummary" } alinhado às linhas da carteira quando possível;',
    '- "disclaimer": aviso de que é ilustrativo, não aconselhamento de investimento;',
    '- "riskNotes" (opcional): bullets com lacunas de dados ou limitações.',
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
    const result = await model.generateContent(prompt);
    const raw = result.response.text();
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
