import {
  SUGGESTION_STATUS_LABELS,
  type ReportEvaluation,
  type ReportCommentCategory,
  type ReportJobStatusValue,
} from "@/lib/report-grading";
import type { BadgeVariant } from "@/components/presentation-grading/job-format";
import { COMMENT_CATEGORY_META, effectiveCategory } from "./report-comment-categories";

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

export function reportEvaluationToText(e: ReportEvaluation, options: {
  categories: Set<ReportCommentCategory>; includeSummary: boolean; includeDirections: boolean; includeScores: boolean;
  openEvidence: ReadonlySet<number>;
}): string {
  const comments = e.comments
    .flatMap((c, i) => {
      const category = effectiveCategory(c.category);
      if (!options.categories.has(category)) return [];
      const header = `#${i + 1}${c.page ? ` · p. ${c.page}` : ""} · ${COMMENT_CATEGORY_META[category].label}`;
      return [[`${header}: ${c.comment}`, c.needsStaffCheck && "Needs staff review",
        ...(options.openEvidence.has(i) ? [c.evidenceKind, c.criterion, c.reference, c.quote] : []),
      ].filter(Boolean).join("\n")];
    })
    .join("\n");
  const sections = options.includeSummary ? [`## Summary\n${e.summary}`] : [];
  if (options.includeDirections && e.suggestionChecks?.length) {
    const checks = e.suggestionChecks
      .map((c) => `- ${c.suggestion} — ${SUGGESTION_STATUS_LABELS[c.status]}\n  ${c.evidence}`)
      .join("\n");
    sections.push(`## Presentation directions (observations)\n${checks}`);
  }
  if (comments) sections.push(`## Comments\n${comments}`);
  if (options.includeScores && e.criterionScores) {
    const scores = e.criterionScores
      .map((s) => `- ${s.criterion} (${s.weightPercent}%): ${s.score}/10\n  ${s.reason}`)
      .join("\n");
    sections.push(`## Criterion scores\n${scores}`);
  }
  return sections.join("\n\n");
}
