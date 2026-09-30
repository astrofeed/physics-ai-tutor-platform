import type { PresentationGradingJob } from "@prisma/client";
import type { HumanGrading } from "@/lib/human-grading";
import type { FeedbackEmailStatus } from "@/lib/feedback-email";
import type { PresentationReasoningEffort } from "@/lib/presentation-grading";

export type PresentationJobStatusValue = PresentationGradingJob["status"];

export interface PresentationJobSummary {
  id: string;
  topic: string;
  presenters: string | null;
  studentIds: string | null;
  /** From the sign-up sheet for the first student ID; null when not rostered. */
  englishName: string | null;
  groupLabel: string | null;
  presentationDate: string | null;
  track: string | null;
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

export interface PresentationJobDetail extends PresentationJobSummary, FeedbackEmailStatus {
  questionBankId: string | null;
  transcript: string | null;
  slidesText: string | null;
  slidesFilename: string | null;
  partIOutput: string | null;
  partIIOutput: string | null;
  summaryJson: string | null;
  human: HumanGrading;
}

export interface CreatePresentationJobInput {
  topic: string;
  questionBankId?: string | null;
  presenters?: string;
  studentIds?: string;
  track?: string;
  audioBlobUrl?: string;
  /** A transcript the TA pasted directly, skipping transcription. */
  transcript?: string;
  slidesBlobUrl?: string;
  slidesFilename?: string;
  reasoningEffort: PresentationReasoningEffort;
}

export interface UpdatePresentationJobInput {
  topic?: string;
  questionBankId?: string | null;
  presenters?: string | null;
  studentIds?: string | null;
}

export interface PresentationSlidesInput {
  text: string | null;
  pdf: { filename: string; base64: string } | null;
}

export interface RubricState {
  version: number;
  content: string;
  updatedByName: string | null;
  updatedAt: string | null;
}

export interface NewJobInput {
  topic: string;
  questionBankId?: string | null;
  presenters?: string;
  studentIds?: string;
  track?: "A" | "B";
  /** Exactly one of video / transcript is provided. */
  video: File | null;
  transcript: string | null;
  slides: File | null;
  reasoningEffort: PresentationReasoningEffort;
}

export type JobSubmitPhase = "extracting" | "transcoding" | "uploading" | "creating" | null;

export interface PresentationFormState {
  topic: string;
  questionBankId: string | null;
  presenters: string;
  studentIds: string;
  track: "A" | "B" | "unknown";
  reasoningEffort: PresentationReasoningEffort;
  source: "video" | "transcript";
  video: File | null;
  transcript: string;
  slides: File | null;
}
