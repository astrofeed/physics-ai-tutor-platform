import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkAndBanSpammer } from "@/lib/spam-guard";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import { ACTIVITY_CATEGORIES, MAX_ACTIVITY_DURATION_MS } from "@/lib/activity";

const DurationUpdateSchema = z.object({
  id: z.string().min(1),
  durationMs: z.number().finite().min(0),
});

const CreateActivitySchema = z.object({
  category: z.enum(ACTIVITY_CATEGORIES),
  detail: z.string().max(200).nullish(),
});

// Deterministic cleanup: delete records older than 1 year, at most once per hour
let lastCleanup = 0;
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

function maybeCleanupOldRecords() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  // Fire and forget — don't block the request
  prisma.userActivity.deleteMany({
    where: { createdAt: { lt: oneYearAgo } },
  }).catch(err => console.error("[cleanup] Failed to prune old activity records:", err));
}

export async function POST(req: Request) {
  try {
    const auth = await requireApiAuth();
    if (isErrorResponse(auth)) return auth;
    const userId = auth.user.id;

    // Check if user is banned
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { isBanned: true },
    });
    if (currentUser?.isBanned) {
      return NextResponse.json({ error: "Account suspended" }, { status: 403 });
    }

    const body: unknown = await req.json();

    // Duration update (used by sendBeacon, which can only POST)
    if (typeof body === "object" && body !== null && "id" in body) {
      const parsed = DurationUpdateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid duration update" }, { status: 400 });
      }
      await prisma.userActivity.updateMany({
        where: { id: parsed.data.id, userId },
        data: { durationMs: Math.min(parsed.data.durationMs, MAX_ACTIVITY_DURATION_MS) },
      });
      return NextResponse.json({ ok: true });
    }

    const created = CreateActivitySchema.safeParse(body);
    if (!created.success) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    const { category, detail } = created.data;

    // Rate limit: skip if same user+category was created in last 3 seconds
    const recentDuplicate = await prisma.userActivity.findFirst({
      where: {
        userId,
        category,
        createdAt: { gte: new Date(Date.now() - 3000) },
      },
      select: { id: true },
    });
    if (recentDuplicate) {
      return NextResponse.json({ ok: true, id: recentDuplicate.id });
    }

    const activity = await prisma.userActivity.create({
      data: {
        userId,
        category,
        detail: detail || null,
      },
    });

    // Trigger cleanup in background (non-blocking)
    maybeCleanupOldRecords();

    // Check for spam and auto-ban if threshold exceeded (non-blocking)
    checkAndBanSpammer({ userId, source: "activity" });

    return NextResponse.json({ ok: true, id: activity.id });
  } catch (error) {
    console.error("Activity tracking error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireApiAuth();
    if (isErrorResponse(auth)) return auth;
    const userId = auth.user.id;
    const parsed = DurationUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
    }

    await prisma.userActivity.updateMany({
      where: { id: parsed.data.id, userId },
      data: { durationMs: Math.min(parsed.data.durationMs, MAX_ACTIVITY_DURATION_MS) },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Activity duration update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
