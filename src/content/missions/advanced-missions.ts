import { runHistory, sealScenario, buildCampaign, libMedia } from "@/domain/account-builder";
import type { AdAccount } from "@/domain/types";
import { aggregate, ATTRIBUTION_PRESETS } from "@/simulation/reporting";
import { utmPresent } from "@/simulation/tracking";
import { asOfHandover, kpiScore, reportFor, significantUserEdits } from "@/scoring/checks";
import { auditScenario, budgetScenario, glynaProspecting, leadsNoUtmScenario, UTM, broad, manual } from "../scenarios";
import { glynaAccount, pixelPathAccount, speaklyAccount } from "./businesses";
import type { MissionDefinition } from "./types";

const seededCampaigns = (a: AdAccount) => a.campaigns.filter((c) => c.seq <= a.seededSeq);
const postFix = (a: AdAccount) => reportFor(a, { fromDay: a.handoverDay });
const preFix = (a: AdAccount, days = 7) => reportFor(asOfHandover(a), { fromDay: Math.max(0, a.handoverDay - days), toDay: a.handoverDay - 1 });
const postFixDays = (a: AdAccount) => new Set(a.metrics.filter((m) => m.day >= a.handoverDay && m.impressions > 0).map((m) => m.day)).size;
const activeAds = (a: AdAccount) =>
  a.ads.filter(
    (x) =>
      x.status === "active" &&
      a.adSets.find((s) => s.id === x.adSetId)?.status === "active" &&
      a.campaigns.find((c) => c.id === x.campaignId)?.status === "active",
  );

function dailyBudgetActive(a: AdAccount): number {
  let d = 0;
  for (const c of a.campaigns.filter((x) => x.status === "active")) {
    if (c.budgetLevel === "campaign") d += c.budgetType === "daily" ? c.budgetAmount : c.budgetAmount / 14;
    else for (const s of a.adSets.filter((x) => x.campaignId === c.id && x.status === "active")) d += s.budgetType === "daily" ? s.budgetAmount : s.budgetAmount / 14;
  }
  return d;
}

const campaignByPrefix = (a: AdAccount, prefix: string) => a.campaigns.find((c) => c.name.startsWith(prefix));

