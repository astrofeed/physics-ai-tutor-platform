import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteFileByUrl } from "@/lib/services/file-storage";
import {
  MAX_MC_OPTIONS,
  MIN_MC_OPTIONS,
  compactMcOptions,
  normalizeMcAnswerKey,
} from "@/lib/mc-answer-key";
import { validateTolerance, type ToleranceUnit } from "@/lib/auto-grade";
import type { UserRole } from "@/types/user";

export interface QuestionInput {
  id?: string;
  questionText: string;
  questionType: "MC" | "NUMERIC" | "FREE_RESPONSE";
  options?: string[];
  correctAnswer?: string;
  /** Answers that also score full marks (a second correct option, or a second acceptable value). */
  alsoAcceptedAnswers?: string[];
  points?: number;
  diagram?: { type: string; content: string } | null;
  imageUrl?: string | null;
  tolerance?: number | null;
  toleranceUnit?: ToleranceUnit;
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
 * Drops blank MC options and rewrites answer keys to the option letter students
 * actually submit, so a key entered as option text (or as "2") cannot silently
 * score everyone zero.
 */
export function normalizeAnswerKeys(questions: QuestionInput[]): QuestionInput[] {
  return questions.map((question, index) => {
    if (question.questionType === "FREE_RESPONSE") {
      return { ...question, alsoAcceptedAnswers: [] };
    }

    if (question.questionType === "NUMERIC") {
      const extras = dedupeExtraAnswers(question.alsoAcceptedAnswers, question.correctAnswer);
      const invalid = extras.find((value) => !Number.isFinite(Number(value)));
      if (invalid !== undefined) {
        throw new AssignmentError(
          `Question ${index + 1}: "${invalid}" is not a number, so it cannot be an accepted answer.`,
          400
        );
      }
      return { ...question, alsoAcceptedAnswers: extras };
    }

    const submittedOptions = question.options ?? [];
    const extraKeys = dedupeExtraAnswers(question.alsoAcceptedAnswers, question.correctAnswer);
    const unresolved = extraKeys.find((key) => {
      const letter = normalizeMcAnswerKey(key, submittedOptions);
      return letter === null || !submittedOptions[letter.charCodeAt(0) - 65]?.trim();
    });
    if (unresolved !== undefined) {
      throw new AssignmentError(
        `Question ${index + 1}: "${unresolved}" is not one of its options, so it cannot also be accepted.`,
        400
      );
    }

    const { options, correctAnswer, alsoAcceptedAnswers } = compactMcOptions(
      submittedOptions,
      question.correctAnswer ?? "",
      extraKeys
    );

    if (options.length < MIN_MC_OPTIONS || options.length > MAX_MC_OPTIONS) {
      throw new AssignmentError(
        `Question ${index + 1}: a multiple choice question needs between ${MIN_MC_OPTIONS} and ${MAX_MC_OPTIONS} options with text.`,
        400
      );
    }

    const letter = normalizeMcAnswerKey(correctAnswer, options);
    if (!letter) {
      throw new AssignmentError(
        `Question ${index + 1}: the correct answer must be one of its options (a letter such as "A", or the option's text).`,
        400
      );
    }

    return { ...question, options, correctAnswer: letter, alsoAcceptedAnswers };
  });
}

/** Keeps the extra accepted answers a distinct, non-blank set that excludes the canonical one. */
function dedupeExtraAnswers(
  extras: string[] | undefined,
  correctAnswer: string | undefined
): string[] {
  const canonical = (correctAnswer ?? "").trim();
  const cleaned = (extras ?? [])
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value !== canonical);
  return Array.from(new Set(cleaned));
}

/**
 * Numeric tolerances are graded against, so a bad value would mis-score a whole
 * class. Reject them at the boundary instead.
 */
export function assertValidTolerances(questions: QuestionInput[]) {
  questions.forEach((question, index) => {
    const problem = validateTolerance(
      question.questionType,
      question.tolerance,
      question.toleranceUnit ?? "ABSOLUTE"
    );
    if (problem) {
      throw new AssignmentError(`Question ${index + 1}: ${problem}`, 400);
    }
  });
}

const questionFields = (q: QuestionInput, order: number) => ({
  questionText: q.questionText,
  questionType: q.questionType,
  options: q.options ?? Prisma.JsonNull,
  correctAnswer: q.correctAnswer || null,
  alsoAcceptedAnswers: q.alsoAcceptedAnswers ?? [],
  points: q.points ?? 10,
  order,
  diagram: q.diagram ?? Prisma.JsonNull,
  imageUrl: q.imageUrl || null,
  tolerance: q.questionType === "NUMERIC" && q.tolerance != null ? q.tolerance : null,
  toleranceUnit: q.toleranceUnit ?? "ABSOLUTE",
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
  assertValidTolerances(questions);

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

export type AssignmentListFilter =
  | "published"
  | "drafts"
  | "scheduled"
  | "deleted";

/**
 * Scopes an assignment list query. Students only ever see published, non-deleted
 * assignments; the `deleted` filter is the staff-only recycle bin.
 */
export function assignmentListWhere(
  role: UserRole,
  filter: string | null
): Prisma.AssignmentWhereInput {
  if (role === "STUDENT") {
    return {
      published: true,
      isDeleted: false,
      // A pending publish schedule means submissions are not open yet.
      OR: [{ scheduledPublishAt: null }, { scheduledPublishAt: { lte: new Date() } }],
    };
  }

  switch (filter) {
    case "published":
      return { published: true, isDeleted: false };
    case "drafts":
      return { published: false, scheduledPublishAt: null, isDeleted: false };
    case "scheduled":
      return {
        published: false,
        scheduledPublishAt: { not: null },
        isDeleted: false,
      };
    case "deleted":
      return { isDeleted: true };
    default:
      return { isDeleted: false };
  }
}

/**
 * Keeps appeal queues from listing work on assignments that sit in the recycle
 * bin, which staff cannot open until the assignment is restored.
 */
export const APPEAL_ON_LIVE_ASSIGNMENT: Prisma.GradeAppealWhereInput = {
  submissionAnswer: { submission: { assignment: { isDeleted: false } } },
};

export interface RestoreResult {
  ok: boolean;
  status: number;
  error?: string;
}

/**
 * Reverses a soft delete. Submissions, grades, and appeals are never removed by
 * a delete, so restoring makes the whole assignment history reachable again.
 */
export async function restoreAssignment(
  assignmentId: string,
  actor: { id: string; role: UserRole }
): Promise<RestoreResult> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { isDeleted: true, createdById: true },
  });

  if (!assignment || !assignment.isDeleted) {
    return { ok: false, status: 404, error: "Deleted assignment not found" };
  }

  if (actor.role === "TA" && assignment.createdById !== actor.id) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden: you can only restore your own assignments",
    };
  }

  await prisma.assignment.update({
    where: { id: assignmentId },
    data: { isDeleted: false, deletedAt: null },
  });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: "assignment_restored",
      details: { assignmentId },
    },
  });

  return { ok: true, status: 200 };
}
