import type { ReportEvaluation, ReportJobStatusValue } from "@/lib/report-grading";
import type { BadgeVariant } from "@/components/presentation-grading/job-format";

export {
  formatDuration,
  formatTimestamp,
} from "@/components/presentation-grading/job-format";

export const REPORT_STATUS_LABELS: Record<ReportJobStatusValue, string> = {
  QUEUED: "Queued",
  GRADING: "Grading",
  DONE: "Done",
  FAILED: "Failed",
};

export const REPORT_STATUS_BADGE_VARIANTS: Record<ReportJobStatusValue, BadgeVariant> = {
  QUEUED: "secondary",
  GRADING: "warning",
  DONE: "success",
  FAILED: "destructive",
};

/** Markdown rendering of the whole review, for the copy button. */
export function reportEvaluationToText(e: ReportEvaluation): string {
  const comments = e.comments
    .map((c, i) => `${i + 1}. [${c.reference}] ${c.comment}`)
    .join("\n");
  const questions = e.questions
    .map((q, i) => `${i + 1}. ${q.question}\n   Why: ${q.reason}`)
    .join("\n");
  return `## Summary\n${e.summary}\n\n## Comments\n${comments}\n\n## Questions for the author\n${questions}`;
}
