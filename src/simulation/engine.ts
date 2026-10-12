import { placementById } from "@/domain/catalog";
import type {
  AdAccount,
  Ad,
  AdSet,
  AdSetDaySnapshot,
  Campaign,
  ChangeLogEntry,
  DailyMetrics,
  PixelEvent,
  PlacementId,
  PlacementSlice,
  SimDay,
} from "@/domain/types";
import { seededId } from "@/lib/ids";
import { reachFromImpressions } from "./audience";
import { advanceLearning } from "./learning";
import { buildAdSetModel, eventKind, instantFormCompletion, instantFormQualityFactor, LEAD_EVENTS, LOAD_SPEED, urlIsFunctional, type AdSetModel } from "./model";
import { reviewAd, reviewOutcome } from "./review";
import { createRng, type Rng } from "./rng";
import { captureModel, consentFactor, utmPresent } from "./tracking";
import { round } from "./metrics";

/**
 * Рушій доставки. Чиста функція: (стан акаунта, кількість днів) → новий стан.
 * Детермінованість: усі випадкові величини походять із createRng(account.seed, seq сутності, день, мета).
 */

export const LEAD_LAG = [0.7, 0.15, 0.07, 0.04, 0.02, 0.01, 0.01];
export const PURCHASE_LAG: Record<string, number[]> = {
  ecommerce: [0.55, 0.18, 0.1, 0.07, 0.05, 0.03, 0.02],
  default: [0.42, 0.2, 0.12, 0.1, 0.07, 0.05, 0.04],
};

export interface SimulationResult {
  account: AdAccount;
  notes: string[];
  spend: number;
}

export function isAdDeliverable(ad: Ad): boolean {
  return ad.status === "active" && ad.review?.state === "approved";
}

export function adSetInSchedule(adSet: AdSet, day: SimDay): boolean {
  return adSet.startDay <= day && (adSet.endDay === null || day <= adSet.endDay);
}

function totalSpend(account: AdAccount, filter?: (m: DailyMetrics) => boolean): number {
  let s = 0;
  for (const m of account.metrics) if (!filter || filter(m)) s += m.spend;
  return s;
}

/** Розподіл послідовними біноміальними пробами (мультиноміальна вибірка). */
function splitByLag(rng: Rng, total: number, lag: number[]): number[] {
  const out = new Array(lag.length).fill(0);
  let remaining = total;
  let massLeft = lag.reduce((a, b) => a + b, 0);
  for (let k = 0; k < lag.length; k++) {
    if (remaining <= 0) break;
    const p = massLeft > 0 ? lag[k] / massLeft : 1;
    const x = k === lag.length - 1 ? remaining : rng.binomial(remaining, Math.min(1, p));
    out[k] = x;
    remaining -= x;
    massLeft -= lag[k];
  }
  return out;
}

function placementSlices(
  model: AdSetModel,
  totals: { impressions: number; spend: number; linkClicks: number; lpv: number; conversions: number },
): Partial<Record<PlacementId, PlacementSlice>> {
  const out: Partial<Record<PlacementId, PlacementSlice>> = {};
  const entries = Object.entries(model.mix.shares) as [PlacementId, number][];
  const cpmW = entries.reduce((a, [pid, s]) => a + s * placementById(pid).cpm, 0) || 1;
  const clickW = entries.reduce((a, [pid, s]) => a + s * placementById(pid).ctr, 0) || 1;
  const lpvW = entries.reduce((a, [pid, s]) => a + s * placementById(pid).ctr * placementById(pid).lpvQuality, 0) || 1;
  for (const [pid, share] of entries) {
    const p = placementById(pid);
    out[pid] = {
      impressions: Math.round(totals.impressions * share),
      spend: round((totals.spend * share * p.cpm) / cpmW, 2),
      linkClicks: Math.round((totals.linkClicks * share * p.ctr) / clickW),
      lpv: Math.round((totals.lpv * share * p.ctr * p.lpvQuality) / lpvW),
      conversions: Math.round((totals.conversions * share * p.ctr * p.lpvQuality) / lpvW),
    };
  }
  return out;
}

interface AdSetDayResult {
  rows: DailyMetrics[];
  snapshot: AdSetDaySnapshot;
  spend: number;
  notes: string[];
}

