import { createSandboxAccount } from "@/content/sandbox";
import { aggregate } from "@/simulation/reporting";

describe("engine smoke", () => {
  it("produces plausible metrics for sandbox", () => {
    const acc = createSandboxAccount();
    const r = aggregate(acc, acc.metrics);
    console.log(JSON.stringify({ spend: r.spend, imp: r.impressions, reach: r.reach, freq: r.frequency, ctr: r.ctrLink, cpc: r.cpcLink, cpm: r.cpm, lpv: r.landingPageViews, leads: r.leads, cpl: r.cpl, trueLeads: r.trueLeads, qual: r.qualifiedLeads, results: r.results, cpr: r.costPerResult, label: r.resultLabel, phase: acc.adSets.map(s => s.learning) }, null, 1));
    expect(r.spend).toBeGreaterThan(100);
  });
});
