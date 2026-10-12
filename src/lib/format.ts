/** Форматування чисел для таблиць. Повертає «—» для відсутніх значень (null/NaN/∞). */

const isValid = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

export const DASH = "—";

export function fmtMoney(v: number | null | undefined, digits = 2): string {
  if (!isValid(v)) return DASH;
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function fmtInt(v: number | null | undefined): string {
  if (!isValid(v)) return DASH;
  return Math.round(v).toLocaleString("uk-UA");
}

export function fmtNum(v: number | null | undefined, digits = 2): string {
  if (!isValid(v)) return DASH;
  return v.toLocaleString("uk-UA", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtPct(v: number | null | undefined, digits = 2): string {
  if (!isValid(v)) return DASH;
  return `${v.toLocaleString("uk-UA", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

export function fmtCompact(v: number | null | undefined): string {
  if (!isValid(v)) return DASH;
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} млн`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)} тис.`;
  return Math.round(v).toString();
}

export function fmtRoas(v: number | null | undefined): string {
  if (!isValid(v)) return DASH;
  return `${v.toFixed(2)}×`;
}
