import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import { ACTIVITY_FILTER_CATEGORIES, resolveTimezone, toDateKey } from "@/lib/activity";
import type { DayActivity } from "@/types/activity";

export async function GET(req: Request) {
  try {
    const auth = await requireApiAuth();
    if (isErrorResponse(auth)) return auth;
    const userId = auth.user.id;
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Invalid date parameter (YYYY-MM-DD)" }, { status: 400 });
    }

    const filter = searchParams.get("filter");

    const tz = resolveTimezone(searchParams.get("tz"));

    const whereCategory: Record<string, unknown> = {};
    if (filter && filter !== "all") {
      if (filter === "other") {
        whereCategory.category = { notIn: Object.values(ACTIVITY_FILTER_CATEGORIES).flat() };
      } else if (ACTIVITY_FILTER_CATEGORIES[filter]) {
        whereCategory.category = { in: ACTIVITY_FILTER_CATEGORIES[filter] };
      }
    }

    // Query ±1 day buffer to account for timezone differences, then filter by local date
    const bufferStart = new Date(date + "T00:00:00.000Z");
    bufferStart.setUTCDate(bufferStart.getUTCDate() - 1);
    const bufferEnd = new Date(date + "T23:59:59.999Z");
    bufferEnd.setUTCDate(bufferEnd.getUTCDate() + 1);

    // 1. UserActivity records
    const activities = await prisma.userActivity.findMany({
      where: {
        userId,
        createdAt: { gte: bufferStart, lte: bufferEnd },
        ...whereCategory,
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        category: true,
        detail: true,
        durationMs: true,
        createdAt: true,
      },
    });

    const results: DayActivity[] = [];

    for (const a of activities) {
      if (toDateKey(a.createdAt, tz) !== date) continue;
      results.push({
        id: a.id,
        category: a.category,
        detail: a.detail,
        durationMs: a.durationMs,
        time: a.createdAt.toISOString(),
      });
    }

    // 2. Messages (chat interactions)
    if (!filter || filter === "all" || filter === "chat") {
      const messages = await prisma.message.findMany({
        where: {
          role: "user",
          conversation: { userId, isDeleted: false },
          createdAt: { gte: bufferStart, lte: bufferEnd },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          content: true,
          createdAt: true,
          conversation: { select: { title: true } },
        },
      });
      for (const m of messages) {
        if (toDateKey(m.createdAt, tz) !== date) continue;
        const preview = m.content.length > 60 ? m.content.slice(0, 60) + "…" : m.content;
        results.push({
          id: m.id,
          category: "AI_CHAT_MSG",
          detail: `${m.conversation.title}: ${preview}`,
          durationMs: null,
          time: m.createdAt.toISOString(),
        });
      }
    }

    // 3. Submissions
    if (!filter || filter === "all" || filter === "submission") {
      const submissions = await prisma.submission.findMany({
        where: {
          userId,
          submittedAt: { gte: bufferStart, lte: bufferEnd },
        },
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          submittedAt: true,
          totalScore: true,
          assignment: { select: { title: true } },
        },
      });
      for (const s of submissions) {
        if (toDateKey(s.submittedAt, tz) !== date) continue;
        results.push({
          id: s.id,
          category: "SUBMISSION",
          detail: `${s.assignment.title}${s.totalScore != null ? ` — Score: ${s.totalScore}` : ""}`,
          durationMs: null,
          time: s.submittedAt.toISOString(),
        });
      }
    }

    // Sort all results by time descending
    results.sort((a, b) => b.time.localeCompare(a.time));

    return NextResponse.json({ date, activities: results });
  } catch (error) {
    console.error("Activity detail error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
