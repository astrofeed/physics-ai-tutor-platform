"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  CATEGORY_COLORS,
  CATEGORY_COLOR_FALLBACK,
  CATEGORY_LABELS,
} from "@/lib/constants";
import { CHART_TOOLTIP_STYLE } from "@/lib/chart-theme";

interface ActivityChartProps {
  dailyTrend: Record<string, string | number>[];
  trendCategories: string[];
}

export function ActivityChart({ dailyTrend, trendCategories }: ActivityChartProps) {
  const gridColor = "hsl(var(--border))";
  const tickColor = "hsl(var(--muted-foreground))";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="section-title">Daily activity trend</CardTitle>
        <p className="text-caption text-muted-foreground">
          Activity count by category over time
        </p>
      </CardHeader>
      <CardContent>
        {dailyTrend.every((d) => d.total === 0) ? (
          <div className="flex h-[300px] items-center justify-center">
            <p className="text-body text-muted-foreground">
              No activity in this period
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyTrend}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={gridColor}
                vertical={false}
              />
              <XAxis
                dataKey="label"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                tick={{ fill: tickColor }}
              />
              <YAxis
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                tick={{ fill: tickColor }}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(
                  value: number | undefined,
                  name: string | undefined
                ) => [
                  value ?? 0,
                  CATEGORY_LABELS[name || ""] || name || "",
                ]}
                cursor={{ fill: "hsl(var(--secondary))" }}
              />
              {trendCategories.map((cat) => (
                <Bar
                  key={cat}
                  dataKey={cat}
                  stackId="1"
                  fill={CATEGORY_COLORS[cat] || CATEGORY_COLOR_FALLBACK}
                  radius={[0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}

        {trendCategories.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-3 border-t border-border pt-3">
            {trendCategories.map((cat) => (
              <div key={cat} className="flex items-center gap-1.5">
                <div
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{
                    backgroundColor: CATEGORY_COLORS[cat] || CATEGORY_COLOR_FALLBACK,
                  }}
                />
                <span className="text-caption text-muted-foreground">
                  {CATEGORY_LABELS[cat] || cat}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
