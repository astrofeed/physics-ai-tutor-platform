import type { HumanScoreEntry } from "@/types/human-grading";

export const REPORT_CRITERION_MAX_SCORE = 10;
export const REPORT_TOTAL_MAX_SCORE = 100;
const SCALE = REPORT_TOTAL_MAX_SCORE / REPORT_CRITERION_MAX_SCORE;

// Both report total columns retain their historical /10 scale (DECIMAL with two places).
export const reportTotalFromStorage = (value: number) => Number((value * SCALE).toFixed(1));
export const reportTotalToStorage = (points: number) => points / SCALE;

export function reportWeightedTotal(entries: HumanScoreEntry[], weightOf: (name: string) => number | undefined) {
  let weightSum = 0;
  let points = 0;
  for (const { name, score } of entries) {
    const weight = weightOf(name);
    if (weight === undefined) return null;
    weightSum += weight;
    points += (score / REPORT_CRITERION_MAX_SCORE) * weight;
  }
  return Math.abs(weightSum - 100) < 0.000001 ? points : null;
}
