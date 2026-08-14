import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronAuth, sendBulkEmails, publishAssignment } from "@/lib/services/email-service";

export async function GET(req: Request) {
  try {
    const authError = verifyCronAuth(req);
    if (authError) return authError;

    const now = new Date();

    // Find all pending scheduled emails that are due
    const pendingEmails = await prisma.scheduledEmail.findMany({
      where: {
        status: "PENDING",
        scheduledAt: { lte: now },
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        assignment: { select: { id: true, published: true, title: true, createdById: true } },
      },
    });

    if (pendingEmails.length === 0) {
      return NextResponse.json({ processed: 0, errors: [] });
    }

    const errors: string[] = [];
    let processedCount = 0;

    for (const scheduled of pendingEmails) {
      try {
        const recipientIds = scheduled.recipientIds as string[];
        const senderName = scheduled.createdBy.name || "Staff";

        // Send emails if there are recipients
        let sentCount = 0;
        let failedCount = 0;
        let skippedCount = 0;
        let recipientCount = 0;
        if (recipientIds.length > 0) {
          const result = await sendBulkEmails({
            recipientIds,
            subject: scheduled.subject,
            message: scheduled.message,
            senderName,
          });
          sentCount = result.sentCount;
          failedCount = result.failedCount;
          skippedCount = result.skippedCount;
          recipientCount = result.recipients.length;
        }

        // Create in-app notification if flagged, visible only to the chosen roles
        if (scheduled.createNotification) {
          await prisma.notification.create({
            data: {
              title: scheduled.subject,
              message: scheduled.message,
              createdById: scheduled.createdById,
              audienceRoles: scheduled.audienceRoles,
            },
          });
        }

        const statusNotes = [
          failedCount > 0 ? `${failedCount} of ${recipientCount} emails failed` : null,
          skippedCount > 0 ? `${skippedCount} recipients skipped (banned or deleted)` : null,
          recipientIds.length === 0 ? "No email recipients — in-app notification only" : null,
        ].filter((note): note is string => note !== null);

        // Mark as sent
        await prisma.scheduledEmail.update({
          where: { id: scheduled.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
            error: statusNotes.length > 0 ? statusNotes.join("; ") : null,
          },
        });

        // Audit log
        await prisma.auditLog.create({
          data: {
            userId: scheduled.createdById,
            action: "scheduled_email_sent",
            details: {
              scheduledEmailId: scheduled.id,
              subject: scheduled.subject,
              recipientCount,
              sentCount,
              failedCount,
              skippedCount,
              createNotification: scheduled.createNotification,
              audienceRoles: scheduled.audienceRoles,
            },
          },
        });

        // Publish linked assignment after email is sent
        if (scheduled.assignment && !scheduled.assignment.published) {
          try {
            const pubResult = await publishAssignment(
              scheduled.assignment.id,
              scheduled.assignment.createdById
            );

            if (pubResult.published) {
              await prisma.auditLog.create({
                data: {
                  userId: scheduled.assignment.createdById,
                  action: "scheduled_publish",
                  details: {
                    assignmentId: scheduled.assignment.id,
                    assignmentTitle: scheduled.assignment.title,
                    triggeredBy: "scheduled_email",
                    scheduledEmailId: scheduled.id,
                    publishedAt: new Date().toISOString(),
                  },
                },
              });

              console.log(`[cron] Published assignment "${scheduled.assignment.title}" after sending scheduled email`);
            }
          } catch (publishError) {
            console.error(`[cron] Failed to publish assignment ${scheduled.assignment.id} after email:`, publishError);
          }
        }

        processedCount++;
      } catch (sendError) {
        console.error(`Failed to process scheduled email ${scheduled.id}:`, sendError);
        errors.push(`Failed for "${scheduled.subject}": ${String(sendError)}`);

        await prisma.scheduledEmail.update({
          where: { id: scheduled.id },
          data: { status: "FAILED", error: String(sendError) },
        }).catch((err) => console.error("[email] Failed to update scheduled email status:", err));
      }
    }

    return NextResponse.json({ processed: processedCount, errors });
  } catch (error) {
    console.error("Cron send-scheduled-emails error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
