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

export const REPORT_STUDENT_ID_MAX_CHARS = 50;

/** How many report PDFs one batch submission may contain. */
export const REPORT_BATCH_MAX_FILES = 40;

export type ReportReasoningEffort = (typeof REASONING_EFFORT_OPTIONS)[number];

export type ReportJobStatusValue = "QUEUED" | "GRADING" | "DONE" | "FAILED";

export interface ReportJobSummary {
  id: string;
  title: string;
  authors: string | null;
  studentId: string | null;
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
  weightPercent: z.number().min(0).max(100),
  score: z.number().min(0).max(10),
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

/**
 * Pulls a student ID out of an uploaded file's name (students are asked to
 * put their ID in the filename). Tolerates extra text around it: the longest
 * run of 5–15 digits wins, e.g. "王小明_113012345_final.pdf" → "113012345".
 */
export function studentIdFromFilename(filename: string): string | null {
  const runs = filename.match(/\d{5,15}/g);
  if (!runs) return null;
  return runs.reduce((best, run) => (run.length > best.length ? run : best));
}

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
