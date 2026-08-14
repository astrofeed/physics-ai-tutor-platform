import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@/types/user";

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
  if (role === "STUDENT") return { published: true, isDeleted: false };

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
