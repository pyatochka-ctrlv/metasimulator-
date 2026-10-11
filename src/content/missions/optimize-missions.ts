import { sealScenario } from "@/domain/account-builder";
import { estimateAudience } from "@/simulation/audience";
import { twoProportionZTest } from "@/simulation/metrics";
import { aggregate } from "@/simulation/reporting";
import { assessCreative } from "@/simulation/creative-quality";
import type { AdAccount } from "@/domain/types";
import {
  adSetMatches,
  dailyBudgetAtMost,
  deliveryDaysAtLeast,
  distinctMediaAtLeast,
  kpiScore,
  minAdsPerAdSet,
  noRejectedAds,
  objectiveIn,
  publishedUserCampaigns,
  reasoningScore,
  reportFor,
  asOfHandover,
  significantUserEdits,
  userAds,
  userReport,
  type EvalContext,
} from "@/scoring/checks";
import { expensiveLeadScenario, fatigueScenario, glynaProspecting, lowCtrScenario } from "../scenarios";
import { excelProAccount, glynaAccount, pixelPathAccount, speaklyAccount } from "./businesses";
import { runHistory } from "@/domain/account-builder";
import type { MissionDefinition } from "./types";

const seededIds = (a: AdAccount) => a.campaigns.filter((c) => c.seq <= a.seededSeq).map((c) => c.id);
const postFix = (a: AdAccount) => reportFor(a, { fromDay: a.handoverDay });
const preFix = (a: AdAccount, days = 7) => reportFor(asOfHandover(a), { fromDay: Math.max(0, a.handoverDay - days), toDay: a.handoverDay - 1 });
const postFixDays = (a: AdAccount) => new Set(a.metrics.filter((m) => m.day >= a.handoverDay && m.impressions > 0).map((m) => m.day)).size;
const activeAdSets = (a: AdAccount) =>
  a.adSets.filter((s) => s.status === "active" && a.campaigns.find((c) => c.id === s.campaignId)?.status === "active");

