import { MISSIONS } from "@/content/missions";
import { ERROR_LAB_CASES, getErrorLabCase } from "@/content/error-lab";
import { getMission } from "@/content/missions";
import { aggregate } from "@/simulation/reporting";
import { diagnose } from "@/simulation/diagnostics";
import { validateCampaignTree } from "@/simulation/validation";

const byCampaign = (a: ReturnType<typeof getMission> extends infer _ ? any : never, prefix: string) => a.campaigns.find((c: { name: string }) => c.name.startsWith(prefix));

describe("mission and error-lab scenarios", () => {
  it.each(MISSIONS.map((m) => m.id))("mission %s builds a consistent account", (id) => {
    const m = getMission(id)!;
    const a = m.createAccount(`acc_${id}`, "att", 2026);
    expect(a.seededSeq).toBe(a.seqCounter);
    expect(a.handoverDay).toBe(a.simDay);
    for (const c of a.campaigns) expect(validateCampaignTree(a, c.id).filter((i) => i.level === "error" && i.field !== "endDay")).toEqual([]);
    expect(m.questions.length).toBeGreaterThan(0);
    expect(m.rubric.length).toBeGreaterThan(0);
  });

  it.each(ERROR_LAB_CASES.map((c) => c.id))("error lab %s is read-only with at least one correct cause", (id) => {
    const c = getErrorLabCase(id)!;
    const a = c.createAccount(`lab_${id}`, 99);
    expect(a.readOnly).toBe(true);
    expect(a.metrics.length).toBeGreaterThan(0);
    expect(c.causes.some((x) => x.correct)).toBe(true);
    expect(c.evidence.some((x) => x.relevant)).toBe(true);
  });

  it("m07: performance degrades over three weeks (fatigue + resets)", () => {
    const a = getMission("m07")!.createAccount("acc", "att", 11);
    const w1 = aggregate(a, a.metrics.filter((m) => m.day <= 6));
    const w3 = aggregate(a, a.metrics.filter((m) => m.day >= 14));
    expect(w3.cpl!).toBeGreaterThan(w1.cpl! * 1.5);
    expect(w3.ctrLink!).toBeLessThan(w1.ctrLink!);
    expect(a.changeLog.some((e) => e.action === "learning_reset")).toBe(true);
  });

  it("m11: the click campaign has the most 'results' but not the best CPL", () => {
    const a = getMission("m11")!.createAccount("acc", "att", 12);
    const A = aggregate(a, a.metrics.filter((m) => m.campaignId === byCampaign(a, "A ·").id));
    const D = aggregate(a, a.metrics.filter((m) => m.campaignId === byCampaign(a, "D ·").id));
    expect(D.results!).toBeGreaterThan(A.results! * 10);
    expect(D.cpl!).toBeGreaterThan(A.cpl!);
  });

  it("e03: leads exist in CRM but not in the ad account", () => {
    const a = getErrorLabCase("e03")!.createAccount("lab", 5);
    const r = aggregate(a, a.metrics);
    expect(r.leads).toBe(0);
    expect(r.trueLeads).toBeGreaterThan(10);
  });

  it("e05: duplicated browser events make Meta report more purchases than the backend", () => {
    const a = getErrorLabCase("e05")!.createAccount("lab", 5);
    const r = aggregate(a, a.metrics);
    expect(r.purchases).toBeGreaterThan(r.truePurchases);
    expect(diagnose(a, a.metrics).some((f) => f.id === "overcount")).toBe(true);
  });

  it("e06: fragmented ad sets are learning limited", () => {
    const a = getErrorLabCase("e06")!.createAccount("lab", 5);
    expect(a.adSets.every((s) => s.learning.phase === "learning_limited")).toBe(true);
  });

  it("e10: cheap instant-form leads have low quality", () => {
    const a = getErrorLabCase("e10")!.createAccount("lab", 5);
    const r = aggregate(a, a.metrics);
    expect(r.qualifiedRate!).toBeLessThan(25);
    expect(diagnose(a, a.metrics).some((f) => f.id === "low_quality_leads")).toBe(true);
  });

  it("e01: link-click optimisation with Audience Network shows low LPV rate", () => {
    const a = getErrorLabCase("e01")!.createAccount("lab", 5);
    const r = aggregate(a, a.metrics);
    expect(r.lpvRate!).toBeLessThan(55);
    expect(r.cpcLink!).toBeLessThan(0.1);
  });
});
