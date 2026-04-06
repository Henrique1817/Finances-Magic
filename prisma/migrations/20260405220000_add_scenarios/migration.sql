-- CreateTable
CREATE TABLE "scenarios" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "resultJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scenarios_userId_createdAt_idx" ON "scenarios"("userId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
