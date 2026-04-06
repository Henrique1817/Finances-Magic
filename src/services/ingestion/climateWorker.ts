import { Prisma } from "@prisma/client";
import axios, { isAxiosError } from "axios";
import { CLIMATE_REGION_PRESETS, parseClimateRegionKeys } from "../../config/ingestion";
import { env } from "../../config/env";
import { runWithIngestionRunLog } from "../../lib/ingestionRun";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";

const log = logger.child({ worker: "climate" });

const OPEN_METEO_ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";
const SOURCE_LABEL = "open-meteo-archive";

type ArchiveResponse = {
  daily?: {
    time?: string[];
    temperature_2m_mean?: (number | null)[];
    precipitation_sum?: (number | null)[];
  };
};

function utcNoonDate(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T12:00:00.000Z`);
}

/**
 * Últimos 14 dias (inclusive) por região configurada em `CLIMATE_REGION_KEYS`.
 */
export async function runClimateIngestion(): Promise<void> {
  await runWithIngestionRunLog("climate", async () => {
    log.info("Início climateWorker");

    const keys = parseClimateRegionKeys(env.climateRegionKeys);
    if (keys.length === 0) {
      log.warn("Nenhuma região de clima válida (defina CLIMATE_REGION_KEYS) — worker ignorado");
      return 0;
    }

    const end = new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 14);
    const endStr = end.toISOString().slice(0, 10);
    const startStr = start.toISOString().slice(0, 10);

    let rows = 0;

    for (const regionKey of keys) {
      const preset = CLIMATE_REGION_PRESETS[regionKey];
      if (!preset) continue;

      try {
        const { data, status } = await axios.get<ArchiveResponse>(OPEN_METEO_ARCHIVE, {
          params: {
            latitude: preset.lat,
            longitude: preset.lon,
            start_date: startStr,
            end_date: endStr,
            daily: "temperature_2m_mean,precipitation_sum",
            timezone: "UTC",
          },
          validateStatus: () => true,
        });

        if (status >= 400) {
          log.error({ regionKey, status }, "Open-Meteo HTTP erro");
          continue;
        }

        const times = data.daily?.time ?? [];
        const temps = data.daily?.temperature_2m_mean ?? [];
        const precips = data.daily?.precipitation_sum ?? [];

        for (let i = 0; i < times.length; i++) {
          const day = times[i];
          if (!day) continue;
          const d = utcNoonDate(day);
          const tRaw = temps[i];
          const pRaw = precips[i];
          const tempMeanC = tRaw != null && Number.isFinite(tRaw) ? new Prisma.Decimal(tRaw) : null;
          const precipMm = pRaw != null && Number.isFinite(pRaw) ? new Prisma.Decimal(pRaw) : null;

          await prisma.climateObservation.upsert({
            where: { regionKey_date: { regionKey, date: d } },
            create: {
              regionKey,
              date: d,
              tempMeanC,
              precipMm,
              source: SOURCE_LABEL,
            },
            update: {
              tempMeanC,
              precipMm,
              source: SOURCE_LABEL,
            },
          });
          rows += 1;
        }

        log.info({ regionKey, days: times.length, label: preset.label }, "Clima persistido");
      } catch (err) {
        if (isAxiosError(err)) {
          log.error({ err: err.message, regionKey }, "Falha de rede Open-Meteo");
        } else {
          log.error({ err, regionKey }, "Falha climateWorker");
        }
      }
    }

    log.info("Fim climateWorker");
    return rows;
  });
}
