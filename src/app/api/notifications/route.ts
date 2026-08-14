import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth, requireApiRole, isErrorResponse } from "@/lib/api-auth";
import { parsePaginationParams } from "@/lib/pagination";
import {
  createAnnouncement,
  listNotificationsForUser,
  markAllReadForUser,
} from "@/lib/services/notification-service";

const AnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(500),
  message: z.string().trim().min(1).max(50_000),
  /** Empty (or omitted) means every role sees the announcement. */
  audienceRoles: z.array(z.enum(["STUDENT", "TA", "PROFESSOR", "ADMIN"])).default([]),
});

export async function GET(req: Request) {
  try {
    const auth = await requireApiAuth();
    if (isErrorResponse(auth)) return auth;

    const { searchParams } = new URL(req.url);
    const params = parsePaginationParams(searchParams, { pageSize: 20 });

    return NextResponse.json(await listNotificationsForUser(auth.user, params));
  } catch (error) {
    console.error("Notifications GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH() {
  try {
    const auth = await requireApiAuth();
    if (isErrorResponse(auth)) return auth;

    await markAllReadForUser(auth.user);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notifications PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiRole(["TA", "PROFESSOR", "ADMIN"]);
    if (isErrorResponse(auth)) return auth;

    const parsed = AnnouncementSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Title and message are required (title ≤ 500, message ≤ 50,000 characters)" },
        { status: 400 }
      );
    }

    const notification = await createAnnouncement({
      ...parsed.data,
      createdById: auth.user.id,
    });

    return NextResponse.json({ notification }, { status: 201 });
  } catch (error) {
    console.error("Notifications POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
