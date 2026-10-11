import type {
  BidStrategy,
  Campaign,
  ConversionLocation,
  Objective,
  PerformanceGoal,
  PixelEvent,
  AppEvent,
  SpecialAdCategory,
} from "./types";

/**
 * Правила доступності налаштувань залежно від цілі.
 * Це навчальна модель логіки ODAX-цілей. Реальні акаунти можуть відрізнятися
 * через поступове розгортання функцій, країну та тип кампанії.
 */

const LOCATIONS: Record<Objective, ConversionLocation[]> = {
  awareness: ["none"],
  traffic: ["website", "app", "messaging_apps", "calls"],
  engagement: ["on_your_ad", "messaging_apps", "website", "app", "calls"],
  leads: ["website", "instant_forms", "website_and_instant_forms", "messaging_apps", "calls", "app"],
  app_promotion: ["app"],
  sales: ["website", "app", "website_and_app", "messaging_apps", "calls"],
};

const GOALS: Record<Objective, Partial<Record<ConversionLocation, PerformanceGoal[]>>> = {
  awareness: { none: ["reach", "impressions", "ad_recall_lift", "thruplay", "video_views_2s"] },
  traffic: {
    website: ["landing_page_views", "link_clicks", "daily_unique_reach", "impressions"],
    app: ["link_clicks"],
    messaging_apps: ["link_clicks", "conversations"],
    calls: ["calls"],
  },
  engagement: {
    on_your_ad: ["thruplay", "video_views_2s", "post_engagement", "impressions", "reach"],
    messaging_apps: ["conversations", "link_clicks"],
    website: ["conversions", "landing_page_views", "link_clicks"],
    app: ["app_events", "link_clicks"],
    calls: ["calls"],
  },
  leads: {
    website: ["conversions", "landing_page_views", "link_clicks", "daily_unique_reach", "impressions"],
    instant_forms: ["leads", "conversion_leads"],
    website_and_instant_forms: ["leads"],
    messaging_apps: ["conversations", "leads"],
    calls: ["calls"],
    app: ["app_events"],
  },
  app_promotion: { app: ["app_installs", "app_events", "conversion_value"] },
  sales: {
    website: ["conversions", "conversion_value", "landing_page_views", "link_clicks", "daily_unique_reach", "impressions"],
    app: ["app_events", "conversion_value"],
    website_and_app: ["conversions"],
    messaging_apps: ["conversations", "conversions"],
    calls: ["calls"],
  },
};

export function conversionLocationsFor(objective: Objective): ConversionLocation[] {
  return LOCATIONS[objective];
}

export function performanceGoalsFor(objective: Objective, location: ConversionLocation): PerformanceGoal[] {
  return GOALS[objective][location] ?? [];
}

export function defaultLocation(objective: Objective): ConversionLocation {
  return LOCATIONS[objective][0];
}

export function defaultGoal(objective: Objective, location: ConversionLocation): PerformanceGoal {
  return performanceGoalsFor(objective, location)[0] ?? "link_clicks";
}

export function bidStrategiesFor(goal: PerformanceGoal): BidStrategy[] {
  switch (goal) {
    case "conversion_value":
      return ["highest_value", "roas_goal"];
    case "reach":
    case "impressions":
    case "daily_unique_reach":
    case "ad_recall_lift":
      return ["highest_volume", "bid_cap"];
    default:
      return ["highest_volume", "cost_per_result_goal", "bid_cap"];
  }
}

export function defaultBidStrategy(goal: PerformanceGoal): BidStrategy {
  return bidStrategiesFor(goal)[0];
}

/** Чи потрібна подія Pixel/датасету для цієї цілі ефективності. */
export function requiresPixelEvent(location: ConversionLocation, goal: PerformanceGoal): boolean {
  return (
    (location === "website" || location === "website_and_app" || location === "messaging_apps") &&
    (goal === "conversions" || goal === "conversion_value")
  );
}

export function requiresPixel(location: ConversionLocation, goal: PerformanceGoal): boolean {
  return requiresPixelEvent(location, goal) || (goal === "landing_page_views" && location === "website");
}

export function requiresApp(location: ConversionLocation): boolean {
  return location === "app" || location === "website_and_app";
}

export function appEventGoal(goal: PerformanceGoal): boolean {
  return goal === "app_installs" || goal === "app_events" || goal === "conversion_value";
}

