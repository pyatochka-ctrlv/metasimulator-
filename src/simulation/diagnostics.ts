import { countryByCode, VERTICALS } from "@/domain/catalog";
import type { AdAccount, DailyMetrics } from "@/domain/types";
import { reachFromImpressions } from "./audience";
import { dataSufficiency } from "./metrics";
import { aggregate, type ReportedMetrics } from "./reporting";

/**
 * Діагностика результатів. Кожен висновок — гіпотеза з доказами, альтернативними поясненнями,
 * рівнем впевненості та наступним тестом. Ми свідомо не формулюємо діагноз як безумовний факт.
 */

export interface Finding {
  id: string;
  title: string;
  severity: "high" | "medium" | "low";
  confidence: "висока" | "середня" | "низька";
  confidenceReason: string;
  evidence: string[];
  alternatives: string[];
  nextTest: string;
  articleSlug: string;
}

const pct = (v: number | null, d = 2) => (v === null ? "—" : `${v.toFixed(d)}%`);
const usd = (v: number | null) => (v === null ? "—" : `$${v.toFixed(2)}`);

function volumeConfidence(n: number): { c: Finding["confidence"]; r: string } {
  const s = dataSufficiency(n);
  if (s === "reliable") return { c: "висока", r: `Достатній обсяг (${n} подій).` };
  if (s === "directional") return { c: "середня", r: `Помірний обсяг (${n} подій) — висновок орієнтовний.` };
  return { c: "низька", r: `Малий обсяг (${n} подій) — легко сплутати випадковість з ефектом.` };
}

/** Орієнтир CPM для акаунта (навчальний бенчмарк). */
export function cpmBenchmark(account: AdAccount): number {
  return countryByCode(account.primaryCountry).baseCpm * VERTICALS[account.vertical].competition;
}

