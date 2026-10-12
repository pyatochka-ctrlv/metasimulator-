"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle } from "lucide-react";
import { APP_EVENTS, BID_STRATEGIES, CONVERSION_LOCATIONS, PERFORMANCE_GOALS, PIXEL_EVENTS } from "@/domain/catalog";
import {
  appEventGoal,
  attributionConfigurable,
  bidStrategiesFor,
  conversionLocationsFor,
  performanceGoalsFor,
  recommendedEvents,
  requiresApp,
  requiresPixelEvent,
  specialCategoryRules,
  unavailableReason,
} from "@/domain/objective-config";
import type { AdAccount, AdSet, AudienceTargeting, Campaign, ConversionLocation, PerformanceGoal, PixelEvent, PlacementId } from "@/domain/types";
import { captureModel } from "@/simulation/tracking";
import { fmtSimDate } from "@/lib/dates";
import { adSetFormSchema, type AdSetFormValues } from "@/validation/schemas";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChoiceCard, Field, FormSection } from "@/components/common/field";
import { ArticleLink } from "@/components/common";
import { AudienceEditor } from "./audience-editor";
import { PlacementsEditor } from "./placements-editor";
import { EstimatePanel } from "../estimate-panel";

export function adSetToForm(s: AdSet): AdSetFormValues {
  return {
    name: s.name,
    conversionLocation: s.conversionLocation,
    performanceGoal: s.performanceGoal,
    optimizationEvent: s.optimizationEvent,
    budgetType: s.budgetType,
    budgetAmount: s.budgetAmount,
    bidStrategy: s.bidStrategy,
    bidAmount: s.bidAmount,
    roasGoal: s.roasGoal,
    startDay: s.startDay,
    endDay: s.endDay,
    audience: s.audience,
    placements: s.placements,
    attribution: s.attribution,
    frequencyCapEnabled: Boolean(s.frequencyCap),
    frequencyCapImpressions: s.frequencyCap?.impressions ?? 2,
    frequencyCapDays: s.frequencyCap?.days ?? 7,
  };
}

export function formToAdSetPatch(v: AdSetFormValues): Partial<AdSet> {
  return {
    name: v.name.trim(),
    conversionLocation: v.conversionLocation,
    performanceGoal: v.performanceGoal as PerformanceGoal,
    optimizationEvent: v.optimizationEvent as AdSet["optimizationEvent"],
    budgetType: v.budgetType,
    budgetAmount: v.budgetAmount,
    bidStrategy: v.bidStrategy,
    bidAmount: v.bidAmount,
    roasGoal: v.roasGoal,
    startDay: v.startDay,
    endDay: v.endDay,
    audience: v.audience as AudienceTargeting,
    placements: { mode: v.placements.mode, selected: v.placements.selected as PlacementId[] },
    attribution: v.attribution,
    frequencyCap: v.frequencyCapEnabled ? { impressions: v.frequencyCapImpressions, days: v.frequencyCapDays } : undefined,
  };
}

