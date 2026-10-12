import type {
  AppEvent,
  AspectRatio,
  BidStrategy,
  CallToAction,
  ConversionLocation,
  CountryCode,
  Objective,
  PerformanceGoal,
  PixelEvent,
  PlacementId,
  SpecialAdCategory,
  Vertical,
} from "./types";

/** Довідники навчального кабінету. Числові параметри — навчальні припущення, а не дані Meta. */

export const OBJECTIVES: { id: Objective; label: string; labelUa: string; description: string; examples: string }[] = [
  {
    id: "awareness",
    label: "Awareness",
    labelUa: "Впізнаваність",
    description: "Показати рекламу якомога більшій кількості людей, які ймовірно її запам'ятають.",
    examples: "Охоплення, впізнаваність бренду, перегляди відео",
  },
  {
    id: "traffic",
    label: "Traffic",
    labelUa: "Трафік",
    description: "Спрямувати людей на сайт, у застосунок, профіль чи месенджер.",
    examples: "Кліки за посиланням, перегляди цільової сторінки",
  },
  {
    id: "engagement",
    label: "Engagement",
    labelUa: "Взаємодія",
    description: "Отримати більше повідомлень, переглядів відео, взаємодій з дописом або дзвінків.",
    examples: "Повідомлення, перегляди відео, взаємодія з дописом",
  },
  {
    id: "leads",
    label: "Leads",
    labelUa: "Ліди",
    description: "Зібрати контакти потенційних клієнтів через форми, сайт, месенджери чи дзвінки.",
    examples: "Миттєві форми, ліди на сайті, реєстрації",
  },
  {
    id: "app_promotion",
    label: "App promotion",
    labelUa: "Просування застосунку",
    description: "Залучити нових користувачів застосунку та дії в ньому.",
    examples: "Встановлення, події в застосунку",
  },
  {
    id: "sales",
    label: "Sales",
    labelUa: "Продажі",
    description: "Знайти людей, які ймовірно здійснять покупку чи іншу цінну дію.",
    examples: "Конверсії, каталог, покупки, цінність конверсій",
  },
];

export const objectiveLabel = (o: Objective) => OBJECTIVES.find((x) => x.id === o)?.label ?? o;

export const SPECIAL_AD_CATEGORIES: { id: SpecialAdCategory; label: string; hint: string }[] = [
  {
    id: "financial_products_services",
    label: "Financial products and services",
    hint: "Кредити, кредитні картки, страхування, інвестиції, банківські рахунки. Замінила категорію Credit.",
  },
  { id: "employment", label: "Employment", hint: "Вакансії, стажування, програми працевлаштування." },
  { id: "housing", label: "Housing", hint: "Продаж/оренда житла, іпотека, страхування житла." },
  {
    id: "social_issues_elections_politics",
    label: "Social issues, elections or politics",
    hint: "Потрібна авторизація рекламодавця та дисклеймер «Paid for by». У ЄС з жовтня 2025 Meta не показує такі оголошення.",
  },
];

export const CONVERSION_LOCATIONS: Record<ConversionLocation, { label: string; hint: string }> = {
  none: { label: "—", hint: "Ціль не потребує місця конверсії." },
  website: { label: "Website", hint: "Люди переходять на ваш сайт. Потрібен Pixel/датасет для подій." },
  app: { label: "App", hint: "Люди встановлюють або відкривають застосунок. Потрібен зареєстрований застосунок і SDK." },
  website_and_app: { label: "Website and app", hint: "Система обирає, куди вести людину: на сайт або в застосунок." },
  instant_forms: { label: "Instant forms", hint: "Миттєва форма відкривається всередині Facebook/Instagram з автозаповненням." },
  website_and_instant_forms: {
    label: "Website and instant forms",
    hint: "Система розподіляє показ між сайтом і миттєвою формою.",
  },
  messaging_apps: { label: "Messaging apps", hint: "Messenger, Instagram Direct, WhatsApp." },
  calls: { label: "Calls", hint: "Дзвінки бізнесу безпосередньо з оголошення." },
  on_your_ad: { label: "On your ad", hint: "Дія відбувається в самому оголошенні: перегляд відео або взаємодія." },
};

