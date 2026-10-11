import { validateCampaignTree } from "@/simulation/validation";
import { reviewAd } from "@/simulation/review";
import { utmPresent } from "@/simulation/tracking";
import { draftTree, freshLeadAccount } from "../helpers";

const msgs = (issues: ReturnType<typeof validateCampaignTree>, level: string) => issues.filter((i) => i.level === level).map((i) => i.message).join(" | ");

describe("publish validation", () => {
  it("a well-formed lead campaign has no errors", () => {
    const t = draftTree(freshLeadAccount());
    const issues = validateCampaignTree(t.account, t.campaign.id);
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
  });

  it("warns about missing UTM parameters", () => {
    const t = draftTree(freshLeadAccount(), { ad: { creative: { urlParameters: "" } as never } });
    expect(msgs(validateCampaignTree(t.account, t.campaign.id), "warning")).toMatch(/UTM/);
  });

  it("enforces special ad category restrictions", () => {
    const base = freshLeadAccount();
    const t = draftTree(base, {
      campaign: { specialAdCategories: ["financial_products_services"] },
      adSet: {
        audience: {
          locations: [{ country: "UA" }],
          ageMin: 25,
          ageMax: 45,
          genders: "female",
          languages: [],
          detailedTargeting: [],
          includedAudienceIds: ["aud_sp_lal"],
          excludedAudienceIds: [],
          advantageAudience: false,
          minAgeControl: 18,
        },
      },
    });
    const errs = msgs(validateCampaignTree(t.account, t.campaign.id), "error");
    expect(errs).toMatch(/18–65/);
    expect(errs).toMatch(/гендер/);
    expect(errs).toMatch(/lookalike/);
  });

  it("requires a privacy policy for instant forms", () => {
    const t = draftTree(freshLeadAccount(), {
      adSet: { conversionLocation: "instant_forms", performanceGoal: "leads", optimizationEvent: null },
      ad: { creative: { instantForm: { formType: "higher_intent", questions: 3, privacyPolicyUrl: "", hasQualifyingQuestion: true } } as never },
    });
    expect(msgs(validateCampaignTree(t.account, t.campaign.id), "error")).toMatch(/політику конфіденційності/);
  });

  it("flags lifetime budgets without end dates and bad bid settings", () => {
    const t = draftTree(freshLeadAccount(), { campaign: { budgetType: "lifetime", bidStrategy: "bid_cap", bidAmount: undefined } });
    const errs = msgs(validateCampaignTree(t.account, t.campaign.id), "error");
    expect(errs).toMatch(/дати завершення/);
    expect(errs).toMatch(/суму/);
  });

  it("warns about learning-limited risk for tiny budgets", () => {
    const t = draftTree(freshLeadAccount(), { campaign: { budgetAmount: 2 } });
    expect(msgs(validateCampaignTree(t.account, t.campaign.id), "warning")).toMatch(/Learning limited/);
  });
});

describe("ad review rules", () => {
  it("rejects personal attributes and unrealistic claims in Ukrainian", () => {
    const t = draftTree(freshLeadAccount(), { ad: { creative: { primaryText: "Ви страждаєте від стресу? Гарантоване працевлаштування!" } as never } });
    const f = reviewAd(t.ad, t.adSet, t.campaign, t.account);
    expect(f.map((x) => x.code)).toEqual(expect.arrayContaining(["personal_attributes", "unrealistic_claims"]));
  });

  it("requires a special category for credit offers", () => {
    const t = draftTree(freshLeadAccount(), { ad: { creative: { primaryText: "Кредит готівкою за 5 хвилин" } as never } });
    expect(reviewAd(t.ad, t.adSet, t.campaign, t.account).some((x) => x.code === "special_category_missing")).toBe(true);
  });

  it("rejects a non-functional landing page", () => {
    const t = draftTree(freshLeadAccount(), { ad: { creative: { destinationUrl: "https://speakly-lab-typo.example/" } as never } });
    expect(reviewAd(t.ad, t.adSet, t.campaign, t.account).some((x) => x.code === "non_functional_landing")).toBe(true);
  });

  it("approves a neutral ad", () => {
    const t = draftTree(freshLeadAccount());
    expect(reviewAd(t.ad, t.adSet, t.campaign, t.account).filter((x) => x.severity === "reject")).toEqual([]);
  });
});

describe("UTM parsing", () => {
  it("accepts correct parameters and rejects broken syntax", () => {
    expect(utmPresent("utm_source=meta&utm_medium=paid_social&utm_campaign=x", "https://a.example/p")).toBe(true);
    expect(utmPresent("utm_source=meta?utm_medium=paid_social?utm_campaign=x", "https://a.example/p")).toBe(false);
    expect(utmPresent("", "https://a.example/p?utm_source=meta&utm_medium=cpc&utm_campaign=y")).toBe(true);
    expect(utmPresent("utm_source=meta", "https://a.example/p")).toBe(false);
  });
});