export const m06: MissionDefinition = {
  id: "m06",
  number: 6,
  title: "Ретаргетинг",
  level: "junior",
  type: "build",
  summary: "Поверніть відвідувачів і тих, хто покинув кошик, не витрачаючи бюджет на вже наявних покупців.",
  estimatedMinutes: 30,
  brief: {
    business: "«Глина» — інтернет-магазин кераміки (той самий акаунт, проспектинг уже працює 14 днів).",
    product: "Посуд ручної роботи, середній чек $42.",
    audience: "Люди, що відвідали сайт або додали товар у кошик, але не купили.",
    goal: "Окрема ретаргетинг-кампанія з чітким повідомленням-нагадуванням.",
    budget: "До $15 на день (≈ 25% від проспектингу $60), 7 днів.",
    conversionValue: "$42",
    margin: "45%",
    kpis: [
      { label: "ROAS ретаргетингу", target: "≥ 4.0" },
      { label: "Частота за 7 днів", target: "≤ 6" },
    ],
    constraints: ["Виключити покупців за 180 днів", "Аудиторія має бути саме ретаргетинговою (без розширення на холодних)", "Не змінювати проспектинг-кампанію"],
    initialData: ["Аудиторії: відвідувачі 30д (22 000), додали в кошик 14д (2 600), покупці 180д (1 900)", "Проспектинг: Sales/Purchase, $60/день, Advantage+ audience"],
    evaluation: ["Правильні включення/виключення аудиторій", "Розуміння Advantage+ audience як підказок", "Бюджет і частота", "Повідомлення креативу", "Розуміння інкрементальності"],
  },
  minDeliveryDays: 7,
  tasks: [
    "Створіть нову кампанію Sales/Purchase для ретаргетингу.",
    "Включіть аудиторії відвідувачів/кошика, виключіть покупців.",
    "Вимкніть Advantage+ audience у цьому наборі, щоб аудиторії були обмеженням, а не підказкою.",
    "Креатив — нагадування про товари/кошик. Симулюйте 7 днів.",
  ],
  questions: [
    {
      id: "q1",
      kind: "single",
      prompt: "Чому ретаргетинг зазвичай має вищий ROAS, але не варто переносити туди весь бюджет?",
      options: [
        { id: "a", text: "Аудиторія мала і частина цих людей купила б і без реклами — атрибутований ROAS завищує інкрементальний ефект" },
        { id: "b", text: "Ретаргетинг заборонено правилами реклами" },
        { id: "c", text: "Ретаргетинг завжди дорожчий за проспектинг" },
      ],
      correct: ["a"],
      evidenceQuestionId: "q3",
      askConfidence: true,
      dimension: "metrics",
      weight: 7,
      explanation: "Без нових відвідувачів ретаргетинг-аудиторія вичерпується; атрибуція ≠ інкрементальність.",
    },
    {
      id: "q2",
      kind: "number",
      prompt: "Яка частота (frequency) вашої ретаргетинг-кампанії за період?",
      tolerance: 0.08,
      expectedValue: (a) => userReport(a).frequency,
      dimension: "metrics",
      weight: 5,
      explanation: "Frequency = impressions / reach.",
    },
    {
      id: "q3",
      kind: "text",
      prompt: "Як би ви перевірили інкрементальність ретаргетингу?",
      keywords: [["holdout", "контрольн", "lift", "інкремент"], ["частот"], ["атрибуц", "view"], ["бюджет", "проспект"]],
      minLength: 120,
      dimension: "argumentation",
      weight: 7,
      explanation: "Conversion lift / holdout-група — спосіб відокремити ефект реклами від органічних покупок.",
    },
  ],
  rubric: [
    { id: "obj", dimension: "objective", weight: 6, label: "Sales", pass: "Ціль Sales для ретаргетингу.", fail: "Ретаргетинг для магазину логічно запускати на Sales/Purchase.", check: objectiveIn(["sales"]) },
    {
      id: "incl",
      dimension: "audience",
      weight: 10,
      critical: true,
      label: "Включено відвідувачів/кошик",
      pass: "Включено ретаргетинг-аудиторії.",
      fail: "Не включено аудиторії відвідувачів або кошика.",
      check: adSetMatches((s) => s.audience.includedAudienceIds.some((id) => id === "aud_gl_site" || id === "aud_gl_atc")),
    },
    { id: "excl", dimension: "audience", weight: 9, critical: true, label: "Виключено покупців", pass: "Покупців виключено.", fail: "Покупців не виключено.", check: adSetMatches((s) => s.audience.excludedAudienceIds.includes("aud_gl_buyers")) },
    {
      id: "adv",
      dimension: "audience",
      weight: 7,
      label: "Advantage+ audience вимкнено",
      pass: "Аудиторії працюють як обмеження (Advantage+ audience вимкнено).",
      fail: "З Advantage+ audience custom-аудиторії — лише підказки: система може показувати рекламу холодній аудиторії.",
      check: adSetMatches((s) => !s.audience.advantageAudience),
    },
    {
      id: "msg",
      dimension: "creative",
      weight: 6,
      label: "Повідомлення-нагадування",
      pass: "Креатив звертається до тих, хто вже знайомий з магазином.",
      fail: "Креатив не відрізняється від холодної реклами.",
      check: (c) => {
        const ads = userAds(c.account);
        return ads.length && ads.some((ad) => /кошик|поверн|залиши|нагаду|ще думаєте|чекає/i.test(ad.creative.primaryText + ad.creative.headline)) ? 1 : 0;
      },
    },
    { id: "budget", dimension: "budget", weight: 7, critical: true, label: "≤ $15/день", pass: "Бюджет ретаргетингу пропорційний.", fail: "Бюджет ретаргетингу завеликий.", check: dailyBudgetAtMost(15) },
    {
      id: "untouched",
      dimension: "structure",
      weight: 4,
      label: "Проспектинг не змінено",
      pass: "Проспектинг не чіпали.",
      fail: "Змінено проспектинг-кампанію всупереч брифу.",
      check: (c) => (c.account.changeLog.some((e) => e.actor === "user" && seededIds(c.account).includes(e.entityId) && e.action === "update") ? 0 : 1),
    },
    { id: "days", dimension: "metrics", weight: 4, label: "7 днів", pass: "7 днів доставки.", fail: "Замало днів.", check: deliveryDaysAtLeast(7) },
    { id: "roas", dimension: "optimization", weight: 6, label: "ROAS ≥ 4", pass: "ROAS ретаргетингу в межах KPI.", fail: "ROAS ретаргетингу нижчий за 4.", check: (c) => kpiScore(userReport(c.account).roas, 4, "min") },
    { id: "freq", dimension: "optimization", weight: 5, label: "Частота ≤ 6", pass: "Частота під контролем.", fail: "Завелика частота на малій аудиторії.", check: (c) => kpiScore(userReport(c.account).frequency, 6, "max", 0.6) },
  ],
  caseStudyKeywords: [["ретаргет"], ["виключ", "покупц"], ["advantage"], ["частот"], ["інкремент", "lift"]],
  expert: {
    explanation:
      "Ретаргетинг — це окрема задача з малою аудиторією: важливо виключити покупців, контролювати частоту і не плутати атрибутований ROAS з реальним приростом. З увімкненим Advantage+ audience включені custom-аудиторії стають підказками, тож для строгого ретаргетингу їх використовують як обмеження.",
    alternative: "Альтернатива — не виділяти ретаргетинг окремо, а покладатися на Advantage+ sales campaign, що сама балансує нових і наявних клієнтів (з налаштуванням частки бюджету на existing customers, якщо доступно).",
  },
  recommendedArticles: ["audiences", "attribution", "advantage-plus"],
  skills: ["audience", "budget", "metrics"],
  createAccount: (id, _att, seed) => {
    let a = glynaAccount(id, seed, { name: "Місія 6 · «Глина» ретаргетинг" });
    a = glynaProspecting(a);
    return sealScenario(runHistory(a, 14));
  },
};

