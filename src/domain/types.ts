/**
 * Доменні моделі AdLab Simulator.
 * Усі сутності — навчальні: жодна з них не пов'язана зі справжнім рекламним акаунтом.
 */

export type ID = string;
/** ISO-8601 timestamp реального часу (коли користувач зробив дію). */
export type Timestamp = string;
/** Індекс симульованого дня від дати старту акаунта (0 = перший день). */
export type SimDay = number;

// ───────────────────────────── Довідники ─────────────────────────────

export type Objective = "awareness" | "traffic" | "engagement" | "leads" | "app_promotion" | "sales";

export type EntityStatus = "draft" | "in_review" | "active" | "paused" | "rejected";

export type SpecialAdCategory =
  | "financial_products_services"
  | "employment"
  | "housing"
  | "social_issues_elections_politics";

export type CampaignSetup = "manual" | "advantage_plus";
export type BudgetLevel = "campaign" | "ad_set";
export type BudgetType = "daily" | "lifetime";
export type BidStrategy = "highest_volume" | "highest_value" | "cost_per_result_goal" | "roas_goal" | "bid_cap";

export type ConversionLocation =
  | "none"
  | "website"
  | "app"
  | "website_and_app"
  | "instant_forms"
  | "website_and_instant_forms"
  | "messaging_apps"
  | "calls"
  | "on_your_ad";

export type PerformanceGoal =
  | "reach"
  | "impressions"
  | "ad_recall_lift"
  | "thruplay"
  | "video_views_2s"
  | "link_clicks"
  | "landing_page_views"
  | "daily_unique_reach"
  | "conversations"
  | "post_engagement"
  | "calls"
  | "leads"
  | "conversion_leads"
  | "conversions"
  | "conversion_value"
  | "app_installs"
  | "app_events";

export type PixelEvent =
  | "PageView"
  | "ViewContent"
  | "AddToCart"
  | "InitiateCheckout"
  | "Purchase"
  | "Lead"
  | "CompleteRegistration"
  | "Contact"
  | "Schedule"
  | "Subscribe"
  | "StartTrial";

export type AppEvent = "Install" | "AppPurchase" | "AppRegistration";

export type PlacementId =
  | "facebook_feed"
  | "instagram_feed"
  | "instagram_explore"
  | "facebook_marketplace"
  | "facebook_video_feeds"
  | "facebook_right_column"
  | "threads_feed"
  | "facebook_stories"
  | "instagram_stories"
  | "facebook_reels"
  | "instagram_reels"
  | "facebook_search"
  | "messenger_inbox"
  | "audience_network";

export type CallToAction =
  | "LEARN_MORE"
  | "SIGN_UP"
  | "SHOP_NOW"
  | "BUY_NOW"
  | "BOOK_NOW"
  | "APPLY_NOW"
  | "GET_OFFER"
  | "SUBSCRIBE"
  | "CONTACT_US"
  | "DOWNLOAD"
  | "INSTALL_APP"
  | "SEND_MESSAGE"
  | "GET_QUOTE"
  | "WATCH_MORE"
  | "CALL_NOW"
  | "NO_BUTTON";

export type AdFormat = "single_image" | "single_video" | "carousel";
export type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9";

export type Vertical = "education" | "ecommerce" | "local_services" | "saas" | "mobile_app" | "finance";

export type CountryCode = "UA" | "PL" | "DE" | "CZ" | "US" | "GB" | "CA";

export type SkillDimension =
  | "objective"
  | "structure"
  | "audience"
  | "budget"
  | "tracking"
  | "creative"
  | "metrics"
  | "optimization"
  | "policy"
  | "argumentation";

export type LearningLevel = "beginner" | "junior" | "middle" | "advanced";

// ───────────────────────────── Аудиторії ─────────────────────────────

export interface LocationTarget {
  country: CountryCode;
  /** Місто (необов'язково). Якщо задано — таргетинг у радіусі. */
  city?: string;
  radiusKm?: number;
}

export type AudienceType =
  | "custom_website"
  | "custom_customer_list"
  | "custom_engagement"
  | "custom_lead_form"
  | "custom_video"
  | "lookalike";

