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
