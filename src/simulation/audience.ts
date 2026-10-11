import { COUNTRIES, countryByCode, interestById } from "@/domain/catalog";
import type { AdAccount, AdSet, Audience, AudienceTargeting, Campaign, Vertical } from "@/domain/types";

/**
 * Оцінка потенційної аудиторії та її релевантності.
 * Числа — навчальна модель, не реальні оцінки Meta.
 */

const AGE_BUCKETS: { from: number; to: number; share: number }[] = [
  { from: 18, to: 24, share: 0.14 },
  { from: 25, to: 34, share: 0.23 },
  { from: 35, to: 44, share: 0.22 },
  { from: 45, to: 54, share: 0.18 },
  { from: 55, to: 64, share: 0.13 },
  { from: 65, to: 75, share: 0.1 },
];

/** Частка дорослої аудиторії у віковому діапазоні [min, max] (65 = 65+). */
export function ageShare(min: number, max: number): number {
  const lo = Math.max(18, min);
  const hi = max >= 65 ? 75 : max;
  if (hi < lo) return 0;
  let share = 0;
  for (const b of AGE_BUCKETS) {
    const overlap = Math.min(hi, b.to) - Math.max(lo, b.from) + 1;
    if (overlap > 0) share += (b.share * overlap) / (b.to - b.from + 1);
  }
  return Math.min(1, share);
}

const CORE_AGE: Record<Vertical, [number, number]> = {
  education: [21, 40],
  ecommerce: [20, 45],
  local_services: [20, 50],
  saas: [25, 50],
  mobile_app: [18, 40],
  finance: [25, 55],
};

function languageShare(country: string, languages: string[]): number {
  if (languages.length === 0) return 1;
  const c = COUNTRIES.find((x) => x.code === country);
  let share = 0;
  for (const l of languages) {
    if (c && l === c.language) share += 0.85;
    else if (country === "UA" && l === "ru") share += 0.25;
    else if (l === "en") share += 0.12;
    else if (l === "uk") share += 0.04;
    else share += 0.02;
  }
  return Math.min(1, share);
}

function cityRadiusFactor(radiusKm = 10): number {
  return Math.min(1, 0.12 + 0.88 * (1 - Math.exp(-radiusKm / 9)));
}

export interface AudienceEstimate {
  /** Потенційний розмір аудиторії (люди). */
  size: number;
  lower: number;
  upper: number;
  /** Множник релевантності для CTR/CVR (≈0.6..1.8). */
  relevance: number;
  /** «Теплота» аудиторії 0..1. */
  intent: number;
  /** Відповідність таргетингу ядру ЦА (вік, інтереси) без урахування «теплоти» (≈0.5..1.3). */
  fit: number;
  breadth: "narrow" | "specific" | "broad";
  hasCustomAudiences: boolean;
  hasRetargeting: boolean;
  hasLookalike: boolean;
  usesSensitiveTargeting: boolean;
  notes: string[];
}

/** Географічна база: сума дорослих користувачів у вибраних локаціях. */
export function geoBase(targeting: AudienceTargeting): number {
  let base = 0;
  for (const loc of targeting.locations) {
    const c = countryByCode(loc.country);
    if (!c) continue;
    if (loc.city) {
      const city = c.cities.find((x) => x.name === loc.city);
      const cityBase = (city?.reachableThousands ?? 300) * 1000;
      base += cityBase * cityRadiusFactor(loc.radiusKm);
    } else {
      base += c.reachableMillions * 1_000_000;
    }
  }
  return base;
}

function languageFactor(targeting: AudienceTargeting): number {
  if (targeting.locations.length === 0) return 1;
  const weights = targeting.locations.map((l) => {
    const c = countryByCode(l.country);
    return { w: c ? (l.city ? 0.1 : c.reachableMillions) : 1, share: languageShare(l.country, targeting.languages) };
  });
  const totalW = weights.reduce((a, b) => a + b.w, 0) || 1;
  return weights.reduce((a, b) => a + b.share * b.w, 0) / totalW;
}

