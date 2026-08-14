import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";

const MAX_RECIPIENTS = 200;

const ScheduledEmailSchema = z.object({
  subject: z.string().trim().min(1).max(500),
  message: z.string().trim().min(1).max(50_000),
  scheduledAt: z.string().min(1),
  /** Empty is allowed only for in-app-only scheduling (`createNotification`). */
  recipientIds: z.array(z.string().min(1)).max(MAX_RECIPIENTS),
  createNotification: z.boolean().default(false),
  /** Roles the in-app notification is visible to. Empty means everyone. */
  audienceRoles: z.array(z.enum(["STUDENT", "TA", "PROFESSOR", "ADMIN"])).default([]),
  assignmentId: z.string().min(1).nullish(),
});

// GET /api/admin/scheduled-emails - List scheduled emails
export async function GET() {
  try {
    const auth = await requireApiRole(["TA", "PROFESSOR", "ADMIN"]);
    if (isErrorResponse(auth)) return auth;

    const scheduledEmails = await prisma.scheduledEmail.findMany({
      orderBy: { scheduledAt: "asc" },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ scheduledEmails });
  } catch (error) {
    console.error("Scheduled emails GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/scheduled-emails - Create a scheduled email
export async function POST(req: Request) {
  try {
    const auth = await requireApiRole(["TA", "PROFESSOR", "ADMIN"]);
    if (isErrorResponse(auth)) return auth;

    const parsed = ScheduledEmailSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: `subject (≤500 chars), message (≤50,000 chars), scheduledAt, and up to ${MAX_RECIPIENTS} recipientIds are required`,
        },
        { status: 400 }
      );
    }
    const {
      subject,
      message,
      scheduledAt,
      recipientIds,
      createNotification,
      audienceRoles,
      assignmentId,
    } = parsed.data;

    // recipientIds can be empty when createNotification is true (notification-only, no email)
    if (recipientIds.length === 0 && !createNotification) {
      return NextResponse.json(
        { error: "recipientIds must be non-empty, or createNotification must be true" },
        { status: 400 }
      );
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json({ error: "Invalid scheduledAt date" }, { status: 400 });
    }
    if (scheduledDate <= new Date()) {
      return NextResponse.json({ error: "scheduledAt must be in the future" }, { status: 400 });
    }

    const scheduledEmail = await prisma.scheduledEmail.create({
      data: {
        subject,
        message,
        scheduledAt: scheduledDate,
        recipientIds,
        createdById: auth.user.id,
        createNotification,
        audienceRoles,
        assignmentId: assignmentId || null,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: auth.user.id,
        action: "scheduled_email_created",
        details: {
          scheduledEmailId: scheduledEmail.id,
          subject,
          scheduledAt: scheduledDate.toISOString(),
          recipientCount: recipientIds.length,
          createNotification,
          audienceRoles,
          assignmentId: assignmentId || null,
        },
      },
    });

    return NextResponse.json({ scheduledEmail }, { status: 201 });
  } catch (error) {
    console.error("Scheduled emails POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
