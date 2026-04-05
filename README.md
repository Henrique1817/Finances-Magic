# Code Chroma — Backend (Simulador de Cenários)

API REST em **Node.js + TypeScript + Express** para o MVP da Code Chroma: ingestão diária de preços (Alpha Vantage), indicadores macro (FRED) e notícias (NewsAPI), persistência em **PostgreSQL** via **Prisma**, e endpoints somente leitura para o simulador de cenários no frontend.

**Versão da API (contrato JSON):** `1.0.0` (campo `apiVersion` nas respostas JSON; ver [Versionamento](#versionamento)).

---

## Requisitos

- Node.js **20+**
- PostgreSQL **14+** (recomendado 16)
- Chaves opcionais para ingestão: Alpha Vantage, FRED, NewsAPI

---

## Configuração rápida

1. Clone/copie o projeto e instale dependências:

   ```bash
   npm install
   ```

2. Copie `.env.example` para `.env` e preencha pelo menos `DATABASE_URL`.

3. Aplique migrações:

   ```bash
   npx prisma migrate deploy
   ```

   Em desenvolvimento, pode usar `npm run db:migrate`.

4. Gere o client Prisma (se necessário):

   ```bash
   npm run db:generate
   ```

5. Suba o servidor:

   ```bash
   npm run dev
   ```

6. (Opcional) Rode a ingestão manualmente:

   ```bash
   npm run ingest:once
   ```

---

## Scripts npm

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Servidor com `tsx watch` |
| `npm run build` | Compila TypeScript → `dist/` |
| `npm start` | Executa `dist/index.js` (após `build`) |
| `npm run db:generate` | `prisma generate` |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:push` | `prisma db push` (sem histórico de migração) |
| `npm run db:studio` | Prisma Studio |
| `npm run ingest:once` | Executa o job de ingestão uma vez |
| `npm run ingest-data` | Alias de `ingest:once` (útil em CI / documentação) |
| `npm run test` | [Vitest](https://vitest.dev/) — testes unitários (uma execução) |
| `npm run test:watch` | Vitest em modo watch |
| `npm run lint` | ESLint (TypeScript) |
| `npm run lint:fix` | ESLint com correções automáticas |

---

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | URL PostgreSQL (Prisma) |
| `SUPABASE_URL` | Sim | URL do projeto Supabase (validação de JWT no backend) |
| `SUPABASE_ANON_KEY` | Sim | Chave anon/public do Supabase (`auth.getUser`) |
| `PORT` | Não | Porta HTTP (padrão `3000`) |
| `FRONTEND_ORIGINS` | Não | Lista separada por vírgulas para CORS (padrão: `localhost:5173` e `localhost:3000`) |
| `NODE_ENV` | Não | `development` \| `production` |
| `LOG_LEVEL` | Não | Níveis pino: `trace`, `debug`, `info`, `warn`, `error`, `fatal`. Padrão: `debug` em dev, `info` em produção |
| `ALPHA_VANTAGE_API_KEY` | Não | Sem chave, o bloco Alpha Vantage na ingestão é ignorado |
| `FRED_API_KEY` | Não | Idem para FRED |
| `NEWS_API_KEY` | Não | Idem para NewsAPI |
| `ALPHA_VANTAGE_USE_MOCK` | Não | `true` força fechamentos simulados (sem rede Alpha Vantage) |
| `CRON_TZ` | Não | Fuso IANA do cron (padrão `America/Sao_Paulo`) |
| `INGESTION_CRON_ENABLED` | Não | Defina `false` para desligar o agendamento |

### Onde configurar

| Onde | Uso |
|------|-----|
| **Raiz do backend** — ficheiro `.env` | Desenvolvimento local; copie de `.env.example`. Não commite `.env`. |
| **Frontend** — `frontend/.env.local` | `NEXT_PUBLIC_*` (URL da API, Supabase). Ver `frontend/.env.example`. |
| **GitHub Actions** — *Settings → Secrets and variables → Actions* | CI, deploy e workflow de ingestão (ver secção [CI/CD](#cicd-github-actions)). |
| **Render / Vercel / Docker** | Painel de variáveis de ambiente do serviço ou compose — mesmas chaves que em produção no backend. |

---

## Testes automatizados

- **Vitest** + ficheiros `*.test.ts` junto aos serviços (ex.: `src/services/monteCarloService.test.ts`).
- **Monte Carlo** (`monteCarloService.ts`): percentis da riqueza terminal, reprodutibilidade com `seed`, validação de entradas.
- **Simulação de stress** (`simulationEngineService.ts`): cenário de referência do README, penalidades geopolíticas, alertas e casos-limite.

```bash
npm run test
```

---

## CI/CD (GitHub Actions)

Workflows em `.github/workflows/`:

| Ficheiro | Quando corre | O que faz |
|----------|----------------|-----------|
| `main.yml` | Push em `main` ou `master`, e diariamente (UTC 00:00) | `npm ci` → `npm run test` → `npm run lint`. Se passar, dispara deploy no **Render** via `RENDER_DEPLOY_HOOK` (opcional: se o secret não existir, o deploy é ignorado sem falhar o job). |
| `data_ingestion.yml` | A cada 12 h (UTC) e *workflow_dispatch* | `npm ci` → `prisma generate` → `npm run ingest-data` com secrets (base de dados, Supabase, chaves de APIs). |

### Secrets recomendados no GitHub (repositório)

Crie em **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Obrigatório para | Notas |
|--------|------------------|--------|
| `RENDER_DEPLOY_HOOK` | Deploy automático no Render | URL do *Deploy Hook* do serviço Render. Sem este secret, o job de deploy apenas regista aviso e termina com sucesso. |
| `DATABASE_URL` | Workflow de ingestão | URL PostgreSQL (igual à produção ou base dedicada ao CI). |
| `SUPABASE_URL` | Ingestão | O script carrega `config/env` (via workers); estes valores são **obrigatórios** em runtime. |
| `SUPABASE_ANON_KEY` | Ingestão | Chave anon do mesmo projeto. |
| `ALPHA_VANTAGE_API_KEY` | Ingestão de preços | Opcional; sem valor, o worker usa mock ou ignora conforme lógica existente. |
| `FRED_API_KEY` | Ingestão macro | Opcional. |
| `NEWS_API_KEY` | Ingestão de notícias / NLP | Opcional. |
| `ALPHA_VANTAGE_USE_MOCK` | Ingestão | Opcional; defina o texto `true` se quiser forçar mock na pipeline (útil para não gastar quota). |

O workflow **não** expõe chaves no código; apenas mapeia `secrets.*` para variáveis de ambiente no passo `Run data ingestion`.

---

## Versionamento

### URL

Recursos públicos ficam sob o prefixo **`/api/v1`**. Uma futura **`/api/v2`** pode coexistir sem quebrar clientes antigos.

### Corpo JSON e headers

Toda resposta JSON da API versionada inclui:

- **`apiVersion`**: string semver do contrato (ex.: `"1.0.0"`), espelhada em código em `src/config/apiVersion.ts` e alinhada ao `version` do `package.json` em releases estáveis.

Headers em **todas** as respostas HTTP (incluindo erros gerados pelos middlewares da app):

| Header | Exemplo | Significado |
|--------|---------|-------------|
| `X-API-Version` | `1.0.0` | Mesmo valor de `apiVersion` no JSON |
| `X-API-Route-Version` | `v1` | Segmento de rota major |

### Política de evolução (recomendada)

- **Compatível (minor/patch):** novos campos opcionais em `data`, novos endpoints.
- **Breaking (major):** remover/renomear campos, mudar semântica de códigos HTTP ou paths — incrementar `API_SEMANTIC_VERSION`, documentar no changelog e, se necessário, expor `/api/v2`.

---

## Logging

- **HTTP:** [pino-http](https://github.com/pinojs/pino-http) registra método, URL, status e tempo. Rotas `GET /health` e `favicon` são ignoradas no auto-logging.
- **Aplicação:** [pino](https://github.com/pinojs/pino) com `pino-pretty` em desenvolvimento.
- **Ingestão:** logs estruturados com `child` loggers (`provider`, `job`).

Em produção, envie stdout para seu agregador (Datadog, CloudWatch, etc.) e ajuste `LOG_LEVEL`.

---

## Validação de entrada

Parâmetros de query são validados com **Zod** antes do controller. Em caso de falha, a API responde **422** com lista de issues (ver [Erros](#erros)).

---

## Modelo de dados (resumo)

- **Asset** / **AssetPriceHistory** — preços diários por ativo.
- **MacroIndicator** — séries FRED (uma linha por `seriesId` + `date`).
- **NewsRecord** — notícias ingeridas.

Detalhes em `prisma/schema.prisma`.

---

## Endpoints da API

Base: `http://localhost:3000` (ou seu host/porta).

### `GET /health`

Verificação simples (sem prefixo `/api`). Não exige banco. Os headers `X-API-Version` e `X-API-Route-Version` também são enviados (vide [Versionamento](#versionamento)).

**Resposta 200**

```json
{
  "status": "ok",
  "service": "code-chroma-backend",
  "apiVersion": "1.0.0"
}
```

---

### `GET /api/v1`

Catálogo mínimo da versão atual (descoberta).

**Resposta 200**

```json
{
  "success": true,
  "apiVersion": "1.0.0",
  "data": {
    "name": "Code Chroma API",
    "semanticVersion": "1.0.0",
    "routeVersion": "v1",
    "basePath": "/api/v1",
    "endpoints": { ... },
    "docs": "Consulte README.md do repositório para o contrato completo."
  }
}
```

---

### `GET /api/v1/dashboard/current-status`

Painel atual: último preço por **pilar** (Tech / Mineração / Energia — ativos do worker de mercado), indicadores **FRED** mais recentes e **score de risco geopolítico** (`CODECHROMA_GEO_RISK_NLP`).

**Query:** nenhuma.

**Resposta 200** (`data` resumido)

- `sectors.technology` \| `mining` \| `energy`: objeto `{ symbol, name, date, close }` ou `null` se ainda não houver série.
- `macro.indicators[]`: séries macro exceto o score Code Chroma (`seriesId`, `name`, `date`, `value`).
- `macro.geoPoliticalRisk`: `{ seriesId, name, date, score }` ou `null`.

---

### `GET /api/v1/dashboard/historical`

Últimos **N** dias (padrão **30**) de preços diários dos ativos principais (AAPL, COPX, XLE) e da série de risco geopolítico, para gráficos antes da simulação.

**Query:** `days` opcional (1–90), igual ao endpoint de simulação histórica.

**Resposta 200** (`data`)

- `windowDays`, `fromDate`, `toDate`
- `assetSeries[]`: `symbol`, `name`, `type`, `points[]` com `{ date, close }`
- `geoPoliticalRisk[]`: `{ date, score }`

---

### `POST /api/v1/simulation/run`

Motor de **stress test** (mock de correlação). Corpo JSON:

```json
{
  "energyCostIncrease": 20,
  "geoRiskLevel": 8,
  "aiDemandIncrease": 50,
  "portfolioValue": 100000
}
```

**Regras (MVP):** alocação fixa (35% tech, 25% mineração, 25% energia, 15% outros); `aiDemandIncrease` aumenta tech+mineração em `(valor × 0,5)%`; `energyCostIncrease` reduz tech em `(valor × 0,2)%`; se `geoRiskLevel` > 7, **-15%** no total (supply chain).

**Resposta 200** (`data`): `baselineValue`, `projectedPortfolioValue`, `changePercent`, `alerts[]`, `breakdown`.

**422:** validação Zod. **400:** JSON malformado.

---

### `GET /api/v1/simulation/historical`

Série consolidada para calibrar pesos do simulador: **média da variação percentual diária** entre ativos de cada bucket, na janela solicitada.

**Query**

| Parâmetro | Tipo | Obrigatório | Default | Regras |
|-----------|------|-------------|---------|--------|
| `days` | integer | Não | `30` | Entre **1** e **90** |

Exemplos:

- `GET /api/v1/simulation/historical`
- `GET /api/v1/simulation/historical?days=14`

**Resposta 200**

```json
{
  "success": true,
  "apiVersion": "1.0.0",
  "data": {
    "windowDays": 30,
    "generatedAt": "2025-04-04T12:00:00.000Z",
    "fromDate": "2025-03-05",
    "toDate": "2025-04-04",
    "buckets": [
      {
        "key": "technology",
        "label": "Tecnologia",
        "assetType": "STOCK",
        "points": [
          {
            "date": "2025-04-03",
            "avgDailyVariationPercent": 0.42,
            "sampleSize": 4
          }
        ]
      },
      {
        "key": "energy",
        "label": "Energia",
        "assetType": "ENERGY",
        "points": []
      },
      {
        "key": "mining",
        "label": "Mineração",
        "assetType": "COMMODITY",
        "points": []
      }
    ]
  }
}
```

**Buckets**

| `key` | `assetType` (Prisma) | Uso |
|-------|----------------------|-----|
| `technology` | `STOCK` | Média das variações diárias dos ativos tipo ação tech monitorados |
| `energy` | `ENERGY` | Idem para energia |
| `mining` | `COMMODITY` | Idem para mineração / metais (ETFs configurados) |

**Campos `points[]`**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `date` | string | Data do fechamento “atual” no par dia a dia |
| `avgDailyVariationPercent` | number | Média dos \((P_t / P_{t-1} - 1) \times 100\) entre ativos do bucket |
| `sampleSize` | number | Quantidade de ativos que contribuíram na média nessa data |

**Resposta 422:** query inválida (ex.: `days=0` ou `days=100`).

**Resposta 500:** erro interno.

---

## Erros

### Formato geral

```json
{
  "success": false,
  "apiVersion": "1.0.0",
  "error": "Mensagem legível",
  "details": []
}
```

O campo `details` aparece quando houver informação estruturada (ex.: validação).

### HTTP 422 — validação (Zod)

Exemplo: `GET /api/v1/simulation/historical?days=abc`

```json
{
  "success": false,
  "apiVersion": "1.0.0",
  "error": "Parâmetros inválidos.",
  "details": [
    {
      "path": "days",
      "message": "Expected number, received nan",
      "code": "invalid_type"
    }
  ]
}
```

### HTTP 404 — API

Rotas sob `/api` que não existem:

```json
{
  "success": false,
  "apiVersion": "1.0.0",
  "error": "Recurso não encontrado."
}
```

### HTTP 500 — servidor

Em **produção**, a mensagem exposta ao cliente é genérica (**"Erro interno do servidor."**). Em **desenvolvimento**, pode incluir a mensagem da exceção para depuração. O stack completo fica apenas nos logs (pino).

---

## Ingestão e cron

Workers registrados em `src/workers.ts` (chamado a partir de `src/index.ts`):

| Worker | Agendamento (cron) | Fuso | Responsabilidade |
|--------|---------------------|------|-------------------|
| **marketData** | `30 18 * * 1-5` (seg–sex 18:30) | `CRON_TZ` | Alpha Vantage: **AAPL**, **COPX**, **XLE** → `AssetPriceHistory`; FRED **DFF** + **DCOILWTICO** → `MacroIndicator`. HTTP **429** apenas gera log. |
| **newsAnalysis** | `0 8 * * *` (todo dia 08:00) | `CRON_TZ` | NewsAPI (`everything`) com keywords em `NEWS_ANALYSIS_QUERY`; heurística `analyzeSentimentAndRisk` → nota 1–10 em `MacroIndicator` (`CODECHROMA_GEO_RISK_NLP`) + `NewsRecord`. |

- **Mock Alpha Vantage:** `ALPHA_VANTAGE_USE_MOCK=true` (ou ausência de chave, com aviso no log) usa fechamentos simulados sem rede.
- **Política:** o frontend **não** chama APIs externas; apenas este backend ingere e persiste.

Desligar os crons: `INGESTION_CRON_ENABLED=false`.

---

## Autenticação

O backend exige `SUPABASE_URL` e `SUPABASE_ANON_KEY` no ambiente (validação de JWT onde aplicável). Os endpoints públicos documentados podem evoluir para rotas protegidas; em exposição ampla, use API Gateway, WAF ou reverse proxy com rate limit.

---

## Estrutura de pastas (principal)

```
src/
  app.ts                 # Express, pino-http, rotas, error handler
  index.ts               # Bootstrap + workers
  workers.ts             # Registro node-cron (mercado + notícias)
  config/                # env, apiVersion, ingestion
  controllers/
  middleware/            # validação query, headers versão, erros
  routes/
    index.ts            # `/api/v1` (agregador)
    v1/                 # dashboard + simulation routers
  services/
    monteCarloService.ts # Simulação Monte Carlo (percentis)
    simulationEngineService.ts  # Stress test MVP (sliders)
    ingestion/           # marketDataWorker, newsAnalysisWorker, types
    *.test.ts            # Testes Vitest colocados junto aos serviços
  validation/            # schemas Zod
  lib/                   # logger, prisma, http helpers
.github/workflows/      # CI, deploy, ingestão agendada
prisma/
  schema.prisma
  migrations/
```

---

## Licença / uso

Projeto privado MVP Code Chroma — ajuste conforme a política da sua organização.