export const PERFORMANCE_GOALS: Record<PerformanceGoal, { label: string; resultLabel: string; hint: string }> = {
  reach: { label: "Maximize reach of ads", resultLabel: "Reach", hint: "Показати рекламу максимальній кількості унікальних людей." },
  impressions: { label: "Maximize number of impressions", resultLabel: "Impressions", hint: "Максимум показів, допускаються повторні." },
  ad_recall_lift: {
    label: "Maximize ad recall lift",
    resultLabel: "Estimated ad recall lift (people)",
    hint: "Показ людям, які ймовірно запам'ятають рекламу (модельна оцінка).",
  },
  thruplay: { label: "Maximize ThruPlay views", resultLabel: "ThruPlays", hint: "Перегляди відео до кінця або щонайменше 15 с." },
  video_views_2s: {
    label: "Maximize 2-second continuous video plays",
    resultLabel: "2-second continuous video plays",
    hint: "Безперервні перегляди ≥2 с.",
  },
  link_clicks: {
    label: "Maximize number of link clicks",
    resultLabel: "Link clicks",
    hint: "Кліки за посиланням. Не гарантує, що сторінка завантажилась.",
  },
  landing_page_views: {
    label: "Maximize number of landing page views",
    resultLabel: "Landing page views",
    hint: "Перехід, після якого сторінка завантажилась і Pixel зафіксував подію. Потрібен Pixel.",
  },
  daily_unique_reach: {
    label: "Maximize daily unique reach",
    resultLabel: "Daily unique reach",
    hint: "Показ людям до одного разу на день.",
  },
  conversations: { label: "Maximize number of conversations", resultLabel: "Messaging conversations started", hint: "Розпочаті розмови." },
  post_engagement: { label: "Maximize engagement with a post", resultLabel: "Post engagements", hint: "Реакції, коментарі, поширення." },
  calls: { label: "Maximize number of calls", resultLabel: "Calls placed", hint: "Дзвінки з оголошення." },
  leads: { label: "Maximize number of leads", resultLabel: "Leads", hint: "Максимальна кількість заповнених форм." },
  conversion_leads: {
    label: "Maximize number of conversion leads",
    resultLabel: "Leads",
    hint: "Оптимізація на ліди, що ймовірніше стануть клієнтами. Потрібен зворотний зв'язок із CRM.",
  },
  conversions: { label: "Maximize number of conversions", resultLabel: "Conversions", hint: "Оптимізація під обрану подію Pixel/датасету." },
  conversion_value: {
    label: "Maximize value of conversions",
    resultLabel: "Purchases (value)",
    hint: "Оптимізація під цінність покупок. Потрібні дані про value у подіях.",
  },
  app_installs: { label: "Maximize number of app installs", resultLabel: "App installs", hint: "Встановлення застосунку." },
  app_events: { label: "Maximize number of app events", resultLabel: "App events", hint: "Цільові дії в застосунку." },
};

export const BID_STRATEGIES: Record<BidStrategy, { label: string; hint: string; needs?: "bidAmount" | "roasGoal" }> = {
  highest_volume: {
    label: "Highest volume",
    hint: "Витратити бюджет і отримати максимум результатів. Стратегія за замовчуванням.",
  },
  highest_value: { label: "Highest value", hint: "Максимізувати цінність покупок (для value-оптимізації)." },
  cost_per_result_goal: {
    label: "Cost per result goal",
    hint: "Тримати середню вартість результату біля цілі. Занадто низька ціль обмежує доставку.",
    needs: "bidAmount",
  },
  roas_goal: { label: "ROAS goal", hint: "Утримувати мінімальну рентабельність витрат. Потрібна value-оптимізація.", needs: "roasGoal" },
  bid_cap: { label: "Bid cap", hint: "Максимальна ставка в аукціоні. Вимагає розуміння економіки, легко недовитратити.", needs: "bidAmount" },
};

