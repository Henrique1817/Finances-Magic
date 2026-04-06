import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const prisma = {
    user: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  };
  return {
    prisma,
    generateAndPersistAiScenario: vi.fn(),
    env: {
      aiAutoTrainingEnabled: true,
      aiAutoTrainingMaxScenariosPerDay: 3,
      aiAutoTrainingMaxUsersPerRun: 3,
    },
  };
});

vi.mock("../../lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("../../lib/logger", () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));
vi.mock("../../config/env", () => ({ env: mocks.env }));
vi.mock("./aiScenarioOrchestrator", () => ({
  generateAndPersistAiScenario: mocks.generateAndPersistAiScenario,
}));

import { runAutoScenarioTraining } from "./autoScenarioTrainerWorker";

describe("runAutoScenarioTraining", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.aiAutoTrainingEnabled = true;
    mocks.env.aiAutoTrainingMaxScenariosPerDay = 3;
    mocks.env.aiAutoTrainingMaxUsersPerRun = 3;
    mocks.prisma.user.findMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }, { id: "u3" }]);
    mocks.prisma.$queryRaw.mockResolvedValue([{ requests: 0 }]);
    mocks.prisma.$executeRaw.mockResolvedValue(1);
    mocks.generateAndPersistAiScenario.mockResolvedValue({ ok: true });
  });

  it("retorna zero quando auto treinamento está desativado", async () => {
    mocks.env.aiAutoTrainingEnabled = false;

    const result = await runAutoScenarioTraining();

    expect(result).toEqual({ attempted: 0, created: 0, skippedByBudget: 0 });
    expect(mocks.prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("gera cenários para usuários elegíveis e contabiliza falhas individuais", async () => {
    mocks.generateAndPersistAiScenario
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, status: 429, message: "quota" })
      .mockResolvedValueOnce({ ok: true });

    const result = await runAutoScenarioTraining();

    expect(result).toEqual({ attempted: 3, created: 2, skippedByBudget: 0 });
    expect(mocks.generateAndPersistAiScenario).toHaveBeenCalledTimes(3);
    expect(mocks.generateAndPersistAiScenario).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1" }),
    );
  });

  it("interrompe quando o orçamento diário é atingido", async () => {
    mocks.env.aiAutoTrainingMaxScenariosPerDay = 1;
    mocks.prisma.user.findMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }]);
    mocks.prisma.$queryRaw
      .mockResolvedValueOnce([{ requests: 0 }])
      .mockResolvedValueOnce([{ requests: 1 }]);

    const result = await runAutoScenarioTraining();

    expect(result).toEqual({ attempted: 1, created: 1, skippedByBudget: 1 });
    expect(mocks.generateAndPersistAiScenario).toHaveBeenCalledTimes(1);
  });
});
