import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronAuth, sendBulkEmails, publishAssignment } from "@/lib/services/email-service";
import { assignmentPublishedEmail } from "@/lib/email-templates";
import { formatDueDate } from "@/lib/utils";

export async function GET(req: Request) {
  try {
    const authError = verifyCronAuth(req);
    if (authError) return authError;

    // Find all assignments ready to publish.
    // Skip assignments that have a PENDING scheduled email — those will be
    // published by the send-scheduled-emails cron after the email goes out.
    const now = new Date();
    const assignments = await prisma.assignment.findMany({
      where: {
        scheduledPublishAt: { lte: now },
        published: false,
        scheduledEmails: {
          none: { status: "PENDING" },
        },
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (assignments.length === 0) {
      return NextResponse.json({ published: 0, errors: [] });
    }

    const errors: string[] = [];
    let publishedCount = 0;

    for (const assignment of assignments) {
      try {
        const pubResult = await publishAssignment(assignment.id, assignment.createdById);
        // Already published by another process, or still waiting on answer-key
        // confirmations, which the schedule must not override.
        if (!pubResult.published) continue;
        publishedCount++;

        // Audit log
        await prisma.auditLog.create({
          data: {
            userId: assignment.createdById,
            action: "scheduled_publish",
            details: {
              assignmentId: assignment.id,
              assignmentTitle: assignment.title,
              scheduledAt: assignment.scheduledPublishAt?.toISOString(),
              publishedAt: now.toISOString(),
            },
          },
        });

        // Send notification emails if flagged
        if (assignment.notifyOnPublish) {
          try {
            const students = await prisma.user.findMany({
              where: { role: "STUDENT", isBanned: false, isDeleted: false },
              select: { id: true },
            });

            if (students.length > 0) {
              const dueDateStr = formatDueDate(assignment.dueDate);

              const senderName = assignment.createdBy.name || "Staff";

              // Use shared sendBulkEmails with custom htmlBuilder for assignment template
              await sendBulkEmails({
                recipientIds: students.map((s) => s.id),
                subject: `New Assignment: ${assignment.title}`,
                message: "", // not used — htmlBuilder overrides
                senderName,
                htmlBuilder: (user) =>
                  assignmentPublishedEmail({
                    studentName: user.name || "Student",
                    assignmentTitle: assignment.title,
                    assignmentDescription: assignment.description,
                    dueDateStr,
                    totalPoints: assignment.totalPoints,
                    senderName,
                  }),
              });

              // Create in-app notification
              await prisma.notification.create({
                data: {
                  title: `New Assignment: ${assignment.title}`,
                  message: `A new assignment "${assignment.title}" has been published.${assignment.dueDate ? ` Due: ${dueDateStr}` : ""}`,
                  createdById: assignment.createdById,
                  audienceRoles: ["STUDENT"],
                },
              });
            }
          } catch (notifyError) {
            console.error(`Failed to send notifications for assignment ${assignment.id}:`, notifyError);
            errors.push(`Notification failed for "${assignment.title}": ${String(notifyError)}`);
          }
        }
      } catch (publishError) {
        console.error(`Failed to publish assignment ${assignment.id}:`, publishError);
        errors.push(`Publish failed for "${assignment.title}": ${String(publishError)}`);
      }
    }

    return NextResponse.json({ published: publishedCount, errors });
  } catch (error) {
    console.error("Cron publish-scheduled error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
