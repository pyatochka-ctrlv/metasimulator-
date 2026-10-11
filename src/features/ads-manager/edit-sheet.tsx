"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { updateAd, updateAdSet, updateCampaign } from "@/domain/operations";
import type { AdAccount, Ad, AdSet, Campaign } from "@/domain/types";
import { aggregate } from "@/simulation/reporting";
import { fmtShortSimDate } from "@/lib/dates";
import { fmtMoney, fmtNum } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, SimulatedNotice } from "@/components/common";
import { CampaignForm, campaignToForm, formToCampaignPatch } from "@/features/campaign-builder/forms/campaign-form";
import { AdSetForm, adSetToForm, formToAdSetPatch } from "@/features/campaign-builder/forms/ad-set-form";
import { AdForm, adToForm, formToAdPatch } from "@/features/campaign-builder/forms/ad-form";
import { TrendChart } from "@/features/analytics/charts";
import type { Level } from "./columns";
import { ChangeLog } from "./change-log";

export interface EditTarget {
  level: Level;
  id: string;
}

function EntityInsights({ account, target }: { account: AdAccount; target: EditTarget }) {
  const data = useMemo(() => {
    const rows = account.metrics.filter((m) => (target.level === "campaign" ? m.campaignId : target.level === "ad_set" ? m.adSetId : m.adId) === target.id);
    const days = Array.from(new Set(rows.map((r) => r.day))).sort((a, b) => a - b);
    return days.map((d) => {
      const r = aggregate(account, rows.filter((x) => x.day === d));
      return { date: fmtShortSimDate(account.startDate, d), spend: Math.round(r.spend * 100) / 100, results: r.results ?? 0, cpr: r.costPerResult, ctr: r.ctrLink, freq: r.frequency };
    });
  }, [account, target]);
  if (!data.length) return <EmptyState title="Ще немає даних" description="Опублікуйте об'єкт і запустіть симуляцію, щоб побачити динаміку." />;
  return (
    <div className="grid gap-3">
      <SimulatedNotice compact />
      <TrendChart title="Результати по днях" data={data} xKey="date" series={[{ key: "results", label: "Results" }]} format={(v) => fmtNum(v, 0)} height={180} />
      <TrendChart title="Cost per result" data={data} xKey="date" series={[{ key: "cpr", label: "Cost per result" }]} format={(v) => fmtMoney(v)} height={180} />
      <TrendChart title="CTR (link), %" data={data} xKey="date" series={[{ key: "ctr", label: "CTR" }]} format={(v) => `${fmtNum(v)}%`} height={180} />
    </div>
  );
}

