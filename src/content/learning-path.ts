import type { AdAccount, LearningLevel } from "@/domain/types";
import { SANDBOX_ACCOUNT_ID } from "./sandbox";
import { utmPresent } from "@/simulation/tracking";

/**
 * Навчальний маршрут: короткі теми чергуються з практичними діями в симуляторі.
 * Практичні завдання перевіряються автоматично за станом акаунта-пісочниці.
 */

export interface PracticeTask {
  id: string;
  title: string;
  instructions: string;
  href: string;
  check: (sandbox: AdAccount | undefined) => boolean;
}

export interface PathModule {
  id: string;
  title: string;
  theory: string;
  articles: string[];
  practice?: PracticeTask;
  missions: string[];
}

export interface PathLevel {
  id: LearningLevel;
  title: string;
  description: string;
  modules: PathModule[];
  finalMission: string;
}

const userCampaigns = (a?: AdAccount) => (a ? a.campaigns.filter((c) => c.seq > a.seededSeq) : []);
const userAdSets = (a?: AdAccount) => (a ? a.adSets.filter((s) => s.seq > a.seededSeq) : []);
const userAds = (a?: AdAccount) => (a ? a.ads.filter((s) => s.seq > a.seededSeq) : []);

export const LEARNING_PATH: PathLevel[] = [
  {
    id: "beginner",
    title: "Beginner",
    description: "Як влаштований рекламний кабінет: ієрархія, цілі, перший запуск і базові метрики.",
    finalMission: "m01",
    modules: [
      {
        id: "b1",
        title: "Ієрархія Campaign → Ad Set → Ad",
        theory: "Кампанія задає ціль, набір — кому, де, коли й за скільки показувати, оголошення — що саме показувати.",
        articles: ["meta-ads-basics", "campaign-structure"],
        practice: {
          id: "p_b1",
          title: "Створіть чернетку кампанії в пісочниці",
          instructions: "Відкрийте Campaign Builder і збережіть кампанію з ціллю Traffic, набором і оголошенням (можна як чернетку).",
          href: "/campaign-builder",
          check: (a) => userCampaigns(a).some((c) => c.objective === "traffic") && userAds(a).length > 0,
        },
        missions: [],
      },
      {
        id: "b2",
        title: "Цілі кампанії та перший запуск",
        theory: "Обирайте ціль за бізнес-задачею: система оптимізує показ саме під неї.",
        articles: ["campaign-objectives", "business-portfolio"],
        practice: {
          id: "p_b2",
          title: "Опублікуйте кампанію і симулюйте день",
          instructions: "Опублікуйте свою кампанію в пісочниці, натисніть «Simulate 1 day» і знайдіть її результати в таблиці.",
          href: "/ads-manager",
          check: (a) => {
            const ids = new Set(userCampaigns(a).map((c) => c.id));
            return Boolean(a?.metrics.some((m) => ids.has(m.campaignId) && m.impressions > 0));
          },
        },
        missions: ["m04"],
      },
      {
        id: "b3",
        title: "Pixel, UTM і базові метрики",
        theory: "Без трекінгу немає ні оптимізації, ні чесного звіту. CTR, CPC, CPM — перші метрики, які треба читати.",
        articles: ["pixel-capi", "utm-ga4", "analytics-metrics"],
        practice: {
          id: "p_b3",
          title: "Додайте UTM до оголошення",
          instructions: "У будь-якому своєму оголошенні в пісочниці заповніть URL parameters з utm_source, utm_medium, utm_campaign.",
          href: "/ads-manager?tab=ads",
          check: (a) => userAds(a).some((ad) => utmPresent(ad.creative.urlParameters, ad.creative.destinationUrl)),
        },
        missions: [],
      },
    ],
  },
  {
    id: "junior",
    title: "Junior Targetologist",
    description: "Аудиторії, Advantage+, бюджети, навчальна фаза, креативи й лідогенерація.",
    finalMission: "m05",
    modules: [
      {
        id: "j1",
        title: "Аудиторії та Advantage+",
        theory: "Advantage+ audience перетворює ваші налаштування на підказки; жорсткими лишаються лише контролі.",
        articles: ["audiences", "advantage-plus"],
        practice: {
          id: "p_j1",
          title: "Виключіть custom-аудиторію",
          instructions: "Створіть набір, у якому виключено аудиторію наявних клієнтів (наприклад, «Ліди з CRM»).",
          href: "/campaign-builder",
          check: (a) => userAdSets(a).some((s) => s.audience.excludedAudienceIds.length > 0),
        },
        missions: ["m06"],
      },
      {
        id: "j2",
        title: "Бюджети, ставки і навчальна фаза",
        theory: "Набору потрібно ~50 подій оптимізації за 7 днів. Бюджет і подія мають це дозволяти.",
        articles: ["budgets-bidding", "learning-phase"],
        practice: {
          id: "p_j2",
          title: "Виведіть набір з навчальної фази",
          instructions: "Запустіть набір у пісочниці й симулюйте дні, доки статус не стане Active (вихід з навчання).",
          href: "/ads-manager?tab=adsets",
          check: (a) => userAdSets(a).some((s) => s.learning.phase === "active"),
        },
        missions: ["m03"],
      },
      {
        id: "j3",
        title: "Креативи й плейсменти",
        theory: "Креатив — головний важіль таргетингу сьогодні. Адаптуйте формат під плейсменти.",
        articles: ["creative-strategy", "placements"],
        practice: {
          id: "p_j3",
          title: "Додайте вертикальну 9:16 версію",
          instructions: "В оголошенні пісочниці додайте медіа 9:16 для Stories/Reels (поле «Вертикальна версія»).",
          href: "/ads-manager?tab=ads",
          check: (a) => userAds(a).some((ad) => ad.creative.verticalMedia !== null || ad.creative.media[0]?.aspectRatio === "9:16"),
        },
        missions: ["m09"],
      },
      {
        id: "j4",
        title: "Лідогенерація",
        theory: "Кількість лідів ≠ якість. Міряйте вартість кваліфікованого ліда в CRM.",
        articles: ["lead-generation", "edtech-advertising", "special-ad-categories"],
        missions: ["m02"],
      },
    ],
  },
  {
    id: "middle",
    title: "Middle Targetologist",
    description: "Аналітика, атрибуція, A/B тести, оптимізація та діагностика.",
    finalMission: "m07",
    modules: [
      {
        id: "mi1",
        title: "Аналітика й атрибуція",
        theory: "Кожна цифра в кабінеті — модель. Знайте вікно атрибуції та затримку конверсій.",
        articles: ["analytics-metrics", "attribution"],
        practice: {
          id: "p_m1",
          title: "Зберіть 14 днів даних у пісочниці",
          instructions: "Симулюйте пісочницю до 14+ днів, щоб побачити динаміку частоти й вигорання.",
          href: "/ads-manager",
          check: (a) => Boolean(a && a.id === SANDBOX_ACCOUNT_ID && a.simDay >= 14),
        },
        missions: [],
      },
      {
        id: "mi2",
        title: "A/B тестування",
        theory: "Одна змінна, гіпотеза, достатній обсяг, без правок під час тесту.",
        articles: ["ab-testing"],
        practice: {
          id: "p_m2",
          title: "Налаштуйте A/B тест",
          instructions: "Створіть кампанію з увімкненим A/B тестом і гіпотезою «Якщо…, то…».",
          href: "/campaign-builder",
          check: (a) => userCampaigns(a).some((c) => c.abTest?.enabled && c.abTest.hypothesis.length > 10),
        },
        missions: ["m10"],
      },
      {
        id: "mi3",
        title: "Оптимізація і діагностика",
        theory: "Діагноз — це гіпотеза з доказами і наступним тестом, а не вирок.",
        articles: ["optimization", "diagnostics-playbook", "ecommerce"],
        missions: ["m08", "m11"],
      },
    ],
  },
  {
    id: "advanced",
    title: "Advanced Performance Marketer",
    description: "Трекінг, приватність, CRM, аудит і звітування клієнту.",
    finalMission: "m12",
    modules: [
      {
        id: "a1",
        title: "Трекінг і приватність",
        theory: "Pixel + CAPI з дедуплікацією, згода на трекінг, якість зіставлення подій.",
        articles: ["pixel-capi", "events-manager", "privacy-consent", "advertising-standards"],
        practice: {
          id: "p_a1",
          title: "Увімкніть CAPI з дедуплікацією",
          instructions: "В Events Manager пісочниці увімкніть Conversions API і передачу event_id.",
          href: "/events-manager",
          check: (a) => Boolean(a && a.id === SANDBOX_ACCOUNT_ID && a.tracking.capi.enabled && a.tracking.capi.sendsEventId),
        },
        missions: ["m13"],
      },
      {
        id: "a2",
        title: "CRM і розбіжності даних",
        theory: "Кабінет і CRM рахують по-різному. Знайте, кому довіряти для якого рішення.",
        articles: ["crm-discrepancies"],
        missions: ["m14"],
      },
      {
        id: "a3",
        title: "Звітування і робота з клієнтом",
        theory: "План vs факт, інсайти з доказами, наступні кроки, чесні обмеження.",
        articles: ["client-reporting"],
        missions: ["m15"],
      },
    ],
  },
];

export const ALL_PRACTICE = LEARNING_PATH.flatMap((l) => l.modules.map((m) => m.practice).filter(Boolean)) as PracticeTask[];