export const m11: MissionDefinition = {
  id: "m11",
  number: 11,
  title: "Оптимізація рекламного бюджету",
  level: "middle",
  type: "optimize",
  summary: "Перерозподіліть фіксовані $100/день між чотирма кампаніями так, щоб отримати більше лідів за прийнятною ціною.",
  estimatedMinutes: 40,
  brief: {
    business: "Speakly Lab — онлайн-школа англійської.",
    product: "Пробний урок (лід).",
    audience: "Дорослі в Україні.",
    goal: "Більше лідів за той самий бюджет.",
    budget: "Фіксовано: не більше $100 на день сумарно.",
    conversionValue: "15% лідів купують навчання за $220",
    kpis: [
      { label: "Ліди за 7 днів після змін", target: "≥ 120% від 7 днів до змін" },
      { label: "CPL після змін", target: "≤ $5" },
    ],
    constraints: ["Сумарний денний бюджет ≤ $100", "Не більше 4 суттєвих редагувань загалом"],
    initialData: ["4 кампанії по $25/день, 14 днів історії", "A — broad, B — lookalike, C — вузькі інтереси (Київ), D — кліки в Audience Network"],
    evaluation: ["Аналіз ефективності за CPL (а не за «Results»)", "Рішення про паузу/перерозподіл", "Дисципліна змін", "Результат"],
  },
  minDeliveryDays: 7,
  tasks: ["Порівняйте CPL кампаній за 14 днів.", "Вимкніть неефективні кампанії і перерозподіліть бюджет, не перевищуючи $100.", "Симулюйте 7 днів."],
  questions: [
    {
      id: "q1",
      kind: "number",
      prompt: "Який CPL кампанії A за 14 днів історії?",
      tolerance: 0.05,
      expectedValue: (a) => {
        const c = campaignByPrefix(a, "A ·");
        return c ? reportFor(asOfHandover(a), { campaignIds: [c.id], toDay: a.handoverDay - 1 }).cpl : null;
      },
      unit: "$",
      dimension: "metrics",
      weight: 6,
      explanation: "CPL = spend / leads для кампанії A.",
    },
    {
      id: "q2",
      kind: "single",
      prompt: "Чому не варто одним кроком підняти бюджет найкращої кампанії з $25 до $100?",
      options: [
        { id: "a", text: "Різке збільшення — суттєва зміна, що скидає навчання; крім того, ефективність зазвичай падає зі зростанням витрат (спадна віддача)" },
        { id: "b", text: "Платформа не дозволяє бюджет понад $50" },
        { id: "c", text: "Більший бюджет завжди знижує CPL, тож немає причин не робити цього" },
      ],
      correct: ["a"],
      evidenceQuestionId: "q3",
      askConfidence: true,
      dimension: "budget",
      weight: 8,
      explanation: "Великі стрибки бюджету — суттєве редагування; аукціон дорожчає з масштабом.",
    },
    {
      id: "q3",
      kind: "text",
      prompt: "Опишіть ваш план перерозподілу і чому кампанія D з дешевими «Results» неефективна.",
      keywords: [["cpl", "лід"], ["link click", "клік", "audience network"], ["пауз", "вимкн"], ["поступов", "крок", "навчан"]],
      minLength: 160,
      dimension: "argumentation",
      weight: 9,
      explanation: "«Results» D — кліки, а не ліди. Порівнюйте за однаковою бізнес-метрикою.",
    },
  ],
  rubric: [
    { id: "cap", dimension: "budget", weight: 9, critical: true, label: "≤ $100/день", pass: "Сумарний бюджет у межах $100.", fail: "Сумарний денний бюджет перевищує $100.", check: (c) => (dailyBudgetActive(c.account) <= 100.01 ? 1 : 0) },
    {
      id: "pauseD",
      dimension: "optimization",
      weight: 8,
      label: "D вимкнено/урізано",
      pass: "Неефективну кампанію D вимкнено або суттєво урізано.",
      fail: "Кампанія D (кліки в Audience Network) досі отримує бюджет.",
      check: (c) => {
        const d = campaignByPrefix(c.account, "D ·");
        if (!d) return 1;
        return d.status === "paused" ? 1 : d.budgetAmount <= 12.5 ? 0.6 : 0;
      },
    },
    {
      id: "fundA",
      dimension: "budget",
      weight: 7,
      label: "Бюджет на кращі",
      pass: "Бюджет перенесено на кампанії з найнижчим CPL.",
      fail: "Бюджет не перенесено на ефективніші кампанії.",
      check: (c) => {
        const camps = seededCampaigns(c.account).map((x) => ({ x, cpl: reportFor(asOfHandover(c.account), { campaignIds: [x.id], toDay: c.account.handoverDay - 1 }).cpl ?? 999 }));
        const best = camps.sort((p, q) => p.cpl - q.cpl)[0]?.x;
        const now = c.account.campaigns.find((x) => x.id === best?.id);
        return now && now.status === "active" && now.budgetAmount > 25 ? 1 : 0;
      },
    },
    {
      id: "edits",
      dimension: "optimization",
      weight: 6,
      label: "≤ 4 суттєві зміни",
      pass: "Зміни дисципліновані.",
      fail: "Забагато суттєвих змін.",
      check: (c) => {
        const n = significantUserEdits(c.account, c.account.handoverDay);
        return n <= 4 ? 1 : n <= 6 ? 0.5 : 0;
      },
    },
    { id: "days", dimension: "metrics", weight: 5, label: "7 днів після змін", pass: "7 днів після змін.", fail: "Замало днів після змін.", check: (c) => Math.min(1, postFixDays(c.account) / 7) },
    {
      id: "uplift",
      dimension: "optimization",
      weight: 9,
      label: "Ліди +20%",
      pass: "Кількість лідів зросла щонайменше на 20%.",
      fail: "Приріст лідів менший за 20%.",
      check: (c) => {
        const before = preFix(c.account).leads;
        const after = postFix(c.account).leads;
        return before > 0 ? kpiScore(after, before * 1.2, "min") : 0;
      },
    },
    { id: "cpl", dimension: "metrics", weight: 6, label: "CPL ≤ $5", pass: "CPL після змін у межах KPI.", fail: "CPL після змін вищий за $5.", check: (c) => kpiScore(postFix(c.account).cpl, 5, "max") },
  ],
  caseStudyKeywords: [["cpl"], ["бюджет", "перерозпод"], ["пауз", "вимкн"], ["навчан"], ["results", "клік"]],
  expert: {
    explanation:
      "Порівнювати кампанії треба за однаковою бізнес-метрикою (CPL), а не за колонкою Results — у кампанії D «результати» це кліки. Вимкнення неефективних кампаній і поступове (~20–30%) збільшення бюджету найкращих, або об'єднання в одну кампанію з Advantage+ campaign budget, зазвичай дають більше лідів без різкого зростання CPL.",
    alternative: "Альтернатива — об'єднати A і B в одну кампанію з campaign budget $100 і дати системі розподіляти бюджет між наборами.",
  },
  recommendedArticles: ["budgets-bidding", "optimization", "learning-phase"],
  skills: ["budget", "optimization", "metrics"],
  createAccount: (id, _att, seed) => sealScenario(budgetScenario(speaklyAccount(id, seed, { name: "Місія 11 · Speakly (бюджет $100)" }))),
};

