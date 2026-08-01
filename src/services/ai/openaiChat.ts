import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";

type ModelAttemptError = { model: string; err: unknown };

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string; type?: string; code?: string };
};

function utcDayStartDate(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function dailyCapForModel(modelName: string): number {
  return env.openaiModelDailyCaps[modelName] ?? 120;
}

async function reserveOpenAiModelRequest(modelName: string): Promise<boolean> {
  const providerKey = `openai:${modelName}`;
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

function getOpenAiModelCandidates(extra?: string[]): string[] {
  const candidates = [
    env.openaiModel,
    ...(extra ?? []),
    ...env.openaiModelFallbacks,
    "gpt-4o-mini",
  ]
    .map((x) => x.trim())
    .filter(Boolean);
  return [...new Set(candidates)];
}

function shouldTryNextModel(status: number, message: string): boolean {
  if (status === 429 || status === 404 || status === 403) return true;
  return /quota|rate|not found|unsupported|permission|does not exist/i.test(message);
}

/**
 * Chat Completions OpenAI com JSON obrigatório, fallback de modelos e cap diário.
 * Modelo padrão: gpt-4o-mini (melhor custo × capacidade para cenários financeiros).
 */
export async function openAiChatJson(args: {
  prompt: string;
  system?: string;
  preferredModels?: string[];
}): Promise<{ text: string; model: string }> {
  if (!env.openaiApiKey) {
    throw new Error("OPENAI_API_KEY ausente.");
  }

  const models = getOpenAiModelCandidates(args.preferredModels);
  if (models.length === 0) {
    throw new Error("Nenhum modelo OpenAI válido configurado.");
  }

  const errors: ModelAttemptError[] = [];
  for (const modelName of models) {
    const reserved = await reserveOpenAiModelRequest(modelName);
    if (!reserved) {
      errors.push({
        model: modelName,
        err: new Error(`Cap diário atingido para ${modelName} (cap=${dailyCapForModel(modelName)}).`),
      });
      continue;
    }

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelName,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                args.system ??
                "You are a careful financial analysis assistant. Respond only with valid JSON matching the user schema.",
            },
            { role: "user", content: args.prompt },
          ],
        }),
      });

      const data = (await res.json()) as ChatCompletionResponse;
      if (!res.ok) {
        const msg = data.error?.message ?? `HTTP ${res.status}`;
        const err = Object.assign(new Error(msg), { status: res.status });
        errors.push({ model: modelName, err });
        if (!shouldTryNextModel(res.status, msg)) break;
        continue;
      }

      const text = data.choices?.[0]?.message?.content?.trim() ?? "";
      if (!text) {
        errors.push({ model: modelName, err: new Error("Resposta OpenAI vazia.") });
        continue;
      }
      return { text, model: modelName };
    } catch (err) {
      errors.push({ model: modelName, err });
      const status = err && typeof err === "object" && "status" in err ? Number((err as { status?: unknown }).status) : 0;
      const message = err instanceof Error ? err.message : String(err);
      if (!shouldTryNextModel(status, message)) break;
    }
  }

  const last = errors[errors.length - 1];
  if (!last) {
    throw new Error("Falha ao inicializar modelos OpenAI.");
  }
  const attempted = errors.map((e) => e.model).join(", ");
  const baseMsg = last.err instanceof Error ? last.err.message : String(last.err);
  throw new Error(`Modelos testados (${attempted}) falharam. Último erro: ${baseMsg}`);
}

export async function reserveDailyParamAgentOpenAiCall(modelName: string): Promise<boolean> {
  const provider = `openai-daily-param-agent:${modelName}`;
  const dayStart = utcDayStartDate();
  const cap = env.dailyParamAgentOpenAiDailyCap;
  type CountRow = { requests: number };
  const rows = await prisma.$queryRaw<CountRow[]>`
    SELECT "requests"
    FROM "api_quota_counters"
    WHERE "provider" = ${provider}
      AND "window" = 'day'
      AND "windowStart" = ${dayStart}
    LIMIT 1
  `;
  const used = rows[0]?.requests ?? 0;
  if (used >= cap) return false;
  await prisma.$executeRaw`
    INSERT INTO "api_quota_counters" ("id","provider","window","windowStart","requests","updatedAt","createdAt")
    VALUES (gen_random_uuid()::text, ${provider}, 'day', ${dayStart}, 1, NOW(), NOW())
    ON CONFLICT ("provider","window","windowStart")
    DO UPDATE SET "requests" = "api_quota_counters"."requests" + 1, "updatedAt" = NOW()
  `;
  return true;
}
