import { prisma } from "@/lib/prisma";
import { sendBulkEmails } from "@/lib/services/email-service";
import { gradeAppealEmail, appealReplyEmail } from "@/lib/email-templates";

export interface AppealRecipients {
  recipientIds: string[];
  /**
   * `grader` — a human released this grade, so only that person is mailed.
   * `all_tas` — nobody graded the submission manually (fully auto/AI graded), so
   * every TA is mailed. Professors and admins are deliberately left out.
   */
  audience: "grader" | "all_tas";
}

export async function resolveAppealRecipients(
  submissionId: string
): Promise<AppealRecipients> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { gradedById: true },
  });

  if (submission?.gradedById) {
    const grader = await prisma.user.findFirst({
      where: { id: submission.gradedById, isBanned: false, isDeleted: false },
      select: { id: true },
    });
    if (grader) return { recipientIds: [grader.id], audience: "grader" };
  }

  const tas = await prisma.user.findMany({
    where: { role: "TA", isBanned: false, isDeleted: false },
    select: { id: true },
  });

  return { recipientIds: tas.map((ta) => ta.id), audience: "all_tas" };
}

interface AppealEmailContext {
  submissionId: string;
  assignmentId: string;
  assignmentTitle: string;
  questionOrder: number;
  studentName: string;
  score: number | null;
  maxPoints: number;
  reason: string;
  /** Set for a follow-up message so the email is not phrased as a new appeal. */
  isFollowUp?: boolean;
}

/**
 * Mail the grade appeal to whoever is responsible for the grade. Only student
 * activity triggers this — staff replies inside the thread never send email.
 */
export async function notifyGradersOfAppeal(context: AppealEmailContext) {
  const { recipientIds, audience } = await resolveAppealRecipients(context.submissionId);
  if (recipientIds.length === 0) return { audience, sentCount: 0 };

  const appUrl = process.env.NEXTAUTH_URL || "";
  const questionLabel = `Question ${context.questionOrder + 1}`;
  const subject = context.isFollowUp
    ? `New appeal message: ${context.assignmentTitle} — ${questionLabel}`
    : `Grade appeal: ${context.assignmentTitle} — ${questionLabel}`;

  const result = await sendBulkEmails({
    recipientIds,
    subject,
    message: context.reason,
    senderName: context.studentName,
    htmlBuilder: (user) =>
      gradeAppealEmail({
        recipientName: user.name || "Grader",
        studentName: context.studentName,
        assignmentTitle: context.assignmentTitle,
        questionLabel,
        score: context.score,
        maxPoints: context.maxPoints,
        reason: context.reason,
        gradingUrl: `${appUrl}/grading?assignmentId=${context.assignmentId}&submissionId=${context.submissionId}`,
        isUnassigned: audience === "all_tas",
        isFollowUp: context.isFollowUp ?? false,
      }),
  });

  return { audience, sentCount: result.sentCount };
}

export interface AppealPatchContext {
  isStaffActor: boolean;
  actorName: string | null;
  studentId: string;
  studentName: string | null;
  submissionId: string;
  assignmentId: string;
  assignmentTitle: string;
  questionOrder: number;
  score: number | null;
  maxPoints: number;
  message?: string;
  status?: "OPEN" | "RESOLVED" | "REJECTED";
}

/**
 * Route a PATCH on an appeal thread: staff activity mails only the student,
 * student replies mail the grader (or every TA when nobody graded manually).
 */
export async function notifyAppealPatch(context: AppealPatchContext) {
  const common = {
    assignmentId: context.assignmentId,
    assignmentTitle: context.assignmentTitle,
    questionOrder: context.questionOrder,
    score: context.score,
    maxPoints: context.maxPoints,
  };

  if (context.isStaffActor) {
    return notifyStudentOfAppealReply({
      ...common,
      studentId: context.studentId,
      studentName: context.studentName || "Student",
      staffName: context.actorName || "PhysTutor Staff",
      message: context.message,
      status: context.status,
    });
  }

  if (!context.message) return { sentCount: 0 };

  return notifyGradersOfAppeal({
    ...common,
    submissionId: context.submissionId,
    studentName: context.studentName || "A student",
    reason: context.message,
    isFollowUp: true,
  });
}

interface AppealReplyContext {
  studentId: string;
  studentName: string;
  staffName: string;
  assignmentId: string;
  assignmentTitle: string;
  questionOrder: number;
  message?: string;
  status?: "OPEN" | "RESOLVED" | "REJECTED";
  score: number | null;
  maxPoints: number;
}

/**
 * Mail the student when staff reply to or decide their appeal. Staff activity
 * never notifies other staff — only the student who filed the appeal.
 */
export async function notifyStudentOfAppealReply(context: AppealReplyContext) {
  const student = await prisma.user.findFirst({
    where: { id: context.studentId, isBanned: false, isDeleted: false },
    select: { id: true },
  });
  if (!student) return { sentCount: 0 };

  const appUrl = process.env.NEXTAUTH_URL || "";
  const questionLabel = `Question ${context.questionOrder + 1}`;

  const result = await sendBulkEmails({
    recipientIds: [student.id],
    subject: `Appeal update: ${context.assignmentTitle} — ${questionLabel}`,
    message: context.message ?? "",
    senderName: context.staffName,
    htmlBuilder: (user) =>
      appealReplyEmail({
        studentName: user.name || context.studentName,
        staffName: context.staffName,
        assignmentTitle: context.assignmentTitle,
        questionLabel,
        message: context.message,
        status: context.status,
        score: context.score,
        maxPoints: context.maxPoints,
        assignmentUrl: `${appUrl}/assignments/${context.assignmentId}`,
      }),
  });

  return { sentCount: result.sentCount };
}
