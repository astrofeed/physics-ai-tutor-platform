import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkAndBanSpammer } from "@/lib/spam-guard";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import { isStaff as isStaffRole } from "@/lib/constants";
import { APPEAL_ON_LIVE_ASSIGNMENT } from "@/lib/services/assignment-service";

const appealPostSchema = z.object({
  submissionAnswerId: z.string().min(1, "submissionAnswerId is required"),
  reason: z.string().min(1, "reason is required").max(5000, "reason must be 5000 characters or fewer"),
  imageUrls: z.array(z.string()).max(3).optional(),
});

const appealPatchSchema = z.object({
  appealId: z.string().min(1, "appealId is required"),
  status: z.enum(["OPEN", "RESOLVED", "REJECTED"]).optional(),
  message: z.string().max(5000).optional(),
  newScore: z.number().min(0).optional(),
  imageUrls: z.array(z.string()).max(3).optional(),
});

// GET: Fetch appeals for a submission (student sees own, TA/ADMIN sees all)
export async function GET(req: Request) {
  try {
    const auth = await requireApiAuth();
    if (isErrorResponse(auth)) return auth;
    const userId = auth.user.id;
    const userRole = auth.user.role;
    const { searchParams } = new URL(req.url);
    const submissionId = searchParams.get("submissionId");
    const assignmentId = searchParams.get("assignmentId");

    // Staff can fetch all open appeals without params (for dashboard)
    if (!submissionId && !assignmentId) {
      if (isStaffRole(userRole)) {
        const appeals = await prisma.gradeAppeal.findMany({
          where: { status: "OPEN", ...APPEAL_ON_LIVE_ASSIGNMENT },
          include: {
            student: { select: { id: true, name: true } },
            submissionAnswer: {
              select: {
                id: true,
                questionId: true,
                score: true,
                feedback: true,
                question: { select: { questionText: true, points: true, order: true } },
                submission: {
                  select: {
                    assignment: { select: { id: true, title: true } },
                    user: { select: { name: true } },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        });

        return NextResponse.json({ appeals });
      }
      return NextResponse.json({ error: "submissionId or assignmentId required" }, { status: 400 });
    }

    // Fetch appeals for a specific submission
    if (submissionId) {
      const whereClause: Record<string, unknown> = {
        submissionAnswer: { submissionId },
      };

      if (userRole === "STUDENT") {
        whereClause.studentId = userId;
      }

      const appeals = await prisma.gradeAppeal.findMany({
        where: whereClause,
        include: {
          student: { select: { id: true, name: true } },
          submissionAnswer: {
            select: {
              id: true,
              questionId: true,
              score: true,
              feedback: true,
              question: { select: { questionText: true, points: true, order: true } },
            },
          },
          messages: {
            include: {
              user: { select: { id: true, name: true, role: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ appeals });
    }

    // Fetch appeals per assignment (for TA/ADMIN)
    if (assignmentId) {
      if (isStaffRole(userRole)) {
        const appeals = await prisma.gradeAppeal.findMany({
          where: {
            submissionAnswer: {
              submission: { assignmentId },
            },
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
              include: {
                user: { select: { id: true, name: true, role: true } },
              },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({ appeals });
      }

      // For students, just return count
      const openCount = await prisma.gradeAppeal.count({
        where: {
          status: "OPEN",
          submissionAnswer: {
            submission: { assignmentId },
          },
        },
      });

      return NextResponse.json({ openCount });
    }

    return NextResponse.json({ appeals: [] });
  } catch (error) {
    console.error("Appeals GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Student creates a new appeal for a specific answer
export async function POST(req: Request) {
  try {
    const auth = await requireApiAuth();
    if (isErrorResponse(auth)) return auth;
    const userId = auth.user.id;

    const parseResult = appealPostSchema.safeParse(await req.json());
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { submissionAnswerId, reason, imageUrls } = parseResult.data;

    // Verify the answer belongs to this student's submission
    const answer = await prisma.submissionAnswer.findUnique({
      where: { id: submissionAnswerId },
      include: {
        submission: {
          select: { userId: true, assignment: { select: { isDeleted: true } } },
        },
      },
    });

    if (!answer || answer.submission.assignment.isDeleted) {
      return NextResponse.json({ error: "Answer not found" }, { status: 404 });
    }

    if (answer.submission.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (answer.score === null) {
      return NextResponse.json({ error: "This question has not been graded yet" }, { status: 400 });
    }

    // Check if appeal already exists
    const existing = await prisma.gradeAppeal.findUnique({
      where: {
        submissionAnswerId_studentId: {
          submissionAnswerId,
          studentId: userId,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "Appeal already exists for this question" }, { status: 409 });
    }

    const appeal = await prisma.gradeAppeal.create({
      data: {
        submissionAnswerId,
        studentId: userId,
        reason,
        imageUrls: imageUrls || undefined,
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
          },
        },
        messages: true,
      },
    });

    return NextResponse.json({ appeal });
  } catch (error) {
    console.error("Appeals POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH: TA/ADMIN updates appeal status (resolve/reject) or adds a message
export async function PATCH(req: Request) {
  try {
    const auth = await requireApiAuth();
    if (isErrorResponse(auth)) return auth;
    const userId = auth.user.id;
    const userRole = auth.user.role;

    const parseResult = appealPatchSchema.safeParse(await req.json());
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { appealId, status, message, newScore, imageUrls: msgImageUrls } = parseResult.data;

    const appeal = await prisma.gradeAppeal.findUnique({
      where: { id: appealId },
      include: {
        submissionAnswer: {
          include: {
            submission: true,
            question: { select: { points: true } },
          },
        },
      },
    });

    if (!appeal) {
      return NextResponse.json({ error: "Appeal not found" }, { status: 404 });
    }

    // Students can add messages to their own appeals; TA/ADMIN can do anything
    const isOwner = appeal.studentId === userId;
    const isStaff = isStaffRole(userRole);

    if (!isOwner && !isStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Add a message if provided
    if (message) {
      await prisma.appealMessage.create({
        data: {
          appealId,
          userId,
          content: message,
          imageUrls: msgImageUrls || undefined,
        },
      });

      // Check for appeal spam (30 messages/min auto-ban, non-blocking)
      if (!isStaff) {
        checkAndBanSpammer({ userId, source: "appeal" }).catch((err) => console.error("[spam] Failed to check spammer:", err));
      }
    }

    // Only staff can change status or score
    if (isStaff && status) {
      await prisma.gradeAppeal.update({
        where: { id: appealId },
        data: { status },
      });

      // If resolving with a new score, validate bounds and update the submission answer
      if (status === "RESOLVED" && newScore !== undefined) {
        const maxPoints = appeal.submissionAnswer.question.points;
        if (newScore > maxPoints) {
          return NextResponse.json(
            { error: `New score ${newScore} exceeds maximum points (${maxPoints}) for this question` },
            { status: 400 }
          );
        }
        await prisma.submissionAnswer.update({
          where: { id: appeal.submissionAnswerId },
          data: { score: newScore },
        });

        // Recalculate total score
        const allAnswers = await prisma.submissionAnswer.findMany({
          where: { submissionId: appeal.submissionAnswer.submissionId },
        });
        const totalScore = allAnswers.reduce(
          (sum, ans) =>
            sum + (ans.id === appeal.submissionAnswerId ? newScore : ans.score || 0),
          0
        );
        await prisma.submission.update({
          where: { id: appeal.submissionAnswer.submissionId },
          data: { totalScore },
        });
      }
    }

    // Return updated appeal
    const updated = await prisma.gradeAppeal.findUnique({
      where: { id: appealId },
      include: {
        student: { select: { id: true, name: true } },
        submissionAnswer: {
          select: {
            id: true,
            questionId: true,
            score: true,
            feedback: true,
            question: { select: { questionText: true, points: true, order: true } },
          },
        },
        messages: {
          include: {
            user: { select: { id: true, name: true, role: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return NextResponse.json({ appeal: updated });
  } catch (error) {
    console.error("Appeals PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
