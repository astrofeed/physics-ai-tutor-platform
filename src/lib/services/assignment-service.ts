import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteFileByUrl } from "@/lib/services/file-storage";
import { normalizeMcAnswerKey } from "@/lib/mc-answer-key";

export interface QuestionInput {
  id?: string;
  questionText: string;
  questionType: "MC" | "NUMERIC" | "FREE_RESPONSE";
  options?: string[];
  correctAnswer?: string;
  points?: number;
  diagram?: { type: string; content: string } | null;
  imageUrl?: string | null;
}

export class AssignmentError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly extra?: Record<string, unknown>
  ) {
    super(message);
  }
}

/**
 * Rewrites MC answer keys to the option letter students actually submit, so a key
 * entered as option text (or as "2") cannot silently score everyone zero.
 */
export function normalizeAnswerKeys(questions: QuestionInput[]): QuestionInput[] {
  return questions.map((question, index) => {
    if (question.questionType !== "MC") return question;

    const options = question.options ?? [];
    const letter = normalizeMcAnswerKey(question.correctAnswer ?? "", options);
    if (!letter) {
      throw new AssignmentError(
        `Question ${index + 1}: the correct answer must be one of its options (a letter such as "A", or the option's text).`,
        400
      );
    }

    return { ...question, correctAnswer: letter };
  });
}

const questionFields = (q: QuestionInput, order: number) => ({
  questionText: q.questionText,
  questionType: q.questionType,
  options: q.options ?? Prisma.JsonNull,
  correctAnswer: q.correctAnswer || null,
  points: q.points ?? 10,
  order,
  diagram: q.diagram ?? Prisma.JsonNull,
  imageUrl: q.imageUrl || null,
});

/**
 * Recomputes every submission total for an assignment from the surviving
 * answers. Needed after questions are deleted: the cascade removes their
 * answers, so a stored total would keep counting points that no longer exist.
 */
async function recomputeSubmissionTotals(
  tx: Prisma.TransactionClient,
  assignmentId: string
) {
  const submissions = await tx.submission.findMany({
    where: { assignmentId },
    select: {
      id: true,
      gradedAt: true,
      draftTotalScore: true,
      answers: { select: { score: true } },
    },
  });

  for (const submission of submissions) {
    const total = submission.answers.reduce((sum, a) => sum + (a.score ?? 0), 0);
    await tx.submission.update({
      where: { id: submission.id },
      data: {
        ...(submission.gradedAt !== null && { totalScore: total }),
        ...(submission.draftTotalScore !== null && { draftTotalScore: total }),
      },
    });
  }
}

/**
 * Reconciles an assignment's questions with the submitted list, updating rows
 * in place so existing `SubmissionAnswer` rows (and their grades and appeals)
 * survive an edit. Deleting a question still cascades to its answers, so that
 * only happens for questions nobody answered unless the caller explicitly
 * confirms the data loss.
 *
 * Returns the assignment's points total derived from the synced questions; it is
 * written here so it can never disagree with the questions that exist.
 */
export async function syncQuestions(
  assignmentId: string,
  submitted: QuestionInput[],
  options: { confirmDestructive?: boolean } = {}
) {
  const questions = normalizeAnswerKeys(submitted);

  const existing = await prisma.assignmentQuestion.findMany({
    where: { assignmentId },
    select: {
      id: true,
      order: true,
      questionText: true,
      imageUrl: true,
      _count: { select: { answers: true } },
    },
  });

  const keptIds = new Set(
    questions.map((q) => q.id).filter((id): id is string => Boolean(id))
  );
  const removed = existing.filter((q) => !keptIds.has(q.id));
  const removedWithAnswers = removed.filter((q) => q._count.answers > 0);

  if (removedWithAnswers.length > 0 && !options.confirmDestructive) {
    throw new AssignmentError(
      `${removedWithAnswers.length} question(s) you removed already have student answers. Confirm to delete those answers and their grades.`,
      409,
      {
        requiresConfirmation: true,
        questionsWithAnswers: removedWithAnswers.map((q) => ({
          id: q.id,
          questionText: q.questionText,
          answerCount: q._count.answers,
        })),
      }
    );
  }

  const existingById = new Map(existing.map((q) => [q.id, q]));
  const replacedImageUrls: string[] = [];
  const totalPoints = questions.reduce((sum, q) => sum + (q.points ?? 10), 0);

  await prisma.$transaction(async (tx) => {
    for (let index = 0; index < questions.length; index++) {
      const question = questions[index];
      const current = question.id ? existingById.get(question.id) : undefined;
      if (current) {
        if (current.imageUrl && current.imageUrl !== (question.imageUrl || null)) {
          replacedImageUrls.push(current.imageUrl);
        }
        await tx.assignmentQuestion.update({
          where: { id: current.id },
          data: questionFields(question, index),
        });
      } else {
        await tx.assignmentQuestion.create({
          data: { assignmentId, ...questionFields(question, index) },
        });
      }
    }

    for (const question of removed) {
      if (question.imageUrl) replacedImageUrls.push(question.imageUrl);
      await tx.assignmentQuestion.delete({ where: { id: question.id } });
    }

    await tx.assignment.update({
      where: { id: assignmentId },
      data: { totalPoints },
    });

    if (removedWithAnswers.length > 0) {
      await recomputeSubmissionTotals(tx, assignmentId);
    }
  });

  // Only revoke image files once the question rows no longer reference them.
  for (const url of replacedImageUrls) {
    await deleteFileByUrl(url);
  }

  return { totalPoints };
}
