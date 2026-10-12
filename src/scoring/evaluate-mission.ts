import { objectiveLabel } from "@/domain/catalog";
import type { AdAccount, CaseStudy, MissionAnswer, PortfolioSnapshot, SkillAssessment, SkillDimension } from "@/domain/types";
import { fmtSimDate } from "@/lib/dates";
import { fmtMoney } from "@/lib/format";
import { aggregate } from "@/simulation/reporting";
import type { MissionDefinition } from "@/content/missions/types";
import { caseStudyText, choiceScore, numericScore, reasoningScore, type EvalContext } from "./checks";

export const DIMENSION_LABELS: Record<SkillDimension, string> = {
  objective: "Вибір цілі",
  structure: "Структура кампанії",
  audience: "Аудиторія",
  budget: "Бюджетна логіка",
  tracking: "Якість трекінгу",
  creative: "Відповідність креативу",
  metrics: "Інтерпретація метрик",
  optimization: "Оптимізаційні рішення",
  policy: "Дотримання політик",
  argumentation: "Аргументація",
};

export const DIMENSION_ARTICLES: Record<SkillDimension, string> = {
  objective: "campaign-objectives",
  structure: "campaign-structure",
  audience: "audiences",
  budget: "budgets-bidding",
  tracking: "pixel-capi",
  creative: "creative-strategy",
  metrics: "analytics-metrics",
  optimization: "optimization",
  policy: "advertising-standards",
  argumentation: "client-reporting",
};

const ALL_DIMS = Object.keys(DIMENSION_LABELS) as SkillDimension[];

export function evaluateMission(mission: MissionDefinition, account: AdAccount, answers: MissionAnswer[], caseStudy: CaseStudy): SkillAssessment {
  const byId: Record<string, MissionAnswer> = Object.fromEntries(answers.map((a) => [a.questionId, a]));
  const ctx: EvalContext = { account, answers: byId, caseStudy };
  const dims = Object.fromEntries(ALL_DIMS.map((d) => [d, { earned: 0, available: 0 }])) as Record<SkillDimension, { earned: number; available: number }>;
  const strengths: string[] = [];
  const critical: string[] = [];
  const risks: string[] = [];
  const notes: string[] = [];

  // 1. Рубрика процесу (стан акаунта)
  for (const item of mission.rubric) {
    let v = 0;
    try {
      v = Math.max(0, Math.min(1, item.check(ctx)));
    } catch {
      v = 0;
    }
    dims[item.dimension].earned += v * item.weight;
    dims[item.dimension].available += item.weight;
    if (v >= 0.8) strengths.push(item.pass);
    else if (item.critical && v < 0.5) critical.push(item.fail);
    else risks.push(item.fail);
  }

  // 2. Відповіді на питання
  for (const q of mission.questions) {
    const a = byId[q.id];
    let v = 0;
    if (q.kind === "single" || q.kind === "multi") {
      const base = choiceScore(a, q.correctFn ? q.correctFn(account) : (q.correct ?? []), q.kind);
      if (q.evidenceQuestionId) {
        const ev = mission.questions.find((x) => x.id === q.evidenceQuestionId);
        const evScore = reasoningScore(byId[q.evidenceQuestionId]?.text, ev?.keywords ?? [], ev?.minLength ?? 80);
        v = base * (0.5 + 0.5 * Math.min(1, evScore * 1.4));
        if (base > 0.8 && evScore < 0.3) notes.push(`«${q.prompt}»: відповідь правильна, але без обґрунтування зараховано лише частково.`);
      } else v = base;
      if (q.askConfidence && a?.confidence === 3 && base < 0.5) {
        v = Math.max(0, v - 0.25);
        notes.push(`Висока впевненість у хибній відповіді («${q.prompt}») — штраф за калібрування.`);
      }
      if (base >= 0.8) strengths.push(`Правильно: ${q.prompt}`);
      else risks.push(`Неточно: ${q.prompt} — ${q.explanation}`);
    } else if (q.kind === "number") {
      const expected = q.expectedValue ? q.expectedValue(account) : null;
      if (expected === null) {
        notes.push(`«${q.prompt}»: даних недостатньо для еталонного розрахунку — питання не враховано.`);
        continue;
      }
      v = numericScore(a?.value, expected, q.tolerance ?? 0.05);
      if (v >= 0.99) strengths.push(`Точний розрахунок: ${q.prompt}`);
      else risks.push(`Розрахунок «${q.prompt}»: очікувалось ≈ ${expected.toFixed(2)}${q.unit ? " " + q.unit : ""}, ваша відповідь ${a?.value ?? "—"}.`);
    } else {
      v = reasoningScore(a?.text, q.keywords ?? [], q.minLength ?? 120);
      if (v >= 0.7) strengths.push(`Аргументована відповідь: ${q.prompt}`);
      else risks.push(`Слабке обґрунтування: ${q.prompt}. ${q.explanation}`);
    }
    dims[q.dimension].earned += v * q.weight;
    dims[q.dimension].available += q.weight;
  }

  // 3. Кейс (аргументація процесу)
  const csScore = reasoningScore(caseStudyText(caseStudy), mission.caseStudyKeywords, 400);
  dims.argumentation.earned += csScore * 10;
  dims.argumentation.available += 10;
  if (csScore < 0.4) risks.push("Кейс заповнено поверхово: опишіть стратегію, гіпотези, результати й наступні кроки з посиланням на метрики.");

  let earned = 0;
  let available = 0;
  const out = {} as SkillAssessment["dimensions"];
  for (const d of ALL_DIMS) {
    earned += dims[d].earned;
    available += dims[d].available;
    out[d] = { earned: dims[d].earned, available: dims[d].available, score: dims[d].available > 0 ? Math.round((dims[d].earned / dims[d].available) * 100) : null };
  }
  let total = available > 0 ? Math.round((earned / available) * 100) : 0;
  let capped: string | undefined;
  const argScore = out.argumentation.score ?? 0;
  if (argScore < 35 && total > 75) {
    total = 75;
    capped = "Максимум 75 балів без аргументації: результат без пояснення рішень може бути вгадуванням.";
  }
  if (critical.length && total > 69) {
    total = 69;
    capped = "Є критичні помилки — місію не зараховано (максимум 69), навіть якщо інші частини виконано добре.";
  }

  const weakest = ALL_DIMS.filter((d) => out[d].score !== null && (out[d].score ?? 100) < 70).sort((a, b) => (out[a].score ?? 0) - (out[b].score ?? 0));
  const recommended = Array.from(new Set([...weakest.slice(0, 3).map((d) => DIMENSION_ARTICLES[d]), ...mission.recommendedArticles])).slice(0, 5);

  return {
    total,
    dimensions: out,
    strengths,
    criticalErrors: critical,
    risks,
    alternative: mission.expert.alternative,
    expertExplanation: mission.expert.explanation,
    recommendedArticles: recommended,
    notes,
    capped,
  };
}

