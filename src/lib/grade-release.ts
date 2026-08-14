import type { GradingMode, OverallGradeState } from "@/components/grading/types";

/** Sum of the per-question scores a grader has entered so far. */
export function sumQuestionScores(scores: readonly { score: number }[]): number {
  return scores.reduce((total, { score }) => total + (Number.isFinite(score) ? score : 0), 0);
}

/**
 * What confirming the "Overall Grade" override should do. A blank field must
 * never release a zero, and replacing a detailed total needs a warning.
 */
export type OverrideConfirmAction = "clear" | "reject-blank" | "warn-differs" | "confirm";

export function overrideConfirmAction(
  overall: OverallGradeState,
  perQuestionTotal: number,
  mode: GradingMode
): OverrideConfirmAction {
  if (overall.confirmed) return "clear";
  if (overall.score === null) return "reject-blank";
  if (mode === "per-question" && overall.score !== perQuestionTotal) return "warn-differs";
  return "confirm";
}

/** The overall fields to send on a final save, or `null` when there is no override. */
export function overallGradePayload(
  overall: OverallGradeState
): { overallScore: number; overallFeedback: string } | null {
  if (!overall.confirmed || overall.score === null) return null;
  return { overallScore: overall.score, overallFeedback: overall.feedback };
}
