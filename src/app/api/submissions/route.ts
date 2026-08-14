import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";

export async function GET(req: Request) {
  try {
    const auth = await requireApiAuth();
    if (isErrorResponse(auth)) return auth;
    const userId = auth.user.id;
    const { searchParams } = new URL(req.url);
    const assignmentId = searchParams.get("assignmentId");

    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId required" }, { status: 400 });
    }

    const submission = await prisma.submission.findFirst({
      where: {
        assignmentId,
        userId,
        isDeleted: false,
        assignment: { isDeleted: false },
      },
      include: { answers: true },
    });

    return NextResponse.json({ submission });
  } catch (error) {
    console.error("Get submission error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiAuth();
    if (isErrorResponse(auth)) return auth;
    const userId = auth.user.id;
    const { assignmentId, answers, fileUrl, isDraft } = await req.json();

    const assignment = await prisma.assignment.findFirst({
      where: { id: assignmentId, isDeleted: false },
      include: { questions: true },
    });

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const existingSubmission = await prisma.submission.findFirst({
      where: { assignmentId, userId },
      include: { answers: { select: { score: true } } },
    });

    if (isDraft) {
      // Draft save: upsert without auto-grading
      if (existingSubmission && !existingSubmission.isDraft) {
        return NextResponse.json(
          { error: "Cannot overwrite a final submission with a draft" },
          { status: 409 }
        );
      }

      if (existingSubmission) {
        // Update existing draft: delete old answers, create new ones
        await prisma.submissionAnswer.deleteMany({
          where: { submissionId: existingSubmission.id },
        });
        const submission = await prisma.submission.update({
          where: { id: existingSubmission.id },
          data: {
            fileUrl,
            submittedAt: new Date(),
            answers: {
              create: (answers || []).map((a: { questionId: string; answer: string; answerImageUrls?: string[] }) => ({
                questionId: a.questionId,
                answer: a.answer,
                answerImageUrls: a.answerImageUrls?.length ? a.answerImageUrls : undefined,
                autoGraded: false,
                score: null,
              })),
            },
          },
          include: { answers: true },
        });
        return NextResponse.json({ submission });
      }

      // Create new draft
      const submission = await prisma.submission.create({
        data: {
          assignmentId,
          userId,
          fileUrl,
          isDraft: true,
          answers: {
            create: (answers || []).map((a: { questionId: string; answer: string; answerImageUrls?: string[] }) => ({
              questionId: a.questionId,
              answer: a.answer,
              answerImageUrls: a.answerImageUrls?.length ? a.answerImageUrls : undefined,
              autoGraded: false,
              score: null,
            })),
          },
        },
        include: { answers: true },
      });
      return NextResponse.json({ submission });
    }

    // Final submission (isDraft false or omitted)
    if (existingSubmission && !existingSubmission.isDraft && assignment.lockAfterSubmit) {
      return NextResponse.json(
        { error: "This assignment is locked after submission. You cannot resubmit." },
        { status: 403 }
      );
    }
    // Block resubmit if grading has started or finished
    if (existingSubmission && !existingSubmission.isDraft) {
      const gradingStarted = existingSubmission.gradedAt !== null || existingSubmission.answers.some((a) => a.score !== null);
      if (gradingStarted) {
        return NextResponse.json(
          { error: existingSubmission.gradedAt ? "This submission has been graded and cannot be resubmitted." : "This submission is being graded and cannot be resubmitted." },
          { status: 403 }
        );
      }
    }
    if (existingSubmission) {
      // Clean up old uploaded file if it exists
      if (existingSubmission.fileUrl) {
        try {
          const fs = await import("fs/promises");
          const path = await import("path");
          const filePath = path.join(process.cwd(), "public", existingSubmission.fileUrl);
          await fs.unlink(filePath).catch((err) => console.error("[cleanup] Failed to delete old file:", err));
        } catch { /* ignore cleanup errors */ }
      }
      await prisma.submission.delete({
        where: { id: existingSubmission.id },
      });
    }

    const submission = await prisma.submission.create({
      data: {
        assignmentId,
        userId,
        fileUrl,
        isDraft: false,
        answers: {
          create: (answers || []).map((a: { questionId: string; answer: string; answerImageUrls?: string[] }) => {
            const question = assignment.questions.find((q) => q.id === a.questionId);
            let autoGraded = false;
            let score: number | null = null;

            if (question && (question.questionType === "MC" || question.questionType === "NUMERIC")) {
              autoGraded = true;
              const studentAnswer = a.answer.trim().toLowerCase();
              const correctAnswer = (question.correctAnswer || "").trim().toLowerCase();
              score = studentAnswer === correctAnswer ? question.points : 0;
            }

            return {
              questionId: a.questionId,
              answer: a.answer,
              answerImageUrls: a.answerImageUrls?.length ? a.answerImageUrls : undefined,
              autoGraded,
              score,
            };
          }),
        },
      },
      include: { answers: true },
    });

    if (assignment.type === "QUIZ" && submission.answers.length > 0) {
      const totalScore = submission.answers.reduce(
        (sum, ans) => sum + (ans.score || 0),
        0
      );
      const allAutoGraded = submission.answers.every((ans) => ans.autoGraded);

      await prisma.submission.update({
        where: { id: submission.id },
        data: {
          totalScore: allAutoGraded ? totalScore : null,
          gradedAt: allAutoGraded ? new Date() : null,
        },
      });
    }

    return NextResponse.json({ submission });
  } catch (error) {
    console.error("Submission error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
