/**
 * Shared constants and helpers for the TA presentation-grading tool.
 * Used by both the upload/processing API routes and the client UI so the
 * two always agree on limits and option values.
 */

export const PRESENTATION_AUDIO_MAX_BYTES = 25 * 1024 * 1024; // OpenAI transcription cap
export const PRESENTATION_SLIDES_MAX_BYTES = 30 * 1024 * 1024;
export const PRESENTATION_VIDEO_MAX_SECONDS = 210; // presentations are ≤3:30
export const PRESENTATION_VIDEO_MAX_BYTES = 500 * 1024 * 1024; // never uploaded, but keeps in-browser extraction sane

export const PRESENTATION_AUDIO_MIME_TYPES = [
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/webm",
  "audio/ogg",
];

export const PRESENTATION_SLIDES_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

export const REASONING_EFFORT_OPTIONS = ["high", "xhigh"] as const;
export type PresentationReasoningEffort = (typeof REASONING_EFFORT_OPTIONS)[number];

export const PRESENTATION_TRACKS = ["A", "B"] as const;
export const PRESENTATION_CONDITIONS = ["AI-assisted", "no-AI"] as const;

/** DB-backed hourly cap on new jobs per staff member (guards API spend). */
export const PRESENTATION_JOBS_PER_HOUR = 60;

export const TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
export const PRESENTATION_GRADING_MODEL = "gpt-5.6-luna";

export type PresentationJobStatusValue =
  | "QUEUED"
  | "TRANSCRIBING"
  | "GRADING"
  | "DONE"
  | "FAILED";

export interface PresentationJobSummary {
  id: string;
  topic: string;
  presenters: string | null;
  track: string | null;
  condition: string | null;
  status: PresentationJobStatusValue;
  error: string | null;
  totalScore: number | null;
  model: string | null;
  reasoningEffort: string;
  gradingDurationMs: number | null;
  rubricVersion: number | null;
  createdByName: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface PresentationJobDetail extends PresentationJobSummary {
  transcript: string | null;
  slidesText: string | null;
  slidesFilename: string | null;
  partIOutput: string | null;
  partIIOutput: string | null;
  summaryJson: string | null;
}

/**
 * Splits the model's evaluation into the professor-only analysis (Part I) and
 * the student-facing feedback (Part II), as required by the rubric's output
 * format. Falls back to treating everything as Part I when the marker is
 * missing so nothing is lost.
 */
export function splitEvaluationParts(text: string): {
  partI: string;
  partII: string | null;
} {
  const match = text.match(/^#{1,3}\s*PART II\b.*$/im);
  if (!match || match.index === undefined) {
    return { partI: text.trim(), partII: null };
  }
  return {
    partI: text.slice(0, match.index).trim(),
    partII: text.slice(match.index).trim(),
  };
}

/**
 * Finds the one-line machine-readable JSON scorecard the rubric asks for.
 * Returns the raw JSON string and the parsed total, when present and valid.
 */
export function extractSummaryJson(text: string): {
  raw: string | null;
  totalScore: number | null;
} {
  const candidates = text.match(/\{[^{}\n]*"total_100"[^{}\n]*\}/g);
  const raw = candidates?.[candidates.length - 1] ?? null;
  if (!raw) return { raw: null, totalScore: null };
  try {
    const parsed: unknown = JSON.parse(raw);
    const total =
      typeof parsed === "object" && parsed !== null && "total_100" in parsed
        ? Number((parsed as { total_100: unknown }).total_100)
        : NaN;
    return {
      raw,
      totalScore: Number.isFinite(total) && total >= 0 && total <= 100 ? total : null,
    };
  } catch {
    return { raw, totalScore: null };
  }
}
