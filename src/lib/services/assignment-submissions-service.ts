import { prisma } from "@/lib/prisma";
import { AssignmentError } from "@/lib/services/assignment-service";

export async function getAssignmentSubmissions(assignmentId: string) {
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, isDeleted: false },
    select: { title: true, type: true, totalPoints: true, dueDate: true },
  });

  if (!assignment) {
    throw new AssignmentError("Assignment not found", 404);
  }

  // TODO: Paginate with the grading client (Rule 4.3); capping questions alone
  // would omit unanswered student work from this response.
  const allQuestions = await prisma.assignmentQuestion.findMany({
    where: { assignmentId },
    orderBy: { order: "asc" },
    select: {
      id: true,
      questionText: true,
      questionType: true,
      points: true,
      correctAnswer: true,
      alsoAcceptedAnswers: true,
    },
  });

  const submissions = await prisma.submission.findMany({
    where: { assignmentId, isDraft: false, isDeleted: false },
    include: {
      user: { select: { name: true, email: true } },
      gradedBy: { select: { name: true } },
      answers: {
        include: {
          question: {
            select: {
              questionText: true,
              questionType: true,
              points: true,
              correctAnswer: true,
            },
          },
          appeals: {
            include: {
              student: { select: { id: true, name: true } },
              messages: {
                include: {
                  user: { select: { id: true, name: true, role: true } },
                },
                orderBy: { createdAt: "asc" as const },
              },
            },
          },
        },
      },
    },
    orderBy: { submittedAt: "desc" },
    take: 200,
  });

  const formattedSubmissions = submissions.map((s) => {
    const openAppealCount = s.answers.reduce(
      (count, a) => count + a.appeals.filter((ap) => ap.status === "OPEN").length,
      0
    );
    const totalAppealCount = s.answers.reduce(
      (count, a) => count + a.appeals.length,
      0
    );
    return {
      id: s.id,
      userName: s.user.name || "Unknown",
      userEmail: s.user.email,
      submittedAt: s.submittedAt.toISOString(),
      totalScore: s.totalScore,
      draftTotalScore: s.draftTotalScore,
      gradedAt: s.gradedAt?.toISOString() || null,
      gradedByName: s.gradedBy?.name || null,
      fileUrl: s.fileUrl,
      feedbackFileUrl: s.feedbackFileUrl,
      overallFeedback: s.overallFeedback || null,
      openAppealCount,
      totalAppealCount,
      answers: (() => {
        const answeredMap = new Map(s.answers.map((a) => [a.questionId, a]));
        return allQuestions.map((q) => {
          const a = answeredMap.get(q.id);
          if (a) {
            return {
              id: a.id,
              questionText: q.questionText,
              questionType: q.questionType,
              answer: a.answer,
              answerImageUrls: a.answerImageUrls,
              feedbackImageUrls: a.feedbackImageUrls,
              score: a.score,
              feedback: a.feedback,
              autoGraded: a.autoGraded,
              referenceAnswer: q.correctAnswer,
              alsoAcceptedAnswers: q.alsoAcceptedAnswers,
              aiSuggestedScore: a.aiSuggestedScore === null ? null : Number(a.aiSuggestedScore),
              aiSuggestedFeedback: a.aiSuggestedFeedback,
              aiSuggestedAt: a.aiSuggestedAt?.toISOString() ?? null,
              maxPoints: q.points,
              leftBlank: false,
              appeals: a.appeals.map((ap) => ({
                id: ap.id,
                status: ap.status,
                reason: ap.reason,
                imageUrls: ap.imageUrls,
                createdAt: ap.createdAt.toISOString(),
                student: ap.student,
                messages: ap.messages.map((m) => ({
                  id: m.id,
                  content: m.content,
                  imageUrls: m.imageUrls,
                  createdAt: m.createdAt.toISOString(),
                  user: m.user,
                })),
              })),
            };
          }
          return {
            id: `blank-${q.id}`,
            questionText: q.questionText,
            questionType: q.questionType,
            answer: null,
            answerImageUrls: null,
            score: 0,
            feedback: null,
            autoGraded: false,
            referenceAnswer: q.correctAnswer,
            alsoAcceptedAnswers: q.alsoAcceptedAnswers,
            aiSuggestedScore: null,
            aiSuggestedFeedback: null,
            aiSuggestedAt: null,
            maxPoints: q.points,
            leftBlank: true,
            appeals: [],
          };
        });
      })(),
    };
  });

  return { assignment, submissions: formattedSubmissions };
}
