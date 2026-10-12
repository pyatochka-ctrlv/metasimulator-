import { createAccount, type AccountConfig } from "@/domain/account-builder";
import type { AdAccount, Audience } from "@/domain/types";

/** Вигадані навчальні бізнеси. Домени .example зарезервовані й не ведуть на реальні сайти. */

type Extra = Partial<Omit<AccountConfig, "id" | "seed">> & { audiences?: Omit<Audience, "accountId" | "createdAt">[] };

const base = (id: string, seed: number, cfg: Omit<AccountConfig, "id" | "seed">, extra: Extra): AdAccount =>
  createAccount({ ...cfg, ...extra, id, seed, tracking: { ...cfg.tracking, ...extra.tracking }, landingPage: { ...cfg.landingPage, ...extra.landingPage } });

export function speaklyAccount(id: string, seed: number, extra: Extra = {}): AdAccount {
  return base(
    id,
    seed,
    {
      name: "Speakly Lab · онлайн-школа англійської",
      kind: "mission",
      vertical: "education",
      primaryCountry: "UA",
      virtualBudget: 3000,
      startDate: "2026-04-06",
      landingPage: {
        domain: "speakly-lab.example",
        primaryConversion: "lead",
        url: "https://speakly-lab.example/free-lesson",
        loadSpeed: "fast",
        offerKeywords: ["пробний урок", "англійська", "розмовна", "безкоштовний"],
        baseConversionRate: 0.11,
        mobileFriendly: true,
      },
      economics: { averageOrderValue: 220, margin: 0.55, leadToSaleRate: 0.15, saleValueFromLead: 220 },
      tracking: { pixel: { installed: true, id: "px_7781203", events: ["PageView", "ViewContent", "Lead"], duplicateBrowserEvents: false } },
      identity: { pages: [{ id: "page_speakly", name: "Speakly Lab" }], instagramAccounts: [{ id: "ig_speakly", username: "@speakly.lab" }] },
      audiences: [
        { id: "aud_sp_site", name: "Відвідувачі сайту · 30 днів", type: "custom_website", source: "Pixel PageView", size: 14000, retentionDays: 30, intent: 0.6 },
        { id: "aud_sp_students", name: "Студенти (CRM)", type: "custom_customer_list", source: "Список клієнтів", size: 3100, intent: 0.85 },
        {
          id: "aud_sp_lal",
          name: "Lookalike 1% · Студенти (UA)",
          type: "lookalike",
          source: "Схожі на студентів",
          size: 190000,
          lookalike: { sourceAudienceId: "aud_sp_students", country: "UA", percent: 1 },
          intent: 0.35,
        },
      ],
    },
    extra,
  );
}

export function pixelPathAccount(id: string, seed: number, extra: Extra = {}): AdAccount {
  return base(
    id,
    seed,
    {
      name: "Pixel Path · курс UX/UI дизайну",
      kind: "mission",
      vertical: "education",
      primaryCountry: "UA",
      virtualBudget: 4000,
      startDate: "2026-05-04",
      landingPage: {
        domain: "pixelpath.example",
        primaryConversion: "lead",
        url: "https://pixelpath.example/consultation",
        loadSpeed: "average",
        offerKeywords: ["консультація", "ux/ui", "дизайн", "портфоліо", "працевлаштування"],
        baseConversionRate: 0.08,
        mobileFriendly: true,
      },
      economics: { averageOrderValue: 650, margin: 0.6, leadToSaleRate: 0.1, saleValueFromLead: 650 },
      tracking: { pixel: { installed: true, id: "px_3349811", events: ["PageView", "ViewContent", "Lead"], duplicateBrowserEvents: false } },
      identity: { pages: [{ id: "page_pixelpath", name: "Pixel Path School" }], instagramAccounts: [{ id: "ig_pixelpath", username: "@pixelpath.school" }] },
      audiences: [
        { id: "aud_pp_site", name: "Відвідувачі сайту · 30 днів", type: "custom_website", source: "Pixel PageView", size: 11000, retentionDays: 30, intent: 0.6 },
        { id: "aud_pp_leads", name: "Ліди · 180 днів (CRM)", type: "custom_customer_list", source: "CRM", size: 5200, intent: 0.75 },
        { id: "aud_pp_form", name: "Відкрили лід-форму · 90 днів", type: "custom_lead_form", source: "Instant forms", size: 7400, retentionDays: 90, intent: 0.55 },
      ],
    },
    extra,
  );
}

