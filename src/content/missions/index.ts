import { m01, m02, m03, m04, m05 } from "./build-missions";
import { m06, m07, m08, m09, m10 } from "./optimize-missions";
import { m11, m12, m13, m14, m15 } from "./advanced-missions";
import type { MissionDefinition } from "./types";

export const MISSIONS: MissionDefinition[] = [m01, m02, m03, m04, m05, m06, m07, m08, m09, m10, m11, m12, m13, m14, m15];

export const getMission = (id: string) => MISSIONS.find((m) => m.id === id);

export const MISSION_TYPE_LABEL: Record<MissionDefinition["type"], string> = {
  build: "Запуск",
  optimize: "Оптимізація",
  analyze: "Аналіз",
  audit: "Аудит",
  report: "Звітність",
};

export type { MissionDefinition } from "./types";
export { PASS_SCORE } from "./types";
