"use client";

import React from "react";
import { Loader2, X } from "lucide-react";
import { formatDuration } from "@/lib/utils";
import { CATEGORY_LABELS } from "@/lib/constants";
import type { DayActivity } from "@/types/activity";

interface DayActivityPanelProps {
  date: string;
  activities: DayActivity[];
  loading: boolean;
  onClose: () => void;
}

export default function DayActivityPanel({ date, activities, loading, onClose }: DayActivityPanelProps) {
  const totalMs = activities.reduce((sum, a) => sum + (a.durationMs || 0), 0);
  const heading = new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="mt-4 border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/50">
        <div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{heading}</h4>
          {activities.length > 0 && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {activities.length} {activities.length === 1 ? "event" : "events"}
              {totalMs > 0 && ` · ${formatDuration(totalMs)} measured`}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close day detail"
          className="p-1 rounded-md hover:bg-secondary transition-colors"
        >
          <X className="h-4 w-4 text-gray-400" />
        </button>
      </div>
      <div className="max-h-[300px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : activities.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            Nothing recorded on this day
          </div>
        ) : (
          <div className="divide-y divide-border">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="shrink-0 w-[64px] text-right font-mono text-xs tabular-nums text-gray-500 dark:text-gray-400">
                  {new Date(activity.time).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    {CATEGORY_LABELS[activity.category] || activity.category}
                  </span>
                  {activity.detail && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 truncate">
                      {activity.detail}
                    </span>
                  )}
                </div>
                {activity.durationMs != null && activity.durationMs > 0 && (
                  <span className="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                    {formatDuration(activity.durationMs)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
