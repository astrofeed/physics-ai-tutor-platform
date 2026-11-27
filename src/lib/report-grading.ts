/**
 * Shared constants and helpers for the written-report grading tool.
 * Used by both the API routes and the client UI so the two always agree
 * on limits and option values.
 */

import { z } from "zod";
import type { HumanGrading, ReportHumanReviewDetail } from "@/types/human-grading";
import type { FeedbackEmailStatus } from "@/lib/feedback-email";

export const REASONING_EFFORT_OPTIONS = ["high", "xhigh"] as const;

export const REPORT_FILE_MAX_BYTES = 30 * 1024 * 1024;
/** A pasted report instead of a PDF; long lecture notes fit well under this. */
export const REPORT_TEXT_MAX_CHARS = 120_000;

export const REPORT_FILE_MIME_TYPES = ["application/pdf"];

export const REPORT_GRADING_MODEL = "gpt-5.6-luna";

/** DB-backed hourly cap on new jobs per staff member (guards API spend). */
export const REPORT_JOBS_PER_HOUR = 60;

export const REPORT_STUDENT_ID_MAX_CHARS = 50;
export const REPORT_ASSIGNED_QUESTION_MAX_CHARS = 2_000;

/** How many report PDFs one batch submission may contain. */
export const REPORT_BATCH_MAX_FILES = 40;

export type ReportReasoningEffort = (typeof REASONING_EFFORT_OPTIONS)[number];

export type ReportJobStatusValue = "QUEUED" | "GRADING" | "DONE" | "FAILED";

export interface ReportJobSummary {
  id: string;
  title: string;
  authors: string | null;
  studentId: string | null;
  /** The question the report had to answer, from the sign-up sheet; null when none was set. */
  assignedQuestion: string | null;
  /** From the sign-up sheet for the student ID; null when not rostered. */
  englishName: string | null;
  groupLabel: string | null;
  presentationDate: string | null;
  status: ReportJobStatusValue;
  error: string | null;
  model: string | null;
  reasoningEffort: string;
  gradingDurationMs: number | null;
  rubricVersion: number | null;
  createdByName: string | null;
  createdAt: string;
  completedAt: string | null;
  /** Number of staff reviews with a saved score on this report. */
  humanReviewCount?: number;
  /** Timestamp when the current logged-in staff member scored this report, or null. */
  myGradedAt?: string | null;
}

export interface ReportJobNavigation {
  prevId: string | null;
  nextId: string | null;
  /** Next DONE report the current staff member has not yet scored. */
  nextUngradedId: string | null;
  /** Next DONE report nobody has scored yet. */
  nextCompletelyUngradedId: string | null;
  /** 1-based position in the DONE grading queue (newest first), or null if not DONE. */
  position: number | null;
  totalDone: number;
  myGradedDone: number;
}

export interface ReportJobDetail extends ReportJobSummary, FeedbackEmailStatus {
  reportText: string | null;
  reportFilename: string | null;
  /** True when the uploaded PDF is retained and can be streamed via `/pdf`. */
  hasReportPdf?: boolean;
  resultJson: string | null;
  /** The graded presentation whose suggested report topics were checked; null when none. */
  presentationJobId: string | null;
  /** The current staff member's personal review (also keeps legacy callers working). */
  human: HumanGrading;
  /** All staff reviews (personal + extra slots) on this report. */
  humanReviews?: ReportHumanReviewDetail[];
  /** Adjacent jobs for in-page prev / next / next-ungraded navigation. */
  navigation?: ReportJobNavigation | null;
}

/**
 * Structured result the grading model must return (enforced with OpenAI
 * structured outputs): a summary, evidence-referenced comments, and a score
 * with its reason for each rubric criterion.
 */
export const REPORT_CRITERION_MAX_SCORE = 10;

export const ReportCriterionScoreSchema = z.object({
  criterion: z.string(),
  weightPercent: z.number().min(0).max(100),
  score: z.number().min(0).max(REPORT_CRITERION_MAX_SCORE),
  reason: z.string(),
});

export const SUGGESTION_STATUSES = ["not_addressed", "partially_addressed", "completed"] as const;

/** How far the report went with one suggestion the presentation AI made for it. */
export const ReportSuggestionCheckSchema = z.object({
  suggestion: z.string(),
  status: z.enum(SUGGESTION_STATUSES),
  evidence: z.string(),
});

export const COMMENT_CATEGORIES = ["strength", "issue", "note", "ai_style"] as const;

export const ReportCommentSchema = z.object({
  reference: z.string(),
  comment: z.string(),
  /** 1-based PDF page number where this remark applies; null for general remarks or pasted text. */
  page: z.number().int().min(1).nullable(),
  /** Short verbatim excerpt (5-15 words) from that page for in-PDF highlighting; null for figures/equations. */
  quote: z.string().nullable(),
  /** Quick visual category for graders: strength, issue, note, or ai_style. */
  category: z.enum(COMMENT_CATEGORIES).nullable(),
});

export const ReportEvaluationSchema = z.object({
  summary: z.string(),
  comments: z.array(ReportCommentSchema),
  /** Null on jobs graded before per-criterion scores existed. */
  criterionScores: z.array(ReportCriterionScoreSchema).nullable(),
  /** One entry per presentation suggestion; null when the student had no graded presentation. */
  suggestionChecks: z.array(ReportSuggestionCheckSchema).nullable(),
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

/** "113012345_final.pdf" → "113012345_final". */
export function filenameStem(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

export type ReportEvaluation = z.infer<typeof ReportEvaluationSchema>;
export type ReportComment = z.infer<typeof ReportCommentSchema>;
export type ReportCommentCategory = (typeof COMMENT_CATEGORIES)[number];
export type ReportCriterionScore = z.infer<typeof ReportCriterionScoreSchema>;
export type ReportSuggestionCheck = z.infer<typeof ReportSuggestionCheckSchema>;
export type SuggestionStatus = ReportSuggestionCheck["status"];

export const SUGGESTION_STATUS_LABELS: Record<SuggestionStatus, string> = {
  not_addressed: "Not pursued",
  partially_addressed: "Explored in part",
  completed: "Developed",
};

const OPTIONAL_EVALUATION_FIELDS = ["criterionScores", "suggestionChecks"] as const;

/** Parses a stored evaluation; null for bad JSON. Tolerates older jobs
 * graded before per-criterion scores, suggestion checks, or comment anchors existed. */
export function parseReportEvaluation(json: string | null): ReportEvaluation | null {
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      for (const field of OPTIONAL_EVALUATION_FIELDS) {
        if (!(field in record)) record[field] = null;
      }
      if (Array.isArray(record.comments)) {
        record.comments = record.comments.map((entry) => {
          if (!entry || typeof entry !== "object") return entry;
          const item = entry as Record<string, unknown>;
          return {
            ...item,
            page: "page" in item ? item.page : null,
            quote: "quote" in item ? item.quote : null,
            category: "category" in item ? item.category : null,
          };
        });
      }
    }
    const result = ReportEvaluationSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
