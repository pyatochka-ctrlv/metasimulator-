import { BID_STRATEGIES, countryByCode, interestById, placementById } from "@/domain/catalog";
import {
  advantagePlusSetupAvailable,
  bidStrategiesFor,
  conversionLocationsFor,
  performanceGoalsFor,
  requiresApp,
  requiresPixel,
  requiresPixelEvent,
  specialCategoryRules,
} from "@/domain/objective-config";
import type { AdAccount, Ad, AdSet, Campaign, PixelEvent } from "@/domain/types";
import { audienceOverlap, estimateAudience } from "./audience";
import { selectedPlacements } from "./creative-quality";
import { buildAdSetModel } from "./model";
import { captureModel, euShare, utmPresent } from "./tracking";

/**
 * Перевірка налаштувань перед публікацією.
 *  - error: блокує публікацію (як у кабінеті — «виправте помилки»);
 *  - warning: публікація можлива, але є ризик для результату;
 *  - info: рекомендація.
 */

export interface ValidationIssue {
  level: "error" | "warning" | "info";
  entityType: "campaign" | "ad_set" | "ad";
  entityId: string;
  entityName: string;
  field?: string;
  message: string;
  hint?: string;
  articleSlug?: string;
}

const MIN_DAILY_BUDGET = 1;

function isHttpsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function validateCampaign(account: AdAccount, campaign: Campaign): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const base = { entityType: "campaign" as const, entityId: campaign.id, entityName: campaign.name };
  if (!campaign.name.trim()) issues.push({ ...base, level: "error", field: "name", message: "Вкажіть назву кампанії." });
  if (campaign.setup === "advantage_plus" && !advantagePlusSetupAvailable(campaign.objective))
    issues.push({ ...base, level: "error", field: "setup", message: "Advantage+ campaign setup недоступний для цієї цілі." });
  if (campaign.budgetLevel === "campaign") {
    if (!(campaign.budgetAmount > 0)) issues.push({ ...base, level: "error", field: "budgetAmount", message: "Вкажіть бюджет кампанії." });
    else if (campaign.budgetType === "daily" && campaign.budgetAmount < MIN_DAILY_BUDGET)
      issues.push({ ...base, level: "error", field: "budgetAmount", message: `Мінімальний денний бюджет у симуляторі — $${MIN_DAILY_BUDGET}.` });
    const strategy = BID_STRATEGIES[campaign.bidStrategy];
    if (strategy.needs === "bidAmount" && !(campaign.bidAmount && campaign.bidAmount > 0))
      issues.push({ ...base, level: "error", field: "bidAmount", message: `Для стратегії ${strategy.label} потрібно вказати суму.` });
    if (strategy.needs === "roasGoal" && !(campaign.roasGoal && campaign.roasGoal > 0))
      issues.push({ ...base, level: "error", field: "roasGoal", message: "Вкажіть ROAS goal." });
  }
  if (campaign.budgetSharing && campaign.budgetLevel === "campaign")
    issues.push({ ...base, level: "warning", field: "budgetSharing", message: "Budget sharing працює лише з бюджетами на рівні наборів." });

  const sets = account.adSets.filter((s) => s.campaignId === campaign.id);
  if (sets.length === 0) issues.push({ ...base, level: "error", message: "Кампанія не містить жодного набору оголошень." });

  if (campaign.abTest?.enabled) {
    const v = campaign.abTest.variable;
    if (v === "creative") {
      const ok = sets.some((s) => account.ads.filter((a) => a.adSetId === s.id).length >= 2);
      if (!ok) issues.push({ ...base, level: "error", field: "abTest", message: "A/B тест креативів потребує щонайменше двох оголошень в одному наборі." });
    } else if (sets.length < 2) {
      issues.push({ ...base, level: "error", field: "abTest", message: "A/B тест аудиторій/плейсментів потребує щонайменше двох наборів оголошень." });
    }
    if (!campaign.abTest.hypothesis.trim())
      issues.push({ ...base, level: "warning", field: "abTest", message: "Сформулюйте гіпотезу тесту — без неї складно інтерпретувати результат.", articleSlug: "ab-testing" });
  }

  if (campaign.budgetLevel === "campaign" && campaign.budgetType === "lifetime" && sets.some((s) => s.endDay === null))
    issues.push({ ...base, level: "error", field: "budgetType", message: "Бюджет на весь період потребує дати завершення в усіх наборах." });

  // Фрагментація бюджету
  const totalDaily =
    campaign.budgetLevel === "campaign"
      ? campaign.budgetType === "daily"
        ? campaign.budgetAmount
        : 0
      : sets.reduce((a, s) => a + (s.budgetType === "daily" ? s.budgetAmount : 0), 0);
  if (sets.length >= 4 && totalDaily > 0 && totalDaily / sets.length < 15)
    issues.push({
      ...base,
      level: "warning",
      message: `Бюджет розпорошено: ${sets.length} наборів по ~$${(totalDaily / sets.length).toFixed(0)}/день. Кожному буде важко зібрати дані для навчання.`,
      hint: "Об'єднайте схожі набори або збільште бюджет на кожен.",
      articleSlug: "budgets-bidding",
    });

  // Перетин аудиторій
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      const o = audienceOverlap(sets[i], sets[j]);
      if (o > 0.6 && !campaign.abTest?.enabled)
        issues.push({
          ...base,
          level: "warning",
          message: `Набори «${sets[i].name}» і «${sets[j].name}» мають високий перетин аудиторій (~${Math.round(o * 100)}%) і конкурують між собою.`,
          articleSlug: "audiences",
        });
    }
  }
  return issues;
}

