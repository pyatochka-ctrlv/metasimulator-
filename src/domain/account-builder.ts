import { libraryAsset } from "./catalog";
import { defaultCreative, defaultTracking, makeAd, makeAdSet, makeCampaign } from "./factories";
import type {
  AdAccount,
  Ad,
  AdSet,
  Audience,
  BusinessEconomics,
  Campaign,
  CountryCode,
  Creative,
  CreativeMedia,
  Identity,
  LandingPage,
  Objective,
  TrackingSetup,
  Vertical,
} from "./types";
import { nowIso, seededId } from "@/lib/ids";
import { simulateDays } from "@/simulation/engine";

export interface AccountConfig {
  id: string;
  name: string;
  kind: AdAccount["kind"];
  vertical: Vertical;
  primaryCountry: CountryCode;
  seed: number;
  virtualBudget: number;
  startDate: string;
  landingPage: LandingPage;
  economics: BusinessEconomics;
  tracking?: Partial<TrackingSetup>;
  identity?: Identity;
  audiences?: Omit<Audience, "accountId" | "createdAt">[];
  marketEvents?: AdAccount["marketEvents"];
  missionId?: string;
  missionAttemptId?: string;
  errorLabCaseId?: string;
  readOnly?: boolean;
}

export function createAccount(cfg: AccountConfig): AdAccount {
  const t = nowIso();
  return {
    id: cfg.id,
    name: cfg.name,
    kind: cfg.kind,
    missionId: cfg.missionId,
    missionAttemptId: cfg.missionAttemptId,
    errorLabCaseId: cfg.errorLabCaseId,
    readOnly: cfg.readOnly,
    currency: "USD",
    timezone: "Europe/Kyiv",
    vertical: cfg.vertical,
    primaryCountry: cfg.primaryCountry,
    startDate: cfg.startDate,
    simDay: 0,
    seed: cfg.seed,
    seqCounter: 0,
    seededSeq: 0,
    handoverDay: 0,
    virtualBudget: cfg.virtualBudget,
    tracking: defaultTracking(cfg.tracking),
    landingPage: cfg.landingPage,
    economics: cfg.economics,
    identity: cfg.identity ?? {
      pages: [{ id: "page_main", name: cfg.name.replace(/^.*?·\s*/, "") }],
      instagramAccounts: [{ id: "ig_main", username: "@" + cfg.landingPage.domain.split(".")[0] }],
    },
    audiences: (cfg.audiences ?? []).map((a) => ({ ...a, accountId: cfg.id, createdAt: t })),
    campaigns: [],
    adSets: [],
    ads: [],
    metrics: [],
    snapshots: [],
    runs: [],
    changeLog: [],
    marketEvents: cfg.marketEvents ?? [],
    createdAt: t,
  };
}

export function libMedia(key: string, id?: string): CreativeMedia {
  const a = libraryAsset(key);
  if (!a) throw new Error(`Unknown library asset ${key}`);
  return {
    id: id ?? seededId("med", key),
    kind: a.kind,
    aspectRatio: a.aspectRatio,
    source: "library",
    libraryKey: a.key,
    label: a.label,
    durationSec: a.durationSec,
    hookStrength: a.hookStrength,
  };
}

export interface AdSpec {
  name: string;
  format?: Ad["format"];
  creative: Partial<Creative> & { media: CreativeMedia[] };
  status?: Ad["status"];
}

export interface AdSetSpec {
  adSet: Partial<AdSet> & { name: string };
  ads: AdSpec[];
}

export interface CampaignSpec {
  objective: Objective;
  campaign: Partial<Campaign> & { name: string };
  adSets: AdSetSpec[];
  /** Одразу активувати (без чернетки й перевірки) — для готових сценаріїв. */
  launch?: boolean;
}

/** Створює кампанію з наборами й оголошеннями за специфікацією (для seed-даних, місій, Error Lab). */
export function buildCampaign(account: AdAccount, spec: CampaignSpec): AdAccount {
  const launch = spec.launch ?? true;
  let [campaign, acc] = makeCampaign(account, spec.objective, { ...spec.campaign });
  // Детерміновані ID для відтворюваних сценаріїв
  campaign = { ...campaign, id: seededId("cmp", `${account.id}|${campaign.seq}`), status: launch ? "active" : "draft", publishedAt: launch ? nowIso() : undefined };
  acc = { ...acc, campaigns: [...acc.campaigns, campaign] };
  for (const s of spec.adSets) {
    const [rawAdSet, acc2] = makeAdSet(acc, campaign, { ...s.adSet });
    const adSet: AdSet = { ...rawAdSet, id: seededId("ads", `${account.id}|${rawAdSet.seq}`), status: launch ? "active" : "draft" };
    acc = { ...acc2, adSets: [...acc2.adSets, adSet] };
    for (const a of s.ads) {
      const creative: Creative = { ...defaultCreative(acc), ...a.creative };
      const [rawAd, acc3] = makeAd(acc, adSet, { name: a.name, format: a.format ?? (creative.media[0]?.kind === "video" ? "single_video" : "single_image"), creative });
      const ad: Ad = {
        ...rawAd,
        id: seededId("ad", `${account.id}|${rawAd.seq}`),
        status: a.status ?? (launch ? "active" : "draft"),
        review: launch ? { state: "approved", reasons: [], reviewedDay: acc.simDay } : null,
      };
      acc = { ...acc3, ads: [...acc3.ads, ad] };
    }
  }
  return acc;
}

/** Прокручує симуляцію на N днів (для історичних даних сценаріїв). */
export function runHistory(account: AdAccount, days: number): AdAccount {
  if (days <= 0) return account;
  const res = simulateDays(account, days, nowIso());
  return { ...res.account, runs: [] };
}

/**
 * Завершує побудову сценарію: усі поточні сутності вважаються «вихідними» (не створеними користувачем),
 * а записи журналу — історією акаунта (actor = system).
 */
export function sealScenario(account: AdAccount): AdAccount {
  return {
    ...account,
    seededSeq: account.seqCounter,
    handoverDay: account.simDay,
    changeLog: account.changeLog.map((e) =>
      e.note?.startsWith("[історія]") ? e : { ...e, actor: "system", note: `[історія] ${e.note ?? (e.actor === "user" ? "зміна попереднього медіабаєра" : "")}`.trim() },
    ),
  };
}
