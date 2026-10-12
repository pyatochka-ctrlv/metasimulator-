import { CTAS, libraryAsset, placementById, ALL_PLACEMENT_IDS } from "@/domain/catalog";
import type { Ad, AdSet, Campaign, Creative, LandingPage, Objective, PlacementId } from "@/domain/types";

/**
 * Евристична оцінка креативу. Це навчальна модель: вона пояснює, ЯКІ властивості креативу
 * зазвичай впливають на результат, але не відтворює реальні алгоритми Meta.
 */

export interface CreativeAssessment {
  /** Загальна якість 0..1 (впливає на аукціон / CPM). */
  quality: number;
  ctrMultiplier: number;
  cvrMultiplier: number;
  leadQualityMultiplier: number;
  placementFit: number;
  messageMatch: number;
  hook: number;
  isVideo: boolean;
  components: { label: string; score: number; note: string }[];
  issues: string[];
}

const CLICKBAIT = [/безкоштовн/i, /100\s?%/i, /тільки сьогодні/i, /гарант/i, /шок/i, /!!!/, /халяв/i, /терміново/i];

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zа-яіїєґ0-9\s]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/** Частка ключових слів оферу (за коренем), присутніх у тексті креативу. */
export function messageMatchScore(creative: Creative, landing: LandingPage): number {
  if (!landing.offerKeywords.length) return 0.7;
  const words = normalizeWords(`${creative.primaryText} ${creative.headline} ${creative.description}`);
  let hits = 0;
  for (const kw of landing.offerKeywords) {
    const stem = kw.toLowerCase().slice(0, Math.max(4, Math.ceil(kw.length * 0.7)));
    if (words.some((w) => w.startsWith(stem))) hits++;
  }
  return hits / landing.offerKeywords.length;
}

function ctaFit(objective: Objective, cta: Creative["cta"], isInstantForm: boolean): { score: number; note: string } {
  const intent = CTAS.find((c) => c.id === cta)?.intent ?? "info";
  const expected: Record<Objective, string[]> = {
    awareness: ["info", "none", "purchase", "lead"],
    traffic: ["info", "purchase", "lead"],
    engagement: ["info", "message", "none", "call"],
    leads: isInstantForm ? ["lead", "info"] : ["lead", "info"],
    app_promotion: ["app"],
    sales: ["purchase", "info"],
  };
  if (expected[objective].includes(intent)) {
    const strong = (objective === "sales" && intent === "purchase") || (objective === "leads" && intent === "lead") || (objective === "app_promotion" && intent === "app");
    return { score: strong ? 1 : 0.85, note: strong ? "CTA відповідає цілі" : "CTA прийнятний" };
  }
  return { score: 0.6, note: "CTA не відповідає цілі кампанії" };
}

function copyScore(text: string): { score: number; note: string } {
  const len = text.trim().length;
  if (len === 0) return { score: 0.3, note: "Немає основного тексту" };
  const letters = text.replace(/[^a-zа-яіїєґ]/gi, "");
  const caps = letters.replace(/[^A-ZА-ЯІЇЄҐ]/g, "").length;
  const capsRatio = letters.length ? caps / letters.length : 0;
  let score = 1;
  let note = "Довжина та стиль у нормі";
  if (len < 40) {
    score = 0.75;
    note = "Текст закороткий: мало контексту для рішення";
  } else if (len > 600) {
    score = 0.7;
    note = "Текст задовгий: основна думка ховається за «… ще»";
  }
  if (capsRatio > 0.35) {
    score -= 0.25;
    note = "Забагато великих літер — сприймається як спам";
  }
  if ((text.match(/!/g) ?? []).length > 3) {
    score -= 0.1;
    note = "Надмірна кількість знаків оклику";
  }
  return { score: Math.max(0.2, score), note };
}

function headlineScore(h: string): { score: number; note: string } {
  const len = h.trim().length;
  if (len === 0) return { score: 0.55, note: "Без заголовка" };
  if (len > 40) return { score: 0.75, note: "Заголовок довший за 40 символів може обрізатися" };
  return { score: 1, note: "Заголовок лаконічний" };
}

export function mediaHook(creative: Creative): { hook: number; isVideo: boolean; note: string } {
  const m = creative.media[0];
  if (!m) return { hook: 0, isVideo: false, note: "Немає медіа" };
  const isVideo = m.kind === "video";
  if (m.source === "library") {
    const a = libraryAsset(m.libraryKey);
    const base = a?.hookStrength ?? 0.5;
    const durationPenalty = isVideo && (m.durationSec ?? 0) > 60 ? 0.85 : 1;
    return { hook: base * durationPenalty, isVideo, note: a?.label ?? m.label };
  }
  // Завантажений файл: нейтральна оцінка (модель не «бачить» зображення).
  const hook = isVideo ? ((m.durationSec ?? 30) > 60 ? 0.55 : 0.68) : 0.6;
  return { hook, isVideo, note: "Завантажений ассет: нейтральна оцінка якості" };
}