function bidDeliveryFactor(campaign: Campaign, adSet: AdSet, model: AdSetModel): { factor: number; note?: string } {
  const useCampaign = campaign.budgetLevel === "campaign";
  const strategy = useCampaign ? campaign.bidStrategy : adSet.bidStrategy;
  const bidAmount = useCampaign ? campaign.bidAmount : adSet.bidAmount;
  const roasGoal = useCampaign ? campaign.roasGoal : adSet.roasGoal;
  const cpr = model.costPerResult;
  if (strategy === "cost_per_result_goal" && bidAmount && cpr) {
    const ratio = bidAmount / cpr;
    if (ratio < 1) {
      return {
        factor: Math.min(1, Math.max(0.03, ratio ** 3)),
        note: `Ціль вартості $${bidAmount.toFixed(2)} нижча за прогнозовану ~$${cpr.toFixed(2)} — доставка обмежена.`,
      };
    }
  }
  if (strategy === "bid_cap" && bidAmount && cpr) {
    const ratio = bidAmount / (cpr * 0.8);
    if (ratio < 1) {
      return {
        factor: Math.min(1, Math.max(0.01, ratio ** 4)),
        note: `Bid cap $${bidAmount.toFixed(2)} програє аукціони — бюджет недовитрачається.`,
      };
    }
  }
  if (strategy === "roas_goal" && roasGoal && model.expectedRoas !== null) {
    const ratio = model.expectedRoas / roasGoal;
    if (ratio < 1) {
      return {
        factor: Math.min(1, Math.max(0.02, ratio ** 3)),
        note: `ROAS goal ${roasGoal.toFixed(2)} вищий за досяжний ~${model.expectedRoas.toFixed(2)} — доставка обмежена.`,
      };
    }
  }
  return { factor: 1 };
}

