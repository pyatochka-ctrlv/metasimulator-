"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkles } from "lucide-react";
import { BID_STRATEGIES, OBJECTIVES, SPECIAL_AD_CATEGORIES } from "@/domain/catalog";
import {
  abTestVariables,
  advantagePlusSetupAvailable,
  bidStrategiesFor,
  defaultGoal,
  defaultLocation,
  specialCategoryRules,
  unavailableReason,
} from "@/domain/objective-config";
import type { Campaign, Objective } from "@/domain/types";
import { campaignFormSchema, type CampaignFormValues } from "@/validation/schemas";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChoiceCard, Field, FormSection } from "@/components/common/field";
import { ArticleLink } from "@/components/common";

export function campaignToForm(c: Campaign): CampaignFormValues {
  return {
    name: c.name,
    objective: c.objective,
    specialAdCategories: c.specialAdCategories,
    setup: c.setup,
    budgetLevel: c.budgetLevel,
    budgetType: c.budgetType,
    budgetAmount: c.budgetAmount,
    bidStrategy: c.bidStrategy,
    bidAmount: c.bidAmount,
    roasGoal: c.roasGoal,
    budgetSharing: c.budgetSharing,
    abEnabled: Boolean(c.abTest?.enabled),
    abVariable: c.abTest?.variable ?? "creative",
    abHypothesis: c.abTest?.hypothesis ?? "",
    abMetric: c.abTest?.keyMetric ?? "cost_per_result",
  };
}

export function formToCampaignPatch(v: CampaignFormValues): Partial<Campaign> {
  return {
    name: v.name.trim(),
    objective: v.objective,
    specialAdCategories: v.specialAdCategories,
    setup: v.setup,
    budgetLevel: v.setup === "advantage_plus" ? "campaign" : v.budgetLevel,
    budgetType: v.budgetType,
    budgetAmount: v.budgetAmount,
    bidStrategy: v.bidStrategy,
    bidAmount: v.bidAmount,
    roasGoal: v.roasGoal,
    budgetSharing: v.budgetLevel === "ad_set" ? v.budgetSharing : false,
    abTest: v.abEnabled ? { enabled: true, variable: v.abVariable, hypothesis: v.abHypothesis, keyMetric: v.abMetric } : null,
  };
}