export const PIXEL_EVENTS: { id: PixelEvent; label: string; funnel: "top" | "mid" | "bottom" }[] = [
  { id: "PageView", label: "PageView", funnel: "top" },
  { id: "ViewContent", label: "ViewContent", funnel: "top" },
  { id: "AddToCart", label: "AddToCart", funnel: "mid" },
  { id: "InitiateCheckout", label: "InitiateCheckout", funnel: "mid" },
  { id: "Purchase", label: "Purchase", funnel: "bottom" },
  { id: "Lead", label: "Lead", funnel: "bottom" },
  { id: "CompleteRegistration", label: "CompleteRegistration", funnel: "bottom" },
  { id: "Contact", label: "Contact", funnel: "mid" },
  { id: "Schedule", label: "Schedule", funnel: "bottom" },
  { id: "Subscribe", label: "Subscribe", funnel: "bottom" },
  { id: "StartTrial", label: "StartTrial", funnel: "bottom" },
];

export const APP_EVENTS: { id: AppEvent; label: string }[] = [
  { id: "Install", label: "Install" },
  { id: "AppRegistration", label: "Complete registration (app)" },
  { id: "AppPurchase", label: "Purchase (app)" },
];

export interface PlacementInfo {
  id: PlacementId;
  label: string;
  group: "Feeds" | "Stories" | "Reels" | "Search" | "Messages" | "Apps and sites";
  platform: "Facebook" | "Instagram" | "Messenger" | "Threads" | "Audience Network";
  /** Відносна частка доступного інвентарю. */
  inventory: number;
  /** Множник CPM відносно стрічки Facebook. */
  cpm: number;
  /** Множник CTR (link). */
  ctr: number;
  /** Частка кліків, що доходять до завантаження сторінки. */
  lpvQuality: number;
  /** Відносна схильність сесій з цього плейсменту до конверсії (1 = як у стрічці). */
  cvrQuality: number;
  /** Рекомендоване співвідношення сторін. */
  preferredAspect: AspectRatio[];
  /** ID у реєстрі функцій, якщо доступність потребує перевірки. */
  featureId?: string;
  supportsVideoOnly?: boolean;
}

