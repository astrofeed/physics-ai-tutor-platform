/**
 * Staff scores recorded beside the AI's on report and presentation grading
 * jobs, so the two can be compared at the end of the term. Shared by the API,
 * the detail pages and the CSV exports.
 */

import { z } from "zod";

export interface HumanScoreEntry {
  /** Rubric criterion (reports) or scorecard category (presentations). */
  name: string;
  score: number;
}

export interface HumanGrading {
  scores: HumanScoreEntry[];
  /** First time the scores were saved; later edits keep it. */
  gradedAt: string | null;
  gradedByName: string | null;
  /** First time staff opened the AI result on this job. */
  aiRevealedAt: string | null;
}

export const HUMAN_SCORE_MAX_ENTRIES = 50;

export const HumanScoresInputSchema = z.object({
  scores: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        score: z.number().finite().min(0),
      })
    )
    .min(1)
    .max(HUMAN_SCORE_MAX_ENTRIES),
});

export type HumanScoresInput = z.infer<typeof HumanScoresInputSchema>;

/**
 * True when the staff grade was entered without having seen the AI's result.
 * Saving human scores also reveals the AI result at the same instant, so a
 * blind grade has `gradedAt <= aiRevealedAt`.
 */
export function gradedBlind(human: HumanGrading): boolean | null {
  if (!human.gradedAt) return null;
  if (!human.aiRevealedAt) return true;
  return new Date(human.gradedAt).getTime() <= new Date(human.aiRevealedAt).getTime();
}

/** Weighted mean of scores whose weights are given by `weightOf`; null when nothing is weighted. */
export function weightedAverage(
  entries: HumanScoreEntry[],
  weightOf: (name: string) => number | undefined
): number | null {
  let weightSum = 0;
  let total = 0;
  for (const entry of entries) {
    const weight = weightOf(entry.name);
    if (weight === undefined) continue;
    weightSum += weight;
    total += entry.score * weight;
  }
  return weightSum > 0 ? total / weightSum : null;
}
