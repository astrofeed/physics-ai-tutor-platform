import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireApiAuth, requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { logger } from "@/lib/logger";
import { z } from "zod";

const QuestionSchema = z.object({
  questionText: z.string().min(1).max(10000),
  questionType: z.enum(["MC", "NUMERIC", "FREE_RESPONSE"]),
  options: z.array(z.string().max(2000)).nullable().optional().default([]),
  correctAnswer: z.string().max(2000).nullable().optional().default(""),
  points: z.number().positive("Question points must be greater than 0").max(1000).optional().default(10),
  diagram: z.object({ type: z.string(), content: z.string() }).nullable().optional(),
  imageUrl: z.string().max(2000).nullable().optional(),
});

const CreateAssignmentSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(5000).optional().default(""),
  dueDate: z.string().nullable().optional(),
  type: z.enum(["QUIZ", "FILE_UPLOAD"]).default("QUIZ"),
  totalPoints: z.number().min(0).max(10000).optional().default(100),
  questions: z.array(QuestionSchema).optional().default([]),
  pdfUrl: z.string().max(2000).nullable().optional(),
  lockAfterSubmit: z.boolean().optional().default(false),
  scheduledPublishAt: z.string().nullable().optional(),
  notifyOnPublish: z.boolean().optional().default(false),
});

