"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Loader2, Download, Crown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatBand } from "@/components/ui/stat-band";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "next-themes";
import { CATEGORY_LABELS, ROLE_BADGE_COLORS } from "@/lib/constants";
import { formatDuration, timeAgo } from "@/lib/utils";
import { SESSION_GAP_MS } from "@/lib/activity";
import { ActivityChart } from "@/components/admin/ActivityChart";
import { UsageBreakdown } from "@/components/admin/UsageBreakdown";

interface RecentActivityItem {
  id: string;
  category: string;
  categoryLabel: string;
  categoryColor: string;
  detail: string | null;
  durationMs: number | null;
  createdAt: string;
  user: {
    name: string;
    email: string;
    role: string;
    image: string | null;
  };
}

interface TopUser {
  name: string;
  email: string;
  role: string;
  image: string | null;
  activityCount: number;
  totalTimeMs: number;
}

interface ActivityData {
  summary: {
    totalActivities: number;
    uniqueUsers: number;
    sessionCount: number;
    avgSessionMs: number;
    totalTimeMs: number;
    avgDailyActivities: number;
  };
  dailyTrend: Record<string, string | number>[];
  trendCategories: string[];
  timeByCategory: {
    category: string;
    label: string;
    totalMs: number;
    count: number;
    color: string;
  }[];
  timeByRole: { label: string; count: number; totalMs: number }[];
  recentActivity: RecentActivityItem[];
  topUsers: TopUser[];
}

function UserAvatar({
  name,
  image,
  size = "sm",
}: {
  name: string;
  image: string | null;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";
  if (image) {
    return (
      <img
        src={image}
        alt={name}
        className={`${dim} rounded-full object-cover`}
      />
    );
  }
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className={`${dim} rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center ${textSize} font-semibold text-gray-600 dark:text-gray-300`}
    >
      {initials}
    </div>
  );
}