export interface Audience {
  id: ID;
  accountId: ID;
  name: string;
  type: AudienceType;
  /** Опис джерела: «Відвідувачі сайту 30 днів», «Список клієнтів CRM» тощо. */
  source: string;
  /** Приблизний розмір у людях (навчальна оцінка). */
  size: number;
  retentionDays?: number;
  lookalike?: { sourceAudienceId: ID; country: CountryCode; percent: number };
  /** Наскільки аудиторія «тепла» (0..1). Впливає на CTR/CVR. */
  intent: number;
  /** Позначка, що аудиторія може натякати на чутливі дані (здоров'я/фінанси). */
  flaggedSensitive?: boolean;
  createdAt: Timestamp;
}

export interface AudienceTargeting {
  locations: LocationTarget[];
  ageMin: number;
  /** 65 означає «65+». */
  ageMax: number;
  genders: "all" | "male" | "female";
  languages: string[];
  /** ID інтересів з довідника detailed targeting. */
  detailedTargeting: string[];
  /** Включені custom/lookalike аудиторії. */
  includedAudienceIds: ID[];
  /** Виключені custom аудиторії. */
  excludedAudienceIds: ID[];
  /** Advantage+ audience: вікові/гендерні/інтересні параметри стають підказками (suggestions), а не жорсткими обмеженнями. */
  advantageAudience: boolean;
  /** Audience control: мінімальний вік як жорстке обмеження (лише для Advantage+ audience). */
  minAgeControl: number;
}

// ───────────────────────────── Ієрархія реклами ─────────────────────────────

export interface ABTestConfig {
  enabled: boolean;
  variable: "creative" | "audience" | "placement" | "optimization";
  hypothesis: string;
  keyMetric: "cost_per_result" | "ctr" | "cpc" | "roas";
}

export interface Campaign {
  id: ID;
  /** Порядковий номер створення в акаунті — використовується для детермінованого seed замість випадкового ID. */
  seq: number;
  accountId: ID;
  name: string;
  objective: Objective;
  status: EntityStatus;
  specialAdCategories: SpecialAdCategory[];
  specialAdCountries: CountryCode[];
  setup: CampaignSetup;
  budgetLevel: BudgetLevel;
  /** Використовується, коли budgetLevel = "campaign" (Advantage+ campaign budget). */
  budgetType: BudgetType;
  budgetAmount: number;
  bidStrategy: BidStrategy;
  bidAmount?: number;
  roasGoal?: number;
  /** Ad set budget sharing (до 20% між наборами) — лише для бюджету на рівні набору. */
  budgetSharing: boolean;
  abTest: ABTestConfig | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  publishedAt?: Timestamp;
  /** Позначка «є неопубліковані зміни». */
  hasUnpublishedChanges?: boolean;
}

export type LearningPhase = "not_started" | "learning" | "active" | "learning_limited";

export interface LearningState {
  phase: LearningPhase;
  /** День останнього суттєвого редагування (або старту доставки). */
  lastSignificantEditDay: SimDay | null;
  /** Події оптимізації, накопичені з останнього суттєвого редагування. */
  eventsSinceEdit: number;
  /** Події оптимізації по днях від останнього суттєвого редагування (для ковзного 7-денного вікна). */
  dailyEvents: number[];
  resets: number;
  /** День, з якого набір на паузі (для правила «пауза ≥ 7 днів скидає навчання»). */
  pausedSinceDay?: SimDay | null;
}

export interface AttributionSetting {
  clickWindowDays: 1 | 7;
  /** 1-day view-through. */
  viewThrough: boolean;
  /** 1-day engage-through (раніше engaged-view). */
  engageThrough: boolean;
}

export interface FrequencyCap {
  impressions: number;
  days: number;
}

export interface AdSet {
  id: ID;
  seq: number;
  accountId: ID;
  campaignId: ID;
  name: string;
  status: EntityStatus;
  conversionLocation: ConversionLocation;
  performanceGoal: PerformanceGoal;
  /** Подія оптимізації (для конверсійних цілей на сайті). */
  optimizationEvent: PixelEvent | AppEvent | null;
  datasetId: string | null;
  budgetType: BudgetType;
  budgetAmount: number;
  bidStrategy: BidStrategy;
  bidAmount?: number;
  roasGoal?: number;
  startDay: SimDay;
  endDay: SimDay | null;
  audience: AudienceTargeting;
  placements: { mode: "advantage" | "manual"; selected: PlacementId[] };
  attribution: AttributionSetting;
  frequencyCap?: FrequencyCap;
  learning: LearningState;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  hasUnpublishedChanges?: boolean;
}

