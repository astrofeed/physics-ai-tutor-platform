import { prisma } from "@/lib/prisma";
import { AssignmentError } from "@/lib/services/assignment-service";
import { unconfirmedKeysMessage, unconfirmedQuestionNumbers } from "@/lib/key-review";
import type { UserRole } from "@/types/user";

/**
 * Records that a member of staff has checked one question's answer key, or
 * withdraws that record. Only assignments under review (built from AI-generated
 * problems) carry confirmations at all.
 */
export async function setAnswerKeyConfirmed(
  assignmentId: string,
  questionId: string,
  confirmed: boolean,
  actor: { id: string; role: UserRole }
) {
  const question = await prisma.assignmentQuestion.findFirst({
    where: { id: questionId, assignmentId },
    select: { id: true, assignment: { select: { requiresKeyReview: true, createdById: true } } },
  });

  if (!question) {
    throw new AssignmentError("Question not found on this assignment", 404);
  }

  if (!question.assignment.requiresKeyReview) {
    throw new AssignmentError(
      "This assignment's answer keys were written by staff, so they need no confirmation.",
      400
    );
  }

  if (actor.role === "TA" && question.assignment.createdById !== actor.id) {
    throw new AssignmentError(
      "Forbidden: you can only confirm answer keys on your own assignments",
      403
    );
  }

  const updated = await prisma.assignmentQuestion.update({
    where: { id: questionId },
    data: {
      keyConfirmedAt: confirmed ? new Date() : null,
      keyConfirmedById: confirmed ? actor.id : null,
    },
    select: {
      id: true,
      keyConfirmedAt: true,
      keyConfirmedBy: { select: { name: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: actor.id,
      action: confirmed ? "answer_key_confirmed" : "answer_key_unconfirmed",
      details: { assignmentId, questionId },
    },
  });

  return updated;
}

/**
 * Refuses to open an assignment to students while any AI-written answer key is
 * still unconfirmed. Every publish path — the assignment API, a publish
 * schedule, the cron job that runs it — goes through here, so confirming in the
 * UI is the only way past it.
 */
export async function assertAnswerKeysConfirmed(assignmentId: string): Promise<void> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      requiresKeyReview: true,
      questions: {
        select: { order: true, keyConfirmedAt: true },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!assignment?.requiresKeyReview) return;

  const unconfirmed = unconfirmedQuestionNumbers(assignment.questions);
  if (unconfirmed.length === 0) return;

  throw new AssignmentError(unconfirmedKeysMessage(unconfirmed), 409, {
    unconfirmedQuestionNumbers: unconfirmed,
  });
}
