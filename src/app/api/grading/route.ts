import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { aiAssistedGrading, type AIProvider } from "@/lib/ai";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

const gradeItemSchema = z.object({
  answerId: z.string().min(1),
  score: z.number().min(0),
  feedback: z.string().max(10000).optional().nullable(),
});

const gradingPostSchema = z.object({
  submissionId: z.string().min(1),
  grades: z.array(gradeItemSchema).optional(),
  overallScore: z.number().min(0).optional(),
  overallFeedback: z.string().max(10000).optional().nullable(),
  feedbackFileUrl: z.string().optional().nullable(),
  feedbackImages: z.record(z.string(), z.array(z.string())).optional().nullable(),
  isDraft: z.boolean().optional(),
  ungrade: z.boolean().optional(),
});

const gradingPutSchema = z.object({
  answerId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const auth = await requireApiRole(["TA", "PROFESSOR", "ADMIN"]);
    if (isErrorResponse(auth)) return auth;
    const graderId = auth.user.id;

    const parseResult = gradingPostSchema.safeParse(await req.json());
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { submissionId, grades, overallScore, overallFeedback, feedbackFileUrl, feedbackImages, isDraft, ungrade } = parseResult.data;

    const gradable = await prisma.submission.findFirst({
      where: {
        id: submissionId,
        isDeleted: false,
        assignment: { isDeleted: false },
      },
      select: { id: true },
    });

    if (!gradable) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // Ungrade: clear gradedAt and gradedById
    if (ungrade && submissionId) {
      await prisma.submission.update({
        where: { id: submissionId },
        data: { totalScore: null, gradedAt: null, gradedById: null },
      });
      return NextResponse.json({ success: true, ungraded: true });
    }

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { answers: { include: { question: true } } },
    });

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // Per-question grading with score bounds validation
    if (grades && grades.length > 0) {
      // Build a lookup of questionId -> max points for bounds checking
      const questionPointsMap = new Map<string, number>();
      for (const ans of submission.answers) {
        questionPointsMap.set(ans.questionId, ans.question.points);
        questionPointsMap.set(ans.id, ans.question.points); // also index by answerId
      }

      for (const grade of grades) {
        let questionId: string;
        let maxPoints: number | undefined;

        if (grade.answerId.startsWith("blank-")) {
          questionId = grade.answerId.replace("blank-", "");
          // Fetch the question directly for blank answers not in the submission
          if (!questionPointsMap.has(questionId)) {
            const question = await prisma.assignmentQuestion.findUnique({
              where: { id: questionId },
              select: { points: true },
            });
            if (question) {
              questionPointsMap.set(questionId, question.points);
            }
          }
          maxPoints = questionPointsMap.get(questionId);
        } else {
          maxPoints = questionPointsMap.get(grade.answerId);
          if (maxPoints === undefined) {
            // Fetch via the answer record if not already in the map
            const answer = await prisma.submissionAnswer.findUnique({
              where: { id: grade.answerId },
              include: { question: { select: { points: true } } },
            });
            if (answer) {
              maxPoints = answer.question.points;
              questionPointsMap.set(grade.answerId, maxPoints);
            }
          }
        }

        if (maxPoints !== undefined && grade.score > maxPoints) {
          return NextResponse.json(
            { error: `Score ${grade.score} exceeds maximum points (${maxPoints}) for answer ${grade.answerId}` },
            { status: 400 }
          );
        }

        if (grade.answerId.startsWith("blank-")) {
          questionId = grade.answerId.replace("blank-", "");
          // Create a SubmissionAnswer for a question the student left blank
          await prisma.submissionAnswer.create({
            data: {
              submissionId,
              questionId,
              answer: null,
              score: grade.score,
              feedback: grade.feedback,
              autoGraded: false,
              ...(feedbackImages?.[grade.answerId]?.length && {
                feedbackImageUrls: feedbackImages[grade.answerId],
              }),
            },
          });
        } else {
          await prisma.submissionAnswer.update({
            where: { id: grade.answerId },
            data: {
              score: grade.score,
              feedback: grade.feedback,
              ...(feedbackImages?.[grade.answerId]?.length && {
                feedbackImageUrls: feedbackImages[grade.answerId],
              }),
            },
          });
        }
      }
    }

    // Determine total score: use overallScore if provided, otherwise sum per-question scores
    let finalTotalScore: number;
    if (overallScore !== undefined) {
      finalTotalScore = overallScore;
    } else if (grades && grades.length > 0) {
      const updatedAnswers = await prisma.submissionAnswer.findMany({
        where: { submissionId },
      });
      finalTotalScore = updatedAnswers.reduce(
        (sum, ans) => sum + (ans.score || 0),
        0
      );
    } else {
      return NextResponse.json({ error: "No grades provided" }, { status: 400 });
    }

    if (isDraft) {
      // Draft grading: save scores but don't mark as graded
      await prisma.submission.update({
        where: { id: submissionId },
        data: {
          totalScore: finalTotalScore,
          ...(feedbackFileUrl !== undefined && { fileUrl: feedbackFileUrl }),
          ...(overallFeedback !== undefined && { overallFeedback }),
        },
      });
      return NextResponse.json({ success: true, totalScore: finalTotalScore, isDraft: true });
    }

    await prisma.submission.update({
      where: { id: submissionId },
      data: {
        totalScore: finalTotalScore,
        gradedAt: new Date(),
        gradedById: graderId,
        ...(feedbackFileUrl !== undefined && { fileUrl: feedbackFileUrl }),
        ...(overallFeedback !== undefined && { overallFeedback }),
      },
    });

    return NextResponse.json({ success: true, totalScore: finalTotalScore });
  } catch (error) {
    logger.error("Grading POST error", {
      route: "/api/grading",
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Resource not found" }, { status: 404 });
      }
      if (error.code === "P2002") {
        return NextResponse.json({ error: "Duplicate record conflict" }, { status: 409 });
      }
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireApiRole(["TA", "PROFESSOR", "ADMIN"]);
    if (isErrorResponse(auth)) return auth;

    const parseResult = gradingPutSchema.safeParse(await req.json());
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { answerId } = parseResult.data;

    const answer = await prisma.submissionAnswer.findUnique({
      where: { id: answerId },
      include: {
        question: {
          include: { rubrics: true },
        },
      },
    });

    if (!answer) {
      return NextResponse.json({ error: "Answer not found" }, { status: 404 });
    }

    const aiConfig = await prisma.aIConfig.findFirst({
      where: { isActive: true },
    });

    const provider = (aiConfig?.provider as AIProvider) || "openai";

    const rubricDesc = answer.question.rubrics
      .map((r) => `${r.description} (${r.points} pts)`)
      .join("\n");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imageUrls = ((answer as any).answerImageUrls as string[] | null) || [];
    const result = await aiAssistedGrading(
      answer.question.questionText,
      answer.question.correctAnswer || "",
      answer.answer || "",
      rubricDesc || "Grade based on correctness and completeness",
      answer.question.points,
      provider,
      imageUrls.length > 0 ? imageUrls : undefined
    );

    if (!result) {
      return NextResponse.json({ error: "AI grading failed" }, { status: 500 });
    }

    const parsed = JSON.parse(result);

    return NextResponse.json({
      suggestedScore: parsed.score,
      suggestedFeedback: parsed.feedback,
    });
  } catch (error) {
    logger.error("AI-assisted grading error", {
      route: "/api/grading",
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Resource not found" }, { status: 404 });
      }
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "AI returned invalid response" }, { status: 502 });
    }

    if (error instanceof Error) {
      if (error.message.includes("rate limit") || error.message.includes("429")) {
        return NextResponse.json({ error: "AI service rate limited. Please try again in a moment." }, { status: 429 });
      }
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
