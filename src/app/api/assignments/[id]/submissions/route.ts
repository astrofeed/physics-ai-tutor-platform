import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireApiRole(["TA", "PROFESSOR", "ADMIN"]);
    if (isErrorResponse(auth)) return auth;

    const assignment = await prisma.assignment.findUnique({
      where: { id: params.id },
      select: { title: true, type: true, totalPoints: true, dueDate: true },
    });

    // Fetch all questions for this assignment to include unanswered ones
    const allQuestions = await prisma.assignmentQuestion.findMany({
      where: { assignmentId: params.id },
      orderBy: { order: "asc" },
      select: { id: true, questionText: true, questionType: true, points: true, correctAnswer: true },
    });

    const submissions = await prisma.submission.findMany({
      where: { assignmentId: params.id, isDraft: false, isDeleted: false },
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
        gradedAt: s.gradedAt?.toISOString() || null,
        gradedByName: s.gradedBy?.name || null,
        fileUrl: s.fileUrl,
        overallFeedback: s.overallFeedback || null,
        openAppealCount,
        totalAppealCount,
        answers: (() => {
          // Map answered questions
          const answeredMap = new Map(s.answers.map((a) => [a.questionId, a]));
          return allQuestions.map((q) => {
            const a = answeredMap.get(q.id);
            if (a) {
              return {
                id: a.id,
                questionText: q.questionText,
                questionType: q.questionType,
                answer: a.answer,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                answerImageUrls: (a as any).answerImageUrls,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                feedbackImageUrls: (a as any).feedbackImageUrls,
                score: a.score,
                feedback: a.feedback,
                autoGraded: a.autoGraded,
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
            // Unanswered question — student left blank
            return {
              id: `blank-${q.id}`,
              questionText: q.questionText,
              questionType: q.questionType,
              answer: null,
              answerImageUrls: null,
              score: 0,
              feedback: null,
              autoGraded: false,
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

    return NextResponse.json({ assignment, submissions: formattedSubmissions });
  } catch (error) {
    console.error("Submissions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
