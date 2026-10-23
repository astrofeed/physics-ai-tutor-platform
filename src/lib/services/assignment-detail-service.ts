import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/constants";
import type { ApiUser } from "@/lib/api-auth";
import { AssignmentError } from "@/lib/services/assignment-service";
import { humanGradingStarted } from "@/lib/services/submission-service";

async function getAssignmentAppeals(
  assignmentId: string,
  user: Pick<ApiUser, "id" | "role">,
  answerIds: string[]
) {
  // TODO: Paginate staff appeals with the detail client (Rule 4.3); applying
  // a limit here alone would hide existing student appeals.
  if (isStaff(user.role)) {
    const submissions = await prisma.submission.findMany({
      where: { assignmentId },
      select: { id: true },
    });
    if (submissions.length > 0) {
      const answers = await prisma.submissionAnswer.findMany({
        where: { submissionId: { in: submissions.map((submission) => submission.id) } },
        select: { id: true },
      });
      answerIds = answers.map((answer) => answer.id);
    } else {
      answerIds = [];
    }
  }
  if (answerIds.length === 0) return [];

  return prisma.gradeAppeal.findMany({
    where: {
      submissionAnswerId: { in: answerIds },
      ...(!isStaff(user.role) && { studentId: user.id }),
    },
    include: {
      student: { select: { id: true, name: true } },
      submissionAnswer: {
        select: {
          id: true,
          questionId: true,
          score: true,
          feedback: true,
          question: { select: { questionText: true, points: true, order: true } },
          submission: { select: { user: { select: { name: true } } } },
        },
      },
      messages: {
        include: { user: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAssignmentDetail(
  assignmentId: string,
  user: Pick<ApiUser, "id" | "role">
) {
  const staff = isStaff(user.role);
  const [assignment, submission] = await Promise.all([
    prisma.assignment.findFirst({
      where: { id: assignmentId, isDeleted: false },
      include: {
        questions: {
          orderBy: { order: "asc" },
          include: { keyConfirmedBy: { select: { name: true } } },
        },
        createdBy: { select: { name: true } },
        publishedBy: { select: { name: true } },
        ...(staff && { _count: { select: { submissions: { where: { isDraft: false } } } } }),
      },
    }),
    prisma.submission.findFirst({
      where: { assignmentId, userId: user.id },
      include: { answers: true },
    }),
  ]);

  if (!assignment) throw new AssignmentError("Not found", 404);
  const scheduledInFuture = assignment.scheduledPublishAt !== null &&
    assignment.scheduledPublishAt > new Date();
  if (user.role === "STUDENT" && (!assignment.published || scheduledInFuture)) {
    throw new AssignmentError("Not found", 404);
  }

  const appeals = await getAssignmentAppeals(
    assignmentId, user, submission?.answers.map((answer) => answer.id) ?? []
  );
  const questions = assignment.questions.map((question) => ({
    ...question,
    tolerance: question.tolerance === null ? null : Number(question.tolerance),
  }));
  if (staff) {
    return { assignment: { ...assignment, questions }, submission: submission || null, appeals };
  }

  // Student responses must not expose answer keys or staff work before release.
  const released = submission?.gradedAt != null;
  return {
    assignment: {
      ...assignment,
      _count: { submissions: 0 },
      questions: questions.map((question) => ({
        ...question,
        correctAnswer: released ? question.correctAnswer : null,
        alsoAcceptedAnswers: released ? question.alsoAcceptedAnswers : [],
      })),
    },
    submission: submission ? {
      ...submission,
      beingGraded: humanGradingStarted(submission),
      totalScore: released ? submission.totalScore : null,
      draftTotalScore: null,
      overallFeedback: released ? submission.overallFeedback : null,
      feedbackFileUrl: released ? submission.feedbackFileUrl : null,
      answers: submission.answers.map((answer) => ({
        ...answer,
        score: released ? answer.score : null,
        feedback: released ? answer.feedback : null,
        feedbackImageUrls: released ? answer.feedbackImageUrls : null,
      })),
    } : null,
    appeals,
  };
}
