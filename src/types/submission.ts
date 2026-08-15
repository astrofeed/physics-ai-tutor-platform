/**
 * Shared submission types used across frontend pages and components.
 *
 * These represent the shapes returned by the API (serialized JSON),
 * NOT raw Prisma model types.
 */

/** A single answer within a submission. */
export interface SubmissionAnswer {
  id: string;
  questionId: string;
  answer: string | null;
  answerImageUrls?: string[];
  score: number | null;
  feedback: string | null;
  feedbackImageUrls?: string[];
  autoGraded: boolean;
}

/** An existing submission as returned for the student submission view. */
export interface ExistingSubmission {
  id: string;
  fileUrl: string | null;
  /** A file the grader attached to their feedback; only sent once released. */
  feedbackFileUrl?: string | null;
  submittedAt: string;
  totalScore: number | null;
  gradedAt?: string | null;
  /** Recorded when the submission was made; not recomputed from the current due date. */
  isLate?: boolean;
  isDraft?: boolean;
  overallFeedback?: string | null;
  /**
   * A grader has released or hand-scored this submission, so it can no longer
   * be edited. Sent separately because an unreleased hand score is masked.
   */
  beingGraded?: boolean;
  answers: SubmissionAnswer[];
}

/** A message within a grade appeal thread. */
export interface AppealMessageData {
  id: string;
  userId: string;
  content: string;
  imageUrls?: string[];
  createdAt: string;
  user: { id: string; name: string | null; role: string };
}

/** A grade appeal with its full thread, as returned by the API. */
export interface GradeAppealData {
  id: string;
  submissionAnswerId: string;
  studentId: string;
  reason: string;
  imageUrls?: string[];
  status: "OPEN" | "RESOLVED" | "REJECTED";
  createdAt: string;
  student: { id: true; name: string | null };
  submissionAnswer: {
    id: string;
    questionId: string;
    score: number | null;
    feedback: string | null;
    question: { questionText: string; points: number; order: number };
  };
  messages: AppealMessageData[];
}
