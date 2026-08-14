/**
 * Deterministic auto-grading for MC and NUMERIC answers. FREE_RESPONSE is never
 * auto-graded — it is left for a grader (optionally with an AI pre-grade
 * suggestion, which is not a score until accepted).
 */

export type ToleranceUnit = "ABSOLUTE" | "PERCENT";

export interface GradableQuestion {
  questionType: string;
  correctAnswer: string | null;
  points: number;
  tolerance?: number | null;
  toleranceUnit?: ToleranceUnit | null;
}

export interface AutoGradeResult {
  autoGraded: boolean;
  score: number | null;
}

export const MAX_TOLERANCE_PERCENT = 100;

const NOT_AUTO_GRADED: AutoGradeResult = { autoGraded: false, score: null };

/** Widest deviation from `expected` that still counts as correct. */
export function toleranceWindow(
  expected: number,
  tolerance: number | null | undefined,
  unit: ToleranceUnit | null | undefined
): number {
  if (tolerance === null || tolerance === undefined || !Number.isFinite(tolerance)) return 0;
  const window = unit === "PERCENT" ? (Math.abs(expected) * tolerance) / 100 : tolerance;
  return Math.abs(window);
}

function gradeNumeric(answer: string, question: GradableQuestion): AutoGradeResult {
  const given = Number(answer.trim());
  const expected = Number((question.correctAnswer || "").trim());
  if (!Number.isFinite(given) || !Number.isFinite(expected)) {
    return { autoGraded: true, score: 0 };
  }

  const window = toleranceWindow(expected, question.tolerance, question.toleranceUnit);
  // Absolute difference, so trailing zeros and scientific notation compare by
  // value: 9.80, 9.8 and 9.8e0 are the same answer. The slack keeps binary
  // rounding (9.8 - 9.75 = 0.05000000000000071) from failing an exact boundary.
  const slack = Math.max(Math.abs(expected), Math.abs(given), 1) * Number.EPSILON * 8;
  const correct = Math.abs(given - expected) <= window + slack;
  return { autoGraded: true, score: correct ? question.points : 0 };
}

function gradeMultipleChoice(answer: string, question: GradableQuestion): AutoGradeResult {
  const correct =
    answer.trim().toLowerCase() === (question.correctAnswer || "").trim().toLowerCase();
  return { autoGraded: true, score: correct ? question.points : 0 };
}

export function autoGradeAnswer(
  answer: string,
  question: GradableQuestion | undefined
): AutoGradeResult {
  if (!question) return NOT_AUTO_GRADED;
  if (question.questionType === "NUMERIC") return gradeNumeric(answer, question);
  if (question.questionType === "MC") return gradeMultipleChoice(answer, question);
  return NOT_AUTO_GRADED;
}

/**
 * Validates a TA-authored tolerance. Returns an error message, or null when the
 * value is acceptable.
 */
export function validateTolerance(
  questionType: string,
  tolerance: number | null | undefined,
  unit: ToleranceUnit
): string | null {
  if (tolerance === null || tolerance === undefined) return null;
  if (questionType !== "NUMERIC") {
    return "Tolerance only applies to numeric questions";
  }
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    return "Tolerance must be zero or a positive number";
  }
  if (unit === "PERCENT" && tolerance > MAX_TOLERANCE_PERCENT) {
    return `Percent tolerance must be at most ${MAX_TOLERANCE_PERCENT}%`;
  }
  return null;
}
