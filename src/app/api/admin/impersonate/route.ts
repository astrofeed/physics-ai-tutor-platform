import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { IMPERSONATE_COOKIE } from "@/lib/impersonate";
import { getAccountStatus } from "@/lib/services/account-status";
import { BANNED_MESSAGE, DELETED_MESSAGE } from "@/lib/api-auth";

// Start impersonating a user
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // The real signed-in account, not the impersonated one: its state and role
    // come from the database so a revoked admin cannot keep impersonating.
    const actorId = (session.user as { id: string }).id;
    const actor = await getAccountStatus(actorId);
    if (!actor || actor.isDeleted) {
      return NextResponse.json({ error: DELETED_MESSAGE }, { status: 401 });
    }
    if (actor.isBanned) {
      return NextResponse.json({ error: BANNED_MESSAGE }, { status: 403 });
    }

    const userRole = actor.role;
    if (userRole !== "ADMIN" && userRole !== "PROFESSOR") {
      return NextResponse.json({ error: "Only admins can impersonate" }, { status: 403 });
    }

    const { userId } = await req.json();

    // Cannot impersonate yourself
    if (userId === actorId) {
      return NextResponse.json({ error: "Cannot impersonate yourself" }, { status: 400 });
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, isDeleted: true },
    });

    if (!targetUser || targetUser.isDeleted) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Professors cannot impersonate admins or other professors
    if (userRole === "PROFESSOR" && (targetUser.role === "ADMIN" || targetUser.role === "PROFESSOR")) {
      return NextResponse.json({ error: "Professors cannot impersonate admins or other professors" }, { status: 403 });
    }

    const cookieStore = await cookies();
    cookieStore.set(IMPERSONATE_COOKIE, userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 30 * 60, // 30 minutes (reduced from 1 hour)
    });

    // Audit log the impersonation
    await prisma.auditLog.create({
      data: {
        userId: actorId,
        action: "impersonate_start",
        details: {
          targetUserId: userId,
          targetUserName: targetUser.name,
          targetUserRole: targetUser.role,
        },
      },
    });

    return NextResponse.json({ success: true, user: targetUser });
  } catch (error) {
    console.error("Impersonate error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Stop impersonating
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cookieStore = await cookies();
    cookieStore.delete(IMPERSONATE_COOKIE);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Stop impersonate error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
