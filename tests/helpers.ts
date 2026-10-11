import { libMedia } from "@/domain/account-builder";
import { makeAd, makeAdSet, makeCampaign, RECOMMENDED_UTM } from "@/domain/factories";
import { addAd, addAdSet, addCampaign } from "@/domain/operations";
import type { AdAccount, Ad, AdSet, Campaign } from "@/domain/types";
import { speaklyAccount, glynaAccount } from "@/content/missions/businesses";

export function freshLeadAccount(seed = 1234): AdAccount {
  return speaklyAccount("acc_test", seed, { kind: "sandbox" });
}

export function freshShopAccount(seed = 1234): AdAccount {
  return glynaAccount("acc_shop", seed, { kind: "sandbox" });
}

/** Створює кампанію → набір → оголошення як чернетки через ті самі операції, що й UI. */
export function draftTree(
  account: AdAccount,
  opts: { campaign?: Partial<Campaign>; adSet?: Partial<AdSet>; ad?: Partial<Ad>; objective?: Campaign["objective"] } = {},
): { account: AdAccount; campaign: Campaign; adSet: AdSet; ad: Ad } {
  const objective = opts.objective ?? "leads";
  let [campaign, acc] = makeCampaign(account, objective, { name: "Test campaign", budgetAmount: 30, ...opts.campaign });
  acc = addCampaign(acc, campaign);
  const [adSet, acc2] = makeAdSet(acc, campaign, {
    name: "Test ad set",
    conversionLocation: "website",
    performanceGoal: objective === "leads" ? "conversions" : objective === "sales" ? "conversions" : "landing_page_views",
    optimizationEvent: objective === "leads" ? "Lead" : objective === "sales" ? "Purchase" : null,
    ...opts.adSet,
  });
  acc = addAdSet(acc2, adSet);
  const [ad, acc3] = makeAd(acc, adSet, {
    name: "Test ad",
    ...opts.ad,
    creative: {
      media: [libMedia("edu_reel_916")],
      primaryText: "Безкоштовний пробний урок англійської: розмовна практика з викладачем.",
      headline: "Пробний урок англійської",
      description: "",
      cta: "SIGN_UP",
      destinationUrl: account.landingPage.url,
      displayLink: account.landingPage.domain,
      urlParameters: RECOMMENDED_UTM,
      verticalMedia: null,
      creativeEnhancements: false,
      instantForm: null,
      ...(opts.ad?.creative ?? {}),
    },
  });
  acc = addAd(acc3, ad);
  campaign = acc.campaigns.find((c) => c.id === campaign.id)!;
  return { account: acc, campaign, adSet: acc.adSets.find((s) => s.id === adSet.id)!, ad: acc.ads.find((a) => a.id === ad.id)! };
}
