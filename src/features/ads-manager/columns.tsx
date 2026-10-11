"use client";

import type { ReactNode } from "react";
import { BID_STRATEGIES, objectiveLabel } from "@/domain/catalog";
import type { AdAccount, Ad, AdSet, Campaign } from "@/domain/types";
import { fmtCompact, fmtInt, fmtMoney, fmtNum, fmtPct, fmtRoas } from "@/lib/format";
import { fmtSimDate } from "@/lib/dates";
import { attributionLabel, type ReportedMetrics } from "@/simulation/reporting";

export type Level = "campaign" | "ad_set" | "ad";

export interface RowData {
  level: Level;
  entity: Campaign | AdSet | Ad;
  metrics: ReportedMetrics;
  account: AdAccount;
}

export interface ColumnDef {
  id: string;
  label: string;
  metricId?: string;
  align?: "left" | "right";
  levels?: Level[];
  render: (r: RowData) => ReactNode;
  sortValue?: (r: RowData) => number | string | null;
  total?: (m: ReportedMetrics) => ReactNode;
  width?: string;
}

const m = (fn: (x: ReportedMetrics) => number | null) => (r: RowData) => fn(r.metrics);

function budgetText(r: RowData): { text: string; sub: string } {
  const a = r.account;
  if (r.level === "campaign") {
    const c = r.entity as Campaign;
    if (c.budgetLevel === "campaign") return { text: fmtMoney(c.budgetAmount), sub: c.budgetType === "daily" ? "Daily · campaign" : "Lifetime · campaign" };
    return { text: "Using ad set budget", sub: c.budgetSharing ? "Budget sharing on" : "" };
  }
  if (r.level === "ad_set") {
    const s = r.entity as AdSet;
    const c = a.campaigns.find((x) => x.id === s.campaignId);
    if (c?.budgetLevel === "campaign") return { text: "Using campaign budget", sub: "" };
    return { text: fmtMoney(s.budgetAmount), sub: s.budgetType === "daily" ? "Daily" : "Lifetime" };
  }
  return { text: "", sub: "" };
}

function bidText(r: RowData): string {
  const a = r.account;
  if (r.level === "campaign") {
    const c = r.entity as Campaign;
    return c.budgetLevel === "campaign" ? BID_STRATEGIES[c.bidStrategy].label : "Using ad set bid strategy";
  }
  if (r.level === "ad_set") {
    const s = r.entity as AdSet;
    const c = a.campaigns.find((x) => x.id === s.campaignId);
    return c?.budgetLevel === "campaign" ? BID_STRATEGIES[c.bidStrategy].label : BID_STRATEGIES[s.bidStrategy].label;
  }
  return "";
}

