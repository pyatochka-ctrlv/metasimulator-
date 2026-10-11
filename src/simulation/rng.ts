/**
 * Детермінований генератор псевдовипадкових чисел.
 * Однаковий seed + однаковий ключ → однакова послідовність. Math.random() у симуляції не використовується.
 */

export function hashString(input: string): number {
  // FNV-1a 32-bit
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  next(): number;
  uniform(min: number, max: number): number;
  normal(mean?: number, sd?: number): number;
  /** Мультиплікативний шум навколо 1 з заданим стандартним відхиленням (логнормальний). */
  noise(sd: number): number;
  poisson(lambda: number): number;
  binomial(n: number, p: number): number;
}

export function createRng(seed: number, ...keys: (string | number)[]): Rng {
  const rand = mulberry32(hashString(`${seed}|${keys.join("|")}`));
  let spare: number | null = null;

  const normal = (mean = 0, sd = 1) => {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return mean + sd * v;
    }
    let u = 0;
    let v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    const mag = Math.sqrt(-2.0 * Math.log(u));
    spare = mag * Math.sin(2 * Math.PI * v);
    return mean + sd * mag * Math.cos(2 * Math.PI * v);
  };

  const poisson = (lambda: number): number => {
    if (!(lambda > 0)) return 0;
    if (lambda > 40) {
      return Math.max(0, Math.round(normal(lambda, Math.sqrt(lambda))));
    }
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= rand();
    } while (p > L);
    return k - 1;
  };

  return {
    next: rand,
    uniform: (min, max) => min + (max - min) * rand(),
    normal,
    noise: (sd) => Math.exp(normal(0, sd) - (sd * sd) / 2),
    poisson,
    binomial: (n, p) => {
      if (n <= 0 || p <= 0) return 0;
      if (p >= 1) return Math.round(n);
      const mean = n * p;
      if (n > 60) {
        const sd = Math.sqrt(n * p * (1 - p));
        return Math.min(Math.round(n), Math.max(0, Math.round(normal(mean, sd))));
      }
      let k = 0;
      for (let i = 0; i < Math.round(n); i++) if (rand() < p) k++;
      return k;
    },
  };
}
