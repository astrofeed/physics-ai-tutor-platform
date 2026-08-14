import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { sendBulkEmails } from "@/lib/services/email-service";

const MAX_RECIPIENTS = 200;

const BulkEmailSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(MAX_RECIPIENTS),
  subject: z.string().trim().min(1).max(500),
  message: z.string().trim().min(1).max(50_000),
});

export async function POST(req: Request) {
  try {
    const auth = await requireApiRole(["TA", "PROFESSOR", "ADMIN"]);
    if (isErrorResponse(auth)) return auth;
    const senderId = auth.user.id;
    const senderName = auth.user.name || "Staff";

    const parsed = BulkEmailSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: `userIds (1-${MAX_RECIPIENTS} ids), subject (≤500 chars), and message (≤50,000 chars) are required`,
        },
        { status: 400 }
      );
    }
    const { userIds, subject, message } = parsed.data;

    const result = await sendBulkEmails({
      recipientIds: userIds,
      subject,
      message,
      senderName,
    });

    if (result.recipients.length === 0) {
      return NextResponse.json(
        { error: "No eligible recipients found (banned or deleted users are skipped)" },
        { status: 404 }
      );
    }

    await prisma.auditLog.create({
      data: {
        userId: senderId,
        action: "bulk_email_sent",
        details: {
          performedBy: senderId,
          performedByName: senderName,
          recipientIds: result.recipients.map((u) => u.id),
          recipientCount: result.recipients.length,
          subject,
          message,
          sentCount: result.sentCount,
          failedCount: result.failedCount,
          skippedCount: result.skippedCount,
        },
      },
    });

    return NextResponse.json({
      success: true,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      skippedCount: result.skippedCount,
      ...(result.errors.length > 0 && { errors: result.errors }),
    });
  } catch (error) {
    console.error("Bulk email error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