export const m12: MissionDefinition = {
  id: "m12",
  number: 12,
  title: "Аудит рекламного акаунта",
  level: "advanced",
  type: "audit",
  summary: "Проведіть аудит чужого акаунта: знайдіть проблеми, розставте пріоритети й виправте найважливіше.",
  estimatedMinutes: 50,
  brief: {
    business: "«Глина» — магазин кераміки, продає в Україні та Польщі.",
    product: "Посуд ручної роботи, чек $42.",
    audience: "25–55, UA + PL.",
    goal: "Отримати від вас аудит з пріоритетами та виправити найкритичніше.",
    budget: "Поточні витрати ≈ $67/день.",
    conversionValue: "$42",
    margin: "45%",
    kpis: [{ label: "Якість аудиту", target: "знайдені проблеми, пріоритети, обґрунтування" }],
    constraints: ["Не видаляйте кампанії — вимикайте або редагуйте", "Збережіть журнал змін читабельним"],
    initialData: ["3 кампанії, 14 днів історії", "Таргетинг включає Польщу (ЄС)", "Pixel + CAPI підключено"],
    evaluation: ["Повнота знахідок без хибних «проблем»", "Пріоритизація", "Виправлення в кабінеті", "Аргументація"],
  },
  minDeliveryDays: 0,
  tasks: ["Пройдіться по кампаніях, наборах, оголошеннях і Events Manager.", "Відповідайте на питання аудиту.", "Виправте щонайменше 3 проблеми безпосередньо в кабінеті."],
  questions: [
    {
      id: "q1",
      kind: "multi",
      prompt: "Які проблеми ви знайшли?",
      options: [
        { id: "traffic_for_sales", text: "Для продажів використано Traffic з оптимізацією на link clicks" },
        { id: "an_clicks", text: "Audience Network + оптимізація на кліки — дешеві, але неякісні переходи" },
        { id: "viewcontent", text: "Sales-кампанія оптимізується на ViewContent замість Purchase" },
        { id: "fragmentation", text: "Бюджет розпорошено на 4 дрібні набори з перетином аудиторій" },
        { id: "retarget_adv", text: "«Ретаргетинг» з Advantage+ audience фактично розширюється на холодну аудиторію; покупців не виключено" },
        { id: "no_utm", text: "Частина оголошень без UTM" },
        { id: "consent", text: "Таргетинг на ЄС без банера згоди на сайті" },
        { id: "caps", text: "Спамний банер капсом" },
        { id: "pixel_missing", text: "Pixel не встановлено" },
        { id: "too_broad", text: "Аудиторія занадто широка для e-commerce" },
        { id: "budget_too_high", text: "Загальний бюджет занадто великий" },
      ],
      correct: ["traffic_for_sales", "an_clicks", "viewcontent", "fragmentation", "retarget_adv", "no_utm", "consent", "caps"],
      evidenceQuestionId: "q3",
      askConfidence: true,
      dimension: "metrics",
      weight: 12,
      explanation: "Pixel працює; широка аудиторія та бюджет самі по собі не є проблемою.",
    },
    {
      id: "q2",
      kind: "multi",
      prompt: "Оберіть 3 найпріоритетніші виправлення (найбільший вплив на гроші та ризики).",
      options: [
        { id: "viewcontent", text: "Перевести оптимізацію на Purchase / консолідувати набори" },
        { id: "traffic_for_sales", text: "Вимкнути або перебудувати кампанію на кліки (Traffic + AN)" },
        { id: "consent", text: "Налаштувати банер згоди для трафіку з ЄС" },
        { id: "caps", text: "Переписати банер капсом" },
        { id: "no_utm", text: "Додати UTM" },
      ],
      correct: ["viewcontent", "traffic_for_sales", "consent"],
      dimension: "optimization",
      weight: 9,
      explanation: "Неправильна оптимізація зливає бюджет; відсутність згоди — юридичний ризик. UTM і банер важливі, але другого порядку.",
    },
    {
      id: "q3",
      kind: "text",
      prompt: "Обґрунтуйте пріоритети: які дані/налаштування показують масштаб кожної проблеми?",
      keywords: [["purchase", "viewcontent", "подія"], ["клік", "audience network", "lpv"], ["згод", "consent", "єс", "gdpr"], ["утм", "utm"], ["набор", "розпорош", "перетин"]],
      minLength: 200,
      dimension: "argumentation",
      weight: 10,
      explanation: "Пріоритизуйте за впливом на бюджет і ризиком.",
    },
  ],
  rubric: [
    {
      id: "fix_event",
      dimension: "optimization",
      weight: 8,
      label: "Виправлено подію оптимізації",
      pass: "Активні конверсійні набори оптимізуються на Purchase (або ViewContent-набори вимкнено).",
      fail: "Набори з оптимізацією на ViewContent досі активні.",
      check: (c) => {
        const vc = c.account.adSets.filter((s) => s.optimizationEvent === "ViewContent" && s.status === "active" && c.account.campaigns.find((x) => x.id === s.campaignId)?.status === "active");
        return vc.length === 0 ? 1 : 0;
      },
    },
    {
      id: "fix_traffic",
      dimension: "structure",
      weight: 7,
      label: "Кліки в AN вимкнено",
      pass: "Кампанію на кліки з Audience Network вимкнено або перебудовано.",
      fail: "Кампанія на кліки з Audience Network досі працює.",
      check: (c) => {
        const t = c.account.adSets.filter((s) => s.performanceGoal === "link_clicks" && s.status === "active" && s.placements.selected.includes("audience_network") && c.account.campaigns.find((x) => x.id === s.campaignId)?.status === "active");
        return t.length === 0 ? 1 : 0;
      },
    },
    { id: "fix_consent", dimension: "policy", weight: 8, label: "Банер згоди", pass: "У Events Manager увімкнено банер згоди.", fail: "Банер згоди для ЄС не налаштовано.", check: (c) => (c.account.tracking.consent.bannerEnabled ? 1 : 0) },
    {
      id: "fix_utm",
      dimension: "tracking",
      weight: 5,
      label: "UTM в активних оголошеннях",
      pass: "Усі активні оголошення мають UTM.",
      fail: "Не всі активні оголошення мають UTM.",
      check: (c) => {
        const ads = activeAds(c.account);
        return ads.length ? ads.filter((a) => utmPresent(a.creative.urlParameters, a.creative.destinationUrl)).length / ads.length : 0;
      },
    },
    {
      id: "fix_retarget",
      dimension: "audience",
      weight: 5,
      label: "Ретаргетинг виправлено",
      pass: "Ретаргетинг-набір обмежено аудиторією й виключено покупців (або вимкнено).",
      fail: "Ретаргетинг-набір досі з Advantage+ audience без виключення покупців.",
      check: (c) => {
        const s = c.account.adSets.find((x) => x.audience.includedAudienceIds.includes("aud_gl_site") && x.seq <= c.account.seededSeq);
        if (!s || s.status === "paused") return 1;
        return !s.audience.advantageAudience && s.audience.excludedAudienceIds.includes("aud_gl_buyers") ? 1 : 0.3;
      },
    },
  ],
  caseStudyKeywords: [["пріоритет"], ["подія", "purchase"], ["структур", "набор"], ["згод", "consent"], ["utm"], ["план", "наступн"]],
  expert: {
    explanation:
      "Найдорожчі помилки — ті, що змушують систему оптимізуватись під неправильну дію: Traffic/link clicks для продажів і ViewContent замість Purchase. Далі — структура (фрагментація, перетин) та юридичні ризики (згода на трекінг у ЄС). UTM і якість креативів — важливі, але другочергові.",
    alternative: "Замість точкових виправлень можна перебудувати акаунт: одна Advantage+ sales кампанія для проспектингу + чіткий ретаргетинг, з паузою старих кампаній після запуску нових.",
  },
  recommendedArticles: ["diagnostics-playbook", "campaign-structure", "privacy-consent", "pixel-capi"],
  skills: ["structure", "tracking", "policy", "argumentation"],
  createAccount: (id, _att, seed) => sealScenario(auditScenario(glynaAccount(id, seed, { name: "Місія 12 · «Глина» аудит" }))),
};

