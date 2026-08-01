import { buildFactorCatalogSummaryForPrompt, loadFactorCatalog } from "./dataFactorCatalog";
import { openaiBuildNarrative, openaiParseFactors, type NarrativePayload } from "./openaiScenarioService";
import { runQuantScenario } from "./quantScenarioEngine";
import { buildScenarioContext, formatScenarioContextForPrompt } from "./scenarioContextBuilder";
import { createScenarioRecord, scenarioTitleFromMessage } from "../scenarioService";
import type { ScenarioContext } from "./scenarioContextBuilder";
import type { FactorCatalog } from "./dataFactorCatalog";

function isQuantFactorId(catalogId: string): boolean {
  return catalogId.startsWith("macro:") || catalogId.startsWith("asset:") || catalogId.startsWith("climate:");
}

function buildEvidenceFromQuant(
  factors: Array<{ catalogId: string; shockPercent: number; rationale?: string }>,
  quant: Awaited<ReturnType<typeof runQuantScenario>>,
): NonNullable<NarrativePayload["evidence"]> {
  const evidence: NonNullable<NarrativePayload["evidence"]> = [];

  for (const f of factors.slice(0, 4)) {
    evidence.push({
      title: `Fator aplicado: ${f.catalogId}`,
      detail: `Choque hipotético de ${f.shockPercent >= 0 ? "+" : ""}${f.shockPercent.toFixed(2)}% no fator selecionado.`,
      relatedFactorId: f.catalogId,
      confidence: 0.65,
    });
    if (f.rationale?.trim()) {
      evidence.push({
        title: `Racional do fator ${f.catalogId}`,
        detail: f.rationale.trim().slice(0, 240),
        relatedFactorId: f.catalogId,
        confidence: 0.55,
      });
    }
  }

  const strongestLines = [...quant.perLine]
    .sort((a, b) => Math.abs(b.combinedReturnDecimal) - Math.abs(a.combinedReturnDecimal))
    .slice(0, 4);
  for (const line of strongestLines) {
    const label = line.assetSymbol ? `${line.nome} (${line.assetSymbol})` : line.nome;
    evidence.push({
      title: `Sensibilidade estimada em ${label}`,
      detail: `Retorno projetado de ${(line.combinedReturnDecimal * 100).toFixed(2)}% com base na exposição histórica da posição.`,
      relatedAssetLabel: label,
      confidence: 0.7,
    });
  }

  for (const gap of quant.dataGaps.slice(0, 2)) {
    evidence.push({
      title: "Limitação de dados identificada",
      detail: gap,
      confidence: 0.35,
    });
  }

  return evidence.slice(0, 8);
}

