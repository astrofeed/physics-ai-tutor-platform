import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { AssignmentError } from "@/lib/services/assignment-service";
import { setAnswerKeyConfirmed } from "@/lib/services/key-review-service";
import { logger } from "@/lib/logger";

const ConfirmKeySchema = z.object({ confirmed: z.boolean() });

export async function POST(
  req: Request,
  { params }: { params: { id: string; questionId: string } }
) {
  try {
    const auth = await requireApiRole(["TA", "PROFESSOR", "ADMIN"]);
    if (isErrorResponse(auth)) return auth;

    const parsed = ConfirmKeySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const question = await setAnswerKeyConfirmed(
      params.id,
      params.questionId,
      parsed.data.confirmed,
      auth.user
    );

    return NextResponse.json({ question });
  } catch (error) {
    if (error instanceof AssignmentError) {
      return NextResponse.json(
        { error: error.message, ...error.extra },
        { status: error.status }
      );
    }
    logger.error("Confirm answer key error", {
      assignmentId: params.id,
      questionId: params.questionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
