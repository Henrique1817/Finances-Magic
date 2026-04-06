import { Prisma } from "@prisma/client";
import axios, { isAxiosError } from "axios";
import {
  GEO_RISK_MACRO_NAME,
  GEO_RISK_SERIES_ID,
  NEWS_ANALYSIS_PAGE_SIZE,
  NEWS_ANALYSIS_QUERIES,
  NEWS_ANALYSIS_QUERY_DELAY_MS,
} from "../../config/ingestion";
import { env } from "../../config/env";
import { runWithIngestionRunLog } from "../../lib/ingestionRun";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import { sleep } from "../../lib/sleep";
import type { GeopoliticalRiskResult, NewsArticleForAnalysis } from "./types";

const log = logger.child({ worker: "newsAnalysis" });

const NEWS_EVERYTHING_URL = "https://newsapi.org/v2/everything";

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
    publishedAt: a.publishedAt ? new Date(a.publishedAt) : new Date(),
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

async function persistNewArticles(articles: NewsArticleForAnalysis[]): Promise<number> {
  let n = 0;
  for (const a of articles) {
    const href = a.url?.trim();
    if (!href) continue;

    const summary = a.description ? a.description.slice(0, 2000) : null;

    await prisma.newsRecord.upsert({
      where: { url: href },
      create: {
        title: a.title,
        source: a.sourceName,
        publishedAt: a.publishedAt,
        url: href,
        description: a.description,
        externalId: a.externalId,
        summary,
        fetchedAt: new Date(),
      },
      update: {
        title: a.title,
        source: a.sourceName,
        publishedAt: a.publishedAt,
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
    logRateLimit("newsApi", status);
    return [];
  }

  if (status >= 400 || data.status === "error") {
    log.error({ httpStatus: status, message: data.message, code: data.code }, "NewsAPI erro");
    return [];
  }

  const rawList = data.articles ?? [];
  const out: NewsArticleForAnalysis[] = [];
  for (const r of rawList) {
    const mapped = toAnalysisArticle(r);
    if (mapped) out.push(mapped);
  }
  return out;
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
      for (let i = 0; i < NEWS_ANALYSIS_QUERIES.length; i++) {
        const q = NEWS_ANALYSIS_QUERIES[i]!;
        const batch = await fetchNewsForQuery(q, fromStr);
        for (const a of batch) {
          const key = a.url?.trim() ?? `${a.title}\0${a.publishedAt.toISOString()}`;
          if (!merged.has(key)) merged.set(key, a);
        }
        if (i < NEWS_ANALYSIS_QUERIES.length - 1) {
          await sleep(NEWS_ANALYSIS_QUERY_DELAY_MS);
        }
      }

      const forAnalysis = [...merged.values()];
      const risk = analyzeSentimentAndRisk(forAnalysis);
      log.info({ score: risk.score, summary: risk.summary }, "Resultado heurístico de risco");

      await persistGeopoliticalRisk(risk);
      const rows = await persistNewArticles(forAnalysis);
      log.info("Fim newsAnalysisWorker");
      return rows;
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 429) {
        logRateLimit("newsApi", 429);
        return 0;
      }
      log.error({ err }, "Falha newsAnalysisWorker");
      throw err;
    }
  });
}
