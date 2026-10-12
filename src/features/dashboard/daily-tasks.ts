import { SANDBOX_ACCOUNT_ID } from "@/content/sandbox";
import type { AppData } from "@/store/app-store";
import { utmPresent } from "@/simulation/tracking";

/**
 * Щоденні практичні завдання. Набір на день детермінований (залежить від дати),
 * виконання перевіряється автоматично за станом застосунку — без «галочок на довіру».
 */

export interface DailyTask {
  id: string;
  title: string;
  hint: string;
  href: string;
  check: (s: AppData, today: string) => boolean;
}

const isToday = (iso: string | undefined, today: string) => Boolean(iso && iso.slice(0, 10) === today);

export const DAILY_TASK_POOL: DailyTask[] = [
  {
    id: "simulate_sandbox",
    title: "Симулюйте щонайменше 1 день у пісочниці",
    hint: "Ads Manager → Simulate 1 day. Подивіться, як змінились Results і частота.",
    href: "/ads-manager",
    check: (s, t) => Boolean(s.accounts[SANDBOX_ACCOUNT_ID]?.runs.some((r) => isToday(r.createdAt, t))),
  },
  {
    id: "quiz",
    title: "Пройдіть мінітест будь-якої статті",
    hint: "Knowledge Base → стаття → Мінітест.",
    href: "/knowledge",
    check: (s, t) => Object.values(s.learning.quizResults).some((q) => isToday(q.at, t)),
  },
  {
    id: "error_lab",
    title: "Розберіть один кейс Error Lab",
    hint: "Сформулюйте діагноз з доказами і рівнем впевненості.",
    href: "/error-lab",
    check: (s, t) => Object.values(s.errorLabAttempts).some((a) => isToday(a.submittedAt, t)),
  },
  {
    id: "publish",
    title: "Опублікуйте кампанію (будь-який акаунт)",
    hint: "Пройдіть перевірку налаштувань і виправте помилки.",
    href: "/campaign-builder",
    check: (s, t) => Object.values(s.accounts).some((a) => a.changeLog.some((e) => e.action === "publish" && e.actor === "user" && isToday(e.at, t))),
  },
  {
    id: "utm",
    title: "Перевірте, що всі ваші оголошення в пісочниці мають UTM",
    hint: "Ads Manager → Ads → Редагувати → URL parameters.",
    href: "/ads-manager?tab=ads",
    check: (s) => {
      const a = s.accounts[SANDBOX_ACCOUNT_ID];
      const ads = a ? a.ads.filter((x) => x.seq > a.seededSeq) : [];
      return ads.length > 0 && ads.every((x) => utmPresent(x.creative.urlParameters, x.creative.destinationUrl));
    },
  },
  {
    id: "vertical",
    title: "Додайте вертикальну 9:16 версію креативу",
    hint: "У формі оголошення — поле «Вертикальна версія для Stories/Reels».",
    href: "/ads-manager?tab=ads",
    check: (s) => {
      const a = s.accounts[SANDBOX_ACCOUNT_ID];
      return Boolean(a?.ads.some((x) => x.seq > a.seededSeq && (x.creative.verticalMedia || x.creative.media[0]?.aspectRatio === "9:16")));
    },
  },
  {
    id: "mission_submit",
    title: "Здайте місію на оцінювання",
    hint: "Mission Center → оберіть місію відповідно до рівня.",
    href: "/missions",
    check: (s, t) => Object.values(s.missionAttempts).some((a) => isToday(a.submittedAt, t)),
  },
  {
    id: "capi",
    title: "Налаштуйте CAPI з дедуплікацією в пісочниці",
    hint: "Events Manager → Conversions API → event_id.",
    href: "/events-manager",
    check: (s) => Boolean(s.accounts[SANDBOX_ACCOUNT_ID]?.tracking.capi.enabled && s.accounts[SANDBOX_ACCOUNT_ID]?.tracking.capi.sendsEventId),
  },
];

export function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function tasksForDay(day: string): DailyTask[] {
  let h = 0;
  for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = [...DAILY_TASK_POOL];
  const out: DailyTask[] = [];
  while (out.length < 3 && pool.length) {
    h = (h * 1103515245 + 12345) >>> 0;
    out.push(pool.splice(h % pool.length, 1)[0]);
  }
  return out;
}
