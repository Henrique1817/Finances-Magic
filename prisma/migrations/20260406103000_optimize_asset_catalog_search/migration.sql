-- Supabase/Postgres: acelera autocomplete de catálogo global.
-- Requer extensão pg_trgm para similarity() e índices trigram.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índices B-Tree para prefix/equality em lower(symbol|name).
CREATE INDEX IF NOT EXISTS "assets_symbol_lower_idx"
  ON "assets" (lower("symbol"));

CREATE INDEX IF NOT EXISTS "assets_name_lower_idx"
  ON "assets" (lower("name"));

-- Índices GIN trigram para contains/fuzzy search.
CREATE INDEX IF NOT EXISTS "assets_symbol_trgm_idx"
  ON "assets" USING GIN ("symbol" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "assets_name_trgm_idx"
  ON "assets" USING GIN ("name" gin_trgm_ops);
