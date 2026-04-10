# Code Chroma — Backend (Simulador de Cenários)

API REST em **Node.js + TypeScript + Express** para o MVP da Code Chroma: ingestão diária de preços (Alpha Vantage), indicadores macro (FRED), notícias (NewsAPI), clima (Open-Meteo, sem chave), persistência em **PostgreSQL** via **Prisma**, simulador de cenários no frontend e **cenários em linguagem natural** com Google Gemini (`POST /api/v1/ai/scenario`).

**Versão da API (contrato JSON):** `1.0.0` (campo `apiVersion` nas respostas JSON; ver [Versionamento](#versionamento)).

---

## Requisitos

- Node.js **20+**
- PostgreSQL **14+** (recomendado 16)
- Chaves opcionais: ingestão Alpha Vantage, FRED, NewsAPI; **Gemini** para cenários IA; clima Open-Meteo não exige chave

---

## Configuração rápida

1. Clone/copie o projeto e instale dependências:

   ```bash
   npm install
   ```

2. Copie `.env.example` para `.env` e preencha `DATABASE_URL` e `DIRECT_URL` (em Postgres local pode ser a mesma URL nas duas; no Supabase vê secção [Supabase (Postgres)](#supabase-postgres) abaixo).

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
| `DATABASE_URL` | Sim | URL PostgreSQL para a app (no Supabase: preferir *Transaction pooler* `:6543` com `?pgbouncer=true`) |
| `DIRECT_URL` | Sim | URL para migrações Prisma: **Session pooler** (`*.pooler.supabase.com:5432`) no Railway/IPv4; **Direct** (`db.*.supabase.co:5432`) se IPv6 disponível; em Postgres local pode ser igual a `DATABASE_URL` |
| `SUPABASE_URL` | Sim | URL do projeto Supabase (validação de JWT no backend) |
| `SUPABASE_ANON_KEY` | Sim | Chave anon/public do Supabase (`auth.getUser`) |
| `PORT` | Não | Porta HTTP (padrão `3000`) |
| `FRONTEND_ORIGINS` | Não | Lista separada por vírgulas para CORS (padrão: `localhost:5173` e `localhost:3000`) |
| `NODE_ENV` | Não | `development` \| `production` |
| `LOG_LEVEL` | Não | Níveis pino: `trace`, `debug`, `info`, `warn`, `error`, `fatal`. Padrão: `debug` em dev, `info` em produção |
| `ALPHA_VANTAGE_API_KEY` | Não | Sem chave, o bloco Alpha Vantage na ingestão é ignorado |
| `FRED_API_KEY` | Não | Idem para FRED |
| `NEWS_API_KEY` | Não | Idem para NewsAPI |
| `GEMINI_API_KEY` | Não | **Cenários IA** (`POST /api/v1/ai/scenario`). Sem valor, esse endpoint responde **503** com mensagem clara |
| `GEMINI_MODEL` | Não | Modelo Gemini (padrão `gemini-2.0-flash`). Ver [modelos Gemini](https://ai.google.dev/gemini-api/docs/models/gemini) |
| `CLIMATE_REGION_KEYS` | Não | Lista separada por vírgulas (ex.: `SP_CAPITAL,BRASILIA`). Chaves válidas em `src/config/ingestion.ts` → `CLIMATE_REGION_PRESETS`. Sem valor, o worker de clima regista aviso e não grava dados |
| `ALPHA_VANTAGE_USE_MOCK` | Não | `true` força fechamentos simulados (sem rede Alpha Vantage) |
| `CRON_TZ` | Não | Fuso IANA do cron (padrão `America/Sao_Paulo`) |
| `INGESTION_CRON_ENABLED` | Não | Defina `false` para desligar o agendamento |

### Onde obter as chaves de API

| Provedor | Variável | Onde criar a chave |
|----------|----------|-------------------|
| **Google (Gemini)** | `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) → *Create API key* (conta Google). A mesma chave serve à API Gemini em `generativelanguage.googleapis.com`. |
| **Alpha Vantage** | `ALPHA_VANTAGE_API_KEY` | [alphavantage.co/support/#api-key](https://www.alphavantage.co/support/#api-key) — registo gratuito; atenção aos limites do plano free (ex.: 25 pedidos/dia). |
| **FRED (Federal Reserve)** | `FRED_API_KEY` | [fred.stlouisfed.org/docs/api/api_key.html](https://fred.stlouisfed.org/docs/api/api_key.html) — criar conta em [fredaccount.stlouisfed.org](https://fredaccount.stlouisfed.org) e pedir API Key. |
| **NewsAPI** | `NEWS_API_KEY` | [newsapi.org/register](https://newsapi.org/register) — plano developer; o endpoint `everything` pode ter restrições em ambiente de produção (ler termos do site). |
| **Supabase** | `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Painel do projeto → **Project Settings** → **API** (URL + chave `anon` / public). |
| **PostgreSQL** | `DATABASE_URL`, `DIRECT_URL` | Supabase → **Database** → *Connection string*; ou credenciais do teu Postgres. |
| **Open-Meteo (clima)** | — | **Não usa chave** — API pública em [open-meteo.com](https://open-meteo.com/). Configura só `CLIMATE_REGION_KEYS` para ativar o worker. |

**Nota:** O frontend **não** precisa de `GEMINI_API_KEY`; a chave fica **só no servidor** (backend). O browser chama `POST /api/v1/ai/scenario` com o JWT Supabase (cada sucesso grava um registo em `scenarios` e devolve `scenarioId` + `title`). A lista e o detalhe sincronizam com **`GET /api/v1/scenarios`** e **`GET /api/v1/scenarios/:scenarioId`** (autenticados); **`DELETE`** remove o registo do utilizador.

### Onde configurar

| Onde | Uso |
|------|-----|
| **Raiz do backend** — ficheiro `.env` | Desenvolvimento local; copie de `.env.example`. Não commite `.env`. |
| **Frontend** — `frontend/.env.local` | `NEXT_PUBLIC_*` (URL da API, Supabase). Ver `frontend/.env.example`. |
| **GitHub Actions** — *Settings → Secrets and variables → Actions* | CI, deploy e workflow de ingestão (ver secção [CI/CD](#cicd-github-actions)). |
| **Railway / Render / Docker** | Painel de variáveis do serviço ou compose — mesmas chaves que em produção no backend. |

### Supabase (Postgres na nuvem)

O Postgres do projeto vive no **Supabase**; a API liga-se com Prisma usando **duas** URLs:

1. No Supabase: **Project Settings** → **Database** → **Connection string** → **URI**.
2. **`DATABASE_URL`** — modo **Transaction** (pooler, porta **6543**). A string deve começar por `postgresql://` ou `postgres://` e, no pooler, incluir normalmente `?pgbouncer=true` (como no snippet do painel).
3. **`DIRECT_URL`** — Para **`prisma migrate deploy`**. Em **Railway** e outros hosts **só IPv4**, a conexão **Direct** (`db.<ref>.supabase.co`) costuma falhar (**P1001**): o Supabase expõe IPv6 nesse host. Usa então o **Session pooler** (Connect → **Session mode**, host `*.pooler.supabase.com`, porta **5432**, utilizador `postgres.<ref>`). Em rede com IPv6 ou em local, **Direct** continua válida.
4. **`SUPABASE_URL`** e **`SUPABASE_ANON_KEY`** — **Project Settings** → **API** (URL do projeto e chave `anon` / public).

No **Railway** (ou outro host), coloca estas quatro variáveis no **mesmo** serviço da API. No **`.env` local**, se usares um Postgres simples (não pooler), podes definir **`DIRECT_URL`** igual a **`DATABASE_URL`**.

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
| `DATABASE_URL` | Workflow de ingestão | URL PostgreSQL (ex.: pooler Supabase). |
| `DIRECT_URL` | Workflow de ingestão | URL direta Postgres (ex.: Supabase `:5432`) — necessária para `prisma generate` com o schema atual. |
| `SUPABASE_URL` | Ingestão | O script carrega `config/env` (via workers); estes valores são **obrigatórios** em runtime. |
| `SUPABASE_ANON_KEY` | Ingestão | Chave anon do mesmo projeto. |
| `ALPHA_VANTAGE_API_KEY` | Ingestão de preços | Opcional; sem valor, o worker usa mock ou ignora conforme lógica existente. |
| `FRED_API_KEY` | Ingestão macro | Opcional. |
| `NEWS_API_KEY` | Ingestão de notícias / NLP | Opcional. |
| `ALPHA_VANTAGE_USE_MOCK` | Ingestão | Opcional; defina o texto `true` se quiser forçar mock na pipeline (útil para não gastar quota). |
| `CLIMATE_REGION_KEYS` | Ingestão de clima | Opcional; ex.: `SP_CAPITAL,BRASILIA`. Sem secret, o worker de clima em CI não grava regiões (comportamento seguro). |
| `GEMINI_API_KEY` | — | **Não** é usado pelo workflow de ingestão; só no **servidor da API** em runtime para `POST /api/v1/ai/scenario`. |

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
| **marketData** | `30 18 * * *` (todo dia 18:30) | `CRON_TZ` | Alpha Vantage (símbolos em `MARKET_WORKER_ASSETS`, ex. **AAPL**, **MSFT**, **SPY**, **COPX**, **XLE**) → `AssetPriceHistory`; FRED (séries em `MARKET_WORKER_FRED_SERIES`, ex. **DFF**, **DCOILWTICO**, **VIXCLS**, **DEXUSEU**, **CPIAUCSL**) → `MacroIndicator`. HTTP **429** apenas gera log. |
| **newsAnalysis** | `0 8 * * *` (todo dia 08:00) | `CRON_TZ` | NewsAPI (`everything`) com várias queries em `NEWS_ANALYSIS_QUERIES`; heurística `analyzeSentimentAndRisk` → nota 1–10 em `MacroIndicator` (`CODECHROMA_GEO_RISK_NLP`) + `NewsRecord` (dedupe por `url`). |
| **climate** | `15 7 * * *` (todo dia 07:15) | `CRON_TZ` | Open-Meteo Archive → `ClimateObservation` para cada chave em `CLIMATE_REGION_KEYS` (coordenadas em `CLIMATE_REGION_PRESETS`). Sem chaves de região, o worker não faz pedidos. |

- **Mock Alpha Vantage:** `ALPHA_VANTAGE_USE_MOCK=true` (ou ausência de chave, com aviso no log) usa fechamentos simulados sem rede.
- **Agente diário de parâmetros (Gemini):** opcional e com cap diário (`DAILY_PARAM_AGENT_GEMINI_DAILY_CAP`) para proteger free tier.
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
  workers.ts             # Registro node-cron (mercado + notícias + clima)
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