export function validateAdSet(account: AdAccount, campaign: Campaign, adSet: AdSet): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const base = { entityType: "ad_set" as const, entityId: adSet.id, entityName: adSet.name };
  const t = adSet.audience;
  if (!adSet.name.trim()) issues.push({ ...base, level: "error", field: "name", message: "Вкажіть назву набору." });
  if (!conversionLocationsFor(campaign.objective).includes(adSet.conversionLocation))
    issues.push({ ...base, level: "error", field: "conversionLocation", message: "Місце конверсії недоступне для цілі кампанії." });
  if (!performanceGoalsFor(campaign.objective, adSet.conversionLocation).includes(adSet.performanceGoal))
    issues.push({ ...base, level: "error", field: "performanceGoal", message: "Ціль ефективності недоступна для обраного місця конверсії." });

  if (requiresPixel(adSet.conversionLocation, adSet.performanceGoal) && !account.tracking.pixel.installed && !account.tracking.capi.enabled)
    issues.push({
      ...base,
      level: "error",
      field: "datasetId",
      message: "Для цієї цілі потрібен Pixel/датасет, але на сайті його не встановлено.",
      hint: "Відкрийте Events Manager і встановіть Pixel або підключіть Conversions API.",
      articleSlug: "pixel-capi",
    });
  if (requiresPixelEvent(adSet.conversionLocation, adSet.performanceGoal)) {
    if (!adSet.optimizationEvent) issues.push({ ...base, level: "error", field: "optimizationEvent", message: "Оберіть подію оптимізації." });
    else {
      const cap = captureModel(account, adSet.optimizationEvent as PixelEvent);
      if (cap.capture === 0)
        issues.push({
          ...base,
          level: "warning",
          field: "optimizationEvent",
          message: `Подія ${adSet.optimizationEvent} не надходила в датасет. Система не зможе оптимізувати показ під неї.`,
          hint: "Перевірте Events Manager: подія має спрацьовувати на сторінці подяки.",
          articleSlug: "events-manager",
        });
      if (cap.duplicated)
        issues.push({ ...base, level: "warning", field: "optimizationEvent", message: cap.notes.join(" "), articleSlug: "pixel-capi" });
    }
  }
  if (adSet.performanceGoal === "landing_page_views" && !account.tracking.pixel.events.includes("PageView"))
    issues.push({ ...base, level: "warning", message: "Landing page views рахуються через Pixel — подія PageView не спрацьовує.", articleSlug: "pixel-capi" });
  if (requiresApp(adSet.conversionLocation) && !account.tracking.appRegistered)
    issues.push({ ...base, level: "error", field: "conversionLocation", message: "Застосунок не зареєстровано в навчальному акаунті.", articleSlug: "campaign-objectives" });
  if (adSet.performanceGoal === "conversion_leads" && !account.tracking.crmFeedback)
    issues.push({
      ...base,
      level: "warning",
      field: "performanceGoal",
      message: "Conversion leads потребує передачі статусів лідів із CRM. Без цього оптимізація не відрізнятиметься від звичайних лідів.",
      articleSlug: "lead-generation",
    });

  // Бюджет
  if (campaign.budgetLevel === "ad_set") {
    if (!(adSet.budgetAmount > 0)) issues.push({ ...base, level: "error", field: "budgetAmount", message: "Вкажіть бюджет набору." });
    else if (adSet.budgetType === "daily" && adSet.budgetAmount < MIN_DAILY_BUDGET)
      issues.push({ ...base, level: "error", field: "budgetAmount", message: `Мінімальний денний бюджет — $${MIN_DAILY_BUDGET}.` });
    if (adSet.budgetType === "lifetime" && adSet.endDay === null)
      issues.push({ ...base, level: "error", field: "endDay", message: "Для бюджету на весь період вкажіть дату завершення." });
    const strategy = BID_STRATEGIES[adSet.bidStrategy];
    if (!bidStrategiesFor(adSet.performanceGoal).includes(adSet.bidStrategy))
      issues.push({ ...base, level: "error", field: "bidStrategy", message: "Стратегія ставок несумісна з ціллю ефективності." });
    if (strategy.needs === "bidAmount" && !(adSet.bidAmount && adSet.bidAmount > 0))
      issues.push({ ...base, level: "error", field: "bidAmount", message: `Для ${strategy.label} вкажіть суму.` });
    if (strategy.needs === "roasGoal" && !(adSet.roasGoal && adSet.roasGoal > 0))
      issues.push({ ...base, level: "error", field: "roasGoal", message: "Вкажіть ROAS goal." });
  } else if (!bidStrategiesFor(adSet.performanceGoal).includes(campaign.bidStrategy)) {
    issues.push({ ...base, level: "error", field: "bidStrategy", message: "Стратегія ставок кампанії несумісна з ціллю ефективності цього набору." });
  }
  if (adSet.endDay !== null && adSet.endDay < adSet.startDay)
    issues.push({ ...base, level: "error", field: "endDay", message: "Дата завершення раніше за дату початку." });
  if (adSet.endDay !== null && adSet.endDay < account.simDay)
    issues.push({ ...base, level: "error", field: "endDay", message: "Дата завершення вже минула в симульованому календарі." });

  // Аудиторія
  if (t.locations.length === 0) issues.push({ ...base, level: "error", field: "locations", message: "Додайте хоча б одну локацію." });
  if (t.ageMin > t.ageMax) issues.push({ ...base, level: "error", field: "ageMin", message: "Мінімальний вік більший за максимальний." });
  if (t.ageMin < 18) issues.push({ ...base, level: "error", field: "ageMin", message: "Навчальний симулятор підтримує таргетинг лише 18+." });
  const rules = specialCategoryRules(campaign.specialAdCategories);
  if (rules.active) {
    if (!t.advantageAudience && (t.ageMin !== 18 || t.ageMax !== 65))
      issues.push({ ...base, level: "error", field: "ageMin", message: "Спеціальна категорія: вік має бути 18–65+." });
    if (!t.advantageAudience && t.genders !== "all") issues.push({ ...base, level: "error", field: "genders", message: "Спеціальна категорія: гендер — лише «усі»." });
    const lal = t.includedAudienceIds.map((id) => account.audiences.find((a) => a.id === id)).filter((a) => a?.type === "lookalike");
    if (lal.length) issues.push({ ...base, level: "error", field: "includedAudienceIds", message: "Спеціальна категорія: lookalike-аудиторії недоступні." });
    if (t.locations.some((l) => l.city && (l.radiusKm ?? 0) < rules.minCityRadiusKm))
      issues.push({ ...base, level: "error", field: "locations", message: `Спеціальна категорія: радіус навколо міста — щонайменше ${rules.minCityRadiusKm} км.` });
  }
  if (t.detailedTargeting.some((id) => interestById(id)?.sensitive))
    issues.push({
      ...base,
      level: "warning",
      field: "detailedTargeting",
      message: "Чутливий інтерес у таргетингу: ризик відхилення або обмеження доставки.",
      articleSlug: "advertising-standards",
    });
  const flagged = t.includedAudienceIds.map((id) => account.audiences.find((a) => a.id === id)).filter((a) => a?.flaggedSensitive);
  if (flagged.length)
    issues.push({
      ...base,
      level: "error",
      field: "includedAudienceIds",
      message: "Аудиторія позначена як така, що може натякати на стан здоров'я/фінанси, і не може використовуватися.",
      articleSlug: "advertising-standards",
    });

  const est = estimateAudience(account, t);
  if (est.size === 0) issues.push({ ...base, level: "error", field: "locations", message: "Потенційна аудиторія порожня." });
  else if (est.size < 20_000)
    issues.push({ ...base, level: "warning", message: `Дуже мала аудиторія (~${est.size.toLocaleString("uk-UA")}). Очікуйте високу частоту і дорожчий CPM.`, articleSlug: "audiences" });

  if (euShare(adSet) > 0 && !account.tracking.consent.bannerEnabled)
    issues.push({
      ...base,
      level: "warning",
      message: "Таргетинг на ЄС, але на сайті немає банера згоди (CMP). Це юридичний ризик збору даних без згоди.",
      articleSlug: "privacy-consent",
    });

  if (adSet.placements.mode === "manual") {
    if (adSet.placements.selected.length === 0) issues.push({ ...base, level: "error", field: "placements", message: "Оберіть хоча б один плейсмент." });
    if (adSet.placements.selected.length > 0 && adSet.placements.selected.length <= 2)
      issues.push({ ...base, level: "info", message: "Мало плейсментів: обмежений інвентар зазвичай підвищує CPM.", articleSlug: "placements" });
    if (adSet.placements.selected.includes("audience_network") && adSet.performanceGoal === "link_clicks")
      issues.push({
        ...base,
        level: "warning",
        message: "Audience Network + оптимізація на кліки часто дають дешеві кліки з низькою часткою landing page views.",
        articleSlug: "placements",
      });
  }
  for (const pid of selectedPlacements(adSet)) {
    const p = placementById(pid);
    if (p.featureId && adSet.placements.mode === "manual")
      issues.push({ ...base, level: "info", message: `${p.label}: доступність плейсменту потребує перевірки у вашому акаунті (див. реєстр функцій).` });
  }

  // Ризик навчальної фази
  const ads = account.ads.filter((a) => a.adSetId === adSet.id);
  if (ads.length === 0) issues.push({ ...base, level: "error", message: "Набір не містить жодного оголошення." });
  else {
    const model = buildAdSetModel(account, campaign, adSet, ads, account.simDay);
    const daily =
      campaign.budgetLevel === "campaign"
        ? (campaign.budgetType === "daily" ? campaign.budgetAmount : campaign.budgetAmount / 14) /
          Math.max(1, account.adSets.filter((s) => s.campaignId === campaign.id).length)
        : adSet.budgetType === "daily"
          ? adSet.budgetAmount
          : adSet.budgetAmount / Math.max(1, (adSet.endDay ?? adSet.startDay + 14) - adSet.startDay + 1);
    const weekly = daily * 7 * model.resultsPerDollar;
    const conversionGoal = ["conversions", "conversion_value", "leads", "conversion_leads", "app_events", "app_installs"].includes(adSet.performanceGoal);
    if (conversionGoal && weekly < 50 && weekly >= 0)
      issues.push({
        ...base,
        level: "warning",
        message: `Прогноз ~${Math.round(weekly)} подій оптимізації за 7 днів (< 50). Ймовірний статус «Learning limited».`,
        hint: "Збільште бюджет, розширте аудиторію або оберіть подію вище у воронці.",
        articleSlug: "learning-phase",
      });
  }
  const pp = t.locations[0] ? countryByCode(t.locations[0].country) : null;
  void pp;
  return issues;
}

