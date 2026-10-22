import { z } from "zod";
import { questionBankEntry } from "@/lib/question-bank";
import {
  PRESENTATION_STUDENT_IDS_MAX_CHARS,
  PRESENTATION_TRACKS,
  PRESENTATION_TRANSCRIPT_MAX_CHARS,
  REASONING_EFFORT_OPTIONS,
} from "@/lib/presentation-grading";

export const QuestionBankIdSchema = z.string().min(1).max(80)
  .refine((id) => questionBankEntry(id) !== null, "Unknown Question Bank problem");

export const UpdatePresentationJobSchema = z.object({
  topic: z.string().trim().min(1).max(200).optional(),
  questionBankId: QuestionBankIdSchema.nullable().optional(),
  presenters: z.string().max(200).nullable().optional(),
  studentIds: z.string().max(PRESENTATION_STUDENT_IDS_MAX_CHARS).nullable().optional(),
});

export const CreatePresentationJobSchema = z.object({
  topic: z.string().trim().min(1).max(200),
  questionBankId: QuestionBankIdSchema.nullable().optional(),
  presenters: z.string().max(200).optional(),
  studentIds: z.string().max(PRESENTATION_STUDENT_IDS_MAX_CHARS).optional(),
  track: z.enum(PRESENTATION_TRACKS).optional(),
  audioBlobUrl: z.string().url().max(1000).optional(),
  transcript: z.string().min(1).max(PRESENTATION_TRANSCRIPT_MAX_CHARS).optional(),
  slidesBlobUrl: z.string().url().max(1000).optional(),
  slidesFilename: z.string().min(1).max(300).optional(),
  reasoningEffort: z.enum(REASONING_EFFORT_OPTIONS).default("high"),
}).refine(
  (input) => Boolean(input.audioBlobUrl) !== Boolean(input.transcript),
  { message: "Provide either an audio recording or a pasted transcript" }
);
