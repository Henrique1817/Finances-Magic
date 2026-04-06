import { prisma } from "./prisma";

/**
 * Cria linha `IngestionRun`, executa o job e grava sucesso ou erro.
 * `fn` pode retornar o número de linhas upsertidas (opcional).
 */
export async function runWithIngestionRunLog(
  jobName: string,
  fn: () => Promise<number | void>,
): Promise<void> {
  const run = await prisma.ingestionRun.create({
    data: {
      jobName,
      status: "running",
      startedAt: new Date(),
    },
  });

  try {
    const rows = await fn();
    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status: "success",
        rowsUpserted: typeof rows === "number" ? rows : 0,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status: "error",
        error: msg,
      },
    });
    throw e;
  }
}
