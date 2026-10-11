import { MISSIONS } from "@/content/missions";
import { ERROR_LAB_CASES } from "@/content/error-lab";
import { aggregate, ATTRIBUTION_PRESETS } from "@/simulation/reporting";
import { fmtNum } from "@/lib/format";

const fmt = (v: number | null) => (v === null ? "—" : fmtNum(v, 2));

describe("scenario calibration", () => {
  it("prints mission scenario metrics", () => {
    for (const m of MISSIONS) {
      const a = m.createAccount(`acc_${m.id}`, "att", 1234);
      const lines = [`${m.id} simDay=${a.simDay} seeded=${a.seededSeq} camps=${a.campaigns.length}`];
      for (const c of a.campaigns) {
        const r = aggregate(a, a.metrics.filter((x) => x.campaignId === c.id));
        const r7 = aggregate(a, a.metrics.filter((x) => x.campaignId === c.id), { attribution: ATTRIBUTION_PRESETS[1].setting });
        lines.push(`  ${c.name}: spend=${fmt(r.spend)} ctr=${fmt(r.ctrLink)} cpm=${fmt(r.cpm)} freq=${fmt(r.frequency)} lpv%=${fmt(r.lpvRate)} leads=${r.leads} cpl=${fmt(r.cpl)} purch=${r.purchases} purch7dc=${r7.purchases} truePurch=${r.truePurchases} cpa=${fmt(r.cpa)} roas=${fmt(r.roas)} qual%=${fmt(r.qualifiedRate)} crmLeads=${r.crmLeads}/${r.trueLeads} res=${r.results} ${r.resultLabel} learning=${a.adSets.filter(s=>s.campaignId===c.id).map(s=>s.learning.phase).join(",")}`);
      }
      if (m.id === "m07") {
        for (const [from, to] of [[0, 6], [7, 13], [14, 20]]) {
          const r = aggregate(a, a.metrics.filter((x) => x.day >= from && x.day <= to));
          lines.push(`   days ${from}-${to}: ctr=${fmt(r.ctrLink)} cpm=${fmt(r.cpm)} freq=${fmt(r.frequency)} cpl=${fmt(r.cpl)}`);
        }
      }
      console.log(lines.join("\n"));
    }
    for (const c of ERROR_LAB_CASES) {
      const a = c.createAccount(`lab_${c.id}`, 999);
      const r = aggregate(a, a.metrics);
      console.log(`${c.id} ${c.title}: spend=${fmt(r.spend)} ctr=${fmt(r.ctrLink)} cpm=${fmt(r.cpm)} lpv%=${fmt(r.lpvRate)} leads=${r.leads} trueLeads=${r.trueLeads} cpl=${fmt(r.cpl)} qual%=${fmt(r.qualifiedRate)} purch=${r.purchases} true=${r.truePurchases} cpa=${fmt(r.cpa)} roas=${fmt(r.roas)} bizRoas=${fmt(r.businessRoas)} res=${r.results} cpr=${fmt(r.costPerResult)} crm=${r.crmLeads} learning=${a.adSets.map(s=>s.learning.phase).join(",")} rejected=${a.ads.filter(x=>x.status==="rejected").length}`);
    }
    expect(true).toBe(true);
  });
});
