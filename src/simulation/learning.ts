import type { AdSet, LearningState, SimDay } from "@/domain/types";

/**
 * Навчальна фаза (learning phase).
 * Meta описує: набір зазвичай виходить з навчання після ~50 подій оптимізації
 * протягом 7 днів після останнього суттєвого редагування; якщо це малоймовірно — статус Learning limited.
 */

export const LEARNING_EVENTS_THRESHOLD = 50;
export const LEARNING_WINDOW_DAYS = 7;

export function initialLearning(): LearningState {
  return { phase: "not_started", lastSignificantEditDay: null, eventsSinceEdit: 0, dailyEvents: [], resets: 0, pausedSinceDay: null };
}

export function resetLearning(state: LearningState, day: SimDay): LearningState {
  if (state.phase === "not_started") return state;
  return { ...state, phase: "learning", lastSignificantEditDay: day, eventsSinceEdit: 0, dailyEvents: [], resets: state.resets + 1 };
}

/** Оновлення стану після симульованого дня доставки. */
export function advanceLearning(state: LearningState, day: SimDay, eventsToday: number, delivered: boolean): LearningState {
  if (!delivered && state.phase === "not_started") return state;
  let next: LearningState = { ...state, dailyEvents: [...state.dailyEvents] };
  if (next.phase === "not_started") {
    next = { ...next, phase: "learning", lastSignificantEditDay: day, eventsSinceEdit: 0, dailyEvents: [] };
  }
  next.eventsSinceEdit += eventsToday;
  next.dailyEvents.push(eventsToday);
  if (next.dailyEvents.length > 14) next.dailyEvents = next.dailyEvents.slice(-14);

  if (next.phase === "active") return next;

  const rolling = next.dailyEvents.slice(-LEARNING_WINDOW_DAYS).reduce((a, b) => a + b, 0);
  const daysSince = day - (next.lastSignificantEditDay ?? day) + 1;
  if (rolling >= LEARNING_EVENTS_THRESHOLD) {
    next.phase = "active";
  } else if (daysSince >= LEARNING_WINDOW_DAYS) {
    next.phase = "learning_limited";
  } else if (daysSince >= 3) {
    const projected = (next.eventsSinceEdit / daysSince) * LEARNING_WINDOW_DAYS;
    next.phase = projected < LEARNING_EVENTS_THRESHOLD * 0.7 ? "learning_limited" : "learning";
  } else {
    next.phase = "learning";
  }
  return next;
}

export function learningLabel(adSet: Pick<AdSet, "learning">): string {
  switch (adSet.learning.phase) {
    case "learning":
      return "Навчання";
    case "learning_limited":
      return "Навчання обмежене";
    case "active":
      return "Активна";
    default:
      return "Не розпочато";
  }
}
