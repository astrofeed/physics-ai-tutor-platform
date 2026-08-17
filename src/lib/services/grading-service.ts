import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface GradeItem {
  answerId: string;
  score: number;
  feedback?: string | null;
}

export interface SaveGradesInput {
  submissionId: string;
  grades?: GradeItem[];
  overallScore?: number;
  overallFeedback?: string | null;
  feedbackFileUrl?: string | null;
  feedbackImages?: Record<string, string[]> | null;
  isDraft?: boolean;
}

export class GradingError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

const BLANK_PREFIX = "blank-";

/**
 * The submission columns a grade save writes. `Submission.fileUrl` holds the
 * student's own upload, so a grader's attachment goes to `feedbackFileUrl` —
 * writing it to `fileUrl` used to destroy the student's file.
 */
export function gradeSaveUpdate(args: {
  total: number;
  isDraft?: boolean;
  graderId: string;
  feedbackFileUrl?: string | null;
  overallFeedback?: string | null;
  gradedAt?: Date;
}): Prisma.SubmissionUpdateInput {
  const { total, isDraft, graderId, feedbackFileUrl, overallFeedback } = args;
  return {
    ...(isDraft
      ? { draftTotalScore: total }
      : {
          totalScore: total,
          draftTotalScore: null,
          gradedAt: args.gradedAt ?? new Date(),
          gradedById: graderId,
        }),
    ...(feedbackFileUrl !== undefined && { feedbackFileUrl }),
    ...(overallFeedback !== undefined && { overallFeedback }),
  };
}

/**
 * Records who changed a grade and how, so score history is auditable.
 * Grade changes are the most disputed data in the app (see appeals), and
 * without this there is no way to answer "who lowered my score?".
 */
async function recordGradeAudit(
  actorId: string,
  action:
    | "grade_draft_saved"
    | "grade_finalized"
    | "grade_ungraded"
    | "appeal_resolved"
    | "appeal_rejected"
    | "assignment_regraded",
  details: Prisma.InputJsonObject
) {
  try {
    await prisma.auditLog.create({
      data: { userId: actorId, action, details },
    });
  } catch (err) {
    logger.error("Failed to write grade audit log", {
      action,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export { recordGradeAudit };

async function maxPointsFor(answerId: string): Promise<number | undefined> {
  if (answerId.startsWith(BLANK_PREFIX)) {
    const question = await prisma.assignmentQuestion.findUnique({
      where: { id: answerId.slice(BLANK_PREFIX.length) },
      select: { points: true },
    });
    return question?.points;
  }
  const answer = await prisma.submissionAnswer.findUnique({
    where: { id: answerId },
    include: { question: { select: { points: true } } },
  });
  return answer?.question.points;
}

async function applyGrades(
  submissionId: string,
  grades: GradeItem[],
  feedbackImages?: Record<string, string[]> | null
) {
  for (const grade of grades) {
    if (!Number.isFinite(grade.score) || grade.score < 0) {
      throw new GradingError(`Score must be a number between 0 and the question's points`, 400);
    }

    const maxPoints = await maxPointsFor(grade.answerId);
    if (maxPoints === undefined) {
      throw new GradingError(`Unknown answer ${grade.answerId}`, 404);
    }
    if (grade.score > maxPoints) {
      throw new GradingError(
        `Score ${grade.score} exceeds maximum points (${maxPoints}) for answer ${grade.answerId}`,
        400
      );
    }

    const images = feedbackImages?.[grade.answerId];

    if (grade.answerId.startsWith(BLANK_PREFIX)) {
      const questionId = grade.answerId.slice(BLANK_PREFIX.length);
      const existing = await prisma.submissionAnswer.findFirst({
        where: { submissionId, questionId },
        select: { id: true },
      });
      if (existing) {
        await prisma.submissionAnswer.update({
          where: { id: existing.id },
          data: {
            score: grade.score,
            feedback: grade.feedback,
            autoGraded: false,
            ...(images?.length && { feedbackImageUrls: images }),
          },
        });
      } else {
        await prisma.submissionAnswer.create({
          data: {
            submissionId,
            questionId,
            answer: null,
            score: grade.score,
            feedback: grade.feedback,
            autoGraded: false,
            ...(images?.length && { feedbackImageUrls: images }),
          },
        });
      }
    } else {
      const existing = await prisma.submissionAnswer.findUnique({
        where: { id: grade.answerId },
        select: { score: true, feedback: true },
      });
      // A grader changing a score makes it theirs, so it stops being reported as
      // machine-graded. Re-saving the same value (an autosave of an untouched
      // submission) must keep the auto-graded flag.
      const changed =
        Number(existing?.score ?? NaN) !== grade.score ||
        (existing?.feedback ?? "") !== (grade.feedback ?? "");

      await prisma.submissionAnswer.update({
        where: { id: grade.answerId },
        data: {
          score: grade.score,
          feedback: grade.feedback,
          ...(changed && { autoGraded: false }),
          ...(images?.length && { feedbackImageUrls: images }),
        },
      });
    }
  }
}

/**
 * Saves per-question grades. Draft saves keep the running total in
 * `draftTotalScore` so students never see a half-finished grade: only a
 * finalized save writes `totalScore`/`gradedAt`, which is what the student
 * endpoints read.
 */
export async function saveGrades(graderId: string, input: SaveGradesInput) {
  const { submissionId, grades, overallScore, overallFeedback, feedbackFileUrl, feedbackImages, isDraft } = input;

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, assignmentId: true, userId: true, totalScore: true },
  });
  if (!submission) {
    throw new GradingError("Submission not found", 404);
  }

  if (grades?.length) {
    await applyGrades(submissionId, grades, feedbackImages);
  }

  let total: number;
  if (overallScore !== undefined) {
    if (!Number.isFinite(overallScore) || overallScore < 0) {
      throw new GradingError("Overall score must be a non-negative number", 400);
    }
    total = overallScore;
  } else if (grades?.length) {
    const answers = await prisma.submissionAnswer.findMany({
      where: { submissionId },
      select: { score: true },
    });
    total = answers.reduce((sum, a) => sum + (a.score ?? 0), 0);
  } else {
    throw new GradingError("No grades provided", 400);
  }

  await prisma.submission.update({
    where: { id: submissionId },
    data: gradeSaveUpdate({ total, isDraft, graderId, feedbackFileUrl, overallFeedback }),
  });

  await recordGradeAudit(graderId, isDraft ? "grade_draft_saved" : "grade_finalized", {
    submissionId,
    assignmentId: submission.assignmentId,
    studentId: submission.userId,
    previousTotalScore: submission.totalScore,
    totalScore: total,
  });

  return { totalScore: total, isDraft: Boolean(isDraft) };
}

/** Reverts a submission to ungraded, keeping per-answer scores as a draft. */
export async function ungradeSubmission(graderId: string, submissionId: string) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, assignmentId: true, userId: true, totalScore: true },
  });
  if (!submission) {
    throw new GradingError("Submission not found", 404);
  }

  await prisma.submission.update({
    where: { id: submissionId },
    data: {
      totalScore: null,
      draftTotalScore: submission.totalScore,
      gradedAt: null,
      gradedById: null,
    },
  });

  await recordGradeAudit(graderId, "grade_ungraded", {
    submissionId,
    assignmentId: submission.assignmentId,
    studentId: submission.userId,
    previousTotalScore: submission.totalScore,
  });
}
