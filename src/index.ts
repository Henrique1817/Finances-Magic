import { createApp } from "./app";
import { API_SEMANTIC_VERSION } from "./config/apiVersion";
import { env } from "./config/env";
import { registerIngestionWorkers } from "./workers";
import { logger } from "./lib/logger";
import { prisma } from "./lib/prisma";

async function main() {
  const app = createApp();

  await prisma.$connect();

  registerIngestionWorkers();

  app.listen(env.port, () => {
    logger.info(
      { port: env.port, apiVersion: API_SEMANTIC_VERSION, nodeEnv: env.nodeEnv },
      "Code Chroma API no ar",
    );
  });
}

main().catch((err) => {
  logger.fatal({ err }, "Falha ao iniciar o servidor");
  process.exit(1);
});