export function estimateAudience(
  account: Pick<AdAccount, "audiences" | "vertical">,
  targeting: AudienceTargeting,
  opts: { optimizingForConversions?: boolean; learningProgress?: number } = {},
): AudienceEstimate {
  const notes: string[] = [];
  const geo = geoBase(targeting);
  const lang = languageFactor(targeting);
  const adv = targeting.advantageAudience;

  const ageMin = adv ? Math.max(18, targeting.minAgeControl) : Math.max(18, targeting.ageMin);
  const ageMax = adv ? 65 : targeting.ageMax;
  const ageF = ageShare(ageMin, ageMax);
  const genderF = adv || targeting.genders === "all" ? 1 : targeting.genders === "male" ? 0.48 : 0.52;

  const interests = targeting.detailedTargeting.map(interestById).filter(Boolean) as NonNullable<ReturnType<typeof interestById>>[];
  const interestShare = interests.length ? 1 - interests.reduce((acc, i) => acc * (1 - i.share), 1) : 1;
  const usesSensitiveTargeting = interests.some((i) => i.sensitive);

  const included = targeting.includedAudienceIds
    .map((id) => account.audiences.find((a) => a.id === id))
    .filter(Boolean) as Audience[];
  const excluded = targeting.excludedAudienceIds
    .map((id) => account.audiences.find((a) => a.id === id))
    .filter(Boolean) as Audience[];

  const hasRetargeting = included.some((a) => a.type !== "lookalike" && a.intent >= 0.6);
  const hasLookalike = included.some((a) => a.type === "lookalike");
  const customSize = included.reduce((acc, a) => acc + a.size, 0);

  const demographic = geo * lang * ageF * genderF;
  let size: number;
  if (adv) {
    // Advantage+ audience: підказки не звужують доставку; жорсткі лише контролі (гео, мін. вік, мова, виключення).
    size = demographic;
    if (included.length || interests.length) notes.push("Аудиторії та інтереси використовуються як підказки (suggestions), а не обмеження.");
  } else if (included.length) {
    // Custom audience + detailed targeting → перетин.
    const geoCap = Math.max(1, demographic);
    size = Math.min(customSize * ageF * genderF * (interests.length ? interestShare : 1), geoCap);
  } else {
    size = demographic * interestShare;
  }

  const excludedSize = excluded.reduce((acc, a) => acc + a.size, 0);
  size = Math.max(0, size - Math.min(size * 0.5, excludedSize * 0.9));
  size = Math.round(size);

  // ── Релевантність ──
  const [coreMin, coreMax] = CORE_AGE[account.vertical];
  const selectedShare = ageShare(ageMin, ageMax) || 1;
  const coreInside = ageShare(Math.max(ageMin, coreMin), Math.min(ageMax, coreMax));
  const coreRatio = Math.min(1, coreInside / selectedShare);
  let ageFit = 0.78 + 0.32 * coreRatio;
  if (coreInside === 0) ageFit = 0.55;

  const relevantInterests = interests.filter((i) => i.relevantFor.includes(account.vertical)).length;
  const irrelevantInterests = interests.length - relevantInterests;
  let interestFit = 1;
  if (interests.length) interestFit = 0.85 + 0.12 * relevantInterests - 0.1 * irrelevantInterests;
  interestFit = Math.min(1.25, Math.max(0.65, interestFit));

  const customIntent = included.length ? Math.max(...included.map((a) => a.intent)) : 0;
  const baseIntent = 0.25;
  const intent = Math.max(baseIntent, customIntent * (adv ? 0.6 : 1));

  const progress = opts.learningProgress ?? 0;
  let relevance: number;
  if (adv) {
    // Алгоритм поступово знаходить релевантних людей; підказки пришвидшують старт.
    const suggestionBoost = (interests.length ? 0.04 : 0) + (included.length ? 0.06 : 0);
    relevance = 0.9 + suggestionBoost + (opts.optimizingForConversions ? 0.18 * progress : 0.05 * progress);
    if (targeting.minAgeControl > 25) notes.push("Мінімальний вік як контроль звужує доставку — перевірте, чи це бізнес-обмеження.");
  } else {
    relevance = ageFit * interestFit * (1 + customIntent * 0.7);
    if (!interests.length && !included.length && opts.optimizingForConversions) relevance *= 0.9 + 0.2 * progress;
  }
  relevance = Math.min(1.9, Math.max(0.5, relevance));
  const fit = adv ? relevance : Math.min(1.3, Math.max(0.5, ageFit * interestFit));

  const breadth: AudienceEstimate["breadth"] = size < 150_000 ? "narrow" : size < 2_000_000 ? "specific" : "broad";
  if (size < 50_000 && size > 0) notes.push("Дуже вузька аудиторія: висока частота, дорожчий CPM, ризик Learning limited.");
  if (size === 0) notes.push("Аудиторія порожня: перевірте локації та включені аудиторії.");
  if (usesSensitiveTargeting) notes.push("Використано чутливий інтерес — може порушувати політику персональних атрибутів/здоров'я.");

  return {
    size,
    lower: Math.round(size * 0.85),
    upper: Math.round(size * 1.15),
    relevance,
    intent,
    fit,
    breadth,
    hasCustomAudiences: included.length > 0,
    hasRetargeting,
    hasLookalike,
    usesSensitiveTargeting,
    notes,
  };
}