export default function AdminUserActivityPage() {
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<string>("30");
  const [breakdownView, setBreakdownView] = useState<"activity" | "identity">(
    "activity"
  );
  const [csvLoading, setCsvLoading] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (roleFilter !== "all") params.set("role", roleFilter);
    if (activityFilter !== "all") params.set("filter", activityFilter);
    params.set("range", dateRange);

    fetch(`/api/admin/user-activity?${params.toString()}`)
      .then((r) => {
        if (!r.ok) throw new Error("API error");
        return r.json();
      })
      .then((json: ActivityData) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error("[admin/user-activity] Failed to load activity data:", err);
        setData(null);
        setLoading(false);
      });
  }, [roleFilter, activityFilter, dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDownloadCSV = async () => {
    setCsvLoading(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (activityFilter !== "all") params.set("filter", activityFilter);
      params.set("range", dateRange);
      params.set("export", "csv");

      const res = await fetch(
        `/api/admin/user-activity?${params.toString()}`
      );
      if (!res.ok) throw new Error("Export failed");
      const json = await res.json();
      const csvData = json.csvData as {
        createdAt: string;
        userName: string;
        userEmail: string;
        category: string;
        detail: string | null;
        durationMs: number | null;
      }[];

      if (!csvData?.length) return;

      const headers = [
        "Date",
        "Time",
        "User",
        "Email",
        "Category",
        "Detail",
        "Duration (sec)",
      ];
      const rows = csvData.map((row) => {
        const d = new Date(row.createdAt);
        return [
          d.toLocaleDateString(),
          d.toLocaleTimeString(),
          row.userName,
          row.userEmail,
          CATEGORY_LABELS[row.category] || row.category,
          row.detail || "",
          row.durationMs ? Math.round(row.durationMs / 1000) : "",
        ];
      });

      const csvContent = [headers, ...rows]
        .map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
        )
        .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `user-activity-${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setCsvLoading(false);
    }
  };

  const activityFilters = [
    { key: "all", label: "All Activities" },
    { key: "chat", label: "Chat" },
    { key: "simulation", label: "Simulation" },
    { key: "submission", label: "Submission" },
    { key: "other", label: "Other" },
  ];

  const rangeFilters = [
    { key: "7", label: "7 Days" },
    { key: "30", label: "30 Days" },
    { key: "90", label: "90 Days" },
    { key: "all", label: "All Time" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight dark:text-gray-100">
          User Activity
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Monitor how users engage with platform features
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="STUDENT">Student</SelectItem>
            <SelectItem value="TA">TA</SelectItem>
            <SelectItem value="PROFESSOR">Professor</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
          </SelectContent>
        </Select>

        <Select value={activityFilter} onValueChange={setActivityFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Activities" />
          </SelectTrigger>
          <SelectContent>
            {activityFilters.map((f) => (
              <SelectItem key={f.key} value={f.key}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="30 Days" />
          </SelectTrigger>
          <SelectContent>
            {rangeFilters.map((f) => (
              <SelectItem key={f.key} value={f.key}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadCSV}
            disabled={csvLoading}
          >
            {csvLoading ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-1.5" />
            )}
            Export CSV
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-neutral-400 dark:text-neutral-500" />
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-neutral-500 dark:text-neutral-400">
            Failed to load activity data.
          </p>
        </div>
      ) : (
        <>
          <StatBand
            items={[
              {
                label: "Sessions",
                value: data.summary.sessionCount.toLocaleString(),
                hint: `Split after ${SESSION_GAP_MS / 60000} min idle`,
              },
              {
                label: "Average session",
                value: data.summary.avgSessionMs > 0 ? formatDuration(data.summary.avgSessionMs) : "--",
              },
              { label: "Unique users", value: data.summary.uniqueUsers },
              {
                label: "Measured time",
                value: data.summary.totalTimeMs > 0 ? formatDuration(data.summary.totalTimeMs) : "--",
                hint: "Foreground time on tracked pages",
              },
              {
                label: "Recorded events",
                value: data.summary.totalActivities.toLocaleString(),
                hint: `${data.summary.avgDailyActivities}/day average`,
              },
            ]}
          />

          <ActivityChart
            dailyTrend={data.dailyTrend}
            trendCategories={data.trendCategories}
            isDark={isDark}
          />

          {/* Two-column: Top Users + Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Users */}
            <Card className="flex flex-col">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-amber-500" />
                  <CardTitle className="text-base">Most Active Users</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                {data.topUsers.length === 0 ? (
                  <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-8">
                    No user data available
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                    {data.topUsers.slice(0, 10).map((user, i) => (
                      <div
                        key={user.email}
                        className="flex items-center gap-3"
                      >
                        <span className="text-xs font-bold text-gray-400 dark:text-gray-500 w-4 text-right tabular-nums">
                          {i + 1}
                        </span>
                        <UserAvatar
                          name={user.name}
                          image={user.image}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {user.name}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_BADGE_COLORS[user.role] || ROLE_BADGE_COLORS.STUDENT}`}
                            >
                              {user.role}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                            {user.email}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
                            {user.activityCount}
                          </div>
                          <div className="text-[10px] text-gray-400 dark:text-gray-500">
                            actions
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity Feed */}
            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-base">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                {data.recentActivity.length === 0 ? (
                  <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-8">
                    No recent activity
                  </p>
                ) : (
                  <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1">
                    {data.recentActivity.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <UserAvatar
                          name={item.user.name}
                          image={item.user.image}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {item.user.name}
                            </span>
                            <span
                              className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                              style={{
                                backgroundColor: item.categoryColor,
                              }}
                            />
                            <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
                              {item.categoryLabel}
                            </span>
                          </div>
                          {item.detail && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                              {item.detail}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 tabular-nums">
                          {timeAgo(item.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <UsageBreakdown
            timeByCategory={data.timeByCategory}
            timeByRole={data.timeByRole}
            breakdownView={breakdownView}
            onBreakdownViewChange={setBreakdownView}
          />
        </>
      )}
    </div>
  );
}
