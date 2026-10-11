import { countryByCode, placementById, VERTICALS } from "@/domain/catalog";
import { requiresPixelEvent } from "@/domain/objective-config";
import { weekday } from "@/lib/dates";
import type { AdAccount, Ad, AdSet, Campaign, InstantFormConfig, PerformanceGoal, PixelEvent, PlacementId, SimDay } from "@/domain/types";
import { estimateAudience, effectiveAudience, reachFromImpressions, type AudienceEstimate } from "./audience";
import { assessCreative, assetFitForPlacement, selectedPlacements, type CreativeAssessment } from "./creative-quality";
import { captureModel } from "./tracking";

/**
 * Детермінована модель «очікуваних» значень для набору оголошень у конкретний день.
 * Рушій (engine.ts) додає до неї шум із seeded RNG; оцінки в UI використовують її напряму.
 */

export type ConversionKind = "lead" | "purchase" | "none";

export const GOAL_CPM: Record<PerformanceGoal, number> = {
  reach: 0.7,
  impressions: 0.65,
  ad_recall_lift: 0.75,
  thruplay: 0.85,
  video_views_2s: 0.8,
  link_clicks: 0.9,
  landing_page_views: 1.0,
  daily_unique_reach: 0.8,
  conversations: 1.05,
  post_engagement: 0.85,
  calls: 1.0,
  leads: 1.12,
  conversion_leads: 1.2,
  conversions: 1.25,
  conversion_value: 1.4,
  app_installs: 1.1,
  app_events: 1.3,
};

export const GOAL_CLICK_BIAS: Record<PerformanceGoal, number> = {
  reach: 0.72,
  impressions: 0.7,
  ad_recall_lift: 0.72,
  thruplay: 0.65,
  video_views_2s: 0.65,
  link_clicks: 1.35,
  landing_page_views: 1.2,
  daily_unique_reach: 0.75,
  conversations: 1.0,
  post_engagement: 0.75,
  calls: 0.9,
  leads: 1.1,
  conversion_leads: 1.0,
  conversions: 1.0,
  conversion_value: 0.95,
  app_installs: 1.1,
  app_events: 1.0,
};

const WEEKDAY_CPM = [0.96, 1.02, 1.0, 1.0, 1.02, 0.98, 0.95]; // Нд..Сб

export const LEAD_EVENTS: PixelEvent[] = ["Lead", "CompleteRegistration", "Contact", "Schedule", "Subscribe", "StartTrial"];

/** Тип конверсії, який означає подія оптимізації (ліди, покупки, проміжні кроки воронки). */
export function eventKind(event: string | null): "lead" | "purchase" | "mid" | "none" {
  if (!event) return "none";
  if (event === "Purchase") return "purchase";
  if (LEAD_EVENTS.includes(event as PixelEvent)) return "lead";
  if (event === "AddToCart" || event === "InitiateCheckout" || event === "ViewContent") return "mid";
  return "none";
}

/**
 * Узгодженість оптимізації з бізнес-ціллю: наскільки люди, яких знаходить система,
 * схильні здійснити основну конверсію сайту (1.0 — оптимізація під саму конверсію).
 */
export function optimizationAlignment(adSet: AdSet, primary: ConversionKind, eventVisible: boolean): number {
  const g = adSet.performanceGoal;
  const ev = adSet.optimizationEvent;
  if (g === "conversions" || g === "conversion_value") {
    if (!eventVisible) return 0.45;
    if (g === "conversion_value") return primary === "purchase" ? 0.97 : 0.55;
    if (ev === "Purchase") return primary === "purchase" ? 1 : 0.5;
    if (ev && LEAD_EVENTS.includes(ev as PixelEvent)) return primary === "lead" ? 1 : 0.55;
    if (ev === "InitiateCheckout") return primary === "purchase" ? 0.85 : 0.6;
    if (ev === "AddToCart") return primary === "purchase" ? 0.75 : 0.55;
    if (ev === "ViewContent") return 0.62;
    return 0.5;
  }
  switch (g) {
    case "landing_page_views":
      return 0.45;
    case "link_clicks":
      return 0.3;
    case "conversations":
    case "calls":
      return 0.5;
    case "leads":
    case "conversion_leads":
      return 0.7;
    case "thruplay":
    case "video_views_2s":
      return 0.38;
    case "post_engagement":
      return 0.3;
    default:
      return 0.33;
  }
}