export function selectedPlacements(adSet: Pick<AdSet, "placements">): PlacementId[] {
  return adSet.placements.mode === "advantage" ? ALL_PLACEMENT_IDS : adSet.placements.selected;
}

/** Наскільки формат ассета підходить конкретному плейсменту (0.4..1). */
export function assetFitForPlacement(creative: Creative, placement: PlacementId): number {
  const p = placementById(placement);
  const isVertical = p.group === "Stories" || p.group === "Reels";
  const media = isVertical && creative.verticalMedia ? creative.verticalMedia : creative.media[0];
  if (!media) return 0.4;
  let fit = p.preferredAspect.includes(media.aspectRatio) ? 1 : media.aspectRatio === "16:9" ? 0.55 : 0.72;
  if (p.group === "Reels" && media.kind !== "video") fit *= 0.75;
  return fit;
}

export function assessCreative(
  ad: Pick<Ad, "creative" | "format">,
  ctx: { campaign: Pick<Campaign, "objective">; adSet: Pick<AdSet, "placements" | "conversionLocation">; landing: LandingPage },
): CreativeAssessment {
  const c = ad.creative;
  const issues: string[] = [];
  const isInstantForm = ctx.adSet.conversionLocation === "instant_forms";
  const { hook, isVideo, note: hookNote } = mediaHook(c);

  const placements = selectedPlacements(ctx.adSet);
  let invTotal = 0;
  let fitSum = 0;
  for (const pid of placements) {
    const p = placementById(pid);
    invTotal += p.inventory;
    fitSum += p.inventory * assetFitForPlacement(c, pid);
  }
  const placementFit = invTotal ? fitSum / invTotal : 0.5;
  if (placementFit < 0.8) issues.push("Формат медіа погано підходить частині плейсментів. Додайте 9:16 версію для Stories/Reels.");

  const copy = copyScore(c.primaryText);
  const head = headlineScore(c.headline);
  const cta = ctaFit(ctx.campaign.objective, c.cta, isInstantForm);
  const match = isInstantForm ? Math.max(0.6, messageMatchScore(c, ctx.landing)) : messageMatchScore(c, ctx.landing);
  const fullText = `${c.primaryText} ${c.headline} ${c.description}`;
  const clickbaitHits = CLICKBAIT.filter((r) => r.test(fullText)).length;

  if (copy.score < 0.8) issues.push(copy.note);
  if (head.score < 0.8) issues.push(head.note);
  if (cta.score < 0.8) issues.push(cta.note);
  if (match < 0.34 && !isInstantForm) issues.push("Слабка відповідність оферу посадкової сторінки: користувач не бачить на сайті обіцяного в рекламі.");
  if (clickbaitHits >= 2) issues.push("Клікбейтні формулювання: можуть підняти CTR, але знизити якість лідів і довіру.");
  if (!c.media.length) issues.push("Немає медіа — оголошення не може бути опубліковане.");

  const quality =
    0.36 * hook +
    0.2 * placementFit +
    0.14 * copy.score +
    0.1 * head.score +
    0.1 * cta.score +
    0.1 * (0.5 + 0.5 * match);

  const enh = c.creativeEnhancements ? 1.03 : 1;
  const ctrMultiplier = (0.45 + 1.15 * quality) * (1 + 0.05 * Math.min(clickbaitHits, 2)) * enh;
  const cvrMultiplier = (0.62 + 0.55 * match) * (clickbaitHits >= 2 ? 0.85 : 1);
  const leadQualityMultiplier = (0.8 + 0.3 * match) * (clickbaitHits >= 2 ? 0.7 : clickbaitHits === 1 ? 0.9 : 1);

  return {
    quality: Math.max(0, Math.min(1, quality)),
    ctrMultiplier,
    cvrMultiplier,
    leadQualityMultiplier,
    placementFit,
    messageMatch: match,
    hook,
    isVideo,
    components: [
      { label: "Хук / помітність медіа", score: hook, note: hookNote },
      { label: "Відповідність плейсментам", score: placementFit, note: placementFit >= 0.85 ? "Формат підходить" : "Потрібні адаптації під формати" },
      { label: "Основний текст", score: copy.score, note: copy.note },
      { label: "Заголовок", score: head.score, note: head.note },
      { label: "CTA", score: cta.score, note: cta.note },
      { label: "Відповідність посадковій", score: match, note: `${Math.round(match * 100)}% ключових тез оферу присутні в рекламі` },
    ],
    issues,
  };
}