export function EditSheet({ account, target, onClose }: { account: AdAccount; target: EditTarget | null; onClose: () => void }) {
  const mutate = useAppStore((s) => s.mutateAccount);
  const [tab, setTab] = useState("settings");
  const [dirty, setDirty] = useState(false);
  const entity = useMemo(() => {
    if (!target) return null;
    if (target.level === "campaign") return account.campaigns.find((c) => c.id === target.id) ?? null;
    if (target.level === "ad_set") return account.adSets.find((c) => c.id === target.id) ?? null;
    return account.ads.find((c) => c.id === target.id) ?? null;
  }, [account, target]);

  const formId = `edit-${target?.level}-${target?.id}`;
  const published = entity ? entity.status !== "draft" : false;
  const readOnly = Boolean(account.readOnly);

  const save = (fn: (a: AdAccount) => AdAccount, msg: string) => {
    const before = account.changeLog.length;
    mutate(account.id, fn);
    const after = useAppStore.getState().accounts[account.id];
    const resets = after.changeLog.slice(before).filter((e) => e.action === "learning_reset").length;
    toast.success(msg, resets ? { description: `Суттєве редагування: навчальна фаза скинута (${resets}).` } : undefined);
    setDirty(false);
  };

  return (
    <Sheet open={Boolean(target)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="max-w-[1100px]">
        <SheetHeader>
          <SheetTitle>{entity ? `${target?.level === "campaign" ? "Кампанія" : target?.level === "ad_set" ? "Набір оголошень" : "Оголошення"}: ${entity.name}` : "Не знайдено"}</SheetTitle>
          <SheetDescription>
            {readOnly
              ? "Акаунт лише для перегляду."
              : published
                ? "Зміни опублікованих об'єктів застосовуються одразу. Суттєві зміни (аудиторія, плейсменти, подія, ставки, креатив, бюджет > 20%) скидають навчальну фазу; змінені оголошення повторно проходять перевірку."
                : "Чернетка: зміни збережуться без публікації."}
          </SheetDescription>
        </SheetHeader>
        {entity && target ? (
          <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
            <TabsList className="px-5">
              <TabsTrigger value="settings">Налаштування</TabsTrigger>
              <TabsTrigger value="insights">Статистика</TabsTrigger>
              <TabsTrigger value="history">Історія змін</TabsTrigger>
            </TabsList>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <TabsContent value="settings">
                <fieldset disabled={readOnly} className="contents">
                  {target.level === "campaign" && (
                    <CampaignForm
                      key={entity.id}
                      formId={formId}
                      initial={campaignToForm(entity as Campaign)}
                      published={published}
                      onDirtyChange={setDirty}
                      onSubmit={(v) => save((a) => updateCampaign(a, entity.id, formToCampaignPatch(v)), "Кампанію оновлено")}
                    />
                  )}
                  {target.level === "ad_set" &&
                    (() => {
                      const s = entity as AdSet;
                      const c = account.campaigns.find((x) => x.id === s.campaignId)!;
                      return (
                        <AdSetForm
                          key={entity.id}
                          formId={formId}
                          account={account}
                          campaign={c}
                          base={s}
                          initial={adSetToForm(s)}
                          onDirtyChange={setDirty}
                          onSubmit={(v) => save((a) => updateAdSet(a, s.id, formToAdSetPatch(v)), "Набір оновлено")}
                        />
                      );
                    })()}
                  {target.level === "ad" &&
                    (() => {
                      const ad = entity as Ad;
                      const s = account.adSets.find((x) => x.id === ad.adSetId)!;
                      const c = account.campaigns.find((x) => x.id === ad.campaignId)!;
                      const needsForm = s.conversionLocation === "instant_forms" || s.conversionLocation === "website_and_instant_forms";
                      return (
                        <>
                          {ad.status === "rejected" && ad.review && (
                            <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
                              <p className="font-semibold text-destructive">Оголошення відхилено</p>
                              <ul className="mt-1 list-disc pl-4">
                                {ad.review.reasons.map((r) => (
                                  <li key={r}>{r}</li>
                                ))}
                              </ul>
                              <p className="mt-1 text-muted-foreground">Виправте креатив і знову опублікуйте кампанію — оголошення повторно пройде перевірку.</p>
                            </div>
                          )}
                          <AdForm
                            key={entity.id}
                            formId={formId}
                            account={account}
                            campaign={c}
                            adSet={s}
                            base={ad}
                            initial={adToForm(ad)}
                            onDirtyChange={setDirty}
                            onSubmit={(v) => save((a) => updateAd(a, ad.id, formToAdPatch(v, needsForm)), "Оголошення оновлено")}
                          />
                        </>
                      );
                    })()}
                </fieldset>
              </TabsContent>
              <TabsContent value="insights">
                <EntityInsights account={account} target={target} />
              </TabsContent>
              <TabsContent value="history">
                <ChangeLog account={account} entityId={target.id} />
              </TabsContent>
            </div>
            {tab === "settings" && !readOnly && (
              <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
                {dirty && <span className="mr-auto text-2xs text-warning">Є незбережені зміни</span>}
                <Button variant="outline" onClick={onClose}>
                  Закрити
                </Button>
                <Button type="submit" form={formId}>
                  <Save /> Зберегти
                </Button>
              </div>
            )}
          </Tabs>
        ) : (
          <EmptyState title="Об'єкт не знайдено" description="Можливо, його видалено." />
        )}
      </SheetContent>
    </Sheet>
  );
}
