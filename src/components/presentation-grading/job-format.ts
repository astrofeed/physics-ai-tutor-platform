import type { PresentationJobStatusValue } from "@/lib/presentation-grading";

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

export function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
