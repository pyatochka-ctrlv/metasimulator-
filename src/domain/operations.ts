import { newId, nowIso } from "@/lib/ids";
import { resetLearning } from "@/simulation/learning";
import { hasBlockingErrors, validateCampaignTree, type ValidationIssue } from "@/simulation/validation";
import type { AdAccount, Ad, AdSet, Audience, Campaign, ChangeLogEntry, EntityStatus, TrackingSetup } from "./types";

/**
 * Чисті операції над навчальним акаунтом. Кожна повертає новий об'єкт акаунта
 * і додає запис у журнал змін. UI викликає їх через store.
 */

type EntityType = "campaign" | "ad_set" | "ad";

function log(account: AdAccount, entry: Omit<ChangeLogEntry, "id" | "accountId" | "at" | "simDay" | "actor"> & { actor?: "user" | "system" }): AdAccount {
  const e: ChangeLogEntry = {
    id: newId("log"),
    accountId: account.id,
    at: nowIso(),
    simDay: account.simDay,
    actor: entry.actor ?? "user",
    ...entry,
  };
  return { ...account, changeLog: [...account.changeLog, e] };
}

function diff<T extends object>(before: T, after: T, fields: (keyof T)[]): { field: string; from: unknown; to: unknown }[] {
  const out: { field: string; from: unknown; to: unknown }[] = [];
  for (const f of fields) {
    if (JSON.stringify(before[f]) !== JSON.stringify(after[f])) out.push({ field: String(f), from: before[f], to: after[f] });
  }
  return out;
}

const isPublished = (s: EntityStatus) => s === "active" || s === "paused" || s === "in_review" || s === "rejected";

/** Порог «суттєвої» зміни бюджету в симуляторі. Meta не публікує точного порогу — це навчальне припущення. */
export const SIGNIFICANT_BUDGET_CHANGE = 0.2;

const relChange = (a: number, b: number) => (a > 0 ? Math.abs(b - a) / a : b > 0 ? 1 : 0);

// ───────────── Campaign ─────────────

export function addCampaign(account: AdAccount, campaign: Campaign): AdAccount {
  return log({ ...account, campaigns: [...account.campaigns, campaign] }, {
    entityType: "campaign",
    entityId: campaign.id,
    entityName: campaign.name,
    action: "create",
    changes: [{ field: "objective", from: null, to: campaign.objective }],
    significantEdit: false,
  });
}

export function updateCampaign(account: AdAccount, id: string, patch: Partial<Campaign>): AdAccount {
  const before = account.campaigns.find((c) => c.id === id);
  if (!before) return account;
  const after: Campaign = { ...before, ...patch, updatedAt: nowIso() };
  if (isPublished(before.status) && patch.objective && patch.objective !== before.objective) {
    after.objective = before.objective; // ціль опублікованої кампанії змінити не можна — потрібен дублікат
  }
  const changes = diff(before, after, ["name", "objective", "specialAdCategories", "setup", "budgetLevel", "budgetType", "budgetAmount", "bidStrategy", "bidAmount", "roasGoal", "budgetSharing", "abTest"]);
  if (!changes.length) return account;
  const budgetSignificant = before.budgetLevel === "campaign" && relChange(before.budgetAmount, after.budgetAmount) > SIGNIFICANT_BUDGET_CHANGE;
  const significant =
    budgetSignificant || changes.some((c) => ["bidStrategy", "bidAmount", "roasGoal", "budgetLevel"].includes(c.field));
  if (isPublished(before.status)) after.hasUnpublishedChanges = false;
  let next: AdAccount = { ...account, campaigns: account.campaigns.map((c) => (c.id === id ? after : c)) };
  next = log(next, { entityType: "campaign", entityId: id, entityName: after.name, action: "update", changes, significantEdit: significant && isPublished(before.status) });
  if (significant && isPublished(before.status)) {
    next = resetAdSetsLearning(next, next.adSets.filter((s) => s.campaignId === id).map((s) => s.id), "Суттєва зміна на рівні кампанії");
  }
  return next;
}

// ───────────── Ad set ─────────────

export function addAdSet(account: AdAccount, adSet: AdSet): AdAccount {
  return log({ ...account, adSets: [...account.adSets, adSet] }, {
    entityType: "ad_set",
    entityId: adSet.id,
    entityName: adSet.name,
    action: "create",
    changes: [],
    significantEdit: false,
  });
}

