import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

export type ScenarioResultPayload = Record<string, unknown>;

export function scenarioTitleFromMessage(message: string, intent: string | null): string {
  const t = (intent?.trim() || message.trim()).replace(/\s+/g, " ");
  if (t.length <= 160) return t;
  return `${t.slice(0, 157)}…`;
}

export async function createScenarioRecord(
  userId: string,
  title: string,
  message: string,
  resultJson: ScenarioResultPayload,
): Promise<{ id: string }> {
  const row = await prisma.scenario.create({
    data: {
      userId,
      title,
      message,
      resultJson: resultJson as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
  return row;
}

export type ScenarioListRow = {
  id: string;
  title: string;
  message: string;
  createdAt: Date;
};

export async function listScenariosForUser(userId: string, take = 100): Promise<ScenarioListRow[]> {
  return prisma.scenario.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      title: true,
      message: true,
      createdAt: true,
    },
  });
}

export async function getScenarioForUser(
  userId: string,
  scenarioId: string,
): Promise<{
  id: string;
  title: string;
  message: string;
  createdAt: Date;
  resultJson: unknown;
} | null> {
  return prisma.scenario.findFirst({
    where: { id: scenarioId, userId },
    select: {
      id: true,
      title: true,
      message: true,
      createdAt: true,
      resultJson: true,
    },
  });
}

export async function deleteScenarioForUser(userId: string, scenarioId: string): Promise<boolean> {
  const r = await prisma.scenario.deleteMany({
    where: { id: scenarioId, userId },
  });
  return r.count > 0;
}
