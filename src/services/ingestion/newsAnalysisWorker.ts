import { Prisma } from "@prisma/client";
import axios, { isAxiosError } from "axios";
import {
  GEO_RISK_MACRO_NAME,
  GEO_RISK_SERIES_ID,
  NEWS_ANALYSIS_PAGE_SIZE,
  NEWS_ANALYSIS_QUERIES,
  NEWS_ANALYSIS_QUERY_DELAY_MS,
  NEWS_ANALYSIS_REGIONAL_QUERIES,
} from "../../config/ingestion";
import { env } from "../../config/env";
import { runWithIngestionRunLog } from "../../lib/ingestionRun";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { sleep } from "../../lib/sleep";
import type { GeopoliticalRiskResult, NewsArticleForAnalysis } from "./types";
import {
  markProvider429,
  recordFallbackEvent,
  recordIngestionItemStatus,
  withRetry,
} from "./quotaPlanner";

const log = logger.child({ worker: "newsAnalysis" });

const NEWS_EVERYTHING_URL = "https://newsapi.org/v2/everything";
const GDELT_DOC_URL = "https://api.gdeltproject.org/api/v2/doc/doc";
const GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss/search";

/** Palavras que elevam o risco geopolítico (heurística). */
const NEGATIVE_SIGNALS = [
  "crisis",
  "attack",
  "war",
  "invasion",
  "sanction",
  "sanctions",
  "embargo",
  "recession",
  "crash",
  "terror",
  "missile",
  "military",
  "strike",
  "conflict",
  "hostage",
  "nuclear",
] as const;

/** Palavras que tendem a reduzir o risco percebido (heurística). */
const POSITIVE_SIGNALS = [
  "growth",
  "agreement",
  "peace",
  "deal",
  "cooperation",
  "easing",
  "stable",
  "stability",
  "ceasefire",
  "diplomatic",
  "recovery",
] as const;

const NEWS_TOPIC_SIGNALS: Record<string, readonly string[]> = {
  ENERGY_RISK: ["oil", "gas", "opec", "pipeline", "energy", "petróleo", "energia"],
  RATE_RISK: ["interest", "fed", "ecb", "rates", "juros", "inflation", "cpi"],
  SUPPLY_CHAIN: ["supply chain", "shipping", "port", "freight", "logistics", "semiconductor"],
};

function clampRisk(n: number): number {
  return Math.min(10, Math.max(1, Math.round(n * 10) / 10));
}

function countMatches(text: string, words: readonly string[]): number {
  const t = text.toLowerCase();
  let n = 0;
  for (const w of words) {
    if (t.includes(w)) n += 1;
  }
  return n;
}

export function analyzeSentimentAndRisk(articles: NewsArticleForAnalysis[]): GeopoliticalRiskResult {
  if (articles.length === 0) {
    return {
      score: 5,
      summary: "Sem artigos: risco neutro (5/10).",
    };
  }

  const perArticleScores: number[] = [];

  for (const a of articles) {
    const blob = `${a.title} ${a.description ?? ""}`.toLowerCase();
    const neg = countMatches(blob, NEGATIVE_SIGNALS);
    const pos = countMatches(blob, POSITIVE_SIGNALS);
    const raw = 5 + neg * 0.55 - pos * 0.45;
    perArticleScores.push(clampRisk(raw));
  }

  const avg = perArticleScores.reduce((s, v) => s + v, 0) / perArticleScores.length;
  const score = clampRisk(avg);

  return {
    score,
    summary: `Média sobre ${articles.length} artigo(s); sinais neg/pos contados por palavra-chave (heurística).`,
  };
}

type NewsApiArticle = {
  title: string | null;
  description?: string | null;
  url?: string | null;
  source?: { id?: string | null; name?: string | null };
  publishedAt?: string | null;
};

function toValidDate(value: unknown, fallback = new Date()): Date {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? fallback : value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
  }
  return fallback;
}

function toAnalysisArticle(a: NewsApiArticle): NewsArticleForAnalysis | null {
  const title = a.title?.trim();
  if (!title) return null;
  const sourceId = a.source?.id?.trim();
  return {
    title,
    description: a.description?.trim() ?? null,
    url: a.url?.trim() ?? null,
    externalId: sourceId || null,
    sourceName: a.source?.name?.trim() || "desconhecida",
    publishedAt: toValidDate(a.publishedAt),
  };
}

function logRateLimit(context: string, status?: number): void {
  log.warn({ context, status }, "Rate limit (HTTP 429) — worker de notícias encerrado sem throw");
}