export const m13: MissionDefinition = {
  id: "m13",
  number: 13,
  title: "Перевірка Pixel та Conversions API",
  level: "advanced",
  type: "optimize",
  summary: "Покупки в кабінеті не сходяться з бекендом магазину. Знайдіть проблему дедуплікації та виправте її.",
  estimatedMinutes: 35,
  brief: {
    business: "«Глина» — магазин кераміки.",
    product: "Посуд, чек $42.",
    audience: "UA 25–55.",
    goal: "Відновити коректний облік покупок.",
    budget: "$60 на день (без змін).",
    conversionValue: "$42",
    margin: "45%",
    kpis: [{ label: "Співвідношення Meta / бекенд після виправлення", target: "0.7–1.05" }],
    constraints: ["Не змінювати кампанію", "Виправлення — в Events Manager"],
    initialData: ["Pixel і CAPI надсилають Purchase", "ROAS у кабінеті підозріло високий", "Розробники кажуть: «CAPI налаштовано»"],
    evaluation: ["Розрахунок розбіжності", "Розуміння вимог дедуплікації", "Виправлення налаштувань", "Перевірка після виправлення"],
  },
  minDeliveryDays: 5,
  tasks: ["Порівняйте покупки в Ads Manager і в бекенді (Analytics → Meta vs CRM).", "В Events Manager знайдіть причину й виправте.", "Симулюйте 5+ днів і перевірте співвідношення."],
  questions: [
    {
      id: "q1",
      kind: "number",
      prompt: "У скільки разів Meta (7-day click) завищує покупки відносно бекенду за 14 днів історії?",
      tolerance: 0.08,
      expectedValue: (a) => {
        const r = aggregate(
          asOfHandover(a),
          a.metrics.filter((m) => m.day < a.handoverDay),
          { attribution: ATTRIBUTION_PRESETS[1].setting },
        );
        return r.truePurchases > 0 ? r.purchases / r.truePurchases : null;
      },
      unit: "×",
      dimension: "tracking",
      weight: 8,
      explanation: "Співвідношення = покупки в Meta / покупки в бекенді.",
    },
    {
      id: "q2",
      kind: "multi",
      prompt: "Що потрібно, щоб Meta дедуплікувала подію з Pixel і CAPI?",
      options: [
        { id: "a", text: "Однаковий event_id в обох подіях" },
        { id: "b", text: "Однаковий event_name" },
        { id: "c", text: "Події надходять у межах 48 годин від першої" },
        { id: "d", text: "Однакова IP-адреса сервера і браузера" },
        { id: "e", text: "Обидві події мають бути з браузера" },
      ],
      correct: ["a", "b", "c"],
      evidenceQuestionId: "q3",
      askConfidence: true,
      dimension: "tracking",
      weight: 9,
      explanation: "За документацією Meta: event_id + event_name, дедуплікація в межах 48 годин; всередині одного джерела вона не працює.",
    },
    {
      id: "q3",
      kind: "text",
      prompt: "Поясніть причину розбіжності та як ви перевірили виправлення.",
      keywords: [["event_id", "event id", "ідентифікатор"], ["event_name", "назв"], ["дедуплік", "дубл"], ["бекенд", "crm"], ["roas"]],
      minLength: 150,
      dimension: "argumentation",
      weight: 9,
      explanation: "Без спільного event_id кожна покупка рахується двічі.",
    },
  ],
  rubric: [
    { id: "dedup", dimension: "tracking", weight: 12, critical: true, label: "Дедуплікацію увімкнено", pass: "CAPI передає event_id — дедуплікація працює.", fail: "Дедуплікацію не налаштовано.", check: (c) => (c.account.tracking.capi.enabled && c.account.tracking.capi.sendsEventId ? 1 : 0) },
    { id: "emq", dimension: "tracking", weight: 6, label: "EMQ ≥ 7", pass: "Якість зіставлення подій підвищено.", fail: "Якість зіставлення подій низька (передавайте більше параметрів клієнта).", check: (c) => (c.account.tracking.capi.eventMatchQuality >= 7 ? 1 : c.account.tracking.capi.eventMatchQuality >= 5 ? 0.5 : 0) },
    {
      id: "ratio",
      dimension: "tracking",
      weight: 8,
      label: "Співвідношення після виправлення",
      pass: "Після виправлення Meta і бекенд узгоджуються.",
      fail: "Після виправлення розбіжність лишилась.",
      check: (c) => {
        const r = aggregate(
          c.account,
          c.account.metrics.filter((m) => m.day >= c.account.handoverDay),
          { attribution: ATTRIBUTION_PRESETS[1].setting },
        );
        if (!r.truePurchases) return 0;
        const ratio = r.purchases / r.truePurchases;
        return ratio >= 0.7 && ratio <= 1.05 ? 1 : ratio <= 1.25 ? 0.5 : 0;
      },
    },
    {
      id: "untouched",
      dimension: "structure",
      weight: 4,
      label: "Кампанію не змінено",
      pass: "Кампанію не змінювали — коректне порівняння до/після.",
      fail: "Зміни в кампанії ускладнюють порівняння до/після.",
      check: (c) => (significantUserEdits(c.account, c.account.handoverDay) === 0 ? 1 : 0),
    },
    { id: "days", dimension: "metrics", weight: 4, label: "5 днів після", pass: "Достатньо днів після виправлення.", fail: "Замало днів для перевірки.", check: (c) => Math.min(1, postFixDays(c.account) / 5) },
  ],
  caseStudyKeywords: [["event_id"], ["дедуплік"], ["бекенд", "crm"], ["roas"], ["capi", "conversions api"]],
  expert: {
    explanation:
      "Коли Pixel і Conversions API надсилають ту саму покупку без спільного event_id (та однакового event_name), Meta не може зрозуміти, що це одна подія, і рахує її двічі. ROAS у кабінеті виглядає чудово, а гроші в касі — ні. Перевірка: порівняння з бекендом і звіт дедуплікації в Events Manager.",
    alternative: "Якщо налаштувати event_id неможливо швидко, тимчасово вимкніть одне з джерел для Purchase, щоб зупинити подвоєння, але це погіршить покриття подій.",
  },
  recommendedArticles: ["pixel-capi", "events-manager", "attribution"],
  skills: ["tracking", "metrics"],
  createAccount: (id, _att, seed) => {
    let a = glynaAccount(id, seed, {
      name: "Місія 13 · «Глина» Pixel + CAPI",
      tracking: { capi: { enabled: true, sendsEventId: false, eventMatchQuality: 4 } },
    });
    a = glynaProspecting(a);
    return sealScenario(runHistory(a, 14));
  },
};

