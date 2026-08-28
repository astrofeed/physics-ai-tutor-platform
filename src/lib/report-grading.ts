/**
 * Shared constants and helpers for the written-report grading tool.
 * Used by both the API routes and the client UI so the two always agree
 * on limits and option values.
 */

import { z } from "zod";

export const REASONING_EFFORT_OPTIONS = ["high", "xhigh"] as const;

export const REPORT_FILE_MAX_BYTES = 30 * 1024 * 1024;
/** A pasted report instead of a PDF; long lecture notes fit well under this. */
export const REPORT_TEXT_MAX_CHARS = 120_000;

export const REPORT_FILE_MIME_TYPES = ["application/pdf"];

export const REPORT_GRADING_MODEL = "gpt-5.6-luna";

/** DB-backed hourly cap on new jobs per staff member (guards API spend). */
export const REPORT_JOBS_PER_HOUR = 60;

export type ReportReasoningEffort = (typeof REASONING_EFFORT_OPTIONS)[number];

export type ReportJobStatusValue = "QUEUED" | "GRADING" | "DONE" | "FAILED";

export interface ReportJobSummary {
  id: string;
  title: string;
  authors: string | null;
  status: ReportJobStatusValue;
  error: string | null;
  model: string | null;
  reasoningEffort: string;
  gradingDurationMs: number | null;
  rubricVersion: number | null;
  createdByName: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ReportJobDetail extends ReportJobSummary {
  reportText: string | null;
  reportFilename: string | null;
  resultJson: string | null;
}

/**
 * Structured result the grading model must return (enforced with OpenAI
 * structured outputs): a summary, evidence-referenced comments, and a score
 * with its reason for each rubric criterion.
 */
export const ReportCriterionScoreSchema = z.object({
  criterion: z.string(),
  weightPercent: z.number(),
  score: z.number(),
  reason: z.string(),
});

export const ReportEvaluationSchema = z.object({
  summary: z.string(),
  comments: z.array(
    z.object({
      reference: z.string(),
      comment: z.string(),
    })
  ),
  /** Null on jobs graded before per-criterion scores existed. */
  criterionScores: z.array(ReportCriterionScoreSchema).nullable(),
});

export type ReportEvaluation = z.infer<typeof ReportEvaluationSchema>;
export type ReportCriterionScore = z.infer<typeof ReportCriterionScoreSchema>;

/** Parses a stored evaluation; null for bad JSON. Tolerates older jobs
 * graded before per-criterion scores existed. */
export function parseReportEvaluation(json: string | null): ReportEvaluation | null {
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed && typeof parsed === "object" && !("criterionScores" in parsed)) {
      (parsed as Record<string, unknown>).criterionScores = null;
    }
    const result = ReportEvaluationSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