export const PLACEMENTS: PlacementInfo[] = [
  { id: "facebook_feed", label: "Facebook Feed", group: "Feeds", platform: "Facebook", inventory: 0.2, cpm: 1.0, ctr: 1.0, cvrQuality: 1.0, lpvQuality: 1.0, preferredAspect: ["1:1", "4:5"] },
  { id: "instagram_feed", label: "Instagram Feed", group: "Feeds", platform: "Instagram", inventory: 0.16, cpm: 1.15, ctr: 0.9, cvrQuality: 1.0, lpvQuality: 0.95, preferredAspect: ["4:5", "1:1"] },
  { id: "instagram_explore", label: "Instagram Explore", group: "Feeds", platform: "Instagram", inventory: 0.03, cpm: 0.95, ctr: 0.75, cvrQuality: 0.9, lpvQuality: 0.92, preferredAspect: ["4:5", "1:1"] },
  { id: "facebook_marketplace", label: "Facebook Marketplace", group: "Feeds", platform: "Facebook", inventory: 0.04, cpm: 0.8, ctr: 0.85, cvrQuality: 0.9, lpvQuality: 0.9, preferredAspect: ["1:1"] },
  { id: "facebook_video_feeds", label: "Facebook Video Feeds", group: "Feeds", platform: "Facebook", inventory: 0.03, cpm: 0.75, ctr: 0.6, cvrQuality: 0.85, lpvQuality: 0.88, preferredAspect: ["4:5", "1:1"] },
  { id: "facebook_right_column", label: "Facebook Right Column", group: "Feeds", platform: "Facebook", inventory: 0.02, cpm: 0.45, ctr: 0.35, cvrQuality: 0.85, lpvQuality: 0.95, preferredAspect: ["1:1"] },
  { id: "threads_feed", label: "Threads Feed", group: "Feeds", platform: "Threads", inventory: 0.02, cpm: 0.85, ctr: 0.7, cvrQuality: 1.0, lpvQuality: 0.9, preferredAspect: ["1:1", "4:5"], featureId: "threads_ads" },
  { id: "facebook_stories", label: "Facebook Stories", group: "Stories", platform: "Facebook", inventory: 0.06, cpm: 0.8, ctr: 0.7, cvrQuality: 1.0, lpvQuality: 0.85, preferredAspect: ["9:16"] },
  { id: "instagram_stories", label: "Instagram Stories", group: "Stories", platform: "Instagram", inventory: 0.12, cpm: 0.9, ctr: 0.8, cvrQuality: 1.0, lpvQuality: 0.85, preferredAspect: ["9:16"] },
  { id: "facebook_reels", label: "Facebook Reels", group: "Reels", platform: "Facebook", inventory: 0.06, cpm: 0.7, ctr: 0.65, cvrQuality: 1.0, lpvQuality: 0.82, preferredAspect: ["9:16"] },
  { id: "instagram_reels", label: "Instagram Reels", group: "Reels", platform: "Instagram", inventory: 0.14, cpm: 0.8, ctr: 0.75, cvrQuality: 1.0, lpvQuality: 0.84, preferredAspect: ["9:16"] },
  { id: "facebook_search", label: "Facebook Search results", group: "Search", platform: "Facebook", inventory: 0.01, cpm: 0.9, ctr: 1.1, cvrQuality: 1.0, lpvQuality: 0.95, preferredAspect: ["1:1"] },
  { id: "messenger_inbox", label: "Messenger Inbox", group: "Messages", platform: "Messenger", inventory: 0.02, cpm: 0.6, ctr: 0.4, cvrQuality: 0.6, lpvQuality: 0.85, preferredAspect: ["1:1"] },
  { id: "audience_network", label: "Audience Network", group: "Apps and sites", platform: "Audience Network", inventory: 0.09, cpm: 0.35, ctr: 2.1, cvrQuality: 0.22, lpvQuality: 0.38, preferredAspect: ["1:1", "9:16", "16:9"] },
];

export const placementById = (id: PlacementId) => PLACEMENTS.find((p) => p.id === id)!;
export const ALL_PLACEMENT_IDS = PLACEMENTS.map((p) => p.id);

export interface CountryInfo {
  code: CountryCode;
  name: string;
  /** Навчальна оцінка доступної аудиторії 18+ на платформах Meta (млн). */
  reachableMillions: number;
  /** Навчальний базовий CPM (USD) для стрічки Facebook у нейтральній ніші. */
  baseCpm: number;
  /** Купівельна спроможність відносно середнього (впливає на CVR і чек). */
  purchasingPower: number;
  language: string;
  eu: boolean;
  cities: { name: string; reachableThousands: number }[];
}

