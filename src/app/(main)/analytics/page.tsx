"use client";

import React, { useEffect, useState, useCallback } from "react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatBand } from "@/components/ui/stat-band";
import DayActivityPanel from "./DayActivityPanel";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import ContributionGraph from "@/components/activity/ContributionGraph";
import ActivityBreakdown from "@/components/activity/ActivityBreakdown";
import { useTrackTime } from "@/lib/use-track-time";
import type { DayActivity } from "@/types/activity";
import { CHART_TOOLTIP_STYLE } from "@/lib/chart-theme";

interface AnalyticsData {
  overview: {
    averagePercent: number;
    totalMessages: number;
    totalConversations: number;
    totalSubmissions: number;
    trackedStudyMinutes: number;
  };
  weeklyActivity: { date: string; day: string; messages: number }[];
  scoreHistory: {
    title: string;
    score: number;
    totalPoints: number;
    percent: number;
    date: string;
  }[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [heatmapData, setHeatmapData] = useState<{ date: string; count: number }[]>([]);
  const [breakdownData, setBreakdownData] = useState<{ category: string; count: number; totalMs?: number }[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayActivities, setDayActivities] = useState<DayActivity[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activityFilter, setActivityFilter] = useState<string>("all");

  useTrackTime("ANALYTICS_VIEW");

  // Get user's IANA timezone for server-side date grouping
  const userTz = typeof window !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : "UTC";

  useEffect(() => {
    const tzParam = `tz=${encodeURIComponent(userTz)}`;
    Promise.all([
      fetch(`/api/analytics?${tzParam}`).then((r) => r.json()),
      fetch(`/api/activity/heatmap?${tzParam}`).then((r) => r.json()),
      fetch("/api/activity/breakdown").then((r) => r.json()),
    ])
      .then(([analyticsJson, heatmapJson, breakdownJson]) => {
        setData(analyticsJson);
        setHeatmapData(heatmapJson.data || []);
        setBreakdownData(breakdownJson.data || []);
        setLoading(false);
      })
      .catch((err) => { console.error("[analytics] Failed to load analytics data:", err); setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch heatmap when activity filter changes
  useEffect(() => {
    const params = new URLSearchParams({ tz: userTz });
    if (activityFilter !== "all") params.set("filter", activityFilter);
    fetch(`/api/activity/heatmap?${params}`)
      .then((r) => r.json())
      .then((json) => setHeatmapData(json.data || []))
      .catch((err) => console.error("[analytics] Failed to refresh heatmap:", err));
    // Clear day detail when filter changes
    setSelectedDate(null);
    setDayActivities([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityFilter]);


  const handleSelectDate = useCallback((date: string) => {
    if (selectedDate === date) {
      setSelectedDate(null);
      setDayActivities([]);
      return;
    }
    setSelectedDate(date);
    setLoadingDetail(true);
    const detailParams = new URLSearchParams({ date, tz: userTz });
    if (activityFilter !== "all") detailParams.set("filter", activityFilter);
    fetch(`/api/activity/detail?${detailParams}`)
      .then((r) => r.json())
      .then((json) => {
        setDayActivities(json.activities || []);
        setLoadingDetail(false);
      })
      .catch((err) => {
        console.error("[analytics] Failed to load day detail:", err);
        setLoadingDetail(false);
      });
  }, [selectedDate, activityFilter, userTz]);

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!data || !data.overview) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Failed to load analytics data.</p>
      </div>
    );
  }

  const formatStudyTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Your record</p>
        <h1 className="mt-1.5 text-[28px] leading-tight text-gray-900 dark:text-gray-100">Learning analytics</h1>
      </div>

      <StatBand
        items={[
          { label: "Average score", value: `${data.overview.averagePercent}%`, hint: "Graded submissions" },
          { label: "Messages", value: data.overview.totalMessages, hint: `${data.overview.totalConversations} conversations` },
          {
            label: "Time on platform",
            value: formatStudyTime(data.overview.trackedStudyMinutes),
            hint: "Measured while pages were open",
          },
          { label: "Submissions", value: data.overview.totalSubmissions, hint: "Assignments handed in" },
        ]}
      />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Chat volume</CardTitle>
            <p className="text-xs text-muted-foreground">Messages per day, last 7 days</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.weeklyActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" fontSize={12} tickLine={false} />
                <YAxis fontSize={12} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Bar dataKey="messages" fill="hsl(var(--chart-1))" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Score History */}
        <Card>
          <CardHeader>
            <CardTitle>Score history</CardTitle>
            <p className="text-xs text-muted-foreground">Graded assignments, in order</p>
          </CardHeader>
          <CardContent>
            {data.scoreHistory.length === 0 ? (
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-sm text-muted-foreground">No graded submissions yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.scoreHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="title"
                    fontSize={11}
                    tickLine={false}
                    angle={-35}
                    textAnchor="end"
                    height={70}
                    tickFormatter={(title: string) =>
                      title.length > 18 ? `${title.slice(0, 18)}…` : title
                    }
                  />
                  <YAxis
                    fontSize={12}
                    tickLine={false}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(value: number | undefined) => [`${value ?? 0}%`, "Score"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="percent"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--chart-1))", r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Heatmap */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle>Daily activity</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Events recorded per day over the past year</p>
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
              {[
                { key: "all", label: "All" },
                { key: "chat", label: "Chat" },
                { key: "simulation", label: "Simulation" },
                { key: "submission", label: "Submission" },
                { key: "other", label: "Other" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setActivityFilter(f.key)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    activityFilter === f.key
                      ? "bg-primary text-primary-foreground"
                      : "text-gray-500 dark:text-gray-400 hover:bg-secondary"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ContributionGraph
            data={heatmapData}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
          />

          {selectedDate && (
            <DayActivityPanel
              date={selectedDate}
              activities={dayActivities}
              loading={loadingDetail}
              onClose={() => { setSelectedDate(null); setDayActivities([]); }}
            />
          )}
        </CardContent>
      </Card>

      {/* Feature Usage Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Where the time goes</CardTitle>
          <p className="text-xs text-muted-foreground">Page visits and measured time per feature</p>
        </CardHeader>
        <CardContent>
          <ActivityBreakdown data={breakdownData} />
        </CardContent>
      </Card>
    </div>
  );
}
