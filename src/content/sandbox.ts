import { buildCampaign, createAccount, libMedia, runHistory, sealScenario } from "@/domain/account-builder";
import { RECOMMENDED_UTM } from "@/domain/factories";
import type { AdAccount } from "@/domain/types";

export const SANDBOX_ACCOUNT_ID = "acc_sandbox";

/**
 * Навчальний акаунт «пісочниця»: вигадана онлайн-школа.
 * Містить одну приклад-кампанію з 7 днями історії, щоб аналітика не була порожньою.
 */
export function createSandboxAccount(seed = 20260302): AdAccount {
  let acc = createAccount({
    id: SANDBOX_ACCOUNT_ID,
    name: "Навчальний акаунт · Школа «Сигнал»",
    kind: "sandbox",
    vertical: "education",
    primaryCountry: "UA",
    seed,
    virtualBudget: 5000,
    startDate: "2026-03-02",
    landingPage: {
      domain: "signal-school.example",
      primaryConversion: "lead",
      url: "https://signal-school.example/free-lesson",
      loadSpeed: "average",
      offerKeywords: ["безкоштовний урок", "таргетована реклама", "практика", "ментор"],
      baseConversionRate: 0.12,
      mobileFriendly: true,
    },
    economics: { averageOrderValue: 180, margin: 0.6, leadToSaleRate: 0.12, saleValueFromLead: 180 },
    tracking: {
      pixel: { installed: true, id: "px_5520193", events: ["PageView", "ViewContent", "Lead", "CompleteRegistration"], duplicateBrowserEvents: false },
      capi: { enabled: false, sendsEventId: false, eventMatchQuality: 5 },
      crmConnected: true,
    },
    identity: {
      pages: [{ id: "page_signal", name: "Школа «Сигнал»" }],
      instagramAccounts: [{ id: "ig_signal", username: "@signal.school" }],
    },
    audiences: [
      { id: "aud_site_30", name: "Відвідувачі сайту · 30 днів", type: "custom_website", source: "Pixel: PageView, 30 днів", size: 18000, retentionDays: 30, intent: 0.65 },
      { id: "aud_leads_crm", name: "Ліди з CRM · 180 днів", type: "custom_customer_list", source: "Список клієнтів (хешовані email)", size: 4200, intent: 0.8 },
      { id: "aud_ig_eng", name: "Взаємодія з Instagram · 90 днів", type: "custom_engagement", source: "Instagram-профіль", size: 26000, retentionDays: 90, intent: 0.45 },
      {
        id: "aud_lal_leads_1",
        name: "Lookalike 1% · Ліди CRM (UA)",
        type: "lookalike",
        source: "Схожі на «Ліди з CRM»",
        size: 190000,
        lookalike: { sourceAudienceId: "aud_leads_crm", country: "UA", percent: 1 },
        intent: 0.35,
      },
    ],
  });
  acc = buildCampaign(acc, {
    objective: "traffic",
    campaign: { name: "Приклад · Трафік на безкоштовний урок", budgetLevel: "campaign", budgetAmount: 25, bidStrategy: "highest_volume" },
    adSets: [
      {
        adSet: {
          name: "UA · 21–40 · Advantage+ audience",
          conversionLocation: "website",
          performanceGoal: "landing_page_views",
          audience: {
            locations: [{ country: "UA" }],
            ageMin: 21,
            ageMax: 40,
            genders: "all",
            languages: [],
            detailedTargeting: ["int_online_learning", "int_digital_marketing"],
            includedAudienceIds: [],
            excludedAudienceIds: ["aud_leads_crm"],
            advantageAudience: true,
            minAgeControl: 18,
          },
        },
        ads: [
          {
            name: "Відео · 3 помилки новачка",
            creative: {
              media: [libMedia("edu_reel_916")],
              primaryText: "Безкоштовний урок з таргетованої реклами: практика на симуляторі та розбір від ментора. Без води — лише кроки, які можна повторити.",
              headline: "Безкоштовний урок таргету",
              description: "Практика + ментор",
              cta: "LEARN_MORE",
              urlParameters: RECOMMENDED_UTM,
            },
          },
          {
            name: "Фото · Ментор з ноутбуком",
            creative: {
              media: [libMedia("edu_mentor_square")],
              primaryText: "Хочеш зрозуміти, як працює таргетована реклама? Пройди безкоштовний урок з ментором і зроби першу практичну вправу.",
              headline: "Перший крок у таргеті",
              description: "",
              cta: "LEARN_MORE",
              urlParameters: RECOMMENDED_UTM,
            },
          },
        ],
      },
    ],
  });
  return sealScenario(runHistory(acc, 7));
}
