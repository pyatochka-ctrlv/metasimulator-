import { z } from "zod";

/**
 * Схеми валідації форм (рівень полів). Перевірки, що залежать від усієї ієрархії
 * (сумісність цілі й місця конверсії, трекінг, спецкатегорії), виконує simulation/validation.ts під час публікації.
 */

const num = (msg = "Введіть число") => z.number({ invalid_type_error: msg, required_error: msg });

export const objectiveEnum = z.enum(["awareness", "traffic", "engagement", "leads", "app_promotion", "sales"]);
export const bidStrategyEnum = z.enum(["highest_volume", "highest_value", "cost_per_result_goal", "roas_goal", "bid_cap"]);

export const campaignFormSchema = z
  .object({
    name: z.string().trim().min(1, "Вкажіть назву кампанії").max(150, "Назва задовга"),
    objective: objectiveEnum,
    specialAdCategories: z.array(z.enum(["financial_products_services", "employment", "housing", "social_issues_elections_politics"])),
    setup: z.enum(["manual", "advantage_plus"]),
    budgetLevel: z.enum(["campaign", "ad_set"]),
    budgetType: z.enum(["daily", "lifetime"]),
    budgetAmount: num("Вкажіть бюджет").min(0, "Бюджет не може бути від'ємним").max(100000, "Завеликий бюджет для симулятора"),
    bidStrategy: bidStrategyEnum,
    bidAmount: num().positive("Сума має бути більшою за 0").optional(),
    roasGoal: num().positive("ROAS goal має бути більшим за 0").optional(),
    budgetSharing: z.boolean(),
    abEnabled: z.boolean(),
    abVariable: z.enum(["creative", "audience", "placement", "optimization"]),
    abHypothesis: z.string().max(500),
    abMetric: z.enum(["cost_per_result", "ctr", "cpc", "roas"]),
  })
  .superRefine((v, ctx) => {
    if (v.budgetLevel === "campaign") {
      if (!(v.budgetAmount >= 1)) ctx.addIssue({ code: "custom", path: ["budgetAmount"], message: "Мінімальний бюджет — $1" });
      if ((v.bidStrategy === "cost_per_result_goal" || v.bidStrategy === "bid_cap") && !(v.bidAmount && v.bidAmount > 0))
        ctx.addIssue({ code: "custom", path: ["bidAmount"], message: "Вкажіть суму для обраної стратегії" });
      if (v.bidStrategy === "roas_goal" && !(v.roasGoal && v.roasGoal > 0)) ctx.addIssue({ code: "custom", path: ["roasGoal"], message: "Вкажіть ROAS goal" });
    }
    if (v.abEnabled && v.abHypothesis.trim().length < 10)
      ctx.addIssue({ code: "custom", path: ["abHypothesis"], message: "Сформулюйте гіпотезу (щонайменше 10 символів)" });
  });

export type CampaignFormValues = z.infer<typeof campaignFormSchema>;

const locationSchema = z.object({
  country: z.enum(["UA", "PL", "DE", "CZ", "US", "GB", "CA"]),
  city: z.string().optional(),
  radiusKm: z.number().min(1).max(80).optional(),
});

export const audienceSchema = z
  .object({
    locations: z.array(locationSchema).min(1, "Додайте хоча б одну локацію"),
    ageMin: num().int().min(18, "Мінімум 18").max(65),
    ageMax: num().int().min(18).max(65),
    genders: z.enum(["all", "male", "female"]),
    languages: z.array(z.string()),
    detailedTargeting: z.array(z.string()),
    includedAudienceIds: z.array(z.string()),
    excludedAudienceIds: z.array(z.string()),
    advantageAudience: z.boolean(),
    minAgeControl: num().int().min(18).max(25),
  })
  .refine((a) => a.ageMin <= a.ageMax, { path: ["ageMax"], message: "Максимальний вік менший за мінімальний" });