export const m07: MissionDefinition = {
  id: "m07",
  number: 7,
  title: "Перезапуск кампанії після падіння результатів",
  level: "middle",
  type: "optimize",
  summary: "CPL зріс удвічі за 3 тижні. Знайдіть причини в даних та журналі змін і відновіть ефективність.",
  estimatedMinutes: 40,
  brief: {
    business: "Pixel Path — школа UX/UI. Акаунт вели інший медіабаєр.",
    product: "Безкоштовна консультація → курс $650.",
    audience: "Київ, 22–35, інтереси «Графічний дизайн» і «Кар'єрний розвиток».",
    goal: "Повернути CPL до рівня перших тижнів.",
    budget: "До $40 на день.",
    conversionValue: "10% кваліфікованих лідів купують курс за $650",
    kpis: [{ label: "CPL за 7 днів після змін", target: "≤ 70% від CPL останніх 7 днів до змін" }],
    constraints: ["Не більше 3 суттєвих редагувань", "Не видаляти історичні дані", "Бюджет ≤ $40/день"],
    initialData: ["21 день історії, 1 набір, 1 креатив", "У журналі змін — кілька правок бюджету за тиждень", "Pixel з подією Lead працює коректно"],
    evaluation: ["Діагностика на основі даних (частота, CTR, CPM, журнал)", "Мінімальна кількість змін з максимальним ефектом", "Результат після перезапуску"],
  },
  minDeliveryDays: 7,
  tasks: [
    "Відкрийте Analytics: подивіться динаміку CTR, CPM, частоти й CPL по днях.",
    "Перевірте журнал змін.",
    "Внесіть зміни: нові креативи, ширша аудиторія — без зайвих правок бюджету.",
    "Симулюйте щонайменше 7 днів і порівняйте з періодом до змін.",
  ],
  questions: [
    {
      id: "q1",
      kind: "multi",
      prompt: "Які причини погіршення підтверджуються даними?",
      options: [
        { id: "a", text: "Вигорання креативу: висока частота і падіння CTR" },
        { id: "b", text: "Скидання навчальної фази через часті суттєві зміни бюджету" },
        { id: "c", text: "Насичення вузької аудиторії (зростання CPM)" },
        { id: "d", text: "Зламався Pixel" },
        { id: "e", text: "Сезонне зростання конкуренції в аукціоні" },
      ],
      correct: ["a", "b", "c"],
      evidenceQuestionId: "q2",
      askConfidence: true,
      dimension: "metrics",
      weight: 9,
      explanation: "Pixel працює (ліди фіксуються), ринкових подій у симуляції не було.",
    },
    {
      id: "q2",
      kind: "text",
      prompt: "Наведіть докази з даних: які метрики й записи журналу підтверджують ваші висновки?",
      keywords: [["частот", "frequency"], ["ctr"], ["cpm"], ["журнал", "бюджет", "learning", "навчан"], ["cpl"]],
      minLength: 160,
      dimension: "argumentation",
      weight: 9,
      explanation: "Порівнюйте метрики по тижнях і зіставляйте з датами змін.",
    },
    {
      id: "q3",
      kind: "number",
      prompt: "Яка частота набору за останні 7 днів до ваших змін?",
      tolerance: 0.1,
      expectedValue: (a) => preFix(a).frequency,
      dimension: "metrics",
      weight: 6,
      explanation: "Frequency = impressions / reach за обраний період.",
    },
  ],
  rubric: [
    {
      id: "newcr",
      dimension: "creative",
      weight: 10,
      critical: true,
      label: "≥ 2 нові креативи",
      pass: "Додано нові креативи з іншими візуалами.",
      fail: "Нових креативів недостатньо — вигорання не усунуто.",
      check: (c) => {
        const keys = new Set(userAds(c.account).map((a) => a.creative.media[0]?.libraryKey ?? a.creative.media[0]?.id));
        keys.delete("edu_results_45");
        return Math.min(1, keys.size / 2);
      },
    },
    {
      id: "broad",
      dimension: "audience",
      weight: 8,
      label: "Аудиторію розширено",
      pass: "Аудиторія активних наборів суттєво ширша.",
      fail: "Аудиторія лишилась вузькою — насичення триватиме.",
      check: (c) => {
        const sets = activeAdSets(c.account);
        if (!sets.length) return 0;
        const size = Math.max(...sets.map((s) => estimateAudience(c.account, s.audience).size));
        return size >= 400_000 ? 1 : size >= 200_000 ? 0.5 : 0;
      },
    },
    {
      id: "edits",
      dimension: "optimization",
      weight: 7,
      label: "≤ 3 суттєві зміни",
      pass: "Зміни зібрано разом — один перезапуск навчання.",
      fail: "Забагато суттєвих правок — навчальна фаза скидається знову і знову.",
      check: (c) => {
        const n = significantUserEdits(c.account, c.account.handoverDay);
        return n <= 3 ? 1 : n <= 5 ? 0.5 : 0;
      },
    },
    { id: "budget", dimension: "budget", weight: 5, label: "≤ $40/день", pass: "Бюджет у межах.", fail: "Перевищено бюджет.", check: (c) => (dailyBudgetActive(c.account) <= 40.01 ? 1 : 0) },
    { id: "days", dimension: "metrics", weight: 5, label: "7 днів після змін", pass: "Достатньо днів після змін.", fail: "Замало днів після змін для порівняння.", check: (c) => Math.min(1, postFixDays(c.account) / 7) },
    {
      id: "kpi",
      dimension: "optimization",
      weight: 10,
      label: "CPL ≤ 70% від попереднього",
      pass: "CPL після змін суттєво знизився.",
      fail: "CPL після змін не покращився достатньо.",
      check: (c) => {
        const before = preFix(c.account).cpl;
        const after = postFix(c.account).cpl;
        if (!before || !after) return 0;
        return kpiScore(after, before * 0.7, "max");
      },
    },
    { id: "policy", dimension: "policy", weight: 4, label: "Без відхилень", pass: "Нові оголошення схвалені.", fail: "Є відхилені оголошення.", check: noRejectedAds },
  ],
  caseStudyKeywords: [["частот", "вигоран"], ["ctr"], ["навчан", "learning"], ["аудитор"], ["креатив"], ["порівн", "до", "після"]],
  expert: {
    explanation:
      "Класичний патерн: один креатив + вузька аудиторія → частота росте, CTR падає, CPM росте; часті правки бюджету понад ~20% додатково скидають навчання. Рішення — оновити креативи (кілька різних кутів), розширити аудиторію (Advantage+ audience або ширші інтереси), зробити зміни одним пакетом і дати системі 5–7 днів.",
    alternative: "Можна дублювати набір з новими креативами й широкою аудиторією, а старий поступово вимкнути — так зберігається історія для порівняння.",
  },
  recommendedArticles: ["optimization", "learning-phase", "creative-strategy", "diagnostics-playbook"],
  skills: ["metrics", "optimization", "creative"],
  createAccount: (id, _att, seed) => sealScenario(fatigueScenario(pixelPathAccount(id, seed, { name: "Місія 7 · Pixel Path (падіння)" }))),
};

