import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAuth, isErrorResponse } from "@/lib/api-auth";
import { resolveTimezone, summarizeSessions, toDateKey } from "@/lib/activity";

export async function GET(req: Request) {
  try {
    const auth = await requireApiAuth();
    if (isErrorResponse(auth)) return auth;
    const { user } = auth;
    const userId = user.id;
    const tz = resolveTimezone(new URL(req.url).searchParams.get("tz"));

    // Extra day of slack so the oldest local day is fully covered
    const weekAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);

    const [submissions, messages, conversations, totalMessages, activities] = await Promise.all([
      prisma.submission.findMany({
        where: { userId },
        include: {
          assignment: { select: { title: true, totalPoints: true, type: true } },
          answers: {
            include: {
              question: { select: { questionType: true, points: true } },
            },
          },
        },
        orderBy: { submittedAt: "desc" },
        take: 100,
      }),
      prisma.message.findMany({
        where: {
          conversation: { userId },
          createdAt: { gte: weekAgo },
        },
        select: { createdAt: true, role: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.conversation.count({ where: { userId } }),
      prisma.message.count({ where: { conversation: { userId } } }),
      prisma.userActivity.findMany({
        where: { userId },
        select: { createdAt: true, durationMs: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // Messages per day over the last 7 days, bucketed in the viewer's timezone
    const now = new Date();
    const dailyActivity: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      dailyActivity[toDateKey(new Date(now.getTime() - i * 24 * 60 * 60 * 1000), tz)] = 0;
    }
    for (const msg of messages) {
      const key = toDateKey(msg.createdAt, tz);
      if (dailyActivity[key] !== undefined) {
        dailyActivity[key]++;
      }
    }

    // Calculate submission scores over time
    const scoreHistory = submissions
      .filter((s) => s.totalScore !== null)
      .map((s) => ({
        title: s.assignment.title,
        score: s.totalScore!,
        totalPoints: s.assignment.totalPoints,
        percent: Math.round((s.totalScore! / s.assignment.totalPoints) * 100),
        date: s.submittedAt.toISOString(),
      }))
      .reverse();

    // Overall stats
    const gradedSubmissions = submissions.filter((s) => s.totalScore !== null);
    const totalEarned = gradedSubmissions.reduce((sum, s) => sum + (s.totalScore || 0), 0);
    const totalPossible = gradedSubmissions.reduce((sum, s) => sum + s.assignment.totalPoints, 0);
    const averagePercent = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;

    // Measured foreground time on tracked pages — not an estimate from message counts
    const trackedStudyMinutes = Math.round(
      activities.reduce((sum, a) => sum + Math.max(a.durationMs ?? 0, 0), 0) / 60000
    );

    // Visits grouped into sessions by inactivity gap
    const sessions = summarizeSessions(activities);
    const avgSessionMinutes =
      sessions.count > 0 ? Math.round(sessions.totalMs / sessions.count / 60000) : 0;

    return NextResponse.json({
      overview: {
        averagePercent,
        totalMessages,
        totalConversations: conversations,
        totalSubmissions: submissions.length,
        trackedStudyMinutes,
        sessionCount: sessions.count,
        avgSessionMinutes,
      },
      weeklyActivity: Object.entries(dailyActivity).map(([date, count]) => ({
        date,
        day: new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
          weekday: "short",
          timeZone: "UTC",
        }),
        messages: count,
      })),
      scoreHistory,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
