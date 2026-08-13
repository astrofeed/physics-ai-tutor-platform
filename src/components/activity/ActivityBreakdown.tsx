"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatDuration } from "@/lib/utils";
import { CATEGORY_LABELS } from "@/lib/constants";
import { CHART_SERIES_COLORS, CHART_TOOLTIP_STYLE } from "@/lib/chart-theme";
import type { CategoryUsage } from "@/types/activity";

interface ActivityBreakdownProps {
  data: CategoryUsage[];
}

export default function ActivityBreakdown({ data }: ActivityBreakdownProps) {
  const totalVisits = data.reduce((sum, d) => sum + d.count, 0);

  if (totalVisits === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Nothing recorded yet
      </p>
    );
  }

  const chartData = data.map((d, index) => ({
    name: CATEGORY_LABELS[d.category] || d.category,
    category: d.category,
    count: d.count,
    totalMs: d.totalMs || 0,
    color: CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length],
  }));

  return (
    <div className="space-y-5">
      <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 36 + 30)}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 20, top: 4, bottom: 4 }}>
          <XAxis type="number" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="name" fontSize={12} tickLine={false} axisLine={false} width={130} />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value: number | undefined) => [`${value ?? 0} visits`, "Opened"]}
          />
          <Bar dataKey="count" radius={[0, 2, 2, 0]} barSize={16}>
            {chartData.map((entry) => (
              <Cell key={entry.category} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 border-t border-border pt-4">
        {chartData.map((item) => (
          <div key={item.category}>
            <dt className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.name}</dt>
            <dd className="mt-0.5 text-sm tabular-nums text-gray-900 dark:text-gray-100">
              {item.count} visits
              {item.totalMs > 0 && (
                <span className="text-gray-500 dark:text-gray-400"> · {formatDuration(item.totalMs)}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
