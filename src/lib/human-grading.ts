/**
 * Staff scores recorded beside the AI's on report and presentation grading
 * jobs, so the two can be compared at the end of the term. Shared by the API,
 * the detail pages and the CSV exports.
 */

import { z } from "zod";
import type { HumanGrading, HumanScoreEntry } from "@/types/human-grading";
export type { HumanGrading, HumanScoreEntry, HumanScoresInput } from "@/types/human-grading";

export const HUMAN_SCORE_MAX_ENTRIES = 50;
export const HUMAN_COMMENTS_MAX_CHARS = 10_000;

const HumanCommentsSchema = z.string().max(HUMAN_COMMENTS_MAX_CHARS).optional();

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
    comments: HumanCommentsSchema,
  }),
  z.object({ total: z.number().finite().min(0), comments: HumanCommentsSchema }),
]);

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
