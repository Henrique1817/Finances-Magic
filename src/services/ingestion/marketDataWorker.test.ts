import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MARKET_WORKER_ASSETS,
  MARKET_WORKER_FRED_SERIES,
  MARKET_WORKER_WORLD_BANK_INDICATORS,
} from "../../config/ingestion";

const mocks = vi.hoisted(() => {
  const prisma = {
    asset: { upsert: vi.fn() },
    assetPriceHistory: { upsert: vi.fn() },
    macroIndicator: { upsert: vi.fn() },
  };
  return {
    prisma,
    withRetry: vi.fn(),
    canUseProvider: vi.fn(),
    markProvider429: vi.fn(),
    recordFallbackEvent: vi.fn(),
    recordIngestionItemStatus: vi.fn(),
    runWithIngestionRunLog: vi.fn(),
    sleep: vi.fn(),
    axiosGet: vi.fn(),
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
vi.mock("../../config/env", () => ({
  env: {
    nodeEnv: "test",
    logLevel: "silent",
    brapiToken: "token",
    alphaVantageApiKey: "key",
    alphaVantageUseMock: false,
    yfinancePythonExecutable: "python",
    fredApiKey: "fred-key",
  },
}));
vi.mock("../../lib/ingestionRun", () => ({
  runWithIngestionRunLog: mocks.runWithIngestionRunLog,
}));
vi.mock("../../lib/sleep", () => ({ sleep: mocks.sleep }));
vi.mock("./quotaPlanner", () => ({
  withRetry: mocks.withRetry,
  canUseProvider: mocks.canUseProvider,
  markProvider429: mocks.markProvider429,
  recordFallbackEvent: mocks.recordFallbackEvent,
  recordIngestionItemStatus: mocks.recordIngestionItemStatus,
}));
vi.mock("axios", () => ({
  default: { get: mocks.axiosGet },
  isAxiosError: () => false,
}));

import { runMarketDataIngestion } from "./marketDataWorker";

describe("runMarketDataIngestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.prisma.asset.upsert.mockResolvedValue({ id: "asset-id" });
    mocks.prisma.assetPriceHistory.upsert.mockResolvedValue({});
    mocks.prisma.macroIndicator.upsert.mockResolvedValue({});
    mocks.canUseProvider.mockReturnValue({ ok: true });
    mocks.sleep.mockResolvedValue(undefined);
    mocks.recordIngestionItemStatus.mockResolvedValue(undefined);
    mocks.recordFallbackEvent.mockResolvedValue(undefined);
    mocks.runWithIngestionRunLog.mockImplementation(async (_jobName: string, fn: () => Promise<number | void>) => {
      await fn();
    });

    mocks.withRetry.mockImplementation(async (_provider: string, fn: (attempt: number) => Promise<unknown>) => fn(1));
    mocks.axiosGet.mockImplementation(async (url: string) => {
      if (url.includes("brapi.dev")) {
        return {
          status: 200,
          data: {
            results: [
              {
                historicalDataPrice: [{ date: 1_710_720_000, close: 123.45 }],
              },
            ],
          },
        };
      }

      if (url.includes("stlouisfed.org")) {
        return {
          status: 200,
          data: { observations: [{ date: "2025-01-02", value: "4.11" }] },
        };
      }

      if (url.includes("api.worldbank.org")) {
        return {
          status: 200,
          data: [{}, [{ date: "2024", value: 2.8 }]],
        };
      }

      return { status: 404, data: {} };
    });
  });

  it("ingere e persiste preços, séries FRED e World Bank", async () => {
    await runMarketDataIngestion();

    expect(mocks.runWithIngestionRunLog).toHaveBeenCalledWith("marketData", expect.any(Function));
    expect(mocks.prisma.asset.upsert).toHaveBeenCalledTimes(MARKET_WORKER_ASSETS.length);
    expect(mocks.prisma.assetPriceHistory.upsert).toHaveBeenCalledTimes(MARKET_WORKER_ASSETS.length);
    expect(mocks.prisma.macroIndicator.upsert).toHaveBeenCalledTimes(
      MARKET_WORKER_FRED_SERIES.length + MARKET_WORKER_WORLD_BANK_INDICATORS.length,
    );
  });

  it("registra erro de item quando persistência de ativo falha", async () => {
    let failOnce = true;
    mocks.prisma.asset.upsert.mockImplementation(async () => {
      if (failOnce) {
        failOnce = false;
        throw new Error("db_failure");
      }
      return { id: "asset-id" };
    });

    await runMarketDataIngestion();

    expect(mocks.recordIngestionItemStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        jobName: "marketData",
        itemType: "asset",
        status: "error",
      }),
    );
  });
});