export function excelProAccount(id: string, seed: number, extra: Extra = {}): AdAccount {
  return base(
    id,
    seed,
    {
      name: "Excel Pro · міні-курс для аналітиків",
      kind: "mission",
      vertical: "education",
      primaryCountry: "UA",
      virtualBudget: 4000,
      startDate: "2026-06-01",
      landingPage: {
        domain: "excel-pro.example",
        primaryConversion: "purchase",
        url: "https://excel-pro.example/course",
        loadSpeed: "fast",
        offerKeywords: ["excel", "аналітик", "таблиці", "курс", "звіти"],
        baseConversionRate: 0.035,
        mobileFriendly: true,
      },
      economics: { averageOrderValue: 49, margin: 0.8, leadToSaleRate: 0, saleValueFromLead: 0 },
      tracking: { pixel: { installed: true, id: "px_9912044", events: ["PageView", "ViewContent", "InitiateCheckout", "Purchase"], duplicateBrowserEvents: false } },
      identity: { pages: [{ id: "page_excel", name: "Excel Pro" }], instagramAccounts: [{ id: "ig_excel", username: "@excel.pro.ua" }] },
      audiences: [
        { id: "aud_ex_buyers", name: "Покупці курсу · 180 днів", type: "custom_customer_list", source: "Список покупців", size: 1500, intent: 0.9 },
        { id: "aud_ex_site", name: "Відвідувачі сайту · 30 днів", type: "custom_website", source: "Pixel PageView", size: 9000, retentionDays: 30, intent: 0.6 },
      ],
    },
    extra,
  );
}

export function zernoAccount(id: string, seed: number, extra: Extra = {}): AdAccount {
  return base(
    id,
    seed,
    {
      name: "Кав'ярня «Зерно» · Львів",
      kind: "mission",
      vertical: "local_services",
      primaryCountry: "UA",
      virtualBudget: 1000,
      startDate: "2026-09-07",
      landingPage: {
        domain: "zerno-coffee.example",
        primaryConversion: "lead",
        url: "https://zerno-coffee.example/menu",
        loadSpeed: "fast",
        offerKeywords: ["кава", "львів", "сніданок", "поруч"],
        baseConversionRate: 0.05,
        mobileFriendly: true,
      },
      economics: { averageOrderValue: 6, margin: 0.65, leadToSaleRate: 0.5, saleValueFromLead: 6 },
      identity: { pages: [{ id: "page_zerno", name: "Зерно · кав'ярня" }], instagramAccounts: [{ id: "ig_zerno", username: "@zerno.lviv" }] },
    },
    extra,
  );
}

export function glynaAccount(id: string, seed: number, extra: Extra = {}): AdAccount {
  return base(
    id,
    seed,
    {
      name: "«Глина» · інтернет-магазин кераміки",
      kind: "mission",
      vertical: "ecommerce",
      primaryCountry: "UA",
      virtualBudget: 6000,
      startDate: "2026-02-02",
      landingPage: {
        domain: "glyna-shop.example",
        primaryConversion: "purchase",
        url: "https://glyna-shop.example/collection",
        loadSpeed: "average",
        offerKeywords: ["кераміка", "посуд", "ручна робота", "чашки", "доставка"],
        baseConversionRate: 0.028,
        mobileFriendly: true,
      },
      economics: { averageOrderValue: 42, margin: 0.45, leadToSaleRate: 0, saleValueFromLead: 0 },
      tracking: {
        pixel: { installed: true, id: "px_5150277", events: ["PageView", "ViewContent", "AddToCart", "InitiateCheckout", "Purchase"], duplicateBrowserEvents: false },
        capi: { enabled: true, sendsEventId: true, eventMatchQuality: 7 },
      },
      identity: { pages: [{ id: "page_glyna", name: "Глина · кераміка ручної роботи" }], instagramAccounts: [{ id: "ig_glyna", username: "@glyna.ceramics" }] },
      audiences: [
        { id: "aud_gl_site", name: "Відвідувачі сайту · 30 днів", type: "custom_website", source: "Pixel PageView", size: 22000, retentionDays: 30, intent: 0.55 },
        { id: "aud_gl_atc", name: "Додали в кошик · 14 днів", type: "custom_website", source: "Pixel AddToCart", size: 2600, retentionDays: 14, intent: 0.85 },
        { id: "aud_gl_buyers", name: "Покупці · 180 днів", type: "custom_customer_list", source: "Список покупців", size: 1900, intent: 0.9 },
        { id: "aud_gl_ig", name: "Взаємодія з Instagram · 90 днів", type: "custom_engagement", source: "Instagram-профіль", size: 15000, retentionDays: 90, intent: 0.4 },
        {
          id: "aud_gl_lal",
          name: "Lookalike 2% · Покупці (UA)",
          type: "lookalike",
          source: "Схожі на покупців",
          size: 380000,
          lookalike: { sourceAudienceId: "aud_gl_buyers", country: "UA", percent: 2 },
          intent: 0.35,
        },
      ],
    },
    extra,
  );
}