function normalizeTextFingerprint(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeNarrativeEvidence(
  evidence: NonNullable<NarrativePayload["evidence"]>,
): NonNullable<NarrativePayload["evidence"]> {
  const byKey = new Map<string, NonNullable<NarrativePayload["evidence"]>[number]>();
  for (const ev of evidence) {
    const key = ev.relatedFactorId
      ? `factor:${ev.relatedFactorId}`
      : `text:${normalizeTextFingerprint(`${ev.title} ${ev.detail}`).split(" ").slice(0, 14).join(" ")}`;
    const prev = byKey.get(key);
    if (!prev || (ev.confidence ?? 0) > (prev.confidence ?? 0)) {
      byKey.set(key, ev);
    }
  }
  return [...byKey.values()].slice(0, 8);
}

function buildFallbackCausalChain(args: {
  factors: Array<{ catalogId: string; shockPercent: number; rationale?: string }>;
  quant: Awaited<ReturnType<typeof runQuantScenario>>;
}): NonNullable<NarrativePayload["causalChain"]> {
  const topLines = [...args.quant.perLine]
    .sort((a, b) => Math.abs(b.combinedReturnDecimal) - Math.abs(a.combinedReturnDecimal))
    .slice(0, 3);
  const out: NonNullable<NarrativePayload["causalChain"]> = [];
  for (let i = 0; i < Math.min(args.factors.length, topLines.length); i++) {
    const f = args.factors[i]!;
    const l = topLines[i]!;
    out.push({
      cause: `Choque em ${f.catalogId} (${f.shockPercent >= 0 ? "+" : ""}${f.shockPercent.toFixed(2)}%).`,
      transmission:
        `O fator altera o prêmio de risco/custo de capital e afeta a precificação via beta histórico da linha ${l.assetSymbol ?? l.nome}.`,
      effect:
        `Impacto estimado de ${(l.combinedReturnDecimal * 100).toFixed(2)}% em ${l.assetSymbol ? `${l.nome} (${l.assetSymbol})` : l.nome}.`,
    });
  }
  if (out.length === 0 && args.factors.length > 0) {
    const f = args.factors[0]!;
    out.push({
      cause: `Choque em ${f.catalogId}.`,
      transmission: "O choque é transmitido via condições financeiras, fluxo de caixa e percepção de risco.",
      effect: "A carteira tende a reagir de forma heterogênea, conforme sensibilidade histórica das posições.",
    });
  }
  return out.slice(0, 6);
}

function normalizeSceneText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function inferVisualScene(args: {
  userMessage: string;
  factors: Array<{ catalogId: string; shockPercent: number }>;
  quant: Awaited<ReturnType<typeof runQuantScenario>>;
}): NonNullable<NarrativePayload["visualScene"]> {
  const txt = normalizeSceneText(args.userMessage);
  const shockAbs = Math.abs(args.quant.portfolioReturnDecimal);
  const hasOil = /(petroleo|oil|energia)/i.test(txt);
  const hasNuclear =
    /(nuclear|bomba|apocalipse|fim do mundo|armageddon|guerra nuclear|explosao mundial|explosao global|guerra mundial|terceira guerra)/i.test(
      txt,
    );
  const hasGeo =
    args.factors.some((f) => f.catalogId.includes("GEO_RISK")) ||
    /(geopol|guerra|china|embargo|otan|oriente medio)/i.test(txt);

  if (hasNuclear) {
    return {
      id: "apocalypse",
      intensity: 0.95,
      palette: "danger",
      motion: "collapse",
      durationMs: 3200,
      rationale: "Cenário extremo com choque sistêmico e colapso de confiança.",
    };
  }
  if (hasOil) {
    return {
      id: "oil-collapse",
      intensity: shockAbs > 0.2 ? 0.85 : 0.65,
      palette: "amber",
      motion: "pulse",
      durationMs: 2600,
      rationale: "Cenário energético com disrupção de oferta e pressão inflacionária.",
    };
  }
  if (hasGeo) {
    return {
      id: "geopolitical-shock",
      intensity: shockAbs > 0.15 ? 0.75 : 0.55,
      palette: "cold",
      motion: "shake",
      durationMs: 2100,
      rationale: "Estresse geopolítico com aumento de volatilidade.",
    };
  }
  return {
    id: "default",
    intensity: 0.25,
    palette: "default",
    motion: "calm",
    durationMs: 1400,
    rationale: "Cena neutra para leitura analítica padrão.",
  };
}

function isExtremeScenarioMessage(msg: string): boolean {
  const txt = normalizeSceneText(msg);
  return /(fim do mundo|mundo acabar|apocalipse|extincao|colapso total|armageddon|bomba nuclear|ataque nuclear|nuclear na china|guerra nuclear|explosao mundial|explosao global|guerra mundial|terceira guerra)/i.test(
    txt,
  );
}

function heuristicFactorCandidates(
  message: string,
  catalog: FactorCatalog,
  scenarioContext: ScenarioContext,
): Array<{ catalogId: string; shockPercent: number; rationale: string }> {
  const txt = message.toLowerCase();
  const out: Array<{ catalogId: string; shockPercent: number; rationale: string }> = [];
  const ids = new Set(catalog.factors.map((f) => f.id));

  const push = (catalogId: string, shockPercent: number, rationale: string) => {
    if (!ids.has(catalogId)) return;
    if (out.some((x) => x.catalogId === catalogId)) return;
    out.push({ catalogId, shockPercent, rationale });
  };

  if (/(terra[s]? rara[s]?|rare earth|neod[ií]mio|dispr[oó]sio|minerais cr[ií]ticos)/i.test(txt)) {
    push("macro:VIXCLS", 18, "Escassez de terras raras tende a elevar risco e volatilidade de mercado.");
    push("macro:DCOILWTICO", 12, "Gargalos geopolíticos de oferta costumam pressionar energia e logística.");
    push("macro:CODECHROMA_GEO_RISK_NLP", 20, "Cadeia de suprimentos crítica aumenta risco geopolítico.");
  }
  if (/(guerra|embargo|china|san[cç][aã]o|retalia[cç][aã]o|geopol)/i.test(txt)) {
    push("macro:CODECHROMA_GEO_RISK_NLP", 22, "Choque geopolítico explícito na pergunta.");
    push("macro:VIXCLS", 16, "Risco geopolítico tende a ampliar aversão a risco.");
    push("macro:DCOILWTICO", 10, "Choques geopolíticos relevantes costumam afetar energia e logística.");
  }
  if (/(nuclear|bomba|ataque militar|escalada militar)/i.test(txt)) {
    push("macro:CODECHROMA_GEO_RISK_NLP", 35, "Evento nuclear implica choque geopolítico extremo.");
    push("macro:VIXCLS", 28, "Evento nuclear tende a elevar fortemente aversão a risco.");
    push("macro:DCOILWTICO", 18, "Risco de disrupção global tende a pressionar energia e transporte.");
  }
  if (/(juros|fed|taxa|infl[aã]a?c[aã]o|cpi|dgs10|dgs2)/i.test(txt)) {
    push("macro:DFF", 10, "Cenário aponta mudança de política monetária.");
    push("macro:CPIAUCSL", 6, "Pressão inflacionária altera valuation e custo de capital.");
  }
  if (isExtremeScenarioMessage(message)) {
    push("macro:CODECHROMA_GEO_RISK_NLP", 30, "Cenário extremo implica estresse sistêmico elevado.");
    push("macro:VIXCLS", 25, "Cenário extremo tende a colapso de confiança e liquidez.");
  }

  if (out.length === 0) {
    // fallback orientado à carteira: tenta usar ativos reais do usuário
    for (const line of scenarioContext.walletLines.slice(0, 3)) {
      if (line.assetSymbol && ids.has(`asset:${line.assetSymbol}`)) {
        push(
          `asset:${line.assetSymbol}`,
          -8,
          `Fallback orientado à carteira: sensibilidade direta no ativo ${line.assetSymbol}.`,
        );
      }
    }
  }

  if (out.length === 0) {
    // fallback sistêmico final
    push("macro:VIXCLS", 10, "Fallback sistêmico para captar choque amplo de risco.");
  }

  return out.slice(0, 5);
}

function expandProxyFactorsForQuant(
  factors: Array<{ catalogId: string; shockPercent: number; rationale?: string }>,
): Array<{ catalogId: string; shockPercent: number }> {
  const byId = new Map<string, number>();
  const add = (id: string, shock: number) => {
    if (byId.has(id)) return;
    byId.set(id, shock);
  };

  for (const f of factors) {
    add(f.catalogId, f.shockPercent);
    if (f.catalogId === "macro:CODECHROMA_GEO_RISK_NLP") {
      // Proxy quantitativo: quando GEO_RISK estiver sem histórico suficiente,
      // VIX e WTI ajudam a refletir choque de risco sistêmico.
      add("macro:VIXCLS", Math.max(10, Math.round(Math.abs(f.shockPercent) * 0.7)));
      add("macro:DCOILWTICO", Math.max(6, Math.round(Math.abs(f.shockPercent) * 0.45)));
    }
  }
  return [...byId.entries()].map(([catalogId, shockPercent]) => ({ catalogId, shockPercent }));
}

function buildFallbackAnalysisBlocks(args: {
  userMessage: string;
  quant: Awaited<ReturnType<typeof runQuantScenario>>;
  factors: Array<{ catalogId: string; shockPercent: number; rationale?: string }>;
  scenarioContext: ScenarioContext;
}): NonNullable<NarrativePayload["analysisBlocks"]> {
  const worst = [...args.quant.perLine].sort((a, b) => a.combinedReturnDecimal - b.combinedReturnDecimal)[0];
  const topFactor = args.factors[0];
  const isExtreme = isExtremeScenarioMessage(args.userMessage);
  const walletFocus = args.scenarioContext.walletLines
    .slice(0, 3)
    .map((w) => (w.assetSymbol ? `${w.nome} (${w.assetSymbol})` : w.nome))
    .join(", ");

  const blocks: NonNullable<NarrativePayload["analysisBlocks"]> = [
    {
      title: "Mecanismo causal principal",
      content: topFactor
        ? `O cenário aplica o fator ${topFactor.catalogId} com choque de ${topFactor.shockPercent >= 0 ? "+" : ""}${topFactor.shockPercent.toFixed(2)}%, que se transmite à carteira via betas históricos por posição.`
        : "Sem fator dominante único; a leitura utiliza risco sistêmico agregado e sensibilidade histórica por ativo.",
    },
    {
      title: "Leitura da carteira do usuário",
      content: walletFocus
        ? `A análise foi centrada na sua carteira atual (${walletFocus}). O impacto não é genérico: cada posição recebeu projeção individual antes da agregação total.`
        : "A carteira está vazia ou sem ativos vinculados; a análise prioriza contexto macro e limitações de dados.",
    },
    {
      title: "Curto prazo vs médio prazo",
      content:
        "No curto prazo, o mercado tende a reagir pela incerteza e liquidez; no médio prazo, a trajetória depende de normalização de oferta, política monetária e capacidade de repasse de custos pelas empresas.",
    },
  ];

  if (worst) {
    const label = worst.assetSymbol ? `${worst.nome} (${worst.assetSymbol})` : worst.nome;
    blocks.push({
      title: "Por que pode cair forte",
      content: `A posição mais pressionada no cenário foi ${label}, com retorno projetado de ${(worst.combinedReturnDecimal * 100).toFixed(2)}%. Quedas intensas surgem quando há combinação de choque elevado no fator + beta histórico elevado da posição.`,
    });
  }
  if (isExtreme) {
    blocks.push({
      title: "Limite de plausibilidade do cenário",
      content:
        "Quando a hipótese é extrema (ex.: fim do mundo), a prioridade analítica passa a ser risco de sobrevivência do sistema econômico. Nesse contexto, antes do preço do ativo, a pergunta central é a continuidade das instituições e do próprio mercado.",
    });
  }
  return blocks.slice(0, 7);
}

export type AiScenarioOrchestratorResult =
  | { ok: true; data: { scenarioId: string; title: string; narrative: NarrativePayload; quant: Awaited<ReturnType<typeof runQuantScenario>>; parsedFactors: Array<{ catalogId: string; shockPercent: number; rationale?: string }>; userIntentSummary: string | null } }
  | { ok: false; status: number; message: string };

export async function generateAndPersistAiScenario(args: {
  userId: string;
  message: string;
}): Promise<AiScenarioOrchestratorResult> {
  const catalog = await loadFactorCatalog();
  const catalogSummary = buildFactorCatalogSummaryForPrompt(catalog);
  const scenarioContext = await buildScenarioContext(args.userId);
  const contextBlock = formatScenarioContextForPrompt(scenarioContext);

  const parsed = await openaiParseFactors(args.message, catalogSummary, contextBlock);
  if (!parsed.ok && parsed.code === "NO_API_KEY") {
    return { ok: false, status: 503, message: parsed.message };
  }

  const parsedFactors =
    parsed.ok
      ? parsed.data.factors
      : heuristicFactorCandidates(args.message, catalog, scenarioContext);

  const validatedFactors = parsedFactors.filter((f) => catalog.validIds.has(f.catalogId));
  const enrichedFactors =
    validatedFactors.length > 0
      ? validatedFactors
      : heuristicFactorCandidates(args.message, catalog, scenarioContext);

  if (validatedFactors.length === 0) {
    if (enrichedFactors.length === 0) {
      return {
        ok: false,
        status: 422,
        message: "Nenhum fator reconhecido no catálogo. Reformule o cenário ou verifique os dados ingeridos.",
      };
    }
  }

  const effectiveFactors = enrichedFactors.length > 0 ? enrichedFactors : validatedFactors;

  const quantInputs = expandProxyFactorsForQuant(effectiveFactors).filter((f) =>
    isQuantFactorId(f.catalogId),
  );

  const quant = await runQuantScenario(scenarioContext.walletLines, quantInputs);
  const narrative = await openaiBuildNarrative({
    userMessage: args.message,
    catalogSummary,
    scenarioContext: contextBlock,
    validatedFactors: effectiveFactors,
    quant,
  });

  let narrativePayload: NarrativePayload;
  if (!narrative.ok) {
    const extremeLead = isExtremeScenarioMessage(args.message)
      ? "Trata-se de um cenário extremo de baixa plausibilidade operacional, então a leitura deve ser interpretada como stress test de cauda."
      : "";
    narrativePayload = {
      summary:
        `${extremeLead} O modelo estruturado de narrativa não respondeu no formato esperado, mas a projeção quantitativa foi concluída com retorno estimado de ${quant.portfolioReturnDecimal >= 0 ? "+" : ""}${(quant.portfolioReturnDecimal * 100).toFixed(2)}% para a carteira.`.trim(),
      visualScene: inferVisualScene({
        userMessage: args.message,
        factors: effectiveFactors,
        quant,
      }),
      analysisBlocks: buildFallbackAnalysisBlocks({
        userMessage: args.message,
        quant,
        factors: effectiveFactors,
        scenarioContext,
      }),
      factorsUsed: effectiveFactors.map((f) => f.catalogId),
      perAsset: quant.perLine.map((row) => ({
        label: row.assetSymbol ? `${row.nome} (${row.assetSymbol})` : row.nome,
        impactSummary:
          Math.abs(row.combinedReturnDecimal) < 1e-6
            ? "Sem variação relevante estimável com os dados atuais (sensibilidade insuficiente ou baixa sobreposição histórica)."
            : `Retorno composto estimado: ${(row.combinedReturnDecimal * 100).toFixed(2)}% (teto ±50% por linha).`,
      })),
      disclaimer:
        "Ilustração baseada em dados históricos limitados. Não constitui recomendação de investimento ou consultoria financeira.",
      riskNotes: [...(!parsed.ok ? [parsed.message] : []), ...(narrative.code === "PARSE_FAILED" ? [narrative.message] : []), ...quant.dataGaps],
      evidence: dedupeNarrativeEvidence(buildEvidenceFromQuant(effectiveFactors, quant)),
      causalChain: buildFallbackCausalChain({ factors: effectiveFactors, quant }),
    };
  } else {
    const fallbackEvidence = buildEvidenceFromQuant(effectiveFactors, quant);
    const inferredScene = inferVisualScene({
      userMessage: args.message,
      factors: effectiveFactors,
      quant,
    });
    const modelScene = narrative.data.visualScene;
    const shouldOverrideDefaultScene =
      (!modelScene || modelScene.id === "default") && inferredScene.id !== "default";
    narrativePayload = {
      ...narrative.data,
      visualScene: shouldOverrideDefaultScene ? inferredScene : (modelScene ?? inferredScene),
      analysisBlocks:
        narrative.data.analysisBlocks && narrative.data.analysisBlocks.length > 0
          ? narrative.data.analysisBlocks
          : buildFallbackAnalysisBlocks({
              userMessage: args.message,
              quant,
              factors: effectiveFactors,
              scenarioContext,
            }),
      evidence:
        narrative.data.evidence && narrative.data.evidence.length > 0
          ? dedupeNarrativeEvidence(narrative.data.evidence)
          : dedupeNarrativeEvidence(fallbackEvidence),
      causalChain:
        narrative.data.causalChain && narrative.data.causalChain.length > 0
          ? narrative.data.causalChain
          : buildFallbackCausalChain({ factors: effectiveFactors, quant }),
    };
  }

  const title = scenarioTitleFromMessage(args.message, parsed.ok ? parsed.data.userIntentSummary ?? null : null);
  const resultPayload = {
    narrative: narrativePayload,
    quant,
    parsedFactors: effectiveFactors,
    userIntentSummary: parsed.ok ? parsed.data.userIntentSummary ?? null : "Resumo inferido por fallback heurístico",
  };
  const { id: scenarioId } = await createScenarioRecord(args.userId, title, args.message, resultPayload);

  return {
    ok: true,
    data: {
      scenarioId,
      title,
      narrative: narrativePayload,
      quant,
      parsedFactors: effectiveFactors,
      userIntentSummary: parsed.ok ? parsed.data.userIntentSummary ?? null : "Resumo inferido por fallback heurístico",
    },
  };
}
