import { libMedia } from "@/domain/account-builder";
import { makeAd, makeAdSet, makeCampaign, RECOMMENDED_UTM } from "@/domain/factories";
import { addAd, addAdSet, addCampaign, publishCampaign } from "@/domain/operations";
import type { AdAccount, CaseStudy, MissionAnswer } from "@/domain/types";
import { getMission } from "@/content/missions";
import { getErrorLabCase } from "@/content/error-lab";
import { simulateDays } from "@/simulation/engine";
import { evaluateMission } from "@/scoring/evaluate-mission";
import { evaluateErrorLab } from "@/scoring/evaluate-error-lab";
import { userReport } from "@/scoring/checks";

const NOW = "2026-10-11T10:00:00.000Z";
const m01 = getMission("m01")!;

function buildM01(good: boolean): AdAccount {
  let acc = m01.createAccount("acc_m01_test", "att", 777);
  const [c, a1] = makeCampaign(acc, good ? "traffic" : "leads", { name: "Speakly · Traffic", budgetAmount: good ? 15 : 40 });
  acc = addCampaign(a1, c);
  const [s, a2] = makeAdSet(acc, c, {
    name: "UA broad",
    conversionLocation: "website",
    performanceGoal: good ? "landing_page_views" : "conversions",
    optimizationEvent: good ? null : "Lead",
  });
  acc = addAdSet(a2, s);
  for (const key of ["edu_reel_916", "edu_mentor_square"]) {
    const [ad, a3] = makeAd(acc, s, {
      name: key,
      creative: {
        media: [libMedia(key)],
        primaryText: "Розмовна англійська: безкоштовний пробний урок з викладачем онлайн.",
        headline: "Пробний урок англійської",
        description: "",
        cta: "LEARN_MORE",
        destinationUrl: acc.landingPage.url,
        displayLink: acc.landingPage.domain,
        urlParameters: good ? RECOMMENDED_UTM : "",
        verticalMedia: null,
        creativeEnhancements: false,
        instantForm: null,
      },
    });
    acc = addAd(a3, ad);
  }
  acc = publishCampaign(acc, c.id).account;
  return simulateDays(acc, 7, NOW).account;
}

const goodCase: CaseStudy = {
  strategy: "Ціль Traffic з оптимізацією на landing page views (LPV), бюджет $15 на день, широка аудиторія України, Advantage+ placements, UTM у всіх оголошеннях.",
  hypotheses: "Гіпотеза: якщо оптимізувати на LPV, то частка переглядів сторінки від кліків буде вищою за 55%.",
  testing: "Два креативи: відео 9:16 та фото 1:1, однаковий текст.",
  analysis: "CTR і CPC у нормі, CPM низький, cost per LPV нижчий за KPI, частка LPV від кліків висока.",
  nextSteps: "Наступний крок — A/B тест креативів і перехід на Leads з подією Lead, коли наберемо дані.",
  conclusions: "Офер цікавий аудиторії; бюджет витрачено згідно з брифом. Дані симульовані.",
};

function goodAnswers(acc: AdAccount): MissionAnswer[] {
  return [
    { questionId: "q1", selected: ["b"], confidence: 3 },
    {
      questionId: "q2",
      text: "Оптимізація на landing page views: система шукає людей, які не лише клікають, а й дочікуються завантаження сайту, бо Pixel фіксує перегляд сторінки. У нас CTR і CPC стабільні, а частка LPV від кліків висока.",
    },
    { questionId: "q3", value: Number(userReport(acc).ctrLink!.toFixed(2)) },
    { questionId: "q4", text: "Гіпотеза: якщо замінити фото на відео з хуком, то CTR зросте; перевіримо A/B тестом креативів і порівняємо cost per LPV." },
  ];
}

describe("mission evaluation", () => {
  it("rewards a correct setup with sound reasoning", () => {
    const acc = buildM01(true);
    const a = evaluateMission(m01, acc, goodAnswers(acc), goodCase);
    expect(a.criticalErrors).toEqual([]);
    expect(a.total).toBeGreaterThanOrEqual(70);
    expect(a.dimensions.objective.score).toBe(100);
  });

  it("penalizes critical mistakes and caps the score at 69", () => {
    const acc = buildM01(false);
    const a = evaluateMission(m01, acc, goodAnswers(acc), goodCase);
    expect(a.criticalErrors.length).toBeGreaterThan(0);
    expect(a.total).toBeLessThanOrEqual(69);
  });

  it("does not give full credit for a correct choice without justification", () => {
    const acc = buildM01(true);
    const answers = goodAnswers(acc).map((x) => (x.questionId === "q2" ? { ...x, text: "" } : x));
    const withEvidence = evaluateMission(m01, acc, goodAnswers(acc), goodCase);
    const guessed = evaluateMission(m01, acc, answers, goodCase);
    expect(guessed.total).toBeLessThan(withEvidence.total);
    expect(guessed.notes.join(" ")).toMatch(/без обґрунтування/);
  });

  it("caps the score without argumentation", () => {
    const acc = buildM01(true);
    const bare = goodAnswers(acc).map((x) => (x.text !== undefined ? { ...x, text: "" } : x));
    const a = evaluateMission(m01, acc, bare, { strategy: "", hypotheses: "", testing: "", analysis: "", nextSteps: "", conclusions: "" });
    expect(a.total).toBeLessThanOrEqual(75);
  });

  it("penalizes high confidence in a wrong answer", () => {
    const acc = buildM01(true);
    const wrongConfident = goodAnswers(acc).map((x) => (x.questionId === "q1" ? { ...x, selected: ["a"], confidence: 3 as const } : x));
    const a = evaluateMission(m01, acc, wrongConfident, goodCase);
    expect(a.notes.join(" ")).toMatch(/калібрування/);
  });
});

describe("error lab evaluation", () => {
  const c = getErrorLabCase("e01")!;
  const correct = c.causes.filter((x) => x.correct).map((x) => x.id);
  const relevant = c.evidence.filter((x) => x.relevant).map((x) => x.id);
  it("scores a precise, evidenced diagnosis highly", () => {
    const r = evaluateErrorLab(c, correct, relevant, 3, "Ціль Traffic з оптимізацією на link clicks для продажів, Audience Network дає випадкові кліки з низькою часткою LPV.");
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.missedCauses).toEqual([]);
  });
  it("penalizes selecting every option", () => {
    const shotgun = evaluateErrorLab(c, c.causes.map((x) => x.id), c.evidence.map((x) => x.id), 3, "");
    const precise = evaluateErrorLab(c, correct, relevant, 2, "");
    expect(shotgun.score).toBeLessThan(precise.score);
  });
});
