import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import { humanGradingStarted } from "@/lib/services/submission-service";

// Convert a submission back to draft for editing
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireApiAuth();
    if (isErrorResponse(auth)) return auth;
    const userId = auth.user.id;

    const submission = await prisma.submission.findUnique({
      where: { id: params.id },
      include: {
        assignment: { select: { lockAfterSubmit: true } },
        answers: { select: { id: true, score: true, autoGraded: true } },
      },
    });

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    if (submission.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (submission.assignment.lockAfterSubmit && !submission.isDraft) {
      return NextResponse.json(
        { error: "This assignment is locked after submission. You cannot edit." },
        { status: 403 }
      );
    }

    if (humanGradingStarted(submission) && !submission.isDraft) {
      return NextResponse.json(
        { error: submission.gradedAt ? "This submission has been graded and cannot be edited." : "This submission is being graded and cannot be edited." },
        { status: 403 }
      );
    }

    // Convert back to draft
    await prisma.submission.update({
      where: { id: params.id },
      data: { isDraft: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Edit submission error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireApiAuth();
    if (isErrorResponse(auth)) return auth;
    const userId = auth.user.id;

    const submission = await prisma.submission.findUnique({
      where: { id: params.id },
      include: {
        assignment: { select: { lockAfterSubmit: true } },
        answers: { select: { score: true, autoGraded: true } },
      },
    });

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    if (submission.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (submission.assignment.lockAfterSubmit && !submission.isDraft) {
      return NextResponse.json(
        { error: "This assignment is locked after submission. You cannot delete or resubmit." },
        { status: 403 }
      );
    }

    if (humanGradingStarted(submission) && !submission.isDraft) {
      return NextResponse.json(
        { error: submission.gradedAt ? "This submission has been graded and cannot be deleted." : "This submission is being graded and cannot be deleted." },
        { status: 403 }
      );
    }

    await prisma.submission.update({
      where: { id: params.id },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete submission error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