const ADSET_SIGNIFICANT: (keyof AdSet)[] = ["audience", "placements", "optimizationEvent", "performanceGoal", "conversionLocation", "bidStrategy", "bidAmount", "roasGoal"];

export function updateAdSet(account: AdAccount, id: string, patch: Partial<AdSet>): AdAccount {
  const before = account.adSets.find((s) => s.id === id);
  if (!before) return account;
  const after: AdSet = { ...before, ...patch, updatedAt: nowIso() };
  const changes = diff(before, after, [
    "name",
    "conversionLocation",
    "performanceGoal",
    "optimizationEvent",
    "budgetType",
    "budgetAmount",
    "bidStrategy",
    "bidAmount",
    "roasGoal",
    "startDay",
    "endDay",
    "audience",
    "placements",
    "attribution",
    "frequencyCap",
  ]);
  if (!changes.length) return account;
  const budgetSignificant = relChange(before.budgetAmount, after.budgetAmount) > SIGNIFICANT_BUDGET_CHANGE;
  const significant = budgetSignificant || changes.some((c) => ADSET_SIGNIFICANT.includes(c.field as keyof AdSet));
  let next: AdAccount = { ...account, adSets: account.adSets.map((s) => (s.id === id ? after : s)) };
  next = log(next, { entityType: "ad_set", entityId: id, entityName: after.name, action: "update", changes, significantEdit: significant && before.learning.phase !== "not_started" });
  if (significant) next = resetAdSetsLearning(next, [id], `Суттєве редагування: ${changes.map((c) => c.field).join(", ")}`);
  return next;
}

export function resetAdSetsLearning(account: AdAccount, adSetIds: string[], reason: string): AdAccount {
  let next = account;
  for (const id of adSetIds) {
    const s = next.adSets.find((x) => x.id === id);
    if (!s || s.learning.phase === "not_started") continue;
    next = { ...next, adSets: next.adSets.map((x) => (x.id === id ? { ...x, learning: resetLearning(x.learning, account.simDay) } : x)) };
    next = log(next, { entityType: "ad_set", entityId: id, entityName: s.name, action: "learning_reset", changes: [], significantEdit: true, note: reason, actor: "system" });
  }
  return next;
}

// ───────────── Ad ─────────────

export function addAd(account: AdAccount, ad: Ad): AdAccount {
  let next = log({ ...account, ads: [...account.ads, ad] }, {
    entityType: "ad",
    entityId: ad.id,
    entityName: ad.name,
    action: "create",
    changes: [],
    significantEdit: false,
  });
  // Додавання нового оголошення в активний набір — суттєве редагування.
  next = resetAdSetsLearning(next, [ad.adSetId], "Додано нове оголошення в набір");
  return next;
}

export function updateAd(account: AdAccount, id: string, patch: Partial<Ad>): AdAccount {
  const before = account.ads.find((a) => a.id === id);
  if (!before) return account;
  const after: Ad = { ...before, ...patch, updatedAt: nowIso() };
  const changes = diff(before, after, ["name", "format", "creative", "facebookPageId", "instagramAccountId"]);
  if (!changes.length) return account;
  const creativeChanged = changes.some((c) => c.field === "creative" || c.field === "format");
  if (creativeChanged && isPublished(before.status) && before.status !== "in_review") {
    // Відредаговане оголошення знову проходить перевірку.
    after.status = before.status === "paused" ? "paused" : "in_review";
    after.review = { state: "pending", reasons: [] };
  }
  let next: AdAccount = { ...account, ads: account.ads.map((a) => (a.id === id ? after : a)) };
  next = log(next, { entityType: "ad", entityId: id, entityName: after.name, action: "update", changes, significantEdit: creativeChanged && isPublished(before.status) });
  if (creativeChanged && isPublished(before.status)) next = resetAdSetsLearning(next, [after.adSetId], "Змінено креатив оголошення");
  return next;
}

// ───────────── Duplicate ─────────────

function cloneAd(account: AdAccount, ad: Ad, adSetId: string, campaignId: string, suffix = " — копія"): [Ad, AdAccount] {
  const seq = account.seqCounter + 1;
  const t = nowIso();
  const copy: Ad = { ...structuredClone(ad), id: newId("ad"), seq, adSetId, campaignId, name: `${ad.name}${suffix}`, status: "draft", review: null, firstDeliveryDay: null, createdAt: t, updatedAt: t };
  return [copy, { ...account, seqCounter: seq }];
}

