import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteFileByUrl } from "@/lib/services/file-storage";

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
 * Reconciles an assignment's questions with the submitted list, updating rows
 * in place so existing `SubmissionAnswer` rows (and their grades and appeals)
 * survive an edit. Deleting a question still cascades to its answers, so that
 * only happens for questions nobody answered unless the caller explicitly
 * confirms the data loss.
 */
export async function syncQuestions(
  assignmentId: string,
  questions: QuestionInput[],
  options: { confirmDestructive?: boolean } = {}
) {
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
  });

  // Only revoke image files once the question rows no longer reference them.
  for (const url of replacedImageUrls) {
    await deleteFileByUrl(url);
  }
}
