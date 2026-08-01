/**
 * @deprecated Prefer `openaiScenarioService`. Reexporta a API OpenAI com nomes antigos.
 */
export {
  openaiParseFactors as geminiParseFactors,
  openaiBuildNarrative as geminiBuildNarrative,
  openaiParseFactors,
  openaiBuildNarrative,
  type ParsedFactorsPayload,
  type NarrativePayload,
  type AiScenarioError,
  type AiScenarioOk,
  type GeminiScenarioError,
  type GeminiScenarioOk,
} from "./openaiScenarioService";