/** Рекомендовані події для конверсійних цілей. */
export function recommendedEvents(objective: Objective, goal: PerformanceGoal): (PixelEvent | AppEvent)[] {
  if (objective === "app_promotion") return goal === "app_installs" ? ["Install"] : ["AppRegistration", "AppPurchase"];
  if (goal === "conversion_value") return ["Purchase"];
  switch (objective) {
    case "leads":
      return ["Lead", "CompleteRegistration", "Contact", "Schedule", "Subscribe", "StartTrial"];
    case "sales":
      return ["Purchase", "InitiateCheckout", "AddToCart", "ViewContent", "StartTrial", "Subscribe"];
    case "engagement":
      return ["ViewContent", "Contact", "Lead"];
    default:
      return ["ViewContent"];
  }
}

/** Чи має сенс налаштування атрибуції (лише для конверсійних цілей). */
export function attributionConfigurable(goal: PerformanceGoal): boolean {
  return goal === "conversions" || goal === "conversion_value" || goal === "app_events" || goal === "app_installs";
}

/** Advantage+ campaign setup — для продажів, застосунків і лідів. */
export function advantagePlusSetupAvailable(objective: Objective): boolean {
  return objective === "sales" || objective === "app_promotion" || objective === "leads";
}

export function abTestVariables(objective: Objective): { id: "creative" | "audience" | "placement" | "optimization"; label: string }[] {
  const base = [
    { id: "creative" as const, label: "Креатив (оголошення)" },
    { id: "audience" as const, label: "Аудиторія (набори)" },
    { id: "placement" as const, label: "Плейсменти (набори)" },
  ];
  if (objective === "awareness") return base;
  return [...base, { id: "optimization" as const, label: "Подія/ціль оптимізації (набори)" }];
}

export interface SpecialCategoryRules {
  active: boolean;
  lockedAgeMin: number;
  lockedAgeMax: number;
  gendersLocked: boolean;
  lookalikesAllowed: boolean;
  minCityRadiusKm: number;
  sensitiveInterestsAllowed: boolean;
  notes: string[];
}

/** Обмеження таргетингу для спеціальних категорій (навчальне узагальнення; деталі залежать від країни). */
export function specialCategoryRules(categories: SpecialAdCategory[]): SpecialCategoryRules {
  if (categories.length === 0) {
    return {
      active: false,
      lockedAgeMin: 13,
      lockedAgeMax: 65,
      gendersLocked: false,
      lookalikesAllowed: true,
      minCityRadiusKm: 1,
      sensitiveInterestsAllowed: false,
      notes: [],
    };
  }
  return {
    active: true,
    lockedAgeMin: 18,
    lockedAgeMax: 65,
    gendersLocked: true,
    lookalikesAllowed: false,
    minCityRadiusKm: 25,
    sensitiveInterestsAllowed: false,
    notes: [
      "Вік фіксовано 18–65+, гендер — усі.",
      "Lookalike-аудиторії та частина detailed targeting недоступні.",
      "Таргетинг на місто — лише з мінімальним радіусом (у симуляторі 25 км).",
      ...(categories.includes("social_issues_elections_politics")
        ? ["Потрібна авторизація рекламодавця й дисклеймер. У ЄС такі оголошення не показуються з жовтня 2025."]
        : []),
    ],
  };
}

/** Пояснення, чому опція недоступна (для tooltip у формах). */
export function unavailableReason(
  kind: "advantage_setup" | "campaign_budget" | "attribution" | "bid_strategy" | "location" | "goal",
  ctx: { objective: Objective; goal?: PerformanceGoal; campaign?: Campaign },
): string {
  switch (kind) {
    case "advantage_setup":
      return `Advantage+ campaign setup у симуляторі доступний для цілей Sales, Leads та App promotion. Для «${ctx.objective}» використовується ручне налаштування.`;
    case "attribution":
      return "Налаштування атрибуції застосовується лише до конверсійних цілей ефективності (conversions, value, app events). Для кліків чи охоплення воно не має сенсу.";
    case "bid_strategy":
      return "Ця стратегія ставок несумісна з обраною ціллю ефективності.";
    case "campaign_budget":
      return "При Advantage+ campaign setup бюджет керується на рівні кампанії.";
    case "location":
      return "Місце конверсії недоступне для обраної цілі кампанії.";
    case "goal":
      return "Ціль ефективності недоступна для обраного місця конверсії.";
  }
}
