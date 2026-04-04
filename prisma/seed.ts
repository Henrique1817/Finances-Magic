import "dotenv/config";
import { PrismaClient, AssetType } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Master data estratégico — idempotente via upsert por `symbol`.
 */
const STRATEGIC_ASSETS: ReadonlyArray<{
  symbol: string;
  name: string;
  category: string;
  type: AssetType;
}> = [
  // Big Tech & IA
  { symbol: "NVDA", name: "NVIDIA Corp.", category: "Tech", type: AssetType.STOCK },
  { symbol: "AAPL", name: "Apple Inc.", category: "Tech", type: AssetType.STOCK },
  { symbol: "MSFT", name: "Microsoft Corp.", category: "Tech", type: AssetType.STOCK },
  // Commodities & mineração
  {
    symbol: "COPX",
    name: "Global Copper Miners ETF",
    category: "Commodities",
    type: AssetType.COMMODITY,
  },
  {
    symbol: "LIT",
    name: "Global X Lithium & Battery Tech",
    category: "Commodities",
    type: AssetType.COMMODITY,
  },
  { symbol: "GLD", name: "SPDR Gold Trust", category: "Commodities", type: AssetType.COMMODITY },
  // Energia
  {
    symbol: "USO",
    name: "United States Oil Fund (Petróleo)",
    category: "Energia",
    type: AssetType.ENERGY,
  },
  // Índices
  { symbol: "SPY", name: "S&P 500 ETF Trust", category: "Index", type: AssetType.INDEX },
  {
    symbol: "QQQ",
    name: "Invesco QQQ Trust (Nasdaq)",
    category: "Index",
    type: AssetType.INDEX,
  },
];

async function main() {
  for (const row of STRATEGIC_ASSETS) {
    await prisma.asset.upsert({
      where: { symbol: row.symbol },
      create: {
        symbol: row.symbol,
        name: row.name,
        category: row.category,
        type: row.type,
      },
      update: {
        name: row.name,
        category: row.category,
        type: row.type,
      },
    });
  }

  const count = await prisma.asset.count();
  console.log(`[seed] Upsert concluído: ${STRATEGIC_ASSETS.length} ativos estratégicos. Total na tabela assets: ${count}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
