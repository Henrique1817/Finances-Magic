import cron from "node-cron";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { runClimateIngestion } from "./services/ingestion/climateWorker";
import { runMarketDataIngestion } from "./services/ingestion/marketDataWorker";
import { runNewsAnalysisIngestion } from "./services/ingestion/newsAnalysisWorker";
import { runScenarioOutcomeTraining } from "./services/ai/scenarioOutcomeTrainer";
import { runAutoScenarioTraining } from "./services/ai/autoScenarioTrainerWorker";
import { runReferencedAssetPriceIngestion } from "./services/ingestion/referencedAssetPriceWorker";

const log = logger.child({ module: "workers" });

/** Segunda a sexta, 18:30 no fuso `CRON_TZ`. */
const MARKET_DATA_CRON = "30 18 * * 1-5";

/** Diariamente às 08:00 no fuso `CRON_TZ`. */
const NEWS_ANALYSIS_CRON = "0 8 * * *";

/** Diariamente às 07:15 no fuso `CRON_TZ`. */
const CLIMATE_CRON = "15 7 * * *";
/** Diariamente às 02:45 no fuso `CRON_TZ`. */
const AI_TRAINER_CRON = "45 2 * * *";
/** Diariamente às 03:10 no fuso `CRON_TZ`. */
const AI_AUTO_SCENARIO_CRON = "10 3 * * *";
/** A cada 10 min — cotações 30m só para ativos em carteiras (intervalo mín. por ativo via env). */
const REFERENCED_ASSET_PRICE_CRON = "*/10 * * * *";

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

  if (env.userAssetPriceIngestEnabled) {
    cron.schedule(
      REFERENCED_ASSET_PRICE_CRON,
      () => {
        void runReferencedAssetPriceIngestion().catch((err) =>
          log.error({ err }, "referencedAssetPriceWorker falhou (async)"),
        );
      },
      { timezone: env.cronTimezone },
    );
  } else {
    log.info("Cron de cotações referenciadas desativado (USER_ASSET_PRICE_INGEST_ENABLED=false)");
  }

  cron.schedule(
    AI_TRAINER_CRON,
    () => {
      void runScenarioOutcomeTraining().catch((err) =>
        log.error({ err }, "scenarioOutcomeTrainer falhou (async)"),
      );
    },
    { timezone: env.cronTimezone },
  );

  cron.schedule(
    AI_AUTO_SCENARIO_CRON,
    () => {
      void runAutoScenarioTraining().catch((err) =>
        log.error({ err }, "autoScenarioTrainer falhou (async)"),
      );
    },
    { timezone: env.cronTimezone },
  );

  log.info(
    {
      marketData: MARKET_DATA_CRON,
      newsAnalysis: NEWS_ANALYSIS_CRON,
      climate: CLIMATE_CRON,
      referencedAssetPrice: env.userAssetPriceIngestEnabled ? REFERENCED_ASSET_PRICE_CRON : "off",
      scenarioTrainer: AI_TRAINER_CRON,
      autoScenarioTrainer: AI_AUTO_SCENARIO_CRON,
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
  await runReferencedAssetPriceIngestion();
  await runScenarioOutcomeTraining();
  await runAutoScenarioTraining();
}