function simulateAdSetDay(
  account: AdAccount,
  campaign: Campaign,
  adSet: AdSet,
  ads: Ad[],
  model: AdSetModel,
  budget: number,
  accountBudgetLeft: number,
  day: SimDay,
): AdSetDayResult {
  const notes: string[] = [];
  const rng = createRng(account.seed, "adset", adSet.seq, day);
  const cpm = model.cpm * rng.noise(0.07);
  const bid = bidDeliveryFactor(campaign, adSet, model);
  if (bid.note) notes.push(`${adSet.name}: ${bid.note}`);
  const pacing = Math.min(1, Math.max(0.9, rng.normal(0.97, 0.02)));
  const targetSpend = budget * pacing * bid.factor * model.policyDeliveryFactor;
  const inventorySpend = (model.maxDailyImpressions * cpm) / 1000;
  let spend = Math.min(targetSpend, inventorySpend, Math.max(0, accountBudgetLeft));
  if (inventorySpend < targetSpend * 0.8) notes.push(`${adSet.name}: аудиторія замала для бюджету — доставка обмежена інвентарем.`);
  if (accountBudgetLeft < targetSpend) notes.push("Віртуальний баланс акаунта майже вичерпано.");
  const impressions = Math.max(0, Math.round((spend / cpm) * 1000));
  spend = round((impressions * cpm) / 1000, 2);

  const rows: DailyMetrics[] = [];
  const lagPurchase = PURCHASE_LAG[account.vertical] ?? PURCHASE_LAG.default;
  const location = adSet.conversionLocation;
  const instantShare = location === "instant_forms" ? 1 : location === "website_and_instant_forms" ? 0.5 : 0;
  const websiteShare = ["website", "website_and_app", "website_and_instant_forms"].includes(location) ? 1 - instantShare : 0;
  const primary = account.landingPage.primaryConversion;
  const pvCapture = account.tracking.pixel.installed && account.tracking.pixel.events.includes("PageView") ? 0.9 * consentFactor(account) : 0;
  const optEvent = adSet.optimizationEvent as PixelEvent | null;
  const leadEvent: PixelEvent = optEvent && LEAD_EVENTS.includes(optEvent) ? optEvent : "Lead";
  const leadCap = captureModel(account, leadEvent).reportedRate;
  const purchaseCap = captureModel(account, "Purchase").reportedRate;
  const vcCap = captureModel(account, "ViewContent").reportedRate;
  const atcCap = captureModel(account, "AddToCart").reportedRate;
  const icCap = captureModel(account, "InitiateCheckout").reportedRate;
  const avgCvrMult =
    model.ads.reduce((a, m, i) => a + m.assessment.cvrMultiplier * model.adWeights[i], 0) || 1;
  const avgCvrQ = model.ads.reduce((a, m, i) => a + m.cvrQualityMix * model.adWeights[i], 0) || 1;

  let remainingImp = impressions;
  let remainingSpend = spend;
  model.ads.forEach((am, idx) => {
    const ad = am.ad;
    const r = createRng(account.seed, "ad", ad.seq, day);
    const isLast = idx === model.ads.length - 1;
    const imp = isLast ? remainingImp : Math.min(remainingImp, Math.round(impressions * model.adWeights[idx]));
    const adSpend = isLast ? round(remainingSpend, 2) : round((spend * imp) / Math.max(1, impressions), 2);
    remainingImp -= imp;
    remainingSpend -= adSpend;

    const hook = am.assessment.hook;
    const ctr = Math.min(0.2, am.ctr * r.noise(0.08));
    const linkClicks = r.binomial(imp, ctr);
    const clicksAll = linkClicks + r.binomial(imp, 0.006 + 0.01 * hook);
    const goalBoostEng = adSet.performanceGoal === "post_engagement" ? 2.5 : 1;
    const postEngagements = r.binomial(imp, (0.004 + 0.012 * hook) * goalBoostEng);
    let videoPlays3s = 0;
    let thruPlays = 0;
    if (am.assessment.isVideo) {
      const vgoal = adSet.performanceGoal === "thruplay" || adSet.performanceGoal === "video_views_2s" ? 1.4 : 1;
      videoPlays3s = r.binomial(imp, Math.min(0.85, (0.15 + 0.3 * hook) * vgoal));
      const dur = ad.creative.media[0]?.durationSec ?? 30;
      thruPlays = r.binomial(videoPlays3s, dur <= 15 ? 0.55 : dur <= 30 ? 0.4 : 0.22);
    }

    const webClicks = Math.round(linkClicks * websiteShare);
    const outboundClicks = r.binomial(webClicks, 0.94);
    const urlOk = urlIsFunctional(account, ad.creative.destinationUrl);
    const lpvRate = urlOk ? LOAD_SPEED[account.landingPage.loadSpeed] * am.lpvQualityMix * (account.landingPage.mobileFriendly ? 1 : 0.85) : 0.02;
    const sessions = r.binomial(outboundClicks, Math.min(0.98, lpvRate));
    const landingPageViews = r.binomial(sessions, Math.min(1, pvCapture));
    const conversations = location === "messaging_apps" ? r.binomial(linkClicks, 0.55) : 0;
    const calls = location === "calls" ? r.binomial(linkClicks, 0.4) : 0;
    const installs = location === "app" || location === "website_and_app" ? (account.tracking.appRegistered ? r.binomial(Math.round(linkClicks * (location === "app" ? 1 : 0.4)), 0.28) : 0) : 0;
    const appEvents = r.binomial(installs, 0.25);

    // ── Реальні конверсії ──
    const cvr = Math.min(
      0.9,
      Math.max(0, model.sessionCvr * (am.assessment.cvrMultiplier / avgCvrMult) * (am.cvrQualityMix / avgCvrQ) * r.noise(0.12)),
    );
    const siteConv = r.binomial(sessions, cvr);
    const trueWebsiteLeads = primary === "lead" ? siteConv : 0;
    const truePurchasesClick = primary === "purchase" ? siteConv : 0;
    const form = ad.creative.instantForm;
    const completion = instantFormCompletion(form);
    const instantLeads =
      instantShare > 0
        ? r.binomial(Math.round(linkClicks * instantShare), completion * (0.85 + 0.3 * model.audience.intent) * (adSet.performanceGoal === "conversion_leads" ? 0.9 : 1))
        : 0;
    const messagingLeads = r.binomial(conversations, 0.18);
    const callLeads = r.binomial(calls, 0.3);

    const aov = account.economics.averageOrderValue * (adSet.performanceGoal === "conversion_value" ? 1.2 : 1);
    const revenueClick = truePurchasesClick > 0 ? round(truePurchasesClick * aov * r.noise(0.18), 2) : 0;

    // ── Звітні конверсії (трекінг + атрибуція) ──
    const reportedLeadsWeb = r.poisson(trueWebsiteLeads * leadCap);
    const reportedPurchases = r.poisson(truePurchasesClick * purchaseCap);
    const clickLeads = splitByLag(r, reportedLeadsWeb, LEAD_LAG);
    clickLeads[0] += instantLeads + (adSet.performanceGoal === "leads" ? Math.round(messagingLeads * 0.8) : 0);
    const clickPurchases = splitByLag(r, reportedPurchases, lagPurchase);
    const avgValue = truePurchasesClick > 0 ? revenueClick / truePurchasesClick : aov;
    const clickValue = clickPurchases.map((n) => round(n * avgValue, 2));

    const vtShare = 0.12 + 0.25 * model.audience.intent + (am.assessment.isVideo ? 0.05 : 0);
    const viewLeads = r.poisson((trueWebsiteLeads + instantLeads * 0.3) * vtShare * Math.min(1, leadCap));
    const viewPurchases = r.poisson(truePurchasesClick * vtShare * Math.min(1, purchaseCap));
    const viewValue = round(viewPurchases * avgValue, 2);
    const engageLeads = r.poisson(trueWebsiteLeads * 0.05 * Math.min(1, leadCap));
    const engagePurchases = r.poisson(truePurchasesClick * 0.05 * Math.min(1, purchaseCap));
    const engageValue = round(engagePurchases * avgValue, 2);

    // Частина view-through конверсій інкрементальна (решта сталася б і так).
    const incrementalLeads = Math.round(viewLeads * 0.25);
    const incrementalPurchases = Math.round(viewPurchases * 0.25);

    const contentTrue = r.binomial(sessions, primary === "purchase" ? 0.78 : 0.6);
    const atcTrue = primary === "purchase" ? Math.max(truePurchasesClick, r.binomial(sessions, Math.min(0.5, cvr * 4))) : 0;
    const checkoutTrue = primary === "purchase" ? Math.max(truePurchasesClick, r.binomial(atcTrue, 0.5)) : 0;

    // ── CRM ──
    const trueLeads = trueWebsiteLeads + instantLeads + messagingLeads + callLeads + incrementalLeads;
    const truePurchases = truePurchasesClick + incrementalPurchases;
    const trueRevenue = round(revenueClick + incrementalPurchases * avgValue, 2);
    const sourceMix =
      trueLeads > 0
        ? (trueWebsiteLeads * 0.42 + instantLeads * (form?.formType === "higher_intent" ? 0.34 : 0.2) + messagingLeads * 0.35 + callLeads * 0.5 + incrementalLeads * 0.4) / trueLeads
        : 0.3;
    const qualRate =
      sourceMix *
      (0.75 + 0.5 * model.audience.intent) *
      am.assessment.leadQualityMultiplier *
      (adSet.performanceGoal === "conversion_leads" && account.tracking.crmFeedback ? 1.35 : 1) *
      (model.alignment < 0.5 ? 0.85 : 1) *
      (form?.hasQualifyingQuestion ? 1.15 : 1) *
      (instantLeads > 0 ? 1 + (instantFormQualityFactor(form) - 1) * (instantLeads / Math.max(1, trueLeads)) : 1);
    const qualifiedLeads = r.binomial(trueLeads, Math.min(0.9, Math.max(0.03, qualRate)));
    const utm = utmPresent(ad.creative.urlParameters, ad.creative.destinationUrl);
    const crmAttributedLeads =
      (account.tracking.crmConnected ? instantLeads : Math.round(instantLeads * 0.6)) +
      r.binomial(trueWebsiteLeads, utm ? 0.93 : 0.12) +
      r.binomial(messagingLeads + callLeads, 0.5);
    const crmAttributedPurchases = r.binomial(truePurchases, utm ? 0.9 : 0.1);

    const dailyReach = Math.round(imp / (1.08 + 0.3 * Math.min(3, imp / Math.max(1, model.audienceEff))));

    const row: DailyMetrics = {
      id: seededId("m", `${account.id}|${ad.id}|${day}`),
      accountId: account.id,
      campaignId: campaign.id,
      adSetId: adSet.id,
      adId: ad.id,
      day,
      spend: adSpend,
      impressions: imp,
      reach: Math.min(imp, dailyReach),
      clicksAll,
      linkClicks,
      outboundClicks,
      sessions,
      landingPageViews,
      postEngagements,
      videoPlays3s,
      thruPlays,
      conversations,
      calls,
      installs,
      appEvents,
      contentViews: r.poisson(contentTrue * vcCap),
      addToCarts: r.poisson(atcTrue * atcCap),
      checkouts: r.poisson(checkoutTrue * icCap),
      clickLeads,
      clickPurchases,
      clickValue,
      viewLeads,
      viewPurchases,
      viewValue,
      engageLeads,
      engagePurchases,
      engageValue,
      trueLeads,
      qualifiedLeads,
      truePurchases,
      trueRevenue,
      crmAttributedLeads,
      crmAttributedPurchases,
      byPlacement: {},
    };
    const conv = clickLeads.reduce((a, b) => a + b, 0) + clickPurchases.reduce((a, b) => a + b, 0);
    row.byPlacement = placementSlices(model, { impressions: imp, spend: adSpend, linkClicks, lpv: landingPageViews, conversions: conv });
    rows.push(row);
  });

  const prevSnap = [...account.snapshots].reverse().find((s) => s.adSetId === adSet.id);
  const cumImp = (prevSnap?.cumulativeImpressions ?? 0) + impressions;
  const cumReach = Math.round(Math.max(prevSnap?.cumulativeReach ?? 0, reachFromImpressions(cumImp, model.audienceEff)));
  const dailyReach = rows.reduce((a, r) => a + r.reach, 0);
  const snapshot: AdSetDaySnapshot = {
    adSetId: adSet.id,
    day,
    audienceSize: model.audience.size,
    effectiveAudience: Math.round(model.audienceEff),
    cumulativeImpressions: cumImp,
    cumulativeReach: cumReach,
    dailyReach,
    frequency: cumReach > 0 ? round(cumImp / cumReach, 2) : 0,
    cpm: round(cpm, 2),
    learningPhase: adSet.learning.phase,
    deliveryNotes: [...notes, ...model.notes],
    budgetAllocated: round(budget, 2),
  };
  return { rows, snapshot, spend, notes };
}

