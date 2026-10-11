"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createSandboxAccount, SANDBOX_ACCOUNT_ID } from "@/content/sandbox";
import { getMission } from "@/content/missions";
import { getErrorLabCase } from "@/content/error-lab";
import { evaluateMission, buildPortfolioSnapshot } from "@/scoring/evaluate-mission";
import { evaluateErrorLab } from "@/scoring/evaluate-error-lab";
import { newId, nowIso } from "@/lib/ids";
import { debouncedLocalStorage } from "@/persistence/storage";
import { simulateDays } from "@/simulation/engine";
import type {
  AdAccount,
  CaseStudy,
  ErrorLabAttempt,
  LearningProgress,
  MissionAnswer,
  MissionAttempt,
  QuizResult,
  UserProfile,
} from "@/domain/types";
import type { RangeKey } from "@/simulation/reporting";

export const STORAGE_KEY = "adlab-simulator-v1";
export const SCHEMA_VERSION = 1;

export interface Prefs {
  columnPreset: string;
  customColumns: string[];
  dateRange: RangeKey;
}

export interface AppData {
  schemaVersion: number;
  profile: UserProfile;
  accounts: Record<string, AdAccount>;
  activeAccountId: string;
  learning: LearningProgress;
  missionAttempts: Record<string, MissionAttempt>;
  errorLabAttempts: Record<string, ErrorLabAttempt>;
  prefs: Prefs;
}

export interface SimulationSummary {
  days: number;
  spend: number;
  notes: string[];
  reviewed: { approved: number; rejected: number };
}

export interface AppState extends AppData {
  hydrated: boolean;
  setHydrated: () => void;
  ensureInitialized: () => void;
  setActiveAccount: (id: string) => void;
  /** Застосувати чисту операцію до акаунта. Повертає false для read-only акаунтів. */
  mutateAccount: (id: string, fn: (a: AdAccount) => AdAccount) => boolean;
  simulate: (accountId: string, days: number) => SimulationSummary | null;
  startMission: (missionId: string) => string;
  submitMission: (attemptId: string, answers: MissionAnswer[], caseStudy: CaseStudy) => MissionAttempt | null;
  saveMissionDraft: (attemptId: string, answers: MissionAnswer[], caseStudy: CaseStudy) => void;
  openErrorLabCase: (caseId: string) => string;
  submitErrorLab: (input: Omit<ErrorLabAttempt, "id" | "score" | "submittedAt">) => ErrorLabAttempt | null;
  markArticleRead: (slug: string) => void;
  saveQuizResult: (r: QuizResult) => void;
  completePractice: (id: string) => void;
  completeDailyTask: (dateKey: string, taskId: string) => void;
  setProfile: (patch: Partial<UserProfile>) => void;
  setPrefs: (patch: Partial<Prefs>) => void;
  deleteAccount: (id: string) => void;
  resetSandbox: () => void;
  resetAll: () => void;
  importData: (data: AppData) => void;
  exportData: () => AppData;
}

function initialData(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: { id: "local_user", displayName: "Студент", createdAt: nowIso(), theme: "system" },
    accounts: {},
    activeAccountId: SANDBOX_ACCOUNT_ID,
    learning: { readArticles: [], quizResults: {}, completedPractice: [], completedDailyTasks: {}, xp: 0 },
    missionAttempts: {},
    errorLabAttempts: {},
    prefs: { columnPreset: "performance", customColumns: [], dateRange: "lifetime" },
  };
}

