import { buildCampaign, libMedia, runHistory, sealScenario } from "@/domain/account-builder";
import { updateAd, updateAdSet } from "@/domain/operations";
import type { AdAccount, LearningLevel } from "@/domain/types";
import { glynaAccount, pixelPathAccount, speaklyAccount, excelProAccount } from "../missions/businesses";
import { broad, glynaProspecting, leadsNoUtmScenario, manual, UTM } from "../scenarios";

export interface ErrorLabCase {
  id: string;
  title: string;
  level: LearningLevel;
  symptoms: string[];
  context: string;
  /** Що варто відкрити в кабінеті. */
  whereToLook: string[];
  causes: { id: string; text: string; correct: boolean; explanation: string }[];
  evidence: { id: string; text: string; relevant: boolean }[];
  /** Наскільки впевнено можна ставити діагноз на цих даних (пояснення). */
  diagnosticConfidence: { level: "висока" | "середня" | "низька"; reason: string };
  checks: string[];
  explanation: string;
  articleSlugs: string[];
  createAccount: (accountId: string, seed: number) => AdAccount;
}

const lab = (a: AdAccount, caseId: string): AdAccount => sealScenario({ ...a, kind: "error_lab", errorLabCaseId: caseId, readOnly: true });

export const ERROR_LAB_CASES: ErrorLabCase[] = [
  {
    id: "e01",
    title: "Багато кліків, майже немає продажів",
    level: "beginner",
    symptoms: ["Кампанія за тиждень отримала тисячі кліків за $0.05", "Власник магазину не бачить зростання продажів", "У колонці Results — сотні результатів"],
    context: "Магазин кераміки запустив рекламу «щоб продавати». Налаштовував знайомий.",
    whereToLook: ["Ads Manager → ціль кампанії і ціль ефективності набору", "Analytics → воронка: кліки → LPV → покупки", "Breakdown за плейсментами"],
    causes: [
      { id: "wrong_objective", text: "Для продажів обрано Traffic з оптимізацією на link clicks", correct: true, explanation: "Система шукає людей, які клікають, а не купують." },
      { id: "an", text: "Більшість кліків з Audience Network, де багато випадкових переходів", correct: true, explanation: "Низька частка LPV від кліків на AN — ознака неякісного трафіку." },
      { id: "pixel", text: "Pixel не встановлено", correct: false, explanation: "Pixel працює: LPV і покупки фіксуються." },
      { id: "price", text: "Завищена ціна товару", correct: false, explanation: "Дані не дають підстав для такого висновку — проблема виникає раніше у воронці." },
    ],
    evidence: [
      { id: "goal", text: "Ціль ефективності набору — Link clicks", relevant: true },
      { id: "lpv_rate", text: "Частка LPV від link clicks значно нижча за 50%", relevant: true },
      { id: "placement", text: "Breakdown: найбільше кліків з Audience Network", relevant: true },
      { id: "cpm", text: "CPM вищий за середній ринковий", relevant: false },
    ],
    diagnosticConfidence: { level: "висока", reason: "Налаштування однозначно не відповідають цілі, а воронка підтверджує втрати між кліком і сайтом." },
    checks: ["Ціль кампанії відповідає бізнес-цілі?", "Яка ціль ефективності набору?", "Частка LPV від link clicks", "Розподіл кліків за плейсментами", "Скільки покупок атрибутовано / в бекенді"],
    explanation: "Traffic + link clicks оптимізує саме кліки. З Advantage+/ручними плейсментами з AN система знаходить дешеві випадкові кліки. Для продажів — Sales з подією Purchase.",
    articleSlugs: ["campaign-objectives", "placements"],
    createAccount: (id, seed) => {
      let a = glynaAccount(id, seed, { name: "Error Lab · Кліки без продажів" });
      a = buildCampaign(a, {
        objective: "traffic",
        campaign: { name: "Продажі (Traffic)", budgetLevel: "campaign", budgetAmount: 40 },
        adSets: [
          {
            adSet: { name: "UA · кліки", conversionLocation: "website", performanceGoal: "link_clicks", audience: broad("UA"), placements: { mode: "manual", selected: ["audience_network", "facebook_feed", "instagram_feed"] } },
            ads: [{ name: "Знижка банер", creative: { media: [libMedia("shop_product_square")], primaryText: "Кераміка ручної роботи. Купуйте зараз.", headline: "Кераміка «Глина»", cta: "SHOP_NOW", urlParameters: UTM } }],
          },
        ],
      });
      return lab(runHistory(a, 7), "e01");
    },
  },
  {
    id: "e02",
    title: "Дешеві «результати», дорогі покупки",
    level: "junior",
    symptoms: ["Cost per result — $0.60", "Покупок мало, CPA $45 при чеку $42", "Кампанія Sales"],
    context: "Медіабаєр звітує «чудовими результатами», власник незадоволений.",
    whereToLook: ["Подія оптимізації набору", "Колонки Results vs Purchases", "Воронка ViewContent → AddToCart → Purchase"],
    causes: [
      { id: "event", text: "Оптимізація на ViewContent замість Purchase", correct: true, explanation: "Results = перегляди контенту, а не покупки." },
      { id: "audience", text: "Занадто широка аудиторія", correct: false, explanation: "Широка аудиторія працює, коли подія оптимізації правильна." },
      { id: "creative", text: "Слабкий креатив", correct: false, explanation: "CTR у нормі." },
    ],
    evidence: [
      { id: "ev", text: "Optimization event = ViewContent", relevant: true },
      { id: "results_vs", text: "Results у десятки разів більше за Purchases", relevant: true },
      { id: "ctr", text: "CTR > 1%", relevant: false },
    ],
    diagnosticConfidence: { level: "висока", reason: "Подія оптимізації видно в налаштуваннях; колонка Results показує інший тип дії." },
    checks: ["Подія оптимізації", "Що саме рахує колонка Results", "Скільки Purchase атрибутовано", "Чи вистачає Purchase для навчання (~50/тиждень)"],
    explanation: "Колонка Results завжди показує результат за ціллю оптимізації. Дешевий ViewContent не означає дешевої покупки. Перехід на Purchase або (за браку даних) на InitiateCheckout наближає оптимізацію до бізнес-цілі.",
    articleSlugs: ["events-manager", "campaign-objectives"],
    createAccount: (id, seed) => {
      let a = glynaAccount(id, seed, { name: "Error Lab · Не та подія" });
      a = buildCampaign(a, {
        objective: "sales",
        campaign: { name: "Sales · Conversions", budgetLevel: "campaign", budgetAmount: 45 },
        adSets: [
          {
            adSet: { name: "UA · ViewContent", conversionLocation: "website", performanceGoal: "conversions", optimizationEvent: "ViewContent", audience: broad("UA") },
            ads: [{ name: "UGC відео", creative: { media: [libMedia("shop_ugc_916")], primaryText: "Кераміка ручної роботи для дому.", headline: "Кераміка «Глина»", cta: "SHOP_NOW", urlParameters: UTM } }],
          },
        ],
      });
      return lab(runHistory(a, 10), "e02");
    },
  },
  {
    id: "e03",
    title: "Ліди є в CRM, але не в кабінеті",
    level: "junior",
    symptoms: ["Leads у кабінеті — 0", "Набір у статусі Learning limited", "Менеджери отримують заявки з сайту"],
    context: "Нова версія сайту запущена тиждень тому.",
    whereToLook: ["Events Manager: які події надходять", "Попередження в наборі", "Meta vs CRM в Analytics"],
    causes: [
      { id: "lead_missing", text: "Подія Lead не спрацьовує на сторінці подяки після оновлення сайту", correct: true, explanation: "Pixel надсилає PageView, але не Lead." },
      { id: "attribution", text: "Занадто коротке вікно атрибуції", correct: false, explanation: "Навіть 1-day click показав би хоча б частину лідів." },
      { id: "audience", text: "Неправильна аудиторія", correct: false, explanation: "Ліди в CRM є — аудиторія конвертується." },
    ],
    evidence: [
      { id: "events", text: "У Events Manager немає події Lead", relevant: true },
      { id: "crm", text: "CRM фіксує ліди з UTM цієї кампанії", relevant: true },
      { id: "learning", text: "Набір: Learning limited", relevant: true },
      { id: "freq", text: "Частота 1.4", relevant: false },
    ],
    diagnosticConfidence: { level: "висока", reason: "Розбіжність 0 vs N та відсутність події в датасеті однозначно вказують на трекінг." },
    checks: ["Events Manager → активні події", "Test Events для сторінки подяки", "Порівняння CRM і кабінету по днях", "Дата релізу сайту vs дата падіння"],
    explanation: "Без події Lead система не бачить результатів: не може оптимізуватись (Learning limited) і не показує ліди у звітах. Виправлення — встановити подію на сторінці подяки або надсилати її через CAPI.",
    articleSlugs: ["events-manager", "pixel-capi", "learning-phase"],
    createAccount: (id, seed) => {
      let a = speaklyAccount(id, seed, { name: "Error Lab · Відсутня подія Lead", tracking: { pixel: { installed: true, id: "px_e03", events: ["PageView", "ViewContent"], duplicateBrowserEvents: false } } });
      a = buildCampaign(a, {
        objective: "leads",
        campaign: { name: "Ліди · Пробний урок", budgetLevel: "campaign", budgetAmount: 25 },
        adSets: [
          {
            adSet: { name: "UA · Lead", conversionLocation: "website", performanceGoal: "conversions", optimizationEvent: "Lead", audience: broad("UA") },
            ads: [{ name: "Пробний урок", creative: { media: [libMedia("edu_mentor_square")], primaryText: "Безкоштовний пробний урок англійської з викладачем.", headline: "Пробний урок", cta: "SIGN_UP", urlParameters: UTM } }],
          },
        ],
      });
      return lab(runHistory(a, 8), "e03");
    },
  },
  {
    id: "e04",
    title: "GA4 і CRM не бачать рекламу",
    level: "junior",
    symptoms: ["У кабінеті все стабільно", "У CRM 85% лідів — «(not set)/direct»", "UTM у оголошеннях «є»"],
    context: "Таргетолог каже, що UTM додано, але аналітик не бачить кампанію.",
    whereToLook: ["Ads Manager → оголошення → URL parameters", "Фінальний URL переходу"],
    causes: [
      { id: "broken_utm", text: "UTM-рядок синтаксично зламаний (другий «?» замість «&»), тож utm_medium/utm_campaign не читаються", correct: true, explanation: "Після першого «?» решта параметрів має розділятися «&»." },
      { id: "no_pixel", text: "Не встановлено Pixel", correct: false, explanation: "Pixel не впливає на UTM в CRM." },
      { id: "attribution", text: "Різні вікна атрибуції", correct: false, explanation: "Це пояснило б частину розбіжності, але не 85% «(not set)»." },
    ],
    evidence: [
      { id: "url", text: "URL parameters містять «?utm_medium=»", relevant: true },
      { id: "crm", text: "CRM-атрибуція Meta майже нульова", relevant: true },
      { id: "cpl", text: "CPL у кабінеті в нормі", relevant: false },
    ],
    diagnosticConfidence: { level: "висока", reason: "Синтаксис URL перевіряється напряму." },
    checks: ["Зібрати фінальний URL і відкрити його", "Перевірити кожен параметр у GA4 DebugView/реальному часі", "Чи не перетирає сайт UTM при редиректі"],
    explanation: "Параметри після «?» розділяються «&». Рядок «utm_source=meta?utm_medium=paid» дає utm_source зі значенням «meta?utm_medium=paid», а utm_medium відсутній.",
    articleSlugs: ["utm-ga4", "crm-discrepancies"],
    createAccount: (id, seed) => {
      let a = leadsNoUtmScenario(pixelPathAccount(id, seed, { name: "Error Lab · Зламані UTM" }), 0);
      for (const ad of a.ads) a = updateAd(a, ad.id, { creative: { ...ad.creative, urlParameters: "utm_source=meta?utm_medium=paid_social?utm_campaign=consultation" } });
      a = { ...a, ads: a.ads.map((x) => ({ ...x, status: "active" as const, review: { state: "approved" as const, reasons: [] } })) };
      return lab(runHistory(a, 10), "e04");
    },
  },
  {
    id: "e05",
    title: "Кабінет бачить більше покупок, ніж каса",
    level: "middle",
    symptoms: ["ROAS у кабінеті помітно вищий, ніж за даними бекенду", "Покупок у кабінеті БІЛЬШЕ, ніж замовлень у бекенді (зазвичай навпаки — через втрату сигналу)", "CAPI не підключено"],
    context: "Нещодавно на сайт додали ще один код Pixel через тег-менеджер.",
    whereToLook: ["Events Manager → Pixel: дублювання браузерних подій", "Meta vs бекенд в Analytics"],
    causes: [
      { id: "dup_browser", text: "Подія Purchase спрацьовує в браузері двічі", correct: true, explanation: "Дедуплікація не працює всередині одного джерела." },
      { id: "view", text: "View-through атрибуція", correct: false, explanation: "Вона додає частину, але не подвоює покупки." },
      { id: "aov", text: "Зріс середній чек", correct: false, explanation: "Кількість покупок, а не чек, розходиться вдвічі." },
    ],
    evidence: [
      { id: "ratio", text: "Покупок у Meta більше, ніж у бекенді", relevant: true },
      { id: "dup", text: "У налаштуваннях Pixel — дубль браузерної події", relevant: true },
      { id: "ctr", text: "CTR 1.3%", relevant: false },
    ],
    diagnosticConfidence: { level: "висока", reason: "Перевищення над бекендом (а не недооблік) + підтверджене дублювання в налаштуваннях." },
    checks: ["Скільки разів спрацьовує Purchase на сторінці подяки", "Порівняння з бекендом за ID замовлення", "Чи передається event_id"],
    explanation: "Два однакові браузерні Purchase не схлопуються навіть з event_id — дедуплікація працює між Pixel і CAPI, а не всередині одного джерела. Подвоєні покупки завищують ROAS і псують оптимізацію.",
    articleSlugs: ["pixel-capi", "events-manager"],
    createAccount: (id, seed) => {
      let a = glynaAccount(id, seed, { name: "Error Lab · Дубль Purchase", tracking: { capi: { enabled: false, sendsEventId: false, eventMatchQuality: 5 }, pixel: { installed: true, id: "px_e05", events: ["PageView", "ViewContent", "AddToCart", "InitiateCheckout", "Purchase"], duplicateBrowserEvents: true } } });
      a = glynaProspecting(a, { budget: 50 });
      return lab(runHistory(a, 10), "e05");
    },
  },
  {
    id: "e06",
    title: "Вісім наборів, жоден не навчається",
    level: "middle",
    symptoms: ["Усі набори в Learning limited", "CPA стрибає день у день", "8 наборів по $5"],
    context: "Хотіли «протестувати всі інтереси одночасно».",
    whereToLook: ["Статуси доставки наборів", "Бюджети наборів", "Перетин аудиторій (попередження валідації)"],
    causes: [
      { id: "fragment", text: "Бюджет розпорошено: кожному набору бракує подій для навчання", correct: true, explanation: "$5/день не дає ~50 подій на тиждень." },
      { id: "overlap", text: "Аудиторії наборів перетинаються і конкурують", correct: true, explanation: "Схожі інтереси з однаковою географією." },
      { id: "creative", text: "Поганий креатив", correct: false, explanation: "Той самий креатив працює нормально в консолідованих кампаніях." },
    ],
    evidence: [
      { id: "ll", text: "Статус Learning limited у всіх наборах", relevant: true },
      { id: "budget", text: "Бюджет кожного набору $5/день", relevant: true },
      { id: "variance", text: "Висока денна мінливість CPA", relevant: true },
      { id: "cpm", text: "CPM ≈ $2", relevant: false },
    ],
    diagnosticConfidence: { level: "висока", reason: "Структура однозначно не дає наборам зібрати достатньо подій." },
    checks: ["Події оптимізації на набір за 7 днів", "Перетин аудиторій", "Можливість консолідації в 1–2 набори"],
    explanation: "Кожен набір навчається окремо. Дрібні бюджети + перетин аудиторій = жоден не виходить з навчання. Консолідація дає системі більше сигналів.",
    articleSlugs: ["campaign-structure", "learning-phase"],
    createAccount: (id, seed) => {
      let a = glynaAccount(id, seed, { name: "Error Lab · Дроблення бюджету" });
      const ints = ["int_home_decor", "int_coffee", "int_online_shopping", "int_fashion", "int_beauty", "int_parenting", "int_travel", "int_fitness"];
      a = buildCampaign(a, {
        objective: "sales",
        campaign: { name: "Тест інтересів (8 наборів)", budgetLevel: "ad_set" },
        adSets: ints.map((i, k) => ({
          adSet: { name: `Інтерес ${k + 1}`, conversionLocation: "website" as const, performanceGoal: "conversions" as const, optimizationEvent: "Purchase" as const, budgetAmount: 5, audience: manual({ ageMin: 25, ageMax: 45, detailedTargeting: [i] }) },
          ads: [{ name: `Lifestyle ${k + 1}`, creative: { media: [libMedia("shop_lifestyle_45")], primaryText: "Кераміка ручної роботи для дому.", headline: "Кераміка «Глина»", cta: "SHOP_NOW" as const, urlParameters: UTM } }],
        })),
      });
      return lab(runHistory(a, 10), "e06");
    },
  },
  {
    id: "e07",
    title: "«Переможець» A/B тесту",
    level: "middle",
    symptoms: ["За 4 дні тесту покупок — лише кілька на кожне оголошення", "Медіабаєр пропонує вимкнути оголошення з меншою кількістю покупок як «удвічі гірше»", "Тест триває 4 дні"],
    context: "Клієнт просить ухвалити рішення сьогодні.",
    whereToLook: ["Analytics → порівняння оголошень (довірчі інтервали)", "Кількість конверсій і показів"],
    causes: [
      { id: "small_sample", text: "Замало конверсій для статистично надійного висновку", correct: true, explanation: "Різниця 6 vs 3 лежить у межах випадкових коливань." },
      { id: "b_worse", text: "B справді вдвічі гірше", correct: false, explanation: "На такій вибірці це не доведено." },
      { id: "tracking", text: "Трекінг зламаний", correct: false, explanation: "Немає ознак проблем з подіями." },
    ],
    evidence: [
      { id: "n", text: "Покупок < 15 у кожного варіанта", relevant: true },
      { id: "ci", text: "Довірчі інтервали конверсії перетинаються", relevant: true },
      { id: "ctr", text: "CTR майже однаковий", relevant: true },
      { id: "budget", text: "Бюджет $40/день", relevant: false },
    ],
    diagnosticConfidence: { level: "середня", reason: "Ми можемо впевнено сказати лише, що даних недостатньо; справжній переможець невідомий." },
    checks: ["Кількість конверсій на варіант", "Довірчі інтервали / p-value", "Тривалість тесту (бажано повні тижні)", "Чи не змінювались налаштування під час тесту"],
    explanation: "На кількох конверсіях випадковість домінує. Рішення: продовжити тест до достатнього обсягу або спершу оцінювати проміжні метрики (CTR, CPC, Add to cart) з розумінням їх обмежень.",
    articleSlugs: ["ab-testing", "analytics-metrics"],
    createAccount: (id, seed) => {
      let a = glynaAccount(id, seed, { name: "Error Lab · Мала вибірка" });
      a = buildCampaign(a, {
        objective: "sales",
        campaign: { name: "A/B тест креативів", budgetLevel: "campaign", budgetAmount: 45, abTest: { enabled: true, variable: "creative", hypothesis: "Якщо показати UGC-відео, то CPA буде нижчим", keyMetric: "cost_per_result" } },
        adSets: [
          {
            adSet: { name: "UA broad", conversionLocation: "website", performanceGoal: "conversions", optimizationEvent: "Purchase", audience: broad("UA") },
            ads: [
              { name: "A · UGC відео", creative: { media: [libMedia("shop_ugc_916")], primaryText: "Кераміка ручної роботи для дому.", headline: "Кераміка «Глина»", cta: "SHOP_NOW", urlParameters: UTM } },
              { name: "B · Lifestyle фото", creative: { media: [libMedia("shop_lifestyle_45")], primaryText: "Кераміка ручної роботи для дому.", headline: "Кераміка «Глина»", cta: "SHOP_NOW", urlParameters: UTM } },
            ],
          },
        ],
      });
      return lab(runHistory(a, 4), "e07");
    },
  },
  {
    id: "e08",
    title: "Високий CTR, мізерна конверсія",
    level: "junior",
    symptoms: ["CTR на рівні або вище за інші кампанії школи", "Частка LPV від кліків у нормі", "Конверсія з LPV у лід значно нижча за звичну для цього сайту"],
    context: "Креатив обіцяє «безкоштовний курс», а на сайті — запис на платну консультацію.",
    whereToLook: ["Текст оголошення vs офер посадкової", "Воронка LPV → Lead", "Оцінка відповідності посадковій у Campaign Builder"],
    causes: [
      { id: "mismatch", text: "Креатив обіцяє інше, ніж пропонує сторінка (message mismatch)", correct: true, explanation: "Люди клікають на «безкоштовне», а бачать інший офер." },
      { id: "clickbait", text: "Клікбейтні формулювання знижують якість трафіку", correct: true, explanation: "Підвищують CTR, але знижують намір." },
      { id: "pixel", text: "Не працює подія Lead", correct: false, explanation: "Лідів мало, але вони фіксуються — подія працює." },
    ],
    evidence: [
      { id: "ctr", text: "CTR не нижчий за середній", relevant: true },
      { id: "cvr", text: "Конверсія LPV → Lead значно нижча за норму", relevant: true },
      { id: "text", text: "У тексті «безкоштовно», на сторінці — платна консультація", relevant: true },
      { id: "freq", text: "Частота 1.3", relevant: false },
    ],
    diagnosticConfidence: { level: "середня", reason: "Невідповідність видно, але частково може впливати і сам офер сторінки — варто протестувати чесний креатив." },
    checks: ["Порівняти обіцянку в креативі з першим екраном сторінки", "Конверсія сторінки з інших джерел", "Тест креативу з чесним офером"],
    explanation: "Високий CTR без конверсій часто означає, що реклама «продає» не те, що сторінка. Узгодьте офер і перевірте результат A/B тестом.",
    articleSlugs: ["creative-strategy", "diagnostics-playbook"],
    createAccount: (id, seed) => {
      let a = pixelPathAccount(id, seed, { name: "Error Lab · Невідповідність оферу" });
      a = buildCampaign(a, {
        objective: "leads",
        campaign: { name: "Ліди · «Безкоштовний курс»", budgetLevel: "campaign", budgetAmount: 30 },
        adSets: [
          {
            adSet: { name: "UA broad", conversionLocation: "website", performanceGoal: "conversions", optimizationEvent: "Lead", audience: broad("UA") },
            ads: [{ name: "Безкоштовний курс!!!", creative: { media: [libMedia("edu_reel_916")], primaryText: "БЕЗКОШТОВНИЙ курс дизайну! Тільки сьогодні! 100% доступ без оплати!!!", headline: "Безкоштовний курс", cta: "SIGN_UP", urlParameters: UTM } }],
          },
        ],
      });
      return lab(runHistory(a, 8), "e08");
    },
  },
  {
    id: "e09",
    title: "ROAS 3 — це успіх?",
    level: "middle",
    symptoms: ["ROAS у кабінеті 3.0", "Маржа магазину 25%", "Власник каже, що «грошей не прибуває»"],
    context: "Звіт агенції святкує ROAS 3.",
    whereToLook: ["Беззбитковий ROAS = 1 / маржа", "Порівняння вікон атрибуції", "Бізнес-ROAS (бекенд)"],
    causes: [
      { id: "breakeven", text: "При маржі 25% беззбитковий ROAS = 4, тож ROAS 3 — збиток", correct: true, explanation: "1 / 0.25 = 4." },
      { id: "view", text: "Частину ROAS дають view-through конверсії, які менш інкрементальні", correct: true, explanation: "Порівняйте 7-day click без view." },
      { id: "cpm", text: "Занадто високий CPM", correct: false, explanation: "CPM не пояснює збиток при цьому ROAS." },
    ],
    evidence: [
      { id: "margin", text: "Маржа 25%", relevant: true },
      { id: "windows", text: "ROAS за 7-day click помітно нижчий", relevant: true },
      { id: "ctr", text: "CTR у нормі", relevant: false },
    ],
    diagnosticConfidence: { level: "висока", reason: "Арифметика беззбитковості однозначна; частка view-through видно в порівнянні вікон." },
    checks: ["Розрахунок break-even ROAS", "ROAS за різними вікнами атрибуції", "ROAS за бекендом", "Чи включено доставку/повернення в маржу"],
    explanation: "ROAS сам по собі не каже про прибуток. Порівнюйте з беззбитковим ROAS (1/маржа) і пам'ятайте, що атрибутований ROAS ≠ інкрементальний.",
    articleSlugs: ["ecommerce", "attribution"],
    createAccount: (id, seed) => {
      let a = glynaAccount(id, seed, { name: "Error Lab · Хибний ROAS", economics: { averageOrderValue: 42, margin: 0.25, leadToSaleRate: 0, saleValueFromLead: 0 } });
      a = glynaProspecting(a, { budget: 50 });
      return lab(runHistory(a, 10), "e09");
    },
  },
  {
    id: "e10",
    title: "Дешеві ліди, які ніхто не купує",
    level: "junior",
    symptoms: ["CPL $1.20 — рекорд", "Відділ продажів: «ліди не беруть слухавку»", "Миттєва форма"],
    context: "Обрали форму More volume і креатив «Безкоштовно!»",
    whereToLook: ["Тип миттєвої форми", "Частка кваліфікованих лідів (CRM)", "Текст креативу"],
    causes: [
      { id: "form", text: "Форма More volume без кваліфікаційних питань", correct: true, explanation: "Автозаповнення в один клік знижує намір." },
      { id: "clickbait", text: "Клікбейт «безкоштовно» приваблює нецільових людей", correct: true, explanation: "Знижує якість лідів." },
      { id: "budget", text: "Занизький бюджет", correct: false, explanation: "Бюджет не впливає на якість окремого ліда." },
    ],
    evidence: [
      { id: "qual", text: "Кваліфікованих лідів < 15%", relevant: true },
      { id: "type", text: "Тип форми — More volume", relevant: true },
      { id: "cpl", text: "Дуже низький CPL", relevant: true },
      { id: "cpm", text: "CPM $1.8", relevant: false },
    ],
    diagnosticConfidence: { level: "висока", reason: "CRM прямо показує низьку частку кваліфікованих лідів." },
    checks: ["Частка кваліфікованих у CRM", "Тип форми і питання", "Вартість кваліфікованого ліда", "Можливість conversion leads з даними CRM"],
    explanation: "Оптимізуйте не на дешевий лід, а на вартість кваліфікованого. Higher intent, кваліфікаційні питання і чесний креатив підвищують якість.",
    articleSlugs: ["lead-generation", "crm-discrepancies"],
    createAccount: (id, seed) => {
      let a = pixelPathAccount(id, seed, { name: "Error Lab · Якість лідів" });
      a = buildCampaign(a, {
        objective: "leads",
        campaign: { name: "Instant forms · More volume", budgetLevel: "campaign", budgetAmount: 30 },
        adSets: [
          {
            adSet: { name: "UA broad · форма", conversionLocation: "instant_forms", performanceGoal: "leads", audience: broad("UA") },
            ads: [
              {
                name: "Безкоштовно!",
                creative: {
                  media: [libMedia("edu_mentor_square")],
                  primaryText: "Безкоштовно! Отримай доступ до дизайну 100% без оплати — тільки сьогодні!",
                  headline: "Безкоштовний доступ",
                  cta: "SIGN_UP",
                  instantForm: { formType: "more_volume", questions: 2, privacyPolicyUrl: "https://pixelpath.example/privacy", hasQualifyingQuestion: false },
                },
              },
            ],
          },
        ],
      });
      return lab(runHistory(a, 10), "e10");
    },
  },
  {
    id: "e11",
    title: "Покращилось — але чому?",
    level: "advanced",
    symptoms: ["На 8-й день CPA впав на 35%", "Того ж дня змінили аудиторію, креатив і бюджет", "Клієнт питає, що саме спрацювало"],
    context: "Треба пояснити клієнту, яке з рішень дало результат.",
    whereToLook: ["Журнал змін (дата і поля)", "Динаміка по днях до/після", "Навчальна фаза після змін"],
    causes: [
      { id: "confounded", text: "Кілька змін одночасно — ефект не можна приписати жодній окремо", correct: true, explanation: "Змінні змішались (confounding)." },
      { id: "learning", text: "Після суттєвих змін набір знову проходив навчання, тож перші дні після змін нестабільні", correct: true, explanation: "Порівняння «до/після» в цей період ненадійне." },
      { id: "creative_won", text: "Однозначно спрацював новий креатив", correct: false, explanation: "Без ізоляції змінної цього не довести." },
    ],
    evidence: [
      { id: "log", text: "У журналі змін — три суттєві редагування в один день", relevant: true },
      { id: "reset", text: "Запис learning_reset у журналі", relevant: true },
      { id: "cpa", text: "CPA знизився", relevant: true },
      { id: "cpm_day", text: "CPM у вівторок вищий", relevant: false },
    ],
    diagnosticConfidence: { level: "низька", reason: "Ми знаємо, що стало краще, але не знаємо чому — дані не дозволяють розділити ефекти." },
    checks: ["Журнал змін і дати", "Кількість днів після змін", "Чи можна ізолювати змінні тестом", "Чи не було ринкових змін"],
    explanation: "Щоб зрозуміти, що працює, змінюйте одну змінну за раз або використовуйте A/B тест. Одночасні зміни роблять інтерпретацію неможливою.",
    articleSlugs: ["ab-testing", "optimization", "learning-phase"],
    createAccount: (id, seed) => {
      let a = excelProAccount(id, seed, { name: "Error Lab · Змішані зміни" });
      a = buildCampaign(a, {
        objective: "sales",
        campaign: { name: "Sales · Курс Excel", budgetLevel: "ad_set" },
        adSets: [
          {
            adSet: { name: "Київ · 25–40 · інтереси", conversionLocation: "website", performanceGoal: "conversions", optimizationEvent: "Purchase", budgetAmount: 30, audience: manual({ locations: [{ country: "UA", city: "Київ", radiusKm: 20 }], ageMin: 25, ageMax: 40, detailedTargeting: ["int_career", "int_it"] }) },
            ads: [{ name: "Банер", creative: { media: [libMedia("saas_dashboard_45")], primaryText: "Курс Excel для аналітиків: звіти, зведені таблиці, формули.", headline: "Excel для аналітиків", cta: "SHOP_NOW", urlParameters: UTM } }],
          },
        ],
      });
      a = runHistory(a, 7);
      const s = a.adSets[0];
      a = updateAdSet(a, s.id, { budgetAmount: 45, audience: broad("UA", { ageMin: 22, ageMax: 50 }) });
      const ad = a.ads[0];
      a = updateAd(a, ad.id, { creative: { ...ad.creative, media: [libMedia("edu_reel_916")], primaryText: "3 формули Excel, які економлять годину щодня. Курс для аналітиків з практикою." } });
      a = { ...a, ads: a.ads.map((x) => ({ ...x, status: "active" as const, review: { state: "approved" as const, reasons: [] } })) };
      return lab(runHistory(a, 7), "e11");
    },
  },
];

export const getErrorLabCase = (id: string) => ERROR_LAB_CASES.find((c) => c.id === id);
