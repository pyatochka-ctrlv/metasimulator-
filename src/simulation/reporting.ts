import { PERFORMANCE_GOALS } from "@/domain/catalog";
import type { AdAccount, AdSet, AttributionSetting, DailyMetrics, PerformanceGoal, PixelEvent } from "@/domain/types";
import { reachFromImpressions } from "./audience";
import { eventKind, LEAD_EVENTS } from "./model";
import { conversionRate, costPer, cpc, cpm, ctr, roas, safeDiv } from "./metrics";

/**
 * Звітні метрики (як їх показав би рекламний кабінет) обчислюються з «сирих» рядків під час запиту:
 *  - конверсії враховуються лише в межах вікна атрибуції набору (або обраного для порівняння);
 *  - конверсії з затримкою стають видимими лише після симуляції відповідних днів;
 *  - охоплення не сумується — воно оцінюється з показів і ефективної аудиторії.
 */

export interface ReportedMetrics {
  rows: number;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number | null;
  clicksAll: number;
  linkClicks: number;
  outboundClicks: number;
  landingPageViews: number;
  ctrAll: number | null;
  ctrLink: number | null;
  cpcLink: number | null;
  cpcAll: number | null;
  cpm: number | null;
  costPerLpv: number | null;
  lpvRate: number | null;
  postEngagements: number;
  videoPlays3s: number;
  thruPlays: number;
  conversations: number;
  calls: number;
  installs: number;
  appEvents: number;
  contentViews: number;
  addToCarts: number;
  checkouts: number;
  leads: number;
  purchases: number;
  purchaseValue: number;
  cpl: number | null;
  cpa: number | null;
  roas: number | null;
  aov: number | null;
  leadRate: number | null;
  purchaseRate: number | null;
  results: number | null;
  resultLabel: string;
  costPerResult: number | null;
  /** Частина конверсій ще може «доїхати» (затримка). */
  incomplete: boolean;
  // Бізнес-дані (CRM / бекенд)
  trueLeads: number;
  qualifiedLeads: number;
  qualifiedRate: number | null;
  costPerQualifiedLead: number | null;
  truePurchases: number;
  trueRevenue: number;
  crmLeads: number;
  crmPurchases: number;
  salesFromLeads: number;
  revenueFromLeads: number;
  /** ROAS за даними бізнесу (а не атрибуції). */
  businessRoas: number | null;
}

export interface ReportOptions {
  /** Перевизначення вікна атрибуції для порівняння. */
  attribution?: AttributionSetting;
}

function attributionFor(adSet: AdSet | undefined, opts: ReportOptions): AttributionSetting {
  return opts.attribution ?? adSet?.attribution ?? { clickWindowDays: 7, viewThrough: true, engageThrough: true };
}

export function knownLags(account: Pick<AdAccount, "simDay">, row: Pick<DailyMetrics, "day">): number {
  return account.simDay - 1 - row.day;
}

/** Звітні ліди/покупки рядка з урахуванням вікна атрибуції та затримки. */
export function rowConversions(account: AdAccount, row: DailyMetrics, attr: AttributionSetting) {
  const known = knownLags(account, row);
  const upto = Math.min(attr.clickWindowDays - 1, known);
  let leads = 0;
  let purchases = 0;
  let value = 0;
  for (let k = 0; k <= upto; k++) {
    leads += row.clickLeads[k] ?? 0;
    purchases += row.clickPurchases[k] ?? 0;
    value += row.clickValue[k] ?? 0;
  }
  if (attr.viewThrough) {
    leads += row.viewLeads;
    purchases += row.viewPurchases;
    value += row.viewValue;
  }
  if (attr.engageThrough) {
    leads += row.engageLeads;
    purchases += row.engagePurchases;
    value += row.engageValue;
  }
  const incomplete = known < attr.clickWindowDays - 1 && (row.trueLeads > 0 || row.truePurchases > 0);
  return { leads, purchases, value, incomplete };
}

