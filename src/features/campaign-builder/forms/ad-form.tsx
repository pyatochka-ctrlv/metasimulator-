"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Link2, Wand2 } from "lucide-react";
import { CTAS } from "@/domain/catalog";
import { RECOMMENDED_UTM } from "@/domain/factories";
import type { AdAccount, Ad, AdSet, Campaign, CallToAction, CreativeMedia } from "@/domain/types";
import { assessCreative } from "@/simulation/creative-quality";
import { finalUrl, utmPresent } from "@/simulation/tracking";
import { adFormSchema, type AdFormValues } from "@/validation/schemas";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChoiceCard, Field, FormSection } from "@/components/common/field";
import { ArticleLink } from "@/components/common";
import { MediaList, MediaPickerDialog } from "@/features/creative/media-picker";
import { MediaThumb } from "@/features/creative/media-thumb";
import { AdPreview } from "@/features/creative/ad-preview";

export function adToForm(ad: Ad): AdFormValues {
  const f = ad.creative.instantForm;
  return {
    name: ad.name,
    facebookPageId: ad.facebookPageId,
    instagramAccountId: ad.instagramAccountId,
    format: ad.format,
    media: ad.creative.media,
    verticalMedia: ad.creative.verticalMedia,
    primaryText: ad.creative.primaryText,
    headline: ad.creative.headline,
    description: ad.creative.description,
    cta: ad.creative.cta,
    destinationUrl: ad.creative.destinationUrl,
    displayLink: ad.creative.displayLink,
    urlParameters: ad.creative.urlParameters,
    creativeEnhancements: ad.creative.creativeEnhancements,
    instantFormEnabled: Boolean(f),
    formType: f?.formType ?? "higher_intent",
    formQuestions: f?.questions ?? 3,
    privacyPolicyUrl: f?.privacyPolicyUrl ?? "",
    hasQualifyingQuestion: f?.hasQualifyingQuestion ?? false,
  };
}

export function formToAdPatch(v: AdFormValues, needsForm: boolean): Partial<Ad> {
  return {
    name: v.name.trim(),
    facebookPageId: v.facebookPageId,
    instagramAccountId: v.instagramAccountId,
    format: v.format,
    creative: {
      media: v.media as CreativeMedia[],
      verticalMedia: (v.verticalMedia as CreativeMedia | null) ?? null,
      primaryText: v.primaryText,
      headline: v.headline,
      description: v.description,
      cta: v.cta as CallToAction,
      destinationUrl: v.destinationUrl.trim(),
      displayLink: v.displayLink.trim(),
      urlParameters: v.urlParameters.trim(),
      creativeEnhancements: v.creativeEnhancements,
      instantForm: needsForm
        ? { formType: v.formType, questions: v.formQuestions, privacyPolicyUrl: v.privacyPolicyUrl.trim(), hasQualifyingQuestion: v.hasQualifyingQuestion }
        : null,
    },
  };
}

function CharCount({ value, soft }: { value: string; soft: number }) {
  return <span className={cn("text-2xs", value.length > soft ? "text-warning" : "text-muted-foreground")}>{value.length} симв.</span>;
}

