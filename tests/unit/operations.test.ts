import { deleteEntity, duplicateEntity, publishCampaign, setEntityStatus, updateAd, updateAdSet, updateCampaign } from "@/domain/operations";
import { simulateDays } from "@/simulation/engine";
import { draftTree, freshLeadAccount } from "../helpers";

const NOW = "2026-10-11T10:00:00.000Z";

describe("campaign CRUD operations", () => {
  it("creates linked entities with stable ids and a change log", () => {
    const { account, campaign, adSet, ad } = draftTree(freshLeadAccount());
    expect(adSet.campaignId).toBe(campaign.id);
    expect(ad.adSetId).toBe(adSet.id);
    expect(ad.campaignId).toBe(campaign.id);
    expect(new Set([campaign.seq, adSet.seq, ad.seq]).size).toBe(3);
    expect(account.changeLog.filter((e) => e.action === "create")).toHaveLength(3);
    expect(campaign.status).toBe("draft");
  });

  it("edits an ad set and records field-level changes", () => {
    const { account, adSet } = draftTree(freshLeadAccount());
    const next = updateAdSet(account, adSet.id, { name: "Renamed", budgetAmount: 15 });
    const s = next.adSets.find((x) => x.id === adSet.id)!;
    expect(s.name).toBe("Renamed");
    const entry = next.changeLog.at(-1)!;
    expect(entry.action).toBe("update");
    expect(entry.changes.map((c) => c.field)).toEqual(expect.arrayContaining(["name", "budgetAmount"]));
  });

  it("does not allow changing the objective of a published campaign", () => {
    const t = draftTree(freshLeadAccount());
    const pub = publishCampaign(t.account, t.campaign.id).account;
    const next = updateCampaign(pub, t.campaign.id, { objective: "sales" });
    expect(next.campaigns[0].objective).toBe("leads");
  });

  it("publishing moves drafts to review; status toggles only work for published entities", () => {
    const t = draftTree(freshLeadAccount());
    expect(setEntityStatus(t.account, "campaign", t.campaign.id, false)).toBe(t.account);
    const r = publishCampaign(t.account, t.campaign.id);
    expect(r.published).toBe(true);
    expect(r.account.campaigns[0].status).toBe("in_review");
    expect(r.account.ads[0].status).toBe("in_review");
    const live = simulateDays(r.account, 1, NOW).account;
    expect(live.campaigns[0].status).toBe("active");
    const paused = setEntityStatus(live, "campaign", t.campaign.id, false);
    expect(paused.campaigns[0].status).toBe("paused");
    const resumed = setEntityStatus(paused, "campaign", t.campaign.id, true);
    expect(resumed.campaigns[0].status).toBe("active");
  });

  it("blocks publishing when there are errors", () => {
    const t = draftTree(freshLeadAccount(), { adSet: { audience: { ...freshLeadAccount().adSets[0]?.audience, locations: [], ageMin: 18, ageMax: 65, genders: "all", languages: [], detailedTargeting: [], includedAudienceIds: [], excludedAudienceIds: [], advantageAudience: true, minAgeControl: 18 } } });
    const r = publishCampaign(t.account, t.campaign.id);
    expect(r.published).toBe(false);
    expect(r.issues.some((i) => i.level === "error" && i.field === "locations")).toBe(true);
    expect(r.account).toBe(t.account);
  });

  it("editing creative of an active ad sends it back to review and resets learning", () => {
    const t = draftTree(freshLeadAccount());
    const live = simulateDays(publishCampaign(t.account, t.campaign.id).account, 2, NOW).account;
    const ad = live.ads[0];
    const next = updateAd(live, ad.id, { creative: { ...ad.creative, headline: "Новий заголовок" } });
    expect(next.ads[0].status).toBe("in_review");
    expect(next.adSets[0].learning.resets).toBe(live.adSets[0].learning.resets + 1);
  });

  it("duplicates a campaign deeply as drafts with new ids", () => {
    const t = draftTree(freshLeadAccount());
    const next = duplicateEntity(t.account, "campaign", t.campaign.id);
    expect(next.campaigns).toHaveLength(2);
    expect(next.adSets).toHaveLength(2);
    expect(next.ads).toHaveLength(2);
    const copy = next.campaigns[1];
    expect(copy.id).not.toBe(t.campaign.id);
    expect(copy.status).toBe("draft");
    const copySet = next.adSets.find((s) => s.campaignId === copy.id)!;
    expect(next.ads.find((a) => a.adSetId === copySet.id)?.campaignId).toBe(copy.id);
  });

  it("deletes with cascade but keeps historical metrics", () => {
    const t = draftTree(freshLeadAccount());
    const live = simulateDays(publishCampaign(t.account, t.campaign.id).account, 2, NOW).account;
    const rows = live.metrics.length;
    const next = deleteEntity(live, "campaign", t.campaign.id);
    expect(next.campaigns).toHaveLength(0);
    expect(next.adSets).toHaveLength(0);
    expect(next.ads).toHaveLength(0);
    expect(next.metrics).toHaveLength(rows);
  });

  it("pausing an ad set for 7+ days resets learning on reactivation", () => {
    const t = draftTree(freshLeadAccount());
    let acc = simulateDays(publishCampaign(t.account, t.campaign.id).account, 2, NOW).account;
    const resets = acc.adSets[0].learning.resets;
    acc = setEntityStatus(acc, "ad_set", t.adSet.id, false);
    acc = simulateDays(acc, 8, NOW).account;
    acc = setEntityStatus(acc, "ad_set", t.adSet.id, true);
    expect(acc.adSets[0].learning.resets).toBe(resets + 1);
  });
});
