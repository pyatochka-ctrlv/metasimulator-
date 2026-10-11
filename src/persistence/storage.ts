import type { StateStorage } from "zustand/middleware";

/**
 * Обгортка над localStorage: відкладений запис (щоб не серіалізувати великий стан на кожну зміну),
 * обробка переповнення квоти та недоступності сховища (приватний режим).
 */

type Listener = (error: Error) => void;
const listeners = new Set<Listener>();
export const onStorageError = (l: Listener) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const pending = new Map<string, string>();
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  for (const [k, v] of pending) {
    try {
      window.localStorage.setItem(k, v);
    } catch (e) {
      listeners.forEach((l) => l(e as Error));
    }
  }
  pending.clear();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (pending.size) flush();
  });
}

export const debouncedLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return pending.get(name) ?? window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    pending.set(name, value);
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, 400);
  },
  removeItem: (name) => {
    pending.delete(name);
    try {
      window.localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

export function flushStorageNow() {
  if (timer) clearTimeout(timer);
  flush();
}

export function storageUsageBytes(key: string): number {
  try {
    const v = window.localStorage.getItem(key);
    return v ? v.length * 2 : 0;
  } catch {
    return 0;
  }
}
