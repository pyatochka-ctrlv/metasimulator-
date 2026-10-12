import type {
  AdAccount,
  Ad,
  AdSet,
  Campaign,
  CaseStudy,
  ConversionLocation,
  MissionAnswer,
  Objective,
  PerformanceGoal,
  SkillDimension,
} from "@/domain/types";
import { aggregate, type ReportedMetrics } from "@/simulation/reporting";
import { utmPresent } from "@/simulation/tracking";
import { hasBlockingErrors, validateCampaignTree } from "@/simulation/validation";

/**
 * Будівельні блоки рубрик оцінювання. Кожна перевірка повертає 0..1 (частковий бал можливий).
 * Перевірки дивляться на РЕАЛЬНИЙ стан навчального акаунта (процес), а не лише на відповіді.
 */

export interface EvalContext {
  account: AdAccount;
  answers: Record<string, MissionAnswer>;
  caseStudy: CaseStudy;
}

export interface RubricItem {
  id: string;
  dimension: SkillDimension;
  weight: number;
  /** Критична помилка, якщо не виконано. */
  critical?: boolean;
  label: string;
  pass: string;
  fail: string;
  check: (ctx: EvalContext) => number;
}

export const userCampaigns = (a: AdAccount): Campaign[] => a.campaigns.filter((c) => c.seq > a.seededSeq);
export const publishedUserCampaigns = (a: AdAccount): Campaign[] => userCampaigns(a).filter((c) => c.status !== "draft");
export const adSetsOf = (a: AdAccount, campaignIds: string[]): AdSet[] => a.adSets.filter((s) => campaignIds.includes(s.campaignId));
export const adsOf = (a: AdAccount, adSetIds: string[]): Ad[] => a.ads.filter((x) => adSetIds.includes(x.adSetId));
export const userAdSets = (a: AdAccount): AdSet[] => a.adSets.filter((s) => s.seq > a.seededSeq);
export const userAds = (a: AdAccount): Ad[] => a.ads.filter((x) => x.seq > a.seededSeq);

/** Звіт за кампаніями користувача (або за всіма, якщо all=true) у діапазоні днів. */
export function reportFor(a: AdAccount, opts: { campaignIds?: string[]; fromDay?: number; toDay?: number } = {}): ReportedMetrics {
  const rows = a.metrics.filter(
    (m) =>
      (!opts.campaignIds || opts.campaignIds.includes(m.campaignId)) &&
      (opts.fromDay === undefined || m.day >= opts.fromDay) &&
      (opts.toDay === undefined || m.day <= opts.toDay),
  );
  return aggregate(a, rows);
}

/** Стан акаунта «на момент передачі»: затримані конверсії, що з'явились пізніше, не враховуються. */
export const asOfHandover = (a: AdAccount): AdAccount => ({ ...a, simDay: a.handoverDay });

export function userReport(a: AdAccount): ReportedMetrics {
  return reportFor(a, { campaignIds: publishedUserCampaigns(a).map((c) => c.id) });
}

/** Скільки днів доставки мали кампанії користувача. */
export function userDeliveryDays(a: AdAccount): number {
  const ids = new Set(publishedUserCampaigns(a).map((c) => c.id));
  return new Set(a.metrics.filter((m) => ids.has(m.campaignId) && m.impressions > 0).map((m) => m.day)).size;
}

export const anyPublished = (pred: (c: Campaign, a: AdAccount) => boolean) => (ctx: EvalContext) =>
  publishedUserCampaigns(ctx.account).some((c) => pred(c, ctx.account)) ? 1 : 0;

export const objectiveIn = (objs: Objective[]) => anyPublished((c) => objs.includes(c.objective));

export const adSetMatches = (pred: (s: AdSet, a: AdAccount) => boolean) => (ctx: EvalContext) => {
  const ids = publishedUserCampaigns(ctx.account).map((c) => c.id);
  const sets = adSetsOf(ctx.account, ids);
  if (!sets.length) return 0;
  return sets.filter((s) => pred(s, ctx.account)).length / sets.length;
};

export const goalIn = (goals: PerformanceGoal[]) => adSetMatches((s) => goals.includes(s.performanceGoal));
export const locationIn = (locs: ConversionLocation[]) => adSetMatches((s) => locs.includes(s.conversionLocation));
export const eventIn = (events: string[]) => adSetMatches((s) => Boolean(s.optimizationEvent && events.includes(s.optimizationEvent)));

export const allUserAds = (pred: (ad: Ad, a: AdAccount) => boolean) => (ctx: EvalContext) => {
  const ids = publishedUserCampaigns(ctx.account).map((c) => c.id);
  const ads = ctx.account.ads.filter((x) => ids.includes(x.campaignId));
  if (!ads.length) return 0;
  return ads.filter((ad) => pred(ad, ctx.account)).length / ads.length;
};

