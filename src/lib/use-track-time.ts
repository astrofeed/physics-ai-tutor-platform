"use client";

import { useEffect } from "react";
import type { ActivityCategory } from "./activity";
import { MAX_ACTIVITY_DURATION_MS } from "./activity";

const FLUSH_INTERVAL_MS = 60_000;

/**
 * Records a visit to a feature plus the foreground time spent on it. The clock
 * pauses while the tab is hidden, and each flush sends the running total, which
 * the server overwrites — so repeated flushes stay idempotent.
 */
export function useTrackTime(category: ActivityCategory, detail?: string) {
  useEffect(() => {
    let activityId: string | null = null;
    let accumulatedMs = 0;
    let sentMs = 0;
    let visibleSince: number | null =
      document.visibilityState === "visible" ? Date.now() : null;
    let flushWhenCreated = false;

    const foregroundMs = () =>
      Math.min(
        accumulatedMs + (visibleSince === null ? 0 : Date.now() - visibleSince),
        MAX_ACTIVITY_DURATION_MS
      );

    const flush = (useBeacon: boolean) => {
      const durationMs = foregroundMs();
      if (!activityId || durationMs - sentMs < 1000) return;
      sentMs = durationMs;

      const payload = JSON.stringify({ id: activityId, durationMs });
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon("/api/activity", new Blob([payload], { type: "application/json" }));
        return;
      }
      fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch((err) => console.error("[activity] Failed to send duration:", err));
    };

    fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, detail }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (!json.id) return;
        activityId = json.id;
        if (flushWhenCreated) flush(false);
      })
      .catch((err) => console.error("[activity] Failed to create activity:", err));

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (visibleSince !== null) {
          accumulatedMs += Date.now() - visibleSince;
          visibleSince = null;
        }
        flush(true);
      } else if (visibleSince === null) {
        visibleSince = Date.now();
      }
    };

    const handlePageHide = () => flush(true);
    const interval = window.setInterval(() => flush(false), FLUSH_INTERVAL_MS);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      if (visibleSince !== null) {
        accumulatedMs += Date.now() - visibleSince;
        visibleSince = null;
      }
      flushWhenCreated = true;
      flush(true);
    };
  }, [category, detail]);
}
