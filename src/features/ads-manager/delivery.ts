import type { AdAccount, Ad, AdSet, Campaign, EntityStatus } from "@/domain/types";
import { adSetInSchedule, isAdDeliverable } from "@/simulation/engine";

export type DeliveryTone = "active" | "learning" | "limited" | "off" | "draft" | "review" | "rejected" | "warning" | "completed" | "scheduled";

export interface Delivery {
  label: string;
  tone: DeliveryTone;
  hint?: string;
}

export const TONE_DOT: Record<DeliveryTone, string> = {
  active: "bg-success",
  learning: "bg-info",
  limited: "bg-warning",
  off: "bg-muted-foreground/50",
  draft: "bg-muted-foreground/30",
  review: "bg-info/60",
  rejected: "bg-destructive",
  warning: "bg-warning",
  completed: "bg-muted-foreground/60",
  scheduled: "bg-info/50",
};

export const isPublished = (s: EntityStatus) => s !== "draft";

function adSetDelivery(account: AdAccount, s: AdSet, campaign?: Campaign): Delivery {
  if (s.status === "draft") return { label: "Чернетка", tone: "draft", hint: "Не опубліковано. Опублікуйте кампанію, щоб почати показ." };
  if (s.status === "in_review") return { label: "На перевірці", tone: "review", hint: "Перевірка завершиться на початку наступного симульованого дня." };
  if (s.status === "paused") return { label: "Вимкнено", tone: "off" };
  if (s.status === "rejected") return { label: "Відхилено", tone: "rejected" };
  if (campaign && campaign.status !== "active") return { label: "Кампанію вимкнено", tone: "off" };
  if (s.endDay !== null && s.endDay < account.simDay) return { label: "Завершено", tone: "completed", hint: "Розклад набору завершився." };
  if (s.startDay > account.simDay) return { label: "Заплановано", tone: "scheduled", hint: `Старт у день ${s.startDay + 1}.` };
  const ads = account.ads.filter((a) => a.adSetId === s.id);
  if (!ads.some(isAdDeliverable)) {
    if (ads.some((a) => a.status === "in_review")) return { label: "Оголошення на перевірці", tone: "review" };
    if (ads.some((a) => a.status === "rejected")) return { label: "Оголошення відхилено", tone: "rejected", hint: "Жодне оголошення не може показуватись." };
    return { label: "Немає активних оголошень", tone: "warning" };
  }
  switch (s.learning.phase) {
    case "learning":
      return { label: "Навчання", tone: "learning", hint: `Подій оптимізації з останнього суттєвого редагування: ${s.learning.eventsSinceEdit}. Потрібно ~50 за 7 днів.` };
    case "learning_limited":
      return { label: "Навчання обмежене", tone: "limited", hint: "Набір навряд чи збере ~50 подій оптимізації за 7 днів. Розгляньте ширшу аудиторію, більший бюджет або подію вище у воронці." };
    case "not_started":
      return { label: "Активна", tone: "active", hint: "Доставка почнеться під час наступної симуляції." };
    default:
      return { label: "Активна", tone: "active" };
  }
}

export function getDelivery(account: AdAccount, type: "campaign" | "ad_set" | "ad", entity: Campaign | AdSet | Ad): Delivery {
  if (type === "ad_set") {
    const s = entity as AdSet;
    return adSetDelivery(account, s, account.campaigns.find((c) => c.id === s.campaignId));
  }
  if (type === "ad") {
    const ad = entity as Ad;
    if (ad.status === "draft") return { label: "Чернетка", tone: "draft" };
    if (ad.status === "in_review") return { label: "На перевірці", tone: "review", hint: "Оголошення перевіряється (у симуляторі — до початку наступного дня)." };
    if (ad.status === "rejected") return { label: "Відхилено", tone: "rejected", hint: ad.review?.reasons.join(" ") };
    if (ad.status === "paused") return { label: "Вимкнено", tone: "off" };
    const s = account.adSets.find((x) => x.id === ad.adSetId);
    if (!s) return { label: "—", tone: "off" };
    if (s.status !== "active") return { label: "Набір вимкнено", tone: "off" };
    const d = adSetDelivery(account, s, account.campaigns.find((c) => c.id === s.campaignId));
    return d.tone === "warning" ? { label: "Активне", tone: "active" } : d;
  }
  const c = entity as Campaign;
  if (c.status === "draft") return { label: "Чернетка", tone: "draft" };
  if (c.status === "in_review") return { label: "На перевірці", tone: "review" };
  if (c.status === "paused") return { label: "Вимкнено", tone: "off" };
  const sets = account.adSets.filter((s) => s.campaignId === c.id);
  const ds = sets.map((s) => adSetDelivery(account, s, c));
  if (!ds.length) return { label: "Немає наборів", tone: "warning" };
  const delivering = sets.filter((s) => s.status === "active" && adSetInSchedule(s, account.simDay));
  if (!delivering.length) {
    if (ds.every((d) => d.tone === "completed")) return { label: "Завершено", tone: "completed" };
    if (ds.some((d) => d.tone === "scheduled")) return { label: "Заплановано", tone: "scheduled" };
    return { label: "Наборів не активно", tone: "off" };
  }
  if (ds.some((d) => d.tone === "rejected")) return { label: "Є відхилені оголошення", tone: "rejected" };
  if (ds.some((d) => d.tone === "limited")) return { label: "Навчання обмежене", tone: "limited" };
  if (ds.some((d) => d.tone === "learning")) return { label: "Навчання", tone: "learning" };
  return { label: "Активна", tone: "active" };
}