export const utmOnAllAds = allUserAds((ad) => utmPresent(ad.creative.urlParameters, ad.creative.destinationUrl));
export const noRejectedAds = (ctx: EvalContext) => {
  const ids = publishedUserCampaigns(ctx.account).map((c) => c.id);
  const ads = ctx.account.ads.filter((x) => ids.includes(x.campaignId));
  return ads.length && ads.every((a) => a.status !== "rejected") ? 1 : 0;
};

export const minAdsPerAdSet = (n: number) => adSetMatches((s, a) => a.ads.filter((x) => x.adSetId === s.id).length >= n);

export const distinctMediaAtLeast = (n: number) => (ctx: EvalContext) => {
  const ids = publishedUserCampaigns(ctx.account).map((c) => c.id);
  const keys = new Set(ctx.account.ads.filter((x) => ids.includes(x.campaignId)).map((x) => x.creative.media[0]?.libraryKey ?? x.creative.media[0]?.id ?? x.id));
  return Math.min(1, keys.size / n);
};

export const hasVerticalAsset = allUserAds((ad) => ad.creative.media[0]?.aspectRatio === "9:16" || Boolean(ad.creative.verticalMedia));

/** Денний бюджет кампаній користувача не перевищує ліміт. */
export const dailyBudgetAtMost = (limit: number) => (ctx: EvalContext) => {
  const camps = publishedUserCampaigns(ctx.account);
  if (!camps.length) return 0;
  let daily = 0;
  for (const c of camps) {
    if (c.status === "paused") continue;
    if (c.budgetLevel === "campaign") daily += c.budgetType === "daily" ? c.budgetAmount : c.budgetAmount / 14;
    else
      for (const s of ctx.account.adSets.filter((x) => x.campaignId === c.id && x.status !== "paused"))
        daily += s.budgetType === "daily" ? s.budgetAmount : s.budgetAmount / Math.max(1, (s.endDay ?? s.startDay + 14) - s.startDay + 1);
  }
  return daily <= limit * 1.001 ? 1 : Math.max(0, 1 - (daily - limit) / limit);
};

export const deliveryDaysAtLeast = (n: number) => (ctx: EvalContext) => Math.min(1, userDeliveryDays(ctx.account) / n);

/** Опубліковані кампанії не мають блокуючих помилок валідації (на момент здачі). */
export const cleanSetup = (ctx: EvalContext) => {
  const camps = publishedUserCampaigns(ctx.account);
  if (!camps.length) return 0;
  return camps.every((c) => !hasBlockingErrors(validateCampaignTree(ctx.account, c.id))) ? 1 : 0.4;
};

/** Частковий бал за досягнення KPI: 1 якщо досягнуто, лінійно спадає до 0 при відхиленні на tolerance. */
export function kpiScore(actual: number | null, target: number, direction: "max" | "min", tolerance = 0.5): number {
  if (actual === null || !Number.isFinite(actual)) return 0;
  if (direction === "max") {
    if (actual <= target) return 1;
    return Math.max(0, 1 - (actual - target) / (target * tolerance));
  }
  if (actual >= target) return 1;
  return Math.max(0, 1 - (target - actual) / (target * tolerance));
}

/** Кількість суттєвих редагувань користувачем. */
export function significantUserEdits(a: AdAccount, fromDay = 0): number {
  return a.changeLog.filter((e) => e.actor === "user" && e.significantEdit && e.simDay >= fromDay).length;
}

// ───────────── Відповіді та аргументація ─────────────

export function choiceScore(answer: MissionAnswer | undefined, correct: string[], mode: "single" | "multi"): number {
  const sel = answer?.selected ?? [];
  if (!sel.length) return 0;
  if (mode === "single") return correct.includes(sel[0]) ? 1 : 0;
  const tp = sel.filter((s) => correct.includes(s)).length;
  const fp = sel.filter((s) => !correct.includes(s)).length;
  return Math.max(0, (tp - fp * 0.75) / correct.length);
}

/** Евристична оцінка аргументації: довжина + покриття ключових понять (групи синонімів). */
export function reasoningScore(text: string | undefined, keywordGroups: string[][], minLength = 120): number {
  const t = (text ?? "").toLowerCase();
  if (t.trim().length < 25) return 0;
  const lengthPart = Math.min(1, t.trim().length / minLength) * 0.35;
  if (!keywordGroups.length) return Math.min(1, lengthPart / 0.35);
  const hits = keywordGroups.filter((g) => g.some((k) => t.includes(k.toLowerCase()))).length;
  return Math.min(1, lengthPart + 0.65 * (hits / keywordGroups.length));
}

export function numericScore(value: number | undefined, expected: number, relTolerance = 0.05): number {
  if (value === undefined || !Number.isFinite(value) || !Number.isFinite(expected)) return 0;
  const diff = Math.abs(value - expected) / Math.max(1e-9, Math.abs(expected));
  if (diff <= relTolerance) return 1;
  if (diff <= relTolerance * 3) return 0.5;
  return 0;
}

export const caseStudyText = (cs: CaseStudy) => Object.values(cs).join("\n");
