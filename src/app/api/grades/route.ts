import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";

export async function GET() {
  try {
    const auth = await requireApiAuth();
    if (isErrorResponse(auth)) return auth;
    const { user } = auth;
    const userId = user.id;

    const submissions = await prisma.submission.findMany({
      where: {
        userId,
        isDeleted: false,
        isDraft: false,
        // A deleted assignment has no page left to link to.
        assignment: { isDeleted: false },
      },
      include: {
        assignment: {
          select: { title: true, type: true, totalPoints: true },
        },
        gradedBy: { select: { name: true } },
      },
      orderBy: { submittedAt: "desc" },
      take: 100,
    });

    // `gradedAt` is the release gate: a submission being graded has per-answer
    // scores saved as a draft, which students must not see as their grade.
    const grades = submissions.map((s) => ({
      id: s.id,
      assignmentId: s.assignmentId,
      assignmentTitle: s.assignment.title,
      assignmentType: s.assignment.type,
      totalPoints: s.assignment.totalPoints,
      score: s.gradedAt ? s.totalScore : null,
      gradedAt: s.gradedAt?.toISOString() || null,
      gradedByName: s.gradedAt ? s.gradedBy?.name || null : null,
      submittedAt: s.submittedAt.toISOString(),
      isLate: s.isLate,
    }));

    return NextResponse.json({ grades });
  } catch (error) {
    console.error("Grades error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
