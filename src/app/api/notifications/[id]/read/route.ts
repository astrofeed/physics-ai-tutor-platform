import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import { isInAudience } from "@/lib/services/notification-service";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiAuth();
    if (isErrorResponse(auth)) return auth;
    const userId = auth.user.id;
    const { id: notificationId } = await params;

    if (!(await isInAudience(notificationId, auth.user.role))) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    await prisma.notificationRead.upsert({
      where: {
        notificationId_userId: { notificationId, userId },
      },
      create: { notificationId, userId },
      update: {},
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notification read error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiAuth();
    if (isErrorResponse(auth)) return auth;
    const userId = auth.user.id;
    const { id: notificationId } = await params;

    await prisma.notificationRead.deleteMany({
      where: { notificationId, userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notification unread error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
