import { z } from "zod";
import { env } from "../../config/env";
import type { QuantScenarioResult } from "./quantScenarioEngine";
import { openAiChatJson } from "./openaiChat";

const parseFactorsSchema = z.object({
  factors: z.array(
    z.object({
      catalogId: z.string(),
      shockPercent: z.number(),
      rationale: z.string().optional(),
    }),
  ),
  userIntentSummary: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  timeHorizonDays: z.number().int().min(1).max(365).optional(),
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

export type AiScenarioError = {
  ok: false;
  code: "NO_API_KEY" | "PARSE_FAILED" | "GENERATION_FAILED";
  message: string;
};

export type AiScenarioOk<T> = { ok: true; data: T };

/** @deprecated Use AiScenarioError */
export type GeminiScenarioError = AiScenarioError;
/** @deprecated Use AiScenarioOk */
export type GeminiScenarioOk<T> = AiScenarioOk<T>;

type CatalogStub = { id: string; label: string };

function buildOpenAiErrorMessage(err: unknown, stage: "parse" | "narrativa"): string {
  if (err && typeof err === "object") {
    const maybeStatus = "status" in err ? (err as { status?: unknown }).status : undefined;
    const maybeMessage = "message" in err ? (err as { message?: unknown }).message : undefined;
    if (maybeStatus === 429) {
      return "OpenAI indisponível por limite de quota (HTTP 429). Verifique billing/plano e limites da API.";
    }
    if (typeof maybeMessage === "string" && maybeMessage.trim() !== "") {
      return `Falha ao chamar o modelo OpenAI (${stage}): ${maybeMessage}`;
    }
  }
  if (err instanceof Error && err.message.trim() !== "") {
    return `Falha ao chamar o modelo OpenAI (${stage}): ${err.message}`;
  }
  return `Falha ao chamar o modelo OpenAI (${stage}).`;
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
    summary: "Narrativa gerada em modo de teste local (mock), sem chamada à OpenAI.",
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
    riskNotes: ["Defina OPENAI_USE_MOCK=false para usar o modelo real."],
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

/**
 * Extrai fatores do catálogo e magnitudes de choque a partir da mensagem do usuário (OpenAI).
 */
export async function openaiParseFactors(
  userMessage: string,
  catalogSummary: string,
  scenarioContext: string,
): Promise<AiScenarioOk<ParsedFactorsPayload> | AiScenarioError> {
  if (env.openaiUseMock) {
    return { ok: true, data: buildMockFactors(userMessage, catalogSummary) };
  }

  if (!env.openaiApiKey) {
    return {
      ok: false,
      code: "NO_API_KEY",
      message: "Configure OPENAI_API_KEY para usar cenários com IA.",
    };
  }

  const prompt = [
    "És um assistente financeiro. Extrai fatores de risco/cenário a partir da mensagem do utilizador.",
    "Usa APENAS catalogId presentes no catálogo. shockPercent é o movimento percentual hipotético nesse fator (ex.: 10 = +10%, -5 = -5%).",
    "Interpreta perguntas compostas: magnitude (ex.: «cair 20%»), horizonte temporal (ex.: «três meses» → timeHorizonDays: 90), e ativos/setores mencionados.",
    "Para petróleo/óleo/WTI/Brent/energia como fator macro, preferir macro:DCOILWTICO quando existir no catálogo; choque negativo se a pergunta for queda de preço.",
    "Se a carteira no contexto tiver linhas sem ativo catalogado ou valores claramente incompletos, inclui isso no userIntentSummary (uma frase) para a segunda etapa avisar o utilizador.",
    "Opcional no JSON: timeHorizonDays (1–365) quando o utilizador indicar prazo; confidence (0..1) quando houver ambiguidade.",
    "Responde só com JSON no formato:",
    '{"factors":[{"catalogId":"macro:DCOILWTICO","shockPercent":-20,"rationale":"..."}],"userIntentSummary":"...","timeHorizonDays":90}',
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
    const result = await openAiChatJson({ prompt });
    const json = safeJsonParse(result.text);
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
      message: buildOpenAiErrorMessage(err, "parse"),
    };
  }
}

/**
 * Narrativa final alinhada ao resultado quantitativo (OpenAI).
 */
export async function openaiBuildNarrative(args: {
  userMessage: string;
  catalogSummary: string;
  scenarioContext: string;
  validatedFactors: ParsedFactorsPayload["factors"];
  quant: QuantScenarioResult;
}): Promise<AiScenarioOk<NarrativePayload> | AiScenarioError> {
  if (env.openaiUseMock) {
    return { ok: true, data: buildMockNarrative(args) };
  }

  if (!env.openaiApiKey) {
    return {
      ok: false,
      code: "NO_API_KEY",
      message: "Configure OPENAI_API_KEY para usar cenários com IA.",
    };
  }

  const prompt = [
    "Gera uma resposta JSON para um utilizador de uma app de carteira (português de Portugal/Brasil claro e profissional).",
    "Pensa de forma profunda, relacionando macroeconomia, geopolítica, cadeia de suprimentos e comportamento setorial.",
    "A resposta deve ser útil para decisão humana e explicar causalidade (por que o efeito acontece), com tom fundamentado: convincente mas honesto sobre limitações.",
    "Campos obrigatórios:",
    '- "summary": texto sobre o cenário;',
    '- "visualScene": objeto para interação visual da UI { "id","intensity","palette","motion","durationMs","rationale" };',
    '- "analysisBlocks": array com 4-7 blocos { "title","content" } cobrindo: mecanismo causal, curto prazo, médio/longo prazo, riscos e gatilhos;',
    '- "causalChain": array com 3-6 itens { "cause","transmission","effect" } para explicar como o choque global virou impacto financeiro;',
    '- "factorsUsed": lista de catalogId usados na explicação;',
    '- "perAsset": array de { "label", "impactSummary" } alinhado às linhas da carteira quando possível;',
    '- "disclaimer": aviso de que é ilustrativo, não aconselhamento de investimento;',
    '- "riskNotes" (opcional): bullets com lacunas de dados ou limitações.',
    '- "evidence" (obrigatório): lista com 3-8 itens { "title","detail","relatedFactorId"?(catalogId),"relatedAssetLabel"?,"confidence"?(0..1) } explicando por que o cenário foi gerado.',
    "",
    "Regras de qualidade obrigatórias:",
    "- Usa a carteira do utilizador como base central da resposta; evita resposta genérica.",
    "- ALINHAMENTO COM O GRÁFICO / MODELO: o utilizador vê projeções derivadas do JSON quantitativo. No summary ou no primeiro analysisBlock, menciona explicitamente o retorno agregado da carteira (portfolioReturnDecimal como percentagem), o valor de linha de base (baselineValue) e o valor projetado (projectedPortfolioValue) — usa estes números tal como vêm no JSON, sem arredondamentos inventados além do razoável.",
    "- Identifica a posição mais afetada em módulo (maior |combinedReturnDecimal| entre perLine) e explica porquê em linguagem acessível; se várias linhas têm impacto quase nulo por falta de dados, diz-o claramente.",
    "- Se o utilizador pediu um horizonte temporal (ex.: três meses), organiza curto vs médio prazo em função desse horizonte sem criar novos números de retorno.",
    "- Evidências qualitativas: se existirem «Manchetes recentes» no contexto, cita 1–3 títulos relevantes (entre aspas ou paráfrase fiel) como contexto de mercado quando fizer sentido; se nenhuma manchete for pertinente, indica que não há notícia direta no recorte atual.",
    "- Estrutura a explicação em ordem: causas do cenário -> mecanismos de transmissão -> consequências na carteira -> evidências.",
    "- Se a pergunta for extrema/absurda (ex.: fim do mundo), reconhece a limitação do cenário e responde com lucidez humana antes da análise financeira.",
    "- Se previres quedas fortes (ex.: -50%), explicita no mínimo 2 causas e 2 condições de invalidação.",
    "- Não inventes dados numéricos fora do resultado quantitativo; quando faltar dado, diz explicitamente (preços em tempo real, beta insuficiente, linha sem ativo catalogado).",
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
    const result = await openAiChatJson({ prompt });
    const json = safeJsonParse(result.text);
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
      message: buildOpenAiErrorMessage(err, "narrativa"),
    };
  }
}

/** Aliases de compatibilidade com o antigo serviço Gemini. */
export const geminiParseFactors = openaiParseFactors;
export const geminiBuildNarrative = openaiBuildNarrative;
