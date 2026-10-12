import type { AdAccount, LearningLevel, SkillDimension } from "@/domain/types";
import type { RubricItem } from "@/scoring/checks";

export interface MissionKpi {
  label: string;
  target: string;
}

export interface MissionBrief {
  business: string;
  product: string;
  audience: string;
  goal: string;
  budget: string;
  conversionValue: string;
  margin?: string;
  kpis: MissionKpi[];
  constraints: string[];
  initialData: string[];
  evaluation: string[];
}

export interface MissionQuestion {
  id: string;
  kind: "single" | "multi" | "number" | "text";
  prompt: string;
  hint?: string;
  options?: { id: string; text: string }[];
  /** Динамічні варіанти (наприклад, назви оголошень з акаунта). */
  optionsFn?: (account: AdAccount) => { id: string; text: string }[];
  correct?: string[];
  /** Динамічна правильна відповідь, що залежить від результатів симуляції. */
  correctFn?: (account: AdAccount) => string[];
  /** Для числових питань: еталон обчислюється з даних акаунта. */
  expectedValue?: (account: AdAccount) => number | null;
  tolerance?: number;
  unit?: string;
  keywords?: string[][];
  minLength?: number;
  dimension: SkillDimension;
  weight: number;
  /** Текстове питання з обґрунтуванням: без нього бал за вибір обмежено 50%. */
  evidenceQuestionId?: string;
  askConfidence?: boolean;
  explanation: string;
}

export interface MissionDefinition {
  id: string;
  number: number;
  title: string;
  level: LearningLevel;
  type: "build" | "optimize" | "analyze" | "audit" | "report";
  summary: string;
  estimatedMinutes: number;
  brief: MissionBrief;
  /** Мінімум днів доставки кампаній користувача перед здачею (0 — не потрібно). */
  minDeliveryDays: number;
  /** Що саме зробити в кабінеті (покроково). */
  tasks: string[];
  questions: MissionQuestion[];
  rubric: RubricItem[];
  /** Ключові поняття, які мають прозвучати в кейсі (аргументація). */
  caseStudyKeywords: string[][];
  expert: { explanation: string; alternative: string };
  recommendedArticles: string[];
  skills: SkillDimension[];
  createAccount: (accountId: string, attemptId: string, seed: number) => AdAccount;
}

export const PASS_SCORE = 70;
