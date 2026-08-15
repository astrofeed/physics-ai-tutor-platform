import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/constants";
import { deleteFileByUrl } from "@/lib/services/file-storage";
import type { UserRole } from "@/types/user";
import { MAX_ANSWER_IMAGES, MAX_ANSWER_LENGTH } from "@/lib/answer-limits";
import { autoGradeAnswer, type GradableQuestion, type ToleranceUnit } from "@/lib/auto-grade";

export interface AnswerInput {
  questionId: string;
  answer: string;
  answerImageUrls?: string[];
}

export interface SubmitInput {
  assignmentId: string;
  answers?: AnswerInput[];
  fileUrl?: string | null;
  isDraft?: boolean;
  /** Set by the client once the student has confirmed a late submission. */
  acknowledgeLate?: boolean;
}

export class SubmissionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly extra?: Record<string, unknown>
  ) {
    super(message);
  }
}

function assertVisibleToStudent(assignment: {
  published: boolean;
  isDeleted: boolean;
  scheduledPublishAt: Date | null;
}) {
  if (assignment.isDeleted) {
    throw new SubmissionError("Assignment not found", 404);
  }
  const scheduledInFuture =
    assignment.scheduledPublishAt !== null && assignment.scheduledPublishAt > new Date();
  if (!assignment.published || scheduledInFuture) {
    throw new SubmissionError("This assignment is not open for submissions yet", 403);
  }
}

function validateAnswers(
  answers: AnswerInput[],
  questions: { id: string; questionType: string }[]
) {
  const byId = new Map(questions.map((q) => [q.id, q]));

  for (const answer of answers) {
    const question = byId.get(answer.questionId);
    if (!question) {
      throw new SubmissionError("Answer submitted for a question that is not on this assignment", 400);
    }
    if (answer.answer.length > MAX_ANSWER_LENGTH) {
      throw new SubmissionError(
        `Answers are limited to ${MAX_ANSWER_LENGTH} characters`,
        400
      );
    }
    if ((answer.answerImageUrls?.length ?? 0) > MAX_ANSWER_IMAGES) {
      throw new SubmissionError(`At most ${MAX_ANSWER_IMAGES} images per answer`, 400);
    }
    if (
      question.questionType === "NUMERIC" &&
      answer.answer.trim() !== "" &&
      !Number.isFinite(Number(answer.answer.trim()))
    ) {
      throw new SubmissionError("Numeric questions require a numeric answer", 400);
    }
  }
}

type QuestionRow = {
  questionType: string;
  correctAnswer: string | null;
  alsoAcceptedAnswers: string[];
  points: number;
  tolerance: Prisma.Decimal | null;
  toleranceUnit: string;
};

const gradable = (question: QuestionRow): GradableQuestion => ({
  questionType: question.questionType,
  correctAnswer: question.correctAnswer,
  alsoAcceptedAnswers: question.alsoAcceptedAnswers,
  points: question.points,
  tolerance: question.tolerance === null ? null : Number(question.tolerance),
  toleranceUnit: question.toleranceUnit as ToleranceUnit,
});

const answerRows = (answers: AnswerInput[]) =>
  answers.map((a) => ({
    questionId: a.questionId,
    answer: a.answer,
    answerImageUrls: a.answerImageUrls?.length ? a.answerImageUrls : undefined,
    autoGraded: false,
    score: null,
  }));

/** Namespace keeping these locks apart from any other advisory lock. */
const SUBMISSION_LOCK_NAMESPACE = 4271;

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Serializes a student's saves on one assignment across all tabs and server
 * instances: concurrent saves would otherwise each read "no submission" and
 * each create one.
 */
