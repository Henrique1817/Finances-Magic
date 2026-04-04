import { Prisma } from "@prisma/client";
import axios, { isAxiosError } from "axios";
import {
  GEO_RISK_MACRO_NAME,
  GEO_RISK_SERIES_ID,
  NEWS_ANALYSIS_PAGE_SIZE,
  NEWS_ANALYSIS_QUERY,
} from "../../config/ingestion";
import { env } from "../../config/env";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
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

/**
 * Análise de sentimento / risco **heurística** (MVP).
 *
 * ---
 * **Integrações futuras (IA):** substituir o corpo desta função por:
 * - Chamada à **Google Gemini API** ou **Vertex AI** com o array de manchetes agregadas em um único prompt de classificação (escala 1–10 + justificativa estruturada JSON); ou
 * - **Hugging Face Inference API** com modelo multilíngue de sentimento / NLI (ex.: `cardiffnlp/twitter-xlm-roberta-base-sentiment` ou fine-tune próprio); ou
 * - Pipeline local com **@xenova/transformers** (ONNX) para embeddings + regressão linear treinada.
 *
 * Mantenha a assinatura `NewsArticleForAnalysis[]` → `GeopoliticalRiskResult` para o worker continuar igual.
 * ---
 */
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
  source?: { name?: string | null };
  publishedAt?: string | null;
};

function toAnalysisArticle(a: NewsApiArticle): NewsArticleForAnalysis | null {
  const title = a.title?.trim();
  if (!title) return null;
  return {
    title,
    description: a.description?.trim() ?? null,
    url: a.url?.trim() ?? null,
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

async function persistNewArticles(articles: NewsArticleForAnalysis[]): Promise<void> {
  for (const a of articles) {
    const href = a.url?.trim() ?? null;
    if (href) {
      const exists = await prisma.newsRecord.findFirst({ where: { url: href } });
      if (exists) continue;
    }
    await prisma.newsRecord.create({
      data: {
        title: a.title,
        source: a.sourceName,
        url: href,
        description: a.description,
        publishedAt: a.publishedAt,
      },
    });
  }
}

/**
 * Coleta NewsAPI (keywords), analisa risco, grava `MacroIndicator` + `NewsRecord`.
 */
export async function runNewsAnalysisIngestion(): Promise<void> {
  log.info("Início newsAnalysisWorker");

  const key = env.newsApiKey;
  if (!key) {
    log.warn("NEWS_API_KEY ausente — worker de notícias ignorado");
    return;
  }

  const from = new Date();
  from.setDate(from.getDate() - 2);
  const fromStr = from.toISOString().slice(0, 10);

  try {
    const { data, status } = await axios.get<{
      status?: string;
      code?: string;
      message?: string;
      articles?: NewsApiArticle[];
    }>(NEWS_EVERYTHING_URL, {
      params: {
        q: NEWS_ANALYSIS_QUERY,
        sortBy: "publishedAt",
        pageSize: NEWS_ANALYSIS_PAGE_SIZE,
        from: fromStr,
        apiKey: key,
      },
      validateStatus: () => true,
    });

    if (status === 429) {
      logRateLimit("newsApi", status);
      return;
    }

    if (status >= 400 || data.status === "error") {
      log.error({ httpStatus: status, message: data.message, code: data.code }, "NewsAPI erro");
      return;
    }

    const rawList = data.articles ?? [];
    const forAnalysis: NewsArticleForAnalysis[] = [];
    for (const r of rawList) {
      const mapped = toAnalysisArticle(r);
      if (mapped) forAnalysis.push(mapped);
    }

    const risk = analyzeSentimentAndRisk(forAnalysis);
    log.info({ score: risk.score, summary: risk.summary }, "Resultado heurístico de risco");

    await persistGeopoliticalRisk(risk);
    await persistNewArticles(forAnalysis);
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 429) {
      logRateLimit("newsApi", 429);
      return;
    }
    log.error({ err }, "Falha newsAnalysisWorker");
  }

  log.info("Fim newsAnalysisWorker");
}
