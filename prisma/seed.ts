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
  { symbol: "GOOGL", name: "Alphabet Inc.", category: "Tech", type: AssetType.STOCK },
  { symbol: "AMZN", name: "Amazon.com Inc.", category: "Tech", type: AssetType.STOCK },
  { symbol: "META", name: "Meta Platforms Inc.", category: "Tech", type: AssetType.STOCK },
  { symbol: "TSM", name: "Taiwan Semiconductor Manufacturing", category: "Tech", type: AssetType.STOCK },
  { symbol: "ASML", name: "ASML Holding NV", category: "Tech", type: AssetType.STOCK },
  { symbol: "AMD", name: "Advanced Micro Devices", category: "Tech", type: AssetType.STOCK },
  { symbol: "INTC", name: "Intel Corp.", category: "Tech", type: AssetType.STOCK },

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
  { symbol: "SLV", name: "iShares Silver Trust", category: "Commodities", type: AssetType.COMMODITY },
  { symbol: "PPLT", name: "abrdn Physical Platinum Shares", category: "Commodities", type: AssetType.COMMODITY },
  { symbol: "DBA", name: "Invesco DB Agriculture Fund", category: "Commodities", type: AssetType.COMMODITY },
  { symbol: "URA", name: "Global X Uranium ETF", category: "Commodities", type: AssetType.COMMODITY },

  // Energia
  {
    symbol: "USO",
    name: "United States Oil Fund (Petróleo)",
    category: "Energia",
    type: AssetType.ENERGY,
  },
  { symbol: "XLE", name: "Energy Select Sector SPDR Fund", category: "Energia", type: AssetType.ENERGY },
  { symbol: "XOP", name: "SPDR S&P Oil & Gas Exploration & Production ETF", category: "Energia", type: AssetType.ENERGY },
  { symbol: "ENB", name: "Enbridge Inc.", category: "Energia", type: AssetType.ENERGY },
  { symbol: "EQNR", name: "Equinor ASA", category: "Energia", type: AssetType.ENERGY },

  // Índices
  { symbol: "SPY", name: "S&P 500 ETF Trust", category: "Index", type: AssetType.INDEX },
  {
    symbol: "QQQ",
    name: "Invesco QQQ Trust (Nasdaq)",
    category: "Index",
    type: AssetType.INDEX,
  },
  { symbol: "DIA", name: "SPDR Dow Jones Industrial Average ETF", category: "Index", type: AssetType.INDEX },
  { symbol: "IWM", name: "iShares Russell 2000 ETF", category: "Index", type: AssetType.INDEX },
  { symbol: "EEM", name: "iShares MSCI Emerging Markets ETF", category: "Index", type: AssetType.INDEX },
  { symbol: "EWZ", name: "iShares MSCI Brazil ETF", category: "Index", type: AssetType.INDEX },
  { symbol: "BOVA11", name: "iShares Ibovespa Fundo de Indice", category: "Index", type: AssetType.INDEX },

  // Bancos e financeiro
  { symbol: "JPM", name: "JPMorgan Chase & Co.", category: "Financeiro", type: AssetType.STOCK },
  { symbol: "BAC", name: "Bank of America Corp.", category: "Financeiro", type: AssetType.STOCK },
  { symbol: "WFC", name: "Wells Fargo & Co.", category: "Financeiro", type: AssetType.STOCK },
  { symbol: "GS", name: "Goldman Sachs Group Inc.", category: "Financeiro", type: AssetType.STOCK },
  { symbol: "ITUB4", name: "Itau Unibanco PN", category: "Financeiro", type: AssetType.STOCK },
  { symbol: "BBDC4", name: "Bradesco PN", category: "Financeiro", type: AssetType.STOCK },

  // Saude
  { symbol: "JNJ", name: "Johnson & Johnson", category: "Saude", type: AssetType.STOCK },
  { symbol: "PFE", name: "Pfizer Inc.", category: "Saude", type: AssetType.STOCK },
  { symbol: "MRK", name: "Merck & Co.", category: "Saude", type: AssetType.STOCK },
  { symbol: "UNH", name: "UnitedHealth Group Inc.", category: "Saude", type: AssetType.STOCK },
  { symbol: "HAPV3", name: "Hapvida Participacoes", category: "Saude", type: AssetType.STOCK },
  { symbol: "FLRY3", name: "Fleury SA", category: "Saude", type: AssetType.STOCK },

  // Consumo
  { symbol: "WMT", name: "Walmart Inc.", category: "Consumo", type: AssetType.STOCK },
  { symbol: "COST", name: "Costco Wholesale Corp.", category: "Consumo", type: AssetType.STOCK },
  { symbol: "PG", name: "Procter & Gamble Co.", category: "Consumo", type: AssetType.STOCK },
  { symbol: "KO", name: "Coca-Cola Co.", category: "Consumo", type: AssetType.STOCK },
  { symbol: "MGLU3", name: "Magazine Luiza ON", category: "Consumo", type: AssetType.STOCK },
  { symbol: "ABEV3", name: "Ambev SA ON", category: "Consumo", type: AssetType.STOCK },

  // Industrial e logistica
  { symbol: "CAT", name: "Caterpillar Inc.", category: "Industrial", type: AssetType.STOCK },
  { symbol: "GE", name: "GE Aerospace", category: "Industrial", type: AssetType.STOCK },
  { symbol: "DE", name: "Deere & Co.", category: "Industrial", type: AssetType.STOCK },
  { symbol: "RAIL3", name: "Rumo SA ON", category: "Industrial", type: AssetType.STOCK },
  { symbol: "WEGE3", name: "WEG SA ON", category: "Industrial", type: AssetType.STOCK },

  // Imobiliario
  { symbol: "VNQ", name: "Vanguard Real Estate ETF", category: "Imobiliario", type: AssetType.STOCK },
  { symbol: "XLRE", name: "Real Estate Select Sector SPDR Fund", category: "Imobiliario", type: AssetType.STOCK },
  { symbol: "HGLG11", name: "CSHG Logistica FII", category: "Imobiliario", type: AssetType.STOCK },
  { symbol: "KNRI11", name: "Kinea Renda Imobiliaria FII", category: "Imobiliario", type: AssetType.STOCK },

  // Cripto e blockchain (ETFs/ativos listados)
  { symbol: "BTC-USD", name: "Bitcoin USD", category: "Crypto", type: AssetType.OTHER },
  { symbol: "ETH-USD", name: "Ethereum USD", category: "Crypto", type: AssetType.OTHER },
  { symbol: "COIN", name: "Coinbase Global Inc.", category: "Crypto", type: AssetType.STOCK },
  { symbol: "MSTR", name: "MicroStrategy Inc.", category: "Crypto", type: AssetType.STOCK },
  { symbol: "IBIT", name: "iShares Bitcoin Trust ETF", category: "Crypto", type: AssetType.OTHER },

  // Brasil large caps
  { symbol: "PETR4", name: "Petrobras PN", category: "Brasil", type: AssetType.STOCK },
  { symbol: "VALE3", name: "Vale ON", category: "Brasil", type: AssetType.STOCK },
  { symbol: "BBAS3", name: "Banco do Brasil ON", category: "Brasil", type: AssetType.STOCK },
  { symbol: "ELET3", name: "Eletrobras ON", category: "Brasil", type: AssetType.STOCK },
  { symbol: "SUZB3", name: "Suzano ON", category: "Brasil", type: AssetType.STOCK },
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
