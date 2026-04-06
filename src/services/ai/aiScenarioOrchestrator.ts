import { buildFactorCatalogSummaryForPrompt, loadFactorCatalog } from "./dataFactorCatalog";
import { geminiBuildNarrative, geminiParseFactors, type NarrativePayload } from "./geminiScenarioService";
import { runQuantScenario } from "./quantScenarioEngine";
import { buildScenarioContext, formatScenarioContextForPrompt } from "./scenarioContextBuilder";
import { createScenarioRecord, scenarioTitleFromMessage } from "../scenarioService";

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

  const parsed = await geminiParseFactors(args.message, catalogSummary, contextBlock);
  if (!parsed.ok) {
    const status = parsed.code === "NO_API_KEY" ? 503 : parsed.code === "PARSE_FAILED" ? 422 : 502;
    return { ok: false, status, message: parsed.message };
  }

  const validatedFactors = parsed.data.factors.filter((f) => catalog.validIds.has(f.catalogId));
  if (validatedFactors.length === 0) {
    return {
      ok: false,
      status: 422,
      message: "Nenhum fator reconhecido no catálogo. Reformule o cenário ou verifique os dados ingeridos.",
    };
  }

  const quantInputs = validatedFactors
    .filter((f) => isQuantFactorId(f.catalogId))
    .map((f) => ({ catalogId: f.catalogId, shockPercent: f.shockPercent }));

  const quant = await runQuantScenario(scenarioContext.walletLines, quantInputs);
  const narrative = await geminiBuildNarrative({
    userMessage: args.message,
    catalogSummary,
    scenarioContext: contextBlock,
    validatedFactors,
    quant,
  });

  let narrativePayload: NarrativePayload;
  if (!narrative.ok) {
    narrativePayload = {
      summary:
        "A projeção quantitativa foi calculada, mas a narrativa automática falhou. Veja os números e as lacunas de dados abaixo.",
      factorsUsed: validatedFactors.map((f) => f.catalogId),
      perAsset: quant.perLine.map((row) => ({
        label: row.assetSymbol ? `${row.nome} (${row.assetSymbol})` : row.nome,
        impactSummary: `Retorno composto estimado: ${(row.combinedReturnDecimal * 100).toFixed(2)}% (teto ±50% por linha).`,
      })),
      disclaimer:
        "Ilustração baseada em dados históricos limitados. Não constitui recomendação de investimento ou consultoria financeira.",
      riskNotes: [...(narrative.code === "PARSE_FAILED" ? [narrative.message] : []), ...quant.dataGaps],
      evidence: buildEvidenceFromQuant(validatedFactors, quant),
    };
  } else {
    const fallbackEvidence = buildEvidenceFromQuant(validatedFactors, quant);
    narrativePayload = {
      ...narrative.data,
      evidence:
        narrative.data.evidence && narrative.data.evidence.length > 0
          ? narrative.data.evidence
          : fallbackEvidence,
    };
  }

  const title = scenarioTitleFromMessage(args.message, parsed.data.userIntentSummary ?? null);
  const resultPayload = {
    narrative: narrativePayload,
    quant,
    parsedFactors: validatedFactors,
    userIntentSummary: parsed.data.userIntentSummary ?? null,
  };
  const { id: scenarioId } = await createScenarioRecord(args.userId, title, args.message, resultPayload);

  return {
    ok: true,
    data: {
      scenarioId,
      title,
      narrative: narrativePayload,
      quant,
      parsedFactors: validatedFactors,
      userIntentSummary: parsed.data.userIntentSummary ?? null,
    },
  };
}
