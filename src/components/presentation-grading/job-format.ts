import type {
  PresentationEvaluation,
  PresentationJobStatusValue,
} from "@/lib/presentation-grading";

export const STATUS_LABELS: Record<PresentationJobStatusValue, string> = {
  QUEUED: "Queued",
  TRANSCRIBING: "Transcribing",
  GRADING: "Grading",
  DONE: "Done",
  FAILED: "Failed",
};

export type BadgeVariant = "secondary" | "warning" | "success" | "destructive";

export const STATUS_BADGE_VARIANTS: Record<PresentationJobStatusValue, BadgeVariant> = {
  QUEUED: "secondary",
  TRANSCRIBING: "warning",
  GRADING: "warning",
  DONE: "success",
  FAILED: "destructive",
};

export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

/** Markdown rendering of the analysis half, for the copy button. */
export function analysisToText(e: PresentationEvaluation): string {
  const scorecard = e.scorecard
    .map(
      (r) =>
        `- ${r.category}: ${r.awardedPoints}/${r.maxPoints}` +
        `${r.provisional ? " (provisional)" : ""} — ${r.justification}`
    )
    .join("\n");
  const errors =
    e.physicsErrorLog.length === 0
      ? "No physics errors found."
      : e.physicsErrorLog
          .map(
            (err, i) =>
              `${i + 1}. [${err.reference}] ${err.error}\n   Check: ${err.check}\n   Correct: ${err.correction}\n   Ask: ${err.guidingQuestion}`
          )
          .join("\n");
  const elements = e.requiredElements
    .map((el) => `- [${el.status}] ${el.element}${el.reference ? ` — ${el.reference}` : ""}`)
    .join("\n");
  const flags =
    e.flags.length === 0
      ? "None."
      : e.flags
          .map((f) => `- ${f.concern} (${f.confidence} confidence): ${f.evidence}`)
          .join("\n");
  return `## Summary\n${e.summary}\n\n## Scorecard (total ${e.totalScore}/100)\n${scorecard}\n\n## Physics error log\n${errors}\n\n## Required elements\n${elements}\n\n## Flags\n${flags}`;
}

/** Markdown rendering of the feedback-notes half, for the copy button. */
export function notesToText(e: PresentationEvaluation): string {
  const strengths = e.strengths.map((s) => `- ${s}`).join("\n");
  const guiding = e.guidingQuestions
    .map((g) => `${g.reference}\n${g.questions.map((q) => `- ${q}`).join("\n")}`)
    .join("\n\n");
  const qa = e.qaQuestions
    .map((q, i) => `${i + 1}. ${q.question}\n   Why: ${q.reason}`)
    .join("\n");
  return `## What they did well\n${strengths}\n\n## Questions to think about\n${guiding}\n\n## Live Q&A questions\n${qa}\n\n## Advice for the individual reports\n${e.reportAdvice}`;
}

export function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
