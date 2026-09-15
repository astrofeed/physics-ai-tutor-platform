/**
 * Sends the staff-edited AI feedback of a report or presentation grading job
 * to the student and records where it went on the job.
 */

import { prisma } from "@/lib/prisma";
import { emailConfigured, sendEmail } from "@/lib/email";
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
  if (!emailConfigured) {
    return {
      ok: false,
      status: 503,
      error: "Email is not configured on this server (GMAIL_USER / GMAIL_APP_PASSWORD).",
    };
  }
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
    console.error(`[feedback-email] ${kind} job ${jobId}: send to ${input.to} failed`, error);
    return { ok: false, status: 502, error: "The mail server rejected the message. Try again." };
  }

  const sentAt = new Date();
  await markSent(kind, jobId, input.to, sentAt);
  await prisma.auditLog.create({
    data: {
      userId: sender.id,
      action: "grading_feedback_emailed",
      details: {
        performedBy: sender.id,
        performedByName: senderName,
        jobKind: kind,
        jobId,
        to: input.to,
        subject: input.subject,
      },
    },
  });
  return { ok: true, sentAt: sentAt.toISOString() };
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