/** Події оптимізації, що «проявилися» в день day для набору (з урахуванням затримки та вікна атрибуції). */
export function optimizationEventsRevealed(account: AdAccount, adSet: AdSet, newRows: DailyMetrics[], day: SimDay): number {
  const g = adSet.performanceGoal;
  const todays = newRows.filter((r) => r.adSetId === adSet.id);
  const sum = (f: (r: DailyMetrics) => number) => todays.reduce((a, r) => a + f(r), 0);
  switch (g) {
    case "link_clicks":
      return sum((r) => r.linkClicks);
    case "landing_page_views":
      return sum((r) => r.landingPageViews);
    case "reach":
    case "daily_unique_reach":
    case "impressions":
    case "ad_recall_lift":
      return sum((r) => r.reach);
    case "thruplay":
      return sum((r) => r.thruPlays);
    case "video_views_2s":
      return sum((r) => r.videoPlays3s);
    case "post_engagement":
      return sum((r) => r.postEngagements);
    case "conversations":
      return sum((r) => r.conversations);
    case "calls":
      return sum((r) => r.calls);
    case "app_installs":
      return sum((r) => r.installs);
    case "app_events":
      return sum((r) => r.appEvents);
    case "leads":
    case "conversion_leads":
      return sum((r) => r.clickLeads[0]);
  }
  // conversions / conversion_value: нові проявлені лаги для рядків з моменту останнього редагування
  const kind = eventKind(adSet.optimizationEvent);
  const since = adSet.learning.lastSignificantEditDay ?? day;
  const window = adSet.attribution.clickWindowDays;
  let events = 0;
  const all = [...account.metrics.filter((m) => m.adSetId === adSet.id && m.day >= since), ...todays];
  for (const r of all) {
    const k = day - r.day;
    if (k < 0 || k >= window) continue;
    if (kind === "purchase") events += r.clickPurchases[k] ?? 0;
    else if (kind === "lead") events += r.clickLeads[k] ?? 0;
    else if (kind === "mid") events += k === 0 ? (adSet.optimizationEvent === "AddToCart" ? r.addToCarts : adSet.optimizationEvent === "InitiateCheckout" ? r.checkouts : r.contentViews) : 0;
    if (k === 0) {
      if (adSet.attribution.viewThrough) events += kind === "purchase" ? r.viewPurchases : kind === "lead" ? r.viewLeads : 0;
      if (adSet.attribution.engageThrough) events += kind === "purchase" ? r.engagePurchases : kind === "lead" ? r.engageLeads : 0;
    }
  }
  return events;
}