export const COLUMNS: ColumnDef[] = [
  {
    id: "objective",
    label: "Objective",
    levels: ["campaign"],
    render: (r) => objectiveLabel((r.entity as Campaign).objective),
    sortValue: (r) => (r.entity as Campaign).objective,
  },
  {
    id: "bid",
    label: "Bid strategy",
    levels: ["campaign", "ad_set"],
    render: (r) => <span className="text-xs">{bidText(r)}</span>,
  },
  {
    id: "budget",
    label: "Budget",
    align: "right",
    levels: ["campaign", "ad_set"],
    render: (r) => {
      const b = budgetText(r);
      return (
        <span className="flex flex-col items-end leading-tight">
          <span className="num">{b.text}</span>
          {b.sub && <span className="text-2xs text-muted-foreground">{b.sub}</span>}
        </span>
      );
    },
  },
  {
    id: "attribution",
    label: "Attribution setting",
    levels: ["ad_set"],
    metricId: "attribution",
    render: (r) => <span className="text-xs">{attributionLabel((r.entity as AdSet).attribution)}</span>,
  },
  {
    id: "results",
    label: "Results",
    metricId: "results",
    align: "right",
    render: (r) => (
      <span className="flex flex-col items-end leading-tight">
        <span className="num font-medium">{fmtInt(r.metrics.results)}</span>
        <span className="max-w-[140px] truncate text-2xs text-muted-foreground" title={r.metrics.resultLabel}>
          {r.metrics.resultLabel}
          {r.metrics.incomplete ? " *" : ""}
        </span>
      </span>
    ),
    sortValue: m((x) => x.results),
    total: (x) => (
      <span className="flex flex-col items-end leading-tight">
        <span className="num">{fmtInt(x.results)}</span>
        <span className="text-2xs text-muted-foreground">{x.resultLabel}</span>
      </span>
    ),
  },
  { id: "reach", label: "Reach", metricId: "reach", align: "right", render: (r) => fmtInt(r.metrics.reach), sortValue: m((x) => x.reach), total: (x) => fmtInt(x.reach) },
  { id: "frequency", label: "Frequency", metricId: "frequency", align: "right", render: (r) => fmtNum(r.metrics.frequency), sortValue: m((x) => x.frequency), total: (x) => fmtNum(x.frequency) },
  {
    id: "costPerResult",
    label: "Cost per result",
    metricId: "costPerResult",
    align: "right",
    render: (r) => fmtMoney(r.metrics.costPerResult),
    sortValue: m((x) => x.costPerResult),
    total: (x) => fmtMoney(x.costPerResult),
  },
  { id: "spend", label: "Amount spent", metricId: "spend", align: "right", render: (r) => fmtMoney(r.metrics.spend), sortValue: m((x) => x.spend), total: (x) => fmtMoney(x.spend) },
  { id: "impressions", label: "Impressions", metricId: "impressions", align: "right", render: (r) => fmtInt(r.metrics.impressions), sortValue: m((x) => x.impressions), total: (x) => fmtInt(x.impressions) },
  { id: "cpm", label: "CPM", metricId: "cpm", align: "right", render: (r) => fmtMoney(r.metrics.cpm), sortValue: m((x) => x.cpm), total: (x) => fmtMoney(x.cpm) },
  { id: "linkClicks", label: "Link clicks", metricId: "linkClicks", align: "right", render: (r) => fmtInt(r.metrics.linkClicks), sortValue: m((x) => x.linkClicks), total: (x) => fmtInt(x.linkClicks) },
  { id: "ctrLink", label: "CTR (link)", metricId: "ctrLink", align: "right", render: (r) => fmtPct(r.metrics.ctrLink), sortValue: m((x) => x.ctrLink), total: (x) => fmtPct(x.ctrLink) },
  { id: "cpcLink", label: "CPC (link)", metricId: "cpcLink", align: "right", render: (r) => fmtMoney(r.metrics.cpcLink), sortValue: m((x) => x.cpcLink), total: (x) => fmtMoney(x.cpcLink) },
  { id: "clicksAll", label: "Clicks (all)", metricId: "clicksAll", align: "right", render: (r) => fmtInt(r.metrics.clicksAll), sortValue: m((x) => x.clicksAll), total: (x) => fmtInt(x.clicksAll) },
  { id: "ctrAll", label: "CTR (all)", metricId: "ctrAll", align: "right", render: (r) => fmtPct(r.metrics.ctrAll), sortValue: m((x) => x.ctrAll), total: (x) => fmtPct(x.ctrAll) },
  { id: "outboundClicks", label: "Outbound clicks", metricId: "outboundClicks", align: "right", render: (r) => fmtInt(r.metrics.outboundClicks), sortValue: m((x) => x.outboundClicks), total: (x) => fmtInt(x.outboundClicks) },
  { id: "lpv", label: "Landing page views", metricId: "landingPageViews", align: "right", render: (r) => fmtInt(r.metrics.landingPageViews), sortValue: m((x) => x.landingPageViews), total: (x) => fmtInt(x.landingPageViews) },
  { id: "lpvRate", label: "LPV rate", metricId: "lpvRate", align: "right", render: (r) => fmtPct(r.metrics.lpvRate, 1), sortValue: m((x) => x.lpvRate), total: (x) => fmtPct(x.lpvRate, 1) },
  { id: "costPerLpv", label: "Cost per LPV", metricId: "costPerLpv", align: "right", render: (r) => fmtMoney(r.metrics.costPerLpv), sortValue: m((x) => x.costPerLpv), total: (x) => fmtMoney(x.costPerLpv) },
  { id: "leads", label: "Leads", metricId: "leads", align: "right", render: (r) => fmtInt(r.metrics.leads), sortValue: m((x) => x.leads), total: (x) => fmtInt(x.leads) },
  { id: "cpl", label: "Cost per lead", metricId: "cpl", align: "right", render: (r) => fmtMoney(r.metrics.cpl), sortValue: m((x) => x.cpl), total: (x) => fmtMoney(x.cpl) },
  { id: "leadRate", label: "Lead CVR", metricId: "leadRate", align: "right", render: (r) => fmtPct(r.metrics.leadRate), sortValue: m((x) => x.leadRate), total: (x) => fmtPct(x.leadRate) },
  { id: "contentViews", label: "Content views", metricId: "contentViews", align: "right", render: (r) => fmtInt(r.metrics.contentViews), sortValue: m((x) => x.contentViews), total: (x) => fmtInt(x.contentViews) },
  { id: "addToCarts", label: "Adds to cart", metricId: "addToCarts", align: "right", render: (r) => fmtInt(r.metrics.addToCarts), sortValue: m((x) => x.addToCarts), total: (x) => fmtInt(x.addToCarts) },
  { id: "checkouts", label: "Checkouts", metricId: "checkouts", align: "right", render: (r) => fmtInt(r.metrics.checkouts), sortValue: m((x) => x.checkouts), total: (x) => fmtInt(x.checkouts) },
  { id: "purchases", label: "Purchases", metricId: "purchases", align: "right", render: (r) => fmtInt(r.metrics.purchases), sortValue: m((x) => x.purchases), total: (x) => fmtInt(x.purchases) },
  { id: "cpa", label: "Cost per purchase", metricId: "cpa", align: "right", render: (r) => fmtMoney(r.metrics.cpa), sortValue: m((x) => x.cpa), total: (x) => fmtMoney(x.cpa) },
  { id: "purchaseValue", label: "Purchase value", metricId: "purchaseValue", align: "right", render: (r) => fmtMoney(r.metrics.purchaseValue), sortValue: m((x) => x.purchaseValue), total: (x) => fmtMoney(x.purchaseValue) },
  { id: "roas", label: "Purchase ROAS", metricId: "roas", align: "right", render: (r) => fmtRoas(r.metrics.roas), sortValue: m((x) => x.roas), total: (x) => fmtRoas(x.roas) },
  { id: "videoPlays3s", label: "3s video plays", metricId: "videoPlays3s", align: "right", render: (r) => fmtInt(r.metrics.videoPlays3s), sortValue: m((x) => x.videoPlays3s), total: (x) => fmtInt(x.videoPlays3s) },
  { id: "thruPlays", label: "ThruPlays", metricId: "thruPlays", align: "right", render: (r) => fmtInt(r.metrics.thruPlays), sortValue: m((x) => x.thruPlays), total: (x) => fmtInt(x.thruPlays) },
  { id: "postEngagements", label: "Post engagements", metricId: "postEngagements", align: "right", render: (r) => fmtInt(r.metrics.postEngagements), sortValue: m((x) => x.postEngagements), total: (x) => fmtInt(x.postEngagements) },
  { id: "conversations", label: "Conversations", metricId: "conversations", align: "right", render: (r) => fmtInt(r.metrics.conversations), sortValue: m((x) => x.conversations), total: (x) => fmtInt(x.conversations) },
  { id: "installs", label: "App installs", metricId: "installs", align: "right", render: (r) => fmtInt(r.metrics.installs), sortValue: m((x) => x.installs), total: (x) => fmtInt(x.installs) },
  {
    id: "ends",
    label: "Ends",
    levels: ["ad_set"],
    render: (r) => {
      const s = r.entity as AdSet;
      return <span className="text-xs">{s.endDay === null ? "Ongoing" : fmtSimDate(r.account.startDate, s.endDay)}</span>;
    },
  },
  {
    id: "audienceSize",
    label: "Est. audience",
    levels: ["ad_set"],
    align: "right",
    render: (r) => {
      const snap = [...r.account.snapshots].reverse().find((x) => x.adSetId === r.entity.id);
      return snap ? fmtCompact(snap.audienceSize) : "—";
    },
  },
];

