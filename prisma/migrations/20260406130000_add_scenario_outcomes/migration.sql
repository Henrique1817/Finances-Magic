-- CreateTable
CREATE TABLE "scenario_outcomes" (
    "id" TEXT NOT NULL,
    "outcomeKey" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "walletAssetId" TEXT,
    "assetSymbol" TEXT NOT NULL,
    "horizonDays" INTEGER NOT NULL,
    "predictedReturn" DECIMAL(20,8) NOT NULL,
    "predictedDirection" INTEGER NOT NULL,
    "baselineDate" DATE NOT NULL,
    "baselineClose" DECIMAL(20,8) NOT NULL,
    "targetDate" DATE NOT NULL,
    "actualReturn" DECIMAL(20,8),
    "actualDirection" INTEGER,
    "directionHit" BOOLEAN,
    "absoluteError" DECIMAL(20,8),
    "absolutePctError" DECIMAL(20,8),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "evaluatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenario_outcomes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scenario_outcomes_outcomeKey_key" ON "scenario_outcomes"("outcomeKey");

-- CreateIndex
CREATE INDEX "scenario_outcomes_horizonDays_status_targetDate_idx" ON "scenario_outcomes"("horizonDays", "status", "targetDate");

-- CreateIndex
CREATE INDEX "scenario_outcomes_assetSymbol_horizonDays_status_idx" ON "scenario_outcomes"("assetSymbol", "horizonDays", "status");

-- CreateIndex
CREATE INDEX "scenario_outcomes_scenarioId_horizonDays_idx" ON "scenario_outcomes"("scenarioId", "horizonDays");

-- AddForeignKey
ALTER TABLE "scenario_outcomes" ADD CONSTRAINT "scenario_outcomes_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
