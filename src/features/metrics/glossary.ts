/** Глосарій метрик для tooltip-ів. Визначення — навчальні, сформульовані за загальноприйнятою логікою рекламних кабінетів. */

export interface MetricDefinition {
  label: string;
  definition: string;
  formula?: string;
  note?: string;
}

export const GLOSSARY: Record<string, MetricDefinition> = {
  results: {
    label: "Results",
    definition: "Кількість результатів за ціллю ефективності набору (кліки, LPV, ліди, покупки тощо).",
    note: "Різні набори можуть рахувати різні типи результатів — не порівнюйте Results між ними напряму.",
  },
  costPerResult: { label: "Cost per result", definition: "Середня вартість одного результату за ціллю ефективності.", formula: "Amount spent / Results" },
  spend: { label: "Amount spent", definition: "Віртуальна сума, витрачена в симуляції за період." },
  impressions: { label: "Impressions", definition: "Скільки разів оголошення було показано (включно з повторними показами одній людині)." },
  reach: {
    label: "Reach",
    definition: "Кількість унікальних людей, які побачили оголошення хоча б раз.",
    note: "Охоплення не сумується між днями й наборами — у симуляторі воно оцінюється моделлю насичення.",
  },
  frequency: { label: "Frequency", definition: "Середня кількість показів на одну людину за період.", formula: "Impressions / Reach" },
  cpm: { label: "CPM", definition: "Вартість тисячі показів — ціна аукціону.", formula: "Amount spent / Impressions × 1000" },
  linkClicks: { label: "Link clicks", definition: "Кліки, що ведуть за посиланням оголошення (на сайт, у застосунок, форму тощо)." },
  clicksAll: { label: "Clicks (all)", definition: "Усі кліки: за посиланням, на профіль, розгортання тексту, реакції тощо." },
  outboundClicks: { label: "Outbound clicks", definition: "Кліки, що виводять людину за межі платформи (на сайт)." },
  ctrLink: { label: "CTR (link)", definition: "Частка показів, що завершились кліком за посиланням.", formula: "Link clicks / Impressions × 100%" },
  ctrAll: { label: "CTR (all)", definition: "Частка показів з будь-яким кліком.", formula: "Clicks (all) / Impressions × 100%" },
  cpcLink: { label: "CPC (link)", definition: "Середня вартість кліку за посиланням.", formula: "Amount spent / Link clicks" },
  landingPageViews: {
    label: "Landing page views",
    definition: "Переходи, після яких сторінка завантажилась і Pixel зафіксував перегляд.",
    note: "Потребує Pixel. Різниця між link clicks і LPV показує втрати на завантаженні сторінки.",
  },
  lpvRate: { label: "LPV rate", definition: "Частка вихідних кліків, що стали переглядами сторінки.", formula: "Landing page views / Outbound clicks × 100%" },
  costPerLpv: { label: "Cost per LPV", definition: "Вартість одного перегляду цільової сторінки.", formula: "Amount spent / Landing page views" },
  leads: { label: "Leads", definition: "Ліди, атрибутовані рекламі за поточним вікном атрибуції (сайт + форми)." },
  cpl: { label: "CPL", definition: "Вартість ліда.", formula: "Amount spent / Leads" },
  leadRate: { label: "Lead conversion rate", definition: "Частка переглядів сторінки, що стали лідами.", formula: "Leads / Landing page views × 100%" },
  purchases: { label: "Purchases", definition: "Покупки, атрибутовані рекламі за вікном атрибуції." },
  purchaseValue: { label: "Purchase conversion value", definition: "Сумарна цінність атрибутованих покупок." },
  cpa: { label: "Cost per purchase (CPA)", definition: "Вартість однієї покупки.", formula: "Amount spent / Purchases" },
  roas: {
    label: "Purchase ROAS",
    definition: "Повернення рекламних витрат за атрибутованими покупками.",
    formula: "Purchase conversion value / Amount spent",
    note: "Атрибутований ROAS ≠ прибуток. Порівнюйте з беззбитковим ROAS = 1 / маржа.",
  },
  purchaseRate: { label: "Purchase conversion rate", definition: "Частка переглядів сторінки, що стали покупками.", formula: "Purchases / Landing page views × 100%" },
  aov: { label: "Average order value", definition: "Середня цінність покупки.", formula: "Purchase value / Purchases" },
  thruPlays: { label: "ThruPlays", definition: "Перегляди відео до кінця або щонайменше 15 секунд." },
  videoPlays3s: { label: "3-second video plays", definition: "Перегляди відео тривалістю від 3 секунд." },
  postEngagements: { label: "Post engagements", definition: "Реакції, коментарі, поширення, збереження та інші взаємодії." },
  conversations: { label: "Messaging conversations started", definition: "Розпочаті розмови в месенджерах після кліку." },
  calls: { label: "Calls placed", definition: "Дзвінки, ініційовані з оголошення." },
  installs: { label: "App installs", definition: "Встановлення застосунку." },
  addToCarts: { label: "Adds to cart", definition: "Події AddToCart, зафіксовані Pixel/CAPI." },
  checkouts: { label: "Checkouts initiated", definition: "Події InitiateCheckout." },
  contentViews: { label: "Content views", definition: "Події ViewContent." },
  qualifiedLeads: { label: "Qualified leads (CRM)", definition: "Ліди, які відділ продажів визнав цільовими. Дані CRM, у рекламному кабінеті недоступні." },
  qualifiedRate: { label: "Qualified rate", definition: "Частка кваліфікованих лідів.", formula: "Qualified leads / Leads in CRM × 100%" },
  costPerQualifiedLead: { label: "Cost per qualified lead", definition: "Вартість кваліфікованого ліда.", formula: "Amount spent / Qualified leads" },
  businessRoas: {
    label: "Business ROAS",
    definition: "ROAS за даними бекенду/CRM (реальні продажі), а не за атрибуцією рекламного кабінету.",
    formula: "Revenue (backend) / Amount spent",
  },
  learning: {
    label: "Learning phase",
    definition: "Період, коли система вивчає, кому показувати набір. Зазвичай потрібно ~50 подій оптимізації за 7 днів після останнього суттєвого редагування.",
  },
  attribution: {
    label: "Attribution setting",
    definition: "Вікно, у межах якого конверсія приписується рекламі: click-through (1 або 7 днів), engage-through (1 день), view-through (1 день).",
  },
};
