"use client";

import { StaffOnly } from "@/components/auth/StaffOnly";
import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatBand } from "@/components/ui/stat-band";
import { CHART_TOOLTIP_STYLE } from "@/lib/chart-theme";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface AdminAnalyticsData {
  overview: {
    totalUsers: number;
    totalConversations: number;
    totalMessages: number;
    totalSubmissions: number;
  };
  dailyActivity: { date: string; day: string; messages: number }[];
  scoreDistribution: { range: string; count: number }[];
  assignmentAvgs: { title: string; avgPercent: number; submissions: number }[];
}

function AdminAnalyticsPageContent() {
  const [data, setData] = useState<AdminAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error("[admin-analytics] Failed to load analytics data:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400 dark:text-neutral-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Failed to load analytics data.</p>
      </div>
    );
  }

  return (
    <div className="page-sections">
      <div className="page-header">
        <p className="eyebrow-signal">Platform</p>
        <h1 className="page-title">Admin analytics</h1>
      </div>

      <StatBand
        items={[
          { label: "Users", value: data.overview.totalUsers },
          { label: "Conversations", value: data.overview.totalConversations },
          { label: "Messages", value: data.overview.totalMessages },
          { label: "Submissions", value: data.overview.totalSubmissions },
        ]}
      />

      {/* Daily Activity Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily activity</CardTitle>
          <p className="text-xs text-muted-foreground">Messages per day, last 14 days</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.dailyActivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" fontSize={11} tickLine={false} angle={-30} textAnchor="end" height={60} />
              <YAxis fontSize={12} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Bar dataKey="messages" fill="hsl(var(--chart-1))" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Score Distribution & Assignment Averages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Score distribution</CardTitle>
            <p className="text-xs text-muted-foreground">Submissions per score range</p>
          </CardHeader>
          <CardContent>
            {data.scoreDistribution.every((d) => d.count === 0) ? (
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-sm text-muted-foreground">No graded submissions yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.scoreDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="range" fontSize={12} tickLine={false} />
                  <YAxis fontSize={12} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Assignment averages</CardTitle>
            <p className="text-xs text-muted-foreground">Lowest average first</p>
          </CardHeader>
          <CardContent>
            {data.assignmentAvgs.length === 0 ? (
              <div className="flex items-center justify-center h-[300px]">
                <p className="text-sm text-muted-foreground">No assignment data yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.assignmentAvgs} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    type="number"
                    fontSize={12}
                    tickLine={false}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <YAxis
                    dataKey="title"
                    type="category"
                    fontSize={11}
                    tickLine={false}
                    width={120}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(value: number | undefined) => [`${value ?? 0}%`, "Avg score"]}
                  />
                  <Bar dataKey="avgPercent" fill="hsl(var(--chart-1))" radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  return (
    <StaffOnly minRole="PROFESSOR">
      <AdminAnalyticsPageContent />
    </StaffOnly>
  );
}