export const COUNTRIES: CountryInfo[] = [
  {
    code: "UA",
    name: "Україна",
    reachableMillions: 19,
    baseCpm: 1.6,
    purchasingPower: 0.55,
    language: "uk",
    eu: false,
    cities: [
      { name: "Київ", reachableThousands: 2600 },
      { name: "Львів", reachableThousands: 700 },
      { name: "Дніпро", reachableThousands: 780 },
      { name: "Одеса", reachableThousands: 760 },
      { name: "Харків", reachableThousands: 900 },
    ],
  },
  {
    code: "PL",
    name: "Польща",
    reachableMillions: 22,
    baseCpm: 3.4,
    purchasingPower: 0.85,
    language: "pl",
    eu: true,
    cities: [
      { name: "Варшава", reachableThousands: 1700 },
      { name: "Краків", reachableThousands: 720 },
      { name: "Вроцлав", reachableThousands: 600 },
    ],
  },
  { code: "DE", name: "Німеччина", reachableMillions: 38, baseCpm: 6.8, purchasingPower: 1.1, language: "de", eu: true, cities: [{ name: "Берлін", reachableThousands: 2900 }] },
  { code: "CZ", name: "Чехія", reachableMillions: 6, baseCpm: 3.0, purchasingPower: 0.9, language: "cs", eu: true, cities: [{ name: "Прага", reachableThousands: 1100 }] },
  { code: "US", name: "США", reachableMillions: 240, baseCpm: 11.5, purchasingPower: 1.3, language: "en", eu: false, cities: [{ name: "New York", reachableThousands: 9500 }] },
  { code: "GB", name: "Велика Британія", reachableMillions: 46, baseCpm: 7.5, purchasingPower: 1.15, language: "en", eu: false, cities: [{ name: "London", reachableThousands: 7600 }] },
  { code: "CA", name: "Канада", reachableMillions: 28, baseCpm: 8.2, purchasingPower: 1.2, language: "en", eu: false, cities: [{ name: "Toronto", reachableThousands: 4300 }] },
];

export const countryByCode = (c: CountryCode) => COUNTRIES.find((x) => x.code === c)!;

export const LANGUAGES: { code: string; label: string }[] = [
  { code: "uk", label: "Українська" },
  { code: "ru", label: "Російська" },
  { code: "en", label: "Англійська" },
  { code: "pl", label: "Польська" },
  { code: "de", label: "Німецька" },
  { code: "cs", label: "Чеська" },
];

export interface InterestInfo {
  id: string;
  name: string;
  category: "Освіта" | "Бізнес" | "Покупки" | "Спосіб життя" | "Технології" | "Сім'я" | "Фінанси";
  /** Частка дорослої аудиторії, що має цей інтерес (навчальна оцінка). */
  share: number;
  /** Для яких вертикалей інтерес релевантний (підвищує intent). */
  relevantFor: Vertical[];
  /** Чутливий інтерес (здоров'я/фінансовий стан) — недоступний або ризиковий. */
  sensitive?: boolean;
}

export const INTERESTS: InterestInfo[] = [
  { id: "int_online_learning", name: "Онлайн-навчання", category: "Освіта", share: 0.12, relevantFor: ["education"] },
  { id: "int_digital_marketing", name: "Цифровий маркетинг", category: "Бізнес", share: 0.05, relevantFor: ["education", "saas"] },
  { id: "int_smm", name: "SMM та соцмережі", category: "Бізнес", share: 0.06, relevantFor: ["education", "saas"] },
  { id: "int_entrepreneurship", name: "Підприємництво", category: "Бізнес", share: 0.09, relevantFor: ["education", "saas", "finance"] },
  { id: "int_small_business", name: "Малий бізнес", category: "Бізнес", share: 0.07, relevantFor: ["saas", "local_services"] },
  { id: "int_english", name: "Вивчення англійської", category: "Освіта", share: 0.08, relevantFor: ["education", "mobile_app"] },
  { id: "int_it", name: "Програмування та IT", category: "Технології", share: 0.06, relevantFor: ["education", "saas", "mobile_app"] },
  { id: "int_design", name: "Графічний дизайн", category: "Освіта", share: 0.05, relevantFor: ["education"] },
  { id: "int_career", name: "Кар'єрний розвиток", category: "Освіта", share: 0.1, relevantFor: ["education"] },
  { id: "int_online_shopping", name: "Онлайн-шопінг", category: "Покупки", share: 0.3, relevantFor: ["ecommerce"] },
  { id: "int_fashion", name: "Мода", category: "Покупки", share: 0.2, relevantFor: ["ecommerce"] },
  { id: "int_home_decor", name: "Декор для дому", category: "Покупки", share: 0.12, relevantFor: ["ecommerce", "local_services"] },
  { id: "int_coffee", name: "Кава", category: "Спосіб життя", share: 0.16, relevantFor: ["local_services", "ecommerce"] },
  { id: "int_fitness", name: "Фітнес", category: "Спосіб життя", share: 0.18, relevantFor: ["local_services", "mobile_app"] },
  { id: "int_beauty", name: "Краса та догляд", category: "Спосіб життя", share: 0.17, relevantFor: ["ecommerce", "local_services"] },
  { id: "int_parenting", name: "Батьківство", category: "Сім'я", share: 0.11, relevantFor: ["education", "ecommerce"] },
  { id: "int_travel", name: "Подорожі", category: "Спосіб життя", share: 0.22, relevantFor: ["mobile_app"] },
  { id: "int_productivity", name: "Продуктивність", category: "Технології", share: 0.04, relevantFor: ["saas", "mobile_app"] },
  { id: "int_investing", name: "Інвестиції", category: "Фінанси", share: 0.05, relevantFor: ["finance", "education"] },
  { id: "int_weight_loss", name: "Схуднення (чутливий)", category: "Спосіб життя", share: 0.06, relevantFor: ["local_services"], sensitive: true },
];

