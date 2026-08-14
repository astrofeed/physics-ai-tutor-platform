import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import { logger } from "@/lib/logger";
import { MAX_ANSWER_IMAGES, MAX_ANSWER_LENGTH } from "@/lib/answer-limits";
import {
  SubmissionError,
  saveSubmission,
} from "@/lib/services/submission-service";

const answerSchema = z.object({
  questionId: z.string().min(1),
  answer: z.string().max(MAX_ANSWER_LENGTH),
  answerImageUrls: z.array(z.string()).max(MAX_ANSWER_IMAGES).optional(),
});

const submissionSchema = z.object({
  assignmentId: z.string().min(1),
  answers: z.array(answerSchema).max(500).optional(),
  fileUrl: z.string().max(2000).nullable().optional(),
  isDraft: z.boolean().optional(),
  acknowledgeLate: z.boolean().optional(),
});

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
      where: { assignmentId, userId, isDeleted: false },
      include: { answers: true },
    });

    return NextResponse.json({ submission });
  } catch (error) {
    logger.error("Get submission error", {
      route: "/api/submissions",
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiAuth();
    if (isErrorResponse(auth)) return auth;

    const parsed = submissionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const submission = await saveSubmission(auth.user, parsed.data);
    return NextResponse.json({ submission });
  } catch (error) {
    if (error instanceof SubmissionError) {
      return NextResponse.json(
        { error: error.message, ...error.extra },
        { status: error.status }
      );
    }

    logger.error("Submission error", {
      route: "/api/submissions",
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
