"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { MarkdownContent } from "@/components/ui/markdown-content";
import {
  SUGGESTION_STATUS_LABELS,
  type ReportSuggestionCheck,
  type SuggestionStatus,
} from "@/lib/report-grading";
import type { BadgeVariant } from "@/components/presentation-grading/job-format";

const STATUS_BADGE_VARIANTS: Record<SuggestionStatus, BadgeVariant> = {
  not_addressed: "destructive",
  partially_addressed: "warning",
  completed: "success",
};

interface Props {
  checks: ReportSuggestionCheck[];
  presentationJobId: string | null;
}

/** Whether the report acted on each topic suggestion the presentation AI made. */
export function ReportSuggestionChecks({ checks, presentationJobId }: Props) {
  const doneCount = checks.filter((c) => c.status === "completed").length;
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Presentation suggestions
          <span className="ml-1.5 text-xs font-normal text-gray-500">
            {doneCount}/{checks.length} done
          </span>
        </h3>
        {presentationJobId ? (
          <Link
            href={`/presentation-grading/${presentationJobId}`}
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            From the presentation review
          </Link>
        ) : null}
      </div>
      <ol className="space-y-3">
        {checks.map((check, i) => (
          <li
            key={i}
            className="rounded-lg border border-gray-200 dark:border-gray-800 p-3 text-sm space-y-1"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-gray-900 dark:text-gray-100">{check.suggestion}</p>
              <Badge variant={STATUS_BADGE_VARIANTS[check.status]} className="shrink-0">
                {SUGGESTION_STATUS_LABELS[check.status]}
              </Badge>
            </div>
            <MarkdownContent content={check.evidence} className="text-sm" />
          </li>
        ))}
      </ol>
    </section>
  );
}
