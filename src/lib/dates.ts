/** Робота з симульованим календарем: день N від дати старту акаунта. */

export function simDate(startDate: string, day: number): Date {
  const [y, m, d] = startDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + day));
}

export function simDateIso(startDate: string, day: number): string {
  return simDate(startDate, day).toISOString().slice(0, 10);
}

const WEEKDAYS = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

export function fmtSimDate(startDate: string, day: number, withWeekday = false): string {
  const d = simDate(startDate, day);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const base = `${dd}.${mm}.${d.getUTCFullYear()}`;
  return withWeekday ? `${WEEKDAYS[d.getUTCDay()]}, ${base}` : base;
}

export function fmtShortSimDate(startDate: string, day: number): string {
  const d = simDate(startDate, day);
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** 0 = неділя … 6 = субота */
export function weekday(startDate: string, day: number): number {
  return simDate(startDate, day).getUTCDay();
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
