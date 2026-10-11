import { countryByCode } from "@/domain/catalog";
import type { AdAccount, AdSet, PixelEvent } from "@/domain/types";

/**
 * Модель трекінгу: яку частку реальних подій зафіксують Pixel/Conversions API
 * і скільки з них можна приписати рекламі. Навчальні припущення:
 *  - браузерний Pixel втрачає частину подій (блокувальники, обмеження браузерів, відмова від згоди);
 *  - CAPI відновлює частину втрат, але без однакових event_id + event_name події рахуються двічі;
 *  - дедуплікація не діє всередині одного джерела (два однакові браузерні події не схлопуються).
 */

export interface CaptureModel {
  /** Частка реальних подій, що надійшли в датасет (може бути > 1 при дублюванні). */
  capture: number;
  /** Частка надісланих подій, що можуть бути зіставлені з показами реклами. */
  match: number;
  /** Підсумковий коефіцієнт «звітні / реальні» конверсії. */
  reportedRate: number;
  browser: number;
  server: number;
  duplicated: boolean;
  notes: string[];
}

const BROWSER_BASE = 0.8;
const SERVER_BASE = 0.92;

export function consentFactor(account: Pick<AdAccount, "tracking">): number {
  return account.tracking.consent.bannerEnabled ? account.tracking.consent.acceptRate : 1;
}

export function captureModel(account: Pick<AdAccount, "tracking">, event: PixelEvent): CaptureModel {
  const t = account.tracking;
  const notes: string[] = [];
  const consent = consentFactor(account);
  const firesInBrowser = t.pixel.installed && t.pixel.events.includes(event);
  let browser = firesInBrowser ? BROWSER_BASE * consent : 0;
  if (firesInBrowser && t.pixel.duplicateBrowserEvents) {
    browser *= 2;
    notes.push(`Подія ${event} спрацьовує в браузері двічі — дедуплікація не діє всередині одного джерела.`);
  }
  // Сервер надсилає ключові події, якщо CAPI увімкнено.
  const serverSends = t.capi.enabled && (t.pixel.events.includes(event) || event === "Purchase" || event === "Lead");
  const server = serverSends ? SERVER_BASE * consent : 0;

  let capture: number;
  let duplicated = false;
  if (browser > 0 && server > 0) {
    if (t.capi.sendsEventId) {
      const b = Math.min(1, browser);
      capture = 1 - (1 - b) * (1 - server) + Math.max(0, browser - 1);
    } else {
      capture = browser + server;
      duplicated = true;
      notes.push(`Pixel і CAPI надсилають ${event} без спільного event_id — події не дедуплікуються.`);
    }
  } else {
    capture = Math.max(browser, server);
  }
  if (!firesInBrowser && !serverSends) notes.push(`Подія ${event} не надходить у датасет — оптимізація та звітність за нею неможливі.`);

  const match = t.capi.enabled ? Math.min(0.97, 0.8 + 0.017 * t.capi.eventMatchQuality) : 0.8;
  return { capture, match, reportedRate: capture * match, browser, server, duplicated, notes };
}

/** Частка трафіку з країн ЄС (для перевірок згоди). */
export function euShare(adSet: AdSet): number {
  if (!adSet.audience.locations.length) return 0;
  const eu = adSet.audience.locations.filter((l) => countryByCode(l.country)?.eu).length;
  return eu / adSet.audience.locations.length;
}

/** Повний URL переходу: destination URL + URL parameters (як їх склеює рекламний кабінет). */
export function finalUrl(destinationUrl: string, urlParameters: string): string {
  const params = urlParameters.trim().replace(/^[?&]/, "");
  if (!params) return destinationUrl;
  return destinationUrl + (destinationUrl.includes("?") ? "&" : "?") + params;
}

/** Чи містить фінальний URL коректні utm_source, utm_medium і utm_campaign (з урахуванням синтаксису). */
export function utmPresent(urlParameters: string, destinationUrl = "https://example.com/"): boolean {
  try {
    const u = new URL(finalUrl(destinationUrl || "https://example.com/", urlParameters));
    const ok = (k: string) => {
      const v = u.searchParams.get(k);
      return Boolean(v && !v.includes("?") && !v.includes("="));
    };
    return ok("utm_source") && ok("utm_medium") && ok("utm_campaign");
  } catch {
    return false;
  }
}