export interface CreativeMedia {
  id: ID;
  kind: "image" | "video";
  aspectRatio: AspectRatio;
  source: "library" | "upload";
  /** Для library — ключ шаблону; для upload — dataURL зменшеного зображення або постера відео. */
  libraryKey?: string;
  dataUrl?: string;
  label: string;
  durationSec?: number;
  /** Сила «хука» (перші секунди / візуальна помітність) 0..1 — для бібліотечних ассетів. */
  hookStrength?: number;
}

export interface InstantFormConfig {
  formType: "more_volume" | "higher_intent";
  questions: number;
  privacyPolicyUrl: string;
  hasQualifyingQuestion: boolean;
}

export interface Creative {
  media: CreativeMedia[];
  primaryText: string;
  headline: string;
  description: string;
  cta: CallToAction;
  destinationUrl: string;
  displayLink: string;
  /** URL parameters (UTM). */
  urlParameters: string;
  /** Окремий 9:16 ассет для Stories/Reels (кастомізація під плейсмент). */
  verticalMedia: CreativeMedia | null;
  /** Advantage+ creative enhancements (навчальна модель). */
  creativeEnhancements: boolean;
  instantForm: InstantFormConfig | null;
}

export interface AdReview {
  state: "pending" | "approved" | "rejected";
  reasons: string[];
  reviewedDay?: SimDay;
}

export interface Ad {
  id: ID;
  seq: number;
  accountId: ID;
  campaignId: ID;
  adSetId: ID;
  name: string;
  status: EntityStatus;
  facebookPageId: string;
  instagramAccountId: string | null;
  format: AdFormat;
  creative: Creative;
  review: AdReview | null;
  /** Перший день доставки (для моделі вигорання). */
  firstDeliveryDay: SimDay | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  hasUnpublishedChanges?: boolean;
}

// ───────────────────────────── Трекінг / бізнес-контекст ─────────────────────────────

export interface TrackingSetup {
  pixel: {
    installed: boolean;
    id: string;
    /** Події, які реально спрацьовують на сайті. */
    events: PixelEvent[];
    /** Подвійне спрацювання браузерної події (помилка розмітки). */
    duplicateBrowserEvents: boolean;
  };
  capi: {
    enabled: boolean;
    /** Чи передається однаковий event_id + event_name з браузера і сервера (дедуплікація). */
    sendsEventId: boolean;
    /** Event Match Quality 0..10 (навчальна оцінка). */
    eventMatchQuality: number;
  };
  domainVerified: boolean;
  consent: {
    /** Банер згоди (CMP) увімкнено. */
    bannerEnabled: boolean;
    /** Частка відвідувачів, що надають згоду на маркетингові cookie. */
    acceptRate: number;
  };
  crmConnected: boolean;
  /** Чи передаються CRM-статуси лідів назад (потрібно для conversion leads). */
  crmFeedback: boolean;
  appRegistered: boolean;
}

export interface LandingPage {
  domain: string;
  /** Основна цільова дія сторінки. */
  primaryConversion: "lead" | "purchase";
  url: string;
  loadSpeed: "fast" | "average" | "slow";
  /** Ключові слова оферу на сторінці — для оцінки відповідності креативу. */
  offerKeywords: string[];
  /** Базова конверсія сторінки в цільову дію (0..1) для «середнього» трафіку. */
  baseConversionRate: number;
  mobileFriendly: boolean;
}

export interface BusinessEconomics {
  /** Середній чек або цінність конверсії, USD. */
  averageOrderValue: number;
  /** Маржинальність 0..1. */
  margin: number;
  /** Частка кваліфікованих лідів, що стають продажем. */
  leadToSaleRate: number;
  /** Цінність одного продажу з ліда, USD. */
  saleValueFromLead: number;
}

export interface Identity {
  pages: { id: string; name: string }[];
  instagramAccounts: { id: string; username: string }[];
}

// ───────────────────────────── Метрики ─────────────────────────────

/** Розбиття за затримкою конверсії: індекс = кількість днів від кліку/показу до конверсії (0..6). */
export type LagArray = number[];

export interface PlacementSlice {
  impressions: number;
  spend: number;
  linkClicks: number;
  lpv: number;
  conversions: number;
}

