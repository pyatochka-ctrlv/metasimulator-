/** Стабільні ID: префікс + випадковий суфікс. Для детермінованих сценаріїв використовуйте seededId. */
export function newId(prefix: string): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${rnd}`;
}

export function seededId(prefix: string, key: string): string {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${prefix}_${(h >>> 0).toString(36).padStart(7, "0")}`;
}

export const nowIso = () => new Date().toISOString();
