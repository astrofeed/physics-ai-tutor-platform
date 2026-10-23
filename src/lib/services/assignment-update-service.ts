import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { PatchAssignmentSchema } from "@/lib/validators/assignment";
import { AssignmentError, syncQuestions } from "@/lib/services/assignment-service";
import { assertAnswerKeysConfirmed } from "@/lib/services/key-review-service";

export async function updateAssignment(
  assignmentId: string,
  data: z.infer<typeof PatchAssignmentSchema>,
  userId: string
) {
  if (data.scheduledPublishAt !== undefined && data.scheduledPublishAt !== null) {
    const scheduledDate = new Date(data.scheduledPublishAt);
    if (isNaN(scheduledDate.getTime())) {
      throw new AssignmentError("Invalid scheduledPublishAt date", 400);
    }
    if (scheduledDate <= new Date()) {
      throw new AssignmentError("Scheduled time must be in the future", 400);
    }
    const dueDate = data.dueDate
      ? new Date(data.dueDate)
      : (await prisma.assignment.findUnique({
          where: { id: assignmentId },
          select: { dueDate: true },
        }))?.dueDate ?? null;
    if (dueDate && scheduledDate >= dueDate) {
      throw new AssignmentError("Scheduled publish time must be before the due date", 400);
    }
  }

  if (data.questions) {
    await syncQuestions(assignmentId, data.questions, {
      confirmDestructive: data.confirmDestructive,
    });
  }

  const isPublishingNow = data.published === true;
  // A changed answer key loses its confirmation during question sync.
  if (isPublishingNow || data.scheduledPublishAt) {
    await assertAnswerKeysConfirmed(assignmentId);
  }

  const isClearingSchedule = isPublishingNow || data.published === false ||
    (!isPublishingNow && data.scheduledPublishAt === null);
  if (isClearingSchedule) {
    await prisma.scheduledEmail.updateMany({
      where: { assignmentId, status: "PENDING" },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
  }

  return prisma.assignment.update({
    where: { id: assignmentId },
    data: {
      ...(data.title && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
      ...(data.published !== undefined && { published: data.published }),
      ...(data.published === true && { publishedById: userId }),
      ...(isPublishingNow && { scheduledPublishAt: null }),
      ...(data.published === false && { scheduledPublishAt: null }),
      ...(!isPublishingNow && data.scheduledPublishAt !== undefined && {
        scheduledPublishAt: data.scheduledPublishAt ? new Date(data.scheduledPublishAt) : null,
      }),
      ...(data.notifyOnPublish !== undefined && { notifyOnPublish: data.notifyOnPublish }),
      // Question sync has already written their authoritative sum.
      ...(data.totalPoints !== undefined && !data.questions && { totalPoints: data.totalPoints }),
      ...(data.pdfUrl !== undefined && { pdfUrl: data.pdfUrl || null }),
      ...(data.lockAfterSubmit !== undefined && { lockAfterSubmit: data.lockAfterSubmit }),
    },
    include: { questions: { orderBy: { order: "asc" } } },
  });
}