function resultForRow(account: AdAccount, row: DailyMetrics, adSet: AdSet | undefined, conv: { leads: number; purchases: number }): number {
  const goal: PerformanceGoal = adSet?.performanceGoal ?? "link_clicks";
  switch (goal) {
    case "reach":
    case "daily_unique_reach":
      return row.reach;
    case "impressions":
      return row.impressions;
    case "ad_recall_lift":
      return Math.round(row.reach * 0.05);
    case "thruplay":
      return row.thruPlays;
    case "video_views_2s":
      return Math.round(row.videoPlays3s * 1.15);
    case "link_clicks":
      return row.linkClicks;
    case "landing_page_views":
      return row.landingPageViews;
    case "conversations":
      return row.conversations;
    case "post_engagement":
      return row.postEngagements;
    case "calls":
      return row.calls;
    case "leads":
    case "conversion_leads":
      return conv.leads;
    case "app_installs":
      return row.installs;
    case "app_events":
      return row.appEvents;
    case "conversions":
    case "conversion_value": {
      const kind = eventKind(adSet?.optimizationEvent ?? null);
      if (kind === "purchase") return conv.purchases;
      if (kind === "lead") return conv.leads;
      if (kind === "mid") {
        const ev = adSet?.optimizationEvent as PixelEvent;
        return ev === "AddToCart" ? row.addToCarts : ev === "InitiateCheckout" ? row.checkouts : row.contentViews;
      }
      return 0;
    }
  }
}

export function resultLabelFor(adSet: AdSet | undefined): string {
  if (!adSet) return "Results";
  if ((adSet.performanceGoal === "conversions" || adSet.performanceGoal === "conversion_value") && adSet.optimizationEvent) {
    const ev = adSet.optimizationEvent;
    if (LEAD_EVENTS.includes(ev as PixelEvent)) return `Website ${ev === "Lead" ? "leads" : ev}`;
    return ev === "Purchase" ? "Website purchases" : `Website ${ev}`;
  }
  return PERFORMANCE_GOALS[adSet.performanceGoal].resultLabel;
}

export function aggregate(account: AdAccount, rows: DailyMetrics[], opts: ReportOptions = {}): ReportedMetrics {
  const adSetMap = new Map(account.adSets.map((s) => [s.id, s] as const));
  let spend = 0,
    impressions = 0,
    clicksAll = 0,
    linkClicks = 0,
    outboundClicks = 0,
    landingPageViews = 0,
    postEngagements = 0,
    videoPlays3s = 0,
    thruPlays = 0,
    conversations = 0,
    calls = 0,
    installs = 0,
    appEvents = 0,
    contentViews = 0,
    addToCarts = 0,
    checkouts = 0,
    leads = 0,
    purchases = 0,
    purchaseValue = 0,
    trueLeads = 0,
    qualifiedLeads = 0,
    truePurchases = 0,
    trueRevenue = 0,
    crmLeads = 0,
    crmPurchases = 0,
    results = 0;
  let incomplete = false;
  const labels = new Set<string>();
  const impressionsByAdSet = new Map<string, number>();

  for (const r of rows) {
    const adSet = adSetMap.get(r.adSetId);
    const attr = attributionFor(adSet, opts);
    const conv = rowConversions(account, r, attr);
    spend += r.spend;
    impressions += r.impressions;
    clicksAll += r.clicksAll;
    linkClicks += r.linkClicks;
    outboundClicks += r.outboundClicks;
    landingPageViews += r.landingPageViews;
    postEngagements += r.postEngagements;
    videoPlays3s += r.videoPlays3s;
    thruPlays += r.thruPlays;
    conversations += r.conversations;
    calls += r.calls;
    installs += r.installs;
    appEvents += r.appEvents;
    contentViews += r.contentViews;
    addToCarts += r.addToCarts;
    checkouts += r.checkouts;
    leads += conv.leads;
    purchases += conv.purchases;
    purchaseValue += conv.value;
    trueLeads += r.trueLeads;
    qualifiedLeads += r.qualifiedLeads;
    truePurchases += r.truePurchases;
    trueRevenue += r.trueRevenue;
    crmLeads += r.crmAttributedLeads;
    crmPurchases += r.crmAttributedPurchases;
    const convGoal = adSet ? ["leads", "conversion_leads", "conversions", "conversion_value"].includes(adSet.performanceGoal) : false;
    incomplete = incomplete || (convGoal && conv.incomplete);
    results += resultForRow(account, r, adSet, conv);
    labels.add(resultLabelFor(adSet));
    impressionsByAdSet.set(r.adSetId, (impressionsByAdSet.get(r.adSetId) ?? 0) + r.impressions);
  }

  // Охоплення: оцінюємо по кожному набору з його ефективною аудиторією; між наборами — сума (без урахування перетину).
  let reach = 0;
  const singleDay = new Set(rows.map((r) => r.day)).size <= 1;
  if (singleDay) {
    reach = rows.reduce((a, r) => a + r.reach, 0);
  } else {
    for (const [adSetId, imp] of impressionsByAdSet) {
      const snap = [...account.snapshots].reverse().find((s) => s.adSetId === adSetId);
      const audience = snap?.effectiveAudience ?? 100_000;
      reach += Math.min(imp, reachFromImpressions(imp, audience));
    }
  }
  reach = Math.round(reach);

  const economics = account.economics;
  const salesFromLeads = Math.round(qualifiedLeads * economics.leadToSaleRate);
  const revenueFromLeads = salesFromLeads * economics.saleValueFromLead;
  const resultLabel = labels.size === 1 ? [...labels][0] : labels.size === 0 ? "Results" : "Різні типи результатів";
  const resultsValue = labels.size <= 1 ? results : null;

  return {
    rows: rows.length,
    spend,
    impressions,
    reach,
    frequency: safeDiv(impressions, reach),
    clicksAll,
    linkClicks,
    outboundClicks,
    landingPageViews,
    ctrAll: ctr(clicksAll, impressions),
    ctrLink: ctr(linkClicks, impressions),
    cpcLink: cpc(spend, linkClicks),
    cpcAll: cpc(spend, clicksAll),
    cpm: cpm(spend, impressions),
    costPerLpv: costPer(spend, landingPageViews),
    lpvRate: conversionRate(landingPageViews, outboundClicks),
    postEngagements,
    videoPlays3s,
    thruPlays,
    conversations,
    calls,
    installs,
    appEvents,
    contentViews,
    addToCarts,
    checkouts,
    leads,
    purchases,
    purchaseValue,
    cpl: costPer(spend, leads),
    cpa: costPer(spend, purchases),
    roas: roas(purchaseValue, spend),
    aov: safeDiv(purchaseValue, purchases),
    leadRate: conversionRate(leads, landingPageViews),
    purchaseRate: conversionRate(purchases, landingPageViews),
    results: resultsValue,
    resultLabel,
    costPerResult: resultsValue === null ? null : costPer(spend, resultsValue),
    incomplete,
    trueLeads,
    qualifiedLeads,
    qualifiedRate: conversionRate(qualifiedLeads, trueLeads),
    costPerQualifiedLead: costPer(spend, qualifiedLeads),
    truePurchases,
    trueRevenue,
    crmLeads,
    crmPurchases,
    salesFromLeads,
    revenueFromLeads,
    businessRoas: roas(trueRevenue + revenueFromLeads, spend),
  };
}

