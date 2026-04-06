-- Quotas por provedor/janela
CREATE TABLE IF NOT EXISTS "api_quota_counters" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "window" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "api_quota_counters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "api_quota_counters_provider_window_windowStart_key"
  ON "api_quota_counters"("provider", "window", "windowStart");
CREATE INDEX IF NOT EXISTS "api_quota_counters_provider_windowStart_idx"
  ON "api_quota_counters"("provider", "windowStart" DESC);

-- Eventos de fallback entre provedores
CREATE TABLE IF NOT EXISTS "provider_fallback_events" (
    "id" TEXT NOT NULL,
    "pipeline" TEXT NOT NULL,
    "fromProvider" TEXT NOT NULL,
    "toProvider" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "context" TEXT,
    "sourceStatusCode" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "provider_fallback_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "provider_fallback_events_pipeline_createdAt_idx"
  ON "provider_fallback_events"("pipeline", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "provider_fallback_events_fromProvider_createdAt_idx"
  ON "provider_fallback_events"("fromProvider", "createdAt" DESC);

-- Status por item de ingestão
CREATE TABLE IF NOT EXISTS "ingestion_item_status" (
    "id" TEXT NOT NULL,
    "runId" TEXT,
    "jobName" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "httpStatus" INTEGER,
    "rowsUpserted" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ingestion_item_status_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ingestion_item_status_jobName_createdAt_idx"
  ON "ingestion_item_status"("jobName", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ingestion_item_status_provider_createdAt_idx"
  ON "ingestion_item_status"("provider", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ingestion_item_status_itemType_itemKey_idx"
  ON "ingestion_item_status"("itemType", "itemKey");