function dailyBudgetActive(a: AdAccount): number {
  let d = 0;
  for (const c of a.campaigns.filter((x) => x.status === "active")) {
    if (c.budgetLevel === "campaign") d += c.budgetType === "daily" ? c.budgetAmount : c.budgetAmount / 14;
    else for (const s of a.adSets.filter((x) => x.campaignId === c.id && x.status === "active")) d += s.budgetType === "daily" ? s.budgetAmount : s.budgetAmount / 14;
  }
  return d;
}

export const m08: MissionDefinition = {
  id: "m08",
  number: 8,
  title: "Пошук причин дорогого ліда",
  level: "middle",
  type: "analyze",
  summary: "Ліди коштують утричі дорожче за KPI. Знайдіть причини в структурі й налаштуваннях та виправте.",
  estimatedMinutes: 40,
  brief: {
    business: "Speakly Lab — онлайн-школа англійської.",
    product: "Безкоштовний пробний урок.",
    audience: "Дорослі, які хочуть розмовну англійську.",
    goal: "Знизити CPL без втрати якості.",
    budget: "До $30 на день (як і зараз).",
    conversionValue: "15% лідів стають студентами, чек $220",
    kpis: [{ label: "CPL після змін (7 днів)", target: "≤ 60% від CPL за останні 7 днів до змін" }],
    constraints: ["Загальний бюджет не більше $30/день", "Сайт і офер не змінюються"],
    initialData: ["14 днів історії, 5 наборів по $6/день", "Pixel з подією Lead працює", "Сайт швидкий"],
    evaluation: ["Правильна діагностика (оптимізація, структура, аудиторія)", "Консолідація", "Результат після змін"],
  },
  minDeliveryDays: 7,
  tasks: ["Проаналізуйте структуру кампанії й цілі ефективності наборів.", "Виправте оптимізацію та структуру (консолідуйте набори).", "Симулюйте 7 днів і порівняйте CPL."],
  questions: [
    {
      id: "q1",
      kind: "multi",
      prompt: "Які причини дорогого ліда підтверджуються налаштуваннями та даними?",
      options: [
        { id: "a", text: "Набори оптимізуються на Landing page views, а не на подію Lead" },
        { id: "b", text: "Бюджет розпорошено на 5 дрібних наборів" },
        { id: "c", text: "Аудиторії наборів перетинаються та вузькі; вік поза ядром ЦА" },
        { id: "d", text: "Повільний сайт" },
        { id: "e", text: "Bid cap занадто низький" },
      ],
      correct: ["a", "b", "c"],
      evidenceQuestionId: "q2",
      askConfidence: true,
      dimension: "metrics",
      weight: 9,
      explanation: "Сайт швидкий, bid cap не використовується — ці гіпотези дані не підтверджують.",
    },
    {
      id: "q2",
      kind: "text",
      prompt: "Обґрунтуйте діагноз даними: cost per result, CPL, частка лідів від LPV, розмір аудиторій.",
      keywords: [["lpv", "landing"], ["lead", "лід", "cpl"], ["набор", "структур", "розпорош", "консолід"], ["аудитор", "перетин"]],
      minLength: 160,
      dimension: "argumentation",
      weight: 9,
      explanation: "Дешевий «результат» (LPV) не означає дешевого ліда.",
    },
    {
      id: "q3",
      kind: "number",
      prompt: "Який був CPL до ваших змін (за 14 днів історії)?",
      tolerance: 0.05,
      expectedValue: (a) => reportFor(asOfHandover(a), { toDay: a.handoverDay - 1 }).cpl,
      unit: "$",
      dimension: "metrics",
      weight: 6,
      explanation: "CPL = spend / leads.",
    },
  ],
  rubric: [
    {
      id: "event",
      dimension: "optimization",
      weight: 10,
      critical: true,
      label: "Оптимізація на Lead",
      pass: "Активні набори оптимізуються на подію Lead.",
      fail: "Активні набори досі не оптимізуються на Lead.",
      check: (c) => {
        const sets = activeAdSets(c.account);
        if (!sets.length) return 0;
        return sets.filter((s) => s.performanceGoal === "conversions" && s.optimizationEvent === "Lead").length / sets.length;
      },
    },
    {
      id: "consol",
      dimension: "structure",
      weight: 8,
      label: "≤ 2 активні набори",
      pass: "Структуру консолідовано.",
      fail: "Бюджет усе ще розпорошено між багатьма наборами.",
      check: (c) => {
        const n = activeAdSets(c.account).length;
        return n >= 1 && n <= 2 ? 1 : n === 3 ? 0.5 : 0;
      },
    },
    {
      id: "aud",
      dimension: "audience",
      weight: 7,
      label: "Ширша аудиторія",
      pass: "Аудиторія активних наборів широка.",
      fail: "Аудиторія лишилась вузькою.",
      check: (c) => {
        const sets = activeAdSets(c.account);
        if (!sets.length) return 0;
        const min = Math.min(...sets.map((s) => estimateAudience(c.account, s.audience).size));
        return min >= 1_000_000 ? 1 : min >= 400_000 ? 0.5 : 0;
      },
    },
    { id: "budget", dimension: "budget", weight: 6, critical: true, label: "≤ $30/день", pass: "Бюджет у межах.", fail: "Перевищено бюджет $30/день.", check: (c) => (dailyBudgetActive(c.account) <= 30.01 ? 1 : 0) },
    { id: "days", dimension: "metrics", weight: 5, label: "7 днів після змін", pass: "7 днів після змін.", fail: "Замало днів після змін.", check: (c) => Math.min(1, postFixDays(c.account) / 7) },
    {
      id: "kpi",
      dimension: "optimization",
      weight: 10,
      label: "CPL ≤ 60% від попереднього",
      pass: "CPL після змін знизився щонайменше на 40%.",
      fail: "CPL після змін знизився недостатньо.",
      check: (c) => {
        const before = preFix(c.account).cpl;
        const after = postFix(c.account).cpl;
        return before && after ? kpiScore(after, before * 0.6, "max") : 0;
      },
    },
  ],
  caseStudyKeywords: [["lead", "лід"], ["lpv", "оптиміз"], ["консолід", "структур"], ["аудитор"], ["cpl"]],
  expert: {
    explanation:
      "Оптимізація на LPV знаходить людей, які переходять на сайт, але не обов'язково залишають заявку. П'ять наборів по $6 ділять і без того малий бюджет, а перетин аудиторій змушує набори конкурувати. Консолідація в 1–2 набори з оптимізацією на Lead і ширшою аудиторією дає системі більше сигналів.",
    alternative: "Якщо подій Lead менше ~50 на тиждень навіть після консолідації, можна тимчасово використати подію вище у воронці (наприклад, перегляд сторінки реєстрації), але оцінювати все одно за CPL.",
  },
  recommendedArticles: ["campaign-structure", "learning-phase", "diagnostics-playbook"],
  skills: ["structure", "optimization", "audience"],
  createAccount: (id, _att, seed) => sealScenario(expensiveLeadScenario(speaklyAccount(id, seed, { name: "Місія 8 · Speakly (дорогий лід)" }))),
};