async function persistGeopoliticalRisk(result: GeopoliticalRiskResult): Promise<void> {
  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);
  const value = new Prisma.Decimal(result.score);

  await prisma.macroIndicator.upsert({
    where: { seriesId_date: { seriesId: GEO_RISK_SERIES_ID, date: today } },
    create: {
      seriesId: GEO_RISK_SERIES_ID,
      name: GEO_RISK_MACRO_NAME,
      date: today,
      value,
    },
    update: { value, name: GEO_RISK_MACRO_NAME },
  });

  log.info({ score: result.score, seriesId: GEO_RISK_SERIES_ID }, "Risco geopolítico (NLP heurístico) salvo em MacroIndicator");
}

async function persistNewsTopicScores(articles: NewsArticleForAnalysis[]): Promise<void> {
  if (articles.length === 0) return;
  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);
  for (const [topic, signals] of Object.entries(NEWS_TOPIC_SIGNALS)) {
    let score = 0;
    for (const a of articles) {
      const blob = `${a.title} ${a.description ?? ""}`.toLowerCase();
      score += countMatches(blob, signals);
    }
    const normalized = clampRisk(1 + Math.min(9, score / Math.max(articles.length, 1)));
    const seriesId = `CODECHROMA_${topic}`;
    await prisma.macroIndicator.upsert({
      where: { seriesId_date: { seriesId, date: today } },
      create: {
        seriesId,
        name: `Score temático de notícias: ${topic}`,
        date: today,
        value: new Prisma.Decimal(normalized),
      },
      update: { value: new Prisma.Decimal(normalized) },
    });
  }
}

async function persistNewArticles(articles: NewsArticleForAnalysis[]): Promise<number> {
  let n = 0;
  for (const a of articles) {
    const href = a.url?.trim();
    if (!href) continue;
    const publishedAt = toValidDate(a.publishedAt);

    const summary = a.description ? a.description.slice(0, 2000) : null;

    await prisma.newsRecord.upsert({
      where: { url: href },
      create: {
        title: a.title,
        source: a.sourceName,
        publishedAt,
        url: href,
        description: a.description,
        externalId: a.externalId,
        summary,
        fetchedAt: new Date(),
      },
      update: {
        title: a.title,
        source: a.sourceName,
        publishedAt,
        description: a.description,
        externalId: a.externalId ?? undefined,
        summary: summary ?? undefined,
        fetchedAt: new Date(),
      },
    });
    n += 1;
  }
  return n;
}

async function fetchNewsForQuery(q: string, fromStr: string): Promise<NewsArticleForAnalysis[]> {
  const key = env.newsApiKey;
  if (!key) return [];

  const payload = await withRetry("newsApi", async () => {
    const { data, status } = await axios.get<{
    status?: string;
    code?: string;
    message?: string;
    articles?: NewsApiArticle[];
  }>(NEWS_EVERYTHING_URL, {
    params: {
      q,
      sortBy: "publishedAt",
      pageSize: NEWS_ANALYSIS_PAGE_SIZE,
      from: fromStr,
      apiKey: key,
    },
    validateStatus: () => true,
  });

    if (status === 429) {
      markProvider429("newsApi");
      throw new Error("newsapi_429");
    }
    if (status >= 400 || data.status === "error") {
      throw new Error(`newsapi_http_${status}_${data.code ?? "unknown"}`);
    }
    return data;
  });
  if (!payload) return [];

  const rawList = payload.articles ?? [];
  const out: NewsArticleForAnalysis[] = [];
  for (const r of rawList) {
    const mapped = toAnalysisArticle(r);
    if (mapped) out.push(mapped);
  }
  return out;
}

type GdeltArticle = {
  title?: string;
  seendate?: string;
  sourcecountry?: string;
  domain?: string;
  url?: string;
};

async function fetchGdeltForQuery(q: string): Promise<NewsArticleForAnalysis[]> {
  const payload = await withRetry("gdelt", async () => {
    const { data, status } = await axios.get<{ articles?: GdeltArticle[] }>(GDELT_DOC_URL, {
      params: {
        query: q,
        mode: "ArtList",
        maxrecords: Math.min(NEWS_ANALYSIS_PAGE_SIZE, 50),
        sort: "DateDesc",
        format: "json",
      },
      validateStatus: () => true,
    });
    if (status === 429) {
      markProvider429("gdelt");
      throw new Error("gdelt_429");
    }
    if (status >= 400) {
      throw new Error(`gdelt_http_${status}`);
    }
    return data;
  });
  if (!payload?.articles?.length) return [];
  const rows: NewsArticleForAnalysis[] = [];
  for (const a of payload.articles) {
    const title = a.title?.trim();
    const url = a.url?.trim();
    if (!title || !url) continue;
    rows.push({
      title,
      description: null,
      url,
      externalId: a.domain?.trim() ?? null,
      sourceName: a.domain?.trim() || "gdelt",
      publishedAt: toValidDate(a.seendate),
    });
  }
  return rows;
}

function decodeXmlEntities(raw: string): string {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .trim();
}