export function AdSetForm({
  account,
  campaign,
  base,
  initial,
  formId,
  onSubmit,
  onDirtyChange,
}: {
  account: AdAccount;
  campaign: Campaign;
  base: AdSet;
  initial: AdSetFormValues;
  formId: string;
  onSubmit: (v: AdSetFormValues) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const form = useForm<AdSetFormValues>({ resolver: zodResolver(adSetFormSchema), defaultValues: initial, mode: "onBlur" });
  const { register, control, setValue, formState } = form;
  const values = useWatch({ control }) as AdSetFormValues;
  const location = values.conversionLocation as ConversionLocation;
  const goal = values.performanceGoal as PerformanceGoal;
  const locations = conversionLocationsFor(campaign.objective);
  const goals = performanceGoalsFor(campaign.objective, location);
  const strategies = bidStrategiesFor(goal);
  const needsEvent = requiresPixelEvent(location, goal) || (location === "app" && appEventGoal(goal) && goal !== "app_installs");
  const rules = specialCategoryRules(campaign.specialAdCategories);
  const budgetAtAdSet = campaign.budgetLevel === "ad_set";

  useEffect(() => onDirtyChange?.(formState.isDirty), [formState.isDirty, onDirtyChange]);

  // Залежні поля: при зміні місця конверсії/цілі ефективності підбираємо валідні значення.
  useEffect(() => {
    if (!locations.includes(location)) setValue("conversionLocation", locations[0], { shouldDirty: true });
  }, [location, locations, setValue]);
  useEffect(() => {
    if (goals.length && !goals.includes(goal)) setValue("performanceGoal", goals[0], { shouldDirty: true });
  }, [goal, goals, setValue]);
  useEffect(() => {
    if (!strategies.includes(values.bidStrategy)) setValue("bidStrategy", strategies[0], { shouldDirty: true });
  }, [strategies, values.bidStrategy, setValue]);
  useEffect(() => {
    if (needsEvent && !values.optimizationEvent) setValue("optimizationEvent", recommendedEvents(campaign.objective, goal)[0], { shouldDirty: true });
    if (!needsEvent && values.optimizationEvent) setValue("optimizationEvent", null, { shouldDirty: true });
  }, [needsEvent, values.optimizationEvent, campaign.objective, goal, setValue]);
  useEffect(() => {
    if (campaign.setup === "advantage_plus") {
      if (!values.audience?.advantageAudience) setValue("audience.advantageAudience", true);
      if (values.placements?.mode !== "advantage") setValue("placements", { mode: "advantage", selected: [] });
    }
  }, [campaign.setup, values.audience?.advantageAudience, values.placements?.mode, setValue]);

  const previewAdSet: AdSet = useMemo(() => ({ ...base, ...formToAdSetPatch({ ...initial, ...values } as AdSetFormValues) }), [base, initial, values]);
  const startOptions = Array.from({ length: 21 }, (_, i) => account.simDay + i);
  const recommended = recommendedEvents(campaign.objective, goal);
  const isApp = location === "app";
  const strategyInfo = BID_STRATEGIES[values.bidStrategy];

  return (
    <form id={formId} onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 xl:grid-cols-[1fr_300px]" noValidate>
      <div className="grid min-w-0 gap-4">
        <FormSection title="Набір оголошень" description="Набір визначає аудиторію, плейсменти, бюджет, розклад і оптимізацію.">
          <Field label="Назва набору" htmlFor="s-name" error={formState.errors.name?.message} required>
            <Input id="s-name" {...register("name")} aria-invalid={Boolean(formState.errors.name)} />
          </Field>
        </FormSection>

        <FormSection title="Конверсія" description={`Доступні варіанти залежать від цілі кампанії (${campaign.objective}).`}>
          {campaign.objective !== "awareness" && (
            <Field label="Місце конверсії" tip="Де має відбутися цільова дія після показу оголошення.">
              <Controller
                control={control}
                name="conversionLocation"
                render={({ field }) => (
                  <div role="radiogroup" aria-label="Місце конверсії" className="grid gap-2 sm:grid-cols-2">
                    {(Object.keys(CONVERSION_LOCATIONS) as ConversionLocation[])
                      .filter((l) => l !== "none")
                      .map((l) => {
                        const available = locations.includes(l);
                        const appBlocked = requiresApp(l) && !account.tracking.appRegistered;
                        return (
                          <ChoiceCard
                            key={l}
                            selected={field.value === l}
                            disabled={!available || appBlocked}
                            disabledReason={!available ? unavailableReason("location", { objective: campaign.objective }) : "Застосунок не зареєстровано в навчальному акаунті."}
                            onSelect={() => field.onChange(l)}
                            title={CONVERSION_LOCATIONS[l].label}
                            description={CONVERSION_LOCATIONS[l].hint}
                          />
                        );
                      })}
                  </div>
                )}
              />
            </Field>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ціль ефективності (performance goal)" tip={PERFORMANCE_GOALS[goal]?.hint}>
              <Controller
                control={control}
                name="performanceGoal"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label="Ціль ефективності">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {goals.map((g) => (
                        <SelectItem key={g} value={g}>
                          {PERFORMANCE_GOALS[g].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            {needsEvent && (
              <Field label={isApp ? "Подія в застосунку" : "Подія оптимізації (датасет)"} tip="Система шукає людей, схожих на тих, хто вже виконував цю подію." error={formState.errors.optimizationEvent?.message}>
                <Controller
                  control={control}
                  name="optimizationEvent"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger aria-label="Подія оптимізації">
                        <SelectValue placeholder="Оберіть подію" />
                      </SelectTrigger>
                      <SelectContent>
                        {isApp ? (
                          APP_EVENTS.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.label}
                            </SelectItem>
                          ))
                        ) : (
                          <>
                            <SelectGroup>
                              <SelectLabel>Рекомендовано для цілі</SelectLabel>
                              {PIXEL_EVENTS.filter((e) => recommended.includes(e.id)).map((e) => (
                                <SelectItem key={e.id} value={e.id}>
                                  {e.label}
                                  {captureModel(account, e.id).capture === 0 ? " — не надходить" : ""}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                            <SelectGroup>
                              <SelectLabel>Інші події</SelectLabel>
                              {PIXEL_EVENTS.filter((e) => !recommended.includes(e.id) && e.id !== "PageView").map((e) => (
                                <SelectItem key={e.id} value={e.id}>
                                  {e.label}
                                  {captureModel(account, e.id).capture === 0 ? " — не надходить" : ""}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            )}
          </div>
          {needsEvent && !isApp && values.optimizationEvent && captureModel(account, values.optimizationEvent as PixelEvent).capture === 0 && (
            <p className="flex items-start gap-1.5 rounded-md bg-warning/10 px-3 py-2 text-xs">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
              Подія {values.optimizationEvent} не надходить у датасет {account.tracking.pixel.id}. Перевірте <Link className="text-primary underline" href="/events-manager">Events Manager</Link>.
            </p>
          )}
          {(location === "website" || location === "website_and_app") && (
            <p className="text-2xs text-muted-foreground">
              Датасет: <span className="font-mono">{account.tracking.pixel.installed ? account.tracking.pixel.id : "не встановлено"}</span>
              {account.tracking.capi.enabled && " + Conversions API"}
            </p>
          )}
        </FormSection>

        {(budgetAtAdSet || true) && (
          <FormSection title="Бюджет і розклад" description={budgetAtAdSet ? "Бюджет цього набору." : "Бюджет керується на рівні кампанії (Advantage+ campaign budget)."}>
            {budgetAtAdSet && (
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
                          <SelectItem value="daily">Денний</SelectItem>
                          <SelectItem value="lifetime">На весь період</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field label="Сума, USD" htmlFor="s-budget" error={formState.errors.budgetAmount?.message} required>
                  <Input id="s-budget" type="number" step="0.01" min={0} {...register("budgetAmount", { valueAsNumber: true })} />
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
                  <Field label={values.bidStrategy === "bid_cap" ? "Bid cap, USD" : "Ціль вартості результату, USD"} htmlFor="s-bid" error={formState.errors.bidAmount?.message}>
                    <Input id="s-bid" type="number" step="0.01" {...register("bidAmount", { setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)) })} />
                  </Field>
                )}
                {strategyInfo.needs === "roasGoal" && (
                  <Field label="ROAS goal" htmlFor="s-roas" error={formState.errors.roasGoal?.message}>
                    <Input id="s-roas" type="number" step="0.01" {...register("roasGoal", { setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)) })} />
                  </Field>
                )}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Дата початку" tip="Симульований календар акаунта.">
                <Controller
                  control={control}
                  name="startDay"
                  render={({ field }) => (
                    <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(new Set([field.value, ...startOptions])).sort((a, b) => a - b).map((d) => (
                          <SelectItem key={d} value={String(d)}>
                            {fmtSimDate(account.startDate, d, true)}
                            {d === account.simDay ? " (наступний день)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field label="Дата завершення" error={formState.errors.endDay?.message}>
                <Controller
                  control={control}
                  name="endDay"
                  render={({ field }) => (
                    <Select value={field.value === null ? "none" : String(field.value)} onValueChange={(v) => field.onChange(v === "none" ? null : Number(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Без дати завершення</SelectItem>
                        {Array.from({ length: 45 }, (_, i) => Math.max(values.startDay ?? account.simDay, account.simDay) + i).map((d) => (
                          <SelectItem key={d} value={String(d)}>
                            {fmtSimDate(account.startDate, d, true)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>
          </FormSection>
        )}

        <Controller
          control={control}
          name="audience"
          render={({ field }) => (
            <AudienceEditor
              account={account}
              value={field.value as AudienceTargeting}
              onChange={field.onChange}
              rules={rules}
              error={(formState.errors.audience as { locations?: { message?: string } } | undefined)?.locations?.message}
            />
          )}
        />
        {campaign.setup === "advantage_plus" && (
          <p className="-mt-2 text-2xs text-muted-foreground">Advantage+ campaign setup: якщо вимкнути Advantage+ audience чи placements, кампанія втратить статус Advantage+ (у симуляторі — перейде на ручне налаштування).</p>
        )}

        <Controller
          control={control}
          name="placements"
          render={({ field }) => (
            <PlacementsEditor
              value={field.value as { mode: "advantage" | "manual"; selected: PlacementId[] }}
              onChange={field.onChange}
              error={(formState.errors.placements as { message?: string } | undefined)?.message}
            />
          )}
        />

        {attributionConfigurable(goal) && (
          <FormSection
            title="Налаштування атрибуції"
            description="Вікно, у межах якого конверсія приписується оголошенню. Впливає і на звіти, і на сигнали оптимізації."
            aside={<Badge variant="warning">Partially verified · 2026</Badge>}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Click-through">
                <Controller
                  control={control}
                  name="attribution.clickWindowDays"
                  render={({ field }) => (
                    <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v) as 1 | 7)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 день після кліку</SelectItem>
                        <SelectItem value="7">7 днів після кліку</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Controller
                control={control}
                name="attribution.engageThrough"
                render={({ field }) => (
                  <label className="flex items-center gap-2 pt-5 text-[13px]">
                    <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} /> 1-day engage-through
                  </label>
                )}
              />
              <Controller
                control={control}
                name="attribution.viewThrough"
                render={({ field }) => (
                  <label className="flex items-center gap-2 pt-5 text-[13px]">
                    <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} /> 1-day view-through
                  </label>
                )}
              />
            </div>
            <p className="text-2xs text-muted-foreground">
              Click-through враховує кліки за посиланням; engage-through — інші взаємодії (вподобання, збереження, перегляд відео ≥5 с). <ArticleLink slug="attribution">Про атрибуцію</ArticleLink>
            </p>
          </FormSection>
        )}

        {(goal === "reach" || goal === "daily_unique_reach") && (
          <FormSection title="Контроль частоти" description="Обмеження кількості показів на людину за період.">
            <Controller
              control={control}
              name="frequencyCapEnabled"
              render={({ field }) => (
                <label className="flex items-center gap-2 text-[13px]">
                  <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Ліміт частоти" /> Обмежити частоту
                </label>
              )}
            />
            {values.frequencyCapEnabled && (
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                Не більше
                <Input type="number" min={1} max={20} className="w-16" {...register("frequencyCapImpressions", { valueAsNumber: true })} aria-label="Показів" />
                показів кожні
                <Input type="number" min={1} max={30} className="w-16" {...register("frequencyCapDays", { valueAsNumber: true })} aria-label="Днів" />
                днів
              </div>
            )}
          </FormSection>
        )}
      </div>

      <aside className="xl:sticky xl:top-16 xl:self-start">
        <EstimatePanel account={account} campaign={campaign} adSet={previewAdSet} />
      </aside>
    </form>
  );
}