export function diagnose(account: AdAccount, rows: DailyMetrics[]): Finding[] {
  const out: Finding[] = [];
  if (!rows.length) return out;
  const r: ReportedMetrics = aggregate(account, rows);
  const days = Array.from(new Set(rows.map((x) => x.day))).sort((a, b) => a - b);
  const bench = cpmBenchmark(account);
  const objectives = new Set(account.campaigns.filter((c) => rows.some((x) => x.campaignId === c.id)).map((c) => c.objective));
  const conversionsCount = r.leads + r.purchases;

  // Тренди: перша vs остання третина періоду
  const third = Math.max(1, Math.floor(days.length / 3));
  const early = aggregate(account, rows.filter((x) => days.slice(0, third).includes(x.day)));
  const late = aggregate(account, rows.filter((x) => days.slice(-third).includes(x.day)));

  if (r.cpm !== null && r.cpm > bench * 1.6 && r.impressions > 2000) {
    out.push({
      id: "high_cpm",
      title: "Високий CPM",
      severity: r.cpm > bench * 2.2 ? "high" : "medium",
      confidence: "середня",
      confidenceReason: "CPM стабільно вимірюється навіть на малих бюджетах, але бенчмарк — навчальний орієнтир.",
      evidence: [`CPM ${usd(r.cpm)} проти орієнтира ~${usd(bench)} для ринку/ніші`, `Частота ${r.frequency?.toFixed(2) ?? "—"}`],
      alternatives: [
        "Вузька аудиторія або вузький набір плейсментів (менше інвентарю — дорожчий аукціон)",
        "Насичення аудиторії: висока частота підвищує вартість показу",
        "Низька оцінена якість/релевантність креативу",
        "Конкурентні дні (сезонні події) або ціль оптимізації з глибокої воронки",
      ],
      nextTest: "Перевірте breakdown за плейсментами й днями; протестуйте ширшу аудиторію або Advantage+ placements в окремому наборі.",
      articleSlug: "diagnostics-playbook",
    });
  }

  if (r.ctrLink !== null && r.ctrLink < 0.6 && r.impressions > 3000 && !objectives.has("awareness")) {
    const v = volumeConfidence(r.linkClicks);
    out.push({
      id: "low_ctr",
      title: "Низький CTR (link)",
      severity: r.ctrLink < 0.4 ? "high" : "medium",
      confidence: v.c,
      confidenceReason: v.r,
      evidence: [`CTR (link) ${pct(r.ctrLink)} при ${r.impressions.toLocaleString("uk-UA")} показах`, `CTR (all) ${pct(r.ctrAll)}`],
      alternatives: [
        "Слабкий «хук» креативу або неадаптований формат (наприклад, 16:9 у Stories/Reels)",
        "Нерелевантна аудиторія для оферу",
        "CTA або текст не мотивують до переходу",
        "Ціль оптимізації не на кліки (Awareness/Reach природно мають нижчий CTR)",
      ],
      nextTest: "A/B тест 2–3 креативів з різними хуками; перевірте попередній перегляд у вертикальних плейсментах.",
      articleSlug: "creative-strategy",
    });
  }

  if (r.cpcLink !== null && r.cpm !== null && r.ctrLink !== null && r.linkClicks > 50) {
    const expectedCpc = bench / 1000 / 0.01;
    if (r.cpcLink > expectedCpc * 1.8) {
      const driver = r.cpm > bench * 1.4 ? "CPM (дорогий аукціон)" : "CTR (мало кліків на показ)";
      out.push({
        id: "expensive_click",
        title: "Дорогий клік",
        severity: "medium",
        confidence: "середня",
        confidenceReason: "CPC = CPM / (CTR × 1000): розклад показує, яка складова тягне вгору.",
        evidence: [`CPC (link) ${usd(r.cpcLink)}`, `CPM ${usd(r.cpm)}, CTR ${pct(r.ctrLink)}`, `Основний драйвер: ${driver}`],
        alternatives: ["Висока конкуренція в ніші", "Креатив не мотивує до кліку", "Вузька аудиторія"],
        nextTest: driver.startsWith("CPM") ? "Розширте аудиторію/плейсменти." : "Тестуйте креативи й тексти, залишивши аудиторію незмінною.",
        articleSlug: "analytics-metrics",
      });
    }
  }

  if (r.lpvRate !== null && r.outboundClicks > 100 && r.lpvRate < 50) {
    out.push({
      id: "clicks_no_lpv",
      title: "Багато кліків, мало переглядів сторінки",
      severity: r.lpvRate < 35 ? "high" : "medium",
      confidence: "висока",
      confidenceReason: `Великий обсяг кліків (${r.outboundClicks}).`,
      evidence: [`LPV rate ${pct(r.lpvRate, 1)} (LPV ${r.landingPageViews} / outbound ${r.outboundClicks})`],
      alternatives: [
        "Випадкові кліки в окремих плейсментах (часто Audience Network)",
        "Повільне завантаження сторінки або помилка URL",
        "Pixel PageView не спрацьовує або користувачі відмовляються від згоди на cookie",
        "Оптимізація на link clicks замість landing page views",
      ],
      nextTest: "Breakdown за плейсментами; перевірте швидкість сайту і Events Manager; спробуйте оптимізацію на LPV.",
      articleSlug: "diagnostics-playbook",
    });
  }

  if (r.trueLeads >= 15 && r.qualifiedRate !== null && r.qualifiedRate < 25) {
    const v = volumeConfidence(r.trueLeads);
    out.push({
      id: "low_quality_leads",
      title: "Багато лідів, але низька якість",
      severity: "high",
      confidence: v.c,
      confidenceReason: v.r,
      evidence: [`Кваліфікованих ${r.qualifiedLeads} з ${r.trueLeads} (${pct(r.qualifiedRate, 1)})`, `CPL ${usd(r.cpl)}, вартість кваліф. ліда ${usd(r.costPerQualifiedLead)}`],
      alternatives: ["Форма More volume без кваліфікаційних питань", "Клікбейтний офер («безкоштовно»)", "Нерелевантна аудиторія", "Відділ продажів змінив критерії кваліфікації"],
      nextTest: "Higher intent форма або кваліфікаційне питання; передача статусів з CRM і conversion leads.",
      articleSlug: "lead-generation",
    });
  }

  const salesSpend = objectives.has("sales") && r.spend > account.economics.averageOrderValue * 3;
  if (salesSpend && r.purchases === 0) {
    out.push({
      id: "no_purchases",
      title: "Немає атрибутованих покупок",
      severity: "high",
      confidence: r.truePurchases > 0 ? "висока" : "середня",
      confidenceReason: r.truePurchases > 0 ? "Бекенд фіксує продажі, а кабінет — ні: схоже на проблему трекінгу." : "Бекенд теж не бачить продажів — проблема може бути в оптимізації чи офері.",
      evidence: [`Витрати ${usd(r.spend)} при середньому чеку $${account.economics.averageOrderValue}`, `Покупок у бекенді: ${r.truePurchases}`],
      alternatives: ["Подія Purchase не спрацьовує", "Оптимізація не на покупки", "Офер/ціна/сторінка не конвертують", "Замало часу: затримка конверсій"],
      nextTest: "Events Manager → Test events для сторінки подяки; перевірте подію оптимізації наборів.",
      articleSlug: "events-manager",
    });
  }

  if (r.roas !== null && r.roas > 3 && r.purchases > 0 && r.purchases < 15) {
    out.push({
      id: "roas_small_sample",
      title: "Високий ROAS на малій кількості покупок",
      severity: "medium",
      confidence: "низька",
      confidenceReason: `Лише ${r.purchases} покупок — одна велика покупка суттєво змінює ROAS.`,
      evidence: [`ROAS ${r.roas.toFixed(2)} на ${r.purchases} покупках`],
      alternatives: ["Випадковий великий чек", "View-through атрибуція завищує результат", "Ретаргетинг приписує собі органічні покупки"],
      nextTest: "Дочекайтесь ≥ 30–50 покупок; порівняйте ROAS за 7-day click без view-through.",
      articleSlug: "attribution",
    });
  }

  // Частотне вигорання: частота за останні 7 днів по наборах
  const last7 = days.slice(-7);
  if (last7.length >= 5) {
    const recent = rows.filter((x) => last7.includes(x.day));
    const byAdSet = new Map<string, number>();
    for (const x of recent) byAdSet.set(x.adSetId, (byAdSet.get(x.adSetId) ?? 0) + x.impressions);
    for (const [adSetId, imp] of byAdSet) {
      const snap = [...account.snapshots].reverse().find((s) => s.adSetId === adSetId);
      if (!snap) continue;
      const reach = reachFromImpressions(imp, snap.effectiveAudience);
      const freq = reach > 0 ? imp / reach : 0;
      const setRows = rows.filter((x) => x.adSetId === adSetId);
      const setDays = Array.from(new Set(setRows.map((x) => x.day))).sort((a, b) => a - b);
      const e = aggregate(account, setRows.filter((x) => setDays.slice(0, 4).includes(x.day)));
      const l = aggregate(account, setRows.filter((x) => setDays.slice(-4).includes(x.day)));
      const ctrDrop = e.ctrLink && l.ctrLink ? (e.ctrLink - l.ctrLink) / e.ctrLink : 0;
      if (freq > 3 && ctrDrop > 0.15) {
        const name = account.adSets.find((s) => s.id === adSetId)?.name ?? adSetId;
        out.push({
          id: `fatigue_${adSetId}`,
          title: `Ознаки вигорання: ${name}`,
          severity: freq > 4.5 ? "high" : "medium",
          confidence: ctrDrop > 0.3 ? "висока" : "середня",
          confidenceReason: "Поєднання зростання частоти і падіння CTR — типовий патерн, але не єдине пояснення.",
          evidence: [`Частота за 7 днів ≈ ${freq.toFixed(1)}`, `CTR: ${pct(e.ctrLink)} → ${pct(l.ctrLink)} (−${Math.round(ctrDrop * 100)}%)`, `CPM: ${usd(e.cpm)} → ${usd(l.cpm)}`],
          alternatives: ["Насичення малої аудиторії", "Сезонні зміни попиту", "Скидання навчальної фази через правки"],
          nextTest: "Додайте 2–3 нові креативи з іншими кутами та/або розширте аудиторію; зміни внесіть одним пакетом.",
          articleSlug: "optimization",
        });
      }
    }
  }

  if (conversionsCount > 0 && conversionsCount < 15 && r.spend > 0) {
    out.push({
      id: "insufficient_data",
      title: "Недостатньо даних для надійних висновків",
      severity: "low",
      confidence: "висока",
      confidenceReason: "Мала кількість конверсій — головне обмеження інтерпретації.",
      evidence: [`Конверсій за період: ${conversionsCount}`],
      alternatives: ["Короткий період", "Малий бюджет", "Подія оптимізації глибоко у воронці"],
      nextTest: "Збільшіть період/бюджет або аналізуйте проміжні метрики (CTR, LPV, AddToCart) як ранні сигнали.",
      articleSlug: "analytics-metrics",
    });
  }

  if (r.trueLeads >= 20) {
    const meta = r.leads;
    const crm = r.crmLeads;
    const diff = Math.abs(meta - crm) / Math.max(meta, crm, 1);
    if (diff > 0.3) {
      out.push({
        id: "crm_discrepancy",
        title: "Розбіжність між кабінетом і CRM",
        severity: diff > 0.5 ? "high" : "medium",
        confidence: "середня",
        confidenceReason: "Розбіжність велика, але має кілька можливих причин одночасно.",
        evidence: [`Ліди в кабінеті: ${meta}`, `Ліди з джерелом Meta в CRM: ${crm}`, `Усі ліди в CRM: ${r.trueLeads}`],
        alternatives: ["Відсутні або зламані UTM", "View/engage-through конверсії в кабінеті", "Затримка конверсій (останні дні)", "Втрата сигналу Pixel (блокувальники, відмова від згоди)"],
        nextTest: "Перевірте фінальний URL з UTM; порівняйте вікна атрибуції; звірте ліди за ID.",
        articleSlug: "crm-discrepancies",
      });
    }
  }

  if (r.truePurchases >= 10 && r.purchases > r.truePurchases * 1.15) {
    out.push({
      id: "overcount",
      title: "Кабінет бачить більше покупок, ніж бекенд",
      severity: "high",
      confidence: "висока",
      confidenceReason: "Зазвичай кабінет недораховує (втрата сигналу); перевищення вказує на дублювання.",
      evidence: [`Покупки в кабінеті: ${r.purchases}`, `Покупки в бекенді: ${r.truePurchases}`],
      alternatives: ["Pixel і CAPI без спільного event_id", "Подвійне спрацювання браузерної події", "View-through атрибуція (частково)"],
      nextTest: "Events Manager: перевірте дедуплікацію та кількість спрацювань Purchase.",
      articleSlug: "pixel-capi",
    });
  }

  const limited = account.adSets.filter((s) => s.learning.phase === "learning_limited" && rows.some((x) => x.adSetId === s.id));
  if (limited.length) {
    out.push({
      id: "learning_limited",
      title: `Learning limited: ${limited.length} набір(ів)`,
      severity: limited.length > 2 ? "high" : "medium",
      confidence: "висока",
      confidenceReason: "Статус визначається кількістю подій оптимізації за 7 днів.",
      evidence: limited.map((s) => `${s.name}: ${s.learning.eventsSinceEdit} подій з останнього редагування`),
      alternatives: ["Замалий бюджет для обраної події", "Вузька аудиторія", "Подія глибоко у воронці", "Подія не надходить (трекінг)"],
      nextTest: "Консолідуйте набори, збільште бюджет або оберіть подію вище у воронці.",
      articleSlug: "learning-phase",
    });
  }

  if (early.ctrLink && late.ctrLink && days.length >= 6 && late.ctrLink < early.ctrLink * 0.75 && !out.some((f) => f.id.startsWith("fatigue"))) {
    out.push({
      id: "ctr_trend",
      title: "CTR знижується з часом",
      severity: "low",
      confidence: "середня",
      confidenceReason: "Тренд помітний, але причина може бути різною.",
      evidence: [`CTR на початку ${pct(early.ctrLink)} → наприкінці ${pct(late.ctrLink)}`],
      alternatives: ["Вигорання креативів", "Зміни в налаштуваннях (див. журнал)", "Зміна аудиторії, яку знаходить алгоритм"],
      nextTest: "Перевірте журнал змін і частоту; додайте нові креативи.",
      articleSlug: "optimization",
    });
  }

  const order = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}
