import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { ROLE_HIERARCHY } from "@/lib/constants";
import type { RouteContext } from "@/types/route";

const ModerateUserSchema = z.object({
  action: z.enum(["ban", "unban", "restrict", "unrestrict"]),
});

export async function POST(
  req: Request,
  { params }: RouteContext
) {
  try {
    const auth = await requireApiRole(["TA", "PROFESSOR", "ADMIN"]);
    if (isErrorResponse(auth)) return auth;
    const userRole = auth.user.role;
    const adminId = auth.user.id;

    const parsed = ModerateUserSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    const { action } = parsed.data;
    const targetUserId = (await params).id;

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { role: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const targetRole = targetUser.role;
    if (ROLE_HIERARCHY[userRole] <= ROLE_HIERARCHY[targetRole]) {
      return NextResponse.json(
        { error: "Forbidden: you cannot moderate users with an equal or higher role" },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (action === "ban") {
      updateData.isBanned = true;
      updateData.bannedAt = new Date();
    } else if (action === "unban") {
      updateData.isBanned = false;
      updateData.bannedAt = null;
    } else if (action === "restrict") {
      updateData.isRestricted = true;
    } else if (action === "unrestrict") {
      updateData.isRestricted = false;
    }

    await prisma.user.update({
      where: { id: targetUserId },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        userId: targetUserId,
        action,
        details: { performedBy: adminId },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Moderate user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
