import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { env } from "../../config/env";
import { generateAndPersistAiScenario } from "./aiScenarioOrchestrator";

const log = logger.child({ worker: "autoScenarioTrainer" });

const AUTO_SCENARIO_TEMPLATES = [
  "Com juros americanos subindo 0,50 pp e VIX em alta, como isso afeta minha carteira?",
  "Se o petróleo WTI cair 15% e o dólar subir, qual o impacto esperado nas minhas posições?",
  "Num cenário de desaceleração global com maior aversão a risco, o que muda na minha carteira?",
  "Se houver melhora de inflação e queda de juros longos, quais ativos da minha carteira tenderiam a reagir melhor?",
  "Se commodities metálicas subirem e energia ficar volátil, qual o efeito provável na carteira?",
];

function utcDayStartDate(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function reserveAutoScenarioBudget(maxPerDay: number): Promise<boolean> {
  const providerKey = "ai:auto-scenario";
  const dayStart = utcDayStartDate();
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
  if (used >= maxPerDay) return false;
  await prisma.$executeRaw`
    INSERT INTO "api_quota_counters" ("id","provider","window","windowStart","requests","updatedAt","createdAt")
    VALUES (gen_random_uuid()::text, ${providerKey}, 'day', ${dayStart}, 1, NOW(), NOW())
    ON CONFLICT ("provider","window","windowStart")
    DO UPDATE SET "requests" = "api_quota_counters"."requests" + 1, "updatedAt" = NOW()
  `;
  return true;
}

export async function runAutoScenarioTraining(): Promise<{
  attempted: number;
  created: number;
  skippedByBudget: number;
}> {
  if (!env.aiAutoTrainingEnabled) {
    return { attempted: 0, created: 0, skippedByBudget: 0 };
  }

  const users = await prisma.user.findMany({
    take: env.aiAutoTrainingMaxUsersPerRun,
    orderBy: { createdAt: "asc" },
    where: {
      wallet: {
        is: {
          walletAssets: { some: {} },
        },
      },
    },
    select: { id: true },
  });

  let attempted = 0;
  let created = 0;
  let skippedByBudget = 0;

  for (let i = 0; i < users.length; i++) {
    const reserved = await reserveAutoScenarioBudget(env.aiAutoTrainingMaxScenariosPerDay);
    if (!reserved) {
      skippedByBudget += users.length - i;
      break;
    }
    attempted += 1;
    const template = AUTO_SCENARIO_TEMPLATES[i % AUTO_SCENARIO_TEMPLATES.length]!;
    const result = await generateAndPersistAiScenario({
      userId: users[i]!.id,
      message: template,
    });
    if (result.ok) {
      created += 1;
    } else {
      log.warn(
        { userId: users[i]!.id, status: result.status, message: result.message },
        "Falha em auto-cenário individual",
      );
    }
  }

  log.info(
    { attempted, created, skippedByBudget, maxPerDay: env.aiAutoTrainingMaxScenariosPerDay },
    "Auto-treinamento por geração de cenários concluído",
  );
  return { attempted, created, skippedByBudget };
}