export function CampaignForm({
  initial,
  published,
  formId,
  onSubmit,
  onDirtyChange,
}: {
  initial: CampaignFormValues;
  published?: boolean;
  formId: string;
  onSubmit: (v: CampaignFormValues) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const form = useForm<CampaignFormValues>({ resolver: zodResolver(campaignFormSchema), defaultValues: initial, mode: "onBlur" });
  const { register, control, watch, setValue, formState } = form;
  const objective = watch("objective");
  const setup = watch("setup");
  const budgetLevel = watch("budgetLevel");
  const bidStrategy = watch("bidStrategy");
  const abEnabled = watch("abEnabled");
  const specials = watch("specialAdCategories");
  const advAvailable = advantagePlusSetupAvailable(objective);
  const goal = defaultGoal(objective, defaultLocation(objective));
  const strategies = Array.from(new Set([...bidStrategiesFor(goal), "highest_volume" as const]));

  useEffect(() => onDirtyChange?.(formState.isDirty), [formState.isDirty, onDirtyChange]);

  // Узгодження залежних полів при зміні цілі/налаштування
  useEffect(() => {
    if (!advAvailable && setup === "advantage_plus") setValue("setup", "manual", { shouldDirty: true });
    if (setup === "advantage_plus" && budgetLevel !== "campaign") setValue("budgetLevel", "campaign", { shouldDirty: true });
    if (!strategies.includes(bidStrategy)) setValue("bidStrategy", strategies[0], { shouldDirty: true });
  }, [advAvailable, setup, budgetLevel, bidStrategy, strategies, setValue]);

  const rules = specialCategoryRules(specials);
  const strategyInfo = BID_STRATEGIES[bidStrategy];

  return (
    <form id={formId} onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
      <FormSection title="Назва і ціль кампанії" description="Ціль визначає, під яку дію система оптимізує показ, і які налаштування будуть доступні далі.">
        <Field label="Назва кампанії" htmlFor="c-name" error={formState.errors.name?.message} required hint="Порада: використовуйте шаблон назв, наприклад «Продукт · Ціль · Гео · Дата».">
          <Input id="c-name" {...register("name")} aria-invalid={Boolean(formState.errors.name)} />
        </Field>
        <Controller
          control={control}
          name="objective"
          render={({ field }) => (
            <div role="radiogroup" aria-label="Рекламна ціль" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {OBJECTIVES.map((o) => (
                <ChoiceCard
                  key={o.id}
                  selected={field.value === o.id}
                  disabled={published && field.value !== o.id}
                  disabledReason="Ціль опублікованої кампанії не змінюється — дублюйте кампанію."
                  onSelect={() => field.onChange(o.id as Objective)}
                  title={
                    <span>
                      {o.label} <span className="font-normal text-muted-foreground">· {o.labelUa}</span>
                    </span>
                  }
                  description={o.description}
                />
              ))}
            </div>
          )}
        />
        <p className="text-2xs text-muted-foreground">
          Не впевнені? <ArticleLink slug="campaign-objectives">Як обрати ціль</ArticleLink>
        </p>
      </FormSection>

      <FormSection
        title="Спеціальні категорії реклами"
        description="Оголосіть категорію, якщо реклама стосується фінансових продуктів, працевлаштування, житла або соціальних питань/політики."
      >
        <Controller
          control={control}
          name="specialAdCategories"
          render={({ field }) => (
            <div className="grid gap-2 sm:grid-cols-2">
              {SPECIAL_AD_CATEGORIES.map((s) => {
                const checked = field.value.includes(s.id);
                return (
                  <label key={s.id} className="flex cursor-pointer items-start gap-2 rounded-md border p-2.5 hover:bg-muted/50">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => field.onChange(v ? [...field.value, s.id] : field.value.filter((x) => x !== s.id))}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-[13px] font-medium">{s.label}</span>
                      <span className="block text-2xs text-muted-foreground">{s.hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        />
        {rules.active && (
          <ul className="list-disc space-y-0.5 rounded-md bg-warning/10 px-6 py-2 text-2xs text-foreground">
            {rules.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </FormSection>

      <FormSection
        title="Тип налаштування"
        description="Advantage+ campaign setup вмикає автоматизацію аудиторії, плейсментів і бюджету кампанії. Ручне налаштування дає більше контролю."
        aside={<Badge variant="warning">Partially verified</Badge>}
      >
        <Controller
          control={control}
          name="setup"
          render={({ field }) => (
            <div role="radiogroup" aria-label="Тип налаштування" className="grid gap-2 sm:grid-cols-2">
              <ChoiceCard
                selected={field.value === "advantage_plus"}
                disabled={!advAvailable}
                disabledReason={unavailableReason("advantage_setup", { objective })}
                onSelect={() => field.onChange("advantage_plus")}
                title={
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> Advantage+ campaign setup
                  </span>
                }
                description="Мінімум ручних обмежень: Advantage+ audience, placements і campaign budget. Звуження налаштувань вимикає статус Advantage+."
              />
              <ChoiceCard
                selected={field.value === "manual"}
                onSelect={() => field.onChange("manual")}
                title="Ручне налаштування"
                description="Самостійно контролюєте аудиторію, плейсменти, бюджети наборів. Корисно для навчання та специфічних обмежень."
              />
            </div>
          )}
        />
      </FormSection>

      <FormSection title="Бюджет і стратегія ставок" description="Campaign budget (раніше CBO) розподіляє бюджет між наборами автоматично.">
        <Controller
          control={control}
          name="budgetLevel"
          render={({ field }) => (
            <div role="radiogroup" aria-label="Рівень бюджету" className="grid gap-2 sm:grid-cols-2">
              <ChoiceCard
                selected={field.value === "campaign"}
                onSelect={() => field.onChange("campaign")}
                title="Advantage+ campaign budget"
                description="Один бюджет на кампанію; система перерозподіляє його між наборами за прогнозованою ефективністю."
              />
              <ChoiceCard
                selected={field.value === "ad_set"}
                disabled={setup === "advantage_plus"}
                disabledReason={unavailableReason("campaign_budget", { objective })}
                onSelect={() => field.onChange("ad_set")}
                title="Бюджет на рівні наборів"
                description="Кожен набір має власний бюджет і стратегію ставок."
              />
            </div>
          )}
        />
        {budgetLevel === "campaign" ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Тип бюджету">
              <Controller
                control={control}
                name="budgetType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Денний бюджет</SelectItem>
                      <SelectItem value="lifetime">Бюджет на весь період</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Сума, USD" htmlFor="c-budget" error={formState.errors.budgetAmount?.message} required>
              <Input id="c-budget" type="number" step="0.01" min={0} {...register("budgetAmount", { valueAsNumber: true })} aria-invalid={Boolean(formState.errors.budgetAmount)} />
            </Field>
            <Field label="Стратегія ставок" tip={strategyInfo.hint}>
              <Controller
                control={control}
                name="bidStrategy"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {strategies.map((s) => (
                        <SelectItem key={s} value={s}>
                          {BID_STRATEGIES[s].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            {strategyInfo.needs === "bidAmount" && (
              <Field label={bidStrategy === "bid_cap" ? "Bid cap, USD" : "Ціль вартості результату, USD"} htmlFor="c-bid" error={formState.errors.bidAmount?.message} required>
                <Input id="c-bid" type="number" step="0.01" {...register("bidAmount", { setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)) })} />
              </Field>
            )}
            {strategyInfo.needs === "roasGoal" && (
              <Field label="ROAS goal" htmlFor="c-roas" error={formState.errors.roasGoal?.message} required>
                <Input id="c-roas" type="number" step="0.01" {...register("roasGoal", { setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)) })} />
              </Field>
            )}
          </div>
        ) : (
          <Controller
            control={control}
            name="budgetSharing"
            render={({ field }) => (
              <label className="flex items-start gap-2 text-[13px]">
                <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Budget sharing" />
                <span>
                  Ad set budget sharing{" "}
                  <Badge variant="warning" className="ml-1">
                    Partially verified
                  </Badge>
                  <span className="block text-2xs text-muted-foreground">
                    Дозволити системі передавати до 20% бюджету набору іншим наборам кампанії, якщо це ймовірно покращить результат. Потрібно щонайменше 2 набори.
                  </span>
                </span>
              </label>
            )}
          />
        )}
        <p className="text-2xs text-muted-foreground">
          <ArticleLink slug="budgets-bidding">Бюджети та стратегії ставок</ArticleLink>
        </p>
      </FormSection>

      <FormSection title="A/B тест" description="Порівняйте одну змінну між варіантами. У симуляторі покази/бюджет діляться порівну між варіантами.">
        <Controller
          control={control}
          name="abEnabled"
          render={({ field }) => (
            <label className="flex items-center gap-2 text-[13px]">
              <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Увімкнути A/B тест" /> Створити A/B тест
            </label>
          )}
        />
        {abEnabled && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Змінна тесту">
              <Controller
                control={control}
                name="abVariable"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {abTestVariables(objective).map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Ключова метрика">
              <Controller
                control={control}
                name="abMetric"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cost_per_result">Cost per result</SelectItem>
                      <SelectItem value="ctr">CTR</SelectItem>
                      <SelectItem value="cpc">CPC</SelectItem>
                      <SelectItem value="roas">ROAS</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Гіпотеза" htmlFor="c-hyp" className="sm:col-span-2" error={formState.errors.abHypothesis?.message} hint="Формат: «Якщо [зміна], то [метрика] зміниться на [очікування], тому що [причина]».">
              <Textarea id="c-hyp" rows={2} {...register("abHypothesis")} />
            </Field>
          </div>
        )}
      </FormSection>
    </form>
  );
}
