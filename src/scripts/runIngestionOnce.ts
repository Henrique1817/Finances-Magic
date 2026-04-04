import "dotenv/config";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { runAllIngestionJobsOnce } from "../workers";

async function main() {
  await prisma.$connect();
  await runAllIngestionJobsOnce();
  await prisma.$disconnect();
}

main().catch((err) => {
  logger.fatal({ err }, "ingest:once falhou");
  void prisma.$disconnect();
  process.exit(1);
});
