import type { z } from "zod";
import type { Prisma, ReportGradingJob } from "@prisma/client";
import type { HumanScoresInputSchema } from "@/lib/human-grading";

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
  comments: string | null;
  /** First time the scores were saved; later edits keep it. */
  gradedAt: string | null;
  gradedByName: string | null;
  /** First time staff opened the AI result on this job. */
  aiRevealedAt: string | null;
}

export type HumanScoresInput = z.infer<typeof HumanScoresInputSchema>;

export type HumanGradingRow = Pick<
  ReportGradingJob,
  "aiRevealedAt" | "humanGradedAt" | "humanTotal" | "humanComments"
> & { humanGradedBy: { name: string | null } | null };

export interface HumanScoreRow {
  name: string;
  score: Prisma.Decimal;
}

export type SaveHumanScoresResult =
  | { ok: true }
  | { ok: false; status: 404 | 409 | 400; error: string };
