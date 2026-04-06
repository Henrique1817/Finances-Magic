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
  } catch {
    return {
      ok: false,
      code: "GENERATION_FAILED",
      message: "Falha ao chamar o modelo Gemini (parse).",
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
  } catch {
    return {
      ok: false,
      code: "GENERATION_FAILED",
      message: "Falha ao chamar o modelo Gemini (narrativa).",
    };
  }
}
