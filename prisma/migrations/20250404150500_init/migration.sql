-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('STOCK', 'COMMODITY', 'ENERGY', 'INDEX', 'OTHER');

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_price_history" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "close" DECIMAL(20,8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "macro_indicators" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "value" DECIMAL(24,8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "macro_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_records" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "url" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assets_symbol_key" ON "assets"("symbol");

-- CreateIndex
CREATE INDEX "asset_price_history_assetId_date_idx" ON "asset_price_history"("assetId", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "asset_price_history_assetId_date_key" ON "asset_price_history"("assetId", "date");

-- CreateIndex
CREATE INDEX "macro_indicators_seriesId_date_idx" ON "macro_indicators"("seriesId", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "macro_indicators_seriesId_date_key" ON "macro_indicators"("seriesId", "date");

-- CreateIndex
CREATE INDEX "news_records_publishedAt_idx" ON "news_records"("publishedAt" DESC);

-- AddForeignKey
ALTER TABLE "asset_price_history" ADD CONSTRAINT "asset_price_history_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
