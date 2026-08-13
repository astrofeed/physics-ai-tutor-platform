export const ACTIVITY_CATEGORIES = [
  "AI_CHAT",
  "ASSIGNMENT_VIEW",
  "ASSIGNMENT_SUBMIT",
  "GRADING",
  "SIMULATION",
  "PROBLEM_GEN",
  "ANALYTICS_VIEW",
  "ADMIN_ACTION",
] as const;

export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

/** Category groups used by heatmap/detail filters */
export const ACTIVITY_FILTER_CATEGORIES: Record<string, ActivityCategory[]> = {
  chat: ["AI_CHAT"],
  simulation: ["SIMULATION"],
  submission: ["ASSIGNMENT_SUBMIT", "ASSIGNMENT_VIEW"],
};

/**
 * Upper bound for a single measured visit. Foreground time is paused when a tab
 * is hidden, so anything longer means the clock kept running unattended.
 */
export const MAX_ACTIVITY_DURATION_MS = 2 * 60 * 60 * 1000;

/** Inactivity gap that ends a session and starts a new one */
export const SESSION_GAP_MS = 30 * 60 * 1000;

export interface ActivityEvent {
  createdAt: Date;
  durationMs: number | null;
}

export interface SessionSummary {
  count: number;
  totalMs: number;
}

/**
 * Derive sessions from recorded activity: consecutive events belong to the same
 * session until more than `gapMs` passes between the end of one and the start of
 * the next. A session's length spans its first event's start to its last event's
 * end, so idle gaps below the threshold count as time on the platform.
 */
export function summarizeSessions(
  events: ActivityEvent[],
  gapMs: number = SESSION_GAP_MS
): SessionSummary {
  const ordered = [...events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  let count = 0;
  let totalMs = 0;
  let start = 0;
  let end = 0;

  for (const event of ordered) {
    const eventStart = event.createdAt.getTime();
    const eventEnd = eventStart + Math.max(event.durationMs ?? 0, 0);

    if (count === 0 || eventStart - end > gapMs) {
      if (count > 0) totalMs += end - start;
      count++;
      start = eventStart;
      end = eventEnd;
      continue;
    }
    end = Math.max(end, eventEnd);
  }
  if (count > 0) totalMs += end - start;

  return { count, totalMs };
}

/** Format a Date as YYYY-MM-DD in the given IANA timezone */
export function toDateKey(date: Date, tz: string): string {
  return date.toLocaleDateString("en-CA", { timeZone: tz });
}

/** Return the requested IANA timezone, falling back to UTC when unsupported */
export function resolveTimezone(tzParam: string | null): string {
  if (!tzParam) return "UTC";
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tzParam });
    return tzParam;
  } catch {
    return "UTC";
  }
}
