import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAuth, requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { AssignmentError } from "@/lib/services/assignment-service";
import { updateAssignment } from "@/lib/services/assignment-update-service";
import { getAssignmentDetail } from "@/lib/services/assignment-detail-service";
import type { RouteContext } from "@/types/route";
import { logger } from "@/lib/logger";
import { PatchAssignmentSchema } from "@/lib/validators/assignment";

export async function GET(
  req: Request,
  { params }: RouteContext
) {
  try {
    const auth = await requireApiAuth();
    if (isErrorResponse(auth)) return auth;
    const { id } = await params;
    return NextResponse.json(await getAssignmentDetail(id, auth.user));
  } catch (error) {
    if (error instanceof AssignmentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Assignment error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: RouteContext
) {
  try {
    const auth = await requireApiRole(["TA", "PROFESSOR", "ADMIN"]);
    if (isErrorResponse(auth)) return auth;

    const body = await req.json();
    const parsed = PatchAssignmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { id } = await params;
    const assignment = await updateAssignment(id, parsed.data, auth.user.id);

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
  { params: routeParams }: RouteContext
) {
  const params = await routeParams;
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
