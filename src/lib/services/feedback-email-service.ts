/**
 * Sends the staff-edited AI feedback of a report or presentation grading job
 * to the student and records where it went on the job.
 */

import { prisma } from "@/lib/prisma";
import { GRADING_FEEDBACK_EMAILED_ACTION } from "@/lib/constants";
import { EmailNotConfiguredError, sendEmail } from "@/lib/email";
import { gradingFeedbackEmail } from "@/lib/email-templates";
import type { FeedbackEmailInput, FeedbackEmailStatus } from "@/lib/feedback-email";

export type SendFeedbackResult =
  | { ok: true; sentAt: string }
  | { ok: false; status: 404 | 502 | 503; error: string };

interface FeedbackEmailRow {
  feedbackSentAt: Date | null;
  feedbackSentTo: string | null;
}

export function toFeedbackEmailStatus(
  job: FeedbackEmailRow,
  studentEmail: string | null
): FeedbackEmailStatus {
  return {
    studentEmail,
    feedbackSentAt: job.feedbackSentAt?.toISOString() ?? null,
    feedbackSentTo: job.feedbackSentTo,
  };
}

interface Sender {
  id: string;
  name: string | null;
}

type JobKind = "report" | "presentation";

async function jobExists(kind: JobKind, jobId: string): Promise<boolean> {
  const where = { where: { id: jobId }, select: { id: true } };
  const job =
    kind === "report"
      ? await prisma.reportGradingJob.findUnique(where)
      : await prisma.presentationGradingJob.findUnique(where);
  return job !== null;
}

async function markSent(kind: JobKind, jobId: string, to: string, sentAt: Date) {
  const update = { where: { id: jobId }, data: { feedbackSentAt: sentAt, feedbackSentTo: to } };
  if (kind === "report") await prisma.reportGradingJob.update(update);
  else await prisma.presentationGradingJob.update(update);
}

async function sendFeedback(
  kind: JobKind,
  jobId: string,
  sender: Sender,
  input: FeedbackEmailInput
): Promise<SendFeedbackResult> {
  if (!(await jobExists(kind, jobId))) {
    return { ok: false, status: 404, error: "Job not found" };
  }

  const senderName = sender.name ?? "Course staff";
  try {
    await sendEmail({
      to: input.to,
      subject: input.subject,
      html: gradingFeedbackEmail({ message: input.message, senderName }),
    });
  } catch (error) {
    if (error instanceof EmailNotConfiguredError) {
      return { ok: false, status: 503, error: error.message };
    }
    console.error(`[feedback-email] ${kind} job ${jobId}: send to ${input.to} failed`, error);
    return { ok: false, status: 502, error: "The mail server rejected the message. Try again." };
  }

  const sentAt = new Date();
  await markSent(kind, jobId, input.to, sentAt);
  await recordInEmailRecords(kind, jobId, sender.id, senderName, input);
  return { ok: true, sentAt: sentAt.toISOString() };
}

/**
 * Same AuditLog shape as bulk emails so the admin Email Records page lists the
 * send. The recipient is stored as a user id when the address belongs to a
 * platform account (the page then shows the name), otherwise as the address.
 */
async function recordInEmailRecords(
  kind: JobKind,
  jobId: string,
  senderId: string,
  senderName: string,
  input: FeedbackEmailInput
) {
  const account = await prisma.user.findUnique({
    where: { email: input.to },
    select: { id: true },
  });
  await prisma.auditLog.create({
    data: {
      userId: senderId,
      action: GRADING_FEEDBACK_EMAILED_ACTION,
      details: {
        performedBy: senderId,
        performedByName: senderName,
        recipientIds: [account?.id ?? input.to],
        recipientCount: 1,
        subject: input.subject,
        message: input.message,
        sentCount: 1,
        failedCount: 0,
        jobKind: kind,
        jobId,
      },
    },
  });
}

export function sendReportFeedback(jobId: string, sender: Sender, input: FeedbackEmailInput) {
  return sendFeedback("report", jobId, sender, input);
}

export function sendPresentationFeedback(
  jobId: string,
  sender: Sender,
  input: FeedbackEmailInput
) {
  return sendFeedback("presentation", jobId, sender, input);
}
