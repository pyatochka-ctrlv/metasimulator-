import type { ErrorLabCase } from "@/content/error-lab";
import { reasoningScore } from "./checks";

export interface ErrorLabResult {
  score: number;
  correctCauses: string[];
  missedCauses: string[];
  wrongCauses: string[];
  evidenceScore: number;
  calibration: string;
  explanationScore: number;
}

/**
 * Оцінка діагнозу: причини (з урахуванням хибних), докази, калібрування впевненості, пояснення.
 * Вгадування без доказів і пояснення не дає максимального балу.
 */
export function evaluateErrorLab(c: ErrorLabCase, selectedCauses: string[], evidence: string[], confidence: 1 | 2 | 3, explanation: string): ErrorLabResult {
  const correctIds = c.causes.filter((x) => x.correct).map((x) => x.id);
  const correctCauses = selectedCauses.filter((s) => correctIds.includes(s));
  const wrongCauses = selectedCauses.filter((s) => !correctIds.includes(s));
  const missedCauses = correctIds.filter((s) => !selectedCauses.includes(s));
  const causeScore = Math.max(0, (correctCauses.length - wrongCauses.length * 0.75) / correctIds.length);

  const relevant = c.evidence.filter((e) => e.relevant).map((e) => e.id);
  const evTp = evidence.filter((e) => relevant.includes(e)).length;
  const evFp = evidence.filter((e) => !relevant.includes(e)).length;
  const evidenceScore = Math.max(0, (evTp - evFp * 0.5) / relevant.length);

  const keywords = c.causes.filter((x) => x.correct).map((x) => x.text.toLowerCase().split(/[^a-zа-яіїєґ0-9]+/i).filter((w) => w.length > 5).slice(0, 3));
  const explanationScore = reasoningScore(explanation, keywords, 120);

  let calibrationPenalty = 0;
  let calibration = "Впевненість відповідає якості діагнозу.";
  if (confidence === 3 && causeScore < 0.5) {
    calibrationPenalty = 10;
    calibration = "Висока впевненість при неточному діагнозі — це ризиковано в реальній роботі (−10).";
  } else if (confidence === 1 && causeScore >= 0.99 && evidenceScore >= 0.8) {
    calibration = "Діагноз точний — можна бути впевненішим, коли докази однозначні.";
  } else if (c.diagnosticConfidence.level === "низька" && confidence === 3) {
    calibrationPenalty = 5;
    calibration = "Дані цього кейсу не дозволяють високої впевненості (−5).";
  }

  const score = Math.max(0, Math.round(causeScore * 55 + evidenceScore * 25 + explanationScore * 20 - calibrationPenalty));
  return { score, correctCauses, missedCauses, wrongCauses, evidenceScore, calibration, explanationScore };
}
