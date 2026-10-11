"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, AlertTriangle, Check, ChevronRight, Folder, Info, LayoutGrid, Megaphone, Plus, Send } from "lucide-react";
import { useActiveAccount, useAppStore } from "@/store/app-store";
import { makeAd, makeAdSet, makeCampaign } from "@/domain/factories";
import { addAd, addAdSet, addCampaign, publishCampaign, updateAd, updateAdSet, updateCampaign } from "@/domain/operations";
import type { AdAccount, Ad, AdSet, Campaign } from "@/domain/types";
import { objectiveLabel } from "@/domain/catalog";
import { validateCampaignTree, type ValidationIssue } from "@/simulation/validation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/common";
import { CampaignForm, campaignToForm, formToCampaignPatch } from "./forms/campaign-form";
import { AdSetForm, adSetToForm, formToAdSetPatch } from "./forms/ad-set-form";
import { AdForm, adToForm, formToAdPatch } from "./forms/ad-form";

type Step = "campaign" | "adset" | "ad" | "review";

const STEPS: { id: Step; label: string }[] = [
  { id: "campaign", label: "Кампанія" },
  { id: "adset", label: "Набір оголошень" },
  { id: "ad", label: "Оголошення" },
  { id: "review", label: "Перевірка та публікація" },
];

export function IssueList({ issues, compact }: { issues: ValidationIssue[]; compact?: boolean }) {
  if (!issues.length) {
    return (
      <p className="flex items-center gap-2 rounded-md bg-success/10 px-3 py-2 text-xs">
        <Check className="h-4 w-4 text-success" /> Помилок і попереджень не знайдено.
      </p>
    );
  }
  const icon = { error: AlertCircle, warning: AlertTriangle, info: Info };
  const tone = { error: "text-destructive", warning: "text-warning", info: "text-info" };
  return (
    <ul className={cn("grid gap-1.5", compact && "max-h-80 overflow-y-auto")}>
      {(["error", "warning", "info"] as const).flatMap((lvl) =>
        issues
          .filter((i) => i.level === lvl)
          .map((i, k) => {
            const Icon = icon[lvl];
            return (
              <li key={`${lvl}-${i.entityId}-${k}`} className="flex gap-2 rounded-md border px-2.5 py-2 text-xs">
                <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", tone[lvl])} />
                <span className="min-w-0">
                  <span className="text-2xs text-muted-foreground">
                    {i.entityType === "campaign" ? "Кампанія" : i.entityType === "ad_set" ? "Набір" : "Оголошення"} · {i.entityName}
                  </span>
                  <span className="block">{i.message}</span>
                  {i.hint && <span className="block text-2xs text-muted-foreground">{i.hint}</span>}
                  {i.articleSlug && (
                    <Link href={`/knowledge/${i.articleSlug}`} className="text-2xs text-primary hover:underline">
                      Пояснення в базі знань →
                    </Link>
                  )}
                </span>
              </li>
            );
          }),
      )}
    </ul>
  );
}

function Tree({ account, campaign, adSetId, adId, onSelect }: { account: AdAccount; campaign?: Campaign; adSetId?: string; adId?: string; onSelect: (s: Step, id?: string) => void }) {
  if (!campaign) return <p className="px-3 py-2 text-2xs text-muted-foreground">Кампанію ще не створено.</p>;
  const sets = account.adSets.filter((s) => s.campaignId === campaign.id);
  return (
    <ul className="text-[13px]" aria-label="Структура кампанії">
      <li>
        <button type="button" className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left hover:bg-muted" onClick={() => onSelect("campaign")}>
          <Folder className="h-4 w-4 text-primary" /> <span className="truncate font-medium">{campaign.name}</span>
        </button>
        <ul className="ml-4 border-l pl-2">
          {sets.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={cn("flex w-full items-center gap-1.5 rounded px-2 py-1 text-left hover:bg-muted", s.id === adSetId && "bg-accent")}
                onClick={() => onSelect("adset", s.id)}
              >
                <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" /> <span className="truncate">{s.name}</span>
              </button>
              <ul className="ml-4 border-l pl-2">
                {account.ads
                  .filter((a) => a.adSetId === s.id)
                  .map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        className={cn("flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs hover:bg-muted", a.id === adId && "bg-accent")}
                        onClick={() => onSelect("ad", a.id)}
                      >
                        <Megaphone className="h-3 w-3 text-muted-foreground" /> <span className="truncate">{a.name}</span>
                      </button>
                    </li>
                  ))}
                <li>
                  <button type="button" className="flex items-center gap-1 px-2 py-1 text-2xs text-primary hover:underline" onClick={() => onSelect("ad", `new:${s.id}`)}>
                    <Plus className="h-3 w-3" /> Оголошення
                  </button>
                </li>
              </ul>
            </li>
          ))}
          <li>
            <button type="button" className="flex items-center gap-1 px-2 py-1 text-2xs text-primary hover:underline" onClick={() => onSelect("adset", "new")}>
              <Plus className="h-3 w-3" /> Набір оголошень
            </button>
          </li>
        </ul>
      </li>
    </ul>
  );
}