export const interestById = (id: string) => INTERESTS.find((i) => i.id === id);

export const CTAS: { id: CallToAction; label: string; intent: "info" | "lead" | "purchase" | "app" | "message" | "call" | "none" }[] = [
  { id: "LEARN_MORE", label: "Learn more", intent: "info" },
  { id: "SIGN_UP", label: "Sign up", intent: "lead" },
  { id: "APPLY_NOW", label: "Apply now", intent: "lead" },
  { id: "GET_OFFER", label: "Get offer", intent: "lead" },
  { id: "GET_QUOTE", label: "Get quote", intent: "lead" },
  { id: "SUBSCRIBE", label: "Subscribe", intent: "lead" },
  { id: "SHOP_NOW", label: "Shop now", intent: "purchase" },
  { id: "BUY_NOW", label: "Buy now", intent: "purchase" },
  { id: "BOOK_NOW", label: "Book now", intent: "purchase" },
  { id: "DOWNLOAD", label: "Download", intent: "app" },
  { id: "INSTALL_APP", label: "Install now", intent: "app" },
  { id: "SEND_MESSAGE", label: "Send message", intent: "message" },
  { id: "CONTACT_US", label: "Contact us", intent: "message" },
  { id: "CALL_NOW", label: "Call now", intent: "call" },
  { id: "WATCH_MORE", label: "Watch more", intent: "info" },
  { id: "NO_BUTTON", label: "No button", intent: "none" },
];

export const ctaLabel = (c: CallToAction) => CTAS.find((x) => x.id === c)?.label ?? c;

export interface VerticalInfo {
  id: Vertical;
  label: string;
  /** Конкурентність аукціону (множник CPM). */
  competition: number;
  /** Базовий link CTR (частка) для «середнього» креативу у стрічці. */
  baseCtr: number;
  /** Базова конверсія сесії в лід. */
  leadCvr: number;
  /** Базова конверсія сесії в покупку. */
  purchaseCvr: number;
}

export const VERTICALS: Record<Vertical, VerticalInfo> = {
  education: { id: "education", label: "Онлайн-освіта / EdTech", competition: 1.05, baseCtr: 0.0095, leadCvr: 0.11, purchaseCvr: 0.012 },
  ecommerce: { id: "ecommerce", label: "E-commerce", competition: 1.2, baseCtr: 0.012, leadCvr: 0.05, purchaseCvr: 0.022 },
  local_services: { id: "local_services", label: "Локальний бізнес", competition: 0.9, baseCtr: 0.013, leadCvr: 0.09, purchaseCvr: 0.03 },
  saas: { id: "saas", label: "SaaS / B2B", competition: 1.3, baseCtr: 0.008, leadCvr: 0.07, purchaseCvr: 0.006 },
  mobile_app: { id: "mobile_app", label: "Мобільний застосунок", competition: 1.1, baseCtr: 0.01, leadCvr: 0.06, purchaseCvr: 0.01 },
  finance: { id: "finance", label: "Фінансові послуги", competition: 1.45, baseCtr: 0.009, leadCvr: 0.06, purchaseCvr: 0.005 },
};

