"use client";

import Link from "next/link";
import { MarkdownContent } from "@/components/ui/markdown-content";
import {
  SUGGESTION_STATUS_LABELS,
  type ReportSuggestionCheck,
} from "@/lib/report-grading";

interface Props {
  checks: ReportSuggestionCheck[];
  presentationJobId: string | null;
  onToggle: (open: boolean) => void;
}

export function ReportSuggestionChecks({ checks, presentationJobId, onToggle }: Props) {
  return (
    <details className="space-y-2 text-sm" onToggle={(e) => onToggle(e.currentTarget.open)}>
      <summary className="cursor-pointer font-medium">Optional presentation directions</summary>
      <p className="text-muted-foreground">
        A student’s own direction counts just as much. Skipping a suggestion does not lower
        or cap the score under the updated rubric.
      </p>
      {presentationJobId ? (
        <Link
          href={`/presentation-grading/${presentationJobId}`}
          className="text-xs underline text-muted-foreground"
        >
          From the presentation review
        </Link>
      ) : null}
      <ul className="divide-y">
        {checks.map((check, i) => (
          <li key={i} className="space-y-1 py-2">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-gray-900 dark:text-gray-100">{check.suggestion}</p>
              <span className="shrink-0 text-xs text-muted-foreground">
                {SUGGESTION_STATUS_LABELS[check.status]}
              </span>
            </div>
            <MarkdownContent content={check.evidence} className="text-sm" />
          </li>
        ))}
      </ul>
    </details>
  );
}