function cloneAdSet(account: AdAccount, s: AdSet, campaignId: string, suffix = " — копія"): [AdSet, AdAccount] {
  const seq = account.seqCounter + 1;
  const t = nowIso();
  const copy: AdSet = {
    ...structuredClone(s),
    id: newId("ads"),
    seq,
    campaignId,
    name: `${s.name}${suffix}`,
    status: "draft",
    startDay: Math.max(s.startDay, account.simDay),
    learning: { phase: "not_started", lastSignificantEditDay: null, eventsSinceEdit: 0, dailyEvents: [], resets: 0, pausedSinceDay: null },
    createdAt: t,
    updatedAt: t,
  };
  return [copy, { ...account, seqCounter: seq }];
}

export function duplicateEntity(account: AdAccount, type: EntityType, id: string): AdAccount {
  let next = account;
  if (type === "ad") {
    const ad = account.ads.find((a) => a.id === id);
    if (!ad) return account;
    const [copy, acc] = cloneAd(next, ad, ad.adSetId, ad.campaignId);
    next = { ...acc, ads: [...acc.ads, copy] };
    return log(next, { entityType: "ad", entityId: copy.id, entityName: copy.name, action: "duplicate", changes: [{ field: "source", from: ad.id, to: copy.id }], significantEdit: false });
  }
  if (type === "ad_set") {
    const s = account.adSets.find((x) => x.id === id);
    if (!s) return account;
    const [copy, acc] = cloneAdSet(next, s, s.campaignId);
    next = { ...acc, adSets: [...acc.adSets, copy] };
    for (const ad of account.ads.filter((a) => a.adSetId === id)) {
      const [adCopy, acc2] = cloneAd(next, ad, copy.id, copy.campaignId, "");
      next = { ...acc2, ads: [...acc2.ads, adCopy] };
    }
    return log(next, { entityType: "ad_set", entityId: copy.id, entityName: copy.name, action: "duplicate", changes: [{ field: "source", from: s.id, to: copy.id }], significantEdit: false });
  }
  const c = account.campaigns.find((x) => x.id === id);
  if (!c) return account;
  const seq = next.seqCounter + 1;
  const t = nowIso();
  const cCopy: Campaign = { ...structuredClone(c), id: newId("cmp"), seq, name: `${c.name} — копія`, status: "draft", publishedAt: undefined, createdAt: t, updatedAt: t };
  next = { ...next, seqCounter: seq, campaigns: [...next.campaigns, cCopy] };
  for (const s of account.adSets.filter((x) => x.campaignId === id)) {
    const [sCopy, acc] = cloneAdSet(next, s, cCopy.id, "");
    next = { ...acc, adSets: [...acc.adSets, sCopy] };
    for (const ad of account.ads.filter((a) => a.adSetId === s.id)) {
      const [adCopy, acc2] = cloneAd(next, ad, sCopy.id, cCopy.id, "");
      next = { ...acc2, ads: [...acc2.ads, adCopy] };
    }
  }
  return log(next, { entityType: "campaign", entityId: cCopy.id, entityName: cCopy.name, action: "duplicate", changes: [{ field: "source", from: c.id, to: cCopy.id }], significantEdit: false });
}

// ───────────── Delete ─────────────

export function deleteEntity(account: AdAccount, type: EntityType, id: string): AdAccount {
  let name = "";
  let next = account;
  if (type === "campaign") {
    name = account.campaigns.find((c) => c.id === id)?.name ?? "";
    next = {
      ...account,
      campaigns: account.campaigns.filter((c) => c.id !== id),
      adSets: account.adSets.filter((s) => s.campaignId !== id),
      ads: account.ads.filter((a) => a.campaignId !== id),
    };
  } else if (type === "ad_set") {
    name = account.adSets.find((s) => s.id === id)?.name ?? "";
    next = { ...account, adSets: account.adSets.filter((s) => s.id !== id), ads: account.ads.filter((a) => a.adSetId !== id) };
  } else {
    name = account.ads.find((a) => a.id === id)?.name ?? "";
    next = { ...account, ads: account.ads.filter((a) => a.id !== id) };
  }
  // Історичні метрики залишаються (як у реальному кабінеті — видалені об'єкти зберігаються у звітах).
  return log(next, { entityType: type, entityId: id, entityName: name, action: "delete", changes: [], significantEdit: false });
}

// ───────────── Status ─────────────

