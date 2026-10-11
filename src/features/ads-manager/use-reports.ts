"use client";

import { useMemo } from "react";
import type { AdAccount, DailyMetrics } from "@/domain/types";
import { aggregate, rangeDays, type RangeKey, type ReportedMetrics } from "@/simulation/reporting";

export interface EntityReports {
  byCampaign: Map<string, ReportedMetrics>;
  byAdSet: Map<string, ReportedMetrics>;
  byAd: Map<string, ReportedMetrics>;
  rows: DailyMetrics[];
  empty: ReportedMetrics;
}

function group(rows: DailyMetrics[], key: (r: DailyMetrics) => string) {
  const m = new Map<string, DailyMetrics[]>();
  for (const r of rows) {
    const k = key(r);
    const list = m.get(k);
    if (list) list.push(r);
    else m.set(k, [r]);
  }
  return m;
}

export function useEntityReports(account: AdAccount | undefined, range: RangeKey): EntityReports | null {
  return useMemo(() => {
    if (!account) return null;
    const [from, to] = rangeDays(account, range);
    const rows = account.metrics.filter((r) => r.day >= from && r.day <= to);
    const toMap = (g: Map<string, DailyMetrics[]>) => new Map([...g].map(([k, v]) => [k, aggregate(account, v)] as const));
    return {
      byCampaign: toMap(group(rows, (r) => r.campaignId)),
      byAdSet: toMap(group(rows, (r) => r.adSetId)),
      byAd: toMap(group(rows, (r) => r.adId)),
      rows,
      empty: aggregate(account, []),
    };
  }, [account, range]);
}

export const RANGE_LABELS: Record<RangeKey, string> = {
  today: "Останній день",
  last_7: "Останні 7 днів",
  last_14: "Останні 14 днів",
  last_30: "Останні 30 днів",
  lifetime: "Весь період",
};