export const m14: MissionDefinition = {
  id: "m14",
  number: 14,
  title: "Аналіз розбіжностей між Meta та CRM",
  level: "advanced",
  type: "analyze",
  summary: "У кабінеті лідів значно більше, ніж бачить CRM. Поясніть розбіжність і налаштуйте коректну атрибуцію.",
  estimatedMinutes: 35,
  brief: {
    business: "Pixel Path — школа UX/UI.",
    product: "Консультація → курс.",
    audience: "UA, широка аудиторія.",
    goal: "Пояснити керівнику, чому цифри не сходяться, і виправити облік.",
    budget: "$40 на день.",
    conversionValue: "Продаж $650",
    kpis: [{ label: "Частка лідів з коректним джерелом у CRM після змін", target: "≥ 80%" }],
    constraints: ["Не змінювати аудиторію та бюджет"],
    initialData: ["14 днів історії", "CRM записує джерело ліда лише з UTM", "Налаштування атрибуції: 7-day click + 1-day engage-through + 1-day view"],
    evaluation: ["Перелік причин розбіжності", "Розрахунок із різними вікнами атрибуції", "Виправлення UTM"],
  },
  minDeliveryDays: 5,
  tasks: ["Відкрийте Analytics → Meta vs CRM та порівняння вікон атрибуції.", "Виправте UTM в оголошеннях.", "Симулюйте 5+ днів."],
  questions: [
    {
      id: "q1",
      kind: "multi",
      prompt: "Що пояснює розбіжність між Meta і CRM у цьому акаунті?",
      options: [
        { id: "a", text: "Відсутні UTM — CRM не може приписати лід джерелу" },
        { id: "b", text: "Meta враховує view-through та engage-through конверсії, яких CRM не бачить як «клік з реклами»" },
        { id: "c", text: "Затримка конверсій: дані останніх днів ще неповні" },
        { id: "d", text: "Meta показує ліди з інших рекламних акаунтів" },
        { id: "e", text: "CRM рахує ліди за датою оплати курсу" },
      ],
      correct: ["a", "b", "c"],
      evidenceQuestionId: "q3",
      askConfidence: true,
      dimension: "metrics",
      weight: 10,
      explanation: "Решта варіантів не відповідає налаштуванням цього акаунта.",
    },
    {
      id: "q2",
      kind: "number",
      prompt: "Скільки лідів показав би кабінет за 14 днів історії з вікном 7-day click (без view/engage)?",
      tolerance: 0.05,
      expectedValue: (a) => aggregate(asOfHandover(a), a.metrics.filter((m) => m.day < a.handoverDay), { attribution: ATTRIBUTION_PRESETS[1].setting }).leads,
      dimension: "metrics",
      weight: 7,
      explanation: "Використайте порівняння вікон атрибуції в Analytics.",
    },
    {
      id: "q3",
      kind: "text",
      prompt: "Підготуйте пояснення для керівника: чому цифри різні і яким даним довіряти для яких рішень.",
      keywords: [["utm"], ["атрибуц", "вікн", "view"], ["crm"], ["затрим", "неповн"], ["рішен", "довір"]],
      minLength: 180,
      dimension: "argumentation",
      weight: 9,
      explanation: "Кабінет — для оптимізації, CRM — для бізнес-рішень; обидва джерела мають обмеження.",
    },
  ],
  rubric: [
    {
      id: "utm",
      dimension: "tracking",
      weight: 12,
      critical: true,
      label: "UTM в активних оголошеннях",
      pass: "Усі активні оголошення мають коректні UTM.",
      fail: "Не всі активні оголошення мають UTM.",
      check: (c) => {
        const ads = activeAds(c.account);
        return ads.length ? ads.filter((a) => utmPresent(a.creative.urlParameters, a.creative.destinationUrl)).length / ads.length : 0;
      },
    },
    {
      id: "share",
      dimension: "tracking",
      weight: 8,
      label: "≥ 80% лідів з джерелом",
      pass: "Після змін CRM коректно приписує більшість лідів.",
      fail: "Після змін CRM досі не бачить джерело більшості лідів.",
      check: (c) => {
        const r = postFix(c.account);
        return r.trueLeads ? kpiScore((r.crmLeads / r.trueLeads) * 100, 80, "min") : 0;
      },
    },
    { id: "untouched", dimension: "structure", weight: 4, label: "Аудиторія/бюджет без змін", pass: "Інші налаштування не змінювали.", fail: "Змінено аудиторію чи бюджет всупереч брифу.", check: (c) => (significantUserEdits(c.account, c.account.handoverDay) === 0 ? 1 : 0.3) },
    { id: "days", dimension: "metrics", weight: 4, label: "5 днів після", pass: "5+ днів після змін.", fail: "Замало днів після змін.", check: (c) => Math.min(1, postFixDays(c.account) / 5) },
  ],
  caseStudyKeywords: [["utm"], ["атрибуц"], ["view", "engage"], ["crm"], ["затрим"]],
  expert: {
    explanation:
      "Рекламний кабінет і CRM рахують різні речі. Кабінет приписує конверсії за моделлю атрибуції (включно з view- та engage-through у межах вікна), CRM — за джерелом, яке бачить (UTM). Без UTM лід у CRM виглядає як «direct/(not set)». Також останні дні в кабінеті неповні через затримку конверсій.",
    alternative: "Додатково можна передавати ліди з CRM назад у Meta (CAPI для CRM / офлайн-події) і будувати звіт за спільним ID ліда.",
  },
  recommendedArticles: ["crm-discrepancies", "attribution", "utm-ga4"],
  skills: ["tracking", "metrics", "argumentation"],
  createAccount: (id, _att, seed) => sealScenario(leadsNoUtmScenario(pixelPathAccount(id, seed, { name: "Місія 14 · Pixel Path (Meta vs CRM)" }))),
};

