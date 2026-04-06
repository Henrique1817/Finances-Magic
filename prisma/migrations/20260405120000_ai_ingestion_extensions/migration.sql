-- Deduplicate news_records by url (keep row with minimum id)
DELETE FROM "news_records" AS dr
WHERE dr."url" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "news_records" AS x
    WHERE x."url" = dr."url"
      AND x."id" < dr."id"
  );

-- Backfill null urls so NOT NULL + UNIQUE is valid
UPDATE "news_records"
SET "url" = 'legacy:' || "id"
WHERE "url" IS NULL;

-- AlterTable news_records: new columns
ALTER TABLE "news_records" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "news_records" ADD COLUMN IF NOT EXISTS "summary" TEXT;
ALTER TABLE "news_records" ADD COLUMN IF NOT EXISTS "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Unique + NOT NULL on url
ALTER TABLE "news_records" ALTER COLUMN "url" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "news_records_url_key" ON "news_records"("url");

-- AlterTable assets
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "issuerName" TEXT;
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "exchange" TEXT;
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "isin" TEXT;

-- CreateTable climate_observations
CREATE TABLE IF NOT EXISTS "climate_observations" (
    "id" TEXT NOT NULL,
    "regionKey" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "tempMeanC" DECIMAL(10,4),
    "precipMm" DECIMAL(12,4),
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "climate_observations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "climate_observations_regionKey_date_key" ON "climate_observations"("regionKey", "date");
CREATE INDEX IF NOT EXISTS "climate_observations_regionKey_date_idx" ON "climate_observations"("regionKey", "date" DESC);

-- CreateTable ingestion_runs
CREATE TABLE IF NOT EXISTS "ingestion_runs" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "rowsUpserted" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "ingestion_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ingestion_runs_jobName_startedAt_idx" ON "ingestion_runs"("jobName", "startedAt" DESC);

-- CreateTable factor_exposure_snapshots
CREATE TABLE IF NOT EXISTS "factor_exposure_snapshots" (
    "id" TEXT NOT NULL,
    "asOfDate" DATE NOT NULL,
    "windowDays" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "factor_exposure_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "factor_exposure_snapshots_asOfDate_idx" ON "factor_exposure_snapshots"("asOfDate" DESC);