/**
 * Частка тих, хто відкрив миттєву форму і надіслав її. Higher intent додає крок підтвердження;
 * кожне питання понад 3 знижує заповнення (але підвищує якість — див. instantFormQualityFactor).
 */
export function instantFormCompletion(form: InstantFormConfig | null | undefined): number {
  const base = form?.formType === "higher_intent" ? 0.15 : 0.24;
  const extra = Math.max(0, (form?.questions ?? 3) - 3);
  return base * Math.max(0.6, 1 - 0.05 * extra);
}

export function instantFormQualityFactor(form: InstantFormConfig | null | undefined): number {
  const extra = Math.max(0, (form?.questions ?? 3) - 3);
  return 1 + 0.04 * Math.min(5, extra);
}

export function learningProgress(adSet: AdSet): number {
  switch (adSet.learning.phase) {
    case "active":
      return 1;
    case "learning":
      return Math.min(1, adSet.learning.eventsSinceEdit / 50);
    case "learning_limited":
      return 0.4;
    default:
      return 0;
  }
}

export interface PlacementMix {
  shares: Partial<Record<PlacementId, number>>;
  cpmMultiplier: number;
}

function placementValue(pid: PlacementId, goal: PerformanceGoal): number {
  const p = placementById(pid);
  if (["reach", "impressions", "daily_unique_reach", "ad_recall_lift"].includes(goal)) return 1 / p.cpm;
  if (goal === "thruplay" || goal === "video_views_2s") return (p.group === "Reels" || p.group === "Stories" ? 1.3 : 1) / p.cpm;
  if (goal === "link_clicks") return p.ctr / p.cpm;
  if (goal === "landing_page_views") return (p.ctr * p.lpvQuality ** 3) / p.cpm;
  return (p.ctr * p.lpvQuality ** 3.5) / p.cpm;
}

export function placementMix(adSet: AdSet): PlacementMix {
  const ids = selectedPlacements(adSet);
  const advantage = adSet.placements.mode === "advantage";
  const exponent = advantage ? 0.85 : 0.5;
  const raw: [PlacementId, number][] = ids.map((id) => [id, placementById(id).inventory * placementValue(id, adSet.performanceGoal) ** exponent]);
  let total = raw.reduce((a, [, w]) => a + w, 0);
  const shares: Partial<Record<PlacementId, number>> = {};
  if (total <= 0) return { shares, cpmMultiplier: 1 };
  for (const [id, w] of raw) shares[id] = w / total;
  // Обмеження частки Audience Network у конверсійних цілях при Advantage+ placements.
  if (advantage && shares.audience_network && shares.audience_network > 0.3 && !["link_clicks"].includes(adSet.performanceGoal)) {
    const excess = shares.audience_network - 0.3;
    shares.audience_network = 0.3;
    total = 1 - 0.3;
    for (const id of ids) if (id !== "audience_network") shares[id] = (shares[id] ?? 0) * (1 + excess / total);
  }
  const cpmMultiplier = ids.reduce((a, id) => a + (shares[id] ?? 0) * placementById(id).cpm, 0);
  return { shares, cpmMultiplier };
}

/** Множник CTR/LPV конкретного оголошення з урахуванням розподілу за плейсментами. */
export function adPlacementFactors(ad: Ad, mix: PlacementMix) {
  let ctr = 0;
  let clickWeight = 0;
  let lpvWeighted = 0;
  let cvrWeighted = 0;
  for (const [pid, share] of Object.entries(mix.shares) as [PlacementId, number][]) {
    const p = placementById(pid);
    const c = share * p.ctr * assetFitForPlacement(ad.creative, pid);
    ctr += c;
    clickWeight += c;
    lpvWeighted += c * p.lpvQuality;
    cvrWeighted += c * p.lpvQuality * p.cvrQuality;
  }
  return {
    ctrMix: ctr,
    lpvQualityMix: clickWeight ? lpvWeighted / clickWeight : 0.8,
    cvrQualityMix: lpvWeighted ? cvrWeighted / lpvWeighted : 1,
  };
}

