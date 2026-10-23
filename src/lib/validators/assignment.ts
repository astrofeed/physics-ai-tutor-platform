import { z } from "zod";

const PatchQuestionSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  questionText: z.string().min(1).max(10000),
  questionType: z.enum(["MC", "NUMERIC", "FREE_RESPONSE"]),
  options: z.array(z.string().max(2000)).optional(),
  correctAnswer: z.string().max(2000).optional(),
  alsoAcceptedAnswers: z.array(z.string().max(2000)).max(8).optional(),
  points: z.number().positive().max(1000).optional(),
  diagram: z.object({
    type: z.string().max(50),
    content: z.string().max(50000),
  }).nullable().optional(),
  imageUrl: z.string().max(2000).nullable().optional(),
  tolerance: z.number().min(0).max(1_000_000).nullable().optional(),
  toleranceUnit: z.enum(["ABSOLUTE", "PERCENT"]).optional(),
});

export const PatchAssignmentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  dueDate: z.string().max(64).nullable().optional(),
  published: z.boolean().optional(),
  totalPoints: z.number().min(0).max(10000).optional(),
  pdfUrl: z.string().max(2000).nullable().optional(),
  lockAfterSubmit: z.boolean().optional(),
  scheduledPublishAt: z.string().max(64).nullable().optional(),
  notifyOnPublish: z.boolean().optional(),
  questions: z.array(PatchQuestionSchema).optional(),
  /** Acknowledges that removed questions will delete existing student answers. */
  confirmDestructive: z.boolean().optional(),
});