function budgetForAdSets(account: AdAccount, campaign: Campaign, sets: { adSet: AdSet; model: AdSetModel }[], day: SimDay): number[] {
  if (sets.length === 0) return [];
  const spentCampaign = totalSpend(account, (m) => m.campaignId === campaign.id);
  if (campaign.budgetLevel === "campaign") {
    let daily = campaign.budgetAmount;
    if (campaign.budgetType === "lifetime") {
      const ends = sets.map((s) => s.adSet.endDay ?? day);
      const lastDay = Math.max(...ends, day);
      daily = Math.max(0, (campaign.budgetAmount - spentCampaign) / (lastDay - day + 1));
    }
    if (campaign.abTest?.enabled && campaign.abTest.variable !== "creative") return sets.map(() => daily / sets.length);
    const eff = sets.map((s) => Math.max(1e-6, s.model.resultsPerDollar) ** 1.2);
    const sum = eff.reduce((a, b) => a + b, 0);
    const floor = 0.1 / sets.length;
    return eff.map((e) => daily * (floor + (1 - floor * sets.length) * (e / sum)));
  }
  const budgets = sets.map(({ adSet }) => {
    if (adSet.budgetType === "daily") return adSet.budgetAmount;
    const spent = totalSpend(account, (m) => m.adSetId === adSet.id);
    const lastDay = adSet.endDay ?? day;
    return Math.max(0, (adSet.budgetAmount - spent) / Math.max(1, lastDay - day + 1));
  });
  if (campaign.budgetSharing && sets.length >= 2) {
    const eff = sets.map((s) => s.model.resultsPerDollar);
    const median = [...eff].sort((a, b) => a - b)[Math.floor(eff.length / 2)];
    let pool = 0;
    const adjusted = budgets.map((b, i) => {
      if (eff[i] < median) {
        pool += b * 0.2;
        return b * 0.8;
      }
      return b;
    });
    const receivers = eff.map((e) => (e >= median ? e : 0));
    const rsum = receivers.reduce((a, b) => a + b, 0) || 1;
    return adjusted.map((b, i) => b + (pool * receivers[i]) / rsum);
  }
  return budgets;
}