/** Частка аудиторії, активна за тиждень (доступна до показу). */
export const ACTIVE_SHARE = 0.62;

export function effectiveAudience(size: number): number {
  return Math.max(500, size * ACTIVE_SHARE);
}

/** Охоплення як насичувальна функція показів: R = A × (1 − e^(−I / (φ·A))). */
export function reachFromImpressions(impressions: number, audience: number, phi = 1.25): number {
  if (impressions <= 0 || audience <= 0) return 0;
  return audience * (1 - Math.exp(-impressions / (phi * audience)));
}

/** Перевірка перетину аудиторій двох наборів (груба оцінка 0..1). */
export function audienceOverlap(a: AdSet, b: AdSet): number {
  const ta = a.audience;
  const tb = b.audience;
  const sameGeo = ta.locations.some((la) => tb.locations.some((lb) => la.country === lb.country && (!la.city || !lb.city || la.city === lb.city)));
  if (!sameGeo) return 0;
  const ageOverlap = Math.max(0, Math.min(ta.ageMax, tb.ageMax) - Math.max(ta.ageMin, tb.ageMin)) / Math.max(1, Math.max(ta.ageMax, tb.ageMax) - Math.min(ta.ageMin, tb.ageMin));
  const broadA = ta.advantageAudience || (ta.detailedTargeting.length === 0 && ta.includedAudienceIds.length === 0);
  const broadB = tb.advantageAudience || (tb.detailedTargeting.length === 0 && tb.includedAudienceIds.length === 0);
  if (broadA && broadB) return Math.min(1, 0.9 * ageOverlap + 0.1);
  const interestsA = new Set(ta.detailedTargeting);
  const sharedInterests = tb.detailedTargeting.filter((i) => interestsA.has(i)).length;
  const sharedAud = tb.includedAudienceIds.filter((i) => ta.includedAudienceIds.includes(i)).length;
  const interestJaccard = sharedInterests / Math.max(1, new Set([...ta.detailedTargeting, ...tb.detailedTargeting]).size);
  const base = broadA || broadB ? 0.45 : 0.15;
  return Math.min(1, ageOverlap * (base + 0.6 * interestJaccard + 0.3 * Math.min(1, sharedAud)));
}

export function campaignUsesSpecialCategory(c: Campaign) {
  return c.specialAdCategories.length > 0;
}