const seedFromString = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialData(),
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),

      ensureInitialized: () => {
        const s = get();
        if (!s.accounts[SANDBOX_ACCOUNT_ID]) {
          const sandbox = createSandboxAccount();
          set({ accounts: { ...s.accounts, [sandbox.id]: sandbox } });
        }
        if (!get().accounts[get().activeAccountId]) set({ activeAccountId: SANDBOX_ACCOUNT_ID });
      },

      setActiveAccount: (id) => {
        if (get().accounts[id]) set({ activeAccountId: id });
      },

      mutateAccount: (id, fn) => {
        const acc = get().accounts[id];
        if (!acc || acc.readOnly) return false;
        const next = fn(acc);
        if (next === acc) return true;
        set({ accounts: { ...get().accounts, [id]: next } });
        return true;
      },

      simulate: (accountId, days) => {
        const acc = get().accounts[accountId];
        if (!acc || acc.readOnly) return null;
        const beforeAds = new Map(acc.ads.map((a) => [a.id, a.status]));
        const res = simulateDays(acc, days, nowIso());
        let approved = 0;
        let rejected = 0;
        for (const ad of res.account.ads) {
          if (beforeAds.get(ad.id) === "in_review") {
            if (ad.status === "active") approved++;
            if (ad.status === "rejected") rejected++;
          }
        }
        set({ accounts: { ...get().accounts, [accountId]: res.account } });
        return { days, spend: res.spend, notes: res.notes, reviewed: { approved, rejected } };
      },

      startMission: (missionId) => {
        const mission = getMission(missionId);
        if (!mission) throw new Error(`Unknown mission ${missionId}`);
        const attemptId = newId("att");
        const previous = Object.values(get().missionAttempts).filter((a) => a.missionId === missionId).length;
        const accountId = `acc_${attemptId}`;
        // Seed залежить від місії та номера спроби: повторна спроба — новий ринок, але відтворюваний.
        const seed = seedFromString(`${missionId}|${previous}`);
        const account = mission.createAccount(accountId, attemptId, seed);
        const attempt: MissionAttempt = {
          id: attemptId,
          missionId,
          accountId,
          startedAt: nowIso(),
          status: "in_progress",
          answers: [],
          caseStudy: { strategy: "", hypotheses: "", testing: "", analysis: "", nextSteps: "", conclusions: "" },
        };
        set({
          accounts: { ...get().accounts, [accountId]: account },
          missionAttempts: { ...get().missionAttempts, [attemptId]: attempt },
          activeAccountId: accountId,
        });
        return attemptId;
      },

      saveMissionDraft: (attemptId, answers, caseStudy) => {
        const att = get().missionAttempts[attemptId];
        if (!att || att.status !== "in_progress") return;
        set({ missionAttempts: { ...get().missionAttempts, [attemptId]: { ...att, answers, caseStudy } } });
      },

      submitMission: (attemptId, answers, caseStudy) => {
        const att = get().missionAttempts[attemptId];
        if (!att) return null;
        const mission = getMission(att.missionId);
        const account = get().accounts[att.accountId];
        if (!mission || !account) return null;
        const assessment = evaluateMission(mission, account, answers, caseStudy);
        const updated: MissionAttempt = {
          ...att,
          answers,
          caseStudy,
          status: "submitted",
          submittedAt: nowIso(),
          assessment,
          snapshot: buildPortfolioSnapshot(account),
        };
        const xpGain = Math.round(assessment.total * 2);
        set({
          missionAttempts: { ...get().missionAttempts, [attemptId]: updated },
          accounts: { ...get().accounts, [account.id]: { ...account, readOnly: true } },
          learning: { ...get().learning, xp: get().learning.xp + xpGain },
        });
        return updated;
      },

      openErrorLabCase: (caseId) => {
        const c = getErrorLabCase(caseId);
        if (!c) throw new Error(`Unknown case ${caseId}`);
        const accountId = `acc_lab_${caseId}`;
        if (!get().accounts[accountId]) {
          const account = c.createAccount(accountId, seedFromString(caseId));
          set({ accounts: { ...get().accounts, [accountId]: account } });
        }
        set({ activeAccountId: accountId });
        return accountId;
      },

      submitErrorLab: (input) => {
        const c = getErrorLabCase(input.caseId);
        if (!c) return null;
        const result = evaluateErrorLab(c, input.selectedCauses, input.checkedEvidence, input.confidence, input.explanation);
        const attempt: ErrorLabAttempt = { ...input, id: newId("lab"), score: result.score, submittedAt: nowIso() };
        set({
          errorLabAttempts: { ...get().errorLabAttempts, [attempt.id]: attempt },
          learning: { ...get().learning, xp: get().learning.xp + Math.round(result.score) },
        });
        return attempt;
      },

      markArticleRead: (slug) => {
        const l = get().learning;
        if (l.readArticles.includes(slug)) return;
        set({ learning: { ...l, readArticles: [...l.readArticles, slug], xp: l.xp + 5 } });
      },

      saveQuizResult: (r) => {
        const l = get().learning;
        const prev = l.quizResults[r.articleSlug];
        const gain = !prev || r.correct > prev.correct ? (r.correct - (prev?.correct ?? 0)) * 10 : 0;
        set({ learning: { ...l, quizResults: { ...l.quizResults, [r.articleSlug]: r }, xp: l.xp + Math.max(0, gain) } });
      },

      completePractice: (id) => {
        const l = get().learning;
        if (l.completedPractice.includes(id)) return;
        set({ learning: { ...l, completedPractice: [...l.completedPractice, id], xp: l.xp + 20 } });
      },

      completeDailyTask: (dateKey, taskId) => {
        const l = get().learning;
        const list = l.completedDailyTasks[dateKey] ?? [];
        if (list.includes(taskId)) return;
        set({ learning: { ...l, completedDailyTasks: { ...l.completedDailyTasks, [dateKey]: [...list, taskId] }, xp: l.xp + 15 } });
      },

      setProfile: (patch) => set({ profile: { ...get().profile, ...patch } }),
      setPrefs: (patch) => set({ prefs: { ...get().prefs, ...patch } }),

      deleteAccount: (id) => {
        if (id === SANDBOX_ACCOUNT_ID) return;
        const accounts = { ...get().accounts };
        delete accounts[id];
        set({ accounts, activeAccountId: get().activeAccountId === id ? SANDBOX_ACCOUNT_ID : get().activeAccountId });
      },

      resetSandbox: () => {
        const sandbox = createSandboxAccount();
        set({ accounts: { ...get().accounts, [sandbox.id]: sandbox }, activeAccountId: sandbox.id });
      },

      resetAll: () => {
        const data = initialData();
        const sandbox = createSandboxAccount();
        set({ ...data, accounts: { [sandbox.id]: sandbox } });
      },

      importData: (data) => {
        if (!data || typeof data !== "object" || !data.accounts || !data.learning) throw new Error("Некоректний файл прогресу");
        set({ ...initialData(), ...data, schemaVersion: SCHEMA_VERSION });
        get().ensureInitialized();
      },

      exportData: () => {
        const s = get();
        return {
          schemaVersion: s.schemaVersion,
          profile: s.profile,
          accounts: s.accounts,
          activeAccountId: s.activeAccountId,
          learning: s.learning,
          missionAttempts: s.missionAttempts,
          errorLabAttempts: s.errorLabAttempts,
          prefs: s.prefs,
        };
      },
    }),
    {
      name: STORAGE_KEY,
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => debouncedLocalStorage),
      skipHydration: true,
      partialize: (s) => ({
        schemaVersion: s.schemaVersion,
        profile: s.profile,
        accounts: s.accounts,
        activeAccountId: s.activeAccountId,
        learning: s.learning,
        missionAttempts: s.missionAttempts,
        errorLabAttempts: s.errorLabAttempts,
        prefs: s.prefs,
      }),
      onRehydrateStorage: () => (state) => {
        state?.ensureInitialized();
        state?.setHydrated();
      },
    },
  ),
);

export function useActiveAccount(): AdAccount | undefined {
  return useAppStore((s) => s.accounts[s.activeAccountId]);
}