/** Бібліотека навчальних креативів (генеруються як SVG-градієнти з підписом). */
export interface LibraryAsset {
  key: string;
  label: string;
  kind: "image" | "video";
  aspectRatio: AspectRatio;
  hookStrength: number;
  palette: [string, string];
  caption: string;
  durationSec?: number;
  tags: string[];
}

export const MEDIA_LIBRARY: LibraryAsset[] = [
  { key: "edu_mentor_square", label: "Ментор з ноутбуком (1:1)", kind: "image", aspectRatio: "1:1", hookStrength: 0.6, palette: ["#4f46e5", "#0ea5e9"], caption: "Навчись запускати рекламу", tags: ["education"] },
  { key: "edu_results_45", label: "Кейс студента (4:5)", kind: "image", aspectRatio: "4:5", hookStrength: 0.72, palette: ["#7c3aed", "#db2777"], caption: "Від нуля до першого клієнта", tags: ["education"] },
  { key: "edu_reel_916", label: "Відео: урок за 30 секунд (9:16)", kind: "video", aspectRatio: "9:16", hookStrength: 0.8, palette: ["#0f766e", "#22d3ee"], caption: "3 помилки новачка в рекламі", durationSec: 28, tags: ["education"] },
  { key: "edu_webinar_169", label: "Запис вебінару (16:9)", kind: "video", aspectRatio: "16:9", hookStrength: 0.35, palette: ["#1e293b", "#475569"], caption: "Вебінар: 90 хвилин теорії", durationSec: 95, tags: ["education"] },
  { key: "shop_product_square", label: "Товар на білому фоні (1:1)", kind: "image", aspectRatio: "1:1", hookStrength: 0.5, palette: ["#f97316", "#facc15"], caption: "Нова колекція", tags: ["ecommerce"] },
  { key: "shop_lifestyle_45", label: "Lifestyle-фото (4:5)", kind: "image", aspectRatio: "4:5", hookStrength: 0.7, palette: ["#be185d", "#f472b6"], caption: "Твій образ на щодень", tags: ["ecommerce"] },
  { key: "shop_ugc_916", label: "UGC-відгук покупця (9:16)", kind: "video", aspectRatio: "9:16", hookStrength: 0.85, palette: ["#9333ea", "#f59e0b"], caption: "Чесний відгук після місяця", durationSec: 22, tags: ["ecommerce"] },
  { key: "local_coffee_square", label: "Кав'ярня: латте-арт (1:1)", kind: "image", aspectRatio: "1:1", hookStrength: 0.65, palette: ["#78350f", "#d97706"], caption: "Кава поруч з тобою", tags: ["local_services"] },
  { key: "local_reel_916", label: "Відео: бариста за роботою (9:16)", kind: "video", aspectRatio: "9:16", hookStrength: 0.75, palette: ["#451a03", "#f59e0b"], caption: "Ранок починається тут", durationSec: 15, tags: ["local_services"] },
  { key: "app_screens_916", label: "Скріни застосунку (9:16)", kind: "image", aspectRatio: "9:16", hookStrength: 0.55, palette: ["#0284c7", "#22c55e"], caption: "5 хвилин на день", tags: ["mobile_app"] },
  { key: "generic_text_square", label: "Банер з великим текстом (1:1)", kind: "image", aspectRatio: "1:1", hookStrength: 0.25, palette: ["#dc2626", "#111827"], caption: "ЗНИЖКА!!! ТІЛЬКИ СЬОГОДНІ!!!", tags: ["generic"] },
  { key: "saas_dashboard_45", label: "Скріншот дашборду (4:5)", kind: "image", aspectRatio: "4:5", hookStrength: 0.45, palette: ["#0f172a", "#6366f1"], caption: "Звіти за 1 клік", tags: ["saas"] },
];

export const libraryAsset = (key?: string) => MEDIA_LIBRARY.find((a) => a.key === key);
