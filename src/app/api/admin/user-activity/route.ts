import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireApiRole, isErrorResponse } from "@/lib/api-auth";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_FILTER_CATEGORIES,
  SESSION_GAP_MS,
} from "@/lib/activity";
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  CATEGORY_COLOR_FALLBACK,
} from "@/lib/constants";

const ALL_CATEGORIES: string[] = [...ACTIVITY_CATEGORIES];

/**
 * Build SQL WHERE conditions based on filter parameters.
 * Returns an array of Prisma.Sql fragments to be joined with AND.
 */
function buildWhereConditions(
  startDate: Date,
  role: string | undefined,
  filter: string,
): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`ua."createdAt" >= ${startDate}`,
  ];

  if (role) {
    conditions.push(Prisma.sql`u."role" = ${role}`);
  }

  if (filter !== "all") {
    if (filter === "other") {
      const excludeCats = Object.values(ACTIVITY_FILTER_CATEGORIES).flat();
      conditions.push(
        Prisma.sql`ua."category" NOT IN (${Prisma.join(excludeCats)})`,
      );
    } else if (ACTIVITY_FILTER_CATEGORIES[filter]) {
      conditions.push(
        Prisma.sql`ua."category" IN (${Prisma.join(ACTIVITY_FILTER_CATEGORIES[filter])})`,
      );
    }
  }

  return conditions;
}