/** Базовий CPM ринку для набору (без шуму). */
export function baseMarketCpm(account: AdAccount, adSet: AdSet, audienceSize: number): number {
  const locs = adSet.audience.locations;
  let weighted = 0;
  let wsum = 0;
  for (const l of locs) {
    const c = countryByCode(l.country);
    if (!c) continue;
    const w = l.city ? 0.3 : c.reachableMillions;
    weighted += c.baseCpm * w;
    wsum += w;
  }
  const geoCpm = wsum ? weighted / wsum : 3;
  const sizeFactor = Math.min(1.9, Math.max(0.85, 1 + 0.18 * Math.log10(1_000_000 / Math.max(1000, audienceSize))));
  return geoCpm * VERTICALS[account.vertical].competition * GOAL_CPM[adSet.performanceGoal] * sizeFactor;
}

export function dayMarketFactor(account: AdAccount, day: SimDay): { factor: number; labels: string[] } {
  const wd = weekday(account.startDate, day);
  let factor = WEEKDAY_CPM[wd];
  const labels: string[] = [];
  for (const e of account.marketEvents) {
    if (e.day === day) {
      factor *= e.cpmMultiplier;
      labels.push(e.label);
    }
  }
  return { factor, labels };
}

/** Імпресії оголошення/набору за останні N днів до дня day (не включно). */
export function recentImpressions(account: AdAccount, filter: (m: AdAccount["metrics"][number]) => boolean, day: SimDay, window = 14) {
  let sum = 0;
  for (const m of account.metrics) if (m.day < day && m.day >= day - window && filter(m)) sum += m.impressions;
  return sum;
}

export function fatigueFactor(account: AdAccount, ad: Ad, audienceEff: number, day: SimDay, diversification: number): { factor: number; frequency: number } {
  const imp = recentImpressions(account, (m) => m.adId === ad.id, day);
  const reach = reachFromImpressions(imp, audienceEff);
  const freq = reach > 0 ? imp / reach : 0;
  const tolerance = 2.0 + 0.25 * Math.min(4, diversification - 1);
  const freqF = 1 / (1 + 0.22 * Math.max(0, freq - tolerance));
  const age = ad.firstDeliveryDay === null ? 0 : day - ad.firstDeliveryDay;
  const ageF = Math.max(0.78, 1 - 0.006 * Math.max(0, age - 10));
  return { factor: freqF * ageF, frequency: freq };
}

export interface AdModel {
  ad: Ad;
  assessment: CreativeAssessment;
  fatigue: number;
  adFrequency: number;
  ctr: number;
  lpvQualityMix: number;
  cvrQualityMix: number;
  score: number;
}

export interface AdSetModel {
  audience: AudienceEstimate;
  audienceEff: number;
  mix: PlacementMix;
  cpm: number;
  ads: AdModel[];
  adWeights: number[];
  conversionKind: ConversionKind;
  alignment: number;
  eventVisible: boolean;
  /** Очікувана частка сесій, що конвертуються в основну дію (для сайту). */
  sessionCvr: number;
  /** Очікувана частка сесій від кліків. */
  lpvRate: number;
  learningFactor: number;
  saturation: number;
  avgCtr: number;
  /** Очікувана кількість «результатів» (за ціллю) на $1. */
  resultsPerDollar: number;
  /** Очікувана вартість результату. */
  costPerResult: number | null;
  /** Очікуваний ROAS (для продажів). */
  expectedRoas: number | null;
  /** Максимум показів на день, доступний в аудиторії. */
  maxDailyImpressions: number;
  /** Множник доставки через обмеження політик (чутливий таргетинг). */
  policyDeliveryFactor: number;
  notes: string[];
}

export const LOAD_SPEED = { fast: 0.9, average: 0.8, slow: 0.55 } as const;

export function urlIsFunctional(account: AdAccount, url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === account.landingPage.domain.replace(/^www\./, "");
  } catch {
    return false;
  }
}