export const COLUMN_PRESETS: Record<string, { label: string; columns: string[] }> = {
  performance: { label: "Performance", columns: ["results", "reach", "frequency", "costPerResult", "budget", "spend", "impressions", "cpm", "linkClicks", "ctrLink", "cpcLink", "ends"] },
  delivery: { label: "Delivery", columns: ["bid", "budget", "spend", "reach", "impressions", "frequency", "cpm", "audienceSize", "attribution", "ends"] },
  engagement: { label: "Engagement", columns: ["postEngagements", "clicksAll", "ctrAll", "linkClicks", "ctrLink", "videoPlays3s", "thruPlays", "spend"] },
  traffic: { label: "Traffic & funnel", columns: ["linkClicks", "outboundClicks", "lpv", "lpvRate", "costPerLpv", "ctrLink", "cpcLink", "spend"] },
  leads: { label: "Leads", columns: ["results", "leads", "cpl", "leadRate", "lpv", "ctrLink", "cpm", "frequency", "spend"] },
  sales: { label: "Sales", columns: ["results", "contentViews", "addToCarts", "checkouts", "purchases", "cpa", "purchaseValue", "roas", "spend"] },
  video: { label: "Video", columns: ["videoPlays3s", "thruPlays", "reach", "frequency", "cpm", "spend"] },
};
