import cron from "node-cron";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { runClimateIngestion } from "./services/ingestion/climateWorker";
import { runMarketDataIngestion } from "./services/ingestion/marketDataWorker";
import { runNewsAnalysisIngestion } from "./services/ingestion/newsAnalysisWorker";
import { runScenarioOutcomeTraining } from "./services/ai/scenarioOutcomeTrainer";

const log = logger.child({ module: "workers" });

/** Segunda a sexta, 18:30 no fuso `CRON_TZ`. */
const MARKET_DATA_CRON = "30 18 * * 1-5";

/** Diariamente às 08:00 no fuso `CRON_TZ`. */
const NEWS_ANALYSIS_CRON = "0 8 * * *";

/** Diariamente às 07:15 no fuso `CRON_TZ`. */
const CLIMATE_CRON = "15 7 * * *";
/** Diariamente às 02:45 no fuso `CRON_TZ`. */
const AI_TRAINER_CRON = "45 2 * * *";

/**
 * Registra os cron jobs do motor de ingestão (mercado + notícias/NLP + clima).
 * Respeita `INGESTION_CRON_ENABLED=false`.
 */
export function registerIngestionWorkers(): void {
  if (!env.ingestionCronEnabled) {
    log.info("Workers de ingestão desativados (INGESTION_CRON_ENABLED=false)");
    return;
  }

  cron.schedule(
    MARKET_DATA_CRON,
    () => {
      void runMarketDataIngestion().catch((err) => log.error({ err }, "marketDataWorker falhou (async)"));
    },
    { timezone: env.cronTimezone },
  );

  cron.schedule(
    NEWS_ANALYSIS_CRON,
    () => {
      void runNewsAnalysisIngestion().catch((err) => log.error({ err }, "newsAnalysisWorker falhou (async)"));
    },
    { timezone: env.cronTimezone },
  );

  cron.schedule(
    CLIMATE_CRON,
    () => {
      void runClimateIngestion().catch((err) => log.error({ err }, "climateWorker falhou (async)"));
    },
    { timezone: env.cronTimezone },
  );

  cron.schedule(
    AI_TRAINER_CRON,
    () => {
      void runScenarioOutcomeTraining().catch((err) =>
        log.error({ err }, "scenarioOutcomeTrainer falhou (async)"),
      );
    },
    { timezone: env.cronTimezone },
  );

  log.info(
    {
      marketData: MARKET_DATA_CRON,
      newsAnalysis: NEWS_ANALYSIS_CRON,
      climate: CLIMATE_CRON,
      scenarioTrainer: AI_TRAINER_CRON,
      timezone: env.cronTimezone,
    },
    "Cron jobs de ingestão registrados",
  );
}

/** Execução manual (ex.: script CLI). */
export async function runAllIngestionJobsOnce(): Promise<void> {
  await runMarketDataIngestion();
  await runNewsAnalysisIngestion();
  await runClimateIngestion();
  await runScenarioOutcomeTraining();
}