export function setEntityStatus(account: AdAccount, type: EntityType, id: string, on: boolean): AdAccount {
  const apply = <T extends { id: string; status: EntityStatus; name: string }>(list: T[]): [T[], T | undefined] => {
    let changed: T | undefined;
    const out = list.map((x) => {
      if (x.id !== id) return x;
      if (x.status === "draft" || x.status === "rejected" || x.status === "in_review") return x;
      changed = { ...x, status: on ? "active" : "paused" };
      return changed;
    });
    return [out, changed];
  };
  let next = account;
  let changed: { name: string; status: EntityStatus } | undefined;
  if (type === "campaign") {
    const [list, c] = apply(account.campaigns);
    next = { ...account, campaigns: list };
    changed = c;
  } else if (type === "ad_set") {
    const [list, c] = apply(account.adSets);
    next = { ...account, adSets: list };
    changed = c;
    if (c) {
      next = {
        ...next,
        adSets: next.adSets.map((s) => {
          if (s.id !== id) return s;
          if (!on) return { ...s, learning: { ...s.learning, pausedSinceDay: account.simDay } };
          const pausedFor = s.learning.pausedSinceDay !== null && s.learning.pausedSinceDay !== undefined ? account.simDay - s.learning.pausedSinceDay : 0;
          const learning = pausedFor >= 7 ? resetLearning({ ...s.learning, pausedSinceDay: null }, account.simDay) : { ...s.learning, pausedSinceDay: null };
          return { ...s, learning };
        }),
      };
    }
  } else {
    const [list, c] = apply(account.ads);
    next = { ...account, ads: list };
    changed = c;
  }
  if (!changed) return account;
  return log(next, { entityType: type, entityId: id, entityName: changed.name, action: on ? "activate" : "pause", changes: [{ field: "status", from: on ? "paused" : "active", to: changed.status }], significantEdit: false });
}

// ───────────── Publish ─────────────

export interface PublishResult {
  account: AdAccount;
  issues: ValidationIssue[];
  published: boolean;
}

export function publishCampaign(account: AdAccount, campaignId: string): PublishResult {
  const issues = validateCampaignTree(account, campaignId);
  if (hasBlockingErrors(issues)) return { account, issues, published: false };
  const t = nowIso();
  let next: AdAccount = {
    ...account,
    campaigns: account.campaigns.map((c) =>
      c.id === campaignId ? { ...c, status: c.status === "draft" ? "in_review" : c.status, publishedAt: c.publishedAt ?? t, hasUnpublishedChanges: false } : c,
    ),
    adSets: account.adSets.map((s) => (s.campaignId === campaignId && s.status === "draft" ? { ...s, status: "in_review", startDay: Math.max(s.startDay, account.simDay) } : s)),
    ads: account.ads.map((a) =>
      a.campaignId === campaignId && (a.status === "draft" || a.status === "rejected") ? { ...a, status: "in_review", review: { state: "pending", reasons: [] } } : a,
    ),
  };
  const c = next.campaigns.find((x) => x.id === campaignId)!;
  next = log(next, {
    entityType: "campaign",
    entityId: campaignId,
    entityName: c.name,
    action: "publish",
    changes: [],
    significantEdit: false,
    note: `Опубліковано. Попереджень: ${issues.filter((i) => i.level === "warning").length}. Оголошення надіслано на перевірку.`,
  });
  return { account: next, issues, published: true };
}

// ───────────── Tracking & audiences ─────────────

export function updateTracking(account: AdAccount, patch: Partial<TrackingSetup>): AdAccount {
  const before = account.tracking;
  const after: TrackingSetup = {
    ...before,
    ...patch,
    pixel: { ...before.pixel, ...(patch.pixel ?? {}) },
    capi: { ...before.capi, ...(patch.capi ?? {}) },
    consent: { ...before.consent, ...(patch.consent ?? {}) },
  };
  const changes = diff(before, after, ["pixel", "capi", "consent", "domainVerified", "crmConnected", "crmFeedback", "appRegistered"]);
  if (!changes.length) return account;
  return log({ ...account, tracking: after }, { entityType: "tracking", entityId: account.id, entityName: "Events Manager", action: "tracking_update", changes, significantEdit: false });
}

export function addAudience(account: AdAccount, audience: Audience): AdAccount {
  return log({ ...account, audiences: [...account.audiences, audience] }, {
    entityType: "audience",
    entityId: audience.id,
    entityName: audience.name,
    action: "audience_create",
    changes: [{ field: "type", from: null, to: audience.type }],
    significantEdit: false,
  });
}
