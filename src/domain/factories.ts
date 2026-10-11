import { newId, nowIso } from "@/lib/ids";
import { initialLearning } from "@/simulation/learning";
import { defaultBidStrategy, defaultGoal, defaultLocation, recommendedEvents, requiresPixelEvent } from "./objective-config";
import type {
  AdAccount,
  Ad,
  AdSet,
  AudienceTargeting,
  Campaign,
  Creative,
  CountryCode,
  Objective,
  TrackingSetup,
} from "./types";

export function defaultTracking(partial: Partial<TrackingSetup> = {}): TrackingSetup {
  return {
    pixel: { installed: true, id: "px_1029384756", events: ["PageView", "ViewContent", "Lead"], duplicateBrowserEvents: false },
    capi: { enabled: false, sendsEventId: false, eventMatchQuality: 5 },
    domainVerified: true,
    consent: { bannerEnabled: false, acceptRate: 0.7 },
    crmConnected: true,
    crmFeedback: false,
    appRegistered: false,
    ...partial,
  };
}

export function defaultTargeting(country: CountryCode): AudienceTargeting {
  return {
    locations: [{ country }],
    ageMin: 18,
    ageMax: 65,
    genders: "all",
    languages: [],
    detailedTargeting: [],
    includedAudienceIds: [],
    excludedAudienceIds: [],
    advantageAudience: true,
    minAgeControl: 18,
  };
}

function nextSeq(account: AdAccount): [number, AdAccount] {
  const seq = account.seqCounter + 1;
  return [seq, { ...account, seqCounter: seq }];
}

export function makeCampaign(account: AdAccount, objective: Objective, partial: Partial<Campaign> = {}): [Campaign, AdAccount] {
  const [seq, acc] = nextSeq(account);
  const t = nowIso();
  const goal = defaultGoal(objective, defaultLocation(objective));
  const campaign: Campaign = {
    id: newId("cmp"),
    seq,
    accountId: account.id,
    name: `Нова кампанія · ${objective}`,
    objective,
    status: "draft",
    specialAdCategories: [],
    specialAdCountries: [],
    setup: "manual",
    budgetLevel: "campaign",
    budgetType: "daily",
    budgetAmount: 20,
    bidStrategy: defaultBidStrategy(goal),
    budgetSharing: false,
    abTest: null,
    createdAt: t,
    updatedAt: t,
    ...partial,
  };
  return [campaign, acc];
}

export function makeAdSet(account: AdAccount, campaign: Campaign, partial: Partial<AdSet> = {}): [AdSet, AdAccount] {
  const [seq, acc] = nextSeq(account);
  const t = nowIso();
  const location = partial.conversionLocation ?? defaultLocation(campaign.objective);
  const goal = partial.performanceGoal ?? defaultGoal(campaign.objective, location);
  const adSet: AdSet = {
    id: newId("ads"),
    seq,
    accountId: account.id,
    campaignId: campaign.id,
    name: `Новий набір оголошень`,
    status: "draft",
    conversionLocation: location,
    performanceGoal: goal,
    optimizationEvent: requiresPixelEvent(location, goal) ? recommendedEvents(campaign.objective, goal)[0] : null,
    datasetId: account.tracking.pixel.installed ? account.tracking.pixel.id : null,
    budgetType: "daily",
    budgetAmount: 10,
    bidStrategy: defaultBidStrategy(goal),
    startDay: account.simDay,
    endDay: null,
    audience: defaultTargeting(account.primaryCountry),
    placements: { mode: "advantage", selected: [] },
    attribution: { clickWindowDays: 7, viewThrough: true, engageThrough: true },
    learning: initialLearning(),
    createdAt: t,
    updatedAt: t,
    ...partial,
  };
  return [adSet, acc];
}

export function defaultCreative(account: AdAccount): Creative {
  return {
    media: [],
    primaryText: "",
    headline: "",
    description: "",
    cta: "LEARN_MORE",
    destinationUrl: account.landingPage.url,
    displayLink: account.landingPage.domain,
    urlParameters: "",
    verticalMedia: null,
    creativeEnhancements: false,
    instantForm: null,
  };
}

export function makeAd(account: AdAccount, adSet: AdSet, partial: Partial<Ad> = {}): [Ad, AdAccount] {
  const [seq, acc] = nextSeq(account);
  const t = nowIso();
  const ad: Ad = {
    id: newId("ad"),
    seq,
    accountId: account.id,
    campaignId: adSet.campaignId,
    adSetId: adSet.id,
    name: "Нове оголошення",
    status: "draft",
    facebookPageId: account.identity.pages[0]?.id ?? "",
    instagramAccountId: account.identity.instagramAccounts[0]?.id ?? null,
    format: "single_image",
    creative: defaultCreative(account),
    review: null,
    firstDeliveryDay: null,
    createdAt: t,
    updatedAt: t,
    ...partial,
  };
  return [ad, acc];
}

export const RECOMMENDED_UTM = "utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}";
