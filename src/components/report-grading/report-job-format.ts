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
  const text = `## Summary\n${e.summary}\n\n## Comments\n${comments}`;
  if (!e.criterionScores) return text;
  const scores = e.criterionScores
    .map((s) => `- ${s.criterion} (${s.weightPercent}%): ${s.score}/10\n  ${s.reason}`)
    .join("\n");
  return `${text}\n\n## Criterion scores\n${scores}`;
}