/** Оголошення з найкращим CPA серед тих, що мають ≥ 8 покупок. */
function bestAdByCpa(a: AdAccount): string[] {
  const rows = a.ads.map((ad) => ({ ad, r: aggregate(a, a.metrics.filter((m) => m.adId === ad.id)) })).filter((x) => x.r.purchases >= 8 && x.r.cpa !== null);
  rows.sort((x, y) => (x.r.cpa ?? 1e9) - (y.r.cpa ?? 1e9));
  return rows.length ? [rows[0].ad.id] : [];
}

export const m15: MissionDefinition = {
  id: "m15",
  number: 15,
  title: "Побудова звіту для клієнта",
  level: "advanced",
  type: "report",
  summary: "Підготуйте чесний звіт для клієнта за 3 тижні роботи: цифри, план vs факт, інсайти й наступні кроки.",
  estimatedMinutes: 40,
  brief: {
    business: "«Глина» — магазин кераміки.",
    product: "Посуд ручної роботи.",
    audience: "UA 25–55.",
    goal: "Звіт за 21 день: що отримали за гроші і що робити далі.",
    budget: "План: $1 400 за 21 день.",
    conversionValue: "$42",
    margin: "45%",
    kpis: [
      { label: "Плановий ROAS", target: "≥ 2.5" },
      { label: "Точність цифр у звіті", target: "±3%" },
    ],
    constraints: ["Нічого не змінювати в кабінеті", "Чітко позначити обмеження даних (атрибуція, симуляція)"],
    initialData: ["2 кампанії: проспектинг і ретаргетинг, 21 день"],
    evaluation: ["Точність ключових цифр", "План vs факт", "Інсайти з доказами", "Наступні кроки", "Чесність щодо обмежень"],
  },
  minDeliveryDays: 0,
  tasks: ["Зберіть цифри в Analytics (весь період).", "Відповідайте на питання точно.", "Заповніть кейс як звіт для клієнта."],
  questions: [
    { id: "q1", kind: "number", prompt: "Загальні витрати за період, $", tolerance: 0.02, expectedValue: (a) => aggregate(a, a.metrics).spend, unit: "$", dimension: "metrics", weight: 6, explanation: "Amount spent за весь період." },
    { id: "q2", kind: "number", prompt: "ROAS за період (за налаштуваннями атрибуції наборів)", tolerance: 0.03, expectedValue: (a) => aggregate(a, a.metrics).roas, dimension: "metrics", weight: 7, explanation: "ROAS = purchase conversion value / spend." },
    { id: "q3", kind: "number", prompt: "CPA (вартість покупки) за період, $", tolerance: 0.03, expectedValue: (a) => aggregate(a, a.metrics).cpa, unit: "$", dimension: "metrics", weight: 7, explanation: "CPA = spend / purchases." },
    { id: "q4", kind: "number", prompt: "Виконання бюджетного плану, % (факт / $1 400 × 100)", tolerance: 0.03, expectedValue: (a) => (aggregate(a, a.metrics).spend / 1400) * 100, unit: "%", dimension: "budget", weight: 5, explanation: "Факт / план × 100%." },
    {
      id: "q5",
      kind: "single",
      prompt: "Яке оголошення має найнижчий CPA (серед оголошень з ≥ 8 покупками)?",
      optionsFn: (a) => a.ads.map((ad) => ({ id: ad.id, text: ad.name })),
      correctFn: bestAdByCpa,
      dimension: "creative",
      weight: 6,
      explanation: "Порівнюйте CPA, а не CTR, і лише на достатній кількості покупок.",
    },
    {
      id: "q6",
      kind: "text",
      prompt: "Які обмеження даних ви чесно позначите у звіті?",
      keywords: [["атрибуц", "view"], ["симуляц", "навчальн"], ["затрим", "неповн"], ["інкремент", "ретаргет"]],
      minLength: 140,
      dimension: "argumentation",
      weight: 8,
      explanation: "Звіт без обмежень створює хибну впевненість у клієнта.",
    },
  ],
  rubric: [
    {
      id: "untouched",
      dimension: "structure",
      weight: 4,
      label: "Кабінет не змінено",
      pass: "Кабінет не змінювали — звіт базується на зафіксованих даних.",
      fail: "У кабінеті вносилися зміни, хоча бриф цього не передбачав.",
      check: (c) => (c.account.changeLog.some((e) => e.actor === "user" && e.simDay >= c.account.handoverDay && e.action !== "simulate") ? 0 : 1),
    },
  ],
  caseStudyKeywords: [["витрат", "spend"], ["roas"], ["cpa"], ["план"], ["креатив"], ["ретаргет", "проспект"], ["наступн", "рекоменд"], ["обмежен", "атрибуц"]],
  expert: {
    explanation:
      "Добрий звіт клієнту відповідає на три питання: що ми отримали за гроші (план vs факт), чому так сталося (інсайти з даними) і що робимо далі (конкретні кроки з очікуваним ефектом). Окремо варто чесно позначити обмеження: модель атрибуції, частку ретаргетингу, неповноту даних останніх днів.",
    alternative: "Для регулярних звітів зручно зафіксувати шаблон: KPI-таблиця, графік динаміки, 3 інсайти, 3 рішення, ризики.",
  },
  recommendedArticles: ["client-reporting", "attribution", "analytics-metrics"],
  skills: ["metrics", "argumentation", "budget"],
  createAccount: (id, _att, seed) => {
    let a = glynaAccount(id, seed, { name: "Місія 15 · «Глина» звіт клієнту" });
    a = glynaProspecting(a, { budget: 52 });
    a = buildCampaign(a, {
      objective: "sales",
      campaign: { name: "Retargeting · кошик і відвідувачі", budgetLevel: "campaign", budgetAmount: 12 },
      adSets: [
        {
          adSet: {
            name: "Кошик 14д + відвідувачі 30д · без покупців",
            conversionLocation: "website",
            performanceGoal: "conversions",
            optimizationEvent: "Purchase",
            audience: manual({ includedAudienceIds: ["aud_gl_atc", "aud_gl_site"], excludedAudienceIds: ["aud_gl_buyers"], ageMin: 18, ageMax: 65 }),
          },
          ads: [
            {
              name: "Нагадування про кошик",
              creative: {
                media: [libMedia("shop_lifestyle_45")],
                primaryText: "Ваші чашки ще чекають у кошику. Кераміка ручної роботи — доставка по Україні за 2–3 дні.",
                headline: "Повернутися до кошика",
                cta: "SHOP_NOW",
                urlParameters: UTM,
              },
            },
          ],
        },
      ],
    });
    void broad;
    return sealScenario(runHistory(a, 21));
  },
};