export function buildAdSetModel(account: AdAccount, campaign: Campaign, adSet: AdSet, ads: Ad[], day: SimDay): AdSetModel {
  const notes: string[] = [];
  const vertical = VERTICALS[account.vertical];
  const progress = learningProgress(adSet);
  const conversionGoal = ["conversions", "conversion_value", "leads", "conversion_leads", "app_installs", "app_events"].includes(adSet.performanceGoal);
  const audience = estimateAudience(account, adSet.audience, { optimizingForConversions: conversionGoal, learningProgress: progress });
  const audienceEff = effectiveAudience(audience.size);
  const mix = placementMix(adSet);

  // Якість креативів і розподіл показів між оголошеннями
  const diversification = new Set(ads.map((a) => a.creative.media[0]?.libraryKey ?? a.creative.media[0]?.id ?? a.id)).size;
  const adModels: AdModel[] = ads.map((ad) => {
    const assessment = assessCreative(ad, { campaign, adSet, landing: account.landingPage });
    const { factor, frequency } = fatigueFactor(account, ad, audienceEff, day, diversification);
    const pf = adPlacementFactors(ad, mix);
    const ctr =
      vertical.baseCtr *
      assessment.ctrMultiplier *
      Math.sqrt(audience.relevance) *
      pf.ctrMix *
      factor *
      GOAL_CLICK_BIAS[adSet.performanceGoal];
    return {
      ad,
      assessment,
      fatigue: factor,
      adFrequency: frequency,
      ctr,
      lpvQualityMix: pf.lpvQualityMix,
      cvrQualityMix: pf.cvrQualityMix,
      score: assessment.quality * factor,
    };
  });

  let adWeights: number[];
  if (campaign.abTest?.enabled && campaign.abTest.variable === "creative") {
    adWeights = adModels.map(() => 1 / Math.max(1, adModels.length));
  } else {
    const raw = adModels.map((m) => Math.exp(4 * m.score));
    const sum = raw.reduce((a, b) => a + b, 0) || 1;
    const floor = adModels.length > 1 ? 0.08 / adModels.length : 0;
    adWeights = raw.map((r) => floor + (1 - floor * adModels.length) * (r / sum));
  }

  const avgQuality = adModels.reduce((a, m, i) => a + m.assessment.quality * adWeights[i], 0);
  const avgCtr = adModels.reduce((a, m, i) => a + m.ctr * adWeights[i], 0);
  const avgLpvQ = adModels.reduce((a, m, i) => a + m.lpvQualityMix * adWeights[i], 0) || 0.8;
  const avgCvrQ = adModels.reduce((a, m, i) => a + m.cvrQualityMix * adWeights[i], 0) || 1;

  // Насичення аудиторії
  const setImp = recentImpressions(account, (m) => m.adSetId === adSet.id, day);
  const setReach = reachFromImpressions(setImp, audienceEff);
  const setFreq = setReach > 0 ? setImp / setReach : 0;
  const saturation = 1 + 0.12 * Math.max(0, setFreq - 2);

  const learningCpm = adSet.learning.phase === "learning" || adSet.learning.phase === "not_started" ? 1.08 : 1;
  const specialF = campaign.specialAdCategories.length ? 1.05 : 1;
  const qualityF = 1.25 - 0.45 * avgQuality;
  const market = dayMarketFactor(account, day);
  const cpm = baseMarketCpm(account, adSet, audience.size) * mix.cpmMultiplier * qualityF * saturation * learningCpm * specialF * market.factor;

  // Сайт / трекінг
  const primary: ConversionKind = account.landingPage.primaryConversion;
  const event = (adSet.optimizationEvent ?? null) as PixelEvent | null;
  const eventVisible = event && !["Install", "AppPurchase", "AppRegistration"].includes(event) ? captureModel(account, event).capture > 0 : !requiresPixelEvent(adSet.conversionLocation, adSet.performanceGoal);
  const alignment = optimizationAlignment(adSet, primary, eventVisible);
  const urlOk = ads.some((a) => urlIsFunctional(account, a.creative.destinationUrl));
  const lpvRate = urlOk ? LOAD_SPEED[account.landingPage.loadSpeed] * avgLpvQ * (account.landingPage.mobileFriendly ? 1 : 0.85) : 0.02;
  const learningFactor = adSet.learning.phase === "active" ? 1.05 : adSet.learning.phase === "learning_limited" ? 0.82 : 0.88 + 0.12 * progress;
  const avgCvrMult = adModels.reduce((a, m, i) => a + m.assessment.cvrMultiplier * adWeights[i], 0) || 0.8;
  const intentF = 0.7 + 0.9 * audience.intent;
  const pp = adSet.audience.locations.length ? countryByCode(adSet.audience.locations[0].country).purchasingPower : 1;
  const sessionCvr =
    account.landingPage.baseConversionRate *
    intentF *
    audience.fit ** 0.8 *
    avgCvrMult *
    avgCvrQ *
    alignment *
    learningFactor *
    (primary === "purchase" ? Math.sqrt(pp) : 1);

  // Очікувана кількість результатів на $1
  const impPerDollar = cpm > 0 ? 1000 / cpm : 0;
  const clicksPerDollar = impPerDollar * avgCtr;
  const sessionsPerDollar = clicksPerDollar * 0.94 * lpvRate;
  let resultsPerDollar = 0;
  let expectedRoas: number | null = null;
  const g = adSet.performanceGoal;
  const lpvCapture = account.tracking.pixel.installed && account.tracking.pixel.events.includes("PageView") ? 0.9 * (account.tracking.consent.bannerEnabled ? account.tracking.consent.acceptRate : 1) : 0;
  switch (g) {
    case "reach":
    case "daily_unique_reach":
      resultsPerDollar = impPerDollar / 1.3;
      break;
    case "impressions":
      resultsPerDollar = impPerDollar;
      break;
    case "ad_recall_lift":
      resultsPerDollar = (impPerDollar / 1.3) * 0.05;
      break;
    case "thruplay":
      resultsPerDollar = impPerDollar * 0.06;
      break;
    case "video_views_2s":
      resultsPerDollar = impPerDollar * 0.25;
      break;
    case "post_engagement":
      resultsPerDollar = impPerDollar * 0.03;
      break;
    case "link_clicks":
      resultsPerDollar = clicksPerDollar;
      break;
    case "landing_page_views":
      resultsPerDollar = sessionsPerDollar * lpvCapture;
      break;
    case "conversations":
      resultsPerDollar = clicksPerDollar * 0.55;
      break;
    case "calls":
      resultsPerDollar = clicksPerDollar * 0.4;
      break;
    case "leads":
    case "conversion_leads": {
      const completion = instantFormCompletion(adModels[0]?.ad.creative.instantForm);
      resultsPerDollar = clicksPerDollar * completion * (g === "conversion_leads" ? 0.9 : 1);
      break;
    }
    case "conversions":
    case "conversion_value": {
      const cap = event ? captureModel(account, event).reportedRate : 0;
      const kind = eventKind(event);
      const perSession = kind === "mid" ? Math.min(0.6, sessionCvr * 4) : kind === primary ? sessionCvr : sessionCvr * 0.1;
      resultsPerDollar = sessionsPerDollar * perSession * cap;
      if (primary === "purchase") {
        const aov = account.economics.averageOrderValue * (g === "conversion_value" ? 1.2 : 1);
        expectedRoas = sessionsPerDollar * sessionCvr * aov * (cap || 0);
      }
      break;
    }
    case "app_installs":
      resultsPerDollar = account.tracking.appRegistered ? clicksPerDollar * 0.28 : 0;
      break;
    case "app_events":
      resultsPerDollar = account.tracking.appRegistered ? clicksPerDollar * 0.28 * 0.25 : 0;
      break;
  }

  const capImpressions = adSet.frequencyCap ? (audienceEff * adSet.frequencyCap.impressions) / Math.max(1, adSet.frequencyCap.days) : Infinity;
  const maxDailyImpressions = Math.min(audienceEff * 0.9, capImpressions);

  if (!urlOk && ["website", "website_and_app", "website_and_instant_forms"].includes(adSet.conversionLocation)) notes.push("URL оголошень не веде на робочу посадкову сторінку.");
  if (market.labels.length) notes.push(`Подія ринку: ${market.labels.join(", ")}`);
  // Навчальне припущення: чутливий таргетинг не відхиляє оголошення, але обмежує доставку.
  const policyDeliveryFactor = audience.usesSensitiveTargeting ? 0.4 : 1;
  if (policyDeliveryFactor < 1) notes.push("Чутливий інтерес у таргетингу: доставку обмежено політиками.");

  return {
    audience,
    audienceEff,
    mix,
    cpm,
    ads: adModels,
    adWeights,
    conversionKind: primary,
    alignment,
    eventVisible: Boolean(eventVisible),
    sessionCvr,
    lpvRate,
    learningFactor,
    saturation,
    avgCtr,
    resultsPerDollar,
    costPerResult: resultsPerDollar > 0 ? 1 / resultsPerDollar : null,
    expectedRoas,
    maxDailyImpressions,
    policyDeliveryFactor,
    notes,
  };
}
