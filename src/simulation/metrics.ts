/**
 * Формули рекламних метрик. Усі функції безпечні щодо ділення на нуль:
 * якщо знаменник 0 або значення відсутнє — повертають null (у UI відображається «—»).
 */

export function safeDiv(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
}

export const round = (v: number, digits = 2) => {
  const f = 10 ** digits;
  return Math.round((v + Number.EPSILON) * f) / f;
};

/** CPM = spend / impressions × 1000 */
export const cpm = (spend: number, impressions: number) => {
  const r = safeDiv(spend, impressions);
  return r === null ? null : r * 1000;
};

/** CTR (link) = link clicks / impressions × 100% */
export const ctr = (clicks: number, impressions: number) => {
  const r = safeDiv(clicks, impressions);
  return r === null ? null : r * 100;
};

/** CPC = spend / clicks */
export const cpc = (spend: number, clicks: number) => safeDiv(spend, clicks);

/** Conversion rate = conversions / base (кліки або сесії) × 100% */
export const conversionRate = (conversions: number, base: number) => {
  const r = safeDiv(conversions, base);
  return r === null ? null : r * 100;
};

/** CPA / CPL / cost per result = spend / results */
export const costPer = (spend: number, results: number) => safeDiv(spend, results);

/** ROAS = attributed conversion value / spend */
export const roas = (value: number, spend: number) => safeDiv(value, spend);

/** Frequency = impressions / reach */
export const frequency = (impressions: number, reach: number) => safeDiv(impressions, reach);

/** Impressions ≈ spend / CPM × 1000 */
export const impressionsFromSpend = (spend: number, cpmValue: number) => {
  if (!(cpmValue > 0) || !(spend > 0)) return 0;
  return (spend / cpmValue) * 1000;
};

/** Точка беззбитковості ROAS за маржинальності m: 1/m. */
export const breakEvenRoas = (margin: number) => safeDiv(1, margin);

/** Довірчий інтервал Вілсона для частки (95%). Повертає відсотки. */
export function wilsonInterval(successes: number, trials: number, z = 1.96): { low: number; high: number } | null {
  if (trials <= 0) return null;
  const p = successes / trials;
  const denom = 1 + (z * z) / trials;
  const centre = p + (z * z) / (2 * trials);
  const margin = z * Math.sqrt((p * (1 - p)) / trials + (z * z) / (4 * trials * trials));
  return { low: Math.max(0, ((centre - margin) / denom) * 100), high: Math.min(100, ((centre + margin) / denom) * 100) };
}

/** Двопропорційний z-тест. Повертає z і двосторонній p-value. */
export function twoProportionZTest(s1: number, n1: number, s2: number, n2: number): { z: number; pValue: number } | null {
  if (n1 <= 0 || n2 <= 0) return null;
  const p1 = s1 / n1;
  const p2 = s2 / n2;
  const p = (s1 + s2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (se === 0) return null;
  const z = (p1 - p2) / se;
  return { z, pValue: 2 * (1 - normalCdf(Math.abs(z))) };
}

export function normalCdf(x: number): number {
  // Апроксимація Абрамовіца–Стегуна 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const a = [0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429];
  const poly = t * (a[0] + t * (a[1] + t * (a[2] + t * (a[3] + t * a[4]))));
  const erf = 1 - poly * Math.exp(-(x * x) / 2);
  return x >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/** Евристика достатності даних для висновків про вартість результату. */
export function dataSufficiency(conversions: number): "insufficient" | "directional" | "reliable" {
  if (conversions < 15) return "insufficient";
  if (conversions < 50) return "directional";
  return "reliable";
}