function logEntry(account: AdAccount, day: SimDay, now: string, partial: Omit<ChangeLogEntry, "id" | "accountId" | "at" | "simDay" | "actor">): ChangeLogEntry {
  return {
    id: seededId("log", `${account.id}|${day}|${partial.entityId}|${partial.action}|${account.changeLog.length}`),
    accountId: account.id,
    at: now,
    simDay: day,
    actor: "system",
    ...partial,
  };
}

export function simulateOneDay(account: AdAccount, now: string): SimulationResult {
  const day = account.simDay;
  const notes: string[] = [];
  const logs: ChangeLogEntry[] = [];
  let ads = account.ads;
  let adSets = account.adSets;
  let campaigns = account.campaigns;

  // 1. Перевірка оголошень, поданих на модерацію.
  ads = ads.map((ad) => {
    if (ad.status !== "in_review") return ad;
    const adSet = adSets.find((s) => s.id === ad.adSetId);
    const campaign = campaigns.find((c) => c.id === ad.campaignId);
    if (!adSet || !campaign) return ad;
    const findings = reviewAd(ad, adSet, campaign, account);
    const outcome = reviewOutcome(findings);
    logs.push(
      logEntry(account, day, now, {
        entityType: "ad",
        entityId: ad.id,
        entityName: ad.name,
        action: outcome === "approved" ? "review_approved" : "review_rejected",
        changes: [],
        significantEdit: false,
        note: findings.map((f) => f.message).join(" ") || "Оголошення схвалено.",
      }),
    );
    return {
      ...ad,
      status: outcome === "approved" ? "active" : "rejected",
      review: { state: outcome, reasons: findings.map((f) => f.message), reviewedDay: day },
    };
  });
  campaigns = campaigns.map((c) => (c.status === "in_review" ? { ...c, status: "active" } : c));
  adSets = adSets.map((s) => (s.status === "in_review" ? { ...s, status: "active" } : s));

  let working: AdAccount = { ...account, ads, adSets, campaigns };
  let budgetLeft = account.virtualBudget - totalSpend(account);
  const newRows: DailyMetrics[] = [];
  const newSnaps: AdSetDaySnapshot[] = [];
  let daySpend = 0;
  const delivered = new Set<string>();

  for (const campaign of campaigns) {
    if (campaign.status !== "active") continue;
    const sets = adSets
      .filter((s) => s.campaignId === campaign.id && s.status === "active" && adSetInSchedule(s, day))
      .map((adSet) => ({ adSet, ads: ads.filter((a) => a.adSetId === adSet.id && isAdDeliverable(a)) }))
      .filter((x) => x.ads.length > 0)
      .map((x) => ({ ...x, model: buildAdSetModel(working, campaign, x.adSet, x.ads, day) }));
    const budgets = budgetForAdSets(working, campaign, sets, day);
    sets.forEach((s, i) => {
      if (budgetLeft <= 0.01) return;
      const res = simulateAdSetDay(working, campaign, s.adSet, s.ads, s.model, budgets[i], budgetLeft, day);
      budgetLeft -= res.spend;
      daySpend += res.spend;
      newRows.push(...res.rows);
      newSnaps.push(res.snapshot);
      notes.push(...res.notes);
      if (res.spend > 0) delivered.add(s.adSet.id);
    });
  }
  if (budgetLeft <= 0.01) notes.push("Віртуальний бюджет акаунта вичерпано — доставку зупинено.");

  // 2. Перший день доставки оголошень
  ads = ads.map((a) => (a.firstDeliveryDay === null && newRows.some((r) => r.adId === a.id && r.impressions > 0) ? { ...a, firstDeliveryDay: day } : a));

  // 3. Навчальна фаза
  working = { ...working, ads };
  adSets = adSets.map((s) => {
    const wasDelivering = delivered.has(s.id);
    if (!wasDelivering && s.learning.phase === "not_started") return s;
    if (!wasDelivering) return s;
    const base = s.learning.phase === "not_started" ? { ...s, learning: { ...s.learning, lastSignificantEditDay: day } } : s;
    const events = optimizationEventsRevealed(working, base, newRows, day);
    const learning = advanceLearning(base.learning, day, events, true);
    if (learning.phase !== s.learning.phase && learning.phase !== "learning") {
      logs.push(
        logEntry(account, day, now, {
          entityType: "ad_set",
          entityId: s.id,
          entityName: s.name,
          action: "update",
          changes: [{ field: "learning.phase", from: s.learning.phase, to: learning.phase }],
          significantEdit: false,
          note: learning.phase === "active" ? "Набір вийшов з навчальної фази." : "Навчання обмежене: мало подій оптимізації.",
        }),
      );
    }
    return { ...s, learning };
  });
  // Знімок фіксує фазу після оновлення
  for (const snap of newSnaps) {
    const s = adSets.find((x) => x.id === snap.adSetId);
    if (s) snap.learningPhase = s.learning.phase;
  }

  logs.push(
    logEntry(account, day, now, {
      entityType: "account",
      entityId: account.id,
      entityName: account.name,
      action: "simulate",
      changes: [],
      significantEdit: false,
      note: `Симуляція дня ${day + 1}: витрачено $${daySpend.toFixed(2)}.`,
    }),
  );

  return {
    account: {
      ...account,
      ads,
      adSets,
      campaigns,
      metrics: [...account.metrics, ...newRows],
      snapshots: [...account.snapshots, ...newSnaps],
      changeLog: [...account.changeLog, ...logs],
      simDay: day + 1,
    },
    notes,
    spend: round(daySpend, 2),
  };
}

export function simulateDays(account: AdAccount, days: number, now: string): SimulationResult {
  let acc = account;
  const notes: string[] = [];
  let spend = 0;
  for (let i = 0; i < days; i++) {
    const r = simulateOneDay(acc, now);
    acc = r.account;
    notes.push(...r.notes.map((n) => `День ${acc.simDay}: ${n}`));
    spend += r.spend;
  }
  const run = {
    id: seededId("run", `${account.id}|${account.simDay}|${days}`),
    accountId: account.id,
    createdAt: now,
    fromDay: account.simDay,
    days,
    spend: round(spend, 2),
    notes: Array.from(new Set(notes)).slice(0, 30),
  };
  return { account: { ...acc, runs: [...acc.runs, run] }, notes: run.notes, spend: run.spend };
}
