import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/constants";
import { deleteFileByUrl } from "@/lib/services/file-storage";
import type { UserRole } from "@/types/user";
import { MAX_ANSWER_IMAGES, MAX_ANSWER_LENGTH } from "@/lib/answer-limits";

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

function autoGrade(
  answer: AnswerInput,
  question: { questionType: string; correctAnswer: string | null; points: number } | undefined
) {
  if (!question || (question.questionType !== "MC" && question.questionType !== "NUMERIC")) {
    return { autoGraded: false, score: null as number | null };
  }

  if (question.questionType === "NUMERIC") {
    const given = Number(answer.answer.trim());
    const expected = Number((question.correctAnswer || "").trim());
    const correct =
      Number.isFinite(given) && Number.isFinite(expected) && given === expected;
    return { autoGraded: true, score: correct ? question.points : 0 };
  }

  const correct =
    answer.answer.trim().toLowerCase() ===
    (question.correctAnswer || "").trim().toLowerCase();
  return { autoGraded: true, score: correct ? question.points : 0 };
}

const answerRows = (answers: AnswerInput[]) =>
  answers.map((a) => ({
    questionId: a.questionId,
    answer: a.answer,
    answerImageUrls: a.answerImageUrls?.length ? a.answerImageUrls : undefined,
    autoGraded: false,
    score: null,
  }));

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
  if (!assignment) {
    throw new SubmissionError("Assignment not found", 404);
  }
  if (!isStaff(user.role)) {
    assertVisibleToStudent(assignment);
  }

  validateAnswers(answers, assignment.questions);

  const existing = await prisma.submission.findFirst({
    where: { assignmentId, userId: user.id },
    include: { answers: { select: { score: true } } },
  });

  if (isDraft) {
    if (existing && !existing.isDraft) {
      throw new SubmissionError("Cannot overwrite a final submission with a draft", 409);
    }

    if (existing) {
      await prisma.submissionAnswer.deleteMany({ where: { submissionId: existing.id } });
      return prisma.submission.update({
        where: { id: existing.id },
        data: {
          fileUrl,
          submittedAt: new Date(),
          answers: { create: answerRows(answers) },
        },
        include: { answers: true },
      });
    }

    return prisma.submission.create({
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

  if (assignment.type === "FILE_UPLOAD" && !fileUrl) {
    throw new SubmissionError("Attach a file before submitting this assignment", 400);
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

  const now = new Date();
  const isLate = assignment.dueDate !== null && assignment.dueDate < now;
  if (isLate && !acknowledgeLate) {
    throw new SubmissionError(
      "This assignment is past its due date. Confirm to submit it as late.",
      409,
      { pastDue: true, dueDate: assignment.dueDate }
    );
  }

  if (existing) {
    if (existing.fileUrl && existing.fileUrl !== fileUrl) {
      await deleteFileByUrl(existing.fileUrl);
    }
    await prisma.submission.delete({ where: { id: existing.id } });
  }

  const questionById = new Map(assignment.questions.map((q) => [q.id, q]));

  const submission = await prisma.submission.create({
    data: {
      assignmentId,
      userId: user.id,
      fileUrl,
      isDraft: false,
      isLate,
      dueDateAtSubmission: assignment.dueDate,
      answers: {
        create: answers.map((a) => {
          const graded = autoGrade(a, questionById.get(a.questionId));
          return {
            questionId: a.questionId,
            answer: a.answer,
            answerImageUrls: a.answerImageUrls?.length ? a.answerImageUrls : undefined,
            autoGraded: graded.autoGraded,
            score: graded.score,
          };
        }),
      },
    },
    include: { answers: true },
  });

  // A quiz counts as graded only when every question on it has a score.
  // Anything left to a human (free response, or a skipped question) keeps the
  // submission in the grading queue.
  if (assignment.type === "QUIZ" && assignment.questions.length > 0) {
    const scored = new Map(
      submission.answers
        .filter((a) => a.autoGraded && a.score !== null)
        .map((a) => [a.questionId, a.score as number])
    );
    const fullyAutoGraded = assignment.questions.every((q) => scored.has(q.id));

    if (fullyAutoGraded) {
      const totalScore = Array.from(scored.values()).reduce((sum, score) => sum + score, 0);
      await prisma.submission.update({
        where: { id: submission.id },
        data: { totalScore, gradedAt: new Date() },
      });
    }
  }

  return submission;
}
