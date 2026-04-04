import cron from "node-cron";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { runMarketDataIngestion } from "./services/ingestion/marketDataWorker";
import { runNewsAnalysisIngestion } from "./services/ingestion/newsAnalysisWorker";

const log = logger.child({ module: "workers" });

/** Segunda a sexta, 18:30 no fuso `CRON_TZ`. */
const MARKET_DATA_CRON = "30 18 * * 1-5";

/** Diariamente às 08:00 no fuso `CRON_TZ`. */
const NEWS_ANALYSIS_CRON = "0 8 * * *";

/**
 * Registra os cron jobs do motor de ingestão (mercado + notícias/NLP).
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

  log.info(
    { marketData: MARKET_DATA_CRON, newsAnalysis: NEWS_ANALYSIS_CRON, timezone: env.cronTimezone },
    "Cron jobs de ingestão registrados",
  );
}

/** Execução manual (ex.: script CLI). */
export async function runAllIngestionJobsOnce(): Promise<void> {
  await runMarketDataIngestion();
  await runNewsAnalysisIngestion();
}
