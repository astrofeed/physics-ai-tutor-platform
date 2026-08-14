import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { aiAssistedGrading, type AIProvider } from "@/lib/ai";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { logger } from "@/lib/logger";
import { GradingError, saveGrades, ungradeSubmission } from "@/lib/services/grading-service";
import { toDataUri } from "@/lib/services/file-storage";

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
    const { ungrade, ...input } = parseResult.data;

    if (ungrade) {
      await ungradeSubmission(graderId, input.submissionId);
      return NextResponse.json({ success: true, ungraded: true });
    }

    const result = await saveGrades(graderId, input);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof GradingError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

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

    const storedImageUrls = Array.isArray(answer.answerImageUrls)
      ? (answer.answerImageUrls as string[])
      : [];
    // Answer images live behind an authenticated route, so the model cannot
    // fetch them by URL — inline them as data URIs instead.
    const imageUrls = (await Promise.all(storedImageUrls.map(toDataUri))).filter(
      (url): url is string => Boolean(url)
    );
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
