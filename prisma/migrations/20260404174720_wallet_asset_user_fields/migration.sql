/*
  Warnings:

  - Added the required column `nome` to the `wallet_assets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quantidade` to the `wallet_assets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `setor` to the `wallet_assets` table without a default value. This is not possible if the table is not empty.
  - Added the required column `valorInvestido` to the `wallet_assets` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "wallet_assets" DROP CONSTRAINT "wallet_assets_assetId_fkey";

-- DropIndex
DROP INDEX "wallet_assets_walletId_assetId_key";

-- AlterTable
ALTER TABLE "wallet_assets" ADD COLUMN     "nome" TEXT NOT NULL,
ADD COLUMN     "quantidade" DECIMAL(24,8) NOT NULL,
ADD COLUMN     "setor" TEXT NOT NULL,
ADD COLUMN     "valorInvestido" DECIMAL(20,2) NOT NULL,
ALTER COLUMN "assetId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "wallet_assets" ADD CONSTRAINT "wallet_assets_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