/**
 * Рядок «сирих» денних даних для одного оголошення.
 * Звітні (attributed) значення обчислюються під час запиту (див. simulation/reporting.ts),
 * бо залежать від вікна атрибуції та того, скільки днів минуло (затримка конверсій).
 */
export interface DailyMetrics {
  id: ID;
  accountId: ID;
  campaignId: ID;
  adSetId: ID;
  adId: ID;
  day: SimDay;
  spend: number;
  impressions: number;
  /** Оцінка унікального охоплення оголошення за день. */
  reach: number;
  clicksAll: number;
  linkClicks: number;
  outboundClicks: number;
  /** Справжні сесії, що дочекалися завантаження сторінки. */
  sessions: number;
  /** Landing page views, зафіксовані пікселем. */
  landingPageViews: number;
  postEngagements: number;
  videoPlays3s: number;
  thruPlays: number;
  conversations: number;
  calls: number;
  installs: number;
  appEvents: number;
  /** Звітні проміжні події воронки (Pixel/CAPI). */
  contentViews: number;
  addToCarts: number;
  checkouts: number;
  /** Звітні (зафіксовані трекінгом) конверсії за кліком, розкладені за затримкою. */
  clickLeads: LagArray;
  clickPurchases: LagArray;
  clickValue: LagArray;
  /** Звітні view-through та engage-through конверсії (затримка 0..1). */
  viewLeads: number;
  viewPurchases: number;
  viewValue: number;
  engageLeads: number;
  engagePurchases: number;
  engageValue: number;
  /** «Правда» бізнесу (CRM / бекенд) — недоступна в рекламному кабінеті. */
  trueLeads: number;
  qualifiedLeads: number;
  truePurchases: number;
  trueRevenue: number;
  /** Ліди/продажі, які CRM зміг приписати Meta (залежить від UTM). */
  crmAttributedLeads: number;
  crmAttributedPurchases: number;
  byPlacement: Partial<Record<PlacementId, PlacementSlice>>;
}

export interface AdSetDaySnapshot {
  adSetId: ID;
  day: SimDay;
  audienceSize: number;
  /** Ефективна (активна) аудиторія, що використовується для оцінки охоплення. */
  effectiveAudience: number;
  cumulativeImpressions: number;
  cumulativeReach: number;
  dailyReach: number;
  frequency: number;
  cpm: number;
  learningPhase: LearningPhase;
  deliveryNotes: string[];
  budgetAllocated: number;
}

export interface SimulationRun {
  id: ID;
  accountId: ID;
  createdAt: Timestamp;
  fromDay: SimDay;
  days: number;
  spend: number;
  notes: string[];
}

// ───────────────────────────── Журнал змін ─────────────────────────────

export type ChangeAction =
  | "create"
  | "update"
  | "duplicate"
  | "delete"
  | "publish"
  | "pause"
  | "activate"
  | "review_approved"
  | "review_rejected"
  | "simulate"
  | "learning_reset"
  | "tracking_update"
  | "audience_create";

export interface ChangeLogEntry {
  id: ID;
  accountId: ID;
  at: Timestamp;
  simDay: SimDay;
  actor: "user" | "system";
  entityType: "campaign" | "ad_set" | "ad" | "account" | "audience" | "tracking";
  entityId: ID;
  entityName: string;
  action: ChangeAction;
  changes: { field: string; from: unknown; to: unknown }[];
  significantEdit: boolean;
  note?: string;
}

// ───────────────────────────── Акаунт ─────────────────────────────

export interface AdAccount {
  id: ID;
  name: string;
  kind: "sandbox" | "mission" | "error_lab";
  missionId?: string;
  missionAttemptId?: ID;
  errorLabCaseId?: string;
  /** Якщо true — акаунт лише для перегляду (кейси Error Lab). */
  readOnly?: boolean;
  currency: "USD";
  timezone: string;
  vertical: Vertical;
  primaryCountry: CountryCode;
  /** Дата першого симульованого дня (ISO yyyy-mm-dd). */
  startDate: string;
  /** Скільки днів уже симульовано. Наступний день до симуляції = simDay. */
  simDay: SimDay;
  seed: number;
  /** Лічильник для seq нових сутностей. */
  seqCounter: number;
  /** Сутності з seq ≤ seededSeq створені сценарієм (не користувачем). */
  seededSeq: number;
  /** День, з якого акаунт передано користувачу (після історії сценарію). */
  handoverDay: SimDay;
  virtualBudget: number;
  tracking: TrackingSetup;
  landingPage: LandingPage;
  economics: BusinessEconomics;
  identity: Identity;
  audiences: Audience[];
  campaigns: Campaign[];
  adSets: AdSet[];
  ads: Ad[];
  metrics: DailyMetrics[];
  snapshots: AdSetDaySnapshot[];
  runs: SimulationRun[];
  changeLog: ChangeLogEntry[];
  /** Сезонні події ринку: день → множник CPM. */
  marketEvents: { day: SimDay; cpmMultiplier: number; label: string }[];
  createdAt: Timestamp;
}