export function AdForm({
  account,
  campaign,
  adSet,
  base,
  initial,
  formId,
  onSubmit,
  onDirtyChange,
}: {
  account: AdAccount;
  campaign: Campaign;
  adSet: AdSet;
  base: Ad;
  initial: AdFormValues;
  formId: string;
  onSubmit: (v: AdFormValues) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const needsForm = adSet.conversionLocation === "instant_forms" || adSet.conversionLocation === "website_and_instant_forms";
  const needsUrl = ["website", "website_and_app", "website_and_instant_forms"].includes(adSet.conversionLocation);
  const form = useForm<AdFormValues>({
    resolver: zodResolver(adFormSchema),
    defaultValues: { ...initial, instantFormEnabled: needsForm },
    mode: "onBlur",
  });
  const { register, control, setValue, formState } = form;
  const values = useWatch({ control }) as AdFormValues;
  const [pickerOpen, setPickerOpen] = useState<"main" | "vertical" | null>(null);

  useEffect(() => onDirtyChange?.(formState.isDirty), [formState.isDirty, onDirtyChange]);

  const previewAd: Ad = useMemo(() => ({ ...base, ...formToAdPatch({ ...initial, ...values } as AdFormValues, needsForm) } as Ad), [base, initial, values, needsForm]);
  const assessment = useMemo(() => assessCreative(previewAd, { campaign, adSet, landing: account.landingPage }), [previewAd, campaign, adSet, account.landingPage]);
  const pageName = account.identity.pages.find((p) => p.id === values.facebookPageId)?.name ?? "Сторінка";
  const media = (values.media ?? []) as CreativeMedia[];
  const utmOk = utmPresent(values.urlParameters ?? "", values.destinationUrl ?? "");

  const addMedia = (m: CreativeMedia) => {
    if (pickerOpen === "vertical") {
      setValue("verticalMedia", m, { shouldDirty: true });
      return;
    }
    const next = values.format === "carousel" ? [...media, m].slice(0, 10) : [m];
    setValue("media", next, { shouldDirty: true, shouldValidate: true });
    if (m.kind === "video" && values.format === "single_image") setValue("format", "single_video", { shouldDirty: true });
    if (m.kind === "image" && values.format === "single_video") setValue("format", "single_image", { shouldDirty: true });
  };

  return (
    <form id={formId} onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 xl:grid-cols-[1fr_360px]" noValidate>
      <div className="grid min-w-0 gap-4">
        <FormSection title="Оголошення" description="Назва та ідентичність, від імені якої показується реклама.">
          <Field label="Назва оголошення" htmlFor="a-name" error={formState.errors.name?.message} required>
            <Input id="a-name" {...register("name")} aria-invalid={Boolean(formState.errors.name)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Facebook Page" error={formState.errors.facebookPageId?.message} required tip="Навчальна сутність. У реальному кабінеті сторінка має бути в business portfolio з потрібними доступами.">
              <Controller
                control={control}
                name="facebookPageId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Оберіть сторінку" />
                    </SelectTrigger>
                    <SelectContent>
                      {account.identity.pages.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Instagram identity">
              <Controller
                control={control}
                name="instagramAccountId"
                render={({ field }) => (
                  <Select value={field.value ?? "__page"} onValueChange={(v) => field.onChange(v === "__page" ? null : v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__page">Використати Facebook Page</SelectItem>
                      {account.identity.instagramAccounts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Формат і медіа" description="Оберіть формат і креатив. Для Stories/Reels бажана окрема вертикальна версія 9:16.">
          <Controller
            control={control}
            name="format"
            render={({ field }) => (
              <div role="radiogroup" aria-label="Формат" className="grid gap-2 sm:grid-cols-3">
                <ChoiceCard selected={field.value === "single_image"} onSelect={() => field.onChange("single_image")} title="Одне зображення" />
                <ChoiceCard selected={field.value === "single_video"} onSelect={() => field.onChange("single_video")} title="Одне відео" />
                <ChoiceCard selected={field.value === "carousel"} onSelect={() => field.onChange("carousel")} title="Карусель" description="2–10 карток" />
              </div>
            )}
          />
          <Field label="Медіа" error={(formState.errors.media as { message?: string } | undefined)?.message} required>
            {media.length > 0 && (
              <MediaList
                media={media}
                onRemove={(id) =>
                  setValue(
                    "media",
                    media.filter((m) => m.id !== id),
                    { shouldDirty: true, shouldValidate: true },
                  )
                }
              />
            )}
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setPickerOpen("main")}>
              <ImagePlus /> {media.length ? (values.format === "carousel" ? "Додати картку" : "Замінити медіа") : "Додати медіа"}
            </Button>
          </Field>
          <Field label="Вертикальна версія для Stories/Reels (9:16)" hint="Кастомізація під плейсмент: у вертикальних форматах показується ця версія.">
            {values.verticalMedia ? (
              <div className="flex items-end gap-2">
                <MediaThumb media={values.verticalMedia as CreativeMedia} className="w-28" />
                <Button type="button" variant="ghost" size="sm" onClick={() => setValue("verticalMedia", null, { shouldDirty: true })}>
                  Прибрати
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setPickerOpen("vertical")}>
                <ImagePlus /> Додати 9:16
              </Button>
            )}
          </Field>
          <MediaPickerDialog
            open={pickerOpen !== null}
            onOpenChange={(o) => !o && setPickerOpen(null)}
            onPick={addMedia}
            filter={pickerOpen === "vertical" ? (m) => m.aspectRatio === "9:16" : undefined}
            title={pickerOpen === "vertical" ? "Вертикальне медіа 9:16" : "Медіатека"}
          />
        </FormSection>

        <FormSection title="Текст і заклик до дії" description="Перші ~125 символів основного тексту видно без розгортання.">
          <Field label={<span className="flex w-full items-center justify-between">Основний текст (primary text)</span>} htmlFor="a-text" error={formState.errors.primaryText?.message}>
            <Textarea id="a-text" rows={4} {...register("primaryText")} />
            <CharCount value={values.primaryText ?? ""} soft={300} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Заголовок (headline)" htmlFor="a-head" hint="До ~40 символів, щоб не обрізався.">
              <Input id="a-head" {...register("headline")} />
            </Field>
            <Field label="Опис (description)" htmlFor="a-desc">
              <Input id="a-desc" {...register("description")} />
            </Field>
          </div>
          <Field label="Call to action">
            <Controller
              control={control}
              name="cta"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CTAS.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Controller
            control={control}
            name="creativeEnhancements"
            render={({ field }) => (
              <label className="flex items-start gap-2 text-[13px]">
                <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Advantage+ creative" />
                <span>
                  Advantage+ creative enhancements
                  <span className="block text-2xs text-muted-foreground">Автоматичні адаптації (яскравість, обрізка, варіації тексту). У симуляторі — невеликий вплив на CTR. Перевіряйте результат після публікації.</span>
                </span>
              </label>
            )}
          />
        </FormSection>

        {needsUrl && (
          <FormSection title="Місце призначення і трекінг" description="URL посадкової сторінки та параметри для аналітики (GA4/CRM)." aside={<Badge variant={utmOk ? "success" : "warning"}>{utmOk ? "UTM OK" : "Немає коректних UTM"}</Badge>}>
            <Field label="Website URL" htmlFor="a-url" error={formState.errors.destinationUrl?.message} required>
              <div className="flex gap-2">
                <Input id="a-url" {...register("destinationUrl")} placeholder="https://" />
                <Button type="button" variant="outline" size="sm" onClick={() => setValue("destinationUrl", account.landingPage.url, { shouldDirty: true, shouldValidate: true })}>
                  <Link2 /> Сайт бізнесу
                </Button>
              </div>
            </Field>
            <Field label="Display link" htmlFor="a-display">
              <Input id="a-display" {...register("displayLink")} />
            </Field>
            <Field label="URL parameters" htmlFor="a-utm" error={formState.errors.urlParameters?.message} tip="Параметри додаються до URL через «?» або «&». Розділяйте пари «&».">
              <div className="flex gap-2">
                <Input id="a-utm" {...register("urlParameters")} className="font-mono text-xs" placeholder="utm_source=meta&utm_medium=paid_social&utm_campaign=..." />
                <Button type="button" variant="outline" size="sm" onClick={() => setValue("urlParameters", RECOMMENDED_UTM, { shouldDirty: true, shouldValidate: true })}>
                  <Wand2 /> Шаблон
                </Button>
              </div>
            </Field>
            <p className="break-all rounded bg-muted px-2 py-1.5 font-mono text-2xs">{finalUrl(values.destinationUrl ?? "", values.urlParameters ?? "") || "—"}</p>
            <p className="text-2xs text-muted-foreground">
              Динамічні параметри на кшталт {"{{campaign.name}}"} — приклад; синтаксис звіряйте у своєму акаунті (статус у реєстрі: Needs Review). <ArticleLink slug="utm-ga4">UTM і GA4</ArticleLink>
            </p>
          </FormSection>
        )}

        {needsForm && (
          <FormSection title="Миттєва форма (Instant form)" description="Форма відкривається всередині платформи з автозаповненням контактів.">
            <Controller
              control={control}
              name="formType"
              render={({ field }) => (
                <div role="radiogroup" aria-label="Тип форми" className="grid gap-2 sm:grid-cols-2">
                  <ChoiceCard selected={field.value === "more_volume"} onSelect={() => field.onChange("more_volume")} title="More volume" description="Швидке надсилання — більше лідів, нижча якість." />
                  <ChoiceCard selected={field.value === "higher_intent"} onSelect={() => field.onChange("higher_intent")} title="Higher intent" description="Крок перегляду перед надсиланням — менше лідів, вищий намір." />
                </div>
              )}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Кількість питань">
                <Input type="number" min={1} max={10} {...register("formQuestions", { valueAsNumber: true })} />
              </Field>
              <Controller
                control={control}
                name="hasQualifyingQuestion"
                render={({ field }) => (
                  <label className="flex items-center gap-2 pt-5 text-[13px]">
                    <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} /> Кваліфікаційне питання (бюджет, терміни, досвід)
                  </label>
                )}
              />
            </div>
            <Field label="Політика конфіденційності (URL)" htmlFor="a-privacy" error={formState.errors.privacyPolicyUrl?.message} required hint="Обов'язкова для миттєвих форм.">
              <Input id="a-privacy" {...register("privacyPolicyUrl")} placeholder={`https://${account.landingPage.domain}/privacy`} />
            </Field>
          </FormSection>
        )}
      </div>

      <aside className="grid gap-4 xl:sticky xl:top-16 xl:self-start">
        <div className="rounded-lg border bg-card p-3">
          <h3 className="mb-2 text-[13px] font-semibold">Попередній перегляд</h3>
          <AdPreview creative={previewAd.creative} pageName={pageName} />
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold">Оцінка креативу</h3>
            <span className="num text-sm font-semibold">{Math.round(assessment.quality * 100)}/100</span>
          </div>
          <ul className="grid gap-2">
            {assessment.components.map((c) => (
              <li key={c.label} className="text-2xs">
                <div className="flex justify-between">
                  <span>{c.label}</span>
                  <span className="num">{Math.round(c.score * 100)}</span>
                </div>
                <Progress value={c.score * 100} className="mt-0.5" indicatorClassName={c.score < 0.6 ? "bg-warning" : "bg-primary"} />
                <span className="text-muted-foreground">{c.note}</span>
              </li>
            ))}
          </ul>
          {assessment.issues.length > 0 && (
            <ul className="mt-2 space-y-1 rounded-md bg-warning/10 p-2 text-2xs">
              {assessment.issues.map((i) => (
                <li key={i}>• {i}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-2xs text-muted-foreground">Евристика симулятора: пояснює, які властивості креативу зазвичай впливають на результат. <ArticleLink slug="creative-strategy">Креативна стратегія</ArticleLink></p>
        </div>
      </aside>
    </form>
  );
}
