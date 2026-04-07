-- CreateTable
CREATE TABLE "asset_price_snapshots" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "bucketStart" TIMESTAMP(3) NOT NULL,
    "close" DECIMAL(20,8) NOT NULL,
    "open" DECIMAL(20,8),
    "high" DECIMAL(20,8),
    "low" DECIMAL(20,8),
    "volume" DECIMAL(24,4),
    "source" TEXT NOT NULL DEFAULT 'yahoo_finance_30m',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_price_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referenced_asset_usage" (
    "assetId" TEXT NOT NULL,
    "referenceCount" INTEGER NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referenced_asset_usage_pkey" PRIMARY KEY ("assetId")
);

-- AlterTable
ALTER TABLE "assets" ADD COLUMN "lastPriceSnapshotAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "asset_price_snapshots_assetId_bucketStart_key" ON "asset_price_snapshots"("assetId", "bucketStart");

-- CreateIndex
CREATE INDEX "asset_price_snapshots_assetId_bucketStart_idx" ON "asset_price_snapshots"("assetId", "bucketStart" DESC);

-- AddForeignKey
ALTER TABLE "asset_price_snapshots" ADD CONSTRAINT "asset_price_snapshots_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referenced_asset_usage" ADD CONSTRAINT "referenced_asset_usage_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