export const adSetFormSchema = z
  .object({
    name: z.string().trim().min(1, "Вкажіть назву набору").max(150),
    conversionLocation: z.enum(["none", "website", "app", "website_and_app", "instant_forms", "website_and_instant_forms", "messaging_apps", "calls", "on_your_ad"]),
    performanceGoal: z.string().min(1),
    optimizationEvent: z.string().nullable(),
    budgetType: z.enum(["daily", "lifetime"]),
    budgetAmount: num("Вкажіть бюджет").min(0).max(100000),
    bidStrategy: bidStrategyEnum,
    bidAmount: num().positive().optional(),
    roasGoal: num().positive().optional(),
    startDay: num().int().min(0),
    endDay: num().int().min(0).nullable(),
    audience: audienceSchema,
    placements: z.object({ mode: z.enum(["advantage", "manual"]), selected: z.array(z.string()) }),
    attribution: z.object({ clickWindowDays: z.union([z.literal(1), z.literal(7)]), viewThrough: z.boolean(), engageThrough: z.boolean() }),
    frequencyCapEnabled: z.boolean(),
    frequencyCapImpressions: num().int().min(1).max(20),
    frequencyCapDays: num().int().min(1).max(30),
  })
  .superRefine((v, ctx) => {
    if (v.endDay !== null && v.endDay < v.startDay) ctx.addIssue({ code: "custom", path: ["endDay"], message: "Дата завершення раніше за дату початку" });
    if (v.placements.mode === "manual" && v.placements.selected.length === 0)
      ctx.addIssue({ code: "custom", path: ["placements"], message: "Оберіть хоча б один плейсмент" });
    if (v.budgetType === "lifetime" && v.endDay === null) ctx.addIssue({ code: "custom", path: ["endDay"], message: "Бюджет на весь період потребує дати завершення" });
  });

export type AdSetFormValues = z.infer<typeof adSetFormSchema>;

const mediaSchema = z.object({
  id: z.string(),
  kind: z.enum(["image", "video"]),
  aspectRatio: z.enum(["1:1", "4:5", "9:16", "16:9"]),
  source: z.enum(["library", "upload"]),
  libraryKey: z.string().optional(),
  dataUrl: z.string().optional(),
  label: z.string(),
  durationSec: z.number().optional(),
  hookStrength: z.number().optional(),
});

export const urlParamsSchema = z
  .string()
  .max(1000)
  .refine((s) => s.trim() === "" || /^[^?&\s][^\s]*$/.test(s.trim()), "Параметри без пробілів і без «?» на початку (наприклад, utm_source=meta&utm_medium=paid_social)");

export const adFormSchema = z
  .object({
    name: z.string().trim().min(1, "Вкажіть назву оголошення").max(150),
    facebookPageId: z.string().min(1, "Оберіть сторінку"),
    instagramAccountId: z.string().nullable(),
    format: z.enum(["single_image", "single_video", "carousel"]),
    media: z.array(mediaSchema).min(1, "Додайте медіа"),
    verticalMedia: mediaSchema.nullable(),
    primaryText: z.string().max(2200, "Максимум 2200 символів"),
    headline: z.string().max(255),
    description: z.string().max(255),
    cta: z.string(),
    destinationUrl: z.string().max(2000),
    displayLink: z.string().max(255),
    urlParameters: urlParamsSchema,
    creativeEnhancements: z.boolean(),
    instantFormEnabled: z.boolean(),
    formType: z.enum(["more_volume", "higher_intent"]),
    formQuestions: num().int().min(1).max(10),
    privacyPolicyUrl: z.string().max(2000),
    hasQualifyingQuestion: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.destinationUrl.trim()) {
      try {
        const u = new URL(v.destinationUrl);
        if (!/^https?:$/.test(u.protocol)) throw new Error();
      } catch {
        ctx.addIssue({ code: "custom", path: ["destinationUrl"], message: "Некоректний URL (приклад: https://site.example/page)" });
      }
    }
    if (v.format === "single_video" && v.media[0] && v.media[0].kind !== "video") ctx.addIssue({ code: "custom", path: ["media"], message: "Для формату «Одне відео» оберіть відео" });
    if (v.format === "carousel" && v.media.length < 2) ctx.addIssue({ code: "custom", path: ["media"], message: "Карусель потребує щонайменше 2 картки" });
    if (v.instantFormEnabled && v.privacyPolicyUrl.trim()) {
      try {
        new URL(v.privacyPolicyUrl);
      } catch {
        ctx.addIssue({ code: "custom", path: ["privacyPolicyUrl"], message: "Некоректне посилання на політику конфіденційності" });
      }
    }
  });

export type AdFormValues = z.infer<typeof adFormSchema>;