function firstTagValue(xmlChunk: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i").exec(xmlChunk);
  if (!match?.[1]) return null;
  return decodeXmlEntities(match[1]);
}

async function fetchGoogleNewsRssForQuery(q: string): Promise<NewsArticleForAnalysis[]> {
  const payload = await withRetry("googleNewsRss", async () => {
    const { data, status } = await axios.get<string>(GOOGLE_NEWS_RSS_URL, {
      params: {
        q,
        hl: "en-US",
        gl: "US",
        ceid: "US:en",
      },
      responseType: "text",
      transformResponse: [(v) => v as string],
      validateStatus: () => true,
    });
    if (status === 429) {
      markProvider429("googleNewsRss");
      throw new Error("google_news_rss_429");
    }
    if (status >= 400) throw new Error(`google_news_rss_http_${status}`);
    return data;
  });
  if (!payload) return [];

  const itemMatches = payload.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  const rows: NewsArticleForAnalysis[] = [];
  for (const item of itemMatches.slice(0, NEWS_ANALYSIS_PAGE_SIZE)) {
    const title = firstTagValue(item, "title");
    const url = firstTagValue(item, "link");
    if (!title || !url) continue;
    const pubDateRaw = firstTagValue(item, "pubDate");
    const publishedAt = toValidDate(pubDateRaw);
    const sourceName = firstTagValue(item, "source") || "google-news-rss";
    rows.push({
      title,
      description: null,
      url,
      externalId: "google-news-rss",
      sourceName,
      publishedAt,
    });
  }
  return rows;
}

/**
 * Coleta NewsAPI (várias queries), analisa risco, grava `MacroIndicator` + `NewsRecord`.
 */
export async function runNewsAnalysisIngestion(): Promise<void> {
  await runWithIngestionRunLog("newsAnalysis", async () => {
    log.info("Início newsAnalysisWorker");

    if (!env.newsApiKey) {
      log.warn("NEWS_API_KEY ausente — worker de notícias ignorado");
      return 0;
    }

    const from = new Date();
    from.setDate(from.getDate() - 2);
    const fromStr = from.toISOString().slice(0, 10);

    const merged = new Map<string, NewsArticleForAnalysis>();

    try {
      const mergedQueries = [
        ...NEWS_ANALYSIS_QUERIES.map((q) => ({ q })),
        ...NEWS_ANALYSIS_REGIONAL_QUERIES.map((x) => ({ q: x.q })),
      ];
      for (let i = 0; i < mergedQueries.length; i++) {
        const q = mergedQueries[i]!.q;
        const providers = [
          { name: "newsApi" as const, fetch: () => fetchNewsForQuery(q, fromStr) },
          { name: "gdelt" as const, fetch: () => fetchGdeltForQuery(q) },
          { name: "googleNewsRss" as const, fetch: () => fetchGoogleNewsRssForQuery(q) },
        ];

        let provider: "newsApi" | "gdelt" | "googleNewsRss" = "newsApi";
        let batch: NewsArticleForAnalysis[] = [];

        for (let p = 0; p < providers.length; p++) {
          const current = providers[p]!;
          batch = await current.fetch();
          if (batch.length > 0) {
            provider = current.name;
            break;
          }
          if (p < providers.length - 1) {
            const next = providers[p + 1]!;
            await recordFallbackEvent({
              pipeline: "newsAnalysis",
              fromProvider: current.name,
              toProvider: next.name,
              reason: "primary_empty_or_quota",
              context: q.slice(0, 120),
            });
          }
        }

        for (const a of batch) {
          const key = a.url?.trim() ?? `${a.title}\0${toValidDate(a.publishedAt).toISOString()}`;
          if (!merged.has(key)) merged.set(key, a);
        }
        await recordIngestionItemStatus({
          jobName: "newsAnalysis",
          provider,
          itemType: "news_query",
          itemKey: q.slice(0, 180),
          status: batch.length > 0 ? "success" : "empty",
          rowsUpserted: batch.length,
        });
        if (i < mergedQueries.length - 1) {
          await sleep(NEWS_ANALYSIS_QUERY_DELAY_MS);
        }
      }

      const forAnalysis = [...merged.values()];
      const risk = analyzeSentimentAndRisk(forAnalysis);
      log.info({ score: risk.score, summary: risk.summary }, "Resultado heurístico de risco");

      await persistGeopoliticalRisk(risk);
      await persistNewsTopicScores(forAnalysis);
      const rows = await persistNewArticles(forAnalysis);
      log.info("Fim newsAnalysisWorker");
      return rows;
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 429) {
        markProvider429("newsApi");
        logRateLimit("newsApi", 429);
        return 0;
      }
      log.error({ err }, "Falha newsAnalysisWorker");
      throw err;
    }
  });
}