export function CampaignBuilder() {
  const router = useRouter();
  const params = useSearchParams();
  const account = useActiveAccount();
  const mutate = useAppStore((s) => s.mutateAccount);

  const [campaignId, setCampaignId] = useState<string | undefined>(params.get("campaignId") ?? undefined);
  const initialAdSet = params.get("adSetId") ?? (params.get("addAdSet") ? "new" : undefined);
  const [adSetRef, setAdSetRef] = useState<string | undefined>(initialAdSet ?? undefined);
  const [adRef, setAdRef] = useState<string | undefined>(params.get("adId") ?? (params.get("addAd") && params.get("adSetId") ? `new:${params.get("adSetId")}` : undefined));
  const [step, setStep] = useState<Step>((params.get("step") as Step) ?? (params.get("addAd") ? "ad" : params.get("addAdSet") ? "adset" : "campaign"));
  const [draftKey, setDraftKey] = useState(0);

  const campaign = account?.campaigns.find((c) => c.id === campaignId);
  const adSet = account && adSetRef && adSetRef !== "new" ? account.adSets.find((s) => s.id === adSetRef) : undefined;
  const adSetForAd = account && adRef ? account.adSets.find((s) => s.id === (adRef.startsWith("new:") ? adRef.slice(4) : account.ads.find((a) => a.id === adRef)?.adSetId)) : undefined;
  const ad = account && adRef && !adRef.startsWith("new:") ? account.ads.find((a) => a.id === adRef) : undefined;

  // Чернетки «нових» сутностей — лише в пам'яті, доки користувач не збереже форму.
  const draftCampaign = useMemo(() => (account && !campaign ? makeCampaign(account, "traffic")[0] : undefined), [account, campaign]);
  const draftAdSet = useMemo(() => (account && campaign && adSetRef === "new" ? makeAdSet(account, campaign, { name: `Набір ${account.adSets.filter((s) => s.campaignId === campaign.id).length + 1}` })[0] : undefined), [account, campaign, adSetRef]);
  const draftAd = useMemo(
    () => (account && adSetForAd && adRef?.startsWith("new:") ? makeAd(account, adSetForAd, { name: `Оголошення ${account.ads.filter((a) => a.adSetId === adSetForAd.id).length + 1}` })[0] : undefined),
    [account, adSetForAd, adRef],
  );

  const issues = useMemo(() => (account && campaign ? validateCampaignTree(account, campaign.id) : []), [account, campaign]);
  const onDirty = useCallback(() => {}, []);

  if (!account) return null;
  if (account.readOnly) {
    return (
      <>
        <PageHeader title="Campaign Builder" />
        <EmptyState title="Цей акаунт лише для перегляду" description="Кейси Error Lab і здані місії не можна редагувати. Перемкніться на пісочницю або активну місію у верхній панелі." />
      </>
    );
  }

  const selectFromTree = (s: Step, id?: string) => {
    if (s === "adset") setAdSetRef(id);
    if (s === "ad") setAdRef(id);
    setStep(s);
    setDraftKey((k) => k + 1);
  };

  const saveCampaign = (v: Parameters<typeof formToCampaignPatch>[0]) => {
    const patch = formToCampaignPatch(v);
    if (!campaign && draftCampaign) {
      let created: Campaign | undefined;
      mutate(account.id, (a) => {
        const [c, acc] = makeCampaign(a, v.objective, patch);
        created = c;
        return addCampaign(acc, c);
      });
      if (!created) return;
      setCampaignId(created.id);
      toast.success("Кампанію збережено як чернетку");
      setAdSetRef("new");
    } else if (campaign) {
      mutate(account.id, (a) => updateCampaign(a, campaign.id, patch));
      toast.success("Зміни кампанії збережено");
      const first = account.adSets.find((s) => s.campaignId === campaign.id);
      setAdSetRef(first?.id ?? "new");
    }
    setStep("adset");
    setDraftKey((k) => k + 1);
  };

  const saveAdSet = (v: Parameters<typeof formToAdSetPatch>[0]) => {
    if (!campaign) return;
    const patch = formToAdSetPatch(v);
    let targetId = adSet?.id;
    if (!adSet && draftAdSet) {
      let created: AdSet | undefined;
      mutate(account.id, (a) => {
        const [s, acc] = makeAdSet(a, campaign, patch);
        created = s;
        return addAdSet(acc, s);
      });
      if (!created) return;
      targetId = (created as AdSet).id;
      setAdSetRef(targetId);
      toast.success("Набір збережено");
    } else if (adSet) {
      mutate(account.id, (a) => updateAdSet(a, adSet.id, patch));
      toast.success("Зміни набору збережено");
    }
    // Advantage+ campaign setup втрачає статус, якщо вимкнули Advantage+ audience/placements
    if (campaign.setup === "advantage_plus" && (!patch.audience?.advantageAudience || patch.placements?.mode !== "advantage")) {
      mutate(account.id, (a) => updateCampaign(a, campaign.id, { setup: "manual" }));
      toast.info("Кампанія перейшла на ручне налаштування (Advantage+ off)");
    }
    const firstAd = account.ads.find((a) => a.adSetId === targetId);
    setAdRef(firstAd?.id ?? `new:${targetId}`);
    setStep("ad");
    setDraftKey((k) => k + 1);
  };

  const saveAd = (v: Parameters<typeof formToAdPatch>[0]) => {
    const s = adSetForAd;
    if (!s) return;
    const needsForm = s.conversionLocation === "instant_forms" || s.conversionLocation === "website_and_instant_forms";
    const patch = formToAdPatch(v, needsForm);
    if (!ad && draftAd) {
      let created: Ad | undefined;
      mutate(account.id, (a) => {
        const [newAd, acc] = makeAd(a, s, patch);
        created = newAd;
        return addAd(acc, newAd);
      });
      if (!created) return;
      setAdRef((created as Ad).id);
      toast.success("Оголошення збережено");
    } else if (ad) {
      mutate(account.id, (a) => updateAd(a, ad.id, patch));
      toast.success("Зміни оголошення збережено");
    }
    setStep("review");
  };

  const publish = () => {
    if (!campaign) return;
    let published = false;
    let found: ValidationIssue[] = [];
    mutate(account.id, (a) => {
      const r = publishCampaign(a, campaign.id);
      published = r.published;
      found = r.issues;
      return r.account;
    });
    if (published) {
      toast.success("Кампанію опубліковано", { description: "Оголошення на перевірці. Перевірка завершиться під час наступної симуляції дня." });
      router.push(`/ads-manager?highlight=${campaign.id}`);
    } else {
      toast.error("Виправте помилки перед публікацією", { description: `${found.filter((i) => i.level === "error").length} помилок` });
    }
  };

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const currentFormId = `builder-${step}`;

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col">
      <PageHeader
        eyebrow={campaign ? `${objectiveLabel(campaign.objective)} · ${campaign.status === "draft" ? "чернетка" : "опубліковано"}` : "Нова кампанія"}
        title={campaign ? campaign.name : "Campaign Builder"}
        description="Покроковий майстер: кожен крок зберігається як чернетка. Публікація можлива після перевірки налаштувань."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/ads-manager">До Ads Manager</Link>
          </Button>
        }
      />
      <nav aria-label="Кроки" className="flex overflow-x-auto border-b bg-surface px-4 sm:px-6">
        {STEPS.map((s, i) => {
          const enabled = s.id === "campaign" || Boolean(campaign);
          return (
            <button
              key={s.id}
              type="button"
              disabled={!enabled}
              onClick={() => {
                if (s.id === "adset" && !adSetRef) setAdSetRef(account.adSets.find((x) => x.campaignId === campaign?.id)?.id ?? "new");
                if (s.id === "ad" && !adRef) {
                  const firstSet = adSet ?? account.adSets.find((x) => x.campaignId === campaign?.id);
                  if (!firstSet) return;
                  setAdRef(account.ads.find((x) => x.adSetId === firstSet.id)?.id ?? `new:${firstSet.id}`);
                }
                setStep(s.id);
                setDraftKey((k) => k + 1);
              }}
              aria-current={step === s.id ? "step" : undefined}
              className={cn(
                "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-[13px] text-muted-foreground disabled:opacity-40",
                step === s.id && "border-primary font-medium text-foreground",
              )}
            >
              <span className={cn("flex h-5 w-5 items-center justify-center rounded-full border text-2xs", i < stepIndex && "border-success bg-success text-success-foreground", step === s.id && "border-primary text-primary")}>
                {i < stepIndex ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {s.label}
              {i < STEPS.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />}
            </button>
          );
        })}
      </nav>

      <div className="grid flex-1 gap-4 p-4 sm:p-6 lg:grid-cols-[220px_1fr]">
        <aside className="hidden rounded-lg border bg-card py-2 lg:block lg:self-start">
          <p className="px-3 pb-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Структура</p>
          <Tree account={account} campaign={campaign} adSetId={adSet?.id} adId={ad?.id} onSelect={selectFromTree} />
        </aside>

        <div className="min-w-0 pb-20">
          {step === "campaign" && (
            <CampaignForm
              key={`c-${campaign?.id ?? "new"}-${draftKey}`}
              formId={currentFormId}
              initial={campaignToForm(campaign ?? draftCampaign!)}
              published={campaign ? campaign.status !== "draft" : false}
              onSubmit={saveCampaign}
              onDirtyChange={onDirty}
            />
          )}
          {step === "adset" && campaign && (adSet || draftAdSet) && (
            <AdSetForm
              key={`s-${adSet?.id ?? "new"}-${draftKey}`}
              formId={currentFormId}
              account={account}
              campaign={campaign}
              base={(adSet ?? draftAdSet)!}
              initial={adSetToForm((adSet ?? draftAdSet)!)}
              onSubmit={saveAdSet}
              onDirtyChange={onDirty}
            />
          )}
          {step === "ad" && campaign && adSetForAd && (ad || draftAd) && (
            <AdForm
              key={`a-${ad?.id ?? adRef}-${draftKey}`}
              formId={currentFormId}
              account={account}
              campaign={campaign}
              adSet={adSetForAd}
              base={(ad ?? draftAd)!}
              initial={adToForm((ad ?? draftAd)!)}
              onSubmit={saveAd}
              onDirtyChange={onDirty}
            />
          )}
          {step === "ad" && (!adSetForAd || !(ad || draftAd)) && <EmptyState title="Спершу створіть набір оголошень" />}
          {step === "review" && campaign && (
            <div className="grid gap-4">
              <section className="rounded-lg border bg-card p-4">
                <h2 className="mb-1 text-sm font-semibold">Перевірка налаштувань</h2>
                <p className="mb-3 text-xs text-muted-foreground">Помилки блокують публікацію. Попередження не блокують, але вказують на ризики для результату.</p>
                <IssueList issues={issues} />
              </section>
              <section className="rounded-lg border bg-card p-4">
                <h2 className="mb-2 text-sm font-semibold">Структура</h2>
                <Tree account={account} campaign={campaign} onSelect={selectFromTree} />
              </section>
            </div>
          )}
        </div>
      </div>

      <div className="no-print sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-2 border-t bg-surface/95 px-4 py-2.5 backdrop-blur sm:px-6">
        <div className="flex items-center gap-2 text-2xs text-muted-foreground">
          {campaign && (
            <>
              <Badge variant={issues.some((i) => i.level === "error") ? "destructive" : "success"}>
                {issues.filter((i) => i.level === "error").length} помилок
              </Badge>
              <Badge variant="warning">{issues.filter((i) => i.level === "warning").length} попереджень</Badge>
            </>
          )}
        </div>
        <div className="flex gap-2">
          {stepIndex > 0 && (
            <Button variant="outline" onClick={() => setStep(STEPS[stepIndex - 1].id)}>
              Назад
            </Button>
          )}
          {step !== "review" ? (
            <Button type="submit" form={currentFormId}>
              Зберегти й далі <ChevronRight />
            </Button>
          ) : (
            <Button onClick={publish} disabled={!campaign || campaign.status === "paused"}>
              <Send /> {campaign?.status === "draft" ? "Опублікувати" : "Опублікувати зміни"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