export async function GET(req: Request) {
  try {
    const auth = await requireApiAuth();
    if (isErrorResponse(auth)) return auth;
    const userRole = auth.user.role;
    const userId = auth.user.id;

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "15")));
    const filterType = searchParams.get("filter"); // "published" | "drafts" | "scheduled" | null

    const hasSubmissions = searchParams.get("hasSubmissions") === "true";

    const whereClause: Prisma.AssignmentWhereInput = userRole === "STUDENT"
      ? { published: true, isDeleted: false }
      : filterType === "published"
        ? { published: true, isDeleted: false }
        : filterType === "drafts"
          ? { published: false, scheduledPublishAt: null, isDeleted: false }
          : filterType === "scheduled"
            ? { published: false, scheduledPublishAt: { not: null }, isDeleted: false }
            : { isDeleted: false };

    if (hasSubmissions) {
      whereClause.submissions = { some: { isDraft: false } };
    }

    const search = searchParams.get("search")?.trim();
    if (search) {
      whereClause.title = { contains: search, mode: "insensitive" };
    }

    const totalCount = await prisma.assignment.count({ where: whereClause });

    const assignments = await prisma.assignment.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        createdBy: { select: { name: true } },
        publishedBy: { select: { name: true } },
        _count: {
          select: {
            submissions: { where: { isDraft: false } },
            questions: true,
          },
        },
        submissions: userRole === "STUDENT"
          ? {
              where: { userId },
              select: { userId: true, totalScore: true, submittedAt: true, gradedAt: true, isDraft: true, fileUrl: true, _count: { select: { answers: true } } },
              take: 2, // get both draft and final if they exist
            }
          : {
              where: { isDraft: false },
              select: { userId: true, totalScore: true, submittedAt: true, gradedAt: true, isDraft: true, fileUrl: true, _count: { select: { answers: true } } },
            },
      },
    });

    // Fetch open appeal counts per assignment in a single query
    const assignmentIds = assignments.map((a) => a.id);
    const appealCountByAssignment: Record<string, number> = {};
    if (assignmentIds.length > 0) {
      const appealCounts = await prisma.$queryRaw<Array<{ assignmentId: string; count: bigint }>>`
        SELECT s."assignmentId", COUNT(ga.id) as count
        FROM "GradeAppeal" ga
        JOIN "SubmissionAnswer" sa ON sa.id = ga."submissionAnswerId"
        JOIN "Submission" s ON s.id = sa."submissionId"
        WHERE ga.status = 'OPEN' AND s."assignmentId" = ANY(${assignmentIds})
        GROUP BY s."assignmentId"
      `;
      for (const row of appealCounts) {
        appealCountByAssignment[row.assignmentId] = Number(row.count);
      }
    }

    const formatted = assignments.map((a) => {
      let mySubmission = null;
      let myProgress: { answeredCount: number; totalQuestions: number; status: string } | undefined;

      if (userRole === "STUDENT") {
        const finalSub = a.submissions.find((s) => !s.isDraft);
        const draftSub = a.submissions.find((s) => s.isDraft);
        mySubmission = finalSub || null;

        if (finalSub) {
          myProgress = { answeredCount: a._count.questions, totalQuestions: a._count.questions, status: "submitted" };
        } else if (draftSub) {
          const answeredCount = draftSub._count?.answers || 0;
          myProgress = { answeredCount, totalQuestions: a._count.questions, status: "in-progress" };
        }

        // FILE_UPLOAD with file attached = done
        if (a.type === "FILE_UPLOAD" && (finalSub?.fileUrl || draftSub?.fileUrl)) {
          myProgress = { answeredCount: a._count.questions, totalQuestions: a._count.questions, status: finalSub ? "submitted" : "in-progress" };
        }
      } else {
        mySubmission = a.submissions.find((s) => s.userId === userId) || null;
      }

      const ungradedCount = userRole !== "STUDENT"
        ? a.submissions.filter((s) => s.gradedAt === null).length
        : undefined;
      const gradedCount = userRole !== "STUDENT"
        ? a.submissions.filter((s) => s.gradedAt !== null).length
        : undefined;
      return {
        ...a,
        submissions: undefined,
        // Only released grades (`gradedAt` set) are shown to the student.
        myScore: mySubmission?.gradedAt ? mySubmission.totalScore ?? null : null,
        mySubmitted: !!mySubmission,
        myGraded: mySubmission?.gradedAt !== null && mySubmission?.gradedAt !== undefined,
        myProgress,
        ungradedCount,
        gradedCount,
        openAppealCount: appealCountByAssignment[a.id] || 0,
      };
    });

    return NextResponse.json({ assignments: formatted, totalCount, page, pageSize });
  } catch (error) {
    logger.error("Assignments GET error", {
      route: "/api/assignments",
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Resource not found" }, { status: 404 });
      }
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiRole(["TA", "PROFESSOR", "ADMIN"]);
    if (isErrorResponse(auth)) return auth;
    const userId = auth.user.id;
    const body = await req.json();
    const parsed = CreateAssignmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { title, description, dueDate, type, totalPoints, questions, pdfUrl, lockAfterSubmit, scheduledPublishAt, notifyOnPublish } = parsed.data;

    // Validate scheduledPublishAt if provided
    if (scheduledPublishAt) {
      const scheduledDate = new Date(scheduledPublishAt);
      if (isNaN(scheduledDate.getTime())) {
        return NextResponse.json({ error: "Invalid scheduledPublishAt date" }, { status: 400 });
      }
      if (scheduledDate <= new Date()) {
        return NextResponse.json({ error: "Scheduled time must be in the future" }, { status: 400 });
      }
      if (dueDate && scheduledDate >= new Date(dueDate)) {
        return NextResponse.json(
          { error: "Scheduled publish time must be before the due date" },
          { status: 400 }
        );
      }
    }

    const assignment = await prisma.assignment.create({
      data: {
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : null,
        type,
        totalPoints,
        pdfUrl: pdfUrl || null,
        lockAfterSubmit,
        scheduledPublishAt: scheduledPublishAt ? new Date(scheduledPublishAt) : null,
        notifyOnPublish,
        createdById: userId,
        questions: {
          create: questions.map((q, i) => ({
            questionText: q.questionText,
            questionType: q.questionType,
            options: q.options?.length ? q.options : Prisma.JsonNull,
            correctAnswer: q.correctAnswer || null,
            points: q.points ?? 10,
            order: i,
            diagram: q.diagram ?? Prisma.JsonNull,
            imageUrl: q.imageUrl || null,
          })),
        },
      },
      include: { questions: true },
    });

    return NextResponse.json({ assignment });
  } catch (error) {
    logger.error("Assignment creation error", {
      route: "/api/assignments",
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Resource not found" }, { status: 404 });
      }
      if (error.code === "P2002") {
        return NextResponse.json({ error: "Duplicate record conflict" }, { status: 409 });
      }
      if (error.code === "P2003") {
        return NextResponse.json({ error: "Referenced record not found" }, { status: 400 });
      }
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