export function buildPortfolioSnapshot(account: AdAccount): PortfolioSnapshot {
  const campaigns = account.campaigns.map((c) => {
    const budget =
      c.budgetLevel === "campaign" ? `${fmtMoney(c.budgetAmount, 0)} ${c.budgetType === "daily" ? "/день" : "на період"} (кампанія)` : "бюджет на рівні наборів";
    return {
      name: `${c.name}${c.seq <= account.seededSeq ? " (вихідна)" : ""}`,
      objective: c.objective,
      budget: `${objectiveLabel(c.objective)} · ${budget}`,
      adSets: account.adSets
        .filter((s) => s.campaignId === c.id)
        .map((s) => ({
          name: s.name,
          summary: `${s.performanceGoal}${s.optimizationEvent ? " · " + s.optimizationEvent : ""} · ${s.audience.advantageAudience ? "Advantage+ audience" : "ручна аудиторія"} · ${s.placements.mode === "advantage" ? "Advantage+ placements" : s.placements.selected.length + " плейсм."}${c.budgetLevel === "ad_set" ? ` · ${fmtMoney(s.budgetAmount, 0)}/${s.budgetType === "daily" ? "день" : "період"}` : ""}`,
          ads: account.ads.filter((a) => a.adSetId === s.id).map((a) => `${a.name} (${a.status})`),
        })),
    };
  });
  const r = aggregate(account, account.metrics);
  const days = Array.from(new Set(account.metrics.map((m) => m.day))).sort((a, b) => a - b);
  const daily = days.map((d) => {
    const rr = aggregate(account, account.metrics.filter((m) => m.day === d));
    return { day: d, date: fmtSimDate(account.startDate, d), spend: Math.round(rr.spend * 100) / 100, results: rr.results ?? rr.leads + rr.purchases };
  });
  return {
    campaigns,
    totals: {
      spend: r.spend,
      impressions: r.impressions,
      reach: r.reach,
      linkClicks: r.linkClicks,
      ctr: r.ctrLink,
      cpc: r.cpcLink,
      cpm: r.cpm,
      landingPageViews: r.landingPageViews,
      leads: r.leads,
      cpl: r.cpl,
      purchases: r.purchases,
      roas: r.roas,
      qualifiedLeads: r.qualifiedLeads,
      trueRevenue: r.trueRevenue,
    },
    daily,
    simDays: account.simDay,
  };
}