export async function GET(req: Request) {
  try {
    const auth = await requireApiRole(["ADMIN", "PROFESSOR"]);
    if (isErrorResponse(auth)) return auth;

    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role") || undefined;
    const filter = searchParams.get("filter") || "all";
    const range = searchParams.get("range") || "30";
    const exportCsv = searchParams.get("export") === "csv";

    // Build where clause for Prisma queries
    const where: Record<string, unknown> = {};
    if (role) where.user = { role };

    // Date range
    if (range !== "all") {
      const days = parseInt(range, 10);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);
      where.createdAt = { gte: startDate };
    }

    // Category filter
    if (filter !== "all") {
      if (filter === "other") {
        const excludeCats = Object.values(ACTIVITY_FILTER_CATEGORIES).flat();
        where.category = { notIn: excludeCats };
      } else if (ACTIVITY_FILTER_CATEGORIES[filter]) {
        where.category = { in: ACTIVITY_FILTER_CATEGORIES[filter] };
      }
    }

    // CSV export — separate path, only fetched on demand
    if (exportCsv) {
      const activities = await prisma.userActivity.findMany({
        where,
        select: {
          id: true,
          category: true,
          detail: true,
          durationMs: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5000,
      });
      const csvData = activities.map((a) => ({
        id: a.id,
        userName: a.user.name || "Unknown",
        userEmail: a.user.email || "",
        category: a.category,
        detail: a.detail,
        durationMs: a.durationMs,
        createdAt: a.createdAt.toISOString(),
      }));
      return NextResponse.json({ csvData });
    }

    const days = range === "all" ? 365 : parseInt(range, 10);

    // Build start date for raw queries
    const rawStartDate = new Date();
    rawStartDate.setDate(rawStartDate.getDate() - days);
    rawStartDate.setHours(0, 0, 0, 0);

    // Build dynamic WHERE clause for raw queries
    const conditions = buildWhereConditions(rawStartDate, role, filter);
    const whereClause = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
    const joinClause = role
      ? Prisma.sql`FROM "UserActivity" ua JOIN "User" u ON ua."userId" = u."id"`
      : Prisma.sql`FROM "UserActivity" ua`;

    // Run queries in parallel
    const [dailyTrendRaw, roleBreakdownRaw, categoryGroups, totalCount, totalDuration, uniqueUsers, recentActivities, topUsersRaw, sessionRows] = await Promise.all([
      // Daily trend aggregated in the database (category + day + count)
      prisma.$queryRaw<Array<{ date: Date; category: string; count: number }>>`
        SELECT DATE_TRUNC('day', ua."createdAt") as date, ua."category", COUNT(*)::int as count
        ${joinClause}
        ${whereClause}
        GROUP BY DATE_TRUNC('day', ua."createdAt"), ua."category"
        ORDER BY date
      `,
      // Role breakdown aggregated in the database
      prisma.$queryRaw<Array<{ role: string; count: number; total_ms: number }>>`
        SELECT u."role", COUNT(*)::int as count, COALESCE(SUM(ua."durationMs"), 0)::int as total_ms
        FROM "UserActivity" ua JOIN "User" u ON ua."userId" = u."id"
        ${whereClause}
        GROUP BY u."role"
      `,
      // Group by category for time breakdown
      prisma.userActivity.groupBy({
        by: ["category"],
        where,
        _count: { id: true },
        _sum: { durationMs: true },
      }),
      // Efficient count via DB
      prisma.userActivity.count({ where }),
      // Efficient sum via DB
      prisma.userActivity.aggregate({ where, _sum: { durationMs: true } }),
      // Efficient distinct user count via DB
      prisma.userActivity.groupBy({ by: ["userId"], where }).then((g) => g.length),
      // Recent activities (last 20) with user info for activity feed
      prisma.userActivity.findMany({
        where,
        select: {
          id: true,
          category: true,
          detail: true,
          durationMs: true,
          createdAt: true,
          user: { select: { name: true, email: true, role: true, image: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      // Top users by activity count
      prisma.userActivity.groupBy({
        by: ["userId"],
        where,
        _count: { id: true },
        _sum: { durationMs: true },
      }),
      // Sessions per user: a visit starts a new session when it begins more than
      // SESSION_GAP_MS after the previous visit of the same user ended.
      prisma.$queryRaw<Array<{ sessions: number; total_ms: number }>>`
        WITH gaps AS (
          SELECT
            ua."userId",
            ua."createdAt" AS started_at,
            ua."createdAt" + (COALESCE(ua."durationMs", 0) * INTERVAL '1 millisecond') AS ended_at,
            MAX(ua."createdAt" + (COALESCE(ua."durationMs", 0) * INTERVAL '1 millisecond'))
              OVER (PARTITION BY ua."userId" ORDER BY ua."createdAt"
                    ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prev_end
          ${joinClause}
          ${whereClause}
        ), marked AS (
          SELECT *,
            CASE WHEN prev_end IS NULL
                   OR started_at - prev_end > (${SESSION_GAP_MS} * INTERVAL '1 millisecond')
                 THEN 1 ELSE 0 END AS is_start
          FROM gaps
        ), numbered AS (
          SELECT *, SUM(is_start) OVER (PARTITION BY "userId" ORDER BY started_at) AS session_no
          FROM marked
        ), sessions AS (
          SELECT "userId", session_no,
            EXTRACT(EPOCH FROM (MAX(ended_at) - MIN(started_at))) * 1000 AS session_ms
          FROM numbered
          GROUP BY "userId", session_no
        )
        SELECT COUNT(*)::int AS sessions, COALESCE(SUM(session_ms), 0)::bigint AS total_ms
        FROM sessions
      `,
    ]);

    const sessionCount = Number(sessionRows[0]?.sessions ?? 0);
    const sessionTotalMs = Number(sessionRows[0]?.total_ms ?? 0);

    // Summary from DB aggregations
    const summary = {
      totalActivities: totalCount,
      uniqueUsers,
      totalTimeMs: totalDuration._sum.durationMs || 0,
      avgDailyActivities: days > 0 ? Math.round(totalCount / days) : totalCount,
      sessionCount,
      avgSessionMs: sessionCount > 0 ? Math.round(sessionTotalMs / sessionCount) : 0,
    };

    // Daily trend — build date->category->count map from aggregated results
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const trendMap: Record<string, Record<string, number>> = {};

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split("T")[0];
      trendMap[key] = {};
      for (const cat of ALL_CATEGORIES) trendMap[key][cat] = 0;
    }

    // Populate from aggregated DB results instead of iterating over individual records
    for (const row of dailyTrendRaw) {
      const key = new Date(row.date).toISOString().split("T")[0];
      if (trendMap[key] && trendMap[key][row.category] !== undefined) {
        trendMap[key][row.category] = row.count;
      }
    }

    // Determine which categories to include in the trend based on filter
    let trendCategories = ALL_CATEGORIES;
    if (filter !== "all") {
      if (filter === "other") {
        const excludeCats: string[] = Object.values(ACTIVITY_FILTER_CATEGORIES).flat();
        trendCategories = ALL_CATEGORIES.filter((c) => !excludeCats.includes(c));
      } else if (ACTIVITY_FILTER_CATEGORIES[filter]) {
        trendCategories = ACTIVITY_FILTER_CATEGORIES[filter];
      }
    }

    const dailyTrend = Object.entries(trendMap).map(([date, cats]) => {
      const entry: Record<string, string | number> = {
        date,
        label: new Date(date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      };
      let total = 0;
      for (const cat of trendCategories) {
        entry[cat] = cats[cat] || 0;
        total += cats[cat] || 0;
      }
      entry.total = total;
      return entry;
    });

    // Time by category
    const timeByCategory = categoryGroups.map((g) => ({
      category: g.category,
      label: CATEGORY_LABELS[g.category] || g.category,
      totalMs: g._sum.durationMs || 0,
      count: g._count.id,
      color: CATEGORY_COLORS[g.category] || CATEGORY_COLOR_FALLBACK,
    })).sort((a, b) => b.totalMs - a.totalMs);

    // Time by role — from aggregated DB results
    const ROLE_LABELS: Record<string, string> = {
      STUDENT: "Student",
      TA: "TA",
      PROFESSOR: "Professor",
      ADMIN: "Admin",
    };
    const timeByRole = roleBreakdownRaw.map((row) => ({
      label: ROLE_LABELS[row.role] || row.role,
      count: row.count,
      totalMs: row.total_ms,
    })).sort((a, b) => b.totalMs - a.totalMs);

    // Recent activity feed
    const recentActivity = recentActivities.map((a) => ({
      id: a.id,
      category: a.category,
      categoryLabel: CATEGORY_LABELS[a.category] || a.category,
      categoryColor: CATEGORY_COLORS[a.category] || CATEGORY_COLOR_FALLBACK,
      detail: a.detail,
      durationMs: a.durationMs,
      createdAt: a.createdAt.toISOString(),
      user: {
        name: a.user.name || "Unknown",
        email: a.user.email || "",
        role: (a.user as { role?: string }).role || "STUDENT",
        image: (a.user as { image?: string | null }).image || null,
      },
    }));

    // Top users — resolve user info
    const topUsersSorted = topUsersRaw
      .sort((a, b) => b._count.id - a._count.id)
      .slice(0, 10);

    const topUserIds = topUsersSorted.map((u) => u.userId);
    const topUserInfos = topUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: topUserIds } },
          select: { id: true, name: true, email: true, role: true, image: true },
        })
      : [];
    const userInfoMap = new Map(topUserInfos.map((u) => [u.id, u]));

    const topUsers = topUsersSorted.map((u) => {
      const info = userInfoMap.get(u.userId);
      return {
        name: info?.name || "Unknown",
        email: info?.email || "",
        role: info?.role || "STUDENT",
        image: info?.image || null,
        activityCount: u._count.id,
        totalTimeMs: u._sum.durationMs || 0,
      };
    });

    return NextResponse.json({
      summary,
      dailyTrend,
      trendCategories,
      timeByCategory,
      timeByRole,
      recentActivity,
      topUsers,
    });
  } catch (error) {
    console.error("Admin user-activity error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
