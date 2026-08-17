import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { notificationEmail } from "@/lib/email-templates";

// ---------------------------------------------------------------------------
// Cron auth
// ---------------------------------------------------------------------------

/**
 * Verify the CRON_SECRET from a request's Authorization header.
 * Returns null on success, or a NextResponse error to return early.
 */
export function verifyCronAuth(req: Request): NextResponse | null {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("[cron] CRON_SECRET is not configured");
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

// ---------------------------------------------------------------------------
// Bulk email sending
// ---------------------------------------------------------------------------

export interface SendBulkEmailsParams {
  recipientIds: string[];
  subject: string;
  message: string;
  senderName: string;
  /** Custom HTML builder per recipient. Defaults to `notificationEmail`. */
  htmlBuilder?: (user: { name: string | null; email: string }) => string;
}

export interface SendBulkEmailsResult {
  recipients: { id: string; name: string | null; email: string }[];
  sentCount: number;
  failedCount: number;
  /** Requested recipients that were banned, deleted, or no longer exist. */
  skippedCount: number;
  errors: string[];
}

/**
 * Send an email to a list of user IDs. Banned, soft-deleted, and unknown IDs are
 * skipped server-side so a stale client selection cannot mail an ineligible user.
 */
export async function sendBulkEmails(params: SendBulkEmailsParams): Promise<SendBulkEmailsResult> {
  const { recipientIds, subject, message, senderName, htmlBuilder } = params;

  const uniqueIds = Array.from(new Set(recipientIds));
  const recipients = await prisma.user.findMany({
    where: { id: { in: uniqueIds }, isBanned: false, isDeleted: false },
    select: { id: true, name: true, email: true },
  });
  const skippedCount = uniqueIds.length - recipients.length;

  if (recipients.length === 0) {
    return {
      recipients: [],
      sentCount: 0,
      failedCount: 0,
      skippedCount,
      errors: ["No valid recipients found"],
    };
  }

  const buildHtml = htmlBuilder ?? ((user: { name: string | null }) =>
    notificationEmail({ userName: user.name || "Student", message, senderName })
  );

  const results = await Promise.allSettled(
    recipients.map((user) =>
      sendEmail({ to: user.email, subject, html: buildHtml(user) })
    )
  );

  const sentCount = results.filter((r) => r.status === "fulfilled").length;
  const failedCount = results.filter((r) => r.status === "rejected").length;
  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => String(r.reason?.message || r.reason));

  return { recipients, sentCount, failedCount, skippedCount, errors };
}

// ---------------------------------------------------------------------------
// Assignment publishing
// ---------------------------------------------------------------------------

export interface PublishAssignmentResult {
  published: boolean;
}

/**
 * Publish an assignment by ID. Uses `updateMany` with `published: false`
 * guard to prevent double-publish. Clears `scheduledPublishAt`.
 *
 * An assignment under answer-key review stays unpublished until every key is
 * confirmed, so a schedule cannot put unreviewed AI keys in front of students.
 */
export async function publishAssignment(
  assignmentId: string,
  publishedById: string
): Promise<PublishAssignmentResult> {
  const updated = await prisma.assignment.updateMany({
    where: {
      id: assignmentId,
      published: false,
      OR: [
        { requiresKeyReview: false },
        { questions: { none: { keyConfirmedAt: null } } },
      ],
    },
    data: {
      published: true,
      publishedById,
      scheduledPublishAt: null,
    },
  });
  return { published: updated.count > 0 };
}