export const m09: MissionDefinition = {
  id: "m09",
  number: 9,
  title: "Аналіз низького CTR",
  level: "junior",
  type: "analyze",
  summary: "Кампанія майже не отримує кліків. Розберіться, що саме не так із креативами та форматами, і створіть кращі оголошення.",
  estimatedMinutes: 30,
  brief: {
    business: "Excel Pro — міні-курс з Excel.",
    product: "Курс за $49.",
    audience: "22–45, Україна.",
    goal: "Підняти CTR і знизити вартість переходу.",
    budget: "$20 на день.",
    conversionValue: "$49",
    kpis: [{ label: "CTR нових оголошень", target: "≥ 2× від CTR старих" }],
    constraints: ["Набір і бюджет не змінюйте суттєво — працюйте з креативами і форматами"],
    initialData: ["7 днів історії", "Плейсменти: лише Stories і Reels", "2 оголошення: банер і запис вебінару 16:9"],
    evaluation: ["Діагностика креативних причин", "Нові оголошення під формати", "CTR після змін"],
  },
  minDeliveryDays: 5,
  tasks: ["Відкрийте попередній перегляд оголошень у Stories/Reels.", "Створіть 1–2 нові оголошення з вертикальним медіа і чітким текстом.", "Вимкніть слабкі оголошення та симулюйте 5+ днів."],
  questions: [
    {
      id: "q1",
      kind: "multi",
      prompt: "Що найімовірніше знижує CTR?",
      options: [
        { id: "a", text: "Текст капсом зі знаками оклику — сприймається як спам" },
        { id: "b", text: "Горизонтальне 16:9 довге відео у вертикальних Stories/Reels" },
        { id: "c", text: "CTA «Watch more» не відповідає меті переходу на сторінку курсу" },
        { id: "d", text: "Аудиторія завелика" },
        { id: "e", text: "Бюджет замалий" },
      ],
      correct: ["a", "b", "c"],
      evidenceQuestionId: "q2",
      askConfidence: true,
      dimension: "creative",
      weight: 9,
      explanation: "Широка аудиторія і бюджет $20/день не є причинами низького CTR.",
    },
    {
      id: "q2",
      kind: "text",
      prompt: "Поясніть зв'язок між форматом медіа, плейсментами і CTR на прикладі цієї кампанії.",
      keywords: [["9:16", "вертикал"], ["stories", "reels"], ["ctr"], ["текст", "капс", "заголов"], ["cta"]],
      minLength: 140,
      dimension: "argumentation",
      weight: 8,
      explanation: "Медіа має заповнювати екран у вертикальних плейсментах, а перші секунди — чіпляти.",
    },
    {
      id: "q3",
      kind: "number",
      prompt: "Який CTR (link) вихідної кампанії за 7 днів, %?",
      tolerance: 0.06,
      expectedValue: (a) => reportFor(a, { campaignIds: seededIds(a), toDay: a.handoverDay - 1 }).ctrLink,
      unit: "%",
      dimension: "metrics",
      weight: 6,
      explanation: "CTR (link) = link clicks / impressions × 100%.",
    },
  ],
  rubric: [
    {
      id: "newad",
      dimension: "creative",
      weight: 10,
      critical: true,
      label: "Нове якісне оголошення",
      pass: "Створено оголошення з високою оцінкою якості креативу.",
      fail: "Немає нового якісного оголошення.",
      check: (c) => {
        const a = c.account;
        const ads = userAds(a);
        if (!ads.length) return 0;
        const best = Math.max(
          ...ads.map((ad) => {
            const s = a.adSets.find((x) => x.id === ad.adSetId)!;
            const camp = a.campaigns.find((x) => x.id === ad.campaignId)!;
            return assessCreative(ad, { campaign: camp, adSet: s, landing: a.landingPage }).quality;
          }),
        );
        return best >= 0.7 ? 1 : best >= 0.6 ? 0.5 : 0;
      },
    },
    {
      id: "fit",
      dimension: "creative",
      weight: 7,
      label: "Медіа під вертикальні плейсменти",
      pass: "Нові оголошення мають 9:16 медіа.",
      fail: "Нові оголошення не адаптовані під Stories/Reels.",
      check: (c) => {
        const ads = userAds(c.account);
        return ads.length && ads.some((ad) => ad.creative.media[0]?.aspectRatio === "9:16" || ad.creative.verticalMedia) ? 1 : 0;
      },
    },
    {
      id: "paused",
      dimension: "optimization",
      weight: 6,
      label: "Слабкі оголошення вимкнено",
      pass: "Слабкі оголошення вимкнено.",
      fail: "Старі слабкі оголошення досі забирають покази.",
      check: (c) => {
        const old = c.account.ads.filter((a) => a.seq <= c.account.seededSeq);
        return old.length ? old.filter((a) => a.status === "paused").length / old.length : 0;
      },
    },
    {
      id: "ctr",
      dimension: "metrics",
      weight: 10,
      label: "CTR ×2",
      pass: "CTR нових оголошень щонайменше вдвічі вищий.",
      fail: "CTR не зріс удвічі.",
      check: (c) => {
        const a = c.account;
        const before = reportFor(a, { campaignIds: seededIds(a), toDay: a.handoverDay - 1 }).ctrLink;
        const newIds = new Set(userAds(a).map((x) => x.id));
        const rows = a.metrics.filter((m) => newIds.has(m.adId));
        const after = rows.length ? aggregate(a, rows).ctrLink : null;
        if (!before || !after) return 0;
        return kpiScore(after, before * 2, "min");
      },
    },
    { id: "days", dimension: "metrics", weight: 4, label: "5 днів", pass: "5+ днів після змін.", fail: "Замало днів після змін.", check: (c) => Math.min(1, postFixDays(c.account) / 5) },
    { id: "policy", dimension: "policy", weight: 4, label: "Без відхилень", pass: "Нові оголошення схвалені.", fail: "Є відхилені оголошення.", check: noRejectedAds },
  ],
  caseStudyKeywords: [["ctr"], ["креатив", "медіа"], ["9:16", "вертикал", "stories", "reels"], ["текст", "заголов", "cta"]],
  expert: {
    explanation:
      "Низький CTR тут — наслідок трьох креативних рішень: спамний текст, горизонтальне довге відео у вертикальних плейсментах і CTA, що не веде до дії. Новий креатив має «працювати» без звуку в перші 2–3 секунди, займати весь екран і мати зрозумілу користь у тексті.",
    alternative: "Можна також увімкнути Advantage+ placements, щоб квадратні й 4:5 креативи отримали покази в стрічках — але спершу виправте сам креатив.",
  },
  recommendedArticles: ["creative-strategy", "placements", "analytics-metrics"],
  skills: ["creative", "metrics"],
  createAccount: (id, _att, seed) => sealScenario(lowCtrScenario(excelProAccount(id, seed, { name: "Місія 9 · Excel Pro (низький CTR)" }))),
};