async function withSubmissionLock<T>(
  assignmentId: string,
  userId: string,
  run: (tx: Tx) => Promise<T>
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SUBMISSION_LOCK_NAMESPACE}, hashtext(${`${assignmentId}:${userId}`}))`;
      return run(tx);
    },
    { timeout: 20_000 }
  );
}

export async function saveSubmission(
  user: { id: string; role: UserRole },
  input: SubmitInput
) {
  const { assignmentId, fileUrl, isDraft, acknowledgeLate } = input;
  const answers = input.answers ?? [];

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { questions: true },
  });
  if (!assignment || assignment.isDeleted) {
    throw new SubmissionError("Assignment not found", 404);
  }
  if (!isStaff(user.role)) {
    assertVisibleToStudent(assignment);
  }

  validateAnswers(answers, assignment.questions);

  if (!isDraft && assignment.type === "FILE_UPLOAD" && !fileUrl) {
    throw new SubmissionError("Attach a file before submitting this assignment", 400);
  }

  // Deleted only after the transaction commits, so a rollback cannot leave a
  // submission pointing at a removed file.
  let replacedFileUrl: string | null = null;

  const submission = await withSubmissionLock(assignmentId, user.id, async (tx) => {
    const existing = await tx.submission.findFirst({
      where: { assignmentId, userId: user.id, isDeleted: false },
      include: { answers: { select: { score: true } } },
    });

    if (isDraft) {
      if (existing && !existing.isDraft) {
        throw new SubmissionError("Cannot overwrite a final submission with a draft", 409);
      }

      if (existing) {
        await tx.submissionAnswer.deleteMany({ where: { submissionId: existing.id } });
        return tx.submission.update({
          where: { id: existing.id },
          data: {
            fileUrl,
            submittedAt: new Date(),
            answers: { create: answerRows(answers) },
          },
          include: { answers: true },
        });
      }

      return tx.submission.create({
        data: {
          assignmentId,
          userId: user.id,
          fileUrl,
          isDraft: true,
          answers: { create: answerRows(answers) },
        },
        include: { answers: true },
      });
    }

    if (existing && !existing.isDraft) {
      if (assignment.lockAfterSubmit) {
        throw new SubmissionError(
          "This assignment is locked after submission. You cannot resubmit.",
          403
        );
      }
      const gradingStarted =
        existing.gradedAt !== null || existing.answers.some((a) => a.score !== null);
      if (gradingStarted) {
        throw new SubmissionError(
          existing.gradedAt
            ? "This submission has been graded and cannot be resubmitted."
            : "This submission is being graded and cannot be resubmitted.",
          403
        );
      }
    }

    const isLate = assignment.dueDate !== null && assignment.dueDate < new Date();
    if (isLate && !acknowledgeLate) {
      throw new SubmissionError(
        "This assignment is past its due date. Confirm to submit it as late.",
        409,
        { pastDue: true, dueDate: assignment.dueDate }
      );
    }

    if (existing) {
      if (existing.fileUrl && existing.fileUrl !== fileUrl) {
        replacedFileUrl = existing.fileUrl;
      }
      await tx.submission.delete({ where: { id: existing.id } });
    }

    const questionById = new Map(assignment.questions.map((q) => [q.id, q]));
    const gradedAnswers = answers.map((a) => {
      const question = questionById.get(a.questionId);
      return {
        questionId: a.questionId,
        answer: a.answer,
        answerImageUrls: a.answerImageUrls?.length ? a.answerImageUrls : undefined,
        ...autoGradeAnswer(a.answer, question && gradable(question)),
      };
    });

    // A quiz counts as graded only when every question on it has a score.
    // Anything left to a human (free response, or a skipped question) keeps the
    // submission in the grading queue.
    const scored = new Map(
      gradedAnswers
        .filter((a) => a.autoGraded && a.score !== null)
        .map((a) => [a.questionId, a.score as number])
    );
    const fullyAutoGraded =
      assignment.type === "QUIZ" &&
      assignment.questions.length > 0 &&
      assignment.questions.every((q) => scored.has(q.id));
    const totalScore = fullyAutoGraded
      ? Array.from(scored.values()).reduce((sum, score) => sum + score, 0)
      : null;

    return tx.submission.create({
      data: {
        assignmentId,
        userId: user.id,
        fileUrl,
        isDraft: false,
        isLate,
        dueDateAtSubmission: assignment.dueDate,
        totalScore,
        gradedAt: fullyAutoGraded ? new Date() : null,
        answers: { create: gradedAnswers },
      },
      include: { answers: true },
    });
  });

  if (replacedFileUrl) {
    await deleteFileByUrl(replacedFileUrl);
  }

  return submission;
}
