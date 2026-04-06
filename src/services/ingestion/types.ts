/** Artigo normalizado para análise heurística / futura troca por modelo de IA. */
export type NewsArticleForAnalysis = {
  title: string;
  description: string | null;
  url: string | null;
  /** Identificador externo quando disponível (ex.: `source.id` da NewsAPI). */
  externalId: string | null;
  sourceName: string;
  publishedAt: Date;
};

export type GeopoliticalRiskResult = {
  /** Escala 1 (baixo) a 10 (alto). */
  score: number;
  /** Resumo opcional para logs / auditoria. */
  summary: string;
};
