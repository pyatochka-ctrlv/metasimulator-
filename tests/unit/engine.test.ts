import { publishCampaign, updateAdSet, updateCampaign, updateTracking } from "@/domain/operations";
import { simulateDays } from "@/simulation/engine";
import { aggregate, ATTRIBUTION_PRESETS } from "@/simulation/reporting";
import { instantFormCompletion, instantFormQualityFactor } from "@/simulation/model";
import { freshLeadAccount, freshShopAccount, draftTree } from "../helpers";

const NOW = "2026-10-11T10:00:00.000Z";

function launched(seed = 1234, opts: Parameters<typeof draftTree>[1] = {}) {
  const t = draftTree(freshLeadAccount(seed), opts);
  const r = publishCampaign(t.account, t.campaign.id);
  expect(r.published).toBe(true);
  return { ...t, account: r.account };
}

/** Метрики без випадкових ID (ID сутностей генеруються випадково, seed-логіка від них не залежить). */
const strip = (rows: { day: number; spend: number; impressions: number; linkClicks: number; trueLeads: number }[]) =>
  rows.map((r) => ({ day: r.day, spend: r.spend, impressions: r.impressions, linkClicks: r.linkClicks, trueLeads: r.trueLeads }));

describe("simulation engine", () => {
  it("is deterministic: the same seed and setup produce identical results", () => {
    const a = simulateDays(launched(99).account, 7, NOW).account;
    const b = simulateDays(launched(99).account, 7, NOW).account;
    expect(strip(a.metrics)).toEqual(strip(b.metrics));
    expect(a.metrics.length).toBeGreaterThan(0);
  });

  it("different seeds produce different results", () => {
    const a = simulateDays(launched(1).account, 3, NOW).account;
    const b = simulateDays(launched(2).account, 3, NOW).account;
    expect(strip(a.metrics)).not.toEqual(strip(b.metrics));
  });

  it("simulating 7×1 day equals simulating 7 days at once", () => {
    let one = launched(5).account;
    for (let i = 0; i < 7; i++) one = simulateDays(one, 1, NOW).account;
    const seven = simulateDays(launched(5).account, 7, NOW).account;
    expect(strip(one.metrics)).toEqual(strip(seven.metrics));
    expect(one.simDay).toBe(7);
    expect(seven.simDay).toBe(7);
  });

  it("completes ad review on the first simulated day and starts delivery", () => {
    const { account } = launched();
    expect(account.ads[0].status).toBe("in_review");
    const after = simulateDays(account, 1, NOW).account;
    expect(after.ads[0].status).toBe("active");
    expect(after.ads[0].review?.state).toBe("approved");
    expect(after.metrics.some((m) => m.impressions > 0)).toBe(true);
    expect(after.adSets[0].learning.phase).not.toBe("not_started");
  });

  it("rejects ads with prohibited claims and does not deliver them", () => {
    const { account } = launched(3, { ad: { creative: { primaryText: "Гарантуємо дохід $2000 після курсу!" } as never } });
    const after = simulateDays(account, 1, NOW).account;
    expect(after.ads[0].status).toBe("rejected");
    expect(after.ads[0].review?.reasons.length).toBeGreaterThan(0);
    expect(after.metrics.length).toBe(0);
  });

  it("keeps spend within budget and consistent with impressions × CPM", () => {
    const after = simulateDays(launched(11).account, 7, NOW).account;
    const r = aggregate(after, after.metrics);
    expect(r.spend).toBeLessThanOrEqual(30 * 7 + 0.01);
    expect(r.spend).toBeGreaterThan(30 * 7 * 0.85);
    for (const row of after.metrics) {
      expect(row.linkClicks).toBeLessThanOrEqual(row.impressions);
      expect(row.outboundClicks).toBeLessThanOrEqual(row.linkClicks);
      expect(row.landingPageViews).toBeLessThanOrEqual(row.sessions);
      expect(row.reach).toBeLessThanOrEqual(row.impressions);
    }
    expect(r.cpm).toBeCloseTo((r.spend / r.impressions) * 1000, 8);
    expect(r.frequency!).toBeGreaterThanOrEqual(1);
  });

  it("produces no delivery for paused or draft campaigns", () => {
    const t = draftTree(freshLeadAccount());
    const after = simulateDays(t.account, 3, NOW).account;
    expect(after.metrics.length).toBe(0);
    expect(after.simDay).toBe(3);
  });

  it("does not report leads when the Lead event is missing from the dataset", () => {
    let { account } = launched(21);
    account = updateTracking(account, { pixel: { ...account.tracking.pixel, events: ["PageView"] } });
    const after = simulateDays(account, 7, NOW).account;
    const r = aggregate(after, after.metrics);
    expect(r.leads).toBe(0);
    expect(r.trueLeads).toBeGreaterThan(0);
    expect(after.adSets[0].learning.phase).toBe("learning_limited");
  });

  it("inflates purchases when Pixel + CAPI run without event_id and fixes it with dedup", () => {
    const build = (dedup: boolean) => {
      let acc = freshShopAccount(77);
      acc = updateTracking(acc, { capi: { enabled: true, sendsEventId: dedup, eventMatchQuality: 7 } });
      const t = draftTree(acc, { objective: "sales", campaign: { budgetAmount: 80 } });
      const p = publishCampaign(t.account, t.campaign.id).account;
      const done = simulateDays(p, 14, NOW).account;
      return aggregate(done, done.metrics, { attribution: ATTRIBUTION_PRESETS[1].setting });
    };
    const dup = build(false);
    const ok = build(true);
    expect(dup.purchases / dup.truePurchases).toBeGreaterThan(1.15);
    expect(ok.purchases / ok.truePurchases).toBeLessThan(1.1);
  });

  it("wider attribution windows report at least as many conversions", () => {
    const after = simulateDays(launched(31).account, 10, NOW).account;
    const [d1, d7, d7v, all] = ATTRIBUTION_PRESETS.map((p) => aggregate(after, after.metrics, { attribution: p.setting }).leads);
    expect(d1).toBeLessThanOrEqual(d7);
    expect(d7).toBeLessThanOrEqual(d7v);
    expect(d7v).toBeLessThanOrEqual(all);
  });

  it("marks the latest days as incomplete because of conversion delay", () => {
    const after = simulateDays(launched(41).account, 5, NOW).account;
    const last = aggregate(after, after.metrics.filter((m) => m.day === after.simDay - 1));
    expect(last.incomplete).toBe(true);
    const later = simulateDays(after, 7, NOW).account;
    const first = aggregate(later, later.metrics.filter((m) => m.day === 0));
    expect(first.incomplete).toBe(false);
  });

  it("a significant edit resets the learning phase", () => {
    const delivered = simulateDays(launched(51).account, 3, NOW).account;
    const s = delivered.adSets[0];
    const edited = updateAdSet(delivered, s.id, { audience: { ...s.audience, ageMin: 25 } });
    const ns = edited.adSets[0];
    expect(ns.learning.phase).toBe("learning");
    expect(ns.learning.resets).toBe(s.learning.resets + 1);
    expect(ns.learning.lastSignificantEditDay).toBe(delivered.simDay);
    expect(edited.changeLog.some((e) => e.action === "learning_reset")).toBe(true);
  });

  it("small budget changes are not significant edits", () => {
    const delivered = simulateDays(launched(52).account, 3, NOW).account;
    const s = delivered.adSets[0];
    const c = delivered.campaigns[0];
    const edited = updateCampaign(delivered, c.id, { budgetAmount: c.budgetAmount * 1.1 });
    expect(edited.adSets[0].learning.resets).toBe(s.learning.resets);
    const big = updateCampaign(delivered, c.id, { budgetAmount: c.budgetAmount * 1.6 });
    expect(big.adSets[0].learning.resets).toBe(s.learning.resets + 1);
  });

  it("stops delivery when the virtual budget is exhausted", () => {
    const t = launched(61);
    const tiny = { ...t.account, virtualBudget: 40 };
    const after = simulateDays(tiny, 5, NOW).account;
    const spend = after.metrics.reduce((a, m) => a + m.spend, 0);
    expect(spend).toBeLessThanOrEqual(40.01);
  });

  it("sensitive interests are not rejected but limit delivery", () => {
    const normal = launched(81);
    const t = draftTree(freshLeadAccount(81));
    const withSensitive = updateAdSet(t.account, t.adSet.id, {
      audience: { ...t.adSet.audience, detailedTargeting: [...t.adSet.audience.detailedTargeting, "int_weight_loss"] },
    });
    const pub = publishCampaign(withSensitive, t.campaign.id);
    expect(pub.published).toBe(true);
    const spendOf = (a: typeof normal.account) => simulateDays(a, 3, NOW).account.metrics.reduce((x, m) => x + m.spend, 0);
    const after = simulateDays(pub.account, 1, NOW).account;
    expect(after.ads[0].status).toBe("active");
    expect(after.ads[0].review?.reasons.some((r) => r.includes("чутливий"))).toBe(true);
    expect(spendOf(pub.account)).toBeLessThan(spendOf(normal.account) * 0.6);
  });

  it("longer instant forms complete less often but yield better leads", () => {
    const form = (questions: number) => ({ formType: "more_volume" as const, questions, privacyPolicyUrl: "https://x.example/p", hasQualifyingQuestion: false });
    expect(instantFormCompletion(form(3))).toBeCloseTo(0.24);
    expect(instantFormCompletion(form(7))).toBeLessThan(instantFormCompletion(form(3)));
    expect(instantFormCompletion(form(10))).toBeGreaterThanOrEqual(0.24 * 0.6);
    expect(instantFormQualityFactor(form(7))).toBeGreaterThan(instantFormQualityFactor(form(3)));
    expect(instantFormCompletion({ ...form(3), formType: "higher_intent" })).toBeLessThan(instantFormCompletion(form(3)));
  });

  it("bid cap far below the market leads to under-delivery", () => {
    const t = launched(71, { campaign: { bidStrategy: "bid_cap", bidAmount: 0.05 } });
    const after = simulateDays(t.account, 3, NOW).account;
    const spend = after.metrics.reduce((a, m) => a + m.spend, 0);
    expect(spend).toBeLessThan(30 * 3 * 0.2);
  });
});