/** Для m10: результат тесту двох найбільших оголошень у кампанії з A/B тестом. */
export function abTestVerdict(a: AdAccount): string[] {
  const camp = publishedUserCampaigns(a).find((c) => c.abTest?.enabled);
  if (!camp) return ["none"];
  const ads = a.ads.filter((x) => x.campaignId === camp.id).sort((x, y) => x.seq - y.seq);
  if (ads.length < 2) return ["none"];
  const [A, B] = ads;
  const ra = aggregate(a, a.metrics.filter((m) => m.adId === A.id));
  const rb = aggregate(a, a.metrics.filter((m) => m.adId === B.id));
  const t = twoProportionZTest(ra.linkClicks, ra.impressions, rb.linkClicks, rb.impressions);
  if (!t || t.pValue >= 0.05) return ["none"];
  return [(ra.ctrLink ?? 0) > (rb.ctrLink ?? 0) ? "a" : "b"];
}

export const m10: MissionDefinition = {
  id: "m10",
  number: 10,
  title: "Побудова тесту креативів",
  level: "middle",
  type: "build",
  summary: "Сплануйте й проведіть коректний A/B тест креативів із гіпотезою і статистичною перевіркою.",
  estimatedMinutes: 40,
  brief: {
    business: "«Глина» — магазин кераміки.",
    product: "Набори чашок.",
    audience: "Широка аудиторія UA 25–55.",
    goal: "Дізнатися, який креативний підхід (UGC-відео чи lifestyle-фото) дає кращий результат.",
    budget: "До $50 на день, 10 днів.",
    conversionValue: "$42",
    margin: "45%",
    kpis: [{ label: "Валідний тест", target: "одна змінна, гіпотеза, ≥ 10 днів, ≥ 1 000 кліків" }],
    constraints: ["Не редагувати кампанію під час тесту", "Однакова аудиторія для варіантів"],
    initialData: ["Pixel + CAPI з дедуплікацією", "Креативи в бібліотеці: UGC-відео, lifestyle, товар"],
    evaluation: ["Коректність дизайну тесту", "Дисципліна (без правок)", "Інтерпретація результату з урахуванням значущості"],
  },
  minDeliveryDays: 10,
  tasks: [
    "Створіть кампанію Sales, увімкніть A/B тест зі змінною «Креатив» і сформулюйте гіпотезу «Якщо…, то…».",
    "Один набір, 2 оголошення, що відрізняються лише креативом (текст однаковий).",
    "Симулюйте 10 днів без змін і зробіть висновок.",
  ],
  questions: [
    {
      id: "q1",
      kind: "single",
      prompt: "Чи є статистично значуща різниця в CTR між першим (A) і другим (B) оголошенням (p < 0.05)?",
      options: [
        { id: "a", text: "Так, виграв варіант A" },
        { id: "b", text: "Так, виграв варіант B" },
        { id: "none", text: "Ні, різниця незначуща" },
      ],
      correctFn: abTestVerdict,
      evidenceQuestionId: "q2",
      askConfidence: true,
      dimension: "metrics",
      weight: 10,
      explanation: "Використовуйте блок «Порівняння оголошень» в Analytics: там наведено z-тест для CTR.",
    },
    {
      id: "q2",
      kind: "text",
      prompt: "Наведіть числа: CTR, кліки, покази варіантів, p-value. Яке рішення ухвалите?",
      keywords: [["ctr"], ["p-value", "p =", "значущ", "z-тест", "z тест"], ["кліки", "показ"], ["cpa", "покуп", "roas"]],
      minLength: 160,
      dimension: "argumentation",
      weight: 9,
      explanation: "Рішення має враховувати і значущість, і бізнес-метрику (CPA/ROAS).",
    },
    {
      id: "q3",
      kind: "single",
      prompt: "Яка метрика має бути головною для рішення в кампанії Sales?",
      options: [
        { id: "ctr", text: "CTR — він найшвидше набирає значущість" },
        { id: "cpa", text: "Cost per purchase / ROAS, а CTR — допоміжний сигнал" },
        { id: "cpm", text: "CPM" },
      ],
      correct: ["cpa"],
      dimension: "metrics",
      weight: 6,
      explanation: "Вищий CTR не гарантує нижчий CPA.",
    },
  ],
  rubric: [
    { id: "ab", dimension: "structure", weight: 10, critical: true, label: "A/B тест креативу", pass: "Увімкнено A/B тест зі змінною «Креатив».", fail: "A/B тест креативу не налаштовано.", check: (c) => (publishedUserCampaigns(c.account).some((x) => x.abTest?.enabled && x.abTest.variable === "creative") ? 1 : 0) },
    {
      id: "hyp",
      dimension: "argumentation",
      weight: 7,
      label: "Гіпотеза",
      pass: "Гіпотеза сформульована з очікуваним ефектом і метрикою.",
      fail: "Гіпотеза відсутня або без метрики.",
      check: (c) => {
        const h = publishedUserCampaigns(c.account).find((x) => x.abTest?.enabled)?.abTest?.hypothesis ?? "";
        return reasoningScore(h, [["якщо"], ["то"], ["ctr", "cpa", "roas", "покуп", "вартість"]], 60);
      },
    },
    {
      id: "oneset",
      dimension: "structure",
      weight: 6,
      label: "Один набір, 2–3 оголошення",
      pass: "Варіанти в одному наборі з однаковою аудиторією.",
      fail: "Варіанти мають бути в одному наборі (2–3 оголошення).",
      check: (c) => {
        const camp = publishedUserCampaigns(c.account).find((x) => x.abTest?.enabled);
        if (!camp) return 0;
        const sets = c.account.adSets.filter((s) => s.campaignId === camp.id);
        const n = c.account.ads.filter((a) => a.campaignId === camp.id).length;
        return sets.length === 1 && n >= 2 && n <= 3 ? 1 : 0.3;
      },
    },
    {
      id: "onevar",
      dimension: "creative",
      weight: 6,
      label: "Одна змінна",
      pass: "Варіанти відрізняються лише медіа.",
      fail: "Варіанти відрізняються не лише медіа (текст/заголовок) — тест змішує змінні.",
      check: (c) => {
        const camp = publishedUserCampaigns(c.account).find((x) => x.abTest?.enabled);
        if (!camp) return 0;
        const ads = c.account.ads.filter((a) => a.campaignId === camp.id);
        if (ads.length < 2) return 0;
        const sameText = ads.every((a) => a.creative.primaryText === ads[0].creative.primaryText && a.creative.headline === ads[0].creative.headline);
        const diffMedia = new Set(ads.map((a) => a.creative.media[0]?.libraryKey ?? a.creative.media[0]?.id)).size === ads.length;
        return sameText && diffMedia ? 1 : diffMedia ? 0.4 : 0;
      },
    },
    { id: "noedit", dimension: "optimization", weight: 7, label: "Без правок під час тесту", pass: "Під час тесту не було суттєвих змін.", fail: "Під час тесту вносились суттєві зміни — результат змішаний.", check: (c) => (significantUserEdits(c.account) === 0 ? 1 : 0) },
    { id: "days", dimension: "metrics", weight: 5, label: "≥ 10 днів", pass: "Тест тривав 10+ днів.", fail: "Тест закороткий.", check: deliveryDaysAtLeast(10) },
    { id: "vol", dimension: "metrics", weight: 5, label: "≥ 1000 кліків", pass: "Достатній обсяг кліків.", fail: "Замало кліків для висновку.", check: (c) => Math.min(1, userReport(c.account).linkClicks / 1000) },
    { id: "budget", dimension: "budget", weight: 5, label: "≤ $50/день", pass: "Бюджет у межах.", fail: "Перевищено бюджет.", check: dailyBudgetAtMost(50) },
    { id: "ads", dimension: "creative", weight: 3, label: "2+ оголошення", pass: "Є варіанти для порівняння.", fail: "Менше двох оголошень.", check: minAdsPerAdSet(2) },
    { id: "media", dimension: "creative", weight: 3, label: "Різні медіа", pass: "Різні креативні підходи.", fail: "Однакові медіа.", check: distinctMediaAtLeast(2) },
  ],
  caseStudyKeywords: [["гіпотез"], ["a/b", "тест"], ["значущ", "p-value"], ["ctr"], ["cpa", "roas"], ["рішен", "наступн"]],
  expert: {
    explanation:
      "Коректний тест змінює одну змінну, має гіпотезу й метрику успіху, триває достатньо довго й не редагується по ходу. Значущість CTR набирається швидше, ніж значущість CPA, тому рішення часто ухвалюють поетапно: спершу відсіюють явно слабкі креативи за CTR/CPC, потім підтверджують за CPA.",
    alternative: "Для креативних тестів у реальних акаунтах також доступний інструмент Experiments з розподілом аудиторії; у симуляторі A/B режим рівномірно ділить покази між варіантами.",
  },
  recommendedArticles: ["ab-testing", "creative-strategy", "analytics-metrics"],
  skills: ["structure", "metrics", "argumentation"],
  createAccount: (id, _att, seed) => sealScenario(glynaAccount(id, seed, { name: "Місія 10 · «Глина» A/B тест" })),
};
