"use client";

import { useMemo } from "react";
import { LEARNING_PATH } from "@/content/learning-path";
import { PASS_SCORE } from "@/content/missions";
import type { LearningLevel, LearningProgress, MissionAttempt } from "@/domain/types";
import { useAppStore } from "@/store/app-store";

export const LEVEL_LABELS: Record<LearningLevel, string> = {
  beginner: "Beginner",
  junior: "Junior Targetologist",
  middle: "Middle Targetologist",
  advanced: "Advanced Performance Marketer",
};

export function bestScores(attempts: Record<string, MissionAttempt>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of Object.values(attempts)) {
    if (a.status !== "submitted" || !a.assessment) continue;
    out[a.missionId] = Math.max(out[a.missionId] ?? 0, a.assessment.total);
  }
  return out;
}

export interface LevelInfo {
  level: LearningLevel;
  label: string;
  xp: number;
  /** Чи пройдено фінальну місію найвищого рівня. */
  completedPath: boolean;
  /** Прогрес маршруту 0..100. */
  pathProgress: number;
  passedMissions: number;
  nextStep: string;
}

export function computeLevel(attempts: Record<string, MissionAttempt>, learning: LearningProgress): LevelInfo {
  const scores = bestScores(attempts);
  const passed = (id: string) => (scores[id] ?? 0) >= PASS_SCORE;
  let level: LearningLevel = "beginner";
  let completedPath = false;
  for (let i = 0; i < LEARNING_PATH.length; i++) {
    const l = LEARNING_PATH[i];
    if (passed(l.finalMission)) {
      if (i + 1 < LEARNING_PATH.length) level = LEARNING_PATH[i + 1].id;
      else completedPath = true;
    } else break;
  }
  let total = 0;
  let done = 0;
  for (const l of LEARNING_PATH) {
    for (const m of l.modules) {
      for (const a of m.articles) {
        total++;
        if (learning.readArticles.includes(a)) done++;
      }
      if (m.practice) {
        total++;
        if (learning.completedPractice.includes(m.practice.id)) done++;
      }
      for (const mid of m.missions) {
        total++;
        if (passed(mid)) done++;
      }
    }
    total++;
    if (passed(l.finalMission)) done++;
  }
  const current = LEARNING_PATH.find((l) => l.id === level)!;
  const nextStep = completedPath
    ? "Маршрут завершено — повторюйте місії Error Lab і аудити для закріплення."
    : `Фінальне завдання рівня: місія ${current.finalMission.replace("m", "№")}`;
  return {
    level,
    label: LEVEL_LABELS[level],
    xp: learning.xp,
    completedPath,
    pathProgress: total ? Math.round((done / total) * 100) : 0,
    passedMissions: Object.keys(scores).filter(passed).length,
    nextStep,
  };
}

export function useLevel(): LevelInfo {
  const attempts = useAppStore((s) => s.missionAttempts);
  const learning = useAppStore((s) => s.learning);
  return useMemo(() => computeLevel(attempts, learning), [attempts, learning]);
}