export type RangeKey = "today" | "last_7" | "last_14" | "last_30" | "lifetime";

export function rangeDays(account: Pick<AdAccount, "simDay">, range: RangeKey): [number, number] {
  const last = account.simDay - 1;
  switch (range) {
    case "today":
      return [last, last];
    case "last_7":
      return [Math.max(0, last - 6), last];
    case "last_14":
      return [Math.max(0, last - 13), last];
    case "last_30":
      return [Math.max(0, last - 29), last];
    default:
      return [0, last];
  }
}

export function rowsInRange(account: AdAccount, range: RangeKey, filter?: (r: DailyMetrics) => boolean): DailyMetrics[] {
  const [from, to] = rangeDays(account, range);
  return account.metrics.filter((r) => r.day >= from && r.day <= to && (!filter || filter(r)));
}

export const ATTRIBUTION_PRESETS: { id: string; label: string; setting: AttributionSetting }[] = [
  { id: "1dc", label: "1-day click", setting: { clickWindowDays: 1, viewThrough: false, engageThrough: false } },
  { id: "7dc", label: "7-day click", setting: { clickWindowDays: 7, viewThrough: false, engageThrough: false } },
  { id: "7dc1dv", label: "7-day click + 1-day view", setting: { clickWindowDays: 7, viewThrough: true, engageThrough: false } },
  {
    id: "7dc1de1dv",
    label: "7-day click + 1-day engage-through + 1-day view",
    setting: { clickWindowDays: 7, viewThrough: true, engageThrough: true },
  },
];

export function attributionLabel(a: AttributionSetting): string {
  const parts = [`${a.clickWindowDays}-day click`];
  if (a.engageThrough) parts.push("1-day engage-through");
  if (a.viewThrough) parts.push("1-day view");
  return parts.join(", ");
}
