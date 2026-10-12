import type { KnowledgeArticle } from "@/domain/types";
import { FOUNDATION_ARTICLES } from "./articles-foundations";
import { DELIVERY_ARTICLES } from "./articles-delivery";
import { MEASUREMENT_ARTICLES } from "./articles-measurement";
import { STRATEGY_ARTICLES } from "./articles-strategy";
import { POLICY_ARTICLES } from "./articles-policy";

export const KB_CATEGORIES = [
  "Основи Meta Ads",
  "Business Portfolio та доступи",
  "Campaign Objectives",
  "Campaign, Ad Set та Ad",
  "Advantage+ і автоматизація",
  "Бюджети та стратегії ставок",
  "Аудиторії",
  "Placements",
  "Креативна стратегія",
  "Pixel та Conversions API",
  "Events Manager",
  "Attribution",
  "GA4 та UTM",
  "Аналітика",
  "A/B-тестування",
  "Оптимізація кампаній",
  "Лідогенерація",
  "E-commerce",
  "Реклама онлайн-курсів та EdTech",
  "Advertising Standards та приватність",
  "Діагностика проблем",
  "Звітування клієнту",
] as const;

export const ARTICLES: KnowledgeArticle[] = [...FOUNDATION_ARTICLES, ...DELIVERY_ARTICLES, ...MEASUREMENT_ARTICLES, ...STRATEGY_ARTICLES, ...POLICY_ARTICLES];

export const getArticle = (slug: string) => ARTICLES.find((a) => a.slug === slug);

export const STATUS_LABEL: Record<KnowledgeArticle["status"], string> = {
  verified: "Verified",
  partially_verified: "Partially Verified",
  needs_review: "Needs Review",
  deprecated: "Deprecated",
};

/** Простий повнотекстовий пошук по статтях (назва, резюме, визначення, текст). */
export function searchArticles(query: string): KnowledgeArticle[] {
  const q = query.trim().toLowerCase();
  if (!q) return ARTICLES;
  const terms = q.split(/\s+/);
  return ARTICLES.map((a) => {
    const hay = `${a.title} ${a.summary} ${a.definition} ${a.body.join(" ")} ${a.category}`.toLowerCase();
    const title = a.title.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (title.includes(t)) score += 5;
      if (hay.includes(t)) score += 1;
      else return { a, score: -1 };
    }
    return { a, score };
  })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .map((x) => x.a);
}
