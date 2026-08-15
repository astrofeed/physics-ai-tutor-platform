import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAuth, requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { isStaff as isStaffRole } from "@/lib/constants";
import { AssignmentError, syncQuestions } from "@/lib/services/assignment-service";
import { humanGradingStarted } from "@/lib/services/submission-service";
import { logger } from "@/lib/logger";
import { z } from "zod";

const PatchQuestionSchema = z.object({
  id: z.string().min(1).optional(),
  questionText: z.string().min(1).max(10000),
  questionType: z.enum(["MC", "NUMERIC", "FREE_RESPONSE"]),
  options: z.array(z.string().max(2000)).optional(),
  correctAnswer: z.string().max(2000).optional(),
  alsoAcceptedAnswers: z.array(z.string().max(2000)).max(8).optional(),
  points: z.number().positive().max(1000).optional(),
  diagram: z.object({ type: z.string(), content: z.string() }).nullable().optional(),
  imageUrl: z.string().max(2000).nullable().optional(),
  tolerance: z.number().min(0).max(1_000_000).nullable().optional(),
  toleranceUnit: z.enum(["ABSOLUTE", "PERCENT"]).optional(),
});

const PatchAssignmentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  dueDate: z.string().nullable().optional(),
  published: z.boolean().optional(),
  totalPoints: z.number().min(0).max(10000).optional(),
  pdfUrl: z.string().max(2000).nullable().optional(),
  lockAfterSubmit: z.boolean().optional(),
  scheduledPublishAt: z.string().nullable().optional(),
  notifyOnPublish: z.boolean().optional(),
  questions: z.array(PatchQuestionSchema).optional(),
  /** Acknowledges that removed questions will delete existing student answers. */
  confirmDestructive: z.boolean().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireApiAuth();
    if (isErrorResponse(auth)) return auth;
    const userId = auth.user.id;
    const userRole = auth.user.role;
    const isStaff = isStaffRole(userRole);

    // Step 1: assignment + user's submission in parallel (fast indexed lookups)
    const [assignment, submission] = await Promise.all([
      prisma.assignment.findFirst({
        where: { id: params.id, isDeleted: false },
        include: {
          questions: { orderBy: { order: "asc" } },
          createdBy: { select: { name: true } },
          publishedBy: { select: { name: true } },
          ...(isStaff && { _count: { select: { submissions: { where: { isDraft: false } } } } }),
        },
      }),
      prisma.submission.findFirst({
        where: { assignmentId: params.id, userId },
        include: { answers: true },
      }),
    ]);

    if (!assignment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Mirrors the submit-time visibility rule, so a student never gets an
    // editable page for an assignment whose answers the API would reject.
    const scheduledInFuture =
      assignment.scheduledPublishAt !== null &&
      assignment.scheduledPublishAt > new Date();
    if (userRole === "STUDENT" && (!assignment.published || scheduledInFuture)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Step 2: fetch appeals using direct indexed lookups (avoids slow nested relation filter)
    const appealsInclude = {
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
        orderBy: { createdAt: "asc" as const },
      },
    } as const;

    let appeals: Awaited<ReturnType<typeof prisma.gradeAppeal.findMany>> = [];

    if (!isStaff) {
      // Student: use answer IDs from their submission (no extra query needed)
      if (submission) {
        const answerIds = submission.answers.map((a) => a.id);
        if (answerIds.length > 0) {
          appeals = await prisma.gradeAppeal.findMany({
            where: { submissionAnswerId: { in: answerIds }, studentId: userId },
            include: appealsInclude,
            orderBy: { createdAt: "desc" },
          });
        }
      }
    } else {
      // Staff: direct indexed lookups instead of nested relation filter
      // Step 2a: submission IDs (uses @@index([assignmentId]) on Submission)
      const submissionRows = await prisma.submission.findMany({
        where: { assignmentId: params.id },
        select: { id: true },
      });
      if (submissionRows.length > 0) {
        // Step 2b: answer IDs (uses @@index([submissionId]) on SubmissionAnswer)
        const answerRows = await prisma.submissionAnswer.findMany({
          where: { submissionId: { in: submissionRows.map((s) => s.id) } },
          select: { id: true },
        });
        if (answerRows.length > 0) {
          appeals = await prisma.gradeAppeal.findMany({
            where: { submissionAnswerId: { in: answerRows.map((a) => a.id) } },
            include: appealsInclude,
            orderBy: { createdAt: "desc" },
          });
        }
      }
    }

    const questions = assignment.questions.map((q) => ({
      ...q,
      tolerance: q.tolerance === null ? null : Number(q.tolerance),
    }));

    if (isStaff) {
      return NextResponse.json({
        assignment: { ...assignment, questions },
        submission: submission || null,
        appeals,
      });
    }

    // Students only see grading data once their submission has been finalized,
    // and never see the answer key for questions that are still gradable.
    const released = submission?.gradedAt != null;

    const assignmentData = {
      ...assignment,
      _count: { submissions: 0 },
      questions: questions.map((q) => ({
        ...q,
        correctAnswer: released ? q.correctAnswer : null,
        alsoAcceptedAnswers: released ? q.alsoAcceptedAnswers : [],
      })),
    };

    // A hand-saved score is hidden until release, so the student's Edit &
    // Resubmit button needs this flag to know the submission is locked —
    // otherwise it stays enabled and every click 403s.
    const submissionData = submission
      ? {
          ...submission,
          beingGraded: humanGradingStarted(submission),
          totalScore: released ? submission.totalScore : null,
          overallFeedback: released ? submission.overallFeedback : null,
          feedbackFileUrl: released ? submission.feedbackFileUrl : null,
          answers: submission.answers.map((a) => ({
            ...a,
            score: released ? a.score : null,
            feedback: released ? a.feedback : null,
            feedbackImageUrls: released ? a.feedbackImageUrls : null,
          })),
        }
      : null;

    return NextResponse.json({
      assignment: assignmentData,
      submission: submissionData,
      appeals,
    });
  } catch (error) {
    console.error("Assignment error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireApiRole(["TA", "PROFESSOR", "ADMIN"]);
    if (isErrorResponse(auth)) return auth;
    const userRole = auth.user.role;
    const userId = auth.user.id;

    const body = await req.json();
    const parsed = PatchAssignmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // Validate scheduledPublishAt if provided
    if (data.scheduledPublishAt !== undefined && data.scheduledPublishAt !== null) {
      const scheduledDate = new Date(data.scheduledPublishAt);
      if (isNaN(scheduledDate.getTime())) {
        return NextResponse.json({ error: "Invalid scheduledPublishAt date" }, { status: 400 });
      }
      if (scheduledDate <= new Date()) {
        return NextResponse.json({ error: "Scheduled time must be in the future" }, { status: 400 });
      }
      const dueDate = data.dueDate
        ? new Date(data.dueDate)
        : (await prisma.assignment.findUnique({
            where: { id: params.id },
            select: { dueDate: true },
          }))?.dueDate ?? null;
      if (dueDate && scheduledDate >= dueDate) {
        return NextResponse.json(
          { error: "Scheduled publish time must be before the due date" },
          { status: 400 }
        );
      }
    }

    if (data.questions) {
      await syncQuestions(params.id, data.questions, {
        confirmDestructive: data.confirmDestructive,
      });
    }

    // If publishing immediately, ignore any schedule
    const isPublishingNow = data.published === true;

    // Cancel linked PENDING scheduled emails when schedule is cleared
    const isClearingSchedule =
      isPublishingNow ||
      data.published === false ||
      (!isPublishingNow && data.scheduledPublishAt === null);

    if (isClearingSchedule) {
      await prisma.scheduledEmail.updateMany({
        where: { assignmentId: params.id, status: "PENDING" },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
    }

    const assignment = await prisma.assignment.update({
      where: { id: params.id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
        ...(data.published !== undefined && { published: data.published }),
        ...(data.published === true && { publishedById: userId }),
        // Clear schedule when publishing immediately or unpublishing
        ...(isPublishingNow && { scheduledPublishAt: null }),
        ...(data.published === false && { scheduledPublishAt: null }),
        // Set schedule only when not publishing immediately
        ...(!isPublishingNow && data.scheduledPublishAt !== undefined && {
          scheduledPublishAt: data.scheduledPublishAt ? new Date(data.scheduledPublishAt) : null,
        }),
        ...(data.notifyOnPublish !== undefined && { notifyOnPublish: data.notifyOnPublish }),
        // When questions were synced, their sum is authoritative (written by syncQuestions).
        ...(data.totalPoints !== undefined && !data.questions && { totalPoints: data.totalPoints }),
        ...(data.pdfUrl !== undefined && { pdfUrl: data.pdfUrl || null }),
        ...(data.lockAfterSubmit !== undefined && { lockAfterSubmit: data.lockAfterSubmit }),
      },
      include: {
        questions: { orderBy: { order: "asc" } },
      },
    });

    return NextResponse.json({ assignment });
  } catch (error) {
    if (error instanceof AssignmentError) {
      return NextResponse.json(
        { error: error.message, ...error.extra },
        { status: error.status }
      );
    }
    logger.error("Update assignment error", {
      route: "/api/assignments/[id]",
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireApiRole(["TA", "PROFESSOR", "ADMIN"]);
    if (isErrorResponse(auth)) return auth;
    const userRole = auth.user.role;
    const deleteUserId = auth.user.id;

    // TAs can only delete their own assignments
    if (userRole === "TA") {
      const existing = await prisma.assignment.findUnique({
        where: { id: params.id, isDeleted: false },
        select: { createdById: true },
      });
      if (!existing || existing.createdById !== deleteUserId) {
        return NextResponse.json({ error: "Forbidden: you can only delete your own assignments" }, { status: 403 });
      }
    }

    // Cancel any pending scheduled emails linked to this assignment
    await prisma.scheduledEmail.updateMany({
      where: { assignmentId: params.id, status: "PENDING" },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });

    await prisma.assignment.update({
      where: { id: params.id },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: deleteUserId,
        action: "assignment_deleted",
        details: { assignmentId: params.id },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete assignment error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