// ───────────────────────────── Навчання ─────────────────────────────

export interface UserProfile {
  id: ID;
  displayName: string;
  createdAt: Timestamp;
  theme: "light" | "dark" | "system";
}

export interface QuizResult {
  articleSlug: string;
  correct: number;
  total: number;
  at: Timestamp;
}

export interface LearningProgress {
  readArticles: string[];
  quizResults: Record<string, QuizResult>;
  completedPractice: string[];
  completedDailyTasks: Record<string, string[]>;
  xp: number;
}

export interface MissionAnswer {
  questionId: string;
  /** Обрані варіанти (для choice) */
  selected?: string[];
  /** Текстова відповідь */
  text?: string;
  /** Числова відповідь */
  value?: number;
  /** Впевненість 1..3 */
  confidence?: 1 | 2 | 3;
}

export interface SkillAssessment {
  total: number;
  dimensions: Record<SkillDimension, { earned: number; available: number; score: number | null }>;
  strengths: string[];
  criticalErrors: string[];
  risks: string[];
  alternative: string;
  expertExplanation: string;
  recommendedArticles: string[];
  notes: string[];
  capped?: string;
}

export interface CaseStudy {
  strategy: string;
  hypotheses: string;
  testing: string;
  analysis: string;
  nextSteps: string;
  conclusions: string;
}

export interface MissionAttempt {
  id: ID;
  missionId: string;
  accountId: ID;
  startedAt: Timestamp;
  submittedAt?: Timestamp;
  status: "in_progress" | "submitted";
  answers: MissionAnswer[];
  caseStudy: CaseStudy;
  assessment?: SkillAssessment;
  /** Знімок структури та результатів на момент здачі (для портфоліо). */
  snapshot?: PortfolioSnapshot;
}

export interface PortfolioSnapshot {
  campaigns: { name: string; objective: Objective; budget: string; adSets: { name: string; summary: string; ads: string[] }[] }[];
  totals: Record<string, number | null>;
  daily: { day: number; date: string; spend: number; results: number }[];
  simDays: number;
}

export interface ErrorLabAttempt {
  id: ID;
  caseId: string;
  accountId: ID;
  selectedCauses: string[];
  checkedEvidence: string[];
  confidence: 1 | 2 | 3;
  explanation: string;
  score: number;
  submittedAt: Timestamp;
}

// ───────────────────────────── База знань ─────────────────────────────

export type VerificationStatus = "verified" | "partially_verified" | "needs_review" | "deprecated";

export interface SourceRef {
  title: string;
  url: string;
  publisher: "Meta Business Help Center" | "Meta for Business" | "Meta Blueprint" | "Meta for Developers" | "Meta Newsroom" | "Meta Transparency Center" | "Google Analytics Help" | "Other";
}

export interface KnowledgeQuiz {
  id: string;
  question: string;
  options: { id: string; text: string }[];
  correct: string;
  explanation: string;
}

export interface KnowledgeArticle {
  slug: string;
  category: string;
  title: string;
  summary: string;
  definition: string;
  body: string[];
  example: string;
  mistakes: string[];
  whenToUse: string[];
  quiz: KnowledgeQuiz[];
  missionIds: string[];
  lastReviewed: string;
  sources: SourceRef[];
  status: VerificationStatus;
  featureIds?: string[];
  level: LearningLevel;
}

export interface FeatureRegistryEntry {
  feature_name: string;
  id: string;
  supported_objectives: Objective[] | "all";
  availability_status: "Verified" | "Partially Verified" | "Needs Review" | "Deprecated";
  region: string;
  verified_at: string;
  source_url: string;
  version_notes: string;
}
