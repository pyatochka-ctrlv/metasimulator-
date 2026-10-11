"use client";

import { useMemo } from "react";
import { Gauge } from "lucide-react";
import { PERFORMANCE_GOALS } from "@/domain/catalog";
import { libMedia } from "@/domain/account-builder";
import { defaultCreative } from "@/domain/factories";
import type { AdAccount, Ad, AdSet, Campaign } from "@/domain/types";
import { buildAdSetModel } from "@/simulation/model";
import { LEARNING_EVENTS_THRESHOLD } from "@/simulation/learning";
import { fmtCompact, fmtInt, fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

function placeholderAd(account: AdAccount, adSet: AdSet): Ad {
  return {
    id: "preview_ad",
    seq: 0,
    accountId: account.id,
    campaignId: adSet.campaignId,
    adSetId: adSet.id,
    name: "preview",
    status: "draft",
    facebookPageId: "",
    instagramAccountId: null,
    format: "single_image",
    creative: { ...defaultCreative(account), media: [libMedia("edu_mentor_square")], primaryText: account.landingPage.offerKeywords.join(", "), headline: "Заголовок", cta: "LEARN_MORE" },
    review: null,
    firstDeliveryDay: null,
    createdAt: "",
    updatedAt: "",
  };
}

/** Прогноз «очікуваних» щоденних результатів набору (аналог оцінки в кабінеті, але з навчальної моделі). */
export function EstimatePanel({ account, campaign, adSet }: { account: AdAccount; campaign: Campaign; adSet: AdSet }) {
  const est = useMemo(() => {
    try {
      const ads = account.ads.filter((a) => a.adSetId === adSet.id);
      const model = buildAdSetModel(account, campaign, adSet, ads.length ? ads : [placeholderAd(account, adSet)], account.simDay);
      const setsInCampaign = Math.max(1, account.adSets.filter((s) => s.campaignId === campaign.id).length);
      const daily =
        campaign.budgetLevel === "campaign"
          ? (campaign.budgetType === "daily" ? campaign.budgetAmount : campaign.budgetAmount / 14) / setsInCampaign
          : adSet.budgetType === "daily"
            ? adSet.budgetAmount
            : adSet.budgetAmount / Math.max(1, (adSet.endDay ?? adSet.startDay + 14) - adSet.startDay + 1);
      const maxSpend = (model.maxDailyImpressions * model.cpm) / 1000;
      const spend = Math.min(daily, maxSpend);
      const results = spend * model.resultsPerDollar;
      return { model, daily, spend, results, limitedByInventory: maxSpend < daily * 0.8, usesPlaceholder: ads.length === 0 };
    } catch {
      return null;
    }
  }, [account, campaign, adSet]);

  if (!est) return null;
  const { model } = est;
  const weekly = est.results * 7;
  const conversionGoal = ["conversions", "conversion_value", "leads", "conversion_leads", "app_events", "app_installs"].includes(adSet.performanceGoal);
  const learningOk = !conversionGoal || weekly >= LEARNING_EVENTS_THRESHOLD;
  const label = PERFORMANCE_GOALS[adSet.performanceGoal]?.resultLabel ?? "Results";
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <Gauge className="h-4 w-4 text-primary" />
        <h3 className="text-[13px] font-semibold">Оцінка на день</h3>
      </div>
      <dl className="grid gap-2.5 p-3 text-xs">
        <div>
          <dt className="text-muted-foreground">Потенційна аудиторія</dt>
          <dd className="num font-semibold">
            {fmtCompact(model.audience.lower)} – {fmtCompact(model.audience.upper)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Денний бюджет набору {campaign.budgetLevel === "campaign" && "(частка campaign budget)"}</dt>
          <dd className="num font-semibold">{fmtMoney(est.daily)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Очікуваний CPM</dt>
          <dd className="num font-semibold">
            {fmtMoney(model.cpm * 0.85)} – {fmtMoney(model.cpm * 1.15)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{label} / день</dt>
          <dd className="num font-semibold">
            {fmtInt(est.results * 0.7)} – {fmtInt(est.results * 1.3)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Cost per result</dt>
          <dd className="num font-semibold">
            {model.costPerResult ? `${fmtMoney(model.costPerResult * 0.8)} – ${fmtMoney(model.costPerResult * 1.25)}` : "—"}
          </dd>
        </div>
        {conversionGoal && (
          <div className={cn("rounded-md px-2 py-1.5", learningOk ? "bg-success/10" : "bg-warning/10")}>
            <dt className="text-muted-foreground">Подій оптимізації за 7 днів</dt>
            <dd className="num font-semibold">
              ≈ {fmtInt(weekly)} {learningOk ? "· вистачає для навчання" : `· < ${LEARNING_EVENTS_THRESHOLD}: ризик Learning limited`}
            </dd>
          </div>
        )}
        {est.limitedByInventory && <p className="rounded-md bg-warning/10 px-2 py-1.5 text-warning">Аудиторія замала, щоб витратити бюджет.</p>}
        {model.notes.map((n) => (
          <p key={n} className="text-2xs text-muted-foreground">
            • {n}
          </p>
        ))}
      </dl>
      <p className="border-t px-3 py-2 text-2xs text-muted-foreground">
        Оцінка навчальної моделі{est.usesPlaceholder ? " (з типовим креативом — оголошень ще немає)" : ""}. Фактичні результати симуляції містять випадкові коливання.
      </p>
    </div>
  );
}
