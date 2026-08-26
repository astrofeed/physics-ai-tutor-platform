/**
 * Shared constants and helpers for the TA presentation-grading tool.
 * Used by both the upload/processing API routes and the client UI so the
 * two always agree on limits and option values.
 */

import { z } from "zod";

export const PRESENTATION_AUDIO_MAX_BYTES = 25 * 1024 * 1024; // OpenAI transcription cap
export const PRESENTATION_SLIDES_MAX_BYTES = 30 * 1024 * 1024;
export const PRESENTATION_VIDEO_MAX_SECONDS = 210; // presentations are ≤3:30
/** A pasted transcript instead of a video; 3:30 of speech is well under this. */
export const PRESENTATION_TRANSCRIPT_MAX_CHARS = 8000;
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
 * Structured evaluation the grading model must return (enforced with OpenAI
 * structured outputs). The rubric's Part I/II sections describe the content
 * of each field; this schema fixes the shape so the UI never mis-parses it.
 */
export const PresentationEvaluationSchema = z.object({
  summary: z.string(),
  scorecard: z.array(
    z.object({
      category: z.string(),
      maxPoints: z.number(),
      awardedPoints: z.number(),
      provisional: z.boolean(),
      justification: z.string(),
    })
  ),
  totalScore: z.number(),
  physicsErrorLog: z.array(
    z.object({
      reference: z.string(),
      error: z.string(),
      check: z.string(),
      correction: z.string(),
      guidingQuestion: z.string(),
    })
  ),
  requiredElements: z.array(
    z.object({
      element: z.string(),
      status: z.enum(["present", "weak", "missing"]),
      reference: z.string(),
    })
  ),
  verifyInPerson: z.array(z.string()),
  flags: z.array(
    z.object({
      concern: z.string(),
      evidence: z.string(),
      confidence: z.enum(["low", "medium", "high"]),
    })
  ),
  strengths: z.array(z.string()),
  guidingQuestions: z.array(
    z.object({
      reference: z.string(),
      questions: z.array(z.string()),
    })
  ),
  qaQuestions: z.array(
    z.object({
      question: z.string(),
      reason: z.string(),
    })
  ),
  reportAdvice: z.string(),
});

export type PresentationEvaluation = z.infer<typeof PresentationEvaluationSchema>;

/** Parses a stored evaluation; null for legacy markdown jobs or bad JSON. */
export function parseEvaluation(json: string | null): PresentationEvaluation | null {
  if (!json) return null;
  try {
    const result = PresentationEvaluationSchema.safeParse(JSON.parse(json));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
