import "dotenv/config";
import { defineConfig } from "prisma/config";

const migrateUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!migrateUrl || migrateUrl.trim() === "") {
  throw new Error("DATABASE_URL ou DIRECT_URL deve estar definido para comandos Prisma.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Prisma 7: URL de CLI/migrate vem do config (não mais do schema).
    // Preferimos DIRECT_URL para migrations; fallback para DATABASE_URL.
    url: migrateUrl,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
