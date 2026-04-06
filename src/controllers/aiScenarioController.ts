import type { NextFunction, Request, Response } from "express";
import { sendError, sendSuccess } from "../lib/http";
import { asyncHandler } from "../middleware/asyncHandler";
import { buildFactorCatalogSummaryForPrompt, loadFactorCatalog } from "../services/ai/dataFactorCatalog";
import {
  geminiBuildNarrative,
  geminiParseFactors,
  type NarrativePayload,
} from "../services/ai/geminiScenarioService";
import { runQuantScenario } from "../services/ai/quantScenarioEngine";
import {
  buildScenarioContext,
  formatScenarioContextForPrompt,
} from "../services/ai/scenarioContextBuilder";
import {
  createScenarioRecord,
  scenarioTitleFromMessage,
} from "../services/scenarioService";
import { ensureUserWallet } from "../services/walletService";
import type { AiScenarioBody } from "../validation/bodySchemas";

function isQuantFactorId(catalogId: string): boolean {
  return catalogId.startsWith("macro:") || catalogId.startsWith("asset:") || catalogId.startsWith("climate:");
}

export const postAiScenarioHandler = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const body = req.validatedBody as AiScenarioBody;
    const userId = req.user?.id;
    if (!userId) {
      sendError(res, 401, "Sessão inválida.");
      return;
    }

    await ensureUserWallet(userId, req.user?.email);

    const catalog = await loadFactorCatalog();
    const catalogSummary = buildFactorCatalogSummaryForPrompt(catalog);
    const scenarioContext = await buildScenarioContext(userId);
    const contextBlock = formatScenarioContextForPrompt(scenarioContext);

    const parsed = await geminiParseFactors(body.message, catalogSummary, contextBlock);
    if (!parsed.ok) {
      const status =
        parsed.code === "NO_API_KEY" ? 503 : parsed.code === "PARSE_FAILED" ? 422 : 502;
      sendError(res, status, parsed.message);
      return;
    }

    const validatedFactors = parsed.data.factors.filter((f) => catalog.validIds.has(f.catalogId));
    if (validatedFactors.length === 0) {
      sendError(res, 422, "Nenhum fator reconhecido no catálogo. Reformule o cenário ou verifique os dados ingeridos.");
      return;
    }

    const quantInputs = validatedFactors
      .filter((f) => isQuantFactorId(f.catalogId))
      .map((f) => ({ catalogId: f.catalogId, shockPercent: f.shockPercent }));

    const quant = await runQuantScenario(scenarioContext.walletLines, quantInputs);

    const narrative = await geminiBuildNarrative({
      userMessage: body.message,
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
      };
    } else {
      narrativePayload = narrative.data;
    }

    const title = scenarioTitleFromMessage(body.message, parsed.data.userIntentSummary ?? null);
    const resultPayload = {
      narrative: narrativePayload,
      quant,
      parsedFactors: validatedFactors,
      userIntentSummary: parsed.data.userIntentSummary ?? null,
    };

    const { id: scenarioId } = await createScenarioRecord(userId, title, body.message, resultPayload);

    sendSuccess(res, {
      scenarioId,
      title,
      narrative: narrativePayload,
      quant,
      parsedFactors: validatedFactors,
      userIntentSummary: parsed.data.userIntentSummary ?? null,
    });
  },
);
