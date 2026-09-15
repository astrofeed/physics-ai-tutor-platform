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
  /** Per-item scores; empty when staff entered only a total. */
  scores: HumanScoreEntry[];
  /** Total entered directly instead of per-item scores; null otherwise. */
  total: number | null;
  /** First time the scores were saved; later edits keep it. */
  gradedAt: string | null;
  gradedByName: string | null;
  /** First time staff opened the AI result on this job. */
  aiRevealedAt: string | null;
}

export const HUMAN_SCORE_MAX_ENTRIES = 50;

const HumanScoreEntrySchema = z.object({
  name: z.string().min(1).max(200),
  score: z.number().finite().min(0),
});

/**
 * Either per-item scores or one total — the quick option when a talk is
 * followed by the next one in minutes. Saving one clears the other.
 */
export const HumanScoresInputSchema = z.union([
  z.object({
    scores: z.array(HumanScoreEntrySchema).min(1).max(HUMAN_SCORE_MAX_ENTRIES),
  }),
  z.object({ total: z.number().finite().min(0) }),
]);

export type HumanScoresInput = z.infer<typeof HumanScoresInputSchema>;

/**
 * The staff total to compare with the AI's: the directly entered one, else
 * the one derived from per-item scores by `fromItems`; null when ungraded.
 */
export function humanTotalOf(
  human: HumanGrading,
  fromItems: (scores: HumanScoreEntry[]) => number | null
): number | null {
  if (human.total !== null) return human.total;
  return human.scores.length > 0 ? fromItems(human.scores) : null;
}

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

/** Plain sum (presentation scorecard categories add up to the /100 total). */
export function sumScores(entries: HumanScoreEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.score, 0);
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