export function validateAd(account: AdAccount, campaign: Campaign, adSet: AdSet, ad: Ad): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const base = { entityType: "ad" as const, entityId: ad.id, entityName: ad.name };
  const c = ad.creative;
  if (!ad.name.trim()) issues.push({ ...base, level: "error", field: "name", message: "Вкажіть назву оголошення." });
  if (!ad.facebookPageId) issues.push({ ...base, level: "error", field: "facebookPageId", message: "Оберіть Facebook-сторінку." });
  if (!c.media.length) issues.push({ ...base, level: "error", field: "media", message: "Додайте зображення або відео." });
  if (ad.format === "single_video" && c.media[0] && c.media[0].kind !== "video")
    issues.push({ ...base, level: "error", field: "media", message: "Формат «Одне відео» потребує відео." });
  if (ad.format === "carousel" && c.media.length < 2) issues.push({ ...base, level: "error", field: "media", message: "Карусель потребує щонайменше 2 карток." });
  if (!c.primaryText.trim()) issues.push({ ...base, level: "warning", field: "primaryText", message: "Основний текст порожній." });
  if (c.primaryText.length > 2200) issues.push({ ...base, level: "error", field: "primaryText", message: "Основний текст задовгий (макс. 2200 символів у симуляторі)." });
  if (c.headline.length > 40) issues.push({ ...base, level: "info", field: "headline", message: "Заголовок довший за 40 символів може обрізатися в деяких плейсментах." });

  const needsUrl = ["website", "website_and_app", "website_and_instant_forms"].includes(adSet.conversionLocation);
  if (needsUrl) {
    if (!c.destinationUrl.trim()) issues.push({ ...base, level: "error", field: "destinationUrl", message: "Вкажіть URL сайту." });
    else if (!isHttpsUrl(c.destinationUrl)) issues.push({ ...base, level: "error", field: "destinationUrl", message: "URL має починатися з https://." });
    else if (!c.destinationUrl.startsWith("https://")) issues.push({ ...base, level: "warning", field: "destinationUrl", message: "Використовуйте HTTPS." });
    if (!utmPresent(c.urlParameters, c.destinationUrl))
      issues.push({
        ...base,
        level: "warning",
        field: "urlParameters",
        message: "Немає UTM-параметрів (utm_source, utm_medium, utm_campaign). CRM/GA4 не зможуть коректно приписати трафік.",
        articleSlug: "utm-ga4",
      });
  }
  if (adSet.conversionLocation === "instant_forms" || adSet.conversionLocation === "website_and_instant_forms") {
    if (!c.instantForm) issues.push({ ...base, level: "error", field: "instantForm", message: "Налаштуйте миттєву форму." });
    else if (!c.instantForm.privacyPolicyUrl.trim())
      issues.push({ ...base, level: "error", field: "instantForm", message: "Миттєва форма потребує посилання на політику конфіденційності.", articleSlug: "lead-generation" });
  }
  const verticalPlacements = selectedPlacements(adSet).filter((p) => ["Stories", "Reels"].includes(placementById(p).group));
  if (verticalPlacements.length && c.media[0] && c.media[0].aspectRatio !== "9:16" && !c.verticalMedia)
    issues.push({
      ...base,
      level: "info",
      field: "verticalMedia",
      message: "Немає вертикальної (9:16) версії для Stories/Reels — система обріже або адаптує медіа.",
      articleSlug: "creative-strategy",
    });
  void campaign;
  return issues;
}

export function validateCampaignTree(account: AdAccount, campaignId: string): ValidationIssue[] {
  const campaign = account.campaigns.find((c) => c.id === campaignId);
  if (!campaign) return [];
  const issues = validateCampaign(account, campaign);
  for (const s of account.adSets.filter((x) => x.campaignId === campaignId)) {
    issues.push(...validateAdSet(account, campaign, s));
    for (const a of account.ads.filter((x) => x.adSetId === s.id)) issues.push(...validateAd(account, campaign, s, a));
  }
  return issues;
}

export const hasBlockingErrors = (issues: ValidationIssue[]) => issues.some((i) => i.level === "error");
